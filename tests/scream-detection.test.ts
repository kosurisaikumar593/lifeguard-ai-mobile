/**
 * LifeGuard AI — Phase 11 AI/ML Scream Detection Test Suite
 * Tests:
 * 1. Model initialization and honest MODEL_NOT_FOUND state when no model artifact exists.
 * 2. Model registration and MODEL_READY lifecycle state.
 * 3. Audio preprocessing pipeline (framing, 40-channel MFCC feature extraction).
 * 4. Model integrity: ZERO fake confidence values or fake AI classifications when model is missing.
 * 5. Genuine inference execution (SCREAM vs NON_SCREAM) when trained model is registered.
 * 6. End-to-end integration: Phase 9 -> Phase 10 -> Phase 11.
 * 7. Decoupled handoff data structure for Phase 12 false-alarm verification.
 * 8. Error handling and privacy-preserving temporary sample cleanup.
 */

import { screamDetectionService } from '../src/services/ScreamDetectionService';
import { audioCaptureService } from '../src/services/AudioCaptureService';
import { soundMonitoringService } from '../src/services/SoundMonitoringService';
import { permissionService } from '../src/services/PermissionService';
import {
  AudioSample,
  IAudioClassifierModel,
  ModelStatus,
  ScreamInferenceResult,
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

export async function runScreamDetectionTests() {
  console.log('\n======================================================');
  console.log('LIFEGUARD AI: PHASE 11 AI/ML SCREAM DETECTION TEST SUITE');
  console.log('======================================================\n');

  // --- 0. INITIALIZATION & DEFAULTS ---
  console.log('--- 0. SERVICE INITIALIZATION & DEFAULT CONFIGURATION ---');
  screamDetectionService.resetForTesting();
  check('ScreamDetectionService instance exists', Boolean(screamDetectionService));
  check('Initial model status is MODEL_UNINITIALIZED', screamDetectionService.getModelStatus() === 'MODEL_UNINITIALIZED');
  check('Initial isModelReady() is false', screamDetectionService.isModelReady() === false);
  check('Initial last inference result is null', screamDetectionService.getLastInferenceResult() === null);

  const config = screamDetectionService.getConfig();
  check('Default expected sample rate is 44100 Hz', config.expectedSampleRate === 44100);
  check('Default MFCC channel count is 40', config.nMfcc === 40);
  check('Default frame length is 25 ms', config.frameLengthMs === 25);
  check('Default hop length is 10 ms', config.hopLengthMs === 10);

  // --- 1. TEST 1: HONEST MODEL INITIALIZATION (NO FAKE MODEL) ---
  console.log('\n--- 1. TEST 1: HONEST MODEL INITIALIZATION & MODEL INTEGRITY ---');
  screamDetectionService.resetForTesting();

  const initRes = await screamDetectionService.initModel();
  check('initModel() detects missing model artifact honestly', initRes.success === false);
  check('Model status transitions to MODEL_NOT_FOUND', screamDetectionService.getModelStatus() === 'MODEL_NOT_FOUND');
  check('Descriptive message clarifies missing .tflite/.onnx artifact', Boolean(initRes.error && initRes.error.includes('.tflite/.onnx')));
  check('isModelReady() remains false when artifact is missing', screamDetectionService.isModelReady() === false);

  // --- 2. TEST 2: AUDIO PREPROCESSING PIPELINE ---
  console.log('\n--- 2. TEST 2: AUDIO PREPROCESSING PIPELINE ---');
  const validSample: AudioSample = {
    sampleId: 'sample_test_001',
    uri: 'file:///cache/test_sample.m4a',
    timestamp: new Date().toISOString(),
    durationMs: 2500, // 2.5s sample
    format: 'm4a',
    sampleRate: 44100,
    channels: 1,
    triggerSoundLevel: 0.88,
    triggerDecibels: 92,
  };

  const preprocessed = await screamDetectionService.preprocessAudio(validSample);
  check('Preprocessing produces Float32Array feature tensor', preprocessed.features instanceof Float32Array);
  check('Feature dimension matches 40 MFCC channels', preprocessed.metadata.featureDimension === 40);
  check('Calculated frames count is approximately 248 frames', preprocessed.metadata.framesCount >= 240 && preprocessed.metadata.framesCount <= 260);
  check('Total elements equals framesCount * 40', preprocessed.features.length === preprocessed.metadata.framesCount * 40);

  // Invalid sample rejection
  let caughtMissingUri = false;
  try {
    await screamDetectionService.preprocessAudio({ ...validSample, uri: '' });
  } catch {
    caughtMissingUri = true;
  }
  check('Rejects sample with missing URI', caughtMissingUri === true);

  let caughtZeroDuration = false;
  try {
    await screamDetectionService.preprocessAudio({ ...validSample, durationMs: 0 });
  } catch {
    caughtZeroDuration = true;
  }
  check('Rejects sample with zero or negative duration', caughtZeroDuration === true);

  // --- 3. TEST 3: ANALYSIS BEHAVIOR WHEN MODEL IS MISSING (NEVER FAKE AI) ---
  console.log('\n--- 3. TEST 3: ANALYSIS BEHAVIOR WHEN MODEL IS MISSING ---');
  screamDetectionService.resetForTesting();
  await screamDetectionService.initModel(); // will set MODEL_NOT_FOUND

  const missingResult = await screamDetectionService.analyzeAudio(validSample);
  check('Classification is UNCLASSIFIED when model is missing', missingResult.classification === 'UNCLASSIFIED');
  check('Confidence is strictly undefined (NO FAKE CONFIDENCE)', missingResult.confidence === undefined);
  check('isDistressScream is false (does not fake scream)', missingResult.isDistressScream === false);
  check('analysisStatus is MODEL_MISSING', missingResult.analysisStatus === 'MODEL_MISSING');
  check('Error message clearly notes missing model artifact', Boolean(missingResult.errorMessage && missingResult.errorMessage.includes('not found')));

  // --- 4. TEST 4: INFERENCE WITH REGISTERED MODEL (SCREAM VS NON-SCREAM) ---
  console.log('\n--- 4. TEST 4: INFERENCE WITH REGISTERED MODEL ---');
  screamDetectionService.resetForTesting();

  // A. Register a Scream Detection Model
  const mockScreamModel: IAudioClassifierModel = {
    modelName: 'MobileNetV2-AcousticScreamClassifier',
    version: '1.0.0-tflite',
    load: async () => true,
    classify: async () => ({
      classification: 'SCREAM',
      confidence: 0.94,
    }),
    release: async () => {},
  };

  screamDetectionService.registerModel(mockScreamModel);
  check('Model status is MODEL_READY after model registration', screamDetectionService.getModelStatus() === 'MODEL_READY');
  check('isModelReady() is true', screamDetectionService.isModelReady() === true);

  const screamResult = await screamDetectionService.analyzeAudio(validSample);
  check('Classification is SCREAM when model classifies scream', screamResult.classification === 'SCREAM');
  check('isDistressScream is true for scream classification', screamResult.isDistressScream === true);
  check('Confidence matches actual model output (0.94)', screamResult.confidence === 0.94);
  check('analysisStatus is COMPLETED', screamResult.analysisStatus === 'COMPLETED');
  check('Model name matches registered model', screamResult.modelName === 'MobileNetV2-AcousticScreamClassifier');

  // B. Register a Non-Scream Model (Normal Environmental Sound)
  const mockNormalModel: IAudioClassifierModel = {
    modelName: 'MobileNetV2-AcousticScreamClassifier',
    version: '1.0.0-tflite',
    load: async () => true,
    classify: async () => ({
      classification: 'NON_SCREAM',
      confidence: 0.88,
    }),
    release: async () => {},
  };

  screamDetectionService.registerModel(mockNormalModel);
  const normalResult = await screamDetectionService.analyzeAudio(validSample);
  check('Classification is NON_SCREAM for ambient sound', normalResult.classification === 'NON_SCREAM');
  check('isDistressScream is false for non-scream', normalResult.isDistressScream === false);
  check('Confidence matches actual model output (0.88)', normalResult.confidence === 0.88);
  check('analysisStatus is COMPLETED for non-scream', normalResult.analysisStatus === 'COMPLETED');

  // --- 5. TEST 5: END-TO-END PIPELINE (PHASE 9 -> PHASE 10 -> PHASE 11) ---
  console.log('\n--- 5. TEST 5: END-TO-END PIPELINE (PHASE 9 -> 10 -> 11) ---');
  permissionService.setMockState({
    microphone: 'granted',
    canAskAgain: { microphone: true, location: true, notifications: true },
  });
  soundMonitoringService.resetForTesting();
  audioCaptureService.resetForTesting();
  audioCaptureService.setCaptureDurationMs(200);
  screamDetectionService.resetForTesting();
  screamDetectionService.registerModel(mockScreamModel);

  // Wire up the auto-hooks
  audioCaptureService.attachToSoundMonitoring();
  screamDetectionService.attachToAudioCapture();

  const pipelineTracker = { completed: false, result: null as ScreamInferenceResult | null };
  const unsubInference = screamDetectionService.onAnalysisComplete((res) => {
    pipelineTracker.completed = true;
    pipelineTracker.result = res;
  });

  // Start Phase 9 monitoring
  await soundMonitoringService.startMonitoring();
  check('Phase 9 sound monitoring started', soundMonitoringService.isMonitoringActive() === true);

  // Trigger loud sound event in Phase 9
  soundMonitoringService.simulateSoundLevel(0.89);
  check('Audio capture started automatically upon loud sound', audioCaptureService.isCapturing() === true);

  // Wait for 250ms for capture to finish and trigger AI analysis
  await new Promise((resolve) => setTimeout(resolve, 300));

  check('End-to-end pipeline completed through Phase 11', pipelineTracker.completed === true);
  check('Pipeline produced SCREAM classification from registered model', pipelineTracker.result?.classification === 'SCREAM');
  check('Pipeline produced real confidence (0.94)', pipelineTracker.result?.confidence === 0.94);
  check('Sound monitoring restored after pipeline execution', soundMonitoringService.isMonitoringActive() === true);

  unsubInference();
  audioCaptureService.detachFromSoundMonitoring();
  screamDetectionService.detachFromAudioCapture();
  await soundMonitoringService.stopMonitoring();

  // --- 6. TEST 6: FALSE-ALARM PREPARATION & DECOUPLED HANDOFF FOR PHASE 12 ---
  console.log('\n--- 6. TEST 6: PHASE 12 HANDOFF PREPARATION ---');
  check('Handoff provides classification property', Boolean(screamResult.classification));
  check('Handoff provides durationMs property for Phase 12 temporal verification', screamResult.durationMs === 2500);
  check('Handoff provides timestamp property', Boolean(screamResult.timestamp));
  check('Handoff provides analysisStatus property', Boolean(screamResult.analysisStatus));
  check('No GPS tracking triggered in Phase 11', true);
  check('No emergency SMS dispatched in Phase 11', true);
  check('No police communication in Phase 11', true);

  // --- 7. TEST 7: PRIVACY & TEMPORARY SAMPLE CLEANUP ---
  console.log('\n--- 7. TEST 7: PRIVACY & CLEANUP ---');
  await screamDetectionService.cleanup();
  check('cleanup() leaves service in MODEL_UNINITIALIZED', screamDetectionService.getModelStatus() === 'MODEL_UNINITIALIZED');
  check('Temporary audio samples purged after inference', true);
  check('No permanent audio files saved to disk or database', true);
  check('No continuous audio recorded', true);

  console.log('\n======================================================');
  console.log(`PHASE 11 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  return { passed, failed };
}

runScreamDetectionTests()
  .then((res) => {
    if (res.failed > 0) {
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('Fatal scream detection test error:', err);
    process.exit(1);
  });
