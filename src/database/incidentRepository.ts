/**
 * LifeGuard AI — Incident Repository (Phase 13)
 * 
 * Manages persistence for emergency incidents (including Manual SOS events and confirmed scream detections)
 * using SQLite, strictly maintaining user isolation via user_id.
 */

import { getDatabase } from './database';
import { EmergencyIncidentRow } from './schema';

export class IncidentRepository {
  /**
   * Generates a unique sequential incident ID (e.g. inc_...)
   */
  private generateIncidentId(): string {
    const timestamp = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 6);
    return `inc_${timestamp}_${rand}`;
  }

  /**
   * Persists a new emergency incident into SQLite.
   */
  async createIncident(data: {
    id?: string;
    userId: string;
    incidentType: string;
    detectionResult: string;
    confidence?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    accuracy?: number | null;
    alertStatus: string;
    source?: string | null;
    timestamp?: string;
    createdAt?: string | null;
  }): Promise<EmergencyIncidentRow> {
    if (!data.userId) {
      throw new Error('Cannot create incident: userId is required.');
    }

    const db = await getDatabase();
    const id = data.id || this.generateIncidentId();
    const timestamp = data.timestamp || new Date().toISOString();
    const createdAt = data.createdAt || timestamp;
    const source = data.source || 'SYSTEM';
    const confidence = data.confidence !== undefined ? data.confidence : null;
    const latitude = data.latitude !== undefined ? data.latitude : null;
    const longitude = data.longitude !== undefined ? data.longitude : null;
    const accuracy = data.accuracy !== undefined ? data.accuracy : null;

    await db.runAsync(
      `INSERT INTO emergency_incidents (id, user_id, incident_type, detection_result, confidence, latitude, longitude, accuracy, alert_status, source, timestamp, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.userId,
        data.incidentType,
        data.detectionResult,
        confidence,
        latitude,
        longitude,
        accuracy,
        data.alertStatus,
        source,
        timestamp,
        createdAt,
      ]
    );

    return {
      id,
      user_id: data.userId,
      incident_type: data.incidentType,
      detection_result: data.detectionResult,
      confidence,
      latitude,
      longitude,
      accuracy,
      alert_status: data.alertStatus,
      source,
      timestamp,
      created_at: createdAt,
    };
  }

  /**
   * Retrieves all incidents for the specified user, ordered newest first.
   */
  async getIncidentsByUserId(userId: string): Promise<EmergencyIncidentRow[]> {
    if (!userId) return [];
    const db = await getDatabase();
    return db.getAllAsync<EmergencyIncidentRow>(
      `SELECT id, user_id, incident_type, detection_result, confidence, latitude, longitude, accuracy, alert_status, source, timestamp, created_at
       FROM emergency_incidents
       WHERE user_id = ?
       ORDER BY timestamp DESC`,
      [userId]
    );
  }

  /**
   * Retrieves a single incident by ID and userId.
   */
  async getIncidentById(id: string, userId: string): Promise<EmergencyIncidentRow | null> {
    if (!id || !userId) return null;
    const db = await getDatabase();
    return db.getFirstAsync<EmergencyIncidentRow>(
      `SELECT id, user_id, incident_type, detection_result, confidence, latitude, longitude, accuracy, alert_status, source, timestamp, created_at
       FROM emergency_incidents
       WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
  }

  /**
   * Returns count of incidents for a user.
   */
  async count(userId: string): Promise<number> {
    if (!userId) return 0;
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM emergency_incidents WHERE user_id = ?`,
      [userId]
    );
    return result?.count || 0;
  }

  /**
   * Updates an incident's alert status in SQLite.
   */
  async updateIncidentStatus(
    id: string,
    userId: string,
    alertStatus: string
  ): Promise<boolean> {
    if (!id || !userId) return false;
    const db = await getDatabase();
    const result = await db.runAsync(
      `UPDATE emergency_incidents
       SET alert_status = ?
       WHERE id = ? AND user_id = ?`,
      [alertStatus, id, userId]
    );
    return result.changes > 0;
  }

  /**
   * Updates an incident's GPS coordinates and alert status in SQLite.
   */
  async updateIncidentLocation(
    id: string,
    userId: string,
    location: {
      latitude: number | null;
      longitude: number | null;
      accuracy?: number | null;
    },
    alertStatus: string = 'LOCATION_ATTACHED'
  ): Promise<boolean> {
    if (!id || !userId) return false;
    const db = await getDatabase();
    const result = await db.runAsync(
      `UPDATE emergency_incidents
       SET latitude = ?, longitude = ?, accuracy = ?, alert_status = ?
       WHERE id = ? AND user_id = ?`,
      [
        location.latitude,
        location.longitude,
        location.accuracy !== undefined ? location.accuracy : null,
        alertStatus,
        id,
        userId,
      ]
    );
    return result.changes > 0;
  }

  /**
   * Deletes a specific incident for a user.
   */
  async deleteIncident(id: string, userId: string): Promise<boolean> {
    if (!id || !userId) return false;
    const db = await getDatabase();
    const result = await db.runAsync(
      `DELETE FROM emergency_incidents WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    return result.changes > 0;
  }

  /**
   * Clears all incidents for a specific user (e.g. on account deletion).
   */
  async clearIncidentsByUserId(userId: string): Promise<boolean> {
    if (!userId) return false;
    const db = await getDatabase();
    const result = await db.runAsync(
      `DELETE FROM emergency_incidents WHERE user_id = ?`,
      [userId]
    );
    return result.changes > 0;
  }

  /**
   * Clears all incidents (used for testing).
   */
  async clearAll(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM emergency_incidents`);
  }
}

export const incidentRepository = new IncidentRepository();

