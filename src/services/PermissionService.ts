import { PermissionStatus, DetailedPermissionsState } from '../types';

function getAudioModule() {
  try {
    return require('expo-av').Audio;
  } catch {
    return null;
  }
}

function getLocationModule() {
  try {
    return require('expo-location');
  } catch {
    return null;
  }
}

function getNotificationsModule() {
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

function getLinkingModule() {
  try {
    return require('react-native').Linking;
  } catch {
    return null;
  }
}

type PermissionListener = (state: DetailedPermissionsState) => void;

class PermissionService {
  private currentState: DetailedPermissionsState = {
    microphone: 'undetermined',
    location: 'undetermined',
    notifications: 'undetermined',
    canAskAgain: {
      microphone: true,
      location: true,
      notifications: true,
    },
  };

  private listeners: Set<PermissionListener> = new Set();
  private mockMode: boolean = false;
  private mockState: Partial<DetailedPermissionsState> | null = null;

  constructor() {
    // Eagerly check initial permission status on startup
    this.checkAllPermissions().catch(() => {});
  }

  /**
   * Helper to map Expo permission response to domain PermissionStatus
   */
  private mapExpoStatus(response: {
    status: string;
    granted: boolean;
    canAskAgain?: boolean;
  }): PermissionStatus {
    if (response.granted || response.status === 'granted') {
      return 'granted';
    }
    if (response.canAskAgain === false) {
      return 'permanently_denied';
    }
    if (response.status === 'undetermined') {
      return 'undetermined';
    }
    return 'denied';
  }

  /**
   * Allows unit tests to simulate specific OS permission responses
   */
  setMockState(mock: Partial<DetailedPermissionsState> | null): void {
    this.mockMode = mock !== null;
    this.mockState = mock;
    if (mock) {
      this.currentState = {
        microphone: mock.microphone || this.currentState.microphone,
        location: mock.location || this.currentState.location,
        notifications: mock.notifications || this.currentState.notifications,
        canAskAgain: {
          microphone: mock.canAskAgain?.microphone ?? this.currentState.canAskAgain.microphone,
          location: mock.canAskAgain?.location ?? this.currentState.canAskAgain.location,
          notifications: mock.canAskAgain?.notifications ?? this.currentState.canAskAgain.notifications,
        },
      };
      this.notify();
    }
  }

  getState(): DetailedPermissionsState {
    return { ...this.currentState };
  }

  subscribe(listener: PermissionListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  /**
   * Checks current OS Microphone permission status
   */
  async checkMicrophonePermission(): Promise<{ status: PermissionStatus; canAskAgain: boolean }> {
    if (this.mockMode && this.mockState?.microphone) {
      return {
        status: this.mockState.microphone,
        canAskAgain: this.mockState.canAskAgain?.microphone ?? true,
      };
    }

    try {
      const audio = getAudioModule();
      if (!audio) {
        return { status: this.currentState.microphone, canAskAgain: this.currentState.canAskAgain.microphone };
      }

      const res = await audio.getPermissionsAsync();
      const status = this.mapExpoStatus(res);
      const canAskAgain = res.canAskAgain ?? true;

      this.currentState.microphone = status;
      this.currentState.canAskAgain.microphone = canAskAgain;
      this.notify();

      return { status, canAskAgain };
    } catch {
      return { status: this.currentState.microphone, canAskAgain: this.currentState.canAskAgain.microphone };
    }
  }

  /**
   * Requests OS Microphone permission
   */
  async requestMicrophonePermission(): Promise<{ status: PermissionStatus; canAskAgain: boolean }> {
    if (this.mockMode && this.mockState?.microphone) {
      return {
        status: this.mockState.microphone,
        canAskAgain: this.mockState.canAskAgain?.microphone ?? true,
      };
    }

    try {
      const audio = getAudioModule();
      if (!audio) {
        return { status: this.currentState.microphone, canAskAgain: this.currentState.canAskAgain.microphone };
      }

      const res = await audio.requestPermissionsAsync();
      const status = this.mapExpoStatus(res);
      const canAskAgain = res.canAskAgain ?? true;

      this.currentState.microphone = status;
      this.currentState.canAskAgain.microphone = canAskAgain;
      this.notify();

      return { status, canAskAgain };
    } catch {
      return { status: 'denied', canAskAgain: false };
    }
  }

  /**
   * Checks current OS Foreground Location permission status
   */
  async checkLocationPermission(): Promise<{ status: PermissionStatus; canAskAgain: boolean }> {
    if (this.mockMode && this.mockState?.location) {
      return {
        status: this.mockState.location,
        canAskAgain: this.mockState.canAskAgain?.location ?? true,
      };
    }

    try {
      const loc = getLocationModule();
      if (!loc) {
        return { status: this.currentState.location, canAskAgain: this.currentState.canAskAgain.location };
      }

      const res = await loc.getForegroundPermissionsAsync();
      const status = this.mapExpoStatus(res);
      const canAskAgain = res.canAskAgain ?? true;

      this.currentState.location = status;
      this.currentState.canAskAgain.location = canAskAgain;
      this.notify();

      return { status, canAskAgain };
    } catch {
      return { status: this.currentState.location, canAskAgain: this.currentState.canAskAgain.location };
    }
  }

  /**
   * Requests OS Foreground Location permission
   */
  async requestLocationPermission(): Promise<{ status: PermissionStatus; canAskAgain: boolean }> {
    if (this.mockMode && this.mockState?.location) {
      return {
        status: this.mockState.location,
        canAskAgain: this.mockState.canAskAgain?.location ?? true,
      };
    }

    try {
      const loc = getLocationModule();
      if (!loc) {
        return { status: this.currentState.location, canAskAgain: this.currentState.canAskAgain.location };
      }

      const res = await loc.requestForegroundPermissionsAsync();
      const status = this.mapExpoStatus(res);
      const canAskAgain = res.canAskAgain ?? true;

      this.currentState.location = status;
      this.currentState.canAskAgain.location = canAskAgain;
      this.notify();

      return { status, canAskAgain };
    } catch {
      return { status: 'denied', canAskAgain: false };
    }
  }

  /**
   * Checks current OS Notification permission status
   */
  async checkNotificationPermission(): Promise<{ status: PermissionStatus; canAskAgain: boolean }> {
    if (this.mockMode && this.mockState?.notifications) {
      return {
        status: this.mockState.notifications,
        canAskAgain: this.mockState.canAskAgain?.notifications ?? true,
      };
    }

    try {
      const notif = getNotificationsModule();
      if (!notif) {
        return { status: this.currentState.notifications, canAskAgain: this.currentState.canAskAgain.notifications };
      }

      const res = await notif.getPermissionsAsync();
      const status = this.mapExpoStatus(res);
      const canAskAgain = res.canAskAgain ?? true;

      this.currentState.notifications = status;
      this.currentState.canAskAgain.notifications = canAskAgain;
      this.notify();

      return { status, canAskAgain };
    } catch {
      return { status: this.currentState.notifications, canAskAgain: this.currentState.canAskAgain.notifications };
    }
  }

  /**
   * Requests OS Notification permission
   */
  async requestNotificationPermission(): Promise<{ status: PermissionStatus; canAskAgain: boolean }> {
    if (this.mockMode && this.mockState?.notifications) {
      return {
        status: this.mockState.notifications,
        canAskAgain: this.mockState.canAskAgain?.notifications ?? true,
      };
    }

    try {
      const notif = getNotificationsModule();
      if (!notif) {
        return { status: this.currentState.notifications, canAskAgain: this.currentState.canAskAgain.notifications };
      }

      const res = await notif.requestPermissionsAsync();
      const status = this.mapExpoStatus(res);
      const canAskAgain = res.canAskAgain ?? true;

      this.currentState.notifications = status;
      this.currentState.canAskAgain.notifications = canAskAgain;
      this.notify();

      return { status, canAskAgain };
    } catch {
      return { status: 'denied', canAskAgain: false };
    }
  }

  /**
   * Queries all 3 OS permissions concurrently and updates centralized state
   */
  async checkAllPermissions(): Promise<DetailedPermissionsState> {
    await Promise.all([
      this.checkMicrophonePermission(),
      this.checkLocationPermission(),
      this.checkNotificationPermission(),
    ]);

    return this.getState();
  }

  /**
   * Opens the OS application settings page when permissions are permanently denied
   */
  async openAppSettings(): Promise<void> {
    try {
      const linking = getLinkingModule();
      if (linking && linking.openSettings) {
        await linking.openSettings();
      }
    } catch (e) {
      console.warn('Failed to open app settings:', e);
    }
  }

  /**
   * Returns true if all three required permissions are currently granted
   */
  areAllGranted(): boolean {
    return (
      this.currentState.microphone === 'granted' &&
      this.currentState.location === 'granted' &&
      this.currentState.notifications === 'granted'
    );
  }

  /**
   * Returns list of missing permission names for user alerts
   */
  getMissingPermissions(): string[] {
    const missing: string[] = [];
    if (this.currentState.microphone !== 'granted') missing.push('Microphone');
    if (this.currentState.location !== 'granted') missing.push('Location');
    if (this.currentState.notifications !== 'granted') missing.push('Notifications');
    return missing;
  }
}

export const permissionService = new PermissionService();