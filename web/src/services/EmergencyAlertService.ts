/**
 * LifeGuard AI Web — Standalone App-to-App Emergency Alert Service
 * 
 * Replaces external third-party messaging (WhatsApp) with a direct app-to-app alert protocol.
 * Simulates high-priority real-time alerting between connected contacts, tracking:
 * - Recipient connection state: "Connected" | "Pending"
 * - Real-time alert delivery status: "Sending" -> "Delivered" -> "Acknowledged"
 * - GPS payload with interactive map link
 */

import {
  EmergencyContact,
  GPSLocation,
  UserProfile,
  AppAlertPayload,
  AppAlertRecipient,
} from '../types';

export type AlertUpdateCallback = (payload: AppAlertPayload | null) => void;

const ACTIVE_ALERT_KEY = 'lifeguard_active_app_alert';
const ALERTS_HISTORY_KEY = 'lifeguard_app_alerts_history';

export class EmergencyAlertService {
  private activeAlert: AppAlertPayload | null = null;
  private listeners: Set<AlertUpdateCallback> = new Set();
  private timers: any[] = [];

  constructor() {
    this.restoreActiveAlert();
  }

  private restoreActiveAlert() {
    try {
      const saved = localStorage.getItem(ACTIVE_ALERT_KEY);
      if (saved) {
        this.activeAlert = JSON.parse(saved);
      }
    } catch (e) {
      // ignore JSON parse errors
    }
  }

  public getActiveAlert(): AppAlertPayload | null {
    return this.activeAlert;
  }

  public subscribe(callback: AlertUpdateCallback): () => void {
    this.listeners.add(callback);
    callback(this.activeAlert);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    try {
      if (this.activeAlert) {
        localStorage.setItem(ACTIVE_ALERT_KEY, JSON.stringify(this.activeAlert));
      } else {
        localStorage.removeItem(ACTIVE_ALERT_KEY);
      }
    } catch (e) {}

    this.listeners.forEach((cb) => cb(this.activeAlert ? { ...this.activeAlert } : null));
  }

  /**
   * Dispatches a direct app-to-app emergency alert payload to all registered contacts
   */
  public dispatchAlert(params: {
    user: UserProfile;
    contacts: EmergencyContact[];
    type: 'AI_DISTRESS' | 'MANUAL_SOS' | 'LOCATION_SHARE';
    soundLevel?: number;
    decibels?: number;
    location?: GPSLocation | null;
    customNote?: string;
  }): AppAlertPayload {
    // Clear any previous simulation timers
    this.clearTimers();

    const incidentId = `inc_${Date.now()}`;
    const alertId = `alt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Build recipient list from connected contacts
    const recipients: AppAlertRecipient[] = params.contacts.length > 0
      ? params.contacts.map((c, index) => ({
          contactId: c.id,
          name: c.name,
          phoneNumber: c.phoneNumber,
          connectionState: c.connectionState || (index === 0 ? 'Connected' : 'Pending'),
          deliveryStatus: 'Sending',
        }))
      : [
          // Fallback if no contacts registered
          {
            contactId: 'cnt_fallback_primary',
            name: 'Emergency Services / Primary Contact',
            phoneNumber: '+91 98765 43211',
            connectionState: 'Connected',
            deliveryStatus: 'Sending',
          },
        ];

    const mapUrl = params.location
      ? `https://maps.google.com/?q=${params.location.latitude},${params.location.longitude}`
      : 'https://maps.google.com';

    const payload: AppAlertPayload = {
      id: alertId,
      incidentId,
      senderId: params.user.id,
      senderName: params.user.fullName,
      senderPhone: params.user.mobileNumber,
      timestamp: new Date().toISOString(),
      type: params.type,
      soundLevel: params.soundLevel,
      decibels: params.decibels,
      location: params.location || null,
      mapUrl,
      overallStatus: 'SENDING',
      recipients,
    };

    this.activeAlert = payload;
    this.saveToHistory(payload);
    this.notify();

    // Step 1: Simulate network transit -> DELIVERED after 500ms
    const t1 = setTimeout(() => {
      if (!this.activeAlert || this.activeAlert.id !== alertId) return;

      this.activeAlert.overallStatus = 'DELIVERED';
      this.activeAlert.recipients = this.activeAlert.recipients.map((r) => {
        if (r.connectionState === 'Connected') {
          return { ...r, deliveryStatus: 'Delivered' };
        }
        return r;
      });
      this.notify();
    }, 500);
    this.timers.push(t1);

    // Step 2: Simulate real-time ACKNOWLEDGEMENT from connected contacts after 2.8s
    const t2 = setTimeout(() => {
      if (!this.activeAlert || this.activeAlert.id !== alertId) return;

      this.activeAlert.overallStatus = 'ACKNOWLEDGED';
      this.activeAlert.recipients = this.activeAlert.recipients.map((r, idx) => {
        if (r.connectionState === 'Connected' || idx === 0) {
          return {
            ...r,
            deliveryStatus: 'Acknowledged',
            acknowledgedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            responseNote: 'Acknowledged: Help is on the way. Keep your phone active.',
          };
        }
        return r;
      });
      this.saveToHistory(this.activeAlert);
      this.notify();
    }, 2800);
    this.timers.push(t2);

    return payload;
  }

  /**
   * Manually acknowledge an active alert (for demo and recipient simulation)
   */
  public acknowledgeActiveAlert(contactId?: string) {
    if (!this.activeAlert) return;

    this.activeAlert.overallStatus = 'ACKNOWLEDGED';
    this.activeAlert.recipients = this.activeAlert.recipients.map((r) => {
      if (!contactId || r.contactId === contactId) {
        return {
          ...r,
          deliveryStatus: 'Acknowledged',
          acknowledgedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          responseNote: 'Alert acknowledged. Monitoring live location.',
        };
      }
      return r;
    });

    this.saveToHistory(this.activeAlert);
    this.notify();
  }

  /**
   * Dismiss the active alert banner once resolved
   */
  public dismissActiveAlert() {
    this.clearTimers();
    this.activeAlert = null;
    this.notify();
  }

  private saveToHistory(payload: AppAlertPayload) {
    try {
      const raw = localStorage.getItem(ALERTS_HISTORY_KEY);
      const list: AppAlertPayload[] = raw ? JSON.parse(raw) : [];
      const filtered = list.filter((item) => item.id !== payload.id);
      filtered.unshift(payload);
      localStorage.setItem(ALERTS_HISTORY_KEY, JSON.stringify(filtered.slice(0, 30)));
    } catch (e) {}
  }

  public getAlertsHistory(): AppAlertPayload[] {
    try {
      const raw = localStorage.getItem(ALERTS_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private clearTimers() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  }
}

export const emergencyAlertService = new EmergencyAlertService();
