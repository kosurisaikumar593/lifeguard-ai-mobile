/**
 * LifeGuard AI — Emergency Alert Service (Phase 16)
 * 
 * Provides:
 * 1. Automated and on-demand alert dispatch to predefined emergency contacts.
 * 2. Multi-channel AlertProvider abstraction (Expo Notifications, SMS Gateway, Simulated).
 * 3. Two Emergency Sources:
 *    A. AI-DETECTED EMERGENCY: Sound Monitoring -> Loud Sound -> Audio Capture -> AI Scream Detection -> Duration Verification -> Confirmed Emergency -> GPS Location -> Emergency Alert.
 *    B. MANUAL SOS: Manual SOS -> GPS Location -> Emergency Incident -> Emergency Alert.
 *    (Loud sound alone or unverified scream strictly NEVER triggers alerts).
 * 4. User and Contact Isolation: Only dispatches to contacts belonging to the authenticated user.
 * 5. Handles "No Contacts" truthfully (status NO_CONTACTS, never fakes alert sent).
 * 6. Formats clean emergency alert message with actual coordinates, timestamp, and map link.
 * 7. Tracks per-contact delivery results (all sent, partial delivery, all failed).
 * 8. SQLite Incident Database Integration: updates incident alert_status (ALERT_PENDING -> SENDING -> ALERT_SENT / ALERT_FAILED / NO_CONTACTS).
 * 9. Duplicate alert protection: prevents repeated alert dispatch for the same incident.
 * 10. Strict Scope Boundary: Alerts are sent ONLY to predefined personal contacts.
 *     NEVER contacts police or 112 emergency services.
 */

import {
  EmergencyIncident,
  EmergencyContact,
  EmergencyAlertPayload,
  EmergencyAlertResult,
  ContactAlertResult,
  AlertDeliveryStatus,
  AlertDeliveryChannel,
  IAlertProvider,
  ConfirmedEmergencyEvent,
  ManualSOSEvent,
  LocationData,
  User,
} from '../types';
import { authService } from './AuthService';
import { contactService } from './ContactService';
import { incidentRepository } from '../database/incidentRepository';
import { emergencyIncidentService } from './emergencyIncidentService';
import { emergencyVerificationService } from './EmergencyVerificationService';
import { manualSOSService } from './ManualSOSService';
import { locationService } from './LocationService';
import { WhatsAppAlertProvider, whatsAppService } from './WhatsAppService';

export { IAlertProvider, WhatsAppAlertProvider, whatsAppService };

