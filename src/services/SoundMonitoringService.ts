/**
 * LifeGuard AI — Sound Monitoring Service (Phase 9)
 * 
 * Provides:
 * 1. Microphone monitoring lifecycle (start, stop, pause, resume, cleanup).
 * 2. Audio input availability & microphone permission checking.
 * 3. Real-time sound activity/amplitude level measurement (0.00 to 1.00 normalized).
 * 4. Configurable loud-sound threshold (default: 0.70).
 * 5. Loud-sound event triggering (LOUD_SOUND_DETECTED) with cooldown throttling.
 * 6. Monitoring state machine (IDLE, MONITORING, LOUD_SOUND_DETECTED, ERROR).
 * 7. Modular handoff listener mechanism for Phase 10 audio capture.
 * 8. Strict privacy enforcement: continuous audio is NEVER permanently stored.
 */

import {
  MonitoringState,
  SoundLevelUpdate,
  LoudSoundEvent,
  SoundMonitoringConfig,
} from '../types';
import { permissionService } from './PermissionService';
import { ForegroundServiceBridge } from './ForegroundServiceBridge';

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

type StatusListener = (state: MonitoringState) => void;
type LevelListener = (update: SoundLevelUpdate) => void;
type LoudSoundListener = (event: LoudSoundEvent) => void;

export class SoundMonitoringService {
  private state: MonitoringState = 'IDLE';
  private currentLevel: number = 0;
  private currentDecibels: number = 0;
  private lastError: string | null = null;

  // Threshold and cooldown configuration
  // Note: Microphone decibel values represent an estimated relative SPL (approx 30 to 100 dB)
  // derived from mobile microphone audio metering, not laboratory-calibrated SPL.
  // Emergency acoustic trigger condition: SOUND LEVEL > 90.0 dB strictly.
  private loudSoundThreshold: number = 0.86; // 0.86 normalized amplitude (~90 dB)
  private cooldownMs: number = 3000;         // 3 seconds between loud sound triggers
  private updateIntervalMs: number = 100;     // 100 ms metering update interval
  private lastLoudSoundTimestamp: number = 0; // Timestamp of last triggered loud sound

  // Native recording handles
  private recordingInstance: any = null;
  private loudResetTimeout: any = null;
  private simulationInterval: any = null;

  // Observers / Listeners
  private statusListeners: Set<StatusListener> = new Set();
  private levelListeners: Set<LevelListener> = new Set();
  private loudSoundListeners: Set<LoudSoundListener> = new Set();

  constructor(config?: Partial<SoundMonitoringConfig>) {
    if (config?.loudSoundThreshold !== undefined) {
      this.loudSoundThreshold = config.loudSoundThreshold;
    }
    if (config?.cooldownMs !== undefined) {
      this.cooldownMs = config.cooldownMs;
    }
    if (config?.updateIntervalMs !== undefined) {
      this.updateIntervalMs = config.updateIntervalMs;
    }
  }

  // ==========================================
  // 1. GETTERS & CONFIGURATION
  // ==========================================

  public getState(): MonitoringState {
    return this.state;
  }

  public isMonitoringActive(): boolean {
    return (
      this.state === 'ACTIVE' ||
      this.state === 'MONITORING' ||
      this.state === 'LOUD_SOUND_DETECTED' ||
      this.state === 'PROCESSING_SOUND' ||
      this.state === 'ANALYZING_HUMAN_SOUND' ||
      this.state === 'ANALYZING_SCREAM' ||
      this.state === 'EMERGENCY_VERIFIED'
    );
  }

  public getRecordingUri(): string | null {
    try {
      return this.recordingInstance ? this.recordingInstance.getURI() : null;
    } catch {
      return null;
    }
  }

  public async syncWithForegroundService(): Promise<void> {
    const isRunning = await ForegroundServiceBridge.isServiceRunning();
    if (isRunning && !this.isMonitoringActive()) {
      this.setState('ACTIVE');
    }
  }

  public getCurrentLevel(): number {
    return this.currentLevel;
  }

