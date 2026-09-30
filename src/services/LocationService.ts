/**
 * LifeGuard AI — GPS Location Tracking Service (Phase 14)
 * 
 * Provides:
 * 1. GPS location acquisition triggered by confirmed emergency or manual SOS.
 * 2. On-demand location retrieval with strict coordinate validation.
 * 3. Finite state machine: IDLE -> REQUESTING_PERMISSION -> GETTING_LOCATION -> LOCATION_READY (or LOCATION_ERROR).
 * 4. Coordinate range validation: lat [-90, 90], lng [-180, 180], finite, non-NaN.
 * 5. Strict Zero-Mock Policy in production: never substitute fallback/mock coordinates if GPS fails.
 * 6. Decoupled pipeline handoff for Phase 15 alert dispatch.
 * 7. SQLite persistence updating emergency_incidents with acquired coordinates.
 * 8. Strict Privacy: zero continuous tracking, zero external uploads, on-demand only.
 */

import {
  LocationState,
  LocationData,
  LocationResult,
  LocationOptions,
  EmergencyLocationHandoff,
  ConfirmedEmergencyEvent,
  ManualSOSEvent,
} from '../types';
import { permissionService } from './PermissionService';
import { authService } from './AuthService';
import { emergencyVerificationService } from './EmergencyVerificationService';
import { manualSOSService } from './ManualSOSService';
import { incidentRepository } from '../database/incidentRepository';

function getLocationModule() {
  try {
    return require('expo-location');
  } catch {
    return null;
  }
}

type StateListener = (state: LocationState) => void;
type LocationListener = (data: LocationData) => void;
type EmergencyLocationListener = (handoff: EmergencyLocationHandoff) => void;

export class LocationService {
  private state: LocationState = 'IDLE';
  private lastLocation: LocationData | null = null;
  private lastError: string | null = null;

  // Mock testing injection handles
  private mockMode: boolean = false;
  private mockLocation: LocationData | null = null;
  private mockPermissionGranted: boolean | null = null;

  // Observers
  private stateListeners: Set<StateListener> = new Set();
  private locationListeners: Set<LocationListener> = new Set();
  private emergencyLocationListeners: Set<EmergencyLocationListener> = new Set();

  // Subscription handles to upstream emergency triggers
  private emergencySubscription: (() => void) | null = null;
  private manualSOSSubscription: (() => void) | null = null;
  private isAttachedToEmergencyPipelines: boolean = false;

  constructor() {
    this.attachToEmergencyPipelines();
  }

  // ==========================================
  // 1. STATE & ACCESSORS
  // ==========================================

  public getState(): LocationState {
    return this.state;
  }

