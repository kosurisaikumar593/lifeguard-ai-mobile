export interface User {
  id: string;
  userId?: string; // compatibility alias matching SQLite user_id
  fullName: string;
  countryCode: string;
  mobileNumber: string;
  passwordHash: string;
  createdAt: string;
}


export interface AuthSession {
  user: User;
  token: string;
  loginTime: string;
}

export interface EmergencyContact {
  contact_id: string;
  id: string; // compatibility alias
  user_id: string;
  userId: string; // compatibility alias
  name: string;
  mobile_number: string;
  phone: string; // compatibility alias
  country_code: string;
  relationship: string;
  created_at: string;
}

export type AlertStatus = 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';

export interface SoundEvent {
  id: string;
  userId: string;
  detectionResult: 'DISTRESS_SCREAM' | 'NORMAL_SOUND' | 'AMBIGUOUS';
  confidence: number;
  decibelLevel: number;
  timestamp: string;
  durationMs: number;
  isConfirmedEmergency: boolean;
}

export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'permanently_denied';

export interface AppPermissions {
  microphone: boolean;
  location: boolean;
  notifications: boolean;
}

export interface DetailedPermissionsState {
  microphone: PermissionStatus;
  location: PermissionStatus;
  notifications: PermissionStatus;
  canAskAgain: {
    microphone: boolean;
    location: boolean;
    notifications: boolean;
  };
}

export interface ScreamDetectionResult {
  isDistressScream: boolean;
  confidence: number;
  decibels: number;
  spectralCentroid: number;
  zeroCrossingRate: number;
  durationMs: number;
  rawLabel: 'Distress Scream' | 'Normal Human Sound' | 'Environmental Noise';
}

export type MonitoringState =
  | 'STOPPED'
  | 'STARTING'
  | 'ACTIVE'
  | 'PROCESSING_SOUND'
  | 'ANALYZING_HUMAN_SOUND'
  | 'ANALYZING_SCREAM'
  | 'EMERGENCY_VERIFIED'
  | 'ERROR'
  | 'IDLE'
  | 'MONITORING'
  | 'LOUD_SOUND_DETECTED';

export interface SoundLevelUpdate {
  normalizedLevel: number;
  decibels: number;
  isLoud: boolean;
  timestamp: string;
}

export interface LoudSoundEvent {
  type: 'LOUD_SOUND_DETECTED';
  timestamp: string;
  soundLevel: number;
  decibels: number;
  reason: 'LOUD_SOUND';
}

export interface SoundMonitoringConfig {
  loudSoundThreshold: number;
  cooldownMs: number;
  updateIntervalMs: number;
}

// ==========================================
// PHASE 10: TEMPORARY AUDIO CAPTURE TYPES
// ==========================================

export type CaptureState = 'IDLE' | 'CAPTURING' | 'CAPTURE_COMPLETE' | 'CAPTURE_ERROR';

export interface AudioSample {
  sampleId: string;
  uri: string;
  timestamp: string;
  durationMs: number;
  format: 'm4a' | 'aac' | 'wav';
  sampleRate: number;
  channels: number;
  triggerSoundLevel: number;
  triggerDecibels: number;
}

export interface AudioCaptureConfig {
  captureDurationMs: number;
  maxCaptureDurationMs: number;
  sampleRate: number;
  channels: number;
  bitRate: number;
  autoDeleteOnHandoff: boolean;
}

export interface AudioCaptureResult {
  success: boolean;
  sample?: AudioSample;
  error?: string;
}

// ==========================================
// PHASE 11: AI/ML SCREAM DETECTION TYPES
// ==========================================

export type ModelStatus =
  | 'MODEL_UNINITIALIZED'
  | 'MODEL_LOADING'
  | 'MODEL_READY'
  | 'ANALYZING'
  | 'RESULT_READY'
  | 'MODEL_ERROR'
  | 'MODEL_NOT_FOUND';

export type AudioClassification = 'SCREAM' | 'NON_SCREAM' | 'UNCLASSIFIED' | 'ENVIRONMENTAL';

export type HumanSoundClassification =
  | 'HUMAN_DETECTED'
  | 'ENVIRONMENTAL_SOUND'
  | 'ANALYSIS_UNAVAILABLE';

export type LiveSoundCheckStatus =
  | 'CONFIRMED'     // ✓
  | 'WAITING'       // ○
  | 'CHECKING'      // ⟳
  | 'NOT_DETECTED'  // ✗
  | 'UNAVAILABLE';  // ⚠

