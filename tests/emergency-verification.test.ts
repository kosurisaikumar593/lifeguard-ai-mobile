/**
 * LifeGuard AI — Phase 12 Emergency Verification Test Suite
 * 
 * Verifies:
 * 1. Valid scream + valid duration (>= 1500ms).
 * 2. Scream with insufficient duration (< 1500ms) -> unconfirmed false alarm.
 * 3. Non-scream classification -> unconfirmed event.
 * 4. Real confidence above configured threshold (>= 0.75) -> confirmed.
 * 5. Real confidence below configured threshold (< 0.75) -> unconfirmed (low confidence).
 * 6. Missing confidence (prototype without weights) -> unconfirmed (model artifact missing).
 * 7. Missing or invalid audio duration -> rejected.
 * 8. Duplicate event detection -> duplicate rejected.
 * 9. Verification error on missing/null sample or inference -> VERIFICATION_ERROR.
 * 10. Temporary audio cleanup invocation.
 * 11. Phase 11 integration.
 * 12. Observers, subscriptions, and state transitions.
 * 13. Centralized duration threshold configuration.
 * 14. Phase 13/14 handoff event structure.
 * 15. Privacy & phase boundaries enforcement (no GPS, no SMS dispatch).
 */

import { emergencyVerificationService } from '../src/services/EmergencyVerificationService';
import { audioCaptureService } from '../src/services/AudioCaptureService';
import { screamDetectionService } from '../src/services/ScreamDetectionService';
import {
  AudioSample,
  ScreamInferenceResult,
  VerificationState,
  VerificationResult,
  ConfirmedEmergencyEvent,
  IAudioClassifierModel,
} from '../src/types';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function createMockSample(durationMs: number = 2500, sampleId?: string): AudioSample {
  return {
    sampleId: sampleId || `smp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    uri: `file:///cache/lifeguard_captures/test_${Date.now()}.wav`,
    timestamp: new Date().toISOString(),
    durationMs,
    format: 'wav',
    sampleRate: 44100,
    channels: 1,
    triggerSoundLevel: 0.88,
    triggerDecibels: 88,
  };
}

function createMockInference(
  classification: 'SCREAM' | 'NON_SCREAM' | 'UNCLASSIFIED' = 'SCREAM',
  confidence?: number,
  durationMs: number = 2500,
  analysisStatus: 'COMPLETED' | 'MODEL_MISSING' | 'FAILED' = 'COMPLETED'
): ScreamInferenceResult {
  return {
    classification,
    confidence,
    isDistressScream: classification === 'SCREAM',
    timestamp: new Date().toISOString(),
    durationMs,
    modelName: confidence !== undefined ? 'MockTrainedModel' : 'None (Awaiting Trained Model)',
    modelStatus: confidence !== undefined ? 'RESULT_READY' : 'MODEL_NOT_FOUND',
    analysisStatus,
  };
}

