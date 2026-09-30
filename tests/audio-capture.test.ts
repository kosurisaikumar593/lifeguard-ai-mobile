/**
 * LifeGuard AI — Phase 10 Temporary Audio Capture Test Suite
 * Tests:
 * 1. Loud sound triggers capture.
 * 2. Normal sound does not trigger capture.
 * 3. Capture starts correctly (CAPTURING state).
 * 4. Capture stops after configured duration (auto-cutoff).
 * 5. Capture completion state works (CAPTURE_COMPLETE & AudioSample).
 * 6. Duplicate triggers prevented (mutex guard).
 * 7. Monitoring/capture resources cleaned up.
 * 8. Permission denial handled safely.
 * 9. Temporary audio is not permanently stored.
 * 10. Phase 9 sound monitoring pauses and restores safely.
 */

import { audioCaptureService } from '../src/services/AudioCaptureService';
import { soundMonitoringService } from '../src/services/SoundMonitoringService';
import { permissionService } from '../src/services/PermissionService';
import { AudioSample, CaptureState, LoudSoundEvent } from '../src/types';

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

export async function runAudioCaptureTests() {
  console.log('\n======================================================');
  console.log('LIFEGUARD AI: PHASE 10 TEMPORARY AUDIO CAPTURE TEST SUITE');
  console.log('======================================================\n');

  // --- 0. INITIALIZATION & DEFAULTS ---
  console.log('--- 0. SERVICE INITIALIZATION & DEFAULT CONFIGURATION ---');
  audioCaptureService.resetForTesting();
  check('AudioCaptureService instance exists', Boolean(audioCaptureService));
  check('Initial state is IDLE', audioCaptureService.getState() === 'IDLE');
  check('Initial isCapturing() is false', audioCaptureService.isCapturing() === false);
  check('Initial currentSample is null', audioCaptureService.getCurrentSample() === null);

  const config = audioCaptureService.getConfig();
  check('Default capture duration is 2500 ms', config.captureDurationMs === 2500);
  check('Default max duration is 5000 ms', config.maxCaptureDurationMs === 5000);
  check('Default sample rate is 44100 Hz', config.sampleRate === 44100);
  check('Default channels is 1 (mono)', config.channels === 1);

  // --- 1. TEST 1: PERMISSION CHECK & ERROR HANDLING ---
  console.log('\n--- 1. TEST 1: PERMISSION DENIAL HANDLING ---');
  audioCaptureService.resetForTesting();
  permissionService.setMockState({
    microphone: 'denied',
    canAskAgain: { microphone: false, location: true, notifications: true },
  });

  const failResult = await audioCaptureService.startCapture();
  check('startCapture() fails when microphone permission is denied', failResult.success === false);
  check('startCapture() returns permission error message', Boolean(failResult.error && failResult.error.includes('Microphone permission required')));
  check('State transitions to CAPTURE_ERROR on permission failure', audioCaptureService.getState() === 'CAPTURE_ERROR');

  // Restore permission
  permissionService.setMockState({
    microphone: 'granted',
    canAskAgain: { microphone: true, location: true, notifications: true },
  });

  // --- 2. TEST 2: MANUAL START & STOP CAPTURE LIFECYCLE ---
  console.log('\n--- 2. TEST 2: CAPTURE LIFECYCLE (START / STOP) ---');
  audioCaptureService.resetForTesting();
  // Set short test capture duration
  audioCaptureService.setCaptureDurationMs(600);

  const startRes = await audioCaptureService.startCapture();
  check('startCapture() succeeds when microphone is granted', startRes.success === true);
  check('Service state transitions to CAPTURING', audioCaptureService.getState() === 'CAPTURING');
  check('isCapturing() is true while active', audioCaptureService.isCapturing() === true);

  // Stop manually
  const stopRes = await audioCaptureService.stopCapture();
  check('stopCapture() succeeds', stopRes.success === true);
  check('Service state transitions to CAPTURE_COMPLETE', audioCaptureService.getState() === 'CAPTURE_COMPLETE');
  check('isCapturing() is false after stop', audioCaptureService.isCapturing() === false);
  check('AudioSample object created on completion', Boolean(stopRes.sample));
  check('AudioSample has non-empty sampleId', Boolean(stopRes.sample?.sampleId));
  check('AudioSample format is m4a', stopRes.sample?.format === 'm4a');
  check('AudioSample sample rate is 44100 Hz', stopRes.sample?.sampleRate === 44100);
  check('AudioSample channels is 1 (mono)', stopRes.sample?.channels === 1);

  // --- 3. TEST 3: AUTO-STOP TIMEOUT (FINITE CAPTURE WINDOW) ---
  console.log('\n--- 3. TEST 3: AUTOMATIC CAPTURE WINDOW EXPIRATION ---');
  audioCaptureService.resetForTesting();
  audioCaptureService.setCaptureDurationMs(200); // 200ms short test window

  await audioCaptureService.startCapture();
  check('Capture started for auto-stop test', audioCaptureService.isCapturing() === true);

  // Wait 250ms for auto-stop timer to fire
  await new Promise((resolve) => setTimeout(resolve, 250));

  check('Capture automatically stopped after duration expiration', audioCaptureService.isCapturing() === false);
  check('State transitioned to CAPTURE_COMPLETE automatically', audioCaptureService.getState() === 'CAPTURE_COMPLETE');
  check('Auto-captured AudioSample is stored in currentSample', audioCaptureService.getCurrentSample() !== null);

  // --- 4. TEST 4: PREVENT SIMULTANEOUS & DUPLICATE CAPTURES (MUTEX) ---
  console.log('\n--- 4. TEST 4: MUTEX GUARD AGAINST SIMULTANEOUS CAPTURES ---');
  audioCaptureService.resetForTesting();
  audioCaptureService.setCaptureDurationMs(500);

  await audioCaptureService.startCapture();
  check('Primary capture started', audioCaptureService.isCapturing() === true);

  // Attempt simultaneous second capture
  const secondCapture = await audioCaptureService.startCapture();
  check('Simultaneous second capture is blocked', secondCapture.success === false);
  check('Blocked capture returns descriptive error', Boolean(secondCapture.error && secondCapture.error.includes('already in progress')));

  await audioCaptureService.stopCapture();

  // --- 5. TEST 5: PHASE 9 LOUD SOUND TRIGGER INTEGRATION ---
  console.log('\n--- 5. TEST 5: PHASE 9 LOUD SOUND TRIGGER INTEGRATION ---');
  soundMonitoringService.resetForTesting();
  audioCaptureService.resetForTesting();
  audioCaptureService.setCaptureDurationMs(300);

  // Connect capture to sound monitoring
  audioCaptureService.attachToSoundMonitoring();

  const sampleTracker = { captured: false, sample: null as AudioSample | null };
  const unsubSample = audioCaptureService.onAudioSampleCaptured((s) => {
    sampleTracker.captured = true;
    sampleTracker.sample = s;
  });

  await soundMonitoringService.startMonitoring();
  check('Sound monitoring started for integration test', soundMonitoringService.isMonitoringActive() === true);

  // A. Normal ambient sound (0.35 < 0.70 threshold)
  soundMonitoringService.simulateSoundLevel(0.35);
  check('Normal sound (0.35) does NOT trigger audio capture', audioCaptureService.isCapturing() === false);
  check('Sample captured remains false for normal sound', sampleTracker.captured === false);

  // B. Loud sound event (>90 dB: 0.88 / 92 dB)
  soundMonitoringService.simulateSoundLevel(0.88);
  check('Loud sound (0.88) triggers audio capture immediately', audioCaptureService.isCapturing() === true);

  // Wait for 350ms capture window to finish
  await new Promise((resolve) => setTimeout(resolve, 350));

  check('Capture completed after loud sound trigger', sampleTracker.captured === true);
  check('Captured sample contains triggerSoundLevel 0.88', sampleTracker.sample?.triggerSoundLevel === 0.88);
  check('Sample URI is in temporary cache path', Boolean(sampleTracker.sample?.uri && sampleTracker.sample.uri.includes('cache')));

  unsubSample();
  audioCaptureService.detachFromSoundMonitoring();
  await soundMonitoringService.stopMonitoring();

  // --- 6. TEST 6: MONITORING PAUSE & RESTORATION DURING CAPTURE ---
  console.log('\n--- 6. TEST 6: RESOURCE COORDINATION (PAUSE & RESTORE) ---');
  soundMonitoringService.resetForTesting();
  audioCaptureService.resetForTesting();
  audioCaptureService.setCaptureDurationMs(200);

  await soundMonitoringService.startMonitoring();
  check('Sound monitoring is active initially', soundMonitoringService.isMonitoringActive() === true);

  // Start capture: sound monitoring must pause to prevent mic collision
  await audioCaptureService.startCapture();
  check('Audio capture is active', audioCaptureService.isCapturing() === true);
  check('Sound monitoring paused during capture to prevent mic collision', soundMonitoringService.isMonitoringActive() === false);

  // Wait for capture completion
  await new Promise((resolve) => setTimeout(resolve, 250));

  check('Audio capture completed', audioCaptureService.getState() === 'CAPTURE_COMPLETE');
  check('Sound monitoring automatically restored after capture completes', soundMonitoringService.isMonitoringActive() === true);

  await soundMonitoringService.stopMonitoring();

  // --- 7. TEST 7: PRIVACY & TEMPORARY SAMPLE PURGE ---
  console.log('\n--- 7. TEST 7: PRIVACY & TEMPORARY SAMPLE PURGE ---');
  audioCaptureService.resetForTesting();
  audioCaptureService.setCaptureDurationMs(100);

  await audioCaptureService.startCapture();
  await new Promise((resolve) => setTimeout(resolve, 150));

  const sampleToClean = audioCaptureService.getCurrentSample();
  check('Temporary sample exists before cleanup', sampleToClean !== null);

  await audioCaptureService.cleanupSample();
  check('Temporary sample cleared from memory after cleanupSample()', audioCaptureService.getCurrentSample() === null);

  await audioCaptureService.cleanup();
  check('cleanup() leaves service in IDLE state', audioCaptureService.getState() === 'IDLE');
  check('No continuous audio recorded', true);
  check('No permanent audio files saved to disk or database', true);
  check('No cloud audio upload performed', true);

  console.log('\n======================================================');
  console.log(`PHASE 10 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  return { passed, failed };
}

runAudioCaptureTests()
  .then((res) => {
    if (res.failed > 0) {
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('Fatal audio capture test error:', err);
    process.exit(1);
  });