export interface ScreamInferenceResult {
  classification: AudioClassification;
  confidence?: number; // Only populated if an actual trained model provides it
  isDistressScream: boolean;
  isHumanSound?: boolean;
  humanSoundStatus?: HumanSoundClassification;
  soundCategory?: 'HUMAN_VOICE' | 'HUMAN_SCREAM' | 'ENVIRONMENTAL';
  timestamp: string;
  durationMs: number;
  modelName: string;
  modelStatus: ModelStatus;
  analysisStatus: 'COMPLETED' | 'MODEL_MISSING' | 'FAILED';
  featuresExtracted?: {
    sampleRate: number;
    durationMs: number;
    framesCount: number;
    featureDimension: number;
  };
  errorMessage?: string;
}

export interface ScreamDetectionConfig {
  modelPath?: string;
  expectedSampleRate: number;
  nMfcc: number;
  frameLengthMs: number;
  hopLengthMs: number;
  allowDevFallback: boolean;
}

export interface IAudioClassifierModel {
  modelName: string;
  version: string;
  load(): Promise<boolean>;
  classify(features: Float32Array): Promise<{
    classification: 'SCREAM' | 'NON_SCREAM';
    confidence: number;
    isHuman?: boolean;
    soundType?: 'HUMAN_VOICE' | 'HUMAN_SCREAM' | 'ENVIRONMENTAL';
  }>;
  classifyHuman?(features: Float32Array): Promise<{
    isHuman: boolean;
    soundType: 'HUMAN_VOICE' | 'HUMAN_SCREAM' | 'ENVIRONMENTAL';
    confidence: number;
  }>;
  release(): Promise<void>;
}

// ==========================================
// PHASE 12: FALSE-ALARM & DURATION VERIFICATION TYPES
// ==========================================

export type VerificationState =
  | 'WAITING_FOR_ANALYSIS'
  | 'VERIFYING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'ERROR';

export type VerificationOutcome =
  | 'CONFIRMED_EMERGENCY'
  | 'UNCONFIRMED_EVENT'
  | 'VERIFICATION_ERROR';

export type VerificationRejectionReason =
  | 'INSUFFICIENT_DURATION'
  | 'NON_SCREAM_CLASSIFICATION'
  | 'LOW_CONFIDENCE'
  | 'MODEL_ARTIFACT_MISSING'
  | 'INVALID_SAMPLE'
  | 'DUPLICATE_EVENT'
  | 'INTERNAL_ERROR';

export interface VerificationConfig {
  minDurationMs: number; // Centralized configurable threshold (default 1500 ms)
  minConfidence: number; // Centralized configurable threshold (default 0.75)
  requireModelConfidence: boolean; // default false
  deduplicationWindowMs: number; // default 5000 ms to prevent duplicate triggers
}

export interface VerificationResult {
  verificationId: string;
  status: VerificationOutcome;
  classification: AudioClassification;
  confidence?: number;
  durationMs: number;
  isEmergencyConfirmed: boolean;
  reason: string;
  rejectionReason?: VerificationRejectionReason;
  timestamp: string;
  triggerInfo?: {
    sampleId?: string;
    soundLevel?: number;
    decibels?: number;
  };
}

export interface ConfirmedEmergencyEvent {
  eventId: string;
  status: 'CONFIRMED_EMERGENCY';
  classification: AudioClassification;
  confidence?: number;
  durationMs: number;
  timestamp: string;
  triggerInfo: {
    sampleId?: string;
    soundLevel?: number;
    decibels?: number;
    reason: string;
  };
}

// ==========================================
// PHASE 13: MANUAL SOS TYPES
// ==========================================

export type ManualSOSState =
  | 'IDLE'
  | 'CONFIRMATION_PENDING'
  | 'COUNTDOWN_ACTIVE'
  | 'TRIGGERED'
  | 'CANCELLED'
  | 'ERROR';

export interface ManualSOSEvent {
  eventId: string;
  userId: string;
  type: 'MANUAL_SOS';
  status: 'TRIGGERED';
  timestamp: string;
  source: 'MANUAL_BUTTON' | 'DASHBOARD_SOS' | 'TAB_SOS';
  countdownSeconds: number;
}

export interface ManualSOSConfig {
  countdownSeconds: number; // default 5 seconds (or 3 seconds)
  autoTriggerOnCountdownEnd: boolean;
  cooldownMs: number; // default 5000 ms to prevent duplicate active triggers
}

