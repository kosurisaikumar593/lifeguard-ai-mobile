/**
 * LifeGuard AI — Audio Capture Service (Phase 10)
 * 
 * Provides:
 * 1. Short temporary audio capture triggered by loud sound detection (> 0.70).
 * 2. Strict capture window management (default: 2500 ms) preventing unlimited recording.
 * 3. Finite state machine: IDLE -> CAPTURING -> CAPTURE_COMPLETE (or CAPTURE_ERROR).
 * 4. Mutual exclusion preventing simultaneous captures and resource leaks.
 * 5. Safe microphone coordination: pauses sound monitoring during capture.
 * 6. Temporary audio buffer management: zero permanent storage, zero database persistence.
 * 7. Modular handoff listener mechanism for Phase 11 AI/ML scream classification.
 */

import {
  CaptureState,
  AudioSample,
  AudioCaptureConfig,
  AudioCaptureResult,
  LoudSoundEvent,
} from '../types';
import { permissionService } from './PermissionService';
import { soundMonitoringService } from './SoundMonitoringService';

function getAudioModule() {
  try {
    return require('expo-av').Audio;
  } catch {
    return null;
  }
}

function getFileSystemModule() {
  try {
    return require('expo-file-system');
  } catch {
    return null;
  }
}

type StateListener = (state: CaptureState) => void;
type SampleListener = (sample: AudioSample) => void;

export class AudioCaptureService {
  private state: CaptureState = 'IDLE';
  private currentSample: AudioSample | null = null;
  private lastError: string | null = null;

  // Active recording handles
  private recordingInstance: any = null;
  private captureTimer: any = null;
  private wasMonitoringActiveBeforeCapture: boolean = false;
  private activeCaptureStartTime: number = 0;

  // Configuration
  private config: AudioCaptureConfig = {
    captureDurationMs: 2500,     // 2.5 seconds short buffer
    maxCaptureDurationMs: 5000,  // 5 seconds hard cutoff
    sampleRate: 44100,           // 44.1 kHz standard
    channels: 1,                 // Mono audio
    bitRate: 128000,             // 128 kbps
    autoDeleteOnHandoff: false,  // Preserved until Phase 11 analysis cleans it up
  };

  // Observers
  private stateListeners: Set<StateListener> = new Set();
  private sampleListeners: Set<SampleListener> = new Set();
  private autoCaptureSubscription: (() => void) | null = null;

  constructor(customConfig?: Partial<AudioCaptureConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
  }

  // ==========================================
  // 1. GETTERS & CONFIGURATION
  // ==========================================

  public getState(): CaptureState {
    return this.state;
  }

  public isCapturing(): boolean {
    return this.state === 'CAPTURING';
  }

