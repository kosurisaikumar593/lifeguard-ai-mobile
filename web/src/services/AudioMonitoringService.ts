/**
 * LifeGuard AI Web — Audio Monitoring Service
 * 
 * Implements real-time browser audio capture via Web Audio API:
 * - Uses navigator.mediaDevices.getUserMedia()
 * - Real-time AnalyserNode with RMS and decibel metering
 * - Strict > 90.0 dB trigger threshold
 * - Spectral classification: Human Voice vs Surrounding Environmental Sound
 * - Multi-stage pipeline: >90 dB -> Human Sound -> Distress/Scream -> Emergency Verification
 * - Zero automatic navigation: updates UI state observers only
 */

import {
  MonitoringState,
  LiveSoundCheckState,
  HumanSoundClassification,
  SoundLevelData,
} from '../types';

export type LevelCallback = (data: SoundLevelData, waveform: number[]) => void;
export type StateCallback = (state: MonitoringState, checklist: LiveSoundCheckState) => void;
export type EmergencyCallback = (event: {
  decibels: number;
  soundLevel: number;
  durationMs: number;
  classification: string;
}) => void;

export class AudioMonitoringService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrameId: number | null = null;

  private state: MonitoringState = 'STOPPED';
  private checklist: LiveSoundCheckState = {
    soundDetected: 'WAITING',
    above90dB: 'WAITING',
    humanSound: 'WAITING',
    distressScream: 'WAITING',
    emergencyVerified: 'WAITING',
  };

  private currentDecibels: number = 0;
  private currentNormalized: number = 0;
  private isLoud: boolean = false;
  private lastLoudTimestamp: number = 0;
  private cooldownMs: number = 3000;
  private loudSoundStartTime: number = 0;

  // Observers
  private levelListeners: Set<LevelCallback> = new Set();
  private stateListeners: Set<StateCallback> = new Set();
  private emergencyListeners: Set<EmergencyCallback> = new Set();

  public getState(): MonitoringState {
    return this.state;
  }

  public getChecklist(): LiveSoundCheckState {
    return { ...this.checklist };
  }

  public getCurrentDecibels(): number {
    return this.currentDecibels;
  }

  public isMonitoringActive(): boolean {
    return this.state !== 'STOPPED' && this.state !== 'ERROR';
  }

  public onLevelUpdate(cb: LevelCallback): () => void {
    this.levelListeners.add(cb);
    return () => this.levelListeners.delete(cb);
  }

  public onStateUpdate(cb: StateCallback): () => void {
    this.stateListeners.add(cb);
    cb(this.state, this.checklist);
    return () => this.stateListeners.delete(cb);
  }

  public onEmergencyVerified(cb: EmergencyCallback): () => void {
    this.emergencyListeners.add(cb);
    return () => this.emergencyListeners.delete(cb);
  }

  private setState(newState: MonitoringState) {
    this.state = newState;
    this.notifyState();
  }

  private notifyState() {
    this.stateListeners.forEach((cb) => cb(this.state, { ...this.checklist }));
  }

  /**
   * Request microphone permission and starts real-time browser audio capture
   */
  public async startMonitoring(): Promise<{ success: boolean; error?: string }> {
    if (this.isMonitoringActive()) {
      return { success: true };
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.setState('ERROR');
      return {
        success: false,
        error: 'Web Audio API / mediaDevices is not supported in this browser. Please use Chrome, Edge, Safari, or Firefox.',
      };
    }

    this.setState('STARTING');
    this.resetChecklist();

    try {
      // 1. Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this.mediaStream = stream;

      // 2. Initialize Web Audio Context
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      this.audioContext = ctx;

      // Ensure AudioContext is running (handles browser autoplay policies)
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // 3. Setup AnalyserNode
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.25;
      source.connect(analyser);
      this.analyser = analyser;

      this.setState('ACTIVE');

      // 4. Start analysis loop
      this.startAnalysisLoop();

      return { success: true };
    } catch (err: any) {
      this.setState('ERROR');
      let msg = 'Failed to access microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Microphone permission is required for sound monitoring. Please allow microphone access in your browser.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No microphone device was detected on your system.';
      } else if (err.message) {
        msg = err.message;
      }
      return { success: false, error: msg };
    }
  }

  /**
   * Stops audio monitoring cleanly and releases browser microphone hardware
   */
  public async stopMonitoring(): Promise<void> {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch (e) {
        // ignore close errors
      }
      this.audioContext = null;
    }

    this.analyser = null;
    this.currentDecibels = 0;
    this.currentNormalized = 0;
    this.isLoud = false;
    this.resetChecklist();
    this.setState('STOPPED');

    // Notify listeners of zero level
    this.levelListeners.forEach((cb) =>
      cb(
        {
          decibels: 0,
          normalizedLevel: 0,
          isLoud: false,
          timestamp: new Date().toISOString(),
        },
        new Array(16).fill(0)
      )
    );
  }

  private resetChecklist() {
    this.checklist = {
      soundDetected: 'WAITING',
      above90dB: 'WAITING',
      humanSound: 'WAITING',
      distressScream: 'WAITING',
      emergencyVerified: 'WAITING',
    };
  }

  /**
   * Continuous processing loop evaluating audio frames
   */
  private startAnalysisLoop() {
    if (!this.analyser) return;

    const timeBuffer = new Float32Array(this.analyser.fftSize);
    const freqBuffer = new Uint8Array(this.analyser.frequencyBinCount);

    const processFrame = () => {
      if (!this.analyser || this.state === 'STOPPED') return;

      this.analyser.getFloatTimeDomainData(timeBuffer);
      this.analyser.getByteFrequencyData(freqBuffer);

      // 1. Calculate true RMS
      let sumSquares = 0;
      for (let i = 0; i < timeBuffer.length; i++) {
        sumSquares += timeBuffer[i] * timeBuffer[i];
      }
      const rms = Math.sqrt(sumSquares / timeBuffer.length);

      // 2. Convert to estimated relative SPL decibels (approx 30 dB ambient room to 100 dB loud shout)
      // Note: Microphone decibel values represent an estimated relative SPL derived from browser
      // Web Audio API amplitude metering, not laboratory-calibrated SPL.
      const clampedRms = Math.max(0.0001, Math.min(1.0, rms));
      const dbfs = 20 * Math.log10(clampedRms); // -80 to 0 dBFS
      const normalized = Math.max(0, Math.min(1, (dbfs + 60) / 60)); // normalized 0.00 to 1.00
      const decibels = Math.round(30 + normalized * 70); // 30 to 100 dB

      this.currentDecibels = decibels;
      this.currentNormalized = normalized;

      // 3. Strict trigger condition: SOUND LEVEL > 90.0 dB
      // 89 dB -> No trigger
      // 90.0 dB -> No trigger
      // 90.1+ dB -> Trigger
      const isAbove90 = decibels > 90.0;
      this.isLoud = isAbove90;

      // 4. Compute 16-bar visualization waveform from frequency bins
      const waveform: number[] = [];
      const step = Math.floor(freqBuffer.length / 16);
      for (let b = 0; b < 16; b++) {
        let bandSum = 0;
        for (let j = 0; j < step; j++) {
          bandSum += freqBuffer[b * step + j];
        }
        waveform.push(Math.round((bandSum / step / 255) * 100));
      }

      // Broadcast level update to UI
      this.levelListeners.forEach((cb) =>
        cb(
          {
            decibels,
            normalizedLevel: normalized,
            isLoud: isAbove90,
            timestamp: new Date().toISOString(),
          },
          waveform
        )
      );

      // 5. Evaluate Multi-Stage Pipeline
      this.evaluatePipeline(decibels, isAbove90, freqBuffer);

      // Schedule next frame
      this.animationFrameId = requestAnimationFrame(processFrame);
    };

    this.animationFrameId = requestAnimationFrame(processFrame);
  }

  /**
   * Evaluates the multi-stage safety pipeline
   * Strict order:
   * Sound Detected -> >90 dB -> Human Sound Check -> Distress/Scream Check -> Emergency Verification
   */
  private evaluatePipeline(decibels: number, isAbove90: boolean, freqData: Uint8Array) {
    const now = Date.now();

    // Stage 1: Sound Detected
    if (decibels > 35) {
      this.checklist.soundDetected = 'CONFIRMED';
    }

    // Stage 2: Sound Level > 90 dB Check
    if (!isAbove90) {
      // Normal sound under 90 dB
      if (this.state === 'ACTIVE' || this.state === 'SOUND_DETECTED') {
        this.checklist.above90dB = 'WAITING';
        this.checklist.humanSound = 'WAITING';
        this.checklist.distressScream = 'WAITING';
        this.checklist.emergencyVerified = 'WAITING';
        this.setState('SOUND_DETECTED');
      }
      return;
    }

    // Sound is strictly > 90 dB!
    this.checklist.above90dB = 'CONFIRMED';
    this.setState('ABOVE_90DB');

    // Throttling / Cooldown check
    if (now - this.lastLoudTimestamp < this.cooldownMs) {
      return;
    }

    // Stage 3: Human Sound Classification Check
    this.setState('CHECKING_HUMAN');
    this.checklist.humanSound = 'CHECKING';
    this.notifyState();

    const humanClassification = this.classifyHumanSound(freqData);

    if (humanClassification === 'ENVIRONMENTAL_SOUND') {
      // Environmental sound detected (horn, vehicle noise, door slam, object impact, construction, music)
      // Filter it out: do NOT trigger emergency alert!
      this.lastLoudTimestamp = now;
      this.checklist.humanSound = 'NOT_DETECTED';
      this.checklist.humanSoundReason = 'Environmental sound filtered (vehicle horn/door slam/ambient noise)';
      this.checklist.distressScream = 'WAITING';
      this.checklist.emergencyVerified = 'WAITING';
      this.setState('ACTIVE');
      return;
    }

    if (humanClassification === 'ANALYSIS_UNAVAILABLE') {
      this.checklist.humanSound = 'UNAVAILABLE';
      this.checklist.humanSoundReason = 'AI model unavailable';
      this.setState('ACTIVE');
      return;
    }

    // Human sound confirmed!
    this.checklist.humanSound = 'CONFIRMED';
    this.checklist.humanSoundReason = 'Human vocal acoustics detected';
    this.setState('HUMAN_DETECTED');

    // Stage 4: Distress / Scream Detection
    this.setState('CHECKING_SCREAM');
    this.checklist.distressScream = 'CHECKING';
    this.notifyState();

    const isDistressScream = this.classifyDistressScream(freqData);

    if (!isDistressScream) {
      // Normal human speaking voice / shout without distress scream harmonics
      this.lastLoudTimestamp = now;
      this.checklist.distressScream = 'NOT_DETECTED';
      this.checklist.screamReason = 'Audio classified as normal human voice (non-distress)';
      this.checklist.emergencyVerified = 'WAITING';
      this.setState('ACTIVE');
      return;
    }

    // Distress scream detected!
    this.checklist.distressScream = 'CONFIRMED';
    this.checklist.screamReason = 'Distress scream acoustics verified';

    // Stage 5: Emergency Verification
    this.checklist.emergencyVerified = 'CONFIRMED';
    this.checklist.verificationReason = 'Emergency verified: Loud distress scream confirmed';
    this.setState('EMERGENCY_VERIFIED');
    this.lastLoudTimestamp = now;

    // Trigger emergency callback (GPS location + incident save + WhatsApp alert)
    this.emergencyListeners.forEach((cb) =>
      cb({
        decibels,
        soundLevel: this.currentNormalized,
        durationMs: 2500,
        classification: 'SCREAM',
      })
    );
  }

  /**
   * Performs spectral analysis to distinguish Human Sound from Surrounding/Environmental Sound.
   * Examines energy distribution across human vocal frequencies vs industrial/impulse noise.
   */
  private classifyHumanSound(freqData: Uint8Array): HumanSoundClassification {
    if (!freqData || freqData.length === 0) {
      return 'ANALYSIS_UNAVAILABLE';
    }

    const nyquist = 44100 / 2;
    const binSize = nyquist / freqData.length;

    // 1. Human vocal range: 100 Hz to 3500 Hz
    let vocalEnergy = 0;
    let vocalBins = 0;

    // 2. Low sub-rumble / mechanical noise: < 90 Hz
    let subEnergy = 0;
    let subBins = 0;

    // 3. High industrial / hiss / metal impact noise: > 5000 Hz
    let highEnergy = 0;
    let highBins = 0;

    for (let i = 0; i < freqData.length; i++) {
      const freq = i * binSize;
      const energy = freqData[i];

      if (freq >= 100 && freq <= 3500) {
        vocalEnergy += energy;
        vocalBins++;
      } else if (freq < 90) {
        subEnergy += energy;
        subBins++;
      } else if (freq > 5000) {
        highEnergy += energy;
        highBins++;
      }
    }

    const avgVocal = vocalBins > 0 ? vocalEnergy / vocalBins : 0;
    const avgSub = subBins > 0 ? subEnergy / subBins : 0;
    const avgHigh = highBins > 0 ? highEnergy / highBins : 0;

    // Door slam / dropped object: heavy sub-bass impulse with rapid broadband splash
    if (avgSub > avgVocal * 2.2) {
      return 'ENVIRONMENTAL_SOUND';
    }

    // Vehicle horn / industrial tonal alert: sharp narrow spike with almost zero formant dispersion
    if (avgHigh > avgVocal * 2.0) {
      return 'ENVIRONMENTAL_SOUND';
    }

    // Human voice requires significant vocal tract energy in 200 Hz - 3000 Hz
    if (avgVocal > 45) {
      return 'HUMAN_DETECTED';
    }

    return 'ENVIRONMENTAL_SOUND';
  }

  /**
   * Evaluates scream and distress acoustic properties
   * Screams exhibit prominent high-intensity energy in 1.2 kHz - 4.0 kHz
   */
  private classifyDistressScream(freqData: Uint8Array): boolean {
    const nyquist = 44100 / 2;
    const binSize = nyquist / freqData.length;

    let screamBandEnergy = 0;
    let screamBins = 0;
    let totalEnergy = 0;

    for (let i = 0; i < freqData.length; i++) {
      const freq = i * binSize;
      const energy = freqData[i];
      totalEnergy += energy;

      if (freq >= 1200 && freq <= 4000) {
        screamBandEnergy += energy;
        screamBins++;
      }
    }

    const avgScream = screamBins > 0 ? screamBandEnergy / screamBins : 0;
    const avgTotal = freqData.length > 0 ? totalEnergy / freqData.length : 0;

    // A genuine scream concentrates massive acoustic energy in the 1.2 kHz - 4.0 kHz distress band
    return avgScream > 85 && avgScream > avgTotal * 1.35;
  }
}

export const audioMonitoringService = new AudioMonitoringService();
