/**
 * LifeGuard AI — Phase 14 GPS Location Tracking Test Suite
 * 
 * Verifies:
 * 1. LocationService initialization and initial IDLE state.
 * 2. Coordinate range validation: lat [-90, 90], lng [-180, 180], accuracy >= 0.
 * 3. Rejection of NaN, null, undefined, strings, Infinity, and out-of-range coordinates.
 * 4. Coordinate formatting and Google Maps link generation.
 * 5. Permission checks & handling (granted vs denied).
 * 6. Explicit state machine transitions: IDLE -> REQUESTING_PERMISSION -> GETTING_LOCATION -> LOCATION_READY (or LOCATION_ERROR).
 * 7. Zero-Mock Policy: never substitutes fake fallback coordinates on error.
 * 8. Manual SOS pipeline integration: automatically acquires GPS coordinates and updates SQLite incident.
 * 9. Confirmed scream pipeline integration: automatically acquires GPS coordinates and saves incident.
 * 10. Decoupled handoff event for Phase 15 dispatch (EmergencyLocationHandoff).
 * 11. IncidentRepository SQLite persistence verification (latitude, longitude, accuracy, alert_status).
 * 12. Observers, subscriptions, and cleanup.
 * 13. Strict phase boundary verification (no SMS, no emergency contact dispatch, no continuous background tracking).
 */