// Optional dynamic import for Expo Notifications
function getExpoNotifications() {
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

// ==========================================
// 1. DEFAULT ALERT PROVIDERS
// ==========================================

/**
 * Built-in provider: Dispatches urgent device notifications via expo-notifications.
 */
export class ExpoNotificationAlertProvider implements IAlertProvider {
  public readonly name = 'ExpoNotificationProvider';
  public readonly channel: AlertDeliveryChannel = 'PUSH_NOTIFICATION';

  public async isAvailable(): Promise<boolean> {
    const notifications = getExpoNotifications();
    return Boolean(notifications && typeof notifications.scheduleNotificationAsync === 'function');
  }

  public async sendAlert(
    contact: EmergencyContact,
    message: string,
    payload: EmergencyAlertPayload
  ): Promise<ContactAlertResult> {
    const notifications = getExpoNotifications();
    const timestamp = new Date().toISOString();

    if (!notifications || typeof notifications.scheduleNotificationAsync !== 'function') {
      return {
        contactId: contact.contact_id || contact.id,
        name: contact.name,
        phoneNumber: contact.mobile_number || contact.phone,
        relationship: contact.relationship,
        status: 'FAILED',
        channel: this.channel,
        error: 'Expo notifications module is not available in current environment',
        deliveredAt: timestamp,
      };
    }

    try {
      const messageId = await notifications.scheduleNotificationAsync({
        content: {
          title: '🚨 LIFEGUARD AI EMERGENCY ALERT',
          body: `Emergency alert dispatched for contact: ${contact.name} (${contact.relationship})`,
          data: {
            alertId: payload.alertId,
            incidentId: payload.incidentId,
            contactId: contact.contact_id || contact.id,
            emergencyType: payload.emergencyType,
            latitude: payload.latitude,
            longitude: payload.longitude,
          },
          sound: true,
          priority: 'max',
        },
        trigger: null, // Send immediately
      });

      return {
        contactId: contact.contact_id || contact.id,
        name: contact.name,
        phoneNumber: contact.mobile_number || contact.phone,
        relationship: contact.relationship,
        status: 'SENT',
        channel: this.channel,
        messageId: String(messageId),
        deliveredAt: timestamp,
      };
    } catch (err: any) {
      return {
        contactId: contact.contact_id || contact.id,
        name: contact.name,
        phoneNumber: contact.mobile_number || contact.phone,
        relationship: contact.relationship,
        status: 'FAILED',
        channel: this.channel,
        error: err?.message || 'Failed to dispatch device notification',
        deliveredAt: timestamp,
      };
    }
  }
}

/**
 * Built-in provider: Simulated SMS Dispatcher for development, testing, and environments
 * where direct cellular hardware / paid SMS gateway is not configured.
 */
export class SimulatedSmsAlertProvider implements IAlertProvider {
  public readonly name = 'SimulatedSmsProvider';
  public readonly channel: AlertDeliveryChannel = 'SMS';

  // Configurable for testing failure scenarios and production truthful mode
  private shouldFail: boolean = false;
  private failContactId?: string;

  private isMobileDevice(): boolean {
    try {
      const rn = require('react-native');
      return rn?.Platform?.OS === 'android' || rn?.Platform?.OS === 'ios';
    } catch {
      return false;
    }
  }

  private allowSimulation: boolean =
    !this.isMobileDevice() ||
    (typeof process !== 'undefined' &&
      (process.env?.NODE_ENV === 'test' ||
        process.env?.EXPO_PUBLIC_ENABLE_SMS_SIMULATION === 'true'));

  public setSimulatedFailure(shouldFail: boolean, specificContactId?: string) {
    this.shouldFail = shouldFail;
    this.failContactId = specificContactId;
  }

  public setAllowSimulation(allow: boolean) {
    this.allowSimulation = allow;
  }

  public isConfigured(): boolean {
    return this.allowSimulation;
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async sendAlert(
    contact: EmergencyContact,
    _message: string,
    _payload: EmergencyAlertPayload
  ): Promise<ContactAlertResult> {
    const contactId = contact.contact_id || contact.id;
    const phone = contact.mobile_number || contact.phone;
    const timestamp = new Date().toISOString();

    // Truthful reporting check: if SMS gateway is not configured, do not claim SMS Sent
    if (!this.allowSimulation) {
      return {
        contactId,
        name: contact.name,
        phoneNumber: phone || '',
        relationship: contact.relationship,
        status: 'FAILED',
        channel: this.channel,
        error: 'SMS service not configured (No cellular SMS gateway connected)',
        deliveredAt: timestamp,
      };
    }

    // Check simulated failure
    if (this.shouldFail || (this.failContactId && this.failContactId === contactId)) {
      return {
        contactId,
        name: contact.name,
        phoneNumber: phone,
        relationship: contact.relationship,
        status: 'FAILED',
        channel: this.channel,
        error: 'Simulated SMS carrier transmission failure',
        deliveredAt: timestamp,
      };
    }

    // Phone number validation check
    if (!phone || phone.trim().length < 10) {
      return {
        contactId,
        name: contact.name,
        phoneNumber: phone || '',
        relationship: contact.relationship,
        status: 'FAILED',
        channel: this.channel,
        error: 'Invalid or missing contact phone number',
        deliveredAt: timestamp,
      };
    }

    const messageId = `sms_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      contactId,
      name: contact.name,
      phoneNumber: phone,
      relationship: contact.relationship,
      status: 'SENT',
      channel: this.channel,
      messageId,
      deliveredAt: timestamp,
    };
  }
}

/**
 * Built-in provider: External SMS / Webhook Gateway (reads config without hardcoding secrets).
 */
export class ExternalGatewayAlertProvider implements IAlertProvider {
  public readonly name = 'ExternalGatewayProvider';
  public readonly channel: AlertDeliveryChannel = 'EXTERNAL_GATEWAY';

  private gatewayUrl: string | null = null;

  constructor(gatewayUrl?: string) {
    this.gatewayUrl = gatewayUrl || (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SMS_GATEWAY_URL) || null;
  }

  public setGatewayUrl(url: string | null) {
    this.gatewayUrl = url;
  }

  public async isAvailable(): Promise<boolean> {
    return Boolean(this.gatewayUrl && this.gatewayUrl.startsWith('http'));
  }

  public async sendAlert(
    contact: EmergencyContact,
    message: string,
    payload: EmergencyAlertPayload
  ): Promise<ContactAlertResult> {
    const contactId = contact.contact_id || contact.id;
    const phone = contact.mobile_number || contact.phone;
    const timestamp = new Date().toISOString();

    if (!this.gatewayUrl) {
      return {
        contactId,
        name: contact.name,
        phoneNumber: phone,
        relationship: contact.relationship,
        status: 'FAILED',
        channel: this.channel,
        error: 'External SMS gateway URL is not configured',
        deliveredAt: timestamp,
      };
    }

    try {
      const response = await fetch(this.gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientName: contact.name,
          recipientPhone: phone,
          relationship: contact.relationship,
          message,
          alertId: payload.alertId,
          incidentId: payload.incidentId,
          timestamp,
        }),
      });

      if (!response.ok) {
        throw new Error(`Gateway returned HTTP ${response.status}`);
      }

      return {
        contactId,
        name: contact.name,
        phoneNumber: phone,
        relationship: contact.relationship,
        status: 'SENT',
        channel: this.channel,
        messageId: `gw_${Date.now()}`,
        deliveredAt: timestamp,
      };
    } catch (err: any) {
      return {
        contactId,
        name: contact.name,
        phoneNumber: phone,
        relationship: contact.relationship,
        status: 'FAILED',
        channel: this.channel,
        error: err?.message || 'Gateway network error',
        deliveredAt: timestamp,
      };
    }
  }
}

// ==========================================
// 2. EMERGENCY ALERT SERVICE
// ==========================================

type AlertResultListener = (result: EmergencyAlertResult) => void;
type AlertStatusListener = (status: AlertDeliveryStatus, incidentId: string) => void;

export class EmergencyAlertService {
  // Provider Registry
  private providers: Map<string, IAlertProvider> = new Map();
  private activeProviderName: string = 'SimulatedSmsProvider';

  // Deduplication cache: incidentId -> EmergencyAlertResult
  private alertHistory: Map<string, EmergencyAlertResult> = new Map();
  private inFlightDispatches: Set<string> = new Set();

  // Last Alert Result
  private lastAlertResult: EmergencyAlertResult | null = null;

  // Observers
  private alertResultListeners: Set<AlertResultListener> = new Set();
  private alertStatusListeners: Set<AlertStatusListener> = new Set();

  // Pipeline subscriptions
  private emergencyVerificationSub: (() => void) | null = null;
  private manualSOSSub: (() => void) | null = null;
  private isAttached: boolean = false;
  private autoDispatchEnabled: boolean = true;

  constructor() {
    // Register default providers
    const simSms = new SimulatedSmsAlertProvider();
    const expoNotif = new ExpoNotificationAlertProvider();
    const extGw = new ExternalGatewayAlertProvider();
    const waProvider = new WhatsAppAlertProvider(whatsAppService);

    this.registerProvider(simSms);
    this.registerProvider(expoNotif);
    this.registerProvider(extGw);
    this.registerProvider(waProvider);

    this.attachToEmergencyPipelines();
  }

  // ==========================================
  // PROVIDER MANAGEMENT
  // ==========================================

  public registerProvider(provider: IAlertProvider): void {
    this.providers.set(provider.name, provider);
  }

  public getProviders(): IAlertProvider[] {
    return Array.from(this.providers.values());
  }

  public getProvider(name: string): IAlertProvider | undefined {
    return this.providers.get(name);
  }

  public setActiveProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Alert provider "${name}" is not registered`);
    }
    this.activeProviderName = name;
  }

  public getActiveProviderName(): string {
    return this.activeProviderName;
  }

  public isGatewayConfigured(): boolean {
    const active = this.providers.get(this.activeProviderName);
    if (!active) return false;
    if (active.name === 'ExternalGatewayProvider') {
      return Boolean((active as any).gatewayUrl && (active as any).gatewayUrl.startsWith('http'));
    }
    if (active.name === 'SimulatedSmsProvider') {
      return Boolean((active as any).isConfigured?.());
    }
    return true;
  }

  public setAutoDispatch(enabled: boolean): void {
    this.autoDispatchEnabled = enabled;
  }

  public isAutoDispatchEnabled(): boolean {
    return this.autoDispatchEnabled;
  }

  // ==========================================
  // ALERT CONTENT & PREPARATION
  // ==========================================

  /**
   * Generates standard map link only when coordinates are valid and present.
   * Strictly never invents or hardcodes coordinates.
   */
  public generateMapUrl(latitude: number | null | undefined, longitude: number | null | undefined): string | null {
    if (
      latitude === null ||
      latitude === undefined ||
      longitude === null ||
      longitude === undefined ||
      isNaN(latitude) ||
      isNaN(longitude)
    ) {
      return null;
    }
    return `https://www.google.com/maps?q=${latitude},${longitude}`;
  }

  /**
   * Formats the official emergency alert message adhering to Requirement 6.
   */
  public formatAlertMessage(
    userName: string,
    emergencyType: 'AI_DETECTED' | 'MANUAL_SOS',
    timestamp: string,
    latitude: number | null | undefined,
    longitude: number | null | undefined,
    accuracy?: number | null
  ): string {
    const typeLabel =
      emergencyType === 'AI_DETECTED'
        ? 'AI Detected Emergency (Distress Scream)'
        : 'Manual SOS Emergency';

    const timeString = new Date(timestamp).toLocaleString();
    const mapUrl = this.generateMapUrl(latitude, longitude);

    let locationBlock = 'Location:\nLocation unavailable at time of alert.';
    if (latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined && mapUrl) {
      const accuracyStr = accuracy !== null && accuracy !== undefined ? `\nLocation accuracy:\n±${Math.round(accuracy)}m` : '';
      locationBlock = `Location:\nLatitude: ${latitude}\nLongitude: ${longitude}${accuracyStr}\n\nLocation link:\n${mapUrl}`;
    }

    return [
      'LIFEGUARD AI EMERGENCY ALERT',
      '',
      `${userName} may need immediate assistance.`,
      '',
      `Emergency type:\n${typeLabel}`,
      '',
      `Time:\n${timeString}`,
      '',
      locationBlock,
    ].join('\n');
  }

  /**
   * Prepares the emergency alert payload by binding actual user and incident data.
   */
  public prepareEmergencyAlert(
    incident: EmergencyIncident,
    user: User,
    contactsCount: number
  ): EmergencyAlertPayload {
    const alertId = `alt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const emergencyType: 'AI_DETECTED' | 'MANUAL_SOS' =
      incident.incidentType === 'MANUAL_SOS' ? 'MANUAL_SOS' : 'AI_DETECTED';

    const emergencyTypeLabel =
      emergencyType === 'AI_DETECTED'
        ? 'AI Detected Emergency (Distress Scream)'
        : 'Manual SOS Activation';

    const latitude = incident.latitude ?? null;
    const longitude = incident.longitude ?? null;
    const locationAccuracy = incident.locationAccuracy ?? incident.accuracy ?? null;
    const mapUrl = this.generateMapUrl(latitude, longitude);

    const formattedMessage = this.formatAlertMessage(
      user.fullName,
      emergencyType,
      incident.timestamp,
      latitude,
      longitude,
      locationAccuracy
    );

    return {
      alertId,
      incidentId: incident.incidentId || incident.id || '',
      userId: user.id || user.userId || '',
      userName: user.fullName,
      emergencyType,
      emergencyTypeLabel,
      timestamp: new Date().toISOString(),
      latitude,
      longitude,
      locationAccuracy,
      mapUrl,
      formattedMessage,
      contactsCount,
    };
  }

  // ==========================================
  // ALERT DISPATCH & ORCHESTRATION
  // ==========================================

  /**
   * Dispatches emergency alert to a single contact via the active provider.
   */
  public async sendAlertToContact(
    contact: EmergencyContact,
    message: string,
    payload: EmergencyAlertPayload
  ): Promise<ContactAlertResult> {
    const provider = this.providers.get(this.activeProviderName);
    const contactId = contact.contact_id || contact.id;
    const phone = contact.mobile_number || contact.phone;
    const timestamp = new Date().toISOString();

    if (!provider) {
      return {
        contactId,
        name: contact.name,
        phoneNumber: phone,
        relationship: contact.relationship,
        status: 'FAILED',
        channel: 'SIMULATED',
        error: `Active provider "${this.activeProviderName}" not found`,
        deliveredAt: timestamp,
      };
    }

    const available = await provider.isAvailable();
    if (!available) {
      return {
        contactId,
        name: contact.name,
        phoneNumber: phone,
        relationship: contact.relationship,
        status: 'FAILED',
        channel: provider.channel,
        error: `Provider "${provider.name}" is currently unavailable`,
        deliveredAt: timestamp,
      };
    }

    return provider.sendAlert(contact, message, payload);
  }

  /**
   * Main Emergency Alert Dispatcher.
   * Enforces:
   * 1. Authentication & user isolation
   * 2. Predefined contacts check (handles 0 contacts truthfully)
   * 3. Deduplication (never sends twice for same incident)
   * 4. Multi-contact delivery with partial tracking
   * 5. SQLite database incident status update (ALERT_PENDING -> SENDING -> ALERT_SENT / ALERT_FAILED / NO_CONTACTS)
   */
  public async sendEmergencyAlert(
    incidentId: string,
    overrideUserId?: string
  ): Promise<EmergencyAlertResult> {
    const currentUser = authService.getCurrentUser();
    const userId = overrideUserId || currentUser?.userId || currentUser?.id;

    if (!userId) {
      const failedResult: EmergencyAlertResult = {
        alertId: `alt_err_${Date.now()}`,
        incidentId,
        userId: 'unauthenticated',
        status: 'FAILED',
        totalContacts: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        deliveryResults: [],
        formattedMessage: '',
        timestamp: new Date().toISOString(),
        error: 'Authentication required: User must be signed in to dispatch emergency alerts',
      };
      this.lastAlertResult = failedResult;
      return failedResult;
    }

    // 1. Deduplication Protection
    if (this.alertHistory.has(incidentId)) {
      return this.alertHistory.get(incidentId)!;
    }

    if (this.inFlightDispatches.has(incidentId)) {
      // In flight, return temporary sending record
      return {
        alertId: `alt_inflight_${incidentId}`,
        incidentId,
        userId,
        status: 'SENDING',
        totalContacts: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        deliveryResults: [],
        formattedMessage: '',
        timestamp: new Date().toISOString(),
      };
    }

    this.inFlightDispatches.add(incidentId);
    this.notifyStatusListeners('SENDING', incidentId);

    try {
      // 2. Fetch Incident Record from SQLite
      let incidentRow = await incidentRepository.getIncidentById(incidentId, userId);
      if (!incidentRow) {
        // Wait briefly for upstream incident persistence (e.g. while GPS is acquired)
        const maxWaitMs = 2500;
        const start = Date.now();
        while (!incidentRow && Date.now() - start < maxWaitMs) {
          await new Promise((r) => setTimeout(r, 50));
          incidentRow = await incidentRepository.getIncidentById(incidentId, userId);
        }
      }
      
      // If incident is already marked ALERT_SENT in SQLite, protect against duplicate dispatch
      if (incidentRow && incidentRow.alert_status === 'ALERT_SENT') {
        const cached = this.alertHistory.get(incidentId);
        if (cached) {
          this.inFlightDispatches.delete(incidentId);
          return cached;
        }
      }

      // If incident row exists but latitude is null, check if location was acquired
      if (incidentRow && incidentRow.latitude === null) {
        let cachedLoc = locationService.getLastLocation();
        if (!cachedLoc) {
          try {
            const locRes = await locationService.getCurrentLocation({ timeoutMs: 1500 });
            if (locRes.success && locRes.location) {
              cachedLoc = locRes.location;
            }
          } catch {}
        }
        if (cachedLoc && cachedLoc.latitude !== null && cachedLoc.latitude !== undefined) {
          await incidentRepository.updateIncidentLocation(
            incidentId,
            userId,
            {
              latitude: cachedLoc.latitude,
              longitude: cachedLoc.longitude,
              accuracy: cachedLoc.accuracy ?? null,
            },
            'SENDING'
          );
          incidentRow = await incidentRepository.getIncidentById(incidentId, userId);
        }
      }

      // Update SQLite status to SENDING
      if (incidentRow) {
        await incidentRepository.updateIncidentStatus(incidentId, userId, 'SENDING');
      }

      // 3. Resolve Current User Details
      const user: User = currentUser && (currentUser.id === userId || currentUser.userId === userId)
        ? currentUser
        : {
            id: userId,
            userId,
            fullName: currentUser?.fullName || 'LifeGuard User',
            countryCode: currentUser?.countryCode || '+91',
            mobileNumber: currentUser?.mobileNumber || '+91XXXXXXXXXX',
            passwordHash: '',
            createdAt: new Date().toISOString(),
          };

      // 4. Retrieve User's Predefined Emergency Contacts
      const contacts = await contactService.getContacts(userId);

      // Construct Entity for Message Preparation
      const incidentEntity: EmergencyIncident = incidentRow
        ? emergencyIncidentService.mapRowToEntity(incidentRow)
        : {
            incidentId,
            userId,
            incidentType: 'MANUAL_SOS',
            classification: 'MANUAL_SOS',
            status: 'SENDING',
            latitude: null,
            longitude: null,
            locationAccuracy: null,
            source: 'SYSTEM',
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          };

      // 5. Check if User Has Configured Contacts
      if (!contacts || contacts.length === 0) {
        // Truthful reporting: do NOT pretend an alert was sent!
        await incidentRepository.updateIncidentStatus(incidentId, userId, 'NO_CONTACTS');

        const noContactsResult: EmergencyAlertResult = {
          alertId: `alt_no_contacts_${Date.now()}`,
          incidentId,
          userId,
          status: 'NO_CONTACTS',
          totalContacts: 0,
          successfulDeliveries: 0,
          failedDeliveries: 0,
          deliveryResults: [],
          formattedMessage: this.formatAlertMessage(
            user.fullName,
            incidentEntity.incidentType === 'MANUAL_SOS' ? 'MANUAL_SOS' : 'AI_DETECTED',
            incidentEntity.timestamp,
            incidentEntity.latitude,
            incidentEntity.longitude
          ),
          timestamp: new Date().toISOString(),
          error: 'No emergency contacts configured for user. Please add trusted contacts in Emergency Contacts screen.',
        };

        this.alertHistory.set(incidentId, noContactsResult);
        this.lastAlertResult = noContactsResult;
        this.inFlightDispatches.delete(incidentId);
        this.notifyStatusListeners('NO_CONTACTS', incidentId);
        this.notifyResultListeners(noContactsResult);
        return noContactsResult;
      }

      // 6. Prepare Alert Payload
      const payload = this.prepareEmergencyAlert(incidentEntity, user, contacts.length);

      // 7. Dispatch Alert to All Contacts
      const deliveryResults: ContactAlertResult[] = [];
      let successCount = 0;
      let failCount = 0;

      for (const contact of contacts) {
        const contactResult = await this.sendAlertToContact(contact, payload.formattedMessage, payload);
        deliveryResults.push(contactResult);
        if (contactResult.status === 'SENT') {
          successCount++;
        } else {
          failCount++;
        }
      }

      // 8. Determine Overall Status
      let overallStatus: AlertDeliveryStatus = 'FAILED';
      let incidentStatusToPersist: string = 'ALERT_FAILED';

      if (successCount === contacts.length) {
        overallStatus = 'SENT';
        incidentStatusToPersist = 'ALERT_SENT';
      } else if (successCount > 0) {
        overallStatus = 'PARTIALLY_SENT';
        incidentStatusToPersist = 'ALERT_SENT'; // Delivered to at least one emergency contact
      } else {
        overallStatus = 'FAILED';
        incidentStatusToPersist = 'ALERT_FAILED';
      }

      // 9. Update SQLite Database with Final Alert Status
      await incidentRepository.updateIncidentStatus(incidentId, userId, incidentStatusToPersist);

      const finalResult: EmergencyAlertResult = {
        alertId: payload.alertId,
        incidentId,
        userId,
        status: overallStatus,
        totalContacts: contacts.length,
        successfulDeliveries: successCount,
        failedDeliveries: failCount,
        deliveryResults,
        formattedMessage: payload.formattedMessage,
        timestamp: new Date().toISOString(),
        error: failCount > 0 ? `${failCount} of ${contacts.length} alert deliveries failed` : undefined,
      };

      // 10. Cache & Notify
      this.alertHistory.set(incidentId, finalResult);
      this.lastAlertResult = finalResult;
      this.inFlightDispatches.delete(incidentId);

      this.notifyStatusListeners(overallStatus, incidentId);
      this.notifyResultListeners(finalResult);

      return finalResult;
    } catch (err: any) {
      this.inFlightDispatches.delete(incidentId);
      await incidentRepository.updateIncidentStatus(incidentId, userId, 'ALERT_FAILED').catch(() => {});

      const errorResult: EmergencyAlertResult = {
        alertId: `alt_err_${Date.now()}`,
        incidentId,
        userId,
        status: 'FAILED',
        totalContacts: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        deliveryResults: [],
        formattedMessage: '',
        timestamp: new Date().toISOString(),
        error: err?.message || 'Emergency alert dispatch encountered an unexpected error',
      };

      this.alertHistory.set(incidentId, errorResult);
      this.lastAlertResult = errorResult;
      this.notifyStatusListeners('FAILED', incidentId);
      this.notifyResultListeners(errorResult);

      return errorResult;
    }
  }

  // ==========================================
  // ACCESSORS & STATUS
  // ==========================================

  public getAlertStatus(incidentId: string): AlertDeliveryStatus | null {
    if (this.inFlightDispatches.has(incidentId)) {
      return 'SENDING';
    }
    const result = this.alertHistory.get(incidentId);
    return result ? result.status : null;
  }

  public getLastAlertResult(): EmergencyAlertResult | null {
    return this.lastAlertResult;
  }

  public getIncidentAlertResult(incidentId: string): EmergencyAlertResult | null {
    return this.alertHistory.get(incidentId) || null;
  }

  // ==========================================
  // PIPELINE INTEGRATION (PHASE 12 & PHASE 13)
  // ==========================================

  /**
   * Attaches to confirmed emergency events (Phase 12 scream confirmation & Phase 13 manual SOS).
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
        if (!this.autoDispatchEnabled) return;
        try {
          const user = authService.getCurrentUser();
          const userId = user?.userId || user?.id || 'usr_anonymous';

          // Brief delay to allow Phase 14 GPS acquisition to attach coordinates if available
          await new Promise((r) => setTimeout(r, 200));

          await this.sendEmergencyAlert(event.eventId, userId);
        } catch (err) {
          console.error('Failed to auto-dispatch emergency alert from confirmed scream event:', err);
        }
      }
    );

    // Trigger B: Phase 13 Manual SOS Trigger
    this.manualSOSSub = manualSOSService.onSOSTriggered(async (event: ManualSOSEvent) => {
      if (!this.autoDispatchEnabled) return;
      try {
        // Brief delay to allow Phase 14 GPS acquisition to attach coordinates
        await new Promise((r) => setTimeout(r, 200));

        await this.sendEmergencyAlert(event.eventId, event.userId);
      } catch (err) {
        console.error('Failed to auto-dispatch emergency alert from manual SOS event:', err);
      }
    });

    this.isAttached = true;
  }

  // ==========================================
  // OBSERVERS
  // ==========================================

  public onAlertDispatched(callback: AlertResultListener): () => void {
    this.alertResultListeners.add(callback);
    return () => this.alertResultListeners.delete(callback);
  }

  public onAlertStatusChanged(callback: AlertStatusListener): () => void {
    this.alertStatusListeners.add(callback);
    return () => this.alertStatusListeners.delete(callback);
  }

  private notifyResultListeners(result: EmergencyAlertResult): void {
    this.alertResultListeners.forEach((listener) => {
      try {
        listener(result);
      } catch (err) {
        console.warn('EmergencyAlertService result listener error:', err);
      }
    });
  }

  private notifyStatusListeners(status: AlertDeliveryStatus, incidentId: string): void {
    this.alertStatusListeners.forEach((listener) => {
      try {
        listener(status, incidentId);
      } catch (err) {
        console.warn('EmergencyAlertService status listener error:', err);
      }
    });
  }

  // ==========================================
  // CLEANUP & RESET
  // ==========================================

  public reset(): void {
    this.alertHistory.clear();
    this.inFlightDispatches.clear();
    this.lastAlertResult = null;
  }

  public cleanup(): void {
    this.reset();
    this.alertResultListeners.clear();
    this.alertStatusListeners.clear();
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

export const emergencyAlertService = new EmergencyAlertService();