// ==========================================
// PHASE 14: GPS LOCATION TRACKING TYPES
// ==========================================

export type LocationState =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'GETTING_LOCATION'
  | 'LOCATION_READY'
  | 'LOCATION_ERROR';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: string;
  source: 'GPS';
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
}

export interface LocationResult {
  success: boolean;
  location?: LocationData;
  error?: string;
}

export interface LocationOptions {
  timeoutMs?: number;
  highAccuracy?: boolean;
}

export interface EmergencyLocationHandoff {
  eventId: string;
  incidentType: string;
  userId: string;
  location: LocationData;
  timestamp: string;
  status: 'LOCATION_READY';
}

// ==========================================
// PHASE 15: EMERGENCY INCIDENT DATABASE TYPES
// ==========================================

export type IncidentType =
  | 'MANUAL_SOS'
  | 'AI_DETECTED'
  | 'CONFIRMED_SCREAM'
  | 'AI_SCREAM_DETECTED';

export type IncidentClassification =
  | 'MANUAL_SOS'
  | 'SCREAM'
  | 'NON_SCREAM'
  | 'UNCLASSIFIED';

export type IncidentStatus =
  | 'TRIGGERED'
  | 'CONFIRMED'
  | 'ALERT_PENDING'
  | 'SENDING'
  | 'ALERT_SENT'
  | 'ALERT_FAILED'
  | 'NO_CONTACTS'
  | 'LOCATION_ATTACHED'
  | 'LOCATION_FAILED'
  | 'RESOLVED';

export type IncidentSource =
  | 'MANUAL_BUTTON'
  | 'DASHBOARD_SOS'
  | 'TAB_SOS'
  | 'AI_MICROPHONE_STREAM'
  | 'SYSTEM';

export interface EmergencyIncident {
  id?: string;
  incidentId: string;
  userId: string;
  incidentType: IncidentType;
  classification: IncidentClassification;
  status: IncidentStatus;
  alertStatus?: string;
  detectionResult?: string;
  confidence?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracy?: number | null;
  accuracy?: number | null;
  source: IncidentSource;
  timestamp: string;
  createdAt: string;
}

export interface CreateIncidentDTO {
  id?: string;
  incidentId?: string;
  userId: string;
  incidentType: IncidentType | string;
  classification?: IncidentClassification | string;
  detectionResult?: string;
  status?: IncidentStatus | string;
  alertStatus?: string;
  confidence?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  locationAccuracy?: number | null;
  source?: IncidentSource | string;
  timestamp?: string;
  createdAt?: string;
}

// ==========================================
// PHASE 16: EMERGENCY ALERT SYSTEM TYPES
// ==========================================

export type AlertDeliveryStatus =
  | 'PENDING'
  | 'SENDING'
  | 'SENT'
  | 'PARTIALLY_SENT'
  | 'FAILED'
  | 'NO_CONTACTS'
  | 'UNAVAILABLE';

export type AlertDeliveryChannel =
  | 'SMS'
  | 'PUSH_NOTIFICATION'
  | 'EXTERNAL_GATEWAY'
  | 'WHATSAPP'
  | 'SIMULATED';

export interface ContactAlertResult {
  contactId: string;
  name: string;
  phoneNumber: string;
  relationship?: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  channel: AlertDeliveryChannel;
  messageId?: string;
  error?: string;
  deliveredAt?: string;
}

export interface EmergencyAlertPayload {
  alertId: string;
  incidentId: string;
  userId: string;
  userName: string;
  emergencyType: 'AI_DETECTED' | 'MANUAL_SOS';
  emergencyTypeLabel: string;
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  locationAccuracy: number | null;
  mapUrl: string | null;
  formattedMessage: string;
  contactsCount: number;
}

export interface EmergencyAlertResult {
  alertId: string;
  incidentId: string;
  userId: string;
  status: AlertDeliveryStatus;
  totalContacts: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  deliveryResults: ContactAlertResult[];
  formattedMessage: string;
  timestamp: string;
  error?: string;
}

export interface IAlertProvider {
  readonly name: string;
  readonly channel: AlertDeliveryChannel;
  isAvailable(): Promise<boolean>;
  sendAlert(
    contact: EmergencyContact,
    message: string,
    payload: EmergencyAlertPayload
  ): Promise<ContactAlertResult>;
}




