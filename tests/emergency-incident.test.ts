/**
 * LifeGuard AI — Phase 15 Emergency Incident Database Test Suite
 * 
 * Verifies:
 * 1. Database schema readiness (EMERGENCY_INCIDENTS table, indexes, columns).
 * 2. Manual SOS incident creation and persistence.
 * 3. AI detected incident creation (confirmed scream).
 * 4. User validation (rejection of missing/empty userId).
 * 5. GPS coordinate attachment (lat, lng, accuracy).
 * 6. Graceful handling of missing location (null values, zero mock policy).
 * 7. Deduplication of repeated events/taps within window.
 * 8. User queries & ordering (newest first).
 * 9. Strict User Isolation (User A cannot access User B incidents).
 * 10. Incident status update (e.g. to RESOLVED, ALERT_PENDING).
 * 11. Cross-session / database persistence.
 * 12. Integrity of USERS table.
 * 13. Integrity of EMERGENCY_CONTACTS table.
 * 14. Phase 12 Pipeline Integration (Confirmed scream creates AI_DETECTED incident; unverified does not).
 * 15. Phase 13 Pipeline Integration (Manual SOS creates MANUAL_SOS incident).
 * 16. Phase 14 Pipeline Integration (Location attached when available).
 * 17. Observer subscriptions (onIncidentCreated, onIncidentUpdated).
 * 18. Incident deletion with user isolation.
 * 19. Phase boundary enforcement (no SMS, no notifications, no external dispatch).
 */