  public getLastLocation(): LocationData | null {
    return this.lastLocation ? { ...this.lastLocation } : null;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  private setState(newState: LocationState): void {
    this.state = newState;
    this.notifyStateListeners(newState);
  }

  // ==========================================
  // 2. COORDINATE VALIDATION & FORMATTING
  // ==========================================

  /**
   * Validates coordinate values against physical boundaries.
   * Latitude: [-90, 90]
   * Longitude: [-180, 180]
   * Accuracy: non-negative finite number if present.
   * Rejects NaN, null, undefined, strings, Infinity, and out-of-range coordinates.
   */
  public validateLocation(coords: any): boolean {
    if (!coords || typeof coords !== 'object') {
      return false;
    }

    const { latitude, longitude, accuracy } = coords;

    if (typeof latitude !== 'number' || isNaN(latitude) || !isFinite(latitude)) {
      return false;
    }
    if (typeof longitude !== 'number' || isNaN(longitude) || !isFinite(longitude)) {
      return false;
    }

    if (latitude < -90 || latitude > 90) {
      return false;
    }
    if (longitude < -180 || longitude > 180) {
      return false;
    }

    if (accuracy !== undefined && accuracy !== null) {
      if (typeof accuracy !== 'number' || isNaN(accuracy) || !isFinite(accuracy) || accuracy < 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Formats coordinates into standard geographical representation (e.g. 16.4849° N, 80.6916° E)
   */
  public formatCoordinates(latitude: number, longitude: number): string {
    const latDir = latitude >= 0 ? 'N' : 'S';
    const lngDir = longitude >= 0 ? 'E' : 'W';
    return `${Math.abs(latitude).toFixed(4)}° ${latDir}, ${Math.abs(longitude).toFixed(4)}° ${lngDir}`;
  }

  /**
   * Formats a web-safe Google Maps query link
   */
  public formatMapUrl(latitude: number, longitude: number): string {
    return `https://maps.google.com/?q=${latitude},${longitude}`;
  }

  // ==========================================
  // 3. PERMISSIONS
  // ==========================================

  public async checkLocationPermission(): Promise<boolean> {
    if (this.mockPermissionGranted !== null) {
      return this.mockPermissionGranted;
    }
    try {
      const { status } = await permissionService.checkLocationPermission();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  public async requestLocationPermission(): Promise<boolean> {
    if (this.mockPermissionGranted !== null) {
      return this.mockPermissionGranted;
    }
    try {
      const { status } = await permissionService.requestLocationPermission();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  // ==========================================
  // 4. GPS LOCATION RETRIEVAL
  // ==========================================

  /**
   * Obtains current GPS coordinates on demand.
   * Adheres strictly to Zero-Mock Policy: if GPS fails or permission denied,
   * returns an explicit error. Never substitutes fake fallback coordinates.
   */
  public async getCurrentLocation(options?: LocationOptions): Promise<LocationResult> {
    this.lastError = null;

    // Step 1: Check / Request Permission
    this.setState('REQUESTING_PERMISSION');
    let hasPermission = await this.checkLocationPermission();
    if (!hasPermission) {
      hasPermission = await this.requestLocationPermission();
    }

    if (!hasPermission) {
      this.lastError = 'Location permission denied by user or system';
      this.setState('LOCATION_ERROR');
      return {
        success: false,
        error: this.lastError,
      };
    }

    // Step 2: Fetch GPS Position
    this.setState('GETTING_LOCATION');

    // Handle Mock Mode (for unit testing environments)
    if (this.mockMode) {
      if (this.mockLocation && this.validateLocation(this.mockLocation)) {
        this.lastLocation = { ...this.mockLocation };
        this.lastError = null;
        this.setState('LOCATION_READY');
        this.notifyLocationListeners(this.lastLocation);
        return {
          success: true,
          location: this.lastLocation,
        };
      } else {
        this.lastLocation = null;
        this.lastError = 'GPS position unavailable: Mock location is invalid or not provided';
        this.setState('LOCATION_ERROR');
        return {
          success: false,
          error: this.lastError,
        };
      }
    }

    // Real Native Device Retrieval via expo-location
    try {
      const locModule = getLocationModule();
      if (!locModule) {
        this.lastError = 'expo-location native module is not available in current environment';
        this.setState('LOCATION_ERROR');
        return {
          success: false,
          error: this.lastError,
        };
      }

      const timeoutMs = options?.timeoutMs || 10000;
      const highAccuracy = options?.highAccuracy !== false;

      const accuracySetting = locModule.Accuracy
        ? (highAccuracy ? locModule.Accuracy.High : locModule.Accuracy.Balanced)
        : undefined;

      const positionPromise = locModule.getCurrentPositionAsync({
        accuracy: accuracySetting,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('GPS location request timed out')), timeoutMs)
      );

      const pos = (await Promise.race([positionPromise, timeoutPromise])) as any;

      if (!pos || !pos.coords) {
        this.lastError = 'GPS hardware returned empty position';
        this.setState('LOCATION_ERROR');
        return {
          success: false,
          error: this.lastError,
        };
      }

      const locationData: LocationData = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null,
        timestamp: pos.timestamp ? new Date(pos.timestamp).toISOString() : new Date().toISOString(),
        source: 'GPS',
        altitude: typeof pos.coords.altitude === 'number' ? pos.coords.altitude : null,
        speed: typeof pos.coords.speed === 'number' ? pos.coords.speed : null,
        heading: typeof pos.coords.heading === 'number' ? pos.coords.heading : null,
      };

      if (!this.validateLocation(locationData)) {
        this.lastError = 'Invalid GPS coordinates received from device';
        this.setState('LOCATION_ERROR');
        return {
          success: false,
          error: this.lastError,
        };
      }

      this.lastLocation = locationData;
      this.lastError = null;
      this.setState('LOCATION_READY');
      this.notifyLocationListeners(locationData);

      return {
        success: true,
        location: locationData,
      };
    } catch (err: any) {
      this.lastError = err?.message || 'Failed to acquire GPS location';
      this.setState('LOCATION_ERROR');
      return {
        success: false,
        error: this.lastError ?? undefined,
      };
    }
  }

  // ==========================================
  // 5. EMERGENCY PIPELINE INTEGRATION
  // ==========================================

  /**
   * Subscribes to upstream emergency events (scream verification & manual SOS)
   * to automatically trigger location acquisition and persist coordinates.
   */
  public attachToEmergencyPipelines(force: boolean = false): void {
    if (this.isAttachedToEmergencyPipelines && !force) return;

    if (this.emergencySubscription) {
      this.emergencySubscription();
      this.emergencySubscription = null;
    }
    if (this.manualSOSSubscription) {
      this.manualSOSSubscription();
      this.manualSOSSubscription = null;
    }

    // Upstream Trigger A: Confirmed Scream Emergency
    this.emergencySubscription = emergencyVerificationService.onEmergencyConfirmed(
      async (event: ConfirmedEmergencyEvent) => {
        try {
          const currentUser = authService.getCurrentUser();
          const userId = currentUser?.userId || currentUser?.id || 'usr_anonymous';

          const locResult = await this.getCurrentLocation();
          if (locResult.success && locResult.location) {
            // Persist incident with acquired GPS coordinates
            await incidentRepository.createIncident({
              id: event.eventId,
              userId,
              incidentType: 'CONFIRMED_SCREAM',
              detectionResult: 'SCREAM_VERIFIED',
              confidence: event.confidence,
              latitude: locResult.location.latitude,
              longitude: locResult.location.longitude,
              accuracy: locResult.location.accuracy,
              alertStatus: 'LOCATION_ATTACHED',
              source: 'AI_MICROPHONE_STREAM',
              timestamp: event.timestamp,
            });

            const handoff: EmergencyLocationHandoff = {
              eventId: event.eventId,
              incidentType: 'CONFIRMED_SCREAM',
              userId,
              location: locResult.location,
              timestamp: new Date().toISOString(),
              status: 'LOCATION_READY',
            };
            this.notifyEmergencyLocationListeners(handoff);
          } else {
            // Persist incident marking location failure
            await incidentRepository.createIncident({
              id: event.eventId,
              userId,
              incidentType: 'CONFIRMED_SCREAM',
              detectionResult: 'SCREAM_VERIFIED',
              confidence: event.confidence,
              latitude: null,
              longitude: null,
              accuracy: null,
              alertStatus: 'LOCATION_FAILED',
              source: 'AI_MICROPHONE_STREAM',
              timestamp: event.timestamp,
            });
          }
        } catch (err) {
          console.error('Failed to attach GPS location to confirmed scream emergency:', err);
        }
      }
    );

    // Upstream Trigger B: Manual SOS Button Triggered
    this.manualSOSSubscription = manualSOSService.onSOSTriggered(async (event: ManualSOSEvent) => {
      try {
        const locResult = await this.getCurrentLocation();
        if (locResult.success && locResult.location) {
          // Update existing incident in SQLite with acquired GPS coordinates
          await incidentRepository.updateIncidentLocation(
            event.eventId,
            event.userId,
            locResult.location,
            'LOCATION_ATTACHED'
          );

          const handoff: EmergencyLocationHandoff = {
            eventId: event.eventId,
            incidentType: 'MANUAL_SOS',
            userId: event.userId,
            location: locResult.location,
            timestamp: new Date().toISOString(),
            status: 'LOCATION_READY',
          };
          this.notifyEmergencyLocationListeners(handoff);
        } else {
          // Update incident marking location failure
          await incidentRepository.updateIncidentLocation(
            event.eventId,
            event.userId,
            { latitude: null, longitude: null, accuracy: null },
            'LOCATION_FAILED'
          );
        }
      } catch (err) {
        console.error('Failed to attach GPS location to manual SOS event:', err);
      }
    });

    this.isAttachedToEmergencyPipelines = true;
  }

  // ==========================================
  // 6. OBSERVERS & SUBSCRIPTIONS
  // ==========================================

  public subscribeState(callback: StateListener): () => void {
    this.stateListeners.add(callback);
    callback(this.state);
    return () => this.stateListeners.delete(callback);
  }

  public onLocationAcquired(callback: LocationListener): () => void {
    this.locationListeners.add(callback);
    return () => this.locationListeners.delete(callback);
  }

  public onEmergencyLocationReady(callback: EmergencyLocationListener): () => void {
    this.emergencyLocationListeners.add(callback);
    return () => this.emergencyLocationListeners.delete(callback);
  }

  private notifyStateListeners(state: LocationState): void {
    this.stateListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.warn('LocationService state listener error:', err);
      }
    });
  }

  private notifyLocationListeners(data: LocationData): void {
    this.locationListeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.warn('LocationService location listener error:', err);
      }
    });
  }

