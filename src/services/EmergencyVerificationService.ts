/**
 * LifeGuard AI — Emergency Verification Service (Phase 12)
 * 
 * Provides:
 * 1. False-alarm and duration verification layer AFTER AI/ML classification and BEFORE emergency action.
 * 2. Centralized configurable minimum duration threshold (default: 1500 ms) preventing brief noises from triggering false alarms.
 * 3. Confidence verification adhering to Model Integrity rule: checks real model confidence if present; rejects without faking if absent.
 * 4. Verification state machine: WAITING_FOR_ANALYSIS -> VERIFYING -> CONFIRMED / REJECTED / ERROR.
 * 5. Outcomes: CONFIRMED_EMERGENCY vs UNCONFIRMED_EVENT vs VERIFICATION_ERROR.
 * 6. Deduplication mechanism preventing duplicate emergency confirmations for the same acoustic event.
 * 7. Decoupled Phase 13/14 handoff: emits standardized ConfirmedEmergencyEvent without initiating dispatch or SMS.
 * 8. Strict privacy enforcement: invokes cleanup on temporary audio samples once verification completes.
 */

import {
  AudioSample,
  AudioClassification,
  ScreamInferenceResult,
  VerificationState,
  VerificationOutcome,
  VerificationRejectionReason,
  VerificationConfig,
  VerificationResult,
  ConfirmedEmergencyEvent,
} from '../types';
import { audioCaptureService } from './AudioCaptureService';
import { screamDetectionService } from './ScreamDetectionService';

type StateListener = (state: VerificationState) => void;
type ResultListener = (result: VerificationResult) => void;
type ConfirmedListener = (event: ConfirmedEmergencyEvent) => void;

export class EmergencyVerificationService {
  private state: VerificationState = 'WAITING_FOR_ANALYSIS';
  private lastResult: VerificationResult | null = null;
  private lastConfirmedEvent: ConfirmedEmergencyEvent | null = null;
  private lastError: string | null = null;

  // Deduplication tracking
  private recentProcessedSamples: Map<string, number> = new Map();

  // Centralized Configuration
  private config: VerificationConfig = {
    minDurationMs: 1500,           // EPICS Requirement: minimum acoustic duration to filter transient false alarms
    minConfidence: 0.75,           // Minimum confidence threshold for trained model classifications
    requireModelConfidence: false, // In prototype, without trained model, does not crash on missing confidence
    deduplicationWindowMs: 5000,   // 5000 ms cooldown window preventing duplicate confirmations
  };

  // Observers
  private stateListeners: Set<StateListener> = new Set();
  private resultListeners: Set<ResultListener> = new Set();
  private confirmedListeners: Set<ConfirmedListener> = new Set();
  private autoInferenceSubscription: (() => void) | null = null;

  constructor(customConfig?: Partial<VerificationConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
  }

  // ==========================================
  // 1. GETTERS & CONFIGURATION
  // ==========================================

  public getState(): VerificationState {
    return this.state;
  }

  public getLastResult(): VerificationResult | null {
    return this.lastResult;
  }

