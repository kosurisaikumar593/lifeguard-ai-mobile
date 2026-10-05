/**
 * LifeGuard AI Web — Node.js/Express Backend & Socket.io Service
 * 
 * Provides HTTP client integration with the Express REST API (/api/auth, /api/contacts, /api/incidents, /api/location)
 * and real-time app-to-app WebSocket notifications via Socket.io.
 */

import { io, Socket } from 'socket.io-client';
import { UserProfile, EmergencyContact, EmergencyIncident, GPSLocation } from '../types';

export class NodeBackendService {
  private apiUrl: string = '';
  private socket: Socket | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    const configuredUrl =
      import.meta.env.VITE_BACKEND_API_URL ||
      localStorage.getItem('lifeguard_node_backend_url');

    if (configuredUrl) {
      this.apiUrl = configuredUrl.replace(/\/$/, '');
      try {
        this.socket = io(this.apiUrl, {
          transports: ['websocket', 'polling'],
          autoConnect: true,
        });
        this.isConfigured = true;
      } catch (err) {
        console.warn('[NodeBackendService] Socket.io connection error:', err);
        this.isConfigured = false;
      }
    } else {
      this.isConfigured = false;
    }
  }

  public getIsConfigured(): boolean {
    return this.isConfigured && Boolean(this.apiUrl);
  }

  public setApiUrl(url: string) {
    this.apiUrl = url.trim().replace(/\/$/, '');
    if (this.apiUrl) {
      localStorage.setItem('lifeguard_node_backend_url', this.apiUrl);
      if (this.socket) {
        this.socket.disconnect();
      }
      this.socket = io(this.apiUrl);
      this.isConfigured = true;
    } else {
      localStorage.removeItem('lifeguard_node_backend_url');
      this.isConfigured = false;
    }
  }

  // =========================================================================
  // AUTH
  // =========================================================================

  public async register(
    fullName: string,
    phoneNumber: string,
    email: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    if (!this.apiUrl) return { success: false, error: 'Node backend URL not configured' };
    try {
      const res = await fetch(`${this.apiUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phoneNumber, email }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Registration failed' };
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async login(
    emailOrPhone: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    if (!this.apiUrl) return { success: false, error: 'Node backend URL not configured' };
    try {
      const res = await fetch(`${this.apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrPhone }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Login failed' };
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // =========================================================================
  // CONTACTS
  // =========================================================================

  public async getContacts(userId: string): Promise<EmergencyContact[]> {
    if (!this.apiUrl) return [];
    try {
      const res = await fetch(`${this.apiUrl}/api/contacts?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      console.warn('[NodeBackendService] getContacts error:', err);
      return [];
    }
  }

  public async addContact(
    userId: string,
    contactData: Omit<EmergencyContact, 'id' | 'userId' | 'createdAt'>
  ): Promise<EmergencyContact | null> {
    if (!this.apiUrl) return null;
    try {
      const res = await fetch(`${this.apiUrl}/api/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...contactData }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn('[NodeBackendService] addContact error:', err);
      return null;
    }
  }

  public async updateContactStatus(contactId: string, status: 'Connected' | 'Pending'): Promise<boolean> {
    if (!this.apiUrl) return false;
    try {
      const res = await fetch(`${this.apiUrl}/api/contacts/${contactId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      return res.ok;
    } catch (err) {
      console.warn('[NodeBackendService] updateContactStatus error:', err);
      return false;
    }
  }

  public async deleteContact(contactId: string): Promise<boolean> {
    if (!this.apiUrl) return false;
    try {
      const res = await fetch(`${this.apiUrl}/api/contacts/${contactId}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch (err) {
      console.warn('[NodeBackendService] deleteContact error:', err);
      return false;
    }
  }

  // =========================================================================
  // INCIDENTS & SOCKET.IO REALTIME
  // =========================================================================

  public async createIncident(
    userId: string,
    incident: Omit<EmergencyIncident, 'id' | 'userId' | 'createdAt'>
  ): Promise<EmergencyIncident | null> {
    if (!this.apiUrl) return null;
    try {
      const res = await fetch(`${this.apiUrl}/api/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...incident }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn('[NodeBackendService] createIncident error:', err);
      return null;
    }
  }

  public async getIncidents(userId: string): Promise<EmergencyIncident[]> {
    if (!this.apiUrl) return [];
    try {
      const res = await fetch(`${this.apiUrl}/api/incidents?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      console.warn('[NodeBackendService] getIncidents error:', err);
      return [];
    }
  }

  public subscribeToEmergencyAlerts(
    userId: string,
    onAlert: (alert: any) => void
  ): () => void {
    if (!this.socket) return () => {};

    this.socket.emit('join_user_channel', userId);

    const handleAlert = (data: any) => {
      console.log('[Socket.io] Live emergency alert received:', data);
      onAlert(data);
    };

    this.socket.on('emergency_alert', handleAlert);
    this.socket.on('emergency_alert_broadcast', handleAlert);

    return () => {
      if (this.socket) {
        this.socket.off('emergency_alert', handleAlert);
        this.socket.off('emergency_alert_broadcast', handleAlert);
      }
    };
  }

  public async shareLocation(userId: string, location: GPSLocation): Promise<boolean> {
    if (!this.apiUrl) return false;
    try {
      const res = await fetch(`${this.apiUrl}/api/location/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          address: location.formattedAddress || null,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const nodeBackendService = new NodeBackendService();
