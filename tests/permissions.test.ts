import { permissionService } from '../src/services/PermissionService';
import { DetailedPermissionsState } from '../src/types';

let passed = 0;
let failed = 0;

function check(desc: string, condition: boolean) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${desc}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${desc}`);
  }
}

export async function runPermissionsTests() {
  console.log('\n======================================================');
  console.log('LIFEGUARD AI: PHASE 6 MOBILE PERMISSIONS TEST SUITE');
  console.log('======================================================\n');

  // --- 0. Service Initialization ---
  console.log('--- 0. PERMISSION SERVICE INITIALIZATION ---');
  check('PermissionService instance exists', Boolean(permissionService));
  const initialState = permissionService.getState();
  check('State contains microphone', initialState.microphone !== undefined);
  check('State contains location', initialState.location !== undefined);
  check('State contains notifications', initialState.notifications !== undefined);
  check('State contains canAskAgain metadata', Boolean(initialState.canAskAgain));

  // --- 1. TEST 1 — MICROPHONE PERMISSION ---
  console.log('\n--- 1. TEST 1: MICROPHONE PERMISSION (GRANTED & DENIED) ---');
  // Simulate denied state
  permissionService.setMockState({
    microphone: 'denied',
    canAskAgain: { microphone: true, location: true, notifications: true },
  });
  const micDenied = await permissionService.checkMicrophonePermission();
  check('Microphone check detects denied state', micDenied.status === 'denied');
  check('Microphone canAskAgain is true', micDenied.canAskAgain === true);

  // Request & grant microphone
  permissionService.setMockState({
    microphone: 'granted',
    canAskAgain: { microphone: true, location: true, notifications: true },
  });
  const micGranted = await permissionService.requestMicrophonePermission();
  check('Microphone request detects granted state', micGranted.status === 'granted');
  check('State reflects microphone granted', permissionService.getState().microphone === 'granted');

  // --- 2. TEST 2 — LOCATION PERMISSION ---
  console.log('\n--- 2. TEST 2: LOCATION PERMISSION (GRANTED & DENIED) ---');
  // Simulate denied state
  permissionService.setMockState({
    location: 'denied',
    canAskAgain: { microphone: true, location: true, notifications: true },
  });
  const locDenied = await permissionService.checkLocationPermission();
  check('Location check detects denied state', locDenied.status === 'denied');

  // Request & grant location
  permissionService.setMockState({
    location: 'granted',
    canAskAgain: { microphone: true, location: true, notifications: true },
  });
  const locGranted = await permissionService.requestLocationPermission();
  check('Location request detects granted state', locGranted.status === 'granted');
  check('State reflects location granted', permissionService.getState().location === 'granted');

  // --- 3. TEST 3 — NOTIFICATION PERMISSION ---
  console.log('\n--- 3. TEST 3: NOTIFICATION PERMISSION (GRANTED & DENIED) ---');
  // Simulate denied state
  permissionService.setMockState({
    notifications: 'denied',
    canAskAgain: { microphone: true, location: true, notifications: true },
  });
  const notifDenied = await permissionService.checkNotificationPermission();
  check('Notifications check detects denied state', notifDenied.status === 'denied');

  // Request & grant notifications
  permissionService.setMockState({
    notifications: 'granted',
    canAskAgain: { microphone: true, location: true, notifications: true },
  });
  const notifGranted = await permissionService.requestNotificationPermission();
  check('Notifications request detects granted state', notifGranted.status === 'granted');
  check('State reflects notifications granted', permissionService.getState().notifications === 'granted');

  // --- 4. TEST 4 — PERMISSION STATUS UI LOGIC ---
  console.log('\n--- 4. TEST 4: PERMISSION STATUS & MISSING DETECTION ---');
  // All granted
  permissionService.setMockState({
    microphone: 'granted',
    location: 'granted',
    notifications: 'granted',
  });
  check('areAllGranted returns true when all 3 granted', permissionService.areAllGranted() === true);
  check('getMissingPermissions returns empty array when all granted', permissionService.getMissingPermissions().length === 0);

  // Missing microphone
  permissionService.setMockState({
    microphone: 'denied',
    location: 'granted',
    notifications: 'granted',
  });
  check('areAllGranted returns false when microphone missing', permissionService.areAllGranted() === false);
  const missing1 = permissionService.getMissingPermissions();
  check('getMissingPermissions identifies Microphone', missing1.includes('Microphone') && missing1.length === 1);

  // Missing all
  permissionService.setMockState({
    microphone: 'denied',
    location: 'denied',
    notifications: 'denied',
  });
  const missingAll = permissionService.getMissingPermissions();
  check('getMissingPermissions identifies all 3 missing', missingAll.length === 3);

  // --- 5. TEST 5 — SETTINGS REDIRECT (PERMANENTLY DENIED) ---
  console.log('\n--- 5. TEST 5: PERMANENTLY DENIED & SETTINGS REDIRECT ---');
  permissionService.setMockState({
    microphone: 'permanently_denied',
    canAskAgain: { microphone: false, location: true, notifications: true },
  });
  const micPermDenied = await permissionService.checkMicrophonePermission();
  check('Permanently denied state detected', micPermDenied.status === 'permanently_denied');
  check('canAskAgain is false for permanently denied', micPermDenied.canAskAgain === false);

  // Test openAppSettings does not throw
  let settingsDidNotThrow = true;
  try {
    await permissionService.openAppSettings();
  } catch {
    settingsDidNotThrow = false;
  }
  check('openAppSettings executes gracefully without throwing', settingsDidNotThrow);

  // Simulate user granting in Settings and returning to app
  permissionService.setMockState({
    microphone: 'granted',
    canAskAgain: { microphone: true, location: true, notifications: true },
  });
  const micAfterSettings = await permissionService.checkMicrophonePermission();
  check('Re-check after returning from settings reflects granted state', micAfterSettings.status === 'granted');

  // --- 6. TEST 6 — APP RESTART & REAL PERMISSION STATE ---
  console.log('\n--- 6. TEST 6: APP RESTART SIMULATION ---');
  // Turn off mock mode to query underlying environment
  permissionService.setMockState(null);
  const realState = await permissionService.checkAllPermissions();
  check('Real environment check returns valid state object', Boolean(realState && realState.microphone));
  check('Permissions are not hardcoded to true', typeof realState.microphone === 'string');

  // --- 7. Observer Pattern / Subscriptions ---
  console.log('\n--- 7. PERMISSION EVENT SUBSCRIPTIONS ---');
  let observerNotified: boolean = false;
  let observedState: DetailedPermissionsState | null = null;
  const unsub = permissionService.subscribe((s) => {
    observerNotified = true;
    observedState = s;
  });
  check('Observer called immediately with current state', Boolean(observerNotified) && observedState !== null);
  unsub();

  console.log('\n======================================================');
  console.log(`PHASE 6 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  return { passed, failed };
}

runPermissionsTests().then((res) => {
  if (res.failed > 0) {
    process.exit(1);
  }
}).catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});