  public getLastConfirmedEvent(): ConfirmedEmergencyEvent | null {
    return this.lastConfirmedEvent;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  public getConfig(): VerificationConfig {
    return { ...this.config };
  }

  public setMinDurationMs(durationMs: number): void {
    if (durationMs < 100 || durationMs > 10000) {
      throw new Error('Minimum duration threshold must be between 100 ms and 10,000 ms');
    }
    this.config.minDurationMs = durationMs;
  }

  public setMinConfidence(confidence: number): void {
    if (confidence < 0.0 || confidence > 1.0) {
      throw new Error('Minimum confidence threshold must be between 0.00 and 1.00');
    }
    this.config.minConfidence = confidence;
  }

  public setDeduplicationWindowMs(windowMs: number): void {
    if (windowMs < 0) {
      throw new Error('Deduplication window must be non-negative');
    }
    this.config.deduplicationWindowMs = windowMs;
  }

  // ==========================================
  // 2. DURATION & CONFIDENCE CHECKS
  // ==========================================

  /**
   * Evaluates if audio duration meets or exceeds the configured minimum duration.
   * Centralized duration verification reduces short transient false alarms (e.g. door slaps, dropped objects).
   */
  public checkDuration(durationMs: number): boolean {
    if (typeof durationMs !== 'number' || isNaN(durationMs) || durationMs <= 0) {
      return false;
    }
    return durationMs >= this.config.minDurationMs;
  }

  /**
   * Evaluates model confidence against the configured confidence threshold.
   * Adheres strictly to Model Integrity: returns false if confidence is undefined or invalid.
   */
  public verifyConfidence(confidence?: number): boolean {
    if (confidence === undefined || confidence === null || isNaN(confidence)) {
      return false;
    }
    return confidence >= this.config.minConfidence;
  }

  // ==========================================
  // 3. MAIN VERIFICATION LOGIC
  // ==========================================

  /**
   * Verifies an AI/ML classified scream event against duration and confidence rules.
   * 
   * Flow:
   * 1. Validate inputs (sample & inference).
   * 2. Check deduplication window.
   * 3. Check classification (must be SCREAM).
   * 4. Check duration (durationMs >= minDurationMs).
   * 5. Check confidence if model provided one (confidence >= minConfidence).
   * 6. Clean up temporary audio sample (zero permanent storage).
   * 7. Produce outcome: CONFIRMED_EMERGENCY vs UNCONFIRMED_EVENT.
   */
  public async verifyScreamEvent(
    sample?: AudioSample | null,
    inferenceResult?: ScreamInferenceResult | null
  ): Promise<VerificationResult> {
    this.setState('VERIFYING');

    const timestamp = new Date().toISOString();
    const verificationId = `vfy_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      // Step 1: Input Validation
      if (!sample || !inferenceResult) {
        return this.finishVerification({
          verificationId,
          status: 'VERIFICATION_ERROR',
          classification: 'UNCLASSIFIED',
          durationMs: sample?.durationMs ?? 0,
          isEmergencyConfirmed: false,
          reason: 'Verification error: Missing audio sample or inference result',
          rejectionReason: 'INVALID_SAMPLE',
          timestamp,
        });
      }

      // Step 2: Deduplication Check
      const dedupeKey = sample.sampleId || sample.uri;
      const now = Date.now();
      const lastProcessedTime = this.recentProcessedSamples.get(dedupeKey);
      if (lastProcessedTime && now - lastProcessedTime < this.config.deduplicationWindowMs) {
        return this.finishVerification({
          verificationId,
          status: 'UNCONFIRMED_EVENT',
          classification: inferenceResult.classification,
          confidence: inferenceResult.confidence,
          durationMs: sample.durationMs,
          isEmergencyConfirmed: false,
          reason: 'Duplicate event: Audio sample was already processed within the cooldown window',
          rejectionReason: 'DUPLICATE_EVENT',
          timestamp,
          triggerInfo: {
            sampleId: sample.sampleId,
            soundLevel: sample.triggerSoundLevel,
            decibels: sample.triggerDecibels,
          },
        });
      }

      // Mark sample as processed in deduplication registry
      this.recentProcessedSamples.set(dedupeKey, now);
      this.purgeExpiredDedupeKeys(now);

      // Step 3: Classification Verification
      if (inferenceResult.classification !== 'SCREAM') {
        const reasonText =
          inferenceResult.humanSoundStatus === 'ENVIRONMENTAL_SOUND' || inferenceResult.classification === 'ENVIRONMENTAL'
            ? 'Event not confirmed: Human sound not detected (Environmental sound filtered)'
            : inferenceResult.classification === 'NON_SCREAM'
            ? 'Event not confirmed: Audio classified as normal environmental sound / non-distress human voice'
            : 'Event not confirmed: Audio unclassified or AI model unavailable';

        return this.finishVerification({
          verificationId,
          status: 'UNCONFIRMED_EVENT',
          classification: inferenceResult.classification,
          confidence: inferenceResult.confidence,
          durationMs: sample.durationMs,
          isEmergencyConfirmed: false,
          reason: reasonText,
          rejectionReason: 'NON_SCREAM_CLASSIFICATION',
          timestamp,
          triggerInfo: {
            sampleId: sample.sampleId,
            soundLevel: sample.triggerSoundLevel,
            decibels: sample.triggerDecibels,
          },
        });
      }

      // Step 4: Duration Verification
      const hasSufficientDuration = this.checkDuration(sample.durationMs);
      if (!hasSufficientDuration) {
        return this.finishVerification({
          verificationId,
          status: 'UNCONFIRMED_EVENT',
          classification: 'SCREAM',
          confidence: inferenceResult.confidence,
          durationMs: sample.durationMs,
          isEmergencyConfirmed: false,
          reason: `Event not confirmed: Duration (${sample.durationMs}ms) is below minimum threshold (${this.config.minDurationMs}ms)`,
          rejectionReason: 'INSUFFICIENT_DURATION',
          timestamp,
          triggerInfo: {
            sampleId: sample.sampleId,
            soundLevel: sample.triggerSoundLevel,
            decibels: sample.triggerDecibels,
          },
        });
      }

      // Step 5: Confidence Verification
      if (inferenceResult.confidence !== undefined) {
        const hasSufficientConfidence = this.verifyConfidence(inferenceResult.confidence);
        if (!hasSufficientConfidence) {
          return this.finishVerification({
            verificationId,
            status: 'UNCONFIRMED_EVENT',
            classification: 'SCREAM',
            confidence: inferenceResult.confidence,
            durationMs: sample.durationMs,
            isEmergencyConfirmed: false,
            reason: `Event not confirmed: Model confidence (${(inferenceResult.confidence * 100).toFixed(1)}%) is below threshold (${(this.config.minConfidence * 100).toFixed(1)}%)`,
            rejectionReason: 'LOW_CONFIDENCE',
            timestamp,
            triggerInfo: {
              sampleId: sample.sampleId,
              soundLevel: sample.triggerSoundLevel,
              decibels: sample.triggerDecibels,
            },
          });
        }
      } else if (inferenceResult.analysisStatus === 'MODEL_MISSING' || inferenceResult.modelStatus === 'MODEL_NOT_FOUND') {
        // Truthful prototype handling: In accordance with the Model Integrity rule,
        // without an actual trained neural model artifact, we do not fake scream confirmations.
        return this.finishVerification({
          verificationId,
          status: 'UNCONFIRMED_EVENT',
          classification: 'SCREAM',
          confidence: undefined,
          durationMs: sample.durationMs,
          isEmergencyConfirmed: false,
          reason: 'Event not confirmed: Trained neural model artifact is required to verify distress screams',
          rejectionReason: 'MODEL_ARTIFACT_MISSING',
          timestamp,
          triggerInfo: {
            sampleId: sample.sampleId,
            soundLevel: sample.triggerSoundLevel,
            decibels: sample.triggerDecibels,
          },
        });
      }

      // Step 6: Confirmation Success!
      // Valid Scream + Sufficient Duration + Model Confirmed
      const confirmedResult: VerificationResult = {
        verificationId,
        status: 'CONFIRMED_EMERGENCY',
        classification: 'SCREAM',
        confidence: inferenceResult.confidence,
        durationMs: sample.durationMs,
        isEmergencyConfirmed: true,
        reason: 'Distress scream verified: Audio classification and duration criteria satisfied',
        timestamp,
        triggerInfo: {
          sampleId: sample.sampleId,
          soundLevel: sample.triggerSoundLevel,
          decibels: sample.triggerDecibels,
        },
      };

      const confirmedEvent: ConfirmedEmergencyEvent = {
        eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        status: 'CONFIRMED_EMERGENCY',
        classification: 'SCREAM',
        confidence: inferenceResult.confidence,
        durationMs: sample.durationMs,
        timestamp,
        triggerInfo: {
          sampleId: sample.sampleId,
          soundLevel: sample.triggerSoundLevel,
          decibels: sample.triggerDecibels,
          reason: 'SCREAM_VERIFIED',
        },
      };

      this.lastConfirmedEvent = confirmedEvent;
      this.finishVerification(confirmedResult);

      // Emit confirmed emergency event for downstream Phase 14 location/dispatch
      this.notifyConfirmedListeners(confirmedEvent);

      return confirmedResult;
    } catch (err: any) {
      this.lastError = err?.message || 'Verification execution failed';
      const errorResult: VerificationResult = {
        verificationId,
        status: 'VERIFICATION_ERROR',
        classification: 'UNCLASSIFIED',
        durationMs: sample?.durationMs ?? 0,
        isEmergencyConfirmed: false,
        reason: `Verification error: ${this.lastError}`,
        rejectionReason: 'INTERNAL_ERROR',
        timestamp,
      };
      return this.finishVerification(errorResult);
    } finally {
      // Privacy enforcement: Always clean up temporary audio sample once verification is done
      if (sample?.uri) {
        audioCaptureService.cleanupSample(sample.uri).catch(() => {});
      }
    }
  }

  private finishVerification(result: VerificationResult): VerificationResult {
    this.lastResult = result;
    if (result.status === 'CONFIRMED_EMERGENCY') {
      this.setState('CONFIRMED');
    } else if (result.status === 'UNCONFIRMED_EVENT') {
      this.setState('REJECTED');
    } else {
      this.setState('ERROR');
    }
    this.notifyResultListeners(result);
    return result;
  }

  private purgeExpiredDedupeKeys(now: number): void {
    for (const [key, timestamp] of this.recentProcessedSamples.entries()) {
      if (now - timestamp > this.config.deduplicationWindowMs) {
        this.recentProcessedSamples.delete(key);
      }
    }
  }

  // ==========================================
  // 4. LIFECYCLE & CLEANUP
  // ==========================================

  public resetVerification(): void {
    this.state = 'WAITING_FOR_ANALYSIS';
    this.lastResult = null;
    this.lastConfirmedEvent = null;
    this.lastError = null;
    this.notifyStateListeners(this.state);
  }

  /**
   * Automatically connects Emergency Verification to audio capture and AI scream detection.
   * When a temporary audio sample is captured, this passes it to
   * screamDetectionService.analyzeAudio(sample) and then verifyScreamEvent(sample, result).
   */
  public attachToAudioPipeline(): void {
    if (this.autoInferenceSubscription) return;

    this.autoInferenceSubscription = audioCaptureService.onAudioSampleCaptured(
      async (sample: AudioSample) => {
        try {
          const inferenceResult = await screamDetectionService.analyzeAudio(sample);
          await this.verifyScreamEvent(sample, inferenceResult);
        } catch (err) {
          console.warn('Auto verification pipeline error:', err);
        }
      }
    );
  }

  /**
   * Detaches Emergency Verification from the audio capture pipeline.
   */
  public detachFromAudioPipeline(): void {
    if (this.autoInferenceSubscription) {
      this.autoInferenceSubscription();
      this.autoInferenceSubscription = null;
    }
  }

  public isAttachedToAudioPipeline(): boolean {
    return this.autoInferenceSubscription !== null;
  }

  public async cleanup(): Promise<void> {
    this.resetVerification();
    this.detachFromAudioPipeline();
    this.recentProcessedSamples.clear();
    this.stateListeners.clear();
    this.resultListeners.clear();
    this.confirmedListeners.clear();
  }

  // ==========================================
  // 5. OBSERVERS & SUBSCRIPTIONS
  // ==========================================

  private setState(newState: VerificationState): void {
    this.state = newState;
    this.notifyStateListeners(newState);
  }

  private notifyStateListeners(state: VerificationState): void {
    this.stateListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.warn('EmergencyVerificationService state listener error:', err);
      }
    });
  }

  private notifyResultListeners(result: VerificationResult): void {
    this.resultListeners.forEach((listener) => {
      try {
        listener(result);
      } catch (err) {
        console.warn('EmergencyVerificationService result listener error:', err);
      }
    });
  }

  private notifyConfirmedListeners(event: ConfirmedEmergencyEvent): void {
    this.confirmedListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.warn('EmergencyVerificationService confirmed listener error:', err);
      }
    });
  }

  public subscribeState(callback: StateListener): () => void {
    this.stateListeners.add(callback);
    callback(this.state);
    return () => this.stateListeners.delete(callback);
  }

  public onVerificationCompleted(callback: ResultListener): () => void {
    this.resultListeners.add(callback);
    return () => this.resultListeners.delete(callback);
  }

  public onEmergencyConfirmed(callback: ConfirmedListener): () => void {
    this.confirmedListeners.add(callback);
    return () => this.confirmedListeners.delete(callback);
  }
}

export const emergencyVerificationService = new EmergencyVerificationService();
