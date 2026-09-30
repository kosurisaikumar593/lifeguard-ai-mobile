/**
 * LifeGuard AI Web — Web Notification Service
 * 
 * Provides desktop & mobile web browser notifications while monitoring is active or when an emergency is verified.
 * Gracefully handles denied permissions without crashing.
 */

export class WebNotificationService {
  private hasPermission: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.hasPermission = Notification.permission === 'granted';
    }
  }

  public async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    try {
      const res = await Notification.requestPermission();
      this.hasPermission = res === 'granted';
      return this.hasPermission;
    } catch {
      return false;
    }
  }

  public sendNotification(title: string, body: string): void {
    if (!this.hasPermission || typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    try {
      new Notification(title, {
        body,
        icon: './icon.png',
        badge: './icon.png',
        tag: 'lifeguard-safety-alert',
      });
    } catch {
      // Fallback for browsers with restricted notification constructors
    }
  }

  public notifyEmergency(title: string, body: string): void {
    this.sendNotification(title, body);
  }
}

export const webNotificationService = new WebNotificationService();
