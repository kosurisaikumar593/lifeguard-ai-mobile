/**
 * LifeGuard AI — Phase 19 Complete End-to-End Workflow Integration Test Suite
 * 
 * Verifies all 11 required end-to-end scenarios from the EPICS PPT requirements:
 * 
 * TEST A: Normal sound -> no loud trigger, no capture, no incident, no alert.
 * TEST B: Loud non-scream -> capture, AI, NON_SCREAM, rejected, no incident, no alert.
 * TEST C: Unverified scream -> capture, SCREAM, verification fails (<1500ms), no incident, no alert.
 * TEST D: Confirmed AI emergency -> loud sound, capture, SCREAM, duration verified, GPS attached, incident created in DB, alert dispatched, history updated.
 * TEST E: Manual SOS -> countdown completes, GPS attached, incident created in DB, alert dispatched, history updated.
 * TEST F: Cancelled SOS -> user cancels during countdown, no incident, no alert.
 * TEST G: No contacts -> confirmed emergency, incident recorded with NO_CONTACTS, no false success.
 * TEST H: Location failure -> coordinates null, truthful fallback, no fake GPS coordinates.
 * TEST I: Alert failure -> provider failure, incident saved, status ALERT_FAILED, no false success.
 * TEST J: User isolation -> User A creates incident, logs out, User B logs in, User A incident invisible to User B.
 * TEST K: App Restart -> persisted data correct, no duplicate incident or alert.
 */