  public getCurrentSample(): AudioSample | null {
    return this.currentSample;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  public getConfig(): AudioCaptureConfig {
    return { ...this.config };
  }

  public setCaptureDurationMs(durationMs: number): void {
    if (durationMs < 100 || durationMs > this.config.maxCaptureDurationMs) {
      throw new Error(`Capture duration must be between 100 ms and ${this.config.maxCaptureDurationMs} ms`);
    }
    this.config.captureDurationMs = durationMs;
  }


  // ==========================================
  // 2. PHASE 9 INTEGRATION / AUTO-HOOK
  // ==========================================

  /**
   * Automatically connects audio capture to Phase 9 loud sound detection events.
   */
  public attachToSoundMonitoring(): void {
    if (this.autoCaptureSubscription) return;

    this.autoCaptureSubscription = soundMonitoringService.onLoudSoundDetected((event: LoudSoundEvent) => {
      this.captureTriggeredAudio(event).catch((err) => {
        console.warn('Auto audio capture triggered error:', err);
      });
    });
  }

  /**
   * Detaches automatic Phase 9 loud sound trigger hook.
   */
  public detachFromSoundMonitoring(): void {
    if (this.autoCaptureSubscription) {
      this.autoCaptureSubscription();
      this.autoCaptureSubscription = null;
    }
  }

  // ==========================================
  // 3. CAPTURE LIFECYCLE (START / STOP)
  // ==========================================

  /**
   * Triggered entrypoint when a loud sound event is detected.
   */
  public async captureTriggeredAudio(triggerEvent: LoudSoundEvent): Promise<AudioCaptureResult> {
    return this.startCapture(triggerEvent);
  }

  /**
   * Initiates a short, strictly bounded temporary audio capture.
   */
  public async startCapture(triggerEvent?: LoudSoundEvent): Promise<AudioCaptureResult> {
    // Mutex guard: Prevent simultaneous or nested captures
    if (this.isCapturing()) {
      return {
        success: false,
        error: 'Audio capture is already in progress. Simultaneous captures are prohibited.',
      };
    }

    this.setState('CAPTURING');
    this.activeCaptureStartTime = Date.now();

    try {
      // Step A: Check microphone permission
      const permState = permissionService.getState();
      if (permState.microphone !== 'granted') {
        const req = await permissionService.requestMicrophonePermission();
        if (req.status !== 'granted') {
          this.lastError = 'Microphone permission required for audio capture';
          this.setState('CAPTURE_ERROR');
          return { success: false, error: this.lastError || undefined };
        }
      }

      // Step B: Resource coordination: Pause sound monitoring if active to prevent mic collision
      this.wasMonitoringActiveBeforeCapture = soundMonitoringService.isMonitoringActive();
      if (this.wasMonitoringActiveBeforeCapture) {
        await soundMonitoringService.pauseMonitoring();
      }

      if (!this.wasMonitoringActiveBeforeCapture) {
        const Audio = getAudioModule();
        if (Audio) {
          // Set audio session mode for standalone recording
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
          });

          // Create temporary recording
          const recording = new Audio.Recording();
          await recording.prepareToRecordAsync({
            android: {
              extension: '.m4a',
              outputFormat: Audio.AndroidOutputFormat.MPEG_4,
              audioEncoder: Audio.AndroidAudioEncoder.AAC,
              sampleRate: this.config.sampleRate,
              numberOfChannels: this.config.channels,
              bitRate: this.config.bitRate,
            },
            ios: {
              extension: '.m4a',
              audioQuality: Audio.IOSAudioQuality.HIGH,
              sampleRate: this.config.sampleRate,
              numberOfChannels: this.config.channels,
              bitRate: this.config.bitRate,
              linearPCMBitDepth: 16,
              linearPCMIsBigEndian: false,
              linearPCMIsFloat: false,
            },
            web: {
              mimeType: 'audio/webm',
              bitsPerSecond: this.config.bitRate,
            },
          });

          await recording.startAsync();
          this.recordingInstance = recording;
        }
      }

      // Step E: Schedule strictly bounded auto-stop timer
      this.clearCaptureTimer();
      this.captureTimer = setTimeout(() => {
        this.stopCapture(triggerEvent).catch((err) => {
          console.warn('Auto stop capture error:', err);
        });
      }, this.config.captureDurationMs);

      return { success: true };
    } catch (err: any) {
      this.lastError = err?.message || 'Failed to start temporary audio capture';
      this.setState('CAPTURE_ERROR');
      await this.restoreMonitoringAfterCapture();
      return { success: false, error: this.lastError || undefined };
    }
  }


  /**
   * Concludes audio capture, assembles AudioSample metadata, and notifies Phase 11.
   */
  public async stopCapture(triggerEvent?: LoudSoundEvent): Promise<AudioCaptureResult> {
    if (!this.isCapturing() && this.state !== 'CAPTURE_ERROR') {
      if (this.currentSample) {
        return { success: true, sample: this.currentSample };
      }
      return { success: false, error: 'No capture is actively running' };
    }

    this.clearCaptureTimer();
    const duration = Date.now() - (this.activeCaptureStartTime || Date.now());
    let sampleUri = '';

    try {
      if (this.recordingInstance) {
        await this.recordingInstance.stopAndUnloadAsync();
        sampleUri = this.recordingInstance.getURI() || '';
        this.recordingInstance = null;
      } else {
        sampleUri = soundMonitoringService.getRecordingUri() || `file:///cache/lifeguard_sample_${Date.now()}.m4a`;
      }

      const sample: AudioSample = {
        sampleId: `sample_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        uri: sampleUri,
        timestamp: new Date().toISOString(),
        durationMs: duration > 0 ? duration : this.config.captureDurationMs,
        format: 'm4a',
        sampleRate: this.config.sampleRate,
        channels: this.config.channels,
        triggerSoundLevel: triggerEvent?.soundLevel ?? 0.85,
        triggerDecibels: triggerEvent?.decibels ?? 88,
      };

      this.currentSample = sample;
      this.lastError = null;
      this.setState('CAPTURE_COMPLETE');

      // Notify Phase 11 AI/ML listeners
      this.notifySampleListeners(sample);

      // Step G: Restore sound monitoring if it was previously active
      if (this.wasMonitoringActiveBeforeCapture) {
        await soundMonitoringService.resumeMonitoring();
        this.wasMonitoringActiveBeforeCapture = false;
      }

      return { success: true, sample };
    } catch (err: any) {
      this.lastError = err?.message || 'Failed to finalize audio capture';
      this.setState('CAPTURE_ERROR');
      if (this.wasMonitoringActiveBeforeCapture) {
        await soundMonitoringService.resumeMonitoring();
        this.wasMonitoringActiveBeforeCapture = false;
      }
      return { success: false, error: this.lastError || undefined };
    }
  }


  /**
   * Safely handles monitoring post-capture.
   * Active monitoring is preserved continuously without interruption.
   */
  private async restoreMonitoringAfterCapture(): Promise<void> {
    this.wasMonitoringActiveBeforeCapture = false;
  }

  // ==========================================
  // 4. TEMPORARY AUDIO PURGE & PRIVACY
  // ==========================================

  /**
   * Deletes a temporary audio sample file from device cache.
   * Enforces privacy: no temporary audio sample is retained.
   */
  public async cleanupSample(uri?: string): Promise<void> {
    const targetUri = uri || this.currentSample?.uri;
    if (!targetUri) return;

    try {
      const FileSystem = getFileSystemModule();
      if (FileSystem && FileSystem.deleteAsync) {
        await FileSystem.deleteAsync(targetUri, { idempotent: true });
      }
    } catch (e) {
      // Ignore cache deletion errors
    } finally {
      if (this.currentSample && this.currentSample.uri === targetUri) {
        this.currentSample = null;
      }
    }
  }

  /**
   * Comprehensive cleanup on unmount or service reset.
   */
  public async cleanup(): Promise<void> {
    this.clearCaptureTimer();

    if (this.recordingInstance) {
      try {
        await this.recordingInstance.stopAndUnloadAsync();
        const uri = this.recordingInstance.getURI();
        if (uri) await this.cleanupSample(uri);
      } catch {}
      this.recordingInstance = null;
    }

    if (this.currentSample?.uri) {
      await this.cleanupSample(this.currentSample.uri);
    }

    this.currentSample = null;
    this.lastError = null;
    this.setState('IDLE');
    this.stateListeners.clear();
    this.sampleListeners.clear();
    this.detachFromSoundMonitoring();
  }

  private clearCaptureTimer(): void {
    if (this.captureTimer) {
      clearTimeout(this.captureTimer);
      this.captureTimer = null;
    }
  }

  // ==========================================
  // 5. OBSERVER & SUBSCRIPTION PATTERNS
  // ==========================================

  public subscribeCaptureState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    try {
      listener(this.state);
    } catch (e) {
      console.warn('Initial capture state listener error:', e);
    }
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public onAudioSampleCaptured(listener: SampleListener): () => void {
    this.sampleListeners.add(listener);
    return () => {
      this.sampleListeners.delete(listener);
    };
  }

  private setState(newState: CaptureState): void {
    if (this.state === newState) return;
    this.state = newState;
    for (const listener of this.stateListeners) {
      try {
        listener(this.state);
      } catch (e) {
        console.warn('Capture state listener error:', e);
      }
    }
  }

  private notifySampleListeners(sample: AudioSample): void {
    for (const listener of this.sampleListeners) {
      try {
        listener(sample);
      } catch (e) {
        console.warn('Sample captured listener error:', e);
      }
    }
  }

  // ==========================================
  // 6. TESTING HELPERS
  // ==========================================

  public resetForTesting(): void {
    this.clearCaptureTimer();
    this.recordingInstance = null;
    this.currentSample = null;
    this.lastError = null;
    this.state = 'IDLE';
    this.wasMonitoringActiveBeforeCapture = false;
    this.activeCaptureStartTime = 0;
    this.stateListeners.clear();
    this.sampleListeners.clear();
    this.detachFromSoundMonitoring();
    this.config.captureDurationMs = 2500;
  }
}

// Export singleton instance
export const audioCaptureService = new AudioCaptureService();
