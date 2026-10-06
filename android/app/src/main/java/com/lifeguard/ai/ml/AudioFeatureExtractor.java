package com.lifeguard.ai.ml;

import java.util.Arrays;

/**
 * On-Device Audio Feature Extractor for LifeGuard AI.
 * Computes Log-Mel Spectrogram features matching the Python preprocessing pipeline.
 *
 * Parameters:
 * - Sample Rate: 16,000 Hz
 * - Duration: 3.0 seconds (48,000 samples)
 * - FFT Size: 1024 (Radix-2 Cooley-Tukey)
 * - Hop Length: 512
 * - Mel Bins: 64
 * - Frames: 92
 * - Frequency Range: 50 Hz to 8000 Hz
 */
public class AudioFeatureExtractor {

    public static final int SAMPLE_RATE = 16000;
    public static final int TARGET_SAMPLES = 48000; // 3.0 seconds
    public static final int N_FFT = 1024;
    public static final int HOP_LENGTH = 512;
    public static final int N_MELS = 64;
    public static final int NUM_FRAMES = 92;
    public static final float F_MIN = 50.0f;
    public static final float F_MAX = 8000.0f;

    private final float[] hannWindow;
    private final float[][] melFilterbank;

    public AudioFeatureExtractor() {
        this.hannWindow = precomputeHannWindow(N_FFT);
        this.melFilterbank = precomputeMelFilterbank(N_FFT, SAMPLE_RATE, N_MELS, F_MIN, F_MAX);
    }

    /**
     * Converts raw 16-bit PCM byte array into normalized float samples [-1.0, 1.0].
     */
    public float[] pcmBytesToNormalizedFloats(byte[] pcmBytes) {
        int numShorts = pcmBytes.length / 2;
        float[] audio = new float[TARGET_SAMPLES];
        int count = Math.min(numShorts, TARGET_SAMPLES);

        float maxVal = 0.0f;
        for (int i = 0; i < count; i++) {
            short sample = (short) ((pcmBytes[i * 2] & 0xFF) | (pcmBytes[i * 2 + 1] << 8));
            float val = sample / 32768.0f;
            audio[i] = val;
            float abs = Math.abs(val);
            if (abs > maxVal) {
                maxVal = abs;
            }
        }

        // Peak normalization
        if (maxVal > 1e-6f) {
            for (int i = 0; i < count; i++) {
                audio[i] /= maxVal;
            }
        }

        return audio;
    }

    /**
     * Extracts Log-Mel Spectrogram of shape [1][NUM_FRAMES][N_MELS][1].
     */
    public float[][][][] extractFeatures(float[] audio) {
        float[][][][] output = new float[1][NUM_FRAMES][N_MELS][1];
        int numBins = N_FFT / 2 + 1; // 513

        double sum = 0.0;
        int totalElements = NUM_FRAMES * N_MELS;

        float[][] rawSpectrogram = new float[NUM_FRAMES][N_MELS];

        for (int frameIdx = 0; frameIdx < NUM_FRAMES; frameIdx++) {
            int start = frameIdx * HOP_LENGTH;
            float[] windowedFrame = new float[N_FFT];

            for (int i = 0; i < N_FFT; i++) {
                int sampleIdx = start + i;
                if (sampleIdx < audio.length) {
                    windowedFrame[i] = audio[sampleIdx] * hannWindow[i];
                } else {
                    windowedFrame[i] = 0.0f;
                }
            }

            // Real and Imaginary components for FFT
            double[] real = new double[N_FFT];
            double[] imag = new double[N_FFT];
            for (int i = 0; i < N_FFT; i++) {
                real[i] = windowedFrame[i];
                imag[i] = 0.0;
            }

            cooleyTukeyFft(real, imag);

            // Compute power spectrum (size 513)
            float[] powerSpectrum = new float[numBins];
            for (int k = 0; k < numBins; k++) {
                double r = real[k];
                double im = imag[k];
                powerSpectrum[k] = (float) ((r * r + im * im) / N_FFT);
            }

            // Apply Mel filterbank
            for (int m = 0; m < N_MELS; m++) {
                float melEnergy = 0.0f;
                float[] filter = melFilterbank[m];
                for (int k = 0; k < numBins; k++) {
                    melEnergy += filter[k] * powerSpectrum[k];
                }
                float logMel = (float) Math.log(melEnergy + 1e-6f);
                rawSpectrogram[frameIdx][m] = logMel;
                sum += logMel;
            }
        }

        // Compute mean and standard deviation for normalization
        float mean = (float) (sum / totalElements);
        double varSum = 0.0;
        for (int f = 0; f < NUM_FRAMES; f++) {
            for (int m = 0; m < N_MELS; m++) {
                double diff = rawSpectrogram[f][m] - mean;
                varSum += diff * diff;
            }
        }
        float std = (float) Math.sqrt(varSum / totalElements);
        if (std < 1e-6f) std = 1.0f;

        // Populate standardized tensor
        for (int f = 0; f < NUM_FRAMES; f++) {
            for (int m = 0; m < N_MELS; m++) {
                output[0][f][m][0] = (rawSpectrogram[f][m] - mean) / std;
            }
        }

        return output;
    }