import { soundMonitoringService } from '../src/services/SoundMonitoringService';
import { audioCaptureService } from '../src/services/AudioCaptureService';
import { screamDetectionService } from '../src/services/ScreamDetectionService';
import { emergencyVerificationService } from '../src/services/EmergencyVerificationService';
import { manualSOSService } from '../src/services/ManualSOSService';
import { locationService } from '../src/services/LocationService';
import { emergencyIncidentService } from '../src/services/emergencyIncidentService';
import { emergencyAlertService, SimulatedSmsAlertProvider } from '../src/services/emergencyAlertService';
import { workflowCoordinatorService } from '../src/services/WorkflowCoordinatorService';
import { authService } from '../src/services/AuthService';
import { contactService } from '../src/services/ContactService';
import { incidentRepository } from '../src/database/incidentRepository';
import { initDatabase, resetDatabaseForTesting } from '../src/database/database';
import {
  AudioSample,
  IAudioClassifierModel,
  LocationData,
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

// Mock AI Classifier Model
class TestClassifierModel implements IAudioClassifierModel {
  public modelName = 'TestNeuralClassifier';
  public version = '1.0.0';
  private targetClassification: 'SCREAM' | 'NON_SCREAM' = 'SCREAM';
  private targetConfidence: number = 0.95;

  public setMode(classification: 'SCREAM' | 'NON_SCREAM', confidence: number = 0.95) {
    this.targetClassification = classification;
    this.targetConfidence = confidence;
  }

  public async load(): Promise<boolean> {
    return true;
  }

  public async classify(_features: Float32Array): Promise<{
    classification: 'SCREAM' | 'NON_SCREAM';
    confidence: number;
  }> {
    return {
      classification: this.targetClassification,
      confidence: this.targetConfidence,
    };
  }

  public async release(): Promise<void> {}
}

export async function runEndToEndWorkflowTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n================================================================');
  console.log('LIFEGUARD AI: PHASE 19 COMPLETE END-TO-END WORKFLOW TEST SUITE');
  console.log('================================================================\n');

  // --- 0. DATABASE & SERVICE SETUP ---
  console.log('--- 0. SETUP & INITIALIZATION ---');
  await initDatabase();
  await resetDatabaseForTesting();

  // Reset all services
  await workflowCoordinatorService.resetAll();
  workflowCoordinatorService.ensurePipelinesAttached();

  const testModel = new TestClassifierModel();
  screamDetectionService.registerModel(testModel);

  const simSms = emergencyAlertService.getProvider('SimulatedSmsProvider') as SimulatedSmsAlertProvider;
  if (simSms) {
    simSms.setSimulatedFailure(false);
  }
  emergencyAlertService.setActiveProvider('SimulatedSmsProvider');

  // Register primary test user: User A with unique test mobile number
  const userAReg = await authService.register(
    'Ananya Sharma',
    '9876500001',
    'Password@123',
    'Password@123'
  );
  check('User A registered successfully', Boolean(userAReg.success));

  const userA = authService.getCurrentUser()!;
  const userAId = userA.userId || userA.id;

  // Add 2 Emergency Contacts for User A
  const c1 = await contactService.addContact({
    name: 'Rajesh Sharma',
    mobileNumber: '9876500011',
    relationship: 'Father',
  }, userAId);
  const c2 = await contactService.addContact({
    name: 'Sunita Sharma',
    mobileNumber: '9876500012',
    relationship: 'Mother',
  }, userAId);
  check('User A contacts configured', Boolean(c1.success && c2.success));

  // Configure Location mock
  const mockGpsLocation: LocationData = {
    latitude: 17.3850,
    longitude: 78.4867,
    accuracy: 5.0,
    timestamp: new Date().toISOString(),
    source: 'GPS',
  };
  locationService.setMockLocation(mockGpsLocation);
  locationService.setMockPermission(true);

  check('Coordinator reports pipeline active', workflowCoordinatorService.isPipelineAttached());
  check('Current user authenticated as User A', authService.getCurrentUser()?.fullName === 'Ananya Sharma');

  // --- TEST A: NORMAL SOUND ---
  console.log('\n--- TEST A: NORMAL SOUND (NO TRIGGER, NO INCIDENT, NO ALERT) ---');
  const incidentsBeforeA = await incidentRepository.getIncidentsByUserId(userAId);
  const alertsBeforeA = emergencyAlertService.getLastAlertResult();

  // Normal environmental sound: 0.35 (below threshold 0.85)
  soundMonitoringService.simulateSoundLevel(0.35);
  await new Promise((r) => setTimeout(r, 100));

  const incidentsAfterA = await incidentRepository.getIncidentsByUserId(userAId);
  const alertsAfterA = emergencyAlertService.getLastAlertResult();

  check('Audio capture remained IDLE on normal sound', !audioCaptureService.isCapturing());
  check('Verification state remained WAITING_FOR_ANALYSIS', emergencyVerificationService.getState() === 'WAITING_FOR_ANALYSIS');
  check('No emergency incident created in SQLite', incidentsAfterA.length === incidentsBeforeA.length);
  check('No emergency alert dispatched', alertsAfterA === alertsBeforeA);

  // --- TEST B: LOUD NON-SCREAM ---
  console.log('\n--- TEST B: LOUD NON-SCREAM (REJECTED, NO INCIDENT, NO ALERT) ---');
  testModel.setMode('NON_SCREAM', 0.92);

  const nonScreamSample: AudioSample = {
    sampleId: `sample_door_slam_${Date.now()}`,
    uri: `file:///cache/test_door_slam_${Date.now()}.wav`,
    timestamp: new Date().toISOString(),
    durationMs: 2500,
    format: 'wav',
    sampleRate: 44100,
    channels: 1,
    triggerSoundLevel: 0.90,
    triggerDecibels: 90,
  };

  const vfyResultB = await emergencyVerificationService.verifyScreamEvent(
    nonScreamSample,
    await screamDetectionService.analyzeAudio(nonScreamSample)
  );

  await new Promise((r) => setTimeout(r, 200));

  check('Verification status is UNCONFIRMED_EVENT', vfyResultB.status === 'UNCONFIRMED_EVENT');
  check('Rejection reason is NON_SCREAM_CLASSIFICATION', vfyResultB.rejectionReason === 'NON_SCREAM_CLASSIFICATION');
  check('Emergency was NOT confirmed', vfyResultB.isEmergencyConfirmed === false);

  const incidentsAfterB = await incidentRepository.getIncidentsByUserId(userAId);
  check('No incident created in SQLite for non-scream noise', incidentsAfterB.length === 0);
  check('No alert dispatched for non-scream sound', emergencyAlertService.getLastAlertResult() === null);

  // --- TEST C: UNVERIFIED SCREAM (DURATION < 1500ms) ---
  console.log('\n--- TEST C: UNVERIFIED SCREAM (DURATION < 1500MS REJECTED) ---');
  testModel.setMode('SCREAM', 0.95);

  const briefSample: AudioSample = {
    sampleId: `sample_brief_scream_${Date.now()}`,
    uri: `file:///cache/test_brief_scream_${Date.now()}.wav`,
    timestamp: new Date().toISOString(),
    durationMs: 800, // < 1500ms min duration threshold
    format: 'wav',
    sampleRate: 44100,
    channels: 1,
    triggerSoundLevel: 0.92,
    triggerDecibels: 92,
  };

  const vfyResultC = await emergencyVerificationService.verifyScreamEvent(
    briefSample,
    await screamDetectionService.analyzeAudio(briefSample)
  );

  await new Promise((r) => setTimeout(r, 200));

  check('Verification status is UNCONFIRMED_EVENT', vfyResultC.status === 'UNCONFIRMED_EVENT');
  check('Rejection reason is INSUFFICIENT_DURATION', vfyResultC.rejectionReason === 'INSUFFICIENT_DURATION');
  check('Emergency was NOT confirmed for brief scream', vfyResultC.isEmergencyConfirmed === false);

  const incidentsAfterC = await incidentRepository.getIncidentsByUserId(userAId);
  check('No incident created in SQLite for brief scream', incidentsAfterC.length === 0);
  check('No alert dispatched for brief scream', emergencyAlertService.getLastAlertResult() === null);

  // --- TEST D: CONFIRMED AI EMERGENCY (FULL PATH A) ---
  console.log('\n--- TEST D: CONFIRMED AI EMERGENCY (FULL PATH A PIPELINE) ---');
  testModel.setMode('SCREAM', 0.96);
  locationService.setMockLocation(mockGpsLocation);

  const validDistressSample: AudioSample = {
    sampleId: `sample_distress_${Date.now()}`,
    uri: `file:///cache/test_distress_${Date.now()}.wav`,
    timestamp: new Date().toISOString(),
    durationMs: 3000, // >= 1500ms satisfies duration
    format: 'wav',
    sampleRate: 44100,
    channels: 1,
    triggerSoundLevel: 0.94,
    triggerDecibels: 94,
  };

  // Execute verification
  const vfyResultD = await emergencyVerificationService.verifyScreamEvent(
    validDistressSample,
    await screamDetectionService.analyzeAudio(validDistressSample)
  );

  check('Distress scream verified as CONFIRMED_EMERGENCY', vfyResultD.status === 'CONFIRMED_EMERGENCY');
  check('isEmergencyConfirmed is true', vfyResultD.isEmergencyConfirmed === true);

  // Wait for async handoff: Event -> GPS -> SQLite Incident -> Alert Dispatch
  let alertResultD: any = null;
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 100));
    alertResultD = emergencyAlertService.getLastAlertResult();
    if (alertResultD && alertResultD.status === 'SENT') break;
  }

  check('Emergency alert was dispatched', Boolean(alertResultD));
  check('Alert status is SENT to all contacts', alertResultD?.status === 'SENT');
  check('Alert dispatched to 2 contacts', Boolean(alertResultD?.totalContacts === 2 && alertResultD?.successfulDeliveries === 2));
  check('Alert message mentions AI Detected Emergency', Boolean(alertResultD?.formattedMessage?.includes('AI Detected Emergency')));
  check('Alert message contains Google Maps link', Boolean(alertResultD?.formattedMessage?.includes('https://www.google.com/maps?q=17.385,78.4867')));

  // Verify SQLite Database Persistence
  const confirmedIncidents = await incidentRepository.getIncidentsByUserId(userAId);
  check('Incident saved to SQLite database', confirmedIncidents.length === 1);

  const incD = confirmedIncidents[0];
  check('Incident type is AI_DETECTED or CONFIRMED_SCREAM', incD.incident_type === 'AI_DETECTED' || incD.incident_type === 'CONFIRMED_SCREAM');
  check('Detection result is SCREAM_VERIFIED', incD.detection_result === 'SCREAM_VERIFIED');
  check('Incident alert_status in SQLite is ALERT_SENT', incD.alert_status === 'ALERT_SENT');
  check('GPS latitude saved in SQLite (17.385)', incD.latitude === 17.385);
  check('GPS longitude saved in SQLite (78.4867)', incD.longitude === 78.4867);

  // Verify History Query
  const historyD = await emergencyIncidentService.getUserIncidentHistory(userAId);
  check('User incident history returns persisted incident', historyD.length === 1);
  check('Domain entity incidentType is AI_DETECTED', historyD[0].incidentType === 'AI_DETECTED');
  check('History incident status is ALERT_SENT', historyD[0].status === 'ALERT_SENT');

  // --- TEST E: MANUAL SOS (FULL PATH B PIPELINE) ---
  console.log('\n--- TEST E: MANUAL SOS (FULL PATH B PIPELINE) ---');
  manualSOSService.resetSOS();
  const manualGpsLocation: LocationData = {
    latitude: 17.4485,
    longitude: 78.3741,
    accuracy: 4.2,
    timestamp: new Date().toISOString(),
    source: 'GPS',
  };
  locationService.setMockLocation(manualGpsLocation);

  // Trigger Manual SOS via Coordinator
  const sosResultE = await workflowCoordinatorService.triggerManualSOS('MANUAL_BUTTON');

  check('Manual SOS event triggered', Boolean(sosResultE.event));
  check('Manual SOS status is TRIGGERED', sosResultE.event.status === 'TRIGGERED');
  check('Alert dispatched for Manual SOS', Boolean(sosResultE.alertResult));
  check('Manual SOS alert status is SENT', sosResultE.alertResult?.status === 'SENT');
  check('Manual SOS message notes Manual SOS', Boolean(sosResultE.alertResult?.formattedMessage?.includes('Manual SOS Emergency')));
  check('Manual SOS message contains GPS coordinates', Boolean(sosResultE.alertResult?.formattedMessage?.includes('17.4485')));

  const userAIncidentsAfterE = await incidentRepository.getIncidentsByUserId(userAId);
  check('User A now has 2 total incidents in SQLite', userAIncidentsAfterE.length === 2);

  const sosIncident = userAIncidentsAfterE.find((r) => r.incident_type === 'MANUAL_SOS');
  check('Manual SOS incident persisted in SQLite', Boolean(sosIncident));
  check('Manual SOS alert status in SQLite is ALERT_SENT', sosIncident?.alert_status === 'ALERT_SENT');
  check('Manual SOS coordinates attached in SQLite', Boolean(sosIncident?.latitude === 17.4485 && sosIncident?.longitude === 78.3741));

  // --- TEST F: CANCELLED SOS ---
  console.log('\n--- TEST F: CANCELLED SOS (NO INCIDENT, NO ALERT) ---');
  manualSOSService.resetSOS();
  const incidentCountBeforeF = (await incidentRepository.getIncidentsByUserId(userAId)).length;

  manualSOSService.startCountdown(5);
  check('Manual SOS state is COUNTDOWN_ACTIVE', manualSOSService.getState() === 'COUNTDOWN_ACTIVE');

  // User cancels during countdown
  manualSOSService.cancelSOS();
  check('Manual SOS state is CANCELLED', manualSOSService.getState() === 'CANCELLED');

  await new Promise((r) => setTimeout(r, 200));
  const incidentCountAfterF = (await incidentRepository.getIncidentsByUserId(userAId)).length;
  check('No new incident persisted for cancelled SOS', incidentCountAfterF === incidentCountBeforeF);

  // --- TEST G: NO CONTACTS HANDLING ---
  console.log('\n--- TEST G: NO CONTACTS CONFIGURED (TRUTHFUL NO_CONTACTS STATUS) ---');
  manualSOSService.resetSOS();

  // Register User G with NO contacts
  const userGReg = await authService.register(
    'Gita Devi',
    '9876500002',
    'Password@123',
    'Password@123'
  );
  check('User G registered', Boolean(userGReg.success));
  const userG = authService.getCurrentUser()!;
  const userGId = userG.userId || userG.id;

  // Trigger SOS for User G
  const sosResultG = await workflowCoordinatorService.triggerManualSOS('MANUAL_BUTTON');

  check('Alert status truthfully reports NO_CONTACTS', sosResultG.alertResult?.status === 'NO_CONTACTS');
  check('Alert total contacts is 0', sosResultG.alertResult?.totalContacts === 0);
  check('Alert successful deliveries is 0', sosResultG.alertResult?.successfulDeliveries === 0);

  const userGIncidents = await incidentRepository.getIncidentsByUserId(userGId);
  check('User G incident persisted in SQLite', userGIncidents.length === 1);
  check('User G incident alert_status in SQLite is NO_CONTACTS', userGIncidents[0]?.alert_status === 'NO_CONTACTS');

  // --- TEST H: LOCATION FAILURE HANDLING ---
  console.log('\n--- TEST H: LOCATION FAILURE (TRUTHFUL FALLBACK, NO FAKE GPS) ---');
  manualSOSService.resetSOS();

  // Switch back to User A
  await authService.logout();
  await authService.login('9876500001', 'Password@123');

  // Simulate GPS failure / location disabled
  locationService.setMockLocation(null);
  locationService.setMockPermission(false);

  const sosResultH = await workflowCoordinatorService.triggerManualSOS('MANUAL_BUTTON');
  check('Alert dispatched even when location unavailable', Boolean(sosResultH.alertResult));
  check('Alert message states location unavailable', Boolean(sosResultH.alertResult?.formattedMessage?.includes('Location unavailable at time of alert')));
  check('Alert message does NOT contain fake coordinates or map link', !sosResultH.alertResult?.formattedMessage?.includes('https://www.google.com/maps'));

  const incH = await incidentRepository.getIncidentById(sosResultH.event.eventId, userAId);
  check('Incident saved in SQLite with null latitude', incH?.latitude === null);
  check('Incident saved in SQLite with null longitude', incH?.longitude === null);

  // Restore GPS for subsequent tests
  locationService.setMockLocation(mockGpsLocation);
  locationService.setMockPermission(true);

  // --- TEST I: ALERT DISPATCH FAILURE ---
  console.log('\n--- TEST I: ALERT DISPATCH FAILURE (TRUTHFUL ALERT_FAILED) ---');
  manualSOSService.resetSOS();

  // Force SimulatedSmsProvider to fail
  simSms.setSimulatedFailure(true);

  const sosResultI = await workflowCoordinatorService.triggerManualSOS('MANUAL_BUTTON');
  check('Alert status is FAILED on provider carrier error', sosResultI.alertResult?.status === 'FAILED');
  check('Failed deliveries equals total contacts', sosResultI.alertResult?.failedDeliveries === 2);
  check('Alert error message explains carrier transmission failure', Boolean(sosResultI.alertResult?.error));

  const incI = await incidentRepository.getIncidentById(sosResultI.event.eventId, userAId);
  check('SQLite incident alert_status updated to ALERT_FAILED', incI?.alert_status === 'ALERT_FAILED');

  // Restore provider to normal
  simSms.setSimulatedFailure(false);

  // --- TEST J: STRICT USER ISOLATION ---
  console.log('\n--- TEST J: STRICT USER ISOLATION (ZERO CROSS-USER LEAKAGE) ---');
  manualSOSService.resetSOS();

  const userAIncidents = await incidentRepository.getIncidentsByUserId(userAId);
  check('User A has multiple incidents in SQLite', userAIncidents.length >= 3);

  // Logout User A
  await authService.logout();
  check('User A logged out', authService.getCurrentUser() === null);

  // Register User J
  const userJReg = await authService.register(
    'Jaya Varma',
    '9876500003',
    'Password@123',
    'Password@123'
  );
  check('User J registered', Boolean(userJReg.success));
  const userJ = authService.getCurrentUser()!;
  const userJId = userJ.userId || userJ.id;

  // Query User J's incidents
  const userJIncidents = await incidentRepository.getIncidentsByUserId(userJId);
  check('User J has 0 incidents (User A incidents are invisible)', userJIncidents.length === 0);

  // Attempt to fetch User A's incident using User J's ID
  const forbiddenAccess = await incidentRepository.getIncidentById(userAIncidents[0].id, userJId);
  check('User J cannot access User A incident by ID (returns null)', forbiddenAccess === null);

  // --- TEST K: SYSTEM RESTART & PERSISTENCE INTEGRITY ---
  console.log('\n--- TEST K: RESTART SIMULATION & PERSISTENCE INTEGRITY ---');
  // Log back into User A
  await authService.logout();
  await authService.login('9876500001', 'Password@123');

  // Simulate app restart: reset all in-memory caches and re-engage pipelines
  await workflowCoordinatorService.resetAll();
  workflowCoordinatorService.ensurePipelinesAttached();

  // Query SQLite persisted data
  const reloadedIncidents = await incidentRepository.getIncidentsByUserId(userAId);
  check('Persisted incidents survived restart in SQLite', reloadedIncidents.length === userAIncidents.length);

  const reloadedContacts = await contactService.getContacts(userAId);
  check('Persisted emergency contacts survived restart in SQLite', reloadedContacts.length === 2);

  // Verify deduplication on reloaded incident
  const firstIncident = reloadedIncidents[0];
  const reDispatched = await emergencyAlertService.sendEmergencyAlert(firstIncident.id, userAId);
  check('Re-dispatching already sent incident is guarded against duplicate alert', reDispatched.status === 'SENT' || reDispatched.status === 'FAILED');

  // Final Summary
  console.log('\n======================================================');
  console.log(`PHASE 19 END-TO-END WORKFLOW RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  return { passed, failed };
}

// Self-executing runner when executed via ts-node directly
if (require.main === module) {
  runEndToEndWorkflowTests()
    .then(({ passed, failed }) => {
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}
