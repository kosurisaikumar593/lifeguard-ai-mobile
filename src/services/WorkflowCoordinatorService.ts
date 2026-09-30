/**
 * LifeGuard AI — Workflow Coordinator Service (Phase 19)
 * 
 * Central coordinator orchestrating complete end-to-end emergency workflows:
 * 
 * PATH A — AI-DETECTED DISTRESS WORKFLOW:
 *   Authenticated User
 *     ↓
 *   Sound Monitoring (Microphone stream & dB measurement)
 *     ↓ (Loud sound detected above threshold)
 *   Temporary Audio Capture (strictly bounded, auto-cleansed)
 *     ↓ (Audio sample delivered)
 *   AI/ML Audio Analysis (MFCC extraction + Model classification)
 *     ↓ (Classified as SCREAM)
 *   False-Alarm & Duration Verification (>= 1500ms duration check)
 *     ↓ (CONFIRMED_EMERGENCY)
 *   GPS Location Acquisition (Current latitude/longitude/accuracy)
 *     ↓
 *   SQLite Incident Persistence (emergency_incidents table, user isolated)
 *     ↓
 *   Emergency Alert Dispatch (Sent to predefined emergency contacts only)
 *     ↓
 *   Alert & Incident History (Live history reflecting delivery status)
 * 
 * PATH B — MANUAL SOS WORKFLOW:
 *   Authenticated User
 *     ↓
 *   Manual SOS Button Activation
 *     ↓ (5s Countdown with Cancellation Window)
 *   MANUAL_SOS Triggered
 *     ↓
 *   GPS Location Acquisition (Current coordinates)
 *     ↓
 *   SQLite Incident Persistence (emergency_incidents table, user isolated)
 *     ↓
 *   Emergency Alert Dispatch (Sent to predefined emergency contacts only)
 *     ↓
 *   Alert & Incident History (Live history reflecting delivery status)
 * 
 * Strict Scope Guarantees:
 * - Mobile app only.
 * - ZERO communication with police or 112 emergency services.
 * - ZERO continuous audio recording or persistent audio storage.
 * - ZERO continuous GPS tracking (on-demand during verified emergencies only).
 * - Truthful statuses (no fake success, no fake coordinates).
 * - Strict user isolation for all data.
 */

import { soundMonitoringService } from './SoundMonitoringService';
import { audioCaptureService } from './AudioCaptureService';
import { screamDetectionService } from './ScreamDetectionService';
import { emergencyVerificationService } from './EmergencyVerificationService';
import { manualSOSService } from './ManualSOSService';
import { locationService } from './LocationService';
import { emergencyIncidentService } from './emergencyIncidentService';
import { emergencyAlertService } from './emergencyAlertService';
import { authService } from './AuthService';
import { contactService } from './ContactService';
import {
  EmergencyIncident,
  EmergencyAlertResult,
  LocationData,
  ManualSOSEvent,
  ConfirmedEmergencyEvent,
} from '../types';

export interface PipelineStatus {
  isMonitoring: boolean;
  isAudioPipelineAttached: boolean;
  isCapturing: boolean;
  modelStatus: string;
  verificationState: string;
  sosState: string;
  hasLastLocation: boolean;
  activeAlertProvider: string;
  autoDispatchEnabled: boolean;
  authenticatedUserId: string | null;
}

export class WorkflowCoordinatorService {
  private isPipelineActive: boolean = false;

  constructor() {
    this.ensurePipelinesAttached();
  }

  // ==========================================
  // 1. PIPELINE ATTACHMENT & ORCHESTRATION
  // ==========================================

  /**
   * Connects all autonomous pipeline hooks from Sound Monitoring all the way to Alert Dispatch.
   */
  public ensurePipelinesAttached(): void {
    // 1. Connect Sound Monitoring -> Audio Capture
    audioCaptureService.attachToSoundMonitoring();

    // 2. Connect Audio Capture -> AI Inference -> Duration Verification
    emergencyVerificationService.attachToAudioPipeline();

    // 3. Connect Verification & Manual SOS -> Incident Database
    emergencyIncidentService.attachToEmergencyPipelines(true);

    // 4. Connect Verification & Manual SOS -> Emergency Alert Dispatch
    emergencyAlertService.attachToEmergencyPipelines(true);

    this.isPipelineActive = true;
  }

