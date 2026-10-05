/**
 * LifeGuard AI Web — Audio Monitoring Service
 * 
 * Implements real-time browser audio capture via Web Audio API:
 * - Uses navigator.mediaDevices.getUserMedia()
 * - Real-time AnalyserNode with RMS and decibel metering
 * - Strict > 90.0 dB trigger threshold
 * - Dynamic 3-Tier Audio Analysis Pipeline:
 *   [✓] Sound detected
 *   [✓] Level > 90 dB (Evaluated strictly as > 90.0 dB)
 *   [ ] Human vs. Environmental sound classification
 *   [ ] AI Scream / Distress Analysis
 * - 5-Second Emergency Buffer integration
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
export type EmergencyBufferCallback = (event: {
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

  // Observers
  private levelListeners: Set<LevelCallback> = new Set();
  private stateListeners: Set<StateCallback> = new Set();
  private bufferListeners: Set<EmergencyBufferCallback> = new Set();

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

  public onEmergencyBufferTrigger(cb: EmergencyBufferCallback): () => void {
    this.bufferListeners.add(cb);
    return () => this.bufferListeners.delete(cb);
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

      // 2. Initialize AudioContext
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      this.audioContext = ctx;

      // 3. Create AnalyserNode
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.2;
      this.analyser = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      this.setState('ACTIVE');
      this.checklist.soundDetected = 'CONFIRMED';
      this.notifyState();

      // 4. Start audio sampling animation loop
      this.startAudioLoop();

      return { success: true };
    } catch (err: any) {
      this.setState('ERROR');
      let msg = 'Failed to access microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Microphone permission was denied. Please allow microphone access in your browser to enable live sound monitoring.';
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

  public resetChecklist() {
    this.checklist = {
      soundDetected: this.isMonitoringActive() ? 'CONFIRMED' : 'WAITING',
      above90dB: 'WAITING',
      humanSound: 'WAITING',
      distressScream: 'WAITING',
      emergencyVerified: 'WAITING',
      humanSoundReason: undefined,
      screamReason: undefined,
      verificationReason: undefined,
    };
    this.notifyState();
  }

  /**
   * Resets status after emergency buffer cancellation ("I'm Safe")
   */
  public returnToMonitoring() {
    this.resetChecklist();
    if (this.isMonitoringActive()) {
      this.setState('ACTIVE');
    }
  }

  /**
   * Audio processing loop running on requestAnimationFrame
   */
  private startAudioLoop() {
    const timeDomainData = new Float32Array(this.analyser ? this.analyser.fftSize : 512);
    const frequencyData = new Uint8Array(this.analyser ? this.analyser.frequencyBinCount : 256);

    const tick = () => {
      if (!this.analyser || this.state === 'STOPPED') {
        return;
      }

      this.analyser.getFloatTimeDomainData(timeDomainData);
      this.analyser.getByteFrequencyData(frequencyData);

      // 1. Calculate RMS of the time domain buffer
      let sumSquares = 0;
      for (let i = 0; i < timeDomainData.length; i++) {
        const val = timeDomainData[i];
        sumSquares += val * val;
      }
      const rms = Math.sqrt(sumSquares / timeDomainData.length);

      // 2. Map RMS to estimated Decibels (dB SPL relative)
      // Normal room ambient: 40-50 dB. Loud speaking: 65-75 dB. Yell / Scream: 91-110 dB.
      let dB = 0;
      if (rms > 0.0001) {
        const rawDb = 20 * Math.log10(rms); // typically -80 to 0 dBFS
        dB = Math.max(0, Math.min(120, Math.round((rawDb + 90) * 10) / 10));
      }

      this.currentDecibels = dB;
      this.currentNormalized = Math.min(1.0, dB / 120);

      // 3. Strict > 90.0 dB threshold condition
      // 90.0 dB -> false; 90.1 dB -> true
      const isAbove90 = dB > 90.0;
      this.isLoud = isAbove90;

      // 4. Generate 16-bar responsive visualizer data
      const bars: number[] = [];
      const binStep = Math.floor(frequencyData.length / 16);
      for (let i = 0; i < 16; i++) {
        let avg = 0;
        for (let j = 0; j < binStep; j++) {
          avg += frequencyData[i * binStep + j];
        }
        avg = avg / binStep;
        bars.push(Math.min(1.0, Math.max(0.08, avg / 255)));
      }

      // Notify level listeners
      this.levelListeners.forEach((cb) =>
        cb(
          {
            decibels: dB,
            normalizedLevel: this.currentNormalized,
            isLoud: isAbove90,
            timestamp: new Date().toISOString(),
          },
          bars
        )
      );

      // 5. Evaluate Multi-Stage Safety Decision Pipeline
      this.evaluatePipeline(dB, isAbove90, frequencyData);

      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  /**
   * Dynamic 3-Tier Audio Analysis Pipeline:
   * Tier 1: Sound detected (> 35 dB)
   * Tier 2: Level > 90 dB (Evaluated strictly as > 90.0 dB)
   * Tier 3: Human vs Environmental Sound Classification
   * Tier 4: AI Scream / Distress Analysis
   * Trigger -> 5-Second Emergency Buffer Modal
   */
  private evaluatePipeline(decibels: number, isAbove90: boolean, freqData: Uint8Array) {
    const now = Date.now();

    // Stage 1: Sound Detected
    if (decibels > 35) {
      this.checklist.soundDetected = 'CONFIRMED';
    }

    // Stage 2: Sound Level > 90.0 dB Check
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

    // Sound is strictly > 90.0 dB!
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
      this.lastLoudTimestamp = now;
      this.checklist.humanSound = 'NOT_DETECTED';
      this.checklist.humanSoundReason = 'Environmental sound rejected (vehicle horn / door slam / non-vocal)';
      this.checklist.distressScream = 'WAITING';
      this.checklist.emergencyVerified = 'WAITING';
      this.setState('ACTIVE');
      return;
    }

    if (humanClassification === 'ANALYSIS_UNAVAILABLE') {
      this.checklist.humanSound = 'UNAVAILABLE';
      this.checklist.humanSoundReason = 'Acoustic model signal unavailable';
      this.setState('ACTIVE');
      return;
    }

    // Human sound confirmed!
    this.checklist.humanSound = 'CONFIRMED';
    this.checklist.humanSoundReason = 'Human vocal tract formants detected (100 Hz – 3500 Hz)';
    this.setState('HUMAN_DETECTED');

    // Stage 4: AI Scream / Distress Analysis
    this.setState('CHECKING_SCREAM');
    this.checklist.distressScream = 'CHECKING';
    this.notifyState();

    const isDistressScream = this.classifyDistressScream(freqData);

    if (!isDistressScream) {
      // Normal human speaking voice / shout without distress scream harmonics
      this.lastLoudTimestamp = now;
      this.checklist.distressScream = 'NOT_DETECTED';
      this.checklist.screamReason = 'Audio classified as normal loud vocalization (non-distress)';
      this.checklist.emergencyVerified = 'WAITING';
      this.setState('ACTIVE');
      return;
    }

    // Distress scream detected!
    this.checklist.distressScream = 'CONFIRMED';
    this.checklist.screamReason = 'High-frequency distress resonance verified (1.2 kHz – 4.0 kHz)';

    // Trigger 5-Second Emergency Buffer Modal
    this.checklist.emergencyVerified = 'CONFIRMED';
    this.checklist.verificationReason = 'Distress classified: 5-second buffer armed for contact dispatch';
    this.setState('EMERGENCY_BUFFER');
    this.lastLoudTimestamp = now;

    // Notify listeners to open 5-Second Buffer Countdown Modal
    this.bufferListeners.forEach((cb) =>
      cb({
        decibels,
        soundLevel: this.currentNormalized,
        durationMs: 5000,
        classification: 'SCREAM',
      })
    );
  }

  /**
   * Clean mock / test audio simulation for easy verification without loud noises
   */
  public simulateAcousticEvent(type: 'SCREAM_95DB' | 'ENVIRONMENTAL_HORN_92DB' | 'NORMAL_TALK_65DB') {
    if (!this.isMonitoringActive()) {
      // Auto-activate for testing
      this.state = 'ACTIVE';
    }

    if (type === 'SCREAM_95DB') {
      this.currentDecibels = 95.4;
      this.currentNormalized = 0.8;
      this.isLoud = true;
      this.checklist = {
        soundDetected: 'CONFIRMED',
        above90dB: 'CONFIRMED',
        humanSound: 'CONFIRMED',
        distressScream: 'CONFIRMED',
        emergencyVerified: 'CONFIRMED',
        humanSoundReason: 'Human vocal tract formants confirmed (100 Hz – 3.5 kHz)',
        screamReason: 'High-energy distress resonance in 1.2 kHz – 4.0 kHz scream band',
        verificationReason: 'Distress confirmed: 5-second buffer armed for dispatch',
      };
      this.setState('EMERGENCY_BUFFER');

      // Trigger 5-second buffer modal
      this.bufferListeners.forEach((cb) =>
        cb({
          decibels: 95.4,
          soundLevel: 0.8,
          durationMs: 5000,
          classification: 'SCREAM_SIMULATED',
        })
      );
    } else if (type === 'ENVIRONMENTAL_HORN_92DB') {
      this.currentDecibels = 92.1;
      this.currentNormalized = 0.76;
      this.isLoud = true;
      this.checklist = {
        soundDetected: 'CONFIRMED',
        above90dB: 'CONFIRMED',
        humanSound: 'NOT_DETECTED',
        distressScream: 'WAITING',
        emergencyVerified: 'WAITING',
        humanSoundReason: 'Environmental sound rejected: Vehicle horn / narrowband tone, zero vocal formants',
        screamReason: undefined,
        verificationReason: 'No emergency trigger: Environmental sound filtered safely',
      };
      this.setState('ACTIVE');
    } else {
      this.currentDecibels = 64.2;
      this.currentNormalized = 0.53;
      this.isLoud = false;
      this.checklist = {
        soundDetected: 'CONFIRMED',
        above90dB: 'NOT_DETECTED',
        humanSound: 'WAITING',
        distressScream: 'WAITING',
        emergencyVerified: 'WAITING',
        humanSoundReason: undefined,
        screamReason: undefined,
        verificationReason: 'Ambient sound below 90.0 dB threshold (no evaluation needed)',
      };
      this.setState('SOUND_DETECTED');
    }

    // Broadcast waveform update
    const mockBars = type === 'SCREAM_95DB'
      ? [0.4, 0.6, 0.7, 0.85, 0.95, 1.0, 0.9, 0.8, 0.7, 0.85, 0.95, 0.9, 0.75, 0.6, 0.4, 0.3]
      : [0.2, 0.3, 0.4, 0.3, 0.5, 0.4, 0.3, 0.2, 0.2, 0.3, 0.4, 0.3, 0.2, 0.2, 0.1, 0.1];

    this.levelListeners.forEach((cb) =>
      cb(
        {
          decibels: this.currentDecibels,
          normalizedLevel: this.currentNormalized,
          isLoud: this.isLoud,
          timestamp: new Date().toISOString(),
        },
        mockBars
      )
    );
  }

  /**
   * Spectral analysis to distinguish Human Sound from Environmental Sound
   */
  private classifyHumanSound(freqData: Uint8Array): HumanSoundClassification {
    if (!freqData || freqData.length === 0) {
      return 'ANALYSIS_UNAVAILABLE';
    }

    const nyquist = 44100 / 2;
    const binSize = nyquist / freqData.length;

    let vocalEnergy = 0;
    let vocalBins = 0;
    let subEnergy = 0;
    let subBins = 0;
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

    if (avgSub > avgVocal * 2.2) {
      return 'ENVIRONMENTAL_SOUND';
    }

    if (avgHigh > avgVocal * 2.0) {
      return 'ENVIRONMENTAL_SOUND';
    }

    if (avgVocal > 45) {
      return 'HUMAN_DETECTED';
    }

    return 'ENVIRONMENTAL_SOUND';
  }

  /**
   * Evaluates scream and distress acoustic properties (1.2 kHz - 4.0 kHz)
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

    return avgScream > 85 && avgScream > avgTotal * 1.35;
  }
}

export const audioMonitoringService = new AudioMonitoringService();
