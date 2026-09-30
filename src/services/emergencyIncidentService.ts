/**
 * LifeGuard AI — Emergency Incident Service (Phase 15)
 * 
 * Provides:
 * 1. Persistent emergency incident lifecycle management via SQLite.
 * 2. Strict User Isolation: Every query and mutation is filtered by authenticated user_id.
 * 3. Support for incident types: MANUAL_SOS and AI_DETECTED.
 * 4. Deduplication: Prevents duplicate incident creation from repeated taps or events within a cooldown window.
 * 5. Upstream Pipeline Integration:
 *    - Phase 12 Confirmed Scream Emergency -> AI_DETECTED incident.
 *    - Phase 13 Manual SOS Trigger -> MANUAL_SOS incident.
 *    - Phase 14 GPS Location -> Attached to incident record when available.
 * 6. Meaningful Pre-Alert Statuses: TRIGGERED, CONFIRMED, ALERT_PENDING, RESOLVED.
 *    (ALERT_SENT is strictly reserved for Phase 16 alert dispatch).
 * 7. Privacy & Security: Zero raw audio, zero passwords, location stored only for incidents.
 */

import {
  EmergencyIncident,
  CreateIncidentDTO,
  IncidentType,
  IncidentClassification,
  IncidentStatus,
  IncidentSource,
  ConfirmedEmergencyEvent,
  ManualSOSEvent,
  LocationData,
} from '../types';
import { incidentRepository } from '../database/incidentRepository';
import { EmergencyIncidentRow } from '../database/schema';
import { authService } from './AuthService';
import { emergencyVerificationService } from './EmergencyVerificationService';
import { manualSOSService } from './ManualSOSService';
import { locationService } from './LocationService';

type IncidentListener = (incident: EmergencyIncident) => void;

export class EmergencyIncidentService {
  // Deduplication cache: stores eventId -> creation timestamp
  private recentIncidents: Map<string, number> = new Map();
  private deduplicationWindowMs: number = 5000;

  // Observers
  private incidentCreatedListeners: Set<IncidentListener> = new Set();
  private incidentUpdatedListeners: Set<IncidentListener> = new Set();

  // Subscription handles to upstream services
  private emergencyVerificationSub: (() => void) | null = null;
  private manualSOSSub: (() => void) | null = null;
  private isAttached: boolean = false;

  constructor() {
    this.attachToEmergencyPipelines();
  }

  // ==========================================
  // 1. DATA MAPPING
  // ==========================================

  /**
   * Maps an SQLite EmergencyIncidentRow to a typed EmergencyIncident domain entity.
   */
  public mapRowToEntity(row: EmergencyIncidentRow): EmergencyIncident {
    let classification: IncidentClassification = 'UNCLASSIFIED';
    if (row.detection_result === 'SCREAM_VERIFIED' || row.detection_result === 'SCREAM') {
      classification = 'SCREAM';
    } else if (row.incident_type === 'MANUAL_SOS' || row.detection_result === 'MANUAL_USER_TRIGGER') {
      classification = 'MANUAL_SOS';
    } else if (row.detection_result === 'NON_SCREAM') {
      classification = 'NON_SCREAM';
    }

    let type: IncidentType = 'MANUAL_SOS';
    if (row.incident_type === 'AI_DETECTED' || row.incident_type === 'CONFIRMED_SCREAM') {
      type = 'AI_DETECTED';
    }

    return {
      incidentId: row.id,
      userId: row.user_id,
      incidentType: type,
      classification,
      status: (row.alert_status as IncidentStatus) || 'TRIGGERED',
      confidence: row.confidence ?? null,
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      locationAccuracy: row.accuracy ?? null,
      source: (row.source as IncidentSource) || (type === 'MANUAL_SOS' ? 'MANUAL_BUTTON' : 'AI_MICROPHONE_STREAM'),
      timestamp: row.timestamp,
      createdAt: row.created_at || row.timestamp,
    };
  }

  // ==========================================
  // 2. INCIDENT CREATION & PERSISTENCE
  // ==========================================

