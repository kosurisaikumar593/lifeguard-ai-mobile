/**
 * LifeGuard AI Web — Supabase Client Service
 * 
 * Provides database connection, authentication, real-time subscriptions,
 * and data persistence via Supabase.
 * 
 * Gracefully falls back to local simulation if VITE_SUPABASE_URL or
 * VITE_SUPABASE_ANON_KEY are not configured.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserProfile, EmergencyContact, EmergencyIncident } from '../types';

export class SupabaseService {
  private client: SupabaseClient | null = null;
  private isConfigured: boolean = false;
  private realtimeChannel: any = null;

  constructor() {
    this.initClient();
  }

  private initClient() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('lifeguard_supabase_url');
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('lifeguard_supabase_key');

    if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://')) {
      try {
        this.client = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
          },
        });
        this.isConfigured = true;
      } catch (err) {
        console.warn('[SupabaseService] Failed to initialize Supabase client:', err);
        this.client = null;
        this.isConfigured = false;
      }
    } else {
      this.isConfigured = false;
    }
  }

  public getIsConfigured(): boolean {
    return this.isConfigured && this.client !== null;
  }

  public getClient(): SupabaseClient | null {
    return this.client;
  }

  // =========================================================================
  // AUTHENTICATION (Phone / Email with Supabase Auth)
  // =========================================================================

  public async signUp(
    fullName: string,
    phone: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Supabase client is not configured' };
    }

    try {
      const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
      const userEmail = email.trim() || `${cleanPhone}@lifeguard.ai`;

      const { data, error } = await this.client.auth.signUp({
        email: userEmail,
        password: password,
        options: {
          data: {
            full_name: fullName,
            phone_number: `+91${cleanPhone}`,
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        const userId = data.user.id;
        // Upsert into public.users
        await this.client.from('users').upsert({
          id: userId,
          full_name: fullName,
          phone_number: `+91${cleanPhone}`,
          email: userEmail,
          country_code: '+91',
        });

        const profile: UserProfile = {
          id: userId,
          fullName,
          mobileNumber: `+91${cleanPhone}`,
          email: userEmail,
          countryCode: '+91',
          createdAt: new Date().toISOString(),
        };

        return { success: true, user: profile };
      }

      return { success: false, error: 'User registration failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Supabase Auth error' };
    }
  }

  public async signIn(
    emailOrPhone: string,
    password: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Supabase client is not configured' };
    }

    try {
      const isEmail = emailOrPhone.includes('@');
      let targetEmail = emailOrPhone.trim();

      if (!isEmail) {
        const cleanPhone = emailOrPhone.replace(/[^0-9]/g, '').slice(-10);
        targetEmail = `${cleanPhone}@lifeguard.ai`;
      }

      const { data, error } = await this.client.auth.signInWithPassword({
        email: targetEmail,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        // Fetch user profile from public.users table
        const { data: profileData } = await this.client
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        const user: UserProfile = {
          id: data.user.id,
          fullName: profileData?.full_name || data.user.user_metadata?.full_name || 'LifeGuard User',
          mobileNumber: profileData?.phone_number || data.user.user_metadata?.phone_number || '+91 98765 43210',
          email: data.user.email || targetEmail,
          countryCode: '+91',
          createdAt: data.user.created_at,
        };

        return { success: true, user };
      }

      return { success: false, error: 'Invalid login response' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Supabase Sign-In failed' };
    }
  }

  public async signOut(): Promise<void> {
    if (this.client) {
      await this.client.auth.signOut();
    }
  }

  // =========================================================================
  // TRUSTED CONTACTS TABLE INTEGRATION
  // =========================================================================

  public async getContacts(userId: string): Promise<EmergencyContact[]> {
    if (!this.client) return [];

    try {
      const { data, error } = await this.client
        .from('trusted_contacts')
        .select('*')
        .eq('user_id', userId)
        .order('priority_order', { ascending: true });

      if (error || !data) return [];

      return data.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        name: row.contact_name,
        phoneNumber: row.contact_phone,
        relationship: row.relationship || 'Emergency Contact',
        priorityOrder: row.priority_order || 1,
        connectionState: row.status === 'connected' ? 'Connected' : 'Pending',
        lastActive: row.last_active || 'Active recently',
        createdAt: row.created_at,
      }));
    } catch (err) {
      console.warn('[SupabaseService] getContacts error:', err);
      return [];
    }
  }

  public async addContact(
    userId: string,
    contactData: Omit<EmergencyContact, 'id' | 'userId' | 'createdAt'>
  ): Promise<EmergencyContact | null> {
    if (!this.client) return null;

    try {
      const { data, error } = await this.client
        .from('trusted_contacts')
        .insert({
          user_id: userId,
          contact_name: contactData.name,
          contact_phone: contactData.phoneNumber,
          relationship: contactData.relationship || 'Emergency Contact',
          priority_order: contactData.priorityOrder || 1,
          status: contactData.connectionState === 'Pending' ? 'pending' : 'connected',
        })
        .select()
        .single();

      if (error || !data) return null;

      return {
        id: data.id,
        userId: data.user_id,
        name: data.contact_name,
        phoneNumber: data.contact_phone,
        relationship: data.relationship,
        priorityOrder: data.priority_order,
        connectionState: data.status === 'connected' ? 'Connected' : 'Pending',
        createdAt: data.created_at,
      };
    } catch (err) {
      console.warn('[SupabaseService] addContact error:', err);
      return null;
    }
  }

  public async updateContactStatus(
    contactId: string,
    status: 'connected' | 'pending'
  ): Promise<boolean> {
    if (!this.client) return false;

    try {
      const { error } = await this.client
        .from('trusted_contacts')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', contactId);

      return !error;
    } catch (err) {
      console.warn('[SupabaseService] updateContactStatus error:', err);
      return false;
    }
  }

  public async deleteContact(contactId: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const { error } = await this.client
        .from('trusted_contacts')
        .delete()
        .eq('id', contactId);

      return !error;
    } catch (err) {
      console.warn('[SupabaseService] deleteContact error:', err);
      return false;
    }
  }

  // =========================================================================
  // APP-TO-APP EMERGENCY ALERTS & INCIDENTS TABLE
  // =========================================================================

  public async createIncident(
    userId: string,
    incident: Omit<EmergencyIncident, 'id' | 'userId' | 'createdAt'>
  ): Promise<EmergencyIncident | null> {
    if (!this.client) return null;

    try {
      const detectionTypeMap: Record<string, string> = {
        'AI_DETECTED': 'scream',
        'MANUAL_SOS': 'manual_sos',
        'LOCATION_SHARE': 'location_share',
      };

      const mapUrl = incident.latitude && incident.longitude
        ? `https://maps.google.com/?q=${incident.latitude},${incident.longitude}`
        : null;

      const { data, error } = await this.client
        .from('incidents')
        .insert({
          user_id: userId,
          detection_type: detectionTypeMap[incident.incidentType] || 'scream',
          confidence_score: incident.confidence || 0.0,
          decibels: incident.decibels || 0.0,
          latitude: incident.latitude || null,
          longitude: incident.longitude || null,
          location_accuracy: incident.locationAccuracy || null,
          location_address: incident.locationAddress || null,
          map_url: mapUrl,
          alert_status: 'sent',
          recipients_summary: incident.recipientsSummary || '',
          buffer_cancelled: incident.bufferCancelled || false,
        })
        .select()
        .single();

      if (error || !data) return null;

      return {
        id: data.id,
        userId: data.user_id,
        incidentType: incident.incidentType,
        detectionResult: incident.detectionResult,
        soundLevel: incident.soundLevel,
        decibels: Number(data.decibels),
        confidence: Number(data.confidence_score),
        latitude: data.latitude ? Number(data.latitude) : undefined,
        longitude: data.longitude ? Number(data.longitude) : undefined,
        locationAccuracy: data.location_accuracy ? Number(data.location_accuracy) : undefined,
        locationAddress: data.location_address,
        alertStatus: incident.alertStatus,
        createdAt: data.created_at,
        recipientsSummary: typeof data.recipients_summary === 'string' ? data.recipients_summary : JSON.stringify(data.recipients_summary),
        bufferCancelled: data.buffer_cancelled,
      };
    } catch (err) {
      console.warn('[SupabaseService] createIncident error:', err);
      return null;
    }
  }

  public async getIncidents(userId: string): Promise<EmergencyIncident[]> {
    if (!this.client) return [];

    try {
      const { data, error } = await this.client
        .from('incidents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        incidentType: row.detection_type === 'manual_sos' ? ('MANUAL_SOS' as const) : ('AI_DETECTED' as const),
        detectionResult: row.detection_type === 'manual_sos' ? ('MANUAL_TRIGGER' as const) : ('SCREAM' as const),
        decibels: Number(row.decibels || 0),
        confidence: Number(row.confidence_score || 0),
        latitude: row.latitude ? Number(row.latitude) : undefined,
        longitude: row.longitude ? Number(row.longitude) : undefined,
        locationAddress: row.location_address,
        alertStatus: 'APP_ALERT_DELIVERED' as const,
        createdAt: row.created_at,
        recipientsSummary: typeof row.recipients_summary === 'string' ? row.recipients_summary : JSON.stringify(row.recipients_summary),
        bufferCancelled: row.buffer_cancelled,
      }));
    } catch (err) {
      console.warn('[SupabaseService] getIncidents error:', err);
      return [];
    }
  }

  // =========================================================================
  // SUPABASE REALTIME SUBSCRIPTIONS
  // =========================================================================

  /**
   * Subscribes to real-time changes on the incidents table so connected contacts
   * or open dashboards receive live emergency notifications.
   */
  public subscribeToIncidents(
    userId: string,
    onIncident: (incident: any) => void
  ): () => void {
    if (!this.client) return () => {};

    try {
      const channel = this.client
        .channel(`realtime:incidents:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'incidents',
            filter: `user_id=eq.${userId}`,
          },
          (payload: any) => {
            console.log('[Supabase Realtime] Live incident received:', payload.new);
            onIncident(payload.new);
          }
        )
        .subscribe();

      return () => {
        if (this.client) {
          this.client.removeChannel(channel);
        }
      };
    } catch (err) {
      console.warn('[SupabaseService] Realtime subscription error:', err);
      return () => {};
    }
  }
}

export const supabaseService = new SupabaseService();