import { locationService } from '../src/services/LocationService';
import { manualSOSService } from '../src/services/ManualSOSService';
import { emergencyVerificationService } from '../src/services/EmergencyVerificationService';
import { permissionService } from '../src/services/PermissionService';
import { authService } from '../src/services/AuthService';
import { incidentRepository } from '../src/database/incidentRepository';
import { initDatabase, resetDatabaseForTesting } from '../src/database/database';
import {
  LocationData,
  LocationState,
  EmergencyLocationHandoff,
  AudioSample,
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

export async function runLocationTests() {
  console.log('\n======================================================');
  console.log('LIFEGUARD AI: PHASE 14 GPS LOCATION TRACKING TEST SUITE');
  console.log('======================================================\n');

  // --- 0. INITIALIZATION & REPOSITORY SETUP ---
  console.log('--- 0. SERVICE INITIALIZATION & DEFAULT STATE ---');
  await initDatabase();
  await resetDatabaseForTesting();

  locationService.cleanup();
  locationService.attachToEmergencyPipelines();

  check('LocationService singleton exists', Boolean(locationService));
  check('Initial state is IDLE', locationService.getState() === 'IDLE');
  check('Initial lastLocation is null', locationService.getLastLocation() === null);
  check('Initial lastError is null', locationService.getLastError() === null);

  // --- 1. COORDINATE VALIDATION ---
  console.log('\n--- 1. COORDINATE VALIDATION ---');
  // Valid coordinates
  check(
    'Validates standard coordinates (Vijayawada)',
    locationService.validateLocation({ latitude: 16.5062, longitude: 80.6480, accuracy: 12 })
  );
  check(
    'Validates negative coordinates (Sydney: -33.8688, 151.2093)',
    locationService.validateLocation({ latitude: -33.8688, longitude: 151.2093, accuracy: 5 })
  );
  check(
    'Validates boundary coordinates (North Pole: 90, 0)',
    locationService.validateLocation({ latitude: 90, longitude: 0 })
  );
  check(
    'Validates boundary coordinates (South Pole: -90, 0)',
    locationService.validateLocation({ latitude: -90, longitude: 0 })
  );
  check(
    'Validates boundary coordinates (Antimeridian: 0, 180)',
    locationService.validateLocation({ latitude: 0, longitude: 180 })
  );
  check(
    'Validates boundary coordinates (Antimeridian: 0, -180)',
    locationService.validateLocation({ latitude: 0, longitude: -180 })
  );
  check(
    'Accepts null accuracy',
    locationService.validateLocation({ latitude: 12.9716, longitude: 77.5946, accuracy: null })
  );
  check(
    'Accepts undefined accuracy',
    locationService.validateLocation({ latitude: 12.9716, longitude: 77.5946 })
  );

  // Invalid coordinates
  check(
    'Rejects latitude > 90 (91.0)',
    !locationService.validateLocation({ latitude: 91.0, longitude: 80.0 })
  );
  check(
    'Rejects latitude < -90 (-90.001)',
    !locationService.validateLocation({ latitude: -90.001, longitude: 80.0 })
  );
  check(
    'Rejects longitude > 180 (180.5)',
    !locationService.validateLocation({ latitude: 20.0, longitude: 180.5 })
  );
  check(
    'Rejects longitude < -180 (-181.0)',
    !locationService.validateLocation({ latitude: 20.0, longitude: -181.0 })
  );
  check(
    'Rejects NaN latitude',
    !locationService.validateLocation({ latitude: NaN, longitude: 80.0 })
  );
  check(
    'Rejects NaN longitude',
    !locationService.validateLocation({ latitude: 20.0, longitude: NaN })
  );
  check(
    'Rejects Infinity latitude',
    !locationService.validateLocation({ latitude: Infinity, longitude: 80.0 })
  );
  check(
    'Rejects string coordinates ("16.5", "80.5")',
    !locationService.validateLocation({ latitude: '16.5' as any, longitude: '80.5' as any })
  );
  check(
    'Rejects negative accuracy (-5)',
    !locationService.validateLocation({ latitude: 20.0, longitude: 80.0, accuracy: -5 })
  );
  check(
    'Rejects null coords object',
    !locationService.validateLocation(null)
  );
  check(
    'Rejects undefined coords object',
    !locationService.validateLocation(undefined)
  );

  // --- 2. COORDINATE & MAP LINK FORMATTING ---
  console.log('\n--- 2. COORDINATE & MAP LINK FORMATTING ---');
  const formattedCoords = locationService.formatCoordinates(16.5062, 80.6480);
  check(
    'formatCoordinates formats positive lat/long as N/E',
    formattedCoords === '16.5062° N, 80.6480° E',
    `got: ${formattedCoords}`
  );

  const formattedSouthWest = locationService.formatCoordinates(-33.8688, -70.6693);
  check(
    'formatCoordinates formats negative lat/long as S/W',
    formattedSouthWest === '33.8688° S, 70.6693° W',
    `got: ${formattedSouthWest}`
  );

  const mapUrl = locationService.formatMapUrl(16.5062, 80.6480);
  check(
    'formatMapUrl returns valid Google Maps query URL',
    mapUrl === 'https://maps.google.com/?q=16.5062,80.648',
    `got: ${mapUrl}`
  );

  // --- 3. PERMISSION CHECKING & REQUESTING ---
  console.log('\n--- 3. PERMISSION CHECKING & REQUESTING ---');
  locationService.setMockPermission(true);
  let hasPerm = await locationService.checkLocationPermission();
  check('checkLocationPermission returns true when permission granted', hasPerm === true);

  locationService.setMockPermission(false);
  hasPerm = await locationService.checkLocationPermission();
  check('checkLocationPermission returns false when permission denied', hasPerm === false);

  locationService.setMockPermission(true);
  hasPerm = await locationService.requestLocationPermission();
  check('requestLocationPermission returns true when permission granted', hasPerm === true);

  // --- 4. STATE MACHINE & ON-DEMAND RETRIEVAL ---
  console.log('\n--- 4. STATE MACHINE & ON-DEMAND RETRIEVAL ---');
  locationService.reset();

  const stateTransitions: LocationState[] = [];
  const unsubState = locationService.subscribeState((st) => {
    stateTransitions.push(st);
  });

  // Test permission denied failure
  locationService.setMockPermission(false);
  const failResult = await locationService.getCurrentLocation();
  check('getCurrentLocation fails when permission denied', failResult.success === false);
  check('State transitions to LOCATION_ERROR on denied permission', locationService.getState() === 'LOCATION_ERROR');
  check('Error message is present on denied permission', Boolean(failResult.error));
  check('No coordinates returned on denied permission', failResult.location === undefined);

  // Test successful retrieval with mock coordinates
  locationService.reset();
  stateTransitions.length = 0;
  locationService.setMockPermission(true);

  const mockCoords: LocationData = {
    latitude: 16.5062,
    longitude: 80.6480,
    accuracy: 8.5,
    timestamp: new Date().toISOString(),
    source: 'GPS',
    altitude: 15.0,
    speed: 0.0,
    heading: 90.0,
  };
  locationService.setMockLocation(mockCoords);

  let capturedLocation: any = null;
  const unsubLoc = locationService.onLocationAcquired((data) => {
    capturedLocation = data;
  });

  const successResult = await locationService.getCurrentLocation();
  check('getCurrentLocation succeeds with valid coordinates', successResult.success === true);
  check('Final state is LOCATION_READY', locationService.getState() === 'LOCATION_READY');
  check(
    'State machine transitioned through REQUESTING_PERMISSION and GETTING_LOCATION',
    stateTransitions.includes('REQUESTING_PERMISSION') &&
    stateTransitions.includes('GETTING_LOCATION') &&
    stateTransitions.includes('LOCATION_READY')
  );
  check('onLocationAcquired listener was triggered', capturedLocation !== null);
  check(
    'Captured latitude matches',
    capturedLocation && capturedLocation.latitude === 16.5062 && successResult.location?.latitude === 16.5062
  );
  check(
    'Captured longitude matches',
    capturedLocation && capturedLocation.longitude === 80.6480 && successResult.location?.longitude === 80.6480
  );
  check(
    'Captured accuracy matches',
    capturedLocation && capturedLocation.accuracy === 8.5 && successResult.location?.accuracy === 8.5
  );
  check(
    'Source is GPS',
    successResult.location?.source === 'GPS'
  );
  check(
    'getLastLocation returns a copy of coordinates',
    locationService.getLastLocation()?.latitude === 16.5062
  );

  unsubState();
  unsubLoc();

  // --- 5. ZERO-MOCK POLICY VERIFICATION ---
  console.log('\n--- 5. ZERO-MOCK POLICY ENFORCEMENT ---');
  locationService.reset();
  locationService.setMockPermission(true);
  // Set invalid mock to simulate GPS hardware failure / null fix
  locationService.setMockLocation(null);
  locationService.setMockLocation({
    latitude: NaN,
    longitude: 80.0,
    accuracy: null,
    timestamp: new Date().toISOString(),
    source: 'GPS',
  });

  const zeroMockResult = await locationService.getCurrentLocation();
  check('Rejects invalid coordinates and fails', zeroMockResult.success === false);
  check('State transitions to LOCATION_ERROR', locationService.getState() === 'LOCATION_ERROR');
  check('Does NOT substitute hardcoded Vijayawada default', zeroMockResult.location === undefined);
  check('Last location remains null on error', locationService.getLastLocation() === null);

  // --- 6. MANUAL SOS PIPELINE INTEGRATION & SQLITE PERSISTENCE ---
  console.log('\n--- 6. MANUAL SOS PIPELINE INTEGRATION ---');
  await resetDatabaseForTesting();

  // Authenticate test user
  await authService.init();
  const authRes = await authService.login('+919876543210', 'Safety123');
  check('Test user logged in for manual SOS', authRes.success === true);
  const userId = authRes.user?.userId || 'usr_default_sai_kumar';

  locationService.reset();
  locationService.setMockPermission(true);
  locationService.setMockLocation({
    latitude: 17.3850,
    longitude: 78.4867, // Hyderabad coordinates
    accuracy: 6.2,
    timestamp: new Date().toISOString(),
    source: 'GPS',
  });

  let emergencyHandoffReceived: any = null;
  const unsubEmergency = locationService.onEmergencyLocationReady((handoff) => {
    emergencyHandoffReceived = handoff;
  });

  manualSOSService.resetSOS();
  locationService.attachToEmergencyPipelines(true);

  // Trigger manual SOS directly
  const sosEvent = await manualSOSService.triggerSOS('MANUAL_BUTTON');
  check('Manual SOS triggered', Boolean(sosEvent && sosEvent.eventId));

  // Small delay to let async pipeline complete
  await new Promise((resolve) => setTimeout(resolve, 150));

  check('EmergencyLocationHandoff emitted for Manual SOS', emergencyHandoffReceived !== null);
  check(
    'Handoff eventId matches SOS eventId',
    emergencyHandoffReceived && emergencyHandoffReceived.eventId === sosEvent.eventId
  );
  check(
    'Handoff incidentType is MANUAL_SOS',
    emergencyHandoffReceived && emergencyHandoffReceived.incidentType === 'MANUAL_SOS'
  );
  check(
    'Handoff location coordinates are correct',
    emergencyHandoffReceived &&
    emergencyHandoffReceived.location.latitude === 17.3850 &&
    emergencyHandoffReceived.location.longitude === 78.4867
  );
  check(
    'Handoff status is LOCATION_READY',
    emergencyHandoffReceived && emergencyHandoffReceived.status === 'LOCATION_READY'
  );

  // Verify SQLite database update in emergency_incidents
  const persistedIncident = await incidentRepository.getIncidentById(sosEvent.eventId, userId);
  check('Incident found in SQLite database', persistedIncident !== null);
  check(
    'Persisted incident latitude is 17.3850',
    persistedIncident?.latitude === 17.3850
  );
  check(
    'Persisted incident longitude is 78.4867',
    persistedIncident?.longitude === 78.4867
  );
  check(
    'Persisted incident accuracy is 6.2',
    persistedIncident?.accuracy === 6.2
  );
  check(
    'Persisted incident alert_status updated to LOCATION_ATTACHED',
    persistedIncident?.alert_status === 'LOCATION_ATTACHED'
  );

  unsubEmergency();

  // --- 7. CONFIRMED SCREAM EMERGENCY INTEGRATION ---
  console.log('\n--- 7. CONFIRMED SCREAM EMERGENCY PIPELINE INTEGRATION ---');
  locationService.reset();
  locationService.setMockPermission(true);
  locationService.setMockLocation({
    latitude: 13.0827,
    longitude: 80.2707, // Chennai coordinates
    accuracy: 4.8,
    timestamp: new Date().toISOString(),
    source: 'GPS',
  });

  let screamHandoffReceived: any = null;
  const unsubScream = locationService.onEmergencyLocationReady((handoff) => {
    screamHandoffReceived = handoff;
  });

  emergencyVerificationService.resetVerification();

  const validSample: AudioSample = {
    sampleId: `smp_test_${Date.now()}`,
    uri: 'file:///data/cache/audio_sample_valid.wav',
    durationMs: 2500,
    format: 'wav',
    sampleRate: 44100,
    channels: 1,
    timestamp: new Date().toISOString(),
    triggerSoundLevel: 0.88,
    triggerDecibels: 82.5,
  };

  const validInference: ScreamInferenceResult = {
    classification: 'SCREAM',
    confidence: 0.94,
    isDistressScream: true,
    timestamp: new Date().toISOString(),
    durationMs: 2500,
    modelName: 'LifeguardScreamDetector-v1',
    modelStatus: 'RESULT_READY',
    analysisStatus: 'COMPLETED',
  };

  const verificationResult = await emergencyVerificationService.verifyScreamEvent(
    validSample,
    validInference
  );

  check(
    'Scream verification confirmed emergency',
    verificationResult.status === 'CONFIRMED_EMERGENCY'
  );

  // Allow async pipeline execution
  await new Promise((resolve) => setTimeout(resolve, 150));

  check('EmergencyLocationHandoff emitted for Confirmed Scream', screamHandoffReceived !== null);
  check(
    'Scream handoff incidentType is CONFIRMED_SCREAM',
    screamHandoffReceived && screamHandoffReceived.incidentType === 'CONFIRMED_SCREAM'
  );
  check(
    'Scream handoff coordinates are correct (Chennai: 13.0827, 80.2707)',
    screamHandoffReceived &&
    screamHandoffReceived.location.latitude === 13.0827 &&
    screamHandoffReceived.location.longitude === 80.2707
  );

  // Check persisted incident in SQLite
  const screamIncident = await incidentRepository.getIncidentById(
    screamHandoffReceived?.eventId || '',
    userId
  );
  check('Confirmed scream incident recorded in SQLite', screamIncident !== null);
  check(
    'Scream incident has latitude 13.0827',
    screamIncident?.latitude === 13.0827
  );
  check(
    'Scream incident has longitude 80.2707',
    screamIncident?.longitude === 80.2707
  );
  check(
    'Scream incident alert_status is LOCATION_ATTACHED',
    screamIncident?.alert_status === 'LOCATION_ATTACHED'
  );

  unsubScream();

  // --- 8. PHASE BOUNDARY & PRIVACY ENFORCEMENT ---
  console.log('\n--- 8. PHASE BOUNDARY & PRIVACY ENFORCEMENT ---');
  check(
    'LocationService does not invoke SMS sending APIs',
    typeof (locationService as any).sendSMS === 'undefined'
  );
  check(
    'LocationService does not invoke Emergency Contacts notification APIs (Phase 15)',
    typeof (locationService as any).notifyContacts === 'undefined'
  );
  check(
    'LocationService does not perform continuous background tracking',
    typeof (locationService as any).startContinuousBackgroundTracking === 'undefined'
  );

  // --- SUMMARY ---
  console.log('\n======================================================');
  console.log(`PHASE 14 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Auto-run if executed directly
if (require.main === module) {
  runLocationTests().catch((err) => {
    console.error('Test runner fatal failure:', err);
    process.exit(1);
  });
}
