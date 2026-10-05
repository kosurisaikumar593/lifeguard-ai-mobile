/**
 * LifeGuard AI Web — Domain Types & Interfaces
 */

export type MonitoringState =
  | 'STOPPED'
  | 'STARTING'
  | 'ACTIVE'
  | 'SOUND_DETECTED'
  | 'ABOVE_90DB'
  | 'CHECKING_HUMAN'
  | 'HUMAN_DETECTED'
  | 'CHECKING_SCREAM'
  | 'EMERGENCY_BUFFER'
  | 'EMERGENCY_VERIFIED'
  | 'ERROR';

export type LiveSoundCheckStatus =
  | 'CONFIRMED'
  | 'WAITING'
  | 'CHECKING'
  | 'NOT_DETECTED'
  | 'UNAVAILABLE';

export type HumanSoundClassification =
  | 'HUMAN_DETECTED'
  | 'ENVIRONMENTAL_SOUND'
  | 'ANALYSIS_UNAVAILABLE';

export interface SoundLevelData {
  decibels: number;
  normalizedLevel: number; // 0.00 to 1.00
  isLoud: boolean;         // strictly > 90.0 dB
  timestamp: string;
}

export interface LiveSoundCheckState {
  soundDetected: LiveSoundCheckStatus;
  above90dB: LiveSoundCheckStatus;
  humanSound: LiveSoundCheckStatus;
  distressScream: LiveSoundCheckStatus;
  emergencyVerified: LiveSoundCheckStatus;
  humanSoundReason?: string;
  screamReason?: string;
  verificationReason?: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  countryCode: string;
  createdAt: string;
  emergencyNotes?: string;
}

export interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  phoneNumber: string;
  relationship: string;
  priorityOrder: number;
  createdAt: string;
  connectionState: 'Connected' | 'Pending';
  lastActive?: string;
  deviceId?: string;
}

export type AlertDeliveryStatus = 'Sending' | 'Delivered' | 'Acknowledged';

export interface AppAlertRecipient {
  contactId: string;
  name: string;
  phoneNumber: string;
  connectionState: 'Connected' | 'Pending';
  deliveryStatus: AlertDeliveryStatus;
  acknowledgedAt?: string;
  responseNote?: string;
}

export interface AppAlertPayload {
  id: string;
  incidentId: string;
  senderId: string;
  senderName: string;
  senderPhone: string;
  timestamp: string;
  type: 'AI_DISTRESS' | 'MANUAL_SOS' | 'LOCATION_SHARE';
  soundLevel?: number;
  decibels?: number;
  location?: GPSLocation | null;
  mapUrl: string;
  overallStatus: 'DELIVERED' | 'ACKNOWLEDGED' | 'SENDING';
  recipients: AppAlertRecipient[];
}

export interface EmergencyIncident {
  id: string;
  userId: string;
  incidentType: 'AI_DETECTED' | 'MANUAL_SOS' | 'LOCATION_SHARE';
  detectionResult: 'SCREAM' | 'MANUAL_TRIGGER' | 'FALSE_ALARM' | 'LOCATION_SHARED';
  soundLevel?: number;
  decibels?: number;
  confidence?: number;
  humanSoundStatus?: HumanSoundClassification;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  locationAddress?: string;
  alertStatus:
    | 'APP_ALERT_DELIVERED'
    | 'APP_ALERT_ACKNOWLEDGED'
    | 'ALERT_SENT'
    | 'CANCELLED_SAFE'
    | 'NO_CONTACTS'
    | 'ALERT_FAILED';
  createdAt: string;
  recipientsSummary?: string;
  bufferCancelled?: boolean;
}

export interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  googleMapsUrl: string;
  formattedAddress?: string;
}

export type ActiveTab = 'dashboard' | 'monitoring' | 'sos' | 'history' | 'contacts' | 'profile';

export type ThemeMode = 'auto' | 'day' | 'night';

export type PermissionState = 'granted' | 'prompt' | 'denied' | 'unsupported';
