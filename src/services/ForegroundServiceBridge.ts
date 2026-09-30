export interface ForegroundServiceState {
  isRunning: boolean;
  state?: string;
  lastDecibels?: number;
}

function getNativeBridge() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rn = require('react-native');
    return {
      platform: rn?.Platform?.OS || 'unknown',
      module: rn?.NativeModules?.LifeGuardMonitoringModule || null,
    };
  } catch {
    return {
      platform: 'unknown',
      module: null,
    };
  }
}

export class ForegroundServiceBridge {
  private static isAvailable(): boolean {
    const { platform, module } = getNativeBridge();
    return platform === 'android' && !!module;
  }

  public static async startService(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    const { module } = getNativeBridge();
    try {
      await module.startMonitoringService();
      return true;
    } catch (e) {
      console.warn('ForegroundServiceBridge.startService error:', e);
      return false;
    }
  }

  public static async stopService(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    const { module } = getNativeBridge();
    try {
      await module.stopMonitoringService();
      return true;
    } catch (e) {
      console.warn('ForegroundServiceBridge.stopService error:', e);
      return false;
    }
  }

  public static async isServiceRunning(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    const { module } = getNativeBridge();
    try {
      return await module.isServiceRunning();
    } catch (e) {
      return false;
    }
  }

  public static async getServiceState(): Promise<ForegroundServiceState> {
    if (!this.isAvailable()) {
      return { isRunning: false };
    }
    const { module } = getNativeBridge();
    try {
      const res = await module.getServiceState();
      return {
        isRunning: !!res?.isRunning,
        state: res?.state,
        lastDecibels: res?.lastDecibels,
      };
    } catch (e) {
      return { isRunning: false };
    }
  }

  public static async updateState(state: string, decibels: number): Promise<boolean> {
    if (!this.isAvailable()) return false;
    const { module } = getNativeBridge();
    try {
      await module.updateServiceState(state, Math.round(decibels));
      return true;
    } catch (e) {
      return false;
    }
  }

  public static async updateNotification(title: string, message: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    const { module } = getNativeBridge();
    try {
      await module.updateNotification(title, message);
      return true;
    } catch (e) {
      return false;
    }
  }
}