  /**
   * Creates and persists a new emergency incident with strict validation and deduplication.
   */
  public async createIncident(data: CreateIncidentDTO): Promise<EmergencyIncident> {
    // 1. Validate User ID
    if (!data.userId || typeof data.userId !== 'string' || data.userId.trim() === '') {
      throw new Error('Incident creation rejected: Valid authenticated userId is required.');
    }

    // 2. Validate Incident Type
    const rawType = data.incidentType;
    let incidentType: IncidentType = 'MANUAL_SOS';
    if (rawType === 'AI_DETECTED' || rawType === 'CONFIRMED_SCREAM') {
      incidentType = 'AI_DETECTED';
    } else if (rawType === 'MANUAL_SOS') {
      incidentType = 'MANUAL_SOS';
    } else {
      throw new Error(`Incident creation rejected: Invalid incidentType "${rawType}".`);
    }

    const id = data.id || data.incidentId || `inc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    // 3. Deduplication Check (Cache & Database)
    const existingRow = await incidentRepository.getIncidentById(id, data.userId);
    if (existingRow) {
      this.recentIncidents.set(id, now);
      if (data.latitude !== undefined && data.latitude !== null && existingRow.latitude === null) {
        const statusToKeep = ['ALERT_SENT', 'PARTIALLY_SENT', 'NO_CONTACTS', 'ALERT_FAILED', 'RESOLVED'].includes(existingRow.alert_status)
          ? existingRow.alert_status
          : 'ALERT_PENDING';
        await incidentRepository.updateIncidentLocation(
          id,
          data.userId,
          {
            latitude: data.latitude,
            longitude: data.longitude ?? null,
            accuracy: data.accuracy !== undefined ? data.accuracy : data.locationAccuracy ?? null,
          },
          statusToKeep
        );
        const updated = await incidentRepository.getIncidentById(id, data.userId);
        if (updated) return this.mapRowToEntity(updated);
      }
      return this.mapRowToEntity(existingRow);
    }
    if (this.recentIncidents.has(id)) {
      const existingTime = this.recentIncidents.get(id)!;
      if (now - existingTime < this.deduplicationWindowMs) {
        const row = await incidentRepository.getIncidentById(id, data.userId);
        if (row) return this.mapRowToEntity(row);
      }
    }

    // 4. Resolve default classification / detection result
    let detectionResult = data.detectionResult;
    if (!detectionResult) {
      if (data.classification === 'SCREAM' || incidentType === 'AI_DETECTED') {
        detectionResult = 'SCREAM_VERIFIED';
      } else {
        detectionResult = 'MANUAL_USER_TRIGGER';
      }
    }

    // 5. Resolve meaningful Pre-Alert Status
    // (Never claim ALERT_SENT at this stage since Phase 16 handles alert dispatch)
    let alertStatus = data.status || data.alertStatus;
    if (!alertStatus) {
      if (data.latitude !== undefined && data.latitude !== null) {
        alertStatus = 'ALERT_PENDING';
      } else {
        alertStatus = incidentType === 'AI_DETECTED' ? 'CONFIRMED' : 'TRIGGERED';
      }
    }

    // 6. Resolve Source
    let source = data.source;
    if (!source) {
      source = incidentType === 'MANUAL_SOS' ? 'MANUAL_BUTTON' : 'AI_MICROPHONE_STREAM';
    }

    const timestamp = data.timestamp || new Date().toISOString();
    const createdAt = data.createdAt || timestamp;
    const accuracy = data.accuracy !== undefined ? data.accuracy : data.locationAccuracy;

    // 7. Persist into SQLite Database via Repository
    const row = await incidentRepository.createIncident({
      id,
      userId: data.userId,
      incidentType,
      detectionResult,
      confidence: data.confidence,
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy,
      alertStatus,
      source,
      timestamp,
      createdAt,
    });

    // 8. Register in Deduplication Cache
    this.recentIncidents.set(id, now);
    this.purgeExpiredDedupeKeys(now);

    const entity = this.mapRowToEntity(row);

    // 9. Notify Observers
    this.notifyIncidentCreated(entity);

    return entity;
  }

  // ==========================================
  // 3. RETRIEVAL & USER ISOLATION
  // ==========================================

  /**
   * Retrieves a single incident by ID strictly isolated by the user's ID.
   * Never returns another user's incident records.
   */
  public async getIncidentById(incidentId: string, userId: string): Promise<EmergencyIncident | null> {
    if (!incidentId || !userId) {
      return null;
    }
    const row = await incidentRepository.getIncidentById(incidentId, userId);
    return row ? this.mapRowToEntity(row) : null;
  }

  /**
   * Retrieves all emergency incidents belonging to the specified user, ordered newest first.
   * Guarantees strict user isolation.
   */
  public async getUserIncidents(userId: string): Promise<EmergencyIncident[]> {
    if (!userId) {
      return [];
    }
    const rows = await incidentRepository.getIncidentsByUserId(userId);
    return rows.map((r) => this.mapRowToEntity(r));
  }

  /**
   * Retrieves user incident history with strict user isolation, ordered newest first.
   * Alias for getUserIncidents adhering to Phase 17 requirement.
   */
  public async getUserIncidentHistory(userId: string): Promise<EmergencyIncident[]> {
    return this.getUserIncidents(userId);
  }

  /**
   * Returns count of incidents for the specified user.
   */
  public async getIncidentCount(userId: string): Promise<number> {
    if (!userId) {
      return 0;
    }
    return incidentRepository.count(userId);
  }

  // ==========================================
  // 4. STATUS & LOCATION MUTATIONS
  // ==========================================

  /**
   * Updates an incident's status with user isolation.
   */
  public async updateIncidentStatus(
    incidentId: string,
    userId: string,
    status: IncidentStatus
  ): Promise<boolean> {
    if (!incidentId || !userId) {
      return false;
    }
    const success = await incidentRepository.updateIncidentStatus(incidentId, userId, status);
    if (success) {
      const updated = await this.getIncidentById(incidentId, userId);
      if (updated) {
        this.notifyIncidentUpdated(updated);
      }
    }
    return success;
  }

  /**
   * Updates an incident's GPS location with user isolation.
   */
  public async updateIncidentLocation(
    incidentId: string,
    userId: string,
    location: LocationData | { latitude: number | null; longitude: number | null; accuracy?: number | null },
    status: IncidentStatus = 'ALERT_PENDING'
  ): Promise<boolean> {
    if (!incidentId || !userId) {
      return false;
    }
    const existing = await incidentRepository.getIncidentById(incidentId, userId);
    let resolvedStatus: string = status;
    if (existing && ['ALERT_SENT', 'PARTIALLY_SENT', 'NO_CONTACTS', 'ALERT_FAILED', 'RESOLVED'].includes(existing.alert_status)) {
      resolvedStatus = existing.alert_status;
    }
    const success = await incidentRepository.updateIncidentLocation(
      incidentId,
      userId,
      {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      },
      resolvedStatus
    );
    if (success) {
      const updated = await this.getIncidentById(incidentId, userId);
      if (updated) {
        this.notifyIncidentUpdated(updated);
      }
    }
    return success;
  }

  /**
   * Deletes a specific incident for an authenticated user.
   */
  public async deleteIncident(incidentId: string, userId: string): Promise<boolean> {
    if (!incidentId || !userId) {
      return false;
    }
    return incidentRepository.deleteIncident(incidentId, userId);
  }

  /**
   * Clears all incident data for a user (used during account deletion / reset).
   */
  public async clearUserIncidentData(userId: string): Promise<boolean> {
    if (!userId) {
      return false;
    }
    return incidentRepository.clearIncidentsByUserId(userId);
  }

  // ==========================================
  // 5. EMERGENCY PIPELINE ATTACHMENT
  // ==========================================

  /**
   * Attaches to Phase 12 (Confirmed Emergency Scream) and Phase 13 (Manual SOS)
   * to automatically create and persist emergency incidents in SQLite.
   */
  public attachToEmergencyPipelines(force: boolean = false): void {
    if (this.isAttached && !force) return;

    if (this.emergencyVerificationSub) {
      this.emergencyVerificationSub();
      this.emergencyVerificationSub = null;
    }
    if (this.manualSOSSub) {
      this.manualSOSSub();
      this.manualSOSSub = null;
    }

    // Trigger A: Phase 12 Confirmed Scream Emergency
    this.emergencyVerificationSub = emergencyVerificationService.onEmergencyConfirmed(
      async (event: ConfirmedEmergencyEvent) => {
        try {
          const user = authService.getCurrentUser();
          const userId = user?.userId || user?.id || 'usr_anonymous';

          // Attempt to get location if available from Phase 14
          let loc: LocationData | null = locationService.getLastLocation();
          if (!loc) {
            try {
              const locRes = await locationService.getCurrentLocation({ timeoutMs: 3000 });
              if (locRes.success && locRes.location) {
                loc = locRes.location;
              }
            } catch {
              // Location acquisition failure does not block incident creation
            }
          }

          await this.createIncident({
            id: event.eventId,
            userId,
            incidentType: 'AI_DETECTED',
            classification: 'SCREAM',
            detectionResult: 'SCREAM_VERIFIED',
            confidence: event.confidence ?? null,
            latitude: loc?.latitude ?? null,
            longitude: loc?.longitude ?? null,
            accuracy: loc?.accuracy ?? null,
            status: loc ? 'ALERT_PENDING' : 'CONFIRMED',
            source: 'AI_MICROPHONE_STREAM',
            timestamp: event.timestamp,
          });
        } catch (err) {
          console.error('Failed to create incident from confirmed scream event:', err);
        }
      }
    );

    // Trigger B: Phase 13 Manual SOS Trigger
    this.manualSOSSub = manualSOSService.onSOSTriggered(async (event: ManualSOSEvent) => {
      try {
        let loc: LocationData | null = locationService.getLastLocation();
        if (!loc) {
          try {
            const locRes = await locationService.getCurrentLocation({ timeoutMs: 3000 });
            if (locRes.success && locRes.location) {
              loc = locRes.location;
            }
          } catch {
            // Location acquisition failure does not block incident creation
          }
        }

        // Check if incident already exists from manualSOSService.triggerSOS
        const existing = await incidentRepository.getIncidentById(event.eventId, event.userId);
        if (!existing) {
          await this.createIncident({
            id: event.eventId,
            userId: event.userId,
            incidentType: 'MANUAL_SOS',
            classification: 'MANUAL_SOS',
            detectionResult: 'MANUAL_USER_TRIGGER',
            latitude: loc?.latitude ?? null,
            longitude: loc?.longitude ?? null,
            accuracy: loc?.accuracy ?? null,
            status: loc ? 'ALERT_PENDING' : 'TRIGGERED',
            source: event.source || 'MANUAL_BUTTON',
            timestamp: event.timestamp,
          });
        } else if (loc) {
          await this.updateIncidentLocation(event.eventId, event.userId, loc, 'ALERT_PENDING');
        }
      } catch (err) {
        console.error('Failed to process manual SOS event in incident service:', err);
      }
    });

    this.isAttached = true;
  }

  // ==========================================
  // 6. OBSERVERS & CLEANUP
  // ==========================================

  public onIncidentCreated(callback: IncidentListener): () => void {
    this.incidentCreatedListeners.add(callback);
    return () => this.incidentCreatedListeners.delete(callback);
  }

  public onIncidentUpdated(callback: IncidentListener): () => void {
    this.incidentUpdatedListeners.add(callback);
    return () => this.incidentUpdatedListeners.delete(callback);
  }

  private notifyIncidentCreated(incident: EmergencyIncident): void {
    this.incidentCreatedListeners.forEach((listener) => {
      try {
        listener(incident);
      } catch (err) {
        console.warn('EmergencyIncidentService created listener error:', err);
      }
    });
  }

  private notifyIncidentUpdated(incident: EmergencyIncident): void {
    this.incidentUpdatedListeners.forEach((listener) => {
      try {
        listener(incident);
      } catch (err) {
        console.warn('EmergencyIncidentService updated listener error:', err);
      }
    });
  }

  private purgeExpiredDedupeKeys(now: number): void {
    for (const [key, timestamp] of this.recentIncidents.entries()) {
      if (now - timestamp > this.deduplicationWindowMs) {
        this.recentIncidents.delete(key);
      }
    }
  }

  public reset(): void {
    this.recentIncidents.clear();
  }

  public cleanup(): void {
    this.reset();
    this.incidentCreatedListeners.clear();
    this.incidentUpdatedListeners.clear();
    if (this.emergencyVerificationSub) {
      this.emergencyVerificationSub();
      this.emergencyVerificationSub = null;
    }
    if (this.manualSOSSub) {
      this.manualSOSSub();
      this.manualSOSSub = null;
    }
    this.isAttached = false;
  }
}

export const emergencyIncidentService = new EmergencyIncidentService();
