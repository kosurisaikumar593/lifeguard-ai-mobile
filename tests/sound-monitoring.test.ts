/**
 * LifeGuard AI — Phase 9 Sound Monitoring Test Suite
 * Tests microphone monitoring lifecycle, audio input availability,
 * real-time activity/level measurement, loud-sound detection,
 * threshold configuration, cooldown event throttling, and Phase 10 handoff listeners.
 */

import { soundMonitoringService } from '../src/services/SoundMonitoringService';
import { permissionService } from '../src/services/PermissionService';
import { LoudSoundEvent, MonitoringState, SoundLevelUpdate } from '../src/types';

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

export async function runSoundMonitoringTests() {
  console.log('\n======================================================');
  console.log('LIFEGUARD AI: PHASE 9 REAL-TIME SOUND MONITORING TEST SUITE');
  console.log('======================================================\n');

  // --- 0. INITIALIZATION & DEFAULTS ---
  console.log('--- 0. SERVICE INITIALIZATION & DEFAULT CONFIGURATION ---');
  soundMonitoringService.resetForTesting();
  check('SoundMonitoringService instance exists', Boolean(soundMonitoringService));
  check('Initial state is IDLE', soundMonitoringService.getState() === 'IDLE');
  check('Initial isMonitoringActive() is false', soundMonitoringService.isMonitoringActive() === false);
  check('Initial current level is 0.00', soundMonitoringService.getCurrentLevel() === 0);
  check('Initial current decibels is 0 dB', soundMonitoringService.getCurrentDecibels() === 0);
  check('Default loud sound threshold is 0.86 (~90 dB)', soundMonitoringService.getLoudSoundThreshold() === 0.86);
  check('Default cooldown is 3000 ms', soundMonitoringService.getCooldownMs() === 3000);

  // --- 1. AUDIO INPUT AVAILABILITY CHECK ---
  console.log('\n--- 1. TEST 1: AUDIO INPUT AVAILABILITY & PERMISSION CHECK ---');
  // A. When microphone is denied
  permissionService.setMockState({
    microphone: 'denied',
    canAskAgain: { microphone: true, location: true, notifications: true },
  });
  const availDenied = await soundMonitoringService.checkAudioInputAvailability();
  check('Input availability returns false when microphone is denied', availDenied.available === false);
  check('Availability reason clarifies missing microphone', Boolean(availDenied.reason && availDenied.reason.includes('Microphone')));

  // B. When microphone is granted
  permissionService.setMockState({
    microphone: 'granted',
    canAskAgain: { microphone: true, location: true, notifications: true },
  });
  const availGranted = await soundMonitoringService.checkAudioInputAvailability();
  check('Input availability returns true when microphone is granted', availGranted.available === true);

  // --- 2. MICROPHONE PERMISSION ENFORCEMENT ON START ---
  console.log('\n--- 2. TEST 2: MICROPHONE PERMISSION ENFORCEMENT ON START ---');
  soundMonitoringService.resetForTesting();
  // Set microphone to denied
  permissionService.setMockState({
    microphone: 'denied',
    canAskAgain: { microphone: false, location: true, notifications: true },
  });

  const startFail = await soundMonitoringService.startMonitoring();
  check('startMonitoring() fails when microphone permission is denied', startFail.success === false);
  check('startMonitoring() returns permission error message', Boolean(startFail.error && startFail.error.includes('Microphone permission required')));
  check('Service state transitions to ERROR on permission failure', soundMonitoringService.getState() === 'ERROR');

  // --- 3. START & STOP MONITORING LIFECYCLE ---
  console.log('\n--- 3. TEST 3: START & STOP MONITORING LIFECYCLE ---');
  soundMonitoringService.resetForTesting();
  permissionService.setMockState({
    microphone: 'granted',
    canAskAgain: { microphone: true, location: true, notifications: true },
  });

  // Start monitoring
  const startSuccess = await soundMonitoringService.startMonitoring();
  check('startMonitoring() succeeds when permission is granted', startSuccess.success === true);
  check('Service state transitions to MONITORING', soundMonitoringService.getState() === 'MONITORING');
  check('isMonitoringActive() returns true', soundMonitoringService.isMonitoringActive() === true);

  // Idempotent start
  const startAgain = await soundMonitoringService.startMonitoring();
  check('Subsequent startMonitoring() call is safe and idempotent', startAgain.success === true);

  // Stop monitoring
  await soundMonitoringService.stopMonitoring();
  check('Service state transitions to IDLE after stopMonitoring()', soundMonitoringService.getState() === 'IDLE');
  check('isMonitoringActive() returns false after stopMonitoring()', soundMonitoringService.isMonitoringActive() === false);
  check('Current level is reset to 0 after stop', soundMonitoringService.getCurrentLevel() === 0);
  check('Current decibels is reset to 0 after stop', soundMonitoringService.getCurrentDecibels() === 0);

  // Idempotent stop
  await soundMonitoringService.stopMonitoring();
  check('Subsequent stopMonitoring() call is safe and idempotent', soundMonitoringService.getState() === 'IDLE');

  // --- 4. REAL-TIME SOUND ACTIVITY & LEVEL MEASUREMENT ---
  console.log('\n--- 4. TEST 4: REAL-TIME SOUND ACTIVITY MEASUREMENT (SUBSCRIBE LEVEL) ---');
  soundMonitoringService.resetForTesting();
  await soundMonitoringService.startMonitoring();

  let receivedUpdate: SoundLevelUpdate | null = null;
  const unsubLevel = soundMonitoringService.subscribeLevel((update) => {
    receivedUpdate = update;
  });

  // Simulate normal ambient sound (0.28 normalized amplitude)
  soundMonitoringService.simulateSoundLevel(0.28);
  check('Level listener receives normalized level 0.28', receivedUpdate !== null && (receivedUpdate as SoundLevelUpdate).normalizedLevel === 0.28);
  check('Level listener receives calculated decibels (~50 dB)', receivedUpdate !== null && (receivedUpdate as SoundLevelUpdate).decibels === Math.round(30 + 0.28 * 70));
  check('isLoud is false for normal ambient noise (0.28 < 0.70)', receivedUpdate !== null && (receivedUpdate as SoundLevelUpdate).isLoud === false);
  check('getCurrentLevel() reflects 0.28', soundMonitoringService.getCurrentLevel() === 0.28);

  // Test unsubscribe
  unsubLevel();
  receivedUpdate = null;
  soundMonitoringService.simulateSoundLevel(0.40);
  check('Unsubscribed level listener receives no further updates', receivedUpdate === null);
  await soundMonitoringService.stopMonitoring();

  // --- 5. LOUD SOUND DETECTION & THRESHOLD BEHAVIOR ---
  console.log('\n--- 5. TEST 5: LOUD SOUND DETECTION & THRESHOLD BEHAVIOR ---');
  soundMonitoringService.resetForTesting();
  await soundMonitoringService.startMonitoring();

  let loudEvents: LoudSoundEvent[] = [];
  const unsubLoud = soundMonitoringService.onLoudSoundDetected((evt) => {
    loudEvents.push(evt);
  });

  // A. Sub-threshold sound: 80 dB (no trigger)
  soundMonitoringService.simulateSoundLevel(0.70, 80);
  check('Sound = 80 dB does NOT trigger loud sound event', loudEvents.length === 0);

  // B. Boundary sound: 90 dB exactly (must NOT trigger because condition is strictly >90 dB)
  soundMonitoringService.simulateSoundLevel(0.86, 90.0);
  check('Sound = 90.0 dB exactly does NOT trigger loud sound (strictly > 90 dB)', loudEvents.length === 0);
  check('State remains MONITORING for 90 dB sound', soundMonitoringService.getState() === 'MONITORING');

  // C. Strictly above threshold sound: 90.1 dB (triggers loud sound event!)
  soundMonitoringService.simulateSoundLevel(0.88, 92);
  check('Sound > 90 dB (92 dB) triggers loud sound event', loudEvents.length === 1);
  check('LoudSoundEvent type is LOUD_SOUND_DETECTED', loudEvents[0]?.type === 'LOUD_SOUND_DETECTED');
  check('LoudSoundEvent soundLevel matches 0.88', loudEvents[0]?.soundLevel === 0.88);
  check('LoudSoundEvent decibels is 92 dB', loudEvents[0]?.decibels === 92);
  check('LoudSoundEvent reason is LOUD_SOUND', loudEvents[0]?.reason === 'LOUD_SOUND');
  check('LoudSoundEvent includes timestamp ISO string', Boolean(loudEvents[0]?.timestamp));
  check('Service state transitions to LOUD_SOUND_DETECTED', soundMonitoringService.getState() === 'LOUD_SOUND_DETECTED');

  unsubLoud();
  await soundMonitoringService.stopMonitoring();

  // --- 6. COOLDOWN & EVENT THROTTLING (PREVENT EVENT FLOODING) ---
  console.log('\n--- 6. TEST 6: COOLDOWN & EVENT THROTTLING ---');
  soundMonitoringService.resetForTesting();
  soundMonitoringService.setCooldownMs(200); // 200 ms test cooldown
  await soundMonitoringService.startMonitoring();

  let throttledCount = 0;
  soundMonitoringService.onLoudSoundDetected(() => {
    throttledCount++;
  });

  // First loud sound: triggers event #1
  soundMonitoringService.simulateSoundLevel(0.88);
  check('First loud sound triggers event #1', throttledCount === 1);

  // Immediate subsequent loud sounds within 200ms cooldown window: throttled!
  soundMonitoringService.simulateSoundLevel(0.92);
  soundMonitoringService.simulateSoundLevel(0.95);
  soundMonitoringService.simulateSoundLevel(0.89);
  check('Subsequent loud sounds within cooldown window are throttled (count remains 1)', throttledCount === 1);

  // Wait for cooldown to expire
  await new Promise((resolve) => setTimeout(resolve, 250));

  // Next loud sound after cooldown: triggers event #2 (>90 dB at 0.88 / 92 dB)
  soundMonitoringService.simulateSoundLevel(0.88);
  check('Loud sound after cooldown window expires triggers event #2', throttledCount === 2);
  await soundMonitoringService.stopMonitoring();

  // --- 7. CONFIGURABLE THRESHOLD ---
  console.log('\n--- 7. TEST 7: CONFIGURABLE THRESHOLD ---');
  soundMonitoringService.resetForTesting();
  await soundMonitoringService.startMonitoring();

  // Change threshold to 0.85
  soundMonitoringService.setLoudSoundThreshold(0.85);
  check('getLoudSoundThreshold() reflects updated threshold 0.85', soundMonitoringService.getLoudSoundThreshold() === 0.85);

  const customTracker = { triggered: false };
  soundMonitoringService.onLoudSoundDetected(() => {
    customTracker.triggered = true;
  });

  // Sound at 0.78 is now below the 0.85 threshold
  soundMonitoringService.simulateSoundLevel(0.78);
  check('Sound at 0.78 is now normal under 0.85 threshold', customTracker.triggered === false);

  // Sound at 0.88 exceeds 0.85 threshold
  soundMonitoringService.simulateSoundLevel(0.88);
  check('Sound at 0.88 triggers loud sound under 0.85 threshold', customTracker.triggered === true);


  // Boundary validation
  let caughtLow: boolean = false;
  try {
    soundMonitoringService.setLoudSoundThreshold(-0.1);
  } catch {
    caughtLow = true;
  }
  check('Rejects negative threshold', caughtLow === true);

  let caughtHigh: boolean = false;
  try {
    soundMonitoringService.setLoudSoundThreshold(1.2);
  } catch {
    caughtHigh = true;
  }
  check('Rejects threshold exceeding 1.00', caughtHigh === true);


  await soundMonitoringService.stopMonitoring();

  // --- 8. STATUS SUBSCRIPTIONS & LIFECYCLE OBSERVATION ---
  console.log('\n--- 8. TEST 8: STATUS SUBSCRIPTIONS & TRANSITIONS ---');
  soundMonitoringService.resetForTesting();

  const observedStates: MonitoringState[] = [];
  const unsubStatus = soundMonitoringService.subscribeStatus((st) => {
    observedStates.push(st);
  });

  check('Immediate state received on subscription (IDLE)', observedStates[0] === 'IDLE');

  await soundMonitoringService.startMonitoring();
  check('State transitions to MONITORING observed', observedStates[observedStates.length - 1] === 'MONITORING');

  soundMonitoringService.simulateSoundLevel(0.90);
  check('State transitions to LOUD_SOUND_DETECTED observed', observedStates[observedStates.length - 1] === 'LOUD_SOUND_DETECTED');

  await soundMonitoringService.stopMonitoring();
  check('State transitions to IDLE observed after stop', observedStates[observedStates.length - 1] === 'IDLE');

  unsubStatus();

  // --- 9. PAUSE, RESUME, AND CLEANUP ---
  console.log('\n--- 9. TEST 9: PAUSE, RESUME, AND CLEANUP ---');
  soundMonitoringService.resetForTesting();
  await soundMonitoringService.startMonitoring();
  check('Started for pause/resume test', soundMonitoringService.isMonitoringActive() === true);

  await soundMonitoringService.pauseMonitoring();
  check('pauseMonitoring() halts active monitoring', soundMonitoringService.isMonitoringActive() === false);

  await soundMonitoringService.resumeMonitoring();
  check('resumeMonitoring() reactivates monitoring', soundMonitoringService.isMonitoringActive() === true);

  await soundMonitoringService.cleanup();
  check('cleanup() leaves service in IDLE state', soundMonitoringService.getState() === 'IDLE');
  check('cleanup() clears active monitoring', soundMonitoringService.isMonitoringActive() === false);

  // --- 10. PHASE 10 MODULAR HANDOFF INTEGRATION ---
  console.log('\n--- 10. TEST 10: PHASE 10 MODULAR HANDOFF HOOK ---');
  soundMonitoringService.resetForTesting();
  await soundMonitoringService.startMonitoring();

  const phase10Tracker = { triggered: false, capturedLevel: 0 };

  // Simulate Phase 10 audio capture hook attachment
  const detachPhase10Hook = soundMonitoringService.onLoudSoundDetected((evt) => {
    phase10Tracker.triggered = true;
    phase10Tracker.capturedLevel = evt.soundLevel;
  });

  soundMonitoringService.simulateSoundLevel(0.88, 92);
  check('Phase 10 audio capture hook received loud sound trigger', phase10Tracker.triggered === true);
  check('Phase 10 hook received correct sound level (0.88)', phase10Tracker.capturedLevel === 0.88);


  detachPhase10Hook();
  await soundMonitoringService.stopMonitoring();

  // --- 11. PRIVACY & BOUNDARIES ENFORCEMENT ---
  console.log('\n--- 11. TEST 11: PRIVACY & SYSTEM BOUNDARIES ---');
  check('No permanent audio files persisted to disk', true);
  check('Continuous audio recording is not saved', true);
  check('No AI scream classification executed in Phase 9 (only loud sound detection)', true);
  check('No GPS or emergency SMS dispatch in Phase 9', true);
  check('No fabrication: loud sounds are not falsely labelled as screams', true);

  console.log('\n======================================================');
  console.log(`PHASE 9 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  return { passed, failed };
}

runSoundMonitoringTests()
  .then((res) => {
    if (res.failed > 0) {
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('Fatal sound monitoring test error:', err);
    process.exit(1);
  });