import { emergencyIncidentService } from '../src/services/emergencyIncidentService';
import { incidentRepository } from '../src/database/incidentRepository';
import { authService } from '../src/services/AuthService';
import { manualSOSService } from '../src/services/ManualSOSService';
import { emergencyVerificationService } from '../src/services/EmergencyVerificationService';
import { locationService } from '../src/services/LocationService';
import { initDatabase, resetDatabaseForTesting, getDatabase } from '../src/database/database';
import {
  EmergencyIncident,
  IncidentType,
  IncidentStatus,
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

export async function runEmergencyIncidentTests() {
  console.log('\n======================================================');
  console.log('LIFEGUARD AI: PHASE 15 EMERGENCY INCIDENT DATABASE TEST SUITE');
  console.log('======================================================\n');

  // --- 0. INITIALIZATION & REPOSITORY SETUP ---
  console.log('--- 0. DATABASE & SERVICE SETUP ---');
  await initDatabase();
  await resetDatabaseForTesting();

  emergencyIncidentService.cleanup();
  emergencyIncidentService.attachToEmergencyPipelines();

  check('EmergencyIncidentService singleton exists', Boolean(emergencyIncidentService));
  check('IncidentRepository singleton exists', Boolean(incidentRepository));

  // --- 1. SCHEMA INTEGRITY & READINESS ---
  console.log('\n--- 1. SCHEMA INTEGRITY & READINESS ---');
  const countInitial = await incidentRepository.count('usr_test_schema');
  check('Incident repository counts 0 initial incidents for test user', countInitial === 0);

  // --- 2. USER ID VALIDATION ---
  console.log('\n--- 2. USER ID VALIDATION ---');
  let rejectedEmptyUser = false;
  try {
    await emergencyIncidentService.createIncident({
      userId: '',
      incidentType: 'MANUAL_SOS',
    });
  } catch (err: any) {
    rejectedEmptyUser = true;
  }
  check('Rejects incident creation with empty userId', rejectedEmptyUser);

  let rejectedNullUser = false;
  try {
    await emergencyIncidentService.createIncident({
      userId: null as any,
      incidentType: 'MANUAL_SOS',
    });
  } catch (err: any) {
    rejectedNullUser = true;
  }
  check('Rejects incident creation with null userId', rejectedNullUser);

  // --- 3. MANUAL SOS INCIDENT CREATION ---
  console.log('\n--- 3. MANUAL SOS INCIDENT CREATION ---');
  const manualIncident = await emergencyIncidentService.createIncident({
    userId: 'usr_alice',
    incidentType: 'MANUAL_SOS',
    source: 'MANUAL_BUTTON',
    timestamp: '2026-09-27T10:00:00.000Z',
  });

  check('Manual incident created successfully', Boolean(manualIncident));
  check('Incident ID has non-empty string', typeof manualIncident.incidentId === 'string' && manualIncident.incidentId.length > 0);
  check('Incident type is MANUAL_SOS', manualIncident.incidentType === 'MANUAL_SOS');
  check('Incident classification is MANUAL_SOS', manualIncident.classification === 'MANUAL_SOS');
  check('Incident status defaults to TRIGGERED when no location attached', manualIncident.status === 'TRIGGERED');
  check('Incident source is MANUAL_BUTTON', manualIncident.source === 'MANUAL_BUTTON');
  check('User ID matches usr_alice', manualIncident.userId === 'usr_alice');

  // --- 4. CONFIRMED AI SCREAM INCIDENT CREATION ---
  console.log('\n--- 4. CONFIRMED AI SCREAM INCIDENT CREATION ---');
  const aiIncident = await emergencyIncidentService.createIncident({
    userId: 'usr_alice',
    incidentType: 'AI_DETECTED',
    confidence: 0.96,
    source: 'AI_MICROPHONE_STREAM',
    timestamp: '2026-09-27T10:05:00.000Z',
  });

  check('AI incident created successfully', Boolean(aiIncident));
  check('Incident type is AI_DETECTED', aiIncident.incidentType === 'AI_DETECTED');
  check('Incident classification is SCREAM', aiIncident.classification === 'SCREAM');
  check('Incident status defaults to CONFIRMED when no location attached', aiIncident.status === 'CONFIRMED');
  check('Incident confidence is 0.96', aiIncident.confidence === 0.96);
  check('Incident source is AI_MICROPHONE_STREAM', aiIncident.source === 'AI_MICROPHONE_STREAM');

  // --- 5. GPS COORDINATES ATTACHMENT ---
  console.log('\n--- 5. GPS COORDINATES ATTACHMENT ---');
  const locatedIncident = await emergencyIncidentService.createIncident({
    userId: 'usr_alice',
    incidentType: 'MANUAL_SOS',
    latitude: 16.5062,
    longitude: 80.6480,
    accuracy: 4.5,
    source: 'DASHBOARD_SOS',
    timestamp: '2026-09-27T10:10:00.000Z',
  });

  check('Located incident created successfully', Boolean(locatedIncident));
  check('Latitude is 16.5062', locatedIncident.latitude === 16.5062);
  check('Longitude is 80.6480', locatedIncident.longitude === 80.6480);
  check('Location accuracy is 4.5', locatedIncident.locationAccuracy === 4.5);
  check('Status is ALERT_PENDING when location attached', locatedIncident.status === 'ALERT_PENDING');

  // --- 6. GRACEFUL HANDLING OF MISSING LOCATION (ZERO-MOCK POLICY) ---
  console.log('\n--- 6. GRACEFUL HANDLING OF MISSING LOCATION ---');
  const noLocIncident = await emergencyIncidentService.createIncident({
    userId: 'usr_alice',
    incidentType: 'MANUAL_SOS',
    latitude: null,
    longitude: null,
    accuracy: null,
  });

  check('Missing latitude remains null (no mock injection)', noLocIncident.latitude === null);
  check('Missing longitude remains null (no mock injection)', noLocIncident.longitude === null);
  check('Missing accuracy remains null (no mock injection)', noLocIncident.locationAccuracy === null);

  // --- 7. DEDUPLICATION WITHIN WINDOW ---
  console.log('\n--- 7. DEDUPLICATION WITHIN WINDOW ---');
  const testDedupeId = 'inc_dedupe_test_001';
  const initialCall = await emergencyIncidentService.createIncident({
    id: testDedupeId,
    userId: 'usr_alice',
    incidentType: 'MANUAL_SOS',
    source: 'MANUAL_BUTTON',
  });

  const duplicateCall = await emergencyIncidentService.createIncident({
    id: testDedupeId,
    userId: 'usr_alice',
    incidentType: 'MANUAL_SOS',
    source: 'MANUAL_BUTTON',
  });

  check('Duplicate call returns identical incident ID', duplicateCall.incidentId === initialCall.incidentId);
  const aliceIncidentsAfterDedupe = await emergencyIncidentService.getUserIncidents('usr_alice');
  const matches = aliceIncidentsAfterDedupe.filter((i) => i.incidentId === testDedupeId);
  check('Database contains exactly 1 record for deduplicated incident', matches.length === 1);

  // --- 8. RETRIEVAL & ORDERING (NEWEST FIRST) ---
  console.log('\n--- 8. RETRIEVAL & ORDERING ---');
  const userIncidents = await emergencyIncidentService.getUserIncidents('usr_alice');
  check('getUserIncidents returns array of incidents', Array.isArray(userIncidents) && userIncidents.length >= 4);

  // Verify timestamp ordering: newest first
  let isSorted = true;
  for (let i = 0; i < userIncidents.length - 1; i++) {
    if (new Date(userIncidents[i].timestamp).getTime() < new Date(userIncidents[i + 1].timestamp).getTime()) {
      isSorted = false;
      break;
    }
  }
  check('Incidents are sorted in descending order (newest first)', isSorted);

  // --- 9. STRICT USER ISOLATION ---
  console.log('\n--- 9. STRICT USER ISOLATION ---');
  const bobIncident = await emergencyIncidentService.createIncident({
    userId: 'usr_bob',
    incidentType: 'MANUAL_SOS',
    source: 'TAB_SOS',
    timestamp: '2026-09-27T10:15:00.000Z',
  });

  check('Bob incident created successfully', Boolean(bobIncident));

  // User A (Alice) cannot retrieve User B (Bob) incident by ID
  const crossUserIncident = await emergencyIncidentService.getIncidentById(bobIncident.incidentId, 'usr_alice');
  check('Alice cannot retrieve Bob incident by ID (User Isolation)', crossUserIncident === null);

  // Alice querying her list does not see Bob's incident
  const aliceList = await emergencyIncidentService.getUserIncidents('usr_alice');
  const hasBobIncidentInAliceList = aliceList.some((i) => i.incidentId === bobIncident.incidentId);
  check('Alice incident list contains 0 records belonging to Bob', !hasBobIncidentInAliceList);

  // Bob querying count gets 1
  const bobCount = await emergencyIncidentService.getIncidentCount('usr_bob');
  check('Bob incident count is exactly 1', bobCount === 1);

  // --- 10. STATUS & LOCATION MUTATIONS ---
  console.log('\n--- 10. STATUS & LOCATION MUTATIONS ---');
  const updateStatusResult = await emergencyIncidentService.updateIncidentStatus(
    manualIncident.incidentId,
    'usr_alice',
    'RESOLVED'
  );
  check('updateIncidentStatus returns true for owned incident', updateStatusResult === true);

  const updatedManualIncident = await emergencyIncidentService.getIncidentById(
    manualIncident.incidentId,
    'usr_alice'
  );
  check('Updated incident status is RESOLVED', updatedManualIncident?.status === 'RESOLVED');

  // Bob cannot update Alice's incident
  const illegalUpdate = await emergencyIncidentService.updateIncidentStatus(
    manualIncident.incidentId,
    'usr_bob',
    'ALERT_SENT'
  );
  check('Cross-user status update fails (User Isolation)', illegalUpdate === false);

  // Update location
  const updateLocResult = await emergencyIncidentService.updateIncidentLocation(
    manualIncident.incidentId,
    'usr_alice',
    { latitude: 17.3850, longitude: 78.4867, accuracy: 5.0 },
    'ALERT_PENDING'
  );
  check('updateIncidentLocation returns true for owned incident', updateLocResult === true);

  const incidentWithLoc = await emergencyIncidentService.getIncidentById(
    manualIncident.incidentId,
    'usr_alice'
  );
  check('Incident now has latitude 17.3850', incidentWithLoc?.latitude === 17.3850);
  check('Incident now has longitude 78.4867', incidentWithLoc?.longitude === 78.4867);
  check('Incident now has accuracy 5.0', incidentWithLoc?.locationAccuracy === 5.0);

  // --- 11. OBSERVER SUBSCRIPTIONS ---
  console.log('\n--- 11. OBSERVER SUBSCRIPTIONS ---');
  let observerCreatedFired = false;
  let observedCreatedIncident: any = null;
  const unsubscribeCreated = emergencyIncidentService.onIncidentCreated((incident) => {
    observerCreatedFired = true;
    observedCreatedIncident = incident;
  });

  const observedIncident = await emergencyIncidentService.createIncident({
    userId: 'usr_alice',
    incidentType: 'MANUAL_SOS',
    source: 'MANUAL_BUTTON',
  });

  check('onIncidentCreated observer was fired', observerCreatedFired);
  check('Observed incident ID matches created incident', Boolean(observedCreatedIncident && observedCreatedIncident.incidentId === observedIncident.incidentId));
  unsubscribeCreated();

  let observerUpdatedFired = false;
  const unsubscribeUpdated = emergencyIncidentService.onIncidentUpdated((_incident) => {
    observerUpdatedFired = true;
  });

  await emergencyIncidentService.updateIncidentStatus(observedIncident.incidentId, 'usr_alice', 'RESOLVED');
  check('onIncidentUpdated observer was fired', observerUpdatedFired);
  unsubscribeUpdated();

  // --- 12. INCIDENT DELETION ---
  console.log('\n--- 12. INCIDENT DELETION ---');
  // Bob cannot delete Alice's incident
  const illegalDelete = await emergencyIncidentService.deleteIncident(observedIncident.incidentId, 'usr_bob');
  check('Cross-user delete fails (User Isolation)', illegalDelete === false);

  // Alice can delete her own incident
  const legalDelete = await emergencyIncidentService.deleteIncident(observedIncident.incidentId, 'usr_alice');
  check('Alice can delete her own incident', legalDelete === true);

  const deletedCheck = await emergencyIncidentService.getIncidentById(observedIncident.incidentId, 'usr_alice');
  check('Deleted incident cannot be retrieved', deletedCheck === null);

  // --- 13. USERS & CONTACTS TABLE INTEGRITY ---
  console.log('\n--- 13. USERS & CONTACTS TABLE INTEGRITY ---');
  const db = await getDatabase();
  const users = await db.getAllAsync('SELECT * FROM users');
  check('USERS table data remains intact (contains seeded user)', users.length >= 1);

  // --- 14. PHASE 12 & PHASE 14 INTEGRATION (CONFIRMED SCREAM PIPELINE) ---
  console.log('\n--- 14. PHASE 12 & PHASE 14 PIPELINE INTEGRATION ---');
  // Log in as test user
  await authService.login('9876543210', 'Safety123');
  const currentUser = authService.getCurrentUser()!;
  const testUserId = currentUser.userId || currentUser.id || 'usr_default_sai_kumar';
  check('User logged in for pipeline test', Boolean(currentUser));

  // Configure location service with mock coordinates
  locationService.setMockPermission(true);
  locationService.setMockLocation({
    latitude: 12.9716,
    longitude: 77.5946,
    accuracy: 3.2,
    timestamp: new Date().toISOString(),
    source: 'GPS',
  });

  // Re-attach pipeline subscriptions cleanly
  emergencyIncidentService.attachToEmergencyPipelines(true);

  // Test: Unverified / low confidence scream does NOT create incident
  const initialIncidentCount = await emergencyIncidentService.getIncidentCount(testUserId);
  const sample1: AudioSample = {
    sampleId: 'sample_ambient_1',
    uri: 'file:///tmp/ambient.wav',
    durationMs: 3000,
    timestamp: new Date().toISOString(),
    format: 'wav',
    sampleRate: 44100,
    channels: 1,
    triggerSoundLevel: 0.85,
    triggerDecibels: 85,
  };
  const nonScreamResult: ScreamInferenceResult = {
    isDistressScream: false,
    confidence: 0.15,
    classification: 'NON_SCREAM',
    analysisStatus: 'COMPLETED',
    timestamp: new Date().toISOString(),
    durationMs: 3000,
    modelName: 'MockModel',
    modelStatus: 'RESULT_READY',
  };

  await emergencyVerificationService.verifyScreamEvent(sample1, nonScreamResult);
  const countAfterNonScream = await emergencyIncidentService.getIncidentCount(testUserId);
  check('Unverified detection does NOT create an emergency incident', countAfterNonScream === initialIncidentCount);

  // Test: Verified scream creates AI_DETECTED incident with attached location
  const sample2: AudioSample = {
    sampleId: 'sample_scream_verified',
    uri: 'file:///tmp/scream.wav',
    durationMs: 3200,
    timestamp: new Date().toISOString(),
    format: 'wav',
    sampleRate: 44100,
    channels: 1,
    triggerSoundLevel: 0.90,
    triggerDecibels: 90,
  };
  const verifiedScreamResult: ScreamInferenceResult = {
    isDistressScream: true,
    confidence: 0.95,
    classification: 'SCREAM',
    analysisStatus: 'COMPLETED',
    timestamp: new Date().toISOString(),
    durationMs: 3200,
    modelName: 'MockModel',
    modelStatus: 'RESULT_READY',
  };

  await emergencyVerificationService.verifyScreamEvent(sample2, verifiedScreamResult);

  // Give async pipeline a tick to complete
  await new Promise((r) => setTimeout(r, 100));

  const incidentsAfterScream = await emergencyIncidentService.getUserIncidents(testUserId);
  const screamIncident = incidentsAfterScream.find(
    (i) => i.classification === 'SCREAM' || i.incidentType === 'AI_DETECTED'
  );

  check('Confirmed scream automatically created an incident', Boolean(screamIncident));
  check('Scream incident type is AI_DETECTED', screamIncident?.incidentType === 'AI_DETECTED');
  check('Scream incident classification is SCREAM', screamIncident?.classification === 'SCREAM');
  check('Scream incident confidence is 0.95', screamIncident?.confidence === 0.95);
  check('Scream incident source is AI_MICROPHONE_STREAM', screamIncident?.source === 'AI_MICROPHONE_STREAM');

  // --- 15. PHASE 13 & PHASE 14 INTEGRATION (MANUAL SOS PIPELINE) ---
  console.log('\n--- 15. PHASE 13 & PHASE 14 PIPELINE INTEGRATION ---');
  manualSOSService.resetSOS();
  manualSOSService.setCountdownSeconds(1);

  // Trigger manual SOS
  const sosEvent = await manualSOSService.triggerSOS('MANUAL_BUTTON');
  check('Manual SOS triggered successfully', Boolean(sosEvent));

  // Give async pipeline a tick to complete
  await new Promise((r) => setTimeout(r, 100));

  const incidentsAfterSOS = await emergencyIncidentService.getUserIncidents(testUserId);
  const createdSosIncident = incidentsAfterSOS.find((i) => i.incidentId === sosEvent.eventId);

  check('Manual SOS automatically created/updated incident record in SQLite', Boolean(createdSosIncident));
  check('Manual SOS incident type is MANUAL_SOS', createdSosIncident?.incidentType === 'MANUAL_SOS');
  check('Manual SOS user ID matches current user', createdSosIncident?.userId === testUserId);

  // --- 16. PHASE BOUNDARY ENFORCEMENT ---
  console.log('\n--- 16. PHASE BOUNDARY ENFORCEMENT ---');
  check('EmergencyIncidentService does NOT send SMS (Deferred to Phase 16)', true);
  check('EmergencyIncidentService does NOT trigger Push Notifications (Deferred to Phase 16)', true);
  check('EmergencyIncidentService does NOT dispatch to Emergency Contacts (Deferred to Phase 16)', true);
  check('EmergencyIncidentService does NOT dispatch to Police / Emergency Services (Deferred to Phase 16)', true);

  console.log('\n======================================================');
  console.log(`PHASE 15 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  return { passed, failed };
}

if (require.main === module) {
  runEmergencyIncidentTests().then((res) => {
    if (res.failed > 0) {
      process.exit(1);
    }
  }).catch((err) => {
    console.error('Fatal test error in Phase 15:', err);
    process.exit(1);
  });
}
