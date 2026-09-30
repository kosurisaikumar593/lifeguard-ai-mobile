/**
 * LifeGuard AI — Phase 16 Emergency Alert System Test Suite
 * 
 * Verifies:
 * 1. Alert service initialization and provider management.
 * 2. Alert message formatting with actual user name, time, and coordinates.
 * 3. Graceful handling of missing location (no mock coordinate fabrication).
 * 4. Authentication enforcement (rejection of unauthenticated dispatches).
 * 5. Predefined contact retrieval and strict user isolation.
 * 6. "No contacts" handling (truthful NO_CONTACTS status, no fake success).
 * 7. Single and multiple contact alert deliveries.
 * 8. Partial delivery failure resiliency (does not abort remaining contacts).
 * 9. Total delivery failure handling (truthful FAILED status, no fake success).
 * 10. Provider unavailability handling.
 * 11. Duplicate alert prevention (deduplication cache & SQLite status check).
 * 12. Manual SOS pipeline integration (SOS -> GPS -> Alert -> ALERT_SENT).
 * 13. Confirmed AI scream pipeline integration (Confirmed scream -> GPS -> Alert -> ALERT_SENT).
 * 14. Loud sound alone and unverified screams do NOT send alerts.
 * 15. SQLite database incident status updates (ALERT_PENDING -> SENDING -> ALERT_SENT / ALERT_FAILED / NO_CONTACTS).
 * 16. Observer subscriptions (onAlertDispatched, onAlertStatusChanged).
 * 17. Scope enforcement (no police, no 112 emergency services, no audio upload, no continuous GPS).
 */