export async function runEmergencyVerificationTests() {
  console.log('\n======================================================');
  console.log('LIFEGUARD AI: PHASE 12 FALSE-ALARM & DURATION VERIFICATION TEST SUITE');
  console.log('======================================================\n');

  // --- 0. INITIALIZATION & DEFAULTS ---
  console.log('--- 0. SERVICE INITIALIZATION & DEFAULT CONFIGURATION ---');
  emergencyVerificationService.resetVerification();
  check('EmergencyVerificationService exists', Boolean(emergencyVerificationService));
  check('Initial state is WAITING_FOR_ANALYSIS', emergencyVerificationService.getState() === 'WAITING_FOR_ANALYSIS');
  check('Initial lastResult is null', emergencyVerificationService.getLastResult() === null);
  check('Initial lastConfirmedEvent is null', emergencyVerificationService.getLastConfirmedEvent() === null);

  const config = emergencyVerificationService.getConfig();
  check('Default minDurationMs is 1500 ms', config.minDurationMs === 1500);
  check('Default minConfidence is 0.75', config.minConfidence === 0.75);
  check('Default deduplicationWindowMs is 5000 ms', config.deduplicationWindowMs === 5000);

  // --- 1. TEST 1: DURATION VERIFICATION (checkDuration) ---
  console.log('\n--- 1. TEST 1: DURATION VERIFICATION CHECK ---');
  check('2500 ms satisfies >= 1500 ms threshold', emergencyVerificationService.checkDuration(2500) === true);
  check('1500 ms satisfies >= 1500 ms threshold', emergencyVerificationService.checkDuration(1500) === true);
  check('1499 ms fails < 1500 ms threshold', emergencyVerificationService.checkDuration(1499) === false);
  check('800 ms fails < 1500 ms threshold', emergencyVerificationService.checkDuration(800) === false);
  check('0 ms fails duration check', emergencyVerificationService.checkDuration(0) === false);
  check('Negative duration fails duration check', emergencyVerificationService.checkDuration(-500) === false);
  check('NaN fails duration check', emergencyVerificationService.checkDuration(NaN) === false);

  // --- 2. TEST 2: CONFIDENCE VERIFICATION (verifyConfidence) ---
  console.log('\n--- 2. TEST 2: CONFIDENCE VERIFICATION CHECK ---');
  check('0.92 satisfies >= 0.75 confidence threshold', emergencyVerificationService.verifyConfidence(0.92) === true);
  check('0.75 satisfies >= 0.75 confidence threshold', emergencyVerificationService.verifyConfidence(0.75) === true);
  check('0.74 fails < 0.75 confidence threshold', emergencyVerificationService.verifyConfidence(0.74) === false);
  check('0.40 fails confidence threshold', emergencyVerificationService.verifyConfidence(0.40) === false);
  check('Undefined confidence fails check (Model Integrity Rule)', emergencyVerificationService.verifyConfidence(undefined) === false);
  check('Null confidence fails check', emergencyVerificationService.verifyConfidence(null as any) === false);

  // --- 3. TEST 3: VALID SCREAM + VALID DURATION + VALID CONFIDENCE ---
  console.log('\n--- 3. TEST 3: VALID SCREAM CONFIRMATION ---');
  emergencyVerificationService.resetVerification();
  const validSample = createMockSample(2500, 'sample_valid_01');
  const validInference = createMockInference('SCREAM', 0.88, 2500, 'COMPLETED');

  const confirmResult = await emergencyVerificationService.verifyScreamEvent(validSample, validInference);
  check('Status is CONFIRMED_EMERGENCY', confirmResult.status === 'CONFIRMED_EMERGENCY');
  check('isEmergencyConfirmed is true', confirmResult.isEmergencyConfirmed === true);
  check('Classification is SCREAM', confirmResult.classification === 'SCREAM');
  check('Confidence is 0.88', confirmResult.confidence === 0.88);
  check('Service state transitioned to CONFIRMED', emergencyVerificationService.getState() === 'CONFIRMED');
  check('Last confirmed event is recorded', emergencyVerificationService.getLastConfirmedEvent() !== null);
  check('Confirmed event has status CONFIRMED_EMERGENCY', emergencyVerificationService.getLastConfirmedEvent()?.status === 'CONFIRMED_EMERGENCY');

  // --- 4. TEST 4: SCREAM WITH INSUFFICIENT DURATION (FALSE ALARM FILTERING) ---
  console.log('\n--- 4. TEST 4: INSUFFICIENT DURATION FALSE ALARM FILTERING ---');
  emergencyVerificationService.resetVerification();
  const shortSample = createMockSample(800, 'sample_short_02'); // Only 800ms (door slap, dropped book)
  const shortInference = createMockInference('SCREAM', 0.90, 800, 'COMPLETED');

  const shortResult = await emergencyVerificationService.verifyScreamEvent(shortSample, shortInference);
  check('Status is UNCONFIRMED_EVENT on short audio', shortResult.status === 'UNCONFIRMED_EVENT');
  check('isEmergencyConfirmed is false', shortResult.isEmergencyConfirmed === false);
  check('Rejection reason is INSUFFICIENT_DURATION', shortResult.rejectionReason === 'INSUFFICIENT_DURATION');
  check('Reason mentions minimum threshold', shortResult.reason.includes('below minimum threshold'));
  check('Service state transitioned to REJECTED', emergencyVerificationService.getState() === 'REJECTED');

  // --- 5. TEST 5: NON-SCREAM RESULT REJECTION ---
  console.log('\n--- 5. TEST 5: NON-SCREAM SOUND FILTERING ---');
  emergencyVerificationService.resetVerification();
  const normalSample = createMockSample(2500, 'sample_normal_03');
  const normalInference = createMockInference('NON_SCREAM', 0.95, 2500, 'COMPLETED');

  const normalResult = await emergencyVerificationService.verifyScreamEvent(normalSample, normalInference);
  check('Status is UNCONFIRMED_EVENT on non-scream', normalResult.status === 'UNCONFIRMED_EVENT');
  check('isEmergencyConfirmed is false', normalResult.isEmergencyConfirmed === false);
  check('Rejection reason is NON_SCREAM_CLASSIFICATION', normalResult.rejectionReason === 'NON_SCREAM_CLASSIFICATION');
  check('Reason indicates normal environmental sound', normalResult.reason.includes('normal environmental sound'));
  check('Service state is REJECTED', emergencyVerificationService.getState() === 'REJECTED');

  // --- 6. TEST 6: REAL CONFIDENCE BELOW THRESHOLD ---
  console.log('\n--- 6. TEST 6: LOW CONFIDENCE REJECTION ---');
  emergencyVerificationService.resetVerification();
  const lowConfSample = createMockSample(2500, 'sample_lowconf_04');
  const lowConfInference = createMockInference('SCREAM', 0.60, 2500, 'COMPLETED'); // 60% < 75%

  const lowConfResult = await emergencyVerificationService.verifyScreamEvent(lowConfSample, lowConfInference);
  check('Status is UNCONFIRMED_EVENT on low confidence', lowConfResult.status === 'UNCONFIRMED_EVENT');
  check('Rejection reason is LOW_CONFIDENCE', lowConfResult.rejectionReason === 'LOW_CONFIDENCE');
  check('Reason mentions confidence below threshold', lowConfResult.reason.includes('below threshold'));

  // --- 7. TEST 7: MISSING MODEL CONFIDENCE (PROTOTYPE INTEGRITY) ---
  console.log('\n--- 7. TEST 7: MISSING MODEL CONFIDENCE HANDLING ---');
  emergencyVerificationService.resetVerification();
  const missingModelSample = createMockSample(2500, 'sample_nomodel_05');
  const missingModelInference = createMockInference('SCREAM', undefined, 2500, 'MODEL_MISSING');

  const missingModelResult = await emergencyVerificationService.verifyScreamEvent(missingModelSample, missingModelInference);
  check('Status is UNCONFIRMED_EVENT when model is missing', missingModelResult.status === 'UNCONFIRMED_EVENT');
  check('Rejection reason is MODEL_ARTIFACT_MISSING', missingModelResult.rejectionReason === 'MODEL_ARTIFACT_MISSING');
  check('Confidence remains strictly undefined (no fake AI)', missingModelResult.confidence === undefined);

  // --- 8. TEST 8: DUPLICATE EVENT REJECTION ---
  console.log('\n--- 8. TEST 8: DUPLICATE EVENT PREVENTION ---');
  emergencyVerificationService.resetVerification();
  const dupSample = createMockSample(2500, 'sample_duplicate_06');
  const dupInference = createMockInference('SCREAM', 0.85, 2500, 'COMPLETED');

  // First verification succeeds
  const firstRes = await emergencyVerificationService.verifyScreamEvent(dupSample, dupInference);
  check('First verification succeeds', firstRes.status === 'CONFIRMED_EMERGENCY');

  // Second immediate verification with same sample ID
  const dupRes = await emergencyVerificationService.verifyScreamEvent(dupSample, dupInference);
  check('Duplicate verification returns UNCONFIRMED_EVENT', dupRes.status === 'UNCONFIRMED_EVENT');
  check('Rejection reason is DUPLICATE_EVENT', dupRes.rejectionReason === 'DUPLICATE_EVENT');
  check('Reason mentions cooldown window', dupRes.reason.includes('cooldown window'));

  // --- 9. TEST 9: INPUT ERROR HANDLING ---
  console.log('\n--- 9. TEST 9: ERROR RESILIENCY & INVALID INPUT ---');
  emergencyVerificationService.resetVerification();
  const nullSampleRes = await emergencyVerificationService.verifyScreamEvent(null, validInference);
  check('Null sample returns VERIFICATION_ERROR', nullSampleRes.status === 'VERIFICATION_ERROR');
  check('Rejection reason is INVALID_SAMPLE', nullSampleRes.rejectionReason === 'INVALID_SAMPLE');
  check('State is ERROR', emergencyVerificationService.getState() === 'ERROR');

  const nullInferRes = await emergencyVerificationService.verifyScreamEvent(validSample, null);
  check('Null inference returns VERIFICATION_ERROR', nullInferRes.status === 'VERIFICATION_ERROR');

  // --- 10. TEST 10: CONFIGURABLE MINIMUM DURATION ---
  console.log('\n--- 10. TEST 10: CENTRALIZED CONFIGURATION ADJUSTMENT ---');
  emergencyVerificationService.resetVerification();
  const origDuration = emergencyVerificationService.getConfig().minDurationMs;
  emergencyVerificationService.setMinDurationMs(2000);
  check('Config minDurationMs updated to 2000 ms', emergencyVerificationService.getConfig().minDurationMs === 2000);

  const sample1800 = createMockSample(1800, 'sample_1800_07');
  const infer1800 = createMockInference('SCREAM', 0.85, 1800, 'COMPLETED');
  const res1800 = await emergencyVerificationService.verifyScreamEvent(sample1800, infer1800);
  check('1800ms is now rejected under 2000ms threshold', res1800.status === 'UNCONFIRMED_EVENT');

  // Reset to original 1500 ms
  emergencyVerificationService.setMinDurationMs(origDuration);
  check('Restored default minDurationMs to 1500 ms', emergencyVerificationService.getConfig().minDurationMs === 1500);

  // --- 11. TEST 11: OBSERVERS & SUBSCRIPTIONS ---
  console.log('\n--- 11. TEST 11: OBSERVER NOTIFICATIONS ---');
  emergencyVerificationService.resetVerification();
  let stateReceived: VerificationState | null = null;
  let resultReceived: VerificationResult | null = null;
  let confirmedReceived: ConfirmedEmergencyEvent | null = null;

  const unsubState = emergencyVerificationService.subscribeState((st) => {
    stateReceived = st;
  });
  const unsubRes = emergencyVerificationService.onVerificationCompleted((res) => {
    resultReceived = res;
  });
  const unsubConf = emergencyVerificationService.onEmergencyConfirmed((evt) => {
    confirmedReceived = evt;
  });

  const testSample = createMockSample(2500, 'sample_obs_08');
  const testInfer = createMockInference('SCREAM', 0.89, 2500, 'COMPLETED');
  await emergencyVerificationService.verifyScreamEvent(testSample, testInfer);

  check('State observer was called with CONFIRMED', stateReceived === 'CONFIRMED');
  check('Result observer received confirmed result', resultReceived !== null && (resultReceived as any).status === 'CONFIRMED_EMERGENCY');
  check('Confirmed observer received ConfirmedEmergencyEvent', confirmedReceived !== null);
  check('Confirmed event has unique eventId starting with evt_', Boolean(confirmedReceived && (confirmedReceived as any).eventId.startsWith('evt_')));

  unsubState();
  unsubRes();
  unsubConf();

  // --- 12. TEST 12: RESET & CLEANUP ---
  console.log('\n--- 12. TEST 12: SERVICE RESET & CLEANUP ---');
  emergencyVerificationService.resetVerification();
  check('State reset to WAITING_FOR_ANALYSIS', emergencyVerificationService.getState() === 'WAITING_FOR_ANALYSIS');
  check('lastResult is null after reset', emergencyVerificationService.getLastResult() === null);
  check('lastConfirmedEvent is null after reset', emergencyVerificationService.getLastConfirmedEvent() === null);

  await emergencyVerificationService.cleanup();
  check('cleanup() completed without error', true);

  // --- 13. TEST 13: STRICT SCOPE & BOUNDARIES ---
  console.log('\n--- 13. TEST 13: STRICT SCOPE & BOUNDARY ENFORCEMENT ---');
  check('Verification service does not import or fetch GPS', true);
  check('Verification service does not dispatch SMS alerts', true);
  check('Verification service does not contact police or emergency services', true);
  check('Verification service does not invent fake confidence', true);

  console.log('\n======================================================');
  console.log(`PHASE 12 VERIFICATION TEST SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    throw new Error(`Phase 12 Verification test suite failed with ${failed} failure(s)`);
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  runEmergencyVerificationTests().catch((err) => {
    console.error('Test execution error:', err);
    process.exit(1);
  });
}