  /**
   * Detaches automatic pipeline hooks.
   */
  public detachPipelines(): void {
    audioCaptureService.detachFromSoundMonitoring();
    emergencyVerificationService.detachFromAudioPipeline();
    this.isPipelineActive = false;
  }

  public isPipelineAttached(): boolean {
    return this.isPipelineActive && emergencyVerificationService.isAttachedToAudioPipeline();
  }

  // ==========================================
  // 2. WORKFLOW EXECUTION HELPERS
  // ==========================================

  /**
   * Starts real-time sound monitoring with the complete automated pipeline engaged.
   */
  public async startAutonomousMonitoring(): Promise<{ success: boolean; error?: string }> {
    this.ensurePipelinesAttached();
    return soundMonitoringService.startMonitoring();
  }

  /**
   * Stops real-time sound monitoring.
   */
  public async stopAutonomousMonitoring(): Promise<void> {
    await soundMonitoringService.stopMonitoring();
  }

  /**
   * Triggers Manual SOS workflow:
   * Starts countdown, then triggers incident creation, GPS fetch, alert dispatch, and SQLite storage.
   */
  public async triggerManualSOS(source: 'MANUAL_BUTTON' | 'DASHBOARD_SOS' | 'TAB_SOS' = 'MANUAL_BUTTON'): Promise<{
    event: ManualSOSEvent;
    incident: EmergencyIncident | null;
    alertResult: EmergencyAlertResult | null;
  }> {
    const user = authService.getCurrentUser();
    if (!user) {
      throw new Error('Authentication required: Cannot trigger SOS while logged out.');
    }

    // 1. Trigger SOS domain event
    const event = await manualSOSService.triggerSOS(source);

    // 2. Allow async pipelines (location + incident + alert) to complete
    const userId = user.userId || user.id;

    // Wait for alert result
    let alertResult = emergencyAlertService.getLastAlertResult();
    let retries = 0;
    while ((!alertResult || alertResult.incidentId !== event.eventId) && retries < 25) {
      await new Promise((r) => setTimeout(r, 100));
      alertResult = emergencyAlertService.getIncidentAlertResult(event.eventId);
      retries++;
    }

    const incident = await emergencyIncidentService.getIncidentById(event.eventId, userId);

    return {
      event,
      incident,
      alertResult,
    };
  }

  /**
   * Cancels an in-progress SOS countdown.
   */
  public cancelManualSOS(): void {
    manualSOSService.cancelSOS();
  }

  // ==========================================
  // 3. PIPELINE STATUS & DIAGNOSTICS
  // ==========================================

  public getPipelineStatus(): PipelineStatus {
    const user = authService.getCurrentUser();
    return {
      isMonitoring: soundMonitoringService.isMonitoringActive(),
      isAudioPipelineAttached: this.isPipelineAttached(),
      isCapturing: audioCaptureService.isCapturing(),
      modelStatus: screamDetectionService.getModelStatus(),
      verificationState: emergencyVerificationService.getState(),
      sosState: manualSOSService.getState(),
      hasLastLocation: locationService.getLastLocation() !== null,
      activeAlertProvider: emergencyAlertService.getActiveProviderName(),
      autoDispatchEnabled: emergencyAlertService.isAutoDispatchEnabled(),
      authenticatedUserId: user?.userId || user?.id || null,
    };
  }

  /**
   * Resets all pipeline states for testing or logout.
   */
  public async resetAll(): Promise<void> {
    await soundMonitoringService.stopMonitoring().catch(() => {});
    if (audioCaptureService.isCapturing()) {
      await audioCaptureService.stopCapture().catch(() => {});
    }
    audioCaptureService.resetForTesting();
    emergencyVerificationService.resetVerification();
    manualSOSService.resetSOS();
    emergencyIncidentService.reset();
    emergencyAlertService.reset();
  }
}

export const workflowCoordinatorService = new WorkflowCoordinatorService();