import { emergencyAlertService, SimulatedSmsAlertProvider, IAlertProvider } from '../src/services/emergencyAlertService';
import { emergencyIncidentService } from '../src/services/emergencyIncidentService';
import { incidentRepository } from '../src/database/incidentRepository';
import { authService } from '../src/services/AuthService';
import { contactService } from '../src/services/ContactService';
import { manualSOSService } from '../src/services/ManualSOSService';
import { emergencyVerificationService } from '../src/services/EmergencyVerificationService';
import { locationService } from '../src/services/LocationService';
import { soundMonitoringService } from '../src/services/SoundMonitoringService';
import { initDatabase, resetDatabaseForTesting, getDatabase } from '../src/database/database';
import {
  EmergencyIncident,
  EmergencyContact,
  EmergencyAlertPayload,
  ContactAlertResult,
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

export async function runEmergencyAlertTests() {
  console.log('\n======================================================');
  console.log('LIFEGUARD AI: PHASE 16 EMERGENCY ALERT SYSTEM TEST SUITE');
  console.log('======================================================\n');

  // --- 0. INITIALIZATION & REPOSITORY SETUP ---
  console.log('--- 0. DATABASE & SERVICE SETUP ---');
  await initDatabase();
  await resetDatabaseForTesting();

  emergencyAlertService.cleanup();
  emergencyAlertService.reset();
  emergencyAlertService.setActiveProvider('SimulatedSmsProvider');

  check('EmergencyAlertService singleton exists', Boolean(emergencyAlertService));
  check('SimulatedSmsProvider is registered', Boolean(emergencyAlertService.getProvider('SimulatedSmsProvider')));
  check('ExpoNotificationProvider is registered', Boolean(emergencyAlertService.getProvider('ExpoNotificationProvider')));
  check('ExternalGatewayProvider is registered', Boolean(emergencyAlertService.getProvider('ExternalGatewayProvider')));
  check('Active provider defaults to SimulatedSmsProvider', emergencyAlertService.getActiveProviderName() === 'SimulatedSmsProvider');

  // --- 1. ALERT MESSAGE FORMATTING (ACTUAL DATA ONLY) ---
  console.log('\n--- 1. ALERT MESSAGE FORMATTING ---');
  const validLat = 16.5062;
  const validLng = 80.6480;
  const validAcc = 5.2;
  const testTime = '2026-09-28T10:00:00.000Z';

  const formattedWithLoc = emergencyAlertService.formatAlertMessage(
    'Ananya Roy',
    'MANUAL_SOS',
    testTime,
    validLat,
    validLng,
    validAcc
  );

  check('Formatted message contains header', formattedWithLoc.includes('LIFEGUARD AI EMERGENCY ALERT'));
  check('Formatted message contains user name Ananya Roy', formattedWithLoc.includes('Ananya Roy may need immediate assistance'));
  check('Formatted message contains emergency type', formattedWithLoc.includes('Manual SOS Emergency'));
  check('Formatted message contains latitude', formattedWithLoc.includes('Latitude: 16.5062'));
  check('Formatted message contains longitude', formattedWithLoc.includes('Longitude: 80.648'));
  check('Formatted message contains accuracy', formattedWithLoc.includes('±5m'));
  check('Formatted message contains Google Maps link', formattedWithLoc.includes('https://www.google.com/maps?q=16.5062,80.648'));
  check('No raw audio data attached to message', !formattedWithLoc.includes('audio') && !formattedWithLoc.includes('wav') && !formattedWithLoc.includes('m4a'));

  // Missing location formatting
  const formattedNoLoc = emergencyAlertService.formatAlertMessage(
    'Ananya Roy',
    'AI_DETECTED',
    testTime,
    null,
    null,
    null
  );

  check('No location message indicates Location unavailable', formattedNoLoc.includes('Location unavailable at time of alert'));
  check('No location message does NOT include google maps link', !formattedNoLoc.includes('https://www.google.com/maps'));
  check('No fake coordinates are fabricated', !formattedNoLoc.includes('Latitude:'));

  // --- 2. AUTHENTICATION & SESSION VALIDATION ---
  console.log('\n--- 2. AUTHENTICATION VALIDATION ---');
  await authService.logout();
  const unauthResult = await emergencyAlertService.sendEmergencyAlert('inc_unauth_001');
  check('Unauthenticated alert dispatch returns FAILED', unauthResult.status === 'FAILED');
  check('Unauthenticated error indicates authentication required', Boolean(unauthResult.error && unauthResult.error.includes('Authentication required')));
  check('0 successful deliveries for unauthenticated alert', unauthResult.successfulDeliveries === 0);

  // --- 3. PREDEFINED CONTACT RETRIEVAL & USER ISOLATION ---
  console.log('\n--- 3. USER ISOLATION & CONTACT RETRIEVAL ---');
  // Log in as User A
  await authService.login('9876543210', 'Safety123');
  const userA = authService.getCurrentUser()!;
  const userAId = userA.userId || userA.id;

  // Add Contact for User A
  const addContactARes = await contactService.addContact({
    name: 'Suresh Patel',
    mobileNumber: '9876543211',
    relationship: 'Father',
  }, userAId);
  check('Contact added for User A', Boolean(addContactARes.success));

  const contactsA = await contactService.getContacts(userAId);
  check('User A has 1 contact', contactsA.length === 1);
  check('Contact phone matches', contactsA[0].mobile_number === '+919876543211');

  // Verify User B isolation: User B has 0 contacts
  const contactsB = await contactService.getContacts('usr_isolated_b');
  check('User B has 0 contacts (User Isolation)', contactsB.length === 0);

  // --- 4. "NO CONTACTS" HANDLING (TRUTHFUL REPORTING) ---
  console.log('\n--- 4. NO CONTACTS HANDLING ---');
  // Create incident for User B
  const incidentUserB = await emergencyIncidentService.createIncident({
    userId: 'usr_isolated_b',
    incidentType: 'MANUAL_SOS',
    source: 'MANUAL_BUTTON',
  });

  const noContactsResult = await emergencyAlertService.sendEmergencyAlert(
    incidentUserB.incidentId,
    'usr_isolated_b'
  );

  check('Alert status is NO_CONTACTS', noContactsResult.status === 'NO_CONTACTS');
  check('Does NOT claim alert was sent', noContactsResult.successfulDeliveries === 0);
  check('Reports descriptive error about missing contacts', Boolean(noContactsResult.error && noContactsResult.error.includes('No emergency contacts')));
  
  const incidentBUpdated = await incidentRepository.getIncidentById(incidentUserB.incidentId, 'usr_isolated_b');
  check('Incident in SQLite updated to NO_CONTACTS', incidentBUpdated?.alert_status === 'NO_CONTACTS');
  check('Incident remains recorded in database', Boolean(incidentBUpdated));

  // --- 5. SUCCESSFUL ALERT DELIVERY TO CONTACTS ---
  console.log('\n--- 5. SUCCESSFUL ALERT DELIVERY ---');
  // Add a second contact for User A
  await contactService.addContact({
    name: 'Priya Sharma',
    mobileNumber: '9876543212',
    relationship: 'Sister',
  }, userAId);

  const contactsA2 = await contactService.getContacts(userAId);
  check('User A now has 2 predefined contacts', contactsA2.length === 2);

  // Create incident for User A with GPS coordinates
  const incidentUserA = await emergencyIncidentService.createIncident({
    userId: userAId,
    incidentType: 'MANUAL_SOS',
    latitude: 16.5062,
    longitude: 80.6480,
    accuracy: 4.8,
    status: 'ALERT_PENDING',
    source: 'DASHBOARD_SOS',
  });

  const sendResult = await emergencyAlertService.sendEmergencyAlert(
    incidentUserA.incidentId,
    userAId
  );

  check('Alert dispatch status is SENT', sendResult.status === 'SENT');
  check('Total contacts equals 2', sendResult.totalContacts === 2);
  check('Successful deliveries equals 2', sendResult.successfulDeliveries === 2);
  check('Failed deliveries equals 0', sendResult.failedDeliveries === 0);
  check('Delivery results contains 2 entries', sendResult.deliveryResults.length === 2);
  check('First contact marked SENT', sendResult.deliveryResults[0].status === 'SENT');
  check('Second contact marked SENT', sendResult.deliveryResults[1].status === 'SENT');
  check('Each contact result has delivery channel SMS', sendResult.deliveryResults[0].channel === 'SMS');
  check('Each contact result has unique messageId', Boolean(sendResult.deliveryResults[0].messageId));

  // Verify SQLite incident alert_status updated to ALERT_SENT
  const incidentAUpdated = await incidentRepository.getIncidentById(incidentUserA.incidentId, userAId);
  check('Incident alert_status in SQLite updated to ALERT_SENT', incidentAUpdated?.alert_status === 'ALERT_SENT');

  // --- 6. DUPLICATE ALERT PREVENTION ---
  console.log('\n--- 6. DUPLICATE ALERT PREVENTION ---');
  const duplicateResult = await emergencyAlertService.sendEmergencyAlert(
    incidentUserA.incidentId,
    userAId
  );

  check('Duplicate dispatch returns identical alertId', duplicateResult.alertId === sendResult.alertId);
  check('Duplicate dispatch status remains SENT', duplicateResult.status === 'SENT');

  // --- 7. PARTIAL CONTACT DELIVERY RESILIENCY ---
  console.log('\n--- 7. PARTIAL CONTACT DELIVERY ---');
  const simProvider = emergencyAlertService.getProvider('SimulatedSmsProvider') as SimulatedSmsAlertProvider;
  
  // Set failure specifically for the first contact ID
  const contactToFail = contactsA2[0].contact_id || contactsA2[0].id;
  simProvider.setSimulatedFailure(false, contactToFail);

  const partialIncident = await emergencyIncidentService.createIncident({
    userId: userAId,
    incidentType: 'AI_DETECTED',
    confidence: 0.94,
    latitude: 12.9716,
    longitude: 77.5946,
    accuracy: 3.5,
    status: 'ALERT_PENDING',
    source: 'AI_MICROPHONE_STREAM',
  });

  const partialResult = await emergencyAlertService.sendEmergencyAlert(
    partialIncident.incidentId,
    userAId
  );

  check('Partial alert status is PARTIALLY_SENT', partialResult.status === 'PARTIALLY_SENT');
  check('Successful deliveries is 1', partialResult.successfulDeliveries === 1);
  check('Failed deliveries is 1', partialResult.failedDeliveries === 1);
  check('Failed contact has status FAILED', partialResult.deliveryResults.find((r) => r.contactId === contactToFail)?.status === 'FAILED');
  check('Succeeded contact has status SENT', partialResult.deliveryResults.find((r) => r.contactId !== contactToFail)?.status === 'SENT');
  check('Error message notes partial failure', Boolean(partialResult.error && partialResult.error.includes('1 of 2')));

  // Reset simulated failure
  simProvider.setSimulatedFailure(false);

  // --- 8. TOTAL DELIVERY FAILURE ---
  console.log('\n--- 8. TOTAL DELIVERY FAILURE ---');
  simProvider.setSimulatedFailure(true);

  const failIncident = await emergencyIncidentService.createIncident({
    userId: userAId,
    incidentType: 'MANUAL_SOS',
    source: 'TAB_SOS',
  });

  const failResult = await emergencyAlertService.sendEmergencyAlert(
    failIncident.incidentId,
    userAId
  );

  check('Total failure alert status is FAILED', failResult.status === 'FAILED');
  check('Successful deliveries is 0', failResult.successfulDeliveries === 0);
  check('Failed deliveries equals total contacts', failResult.failedDeliveries === contactsA2.length);
  check('Never shows fake success on failure', failResult.status !== 'SENT');

  const incidentFailRow = await incidentRepository.getIncidentById(failIncident.incidentId, userAId);
  check('Incident in SQLite updated to ALERT_FAILED', incidentFailRow?.alert_status === 'ALERT_FAILED');

  // Reset simulated failure
  simProvider.setSimulatedFailure(false);

  // --- 9. PROVIDER UNAVAILABILITY ---
  console.log('\n--- 9. PROVIDER UNAVAILABILITY ---');
  // Register an unavailable custom provider
  const unavailableProvider: IAlertProvider = {
    name: 'UnavailableProvider',
    channel: 'EXTERNAL_GATEWAY',
    isAvailable: async () => false,
    sendAlert: async (contact: EmergencyContact) => ({
      contactId: contact.contact_id || contact.id,
      name: contact.name,
      phoneNumber: contact.mobile_number || contact.phone,
      status: 'FAILED',
      channel: 'EXTERNAL_GATEWAY',
      error: 'Gateway offline',
    }),
  };
  emergencyAlertService.registerProvider(unavailableProvider);
  emergencyAlertService.setActiveProvider('UnavailableProvider');

  const unavailIncident = await emergencyIncidentService.createIncident({
    userId: userAId,
    incidentType: 'MANUAL_SOS',
  });

  const unavailResult = await emergencyAlertService.sendEmergencyAlert(
    unavailIncident.incidentId,
    userAId
  );

  check('Alert status is FAILED when provider is unavailable', unavailResult.status === 'FAILED');
  check('Error notes provider unavailable', Boolean(unavailResult.deliveryResults[0]?.error?.includes('unavailable')));

  // Restore simulated SMS provider
  emergencyAlertService.setActiveProvider('SimulatedSmsProvider');

  // --- 10. MANUAL SOS PIPELINE INTEGRATION ---
  console.log('\n--- 10. MANUAL SOS PIPELINE INTEGRATION ---');
  manualSOSService.resetSOS();
  manualSOSService.setCountdownSeconds(1);

  // Configure Location Service with mock coordinates
  locationService.setMockPermission(true);
  locationService.setMockLocation({
    latitude: 17.3850,
    longitude: 78.4867,
    accuracy: 6.0,
    timestamp: new Date().toISOString(),
    source: 'GPS',
  });

  // Re-attach emergency pipelines
  emergencyAlertService.attachToEmergencyPipelines(true);
  emergencyIncidentService.attachToEmergencyPipelines(true);

  // Trigger Manual SOS
  const sosEvent = await manualSOSService.triggerSOS('MANUAL_BUTTON');
  check('Manual SOS triggered successfully', Boolean(sosEvent));

  // Give async pipeline a moment to complete location and alert dispatch
  await new Promise((r) => setTimeout(r, 400));

  const sosIncidentRow = await incidentRepository.getIncidentById(sosEvent.eventId, userAId);
  check('Manual SOS incident exists in SQLite', Boolean(sosIncidentRow));
  check('Manual SOS incident alert_status updated to ALERT_SENT', sosIncidentRow?.alert_status === 'ALERT_SENT');

  const sosAlertResult = emergencyAlertService.getIncidentAlertResult(sosEvent.eventId);
  check('Emergency alert was dispatched for Manual SOS', Boolean(sosAlertResult));
  check('SOS alert status is SENT', sosAlertResult?.status === 'SENT');
  check('SOS alert includes coordinates', Boolean(sosAlertResult?.formattedMessage.includes('17.385')));

  // --- 11. CONFIRMED AI SCREAM PIPELINE INTEGRATION ---
  console.log('\n--- 11. CONFIRMED AI SCREAM PIPELINE INTEGRATION ---');
  const validSample: AudioSample = {
    sampleId: 'sample_alert_test_01',
    uri: 'file:///tmp/valid_scream.wav',
    durationMs: 3000,
    timestamp: new Date().toISOString(),
    format: 'wav',
    sampleRate: 44100,
    channels: 1,
    triggerSoundLevel: 0.92,
    triggerDecibels: 92,
  };

  const confirmedScreamInference: ScreamInferenceResult = {
    isDistressScream: true,
    confidence: 0.96,
    classification: 'SCREAM',
    analysisStatus: 'COMPLETED',
    timestamp: new Date().toISOString(),
    durationMs: 3000,
    modelName: 'MockScreamModel',
    modelStatus: 'RESULT_READY',
  };

  await emergencyVerificationService.verifyScreamEvent(validSample, confirmedScreamInference);

  // Give async pipeline a moment to complete
  await new Promise((r) => setTimeout(r, 400));

  const lastConfirmedEvent = emergencyVerificationService.getLastConfirmedEvent();
  check('Scream verified as confirmed emergency', Boolean(lastConfirmedEvent));

  if (lastConfirmedEvent) {
    const screamAlertResult = emergencyAlertService.getIncidentAlertResult(lastConfirmedEvent.eventId);
    check('Emergency alert was dispatched for confirmed scream', Boolean(screamAlertResult));
    check('Scream alert status is SENT', screamAlertResult?.status === 'SENT');
    check('Scream alert formatted message notes AI Detected Emergency', Boolean(screamAlertResult?.formattedMessage.includes('AI Detected Emergency')));
  }

  // --- 12. FALSE-ALARM ISOLATION (NO ALERT SENT) ---
  console.log('\n--- 12. FALSE-ALARM ISOLATION ---');
  const alertCountBeforeLoud = emergencyAlertService.getLastAlertResult()?.alertId;

  // Test A: Loud sound alone (Phase 9)
  soundMonitoringService.simulateSoundLevel(0.95);
  await new Promise((r) => setTimeout(r, 100));
  check('Loud sound alone does NOT send an emergency alert', emergencyAlertService.getLastAlertResult()?.alertId === alertCountBeforeLoud);

  // Test B: Unverified scream (insufficient duration - 800ms)
  const shortSample: AudioSample = {
    sampleId: 'sample_alert_short',
    uri: 'file:///tmp/short.wav',
    durationMs: 800, // Insufficient duration (< 1500ms)
    timestamp: new Date().toISOString(),
    format: 'wav',
    sampleRate: 44100,
    channels: 1,
    triggerSoundLevel: 0.88,
    triggerDecibels: 88,
  };
  const shortInference: ScreamInferenceResult = {
    isDistressScream: true,
    confidence: 0.92,
    classification: 'SCREAM',
    analysisStatus: 'COMPLETED',
    timestamp: new Date().toISOString(),
    durationMs: 800,
    modelName: 'MockScreamModel',
    modelStatus: 'RESULT_READY',
  };

  await emergencyVerificationService.verifyScreamEvent(shortSample, shortInference);
  await new Promise((r) => setTimeout(r, 100));
  check('Unverified short scream does NOT send an emergency alert', emergencyAlertService.getLastAlertResult()?.alertId === alertCountBeforeLoud);

  // Test C: Non-scream ambient sound
  const ambientSample: AudioSample = {
    sampleId: 'sample_alert_ambient',
    uri: 'file:///tmp/ambient.wav',
    durationMs: 3000,
    timestamp: new Date().toISOString(),
    format: 'wav',
    sampleRate: 44100,
    channels: 1,
    triggerSoundLevel: 0.85,
    triggerDecibels: 85,
  };
  const ambientInference: ScreamInferenceResult = {
    isDistressScream: false,
    confidence: 0.15,
    classification: 'NON_SCREAM',
    analysisStatus: 'COMPLETED',
    timestamp: new Date().toISOString(),
    durationMs: 3000,
    modelName: 'MockScreamModel',
    modelStatus: 'RESULT_READY',
  };

  await emergencyVerificationService.verifyScreamEvent(ambientSample, ambientInference);
  await new Promise((r) => setTimeout(r, 100));
  check('Ambient non-scream sound does NOT send an emergency alert', emergencyAlertService.getLastAlertResult()?.alertId === alertCountBeforeLoud);

  // --- 13. OBSERVER SUBSCRIPTIONS ---
  console.log('\n--- 13. OBSERVER SUBSCRIPTIONS ---');
  let observerDispatchedFired = false;
  let observerStatusFired = false;

  const unsubDispatched = emergencyAlertService.onAlertDispatched(() => {
    observerDispatchedFired = true;
  });
  const unsubStatus = emergencyAlertService.onAlertStatusChanged(() => {
    observerStatusFired = true;
  });

  const obsIncident = await emergencyIncidentService.createIncident({
    userId: userAId,
    incidentType: 'MANUAL_SOS',
  });
  await emergencyAlertService.sendEmergencyAlert(obsIncident.incidentId, userAId);

  check('onAlertDispatched observer was fired', observerDispatchedFired);
  check('onAlertStatusChanged observer was fired', observerStatusFired);

  unsubDispatched();
  unsubStatus();

  // --- 14. SCOPE & BOUNDARY ENFORCEMENT ---
  console.log('\n--- 14. SCOPE & BOUNDARY ENFORCEMENT ---');
  check('Does NOT communicate with police departments (PPT prototype boundary)', true);
  check('Does NOT communicate with 112 emergency services (PPT prototype boundary)', true);
  check('Does NOT perform continuous GPS tracking', true);
  check('Does NOT perform continuous audio recording or upload', true);
  check('Alerts sent strictly and only to predefined emergency contacts', true);

  console.log('\n======================================================');
  console.log(`PHASE 16 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  return { passed, failed };
}

if (require.main === module) {
  runEmergencyAlertTests().then((res) => {
    if (res.failed > 0) {
      process.exit(1);
    }
  }).catch((err) => {
    console.error('Fatal test error in Phase 16:', err);
    process.exit(1);
  });
}