  private notifyEmergencyLocationListeners(handoff: EmergencyLocationHandoff): void {
    this.emergencyLocationListeners.forEach((listener) => {
      try {
        listener(handoff);
      } catch (err) {
        console.warn('LocationService emergency handoff listener error:', err);
      }
    });
  }

  // ==========================================
  // 7. TESTING & MOCK INJECTION
  // ==========================================

  public setMockLocation(mock: LocationData | null): void {
    this.mockMode = mock !== null;
    this.mockLocation = mock;
    if (mock && this.validateLocation(mock)) {
      this.lastLocation = { ...mock };
    } else {
      this.lastLocation = null;
    }
  }

  public setMockPermission(granted: boolean | null): void {
    this.mockPermissionGranted = granted;
  }

  public reset(): void {
    this.state = 'IDLE';
    this.lastLocation = null;
    this.lastError = null;
    this.mockMode = false;
    this.mockLocation = null;
    this.mockPermissionGranted = null;
    this.notifyStateListeners(this.state);
  }

  public cleanup(): void {
    this.reset();
    this.stateListeners.clear();
    this.locationListeners.clear();
    this.emergencyLocationListeners.clear();
    if (this.emergencySubscription) {
      this.emergencySubscription();
      this.emergencySubscription = null;
    }
    if (this.manualSOSSubscription) {
      this.manualSOSSubscription();
      this.manualSOSSubscription = null;
    }
    this.isAttachedToEmergencyPipelines = false;
  }
}

export const locationService = new LocationService();