    private static float[] precomputeHannWindow(int length) {
        float[] window = new float[length];
        for (int i = 0; i < length; i++) {
            window[i] = (float) (0.5 * (1.0 - Math.cos(2.0 * Math.PI * i / (length - 1))));
        }
        return window;
    }

    private static float hzToMel(float freq) {
        return (float) (2595.0 * Math.log10(1.0 + freq / 700.0));
    }

    private static float melToHz(float mel) {
        return (float) (700.0 * (Math.pow(10.0, mel / 2595.0) - 1.0));
    }

    private static float[][] precomputeMelFilterbank(int nFft, int sampleRate, int nMels, float fMin, float fMax) {
        int numBins = nFft / 2 + 1;
        float melMin = hzToMel(fMin);
        float melMax = hzToMel(fMax);

        float[] melPoints = new float[nMels + 2];
        for (int i = 0; i <= nMels + 1; i++) {
            melPoints[i] = melMin + (melMax - melMin) * i / (nMels + 1);
        }

        int[] binPoints = new int[nMels + 2];
        for (int i = 0; i <= nMels + 1; i++) {
            float hz = melToHz(melPoints[i]);
            binPoints[i] = Math.min(numBins - 1, (int) Math.floor((nFft + 1) * hz / sampleRate));
        }

        float[][] filters = new float[nMels][numBins];
        for (int m = 0; m < nMels; m++) {
            int left = binPoints[m];
            int center = binPoints[m + 1];
            int right = binPoints[m + 2];

            if (center > left) {
                for (int k = left; k < center; k++) {
                    filters[m][k] = (float) (k - left) / (float) (center - left);
                }
            }
            if (right > center) {
                for (int k = center; k < right; k++) {
                    filters[m][k] = (float) (right - k) / (float) (right - center);
                }
            }
        }
        return filters;
    }

    /**
     * Radix-2 in-place Cooley-Tukey FFT implementation.
     */
    private static void cooleyTukeyFft(double[] real, double[] imag) {
        int n = real.length;
        if (Integer.bitCount(n) != 1) {
            throw new IllegalArgumentException("Length must be a power of 2");
        }

        // Bit reversal
        int shift = 1 + Integer.numberOfLeadingZeros(n);
        for (int i = 0; i < n; i++) {
            int j = Integer.reverse(i) >>> shift;
            if (j > i) {
                double tempR = real[i];
                real[i] = real[j];
                real[j] = tempR;
                double tempI = imag[i];
                imag[i] = imag[j];
                imag[j] = tempI;
            }
        }

        // Cooley-Tukey iteration
        for (int len = 2; len <= n; len <<= 1) {
            int halfLen = len >> 1;
            double angle = -2.0 * Math.PI / len;
            double wStepR = Math.cos(angle);
            double wStepI = Math.sin(angle);

            for (int i = 0; i < n; i += len) {
                double wR = 1.0;
                double wI = 0.0;
                for (int j = 0; j < halfLen; j++) {
                    double uR = real[i + j];
                    double uI = imag[i + j];
                    double vR = real[i + j + halfLen] * wR - imag[i + j + halfLen] * wI;
                    double vI = real[i + j + halfLen] * wI + imag[i + j + halfLen] * wR;

                    real[i + j] = uR + vR;
                    imag[i + j] = uI + vI;
                    real[i + j + halfLen] = uR - vR;
                    imag[i + j + halfLen] = uI - vI;

                    double nextWR = wR * wStepR - wI * wStepI;
                    double nextWI = wR * wStepI + wI * wStepR;
                    wR = nextWR;
                    wI = nextWI;
                }
            }
        }
    }
}