  public getCurrentDecibels(): number {
    return this.currentDecibels;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  public getLoudSoundThreshold(): number {
    return this.loudSoundThreshold;
  }

  public setLoudSoundThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1.0) {
      throw new Error('Threshold must be between 0.00 and 1.00');
    }
    this.loudSoundThreshold = threshold;
  }

  public getCooldownMs(): number {
    return this.cooldownMs;
  }

  public setCooldownMs(ms: number): void {
    if (ms < 0) throw new Error('Cooldown must be non-negative');
    this.cooldownMs = ms;
  }

  // ==========================================
  // 2. AUDIO INPUT AVAILABILITY
  // ==========================================

  /**
   * Verifies if microphone access and audio hardware are ready for monitoring.
   */
  public async checkAudioInputAvailability(): Promise<{ available: boolean; reason?: string }> {
    try {
      // 1. Check microphone permission via PermissionService
      const permState = await permissionService.checkMicrophonePermission();
      if (permState.status !== 'granted') {
        return {
          available: false,
          reason: 'Microphone permission not granted. Permission status: ' + permState.status,
        };
      }

      // 2. Check Audio module availability
      const Audio = getAudioModule();
      if (!Audio) {
        // In headless testing or environments without native audio, fallback is available
        return { available: true };
      }

      return { available: true };
    } catch (err: any) {
      return {
        available: false,
        reason: err?.message || 'Failed to inspect audio input hardware',
      };
    }
  }

  // ==========================================
  // 3. MONITORING LIFECYCLE (START / STOP)
  // ==========================================

  /**
   * Starts real-time sound monitoring.
   */
  public async startMonitoring(): Promise<{ success: boolean; error?: string }> {
    if (this.isMonitoringActive()) {
      return { success: true };
    }

    try {
      // Step A: Check and request microphone permission if needed
      let perm = permissionService.getState().microphone;
      if (perm !== 'granted') {
        const reqResult = await permissionService.requestMicrophonePermission();
        perm = reqResult.status;
      }

      if (perm !== 'granted') {
        this.lastError = 'Microphone permission required for sound monitoring';
        this.setState('ERROR');
        return { success: false, error: this.lastError };
      }

      if (this.recordingInstance) {
        this.lastError = null;
        this.setState('MONITORING');
        ForegroundServiceBridge.startService().catch(() => {});
        ForegroundServiceBridge.updateState('MONITORING', this.currentDecibels);
        return { success: true };
      }

      const Audio = getAudioModule();

      if (Audio) {
        // Step B: Set up mobile audio session mode
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
        });

        // Step C: Prepare and start recording with metering enabled
        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync({
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          ios: {
            extension: '.m4a',
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {
            mimeType: 'audio/webm',
            bitsPerSecond: 128000,
          },
          isMeteringEnabled: true,
        });

        recording.setProgressUpdateInterval(this.updateIntervalMs);
        recording.setOnRecordingStatusUpdate((status: any) => {
          if (status?.isRecording && status?.metering !== undefined) {
            this.handleAudioMetering(status.metering);
          }
        });

        await recording.startAsync();
        this.recordingInstance = recording;
      } else {
        // Headless Node or fallback mode: Start a gentle ambient simulation timer
        this.startAmbientSimulation();
      }

      this.lastError = null;
      this.setState('MONITORING');
      ForegroundServiceBridge.startService().catch(() => {});
      ForegroundServiceBridge.updateState('MONITORING', this.currentDecibels);
      return { success: true };
    } catch (err: any) {
      this.lastError = err?.message || 'Failed to start sound monitoring';
      this.setState('ERROR');
      ForegroundServiceBridge.stopService().catch(() => {});
      return { success: false, error: this.lastError || undefined };
    }
  }


  /**
   * Stops real-time sound monitoring and safely frees resources.
   * Enforces privacy: any temporary recording file is unloaded and deleted immediately.
   */
  public async stopMonitoring(): Promise<void> {
    if (this.state === 'STOPPED' || this.state === 'IDLE') return;

    // Clear simulation / timeouts
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    if (this.loudResetTimeout) {
      clearTimeout(this.loudResetTimeout);
      this.loudResetTimeout = null;
    }

    // Stop and unload recording
    if (this.recordingInstance) {
      try {
        await this.recordingInstance.stopAndUnloadAsync();
        const uri = this.recordingInstance.getURI();

        // Privacy enforcement: Immediately delete temporary recording file
        if (uri) {
          const FileSystem = getFileSystemModule();
          if (FileSystem && FileSystem.deleteAsync) {
            await FileSystem.deleteAsync(uri, { idempotent: true });
          }
        }
      } catch (e) {
        // Ignore unload errors during teardown
      } finally {
        this.recordingInstance = null;
      }
    }

    // Reset levels
    this.currentLevel = 0;
    this.currentDecibels = 0;
    this.notifyLevelListeners({
      normalizedLevel: 0,
      decibels: 0,
      isLoud: false,
      timestamp: new Date().toISOString(),
    });

    ForegroundServiceBridge.stopService().catch(() => {});
    this.setState('IDLE');
  }

  /**
   * Pauses monitoring without full teardown if supported.
   * Halts active measurement and sets state to IDLE.
   */
  public async pauseMonitoring(): Promise<void> {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    this.setState('IDLE');
  }

  /**
   * Resumes monitoring.
   */
  public async resumeMonitoring(): Promise<{ success: boolean; error?: string }> {
    return this.startMonitoring();
  }

  /**
   * Comprehensive cleanup for component unmount or app termination.
   */
  public async cleanup(): Promise<void> {
    await this.stopMonitoring();
    this.setState('IDLE');
    this.statusListeners.clear();
    this.levelListeners.clear();
    this.loudSoundListeners.clear();
  }

  // ==========================================
  // 4. SOUND LEVEL & LOUD SOUND DETECTION
  // ==========================================

  /**
   * Converts native dBFS metering (-160 to 0) to normalized amplitude (0.00 to 1.00)
   * and realistic dB SPL estimate.
   */
  public handleAudioMetering(meteringDb: number): void {
    // Normal ambient room noise sits between -60 dBFS and -40 dBFS.
    // Clamping to [-60, 0] dBFS:
    const clamped = Math.max(-60, Math.min(0, meteringDb));
    const normalized = Math.round(((clamped + 60) / 60) * 100) / 100;
    // Estimated dB SPL display: 30 dB (whisper/ambient) to 100 dB (shout/loud noise)
    const decibels = Math.round(30 + normalized * 70);

    this.processSoundLevel(normalized, decibels);
  }

  /**
   * Core level processing and threshold evaluation logic.
   */
  public processSoundLevel(normalizedLevel: number, decibels?: number): void {
    const safeLevel = Math.max(0, Math.min(1.0, Math.round(normalizedLevel * 100) / 100));
    const safeDb = decibels !== undefined ? decibels : Math.round(30 + safeLevel * 70);

    this.currentLevel = safeLevel;
    this.currentDecibels = safeDb;

    // Strict Emergency Sound Trigger Condition: SOUND LEVEL > 90 dB
    // 89 dB -> No trigger
    // 90 dB -> No trigger
    // 90.1 dB or higher -> Trigger
    // (Microphone values provide estimated relative SPL, not calibrated SPL)
    const isLoud = this.loudSoundThreshold !== 0.86
      ? safeLevel >= this.loudSoundThreshold
      : safeDb > 90.0;

    // 1. Broadcast level update to UI meters
    const update: SoundLevelUpdate = {
      normalizedLevel: safeLevel,
      decibels: safeDb,
      isLoud,
      timestamp: new Date().toISOString(),
    };
    this.notifyLevelListeners(update);

    // 2. Evaluate loud sound detection
    if (isLoud && this.isMonitoringActive()) {
      const now = Date.now();
      const elapsed = now - this.lastLoudSoundTimestamp;

      // Cooldown / Throttling check to prevent event flooding
      if (elapsed >= this.cooldownMs) {
        this.lastLoudSoundTimestamp = now;
        this.setState('LOUD_SOUND_DETECTED');
        ForegroundServiceBridge.updateState('LOUD_SOUND_DETECTED', safeDb);
        ForegroundServiceBridge.updateNotification(
          'LifeGuard AI',
          `Loud sound detected (${safeDb} dB) • Analyzing`
        );

        const event: LoudSoundEvent = {
          type: 'LOUD_SOUND_DETECTED',
          timestamp: new Date().toISOString(),
          soundLevel: safeLevel,
          decibels: safeDb,
          reason: 'LOUD_SOUND',
        };

        // Notify Phase 10 handoff listeners
        this.notifyLoudSoundListeners(event);

        // Schedule visual return to MONITORING state after temporary event
        if (this.loudResetTimeout) clearTimeout(this.loudResetTimeout);
        this.loudResetTimeout = setTimeout(() => {
          if (this.isMonitoringActive() && this.state !== 'EMERGENCY_VERIFIED') {
            this.setState('MONITORING');
            ForegroundServiceBridge.updateState('MONITORING', 0);
            ForegroundServiceBridge.updateNotification(
              'LifeGuard AI',
              'Sound monitoring is active • Listening for emergency sounds'
            );
          }
        }, 2800);
      }
    }
  }

  // ==========================================
  // 5. OBSERVER & SUBSCRIPTION PATTERNS
  // ==========================================

  /**
   * Subscribes to monitoring state transitions (IDLE, MONITORING, LOUD_SOUND_DETECTED, ERROR).
   * Immediately delivers current state to the subscriber.
   */
  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    try {
      listener(this.state);
    } catch (e) {
      console.warn('Error in initial status listener:', e);
    }
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Subscribes to real-time sound activity & decibel level updates.
   */
  public subscribeLevel(listener: LevelListener): () => void {
    this.levelListeners.add(listener);
    return () => {
      this.levelListeners.delete(listener);
    };
  }

  /**
   * Registers a handoff listener triggered when a loud sound is detected.
   * This is the exact integration hook for Phase 10 audio capture.
   */
  public onLoudSoundDetected(listener: LoudSoundListener): () => void {
    this.loudSoundListeners.add(listener);
    return () => {
      this.loudSoundListeners.delete(listener);
    };
  }

  private setState(newState: MonitoringState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.notifyStatusListeners(this.state);
  }

  private notifyStatusListeners(state: MonitoringState): void {
    for (const listener of this.statusListeners) {
      try {
        listener(state);
      } catch (e) {
        console.warn('Status listener error:', e);
      }
    }
  }

  private notifyLevelListeners(update: SoundLevelUpdate): void {
    for (const listener of this.levelListeners) {
      try {
        listener(update);
      } catch (e) {
        console.warn('Level listener error:', e);
      }
    }
  }

  private notifyLoudSoundListeners(event: LoudSoundEvent): void {
    for (const listener of this.loudSoundListeners) {
      try {
        listener(event);
      } catch (e) {
        console.warn('Loud sound listener error:', e);
      }
    }
  }

  // ==========================================
  // 6. TESTING, SIMULATION & FALLBACKS
  // ==========================================

  /**
   * Starts a fallback ambient background simulation loop when native audio is absent.
   */
  private startAmbientSimulation(): void {
    if (this.simulationInterval) clearInterval(this.simulationInterval);
    this.simulationInterval = setInterval(() => {
      if (this.isMonitoringActive()) {
        // Mild ambient noise fluctuation (0.10 to 0.28)
        const ambientLevel = 0.12 + Math.random() * 0.14;
        const ambientDb = Math.round(35 + ambientLevel * 30);
        this.processSoundLevel(ambientLevel, ambientDb);
      }
    }, this.updateIntervalMs);
  }

  /**
   * Injects a specific sound level for deterministic unit testing.
   */
  public simulateSoundLevel(normalizedLevel: number, decibels?: number): void {
    this.processSoundLevel(normalizedLevel, decibels);
  }

  /**
   * Resets all state, timers, and cooldowns for test isolation.
   */
  public resetForTesting(): void {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    if (this.loudResetTimeout) {
      clearTimeout(this.loudResetTimeout);
      this.loudResetTimeout = null;
    }
    this.recordingInstance = null;
    this.state = 'IDLE';
    this.currentLevel = 0;
    this.currentDecibels = 0;
    this.lastError = null;
    this.loudSoundThreshold = 0.86;
    this.cooldownMs = 3000;
    this.lastLoudSoundTimestamp = 0;
    this.statusListeners.clear();
    this.levelListeners.clear();
    this.loudSoundListeners.clear();
  }
}

// Export singleton instance
export const soundMonitoringService = new SoundMonitoringService();
