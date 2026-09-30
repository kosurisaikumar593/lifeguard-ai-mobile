/**
 * LifeGuard AI — Manual SOS Service (Phase 13)
 * 
 * Provides:
 * 1. Independent manual SOS emergency workflow complementing AI scream detection.
 * 2. Multi-stage flow: USER PRESSES SOS -> CONFIRMATION / SHORT COUNTDOWN -> USER CONFIRMS -> CREATE SOS EVENT -> HANDOFF TO PHASE 14.
 * 3. Real configurable countdown timer (default: 5 seconds) allowing safe cancellation of false alarms.
 * 4. Immediate activation trigger bypassing the countdown when needed.
 * 5. Accidental duplicate prevention preventing event flooding from rapid taps.
 * 6. User-isolated SQLite incident persistence via incidentRepository.
 * 7. Clean decoupled event handoff for Phase 14 location and alert dispatches.
 */

import {
  ManualSOSState,
  ManualSOSEvent,
  ManualSOSConfig,
} from '../types';
import { authService } from './AuthService';
import { incidentRepository } from '../database/incidentRepository';

type StateListener = (state: ManualSOSState) => void;
type TickListener = (secondsLeft: number) => void;
type TriggerListener = (event: ManualSOSEvent) => void;
type CancelListener = () => void;

export class ManualSOSService {
  private state: ManualSOSState = 'IDLE';
  private activeEvent: ManualSOSEvent | null = null;
  private secondsLeft: number = 5;
  private countdownTimer: any = null;
  private lastTriggerTime: number = 0;
  private lastError: string | null = null;

  // Centralized Configuration
  private config: ManualSOSConfig = {
    countdownSeconds: 5,            // 5-second countdown to cancel accidental presses
    autoTriggerOnCountdownEnd: true,
    cooldownMs: 5000,               // 5000 ms window to prevent duplicate active triggers
  };

  // Observers
  private stateListeners: Set<StateListener> = new Set();
  private tickListeners: Set<TickListener> = new Set();
  private triggerListeners: Set<TriggerListener> = new Set();
  private cancelListeners: Set<CancelListener> = new Set();

  constructor(customConfig?: Partial<ManualSOSConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
      this.secondsLeft = this.config.countdownSeconds;
    }
  }

  // ==========================================
  // 1. GETTERS & CONFIGURATION
  // ==========================================

  public getState(): ManualSOSState {
    return this.state;
  }

  public getActiveEvent(): ManualSOSEvent | null {
    return this.activeEvent;
  }

  public getSecondsLeft(): number {
    return this.secondsLeft;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  public getConfig(): ManualSOSConfig {
    return { ...this.config };
  }

  public setCountdownSeconds(seconds: number): void {
    if (seconds < 1 || seconds > 60) {
      throw new Error('Countdown duration must be between 1 and 60 seconds');
    }
    this.config.countdownSeconds = seconds;
    if (this.state === 'IDLE' || this.state === 'CONFIRMATION_PENDING') {
      this.secondsLeft = seconds;
    }
  }

  // ==========================================
  // 2. SOS WORKFLOW & COUNTDOWN
  // ==========================================

  /**
   * Step 1: User requests SOS (Confirmation Pending)
   */
  public requestSOS(): void {
    if (this.state === 'TRIGGERED' && this.activeEvent) {
      // Already actively triggered
      return;
    }
    this.clearTimer();
    this.secondsLeft = this.config.countdownSeconds;
    this.setState('CONFIRMATION_PENDING');
  }

  /**
   * Step 2: Start Countdown
   */
  public startCountdown(customSeconds?: number): void {
    if (this.state === 'TRIGGERED' && this.activeEvent) {
      return;
    }

    this.clearTimer();
    const totalSeconds = customSeconds !== undefined ? customSeconds : this.config.countdownSeconds;
    this.secondsLeft = Math.max(1, totalSeconds);
    this.setState('COUNTDOWN_ACTIVE');
    this.notifyTickListeners(this.secondsLeft);

    this.countdownTimer = setInterval(() => {
      this.secondsLeft -= 1;
      this.notifyTickListeners(this.secondsLeft);

      if (this.secondsLeft <= 0) {
        this.clearTimer();
        if (this.config.autoTriggerOnCountdownEnd) {
          this.triggerSOS('MANUAL_BUTTON').catch((err) => {
            console.error('Failed to auto-trigger SOS on countdown completion:', err);
          });
        }
      }
    }, 1000);
  }

  /**
   * Step 3: Cancel SOS during countdown or confirmation
   */
  public cancelSOS(): void {
    this.clearTimer();
    this.secondsLeft = this.config.countdownSeconds;
    this.setState('CANCELLED');
    this.notifyCancelListeners();
  }

  /**
   * Step 4: Final SOS Activation Trigger
   * Called either upon countdown expiration or when user presses "Send Immediately".
   */
  public async triggerSOS(
    source: 'MANUAL_BUTTON' | 'DASHBOARD_SOS' | 'TAB_SOS' = 'MANUAL_BUTTON'
  ): Promise<ManualSOSEvent> {
    this.clearTimer();

    // Prevent duplicate triggers in rapid succession
    const now = Date.now();
    if (this.activeEvent && now - this.lastTriggerTime < this.config.cooldownMs) {
      return this.activeEvent;
    }

    try {
      // 1. Authenticate user
      const currentUser = authService.getCurrentUser();
      const userId = currentUser?.userId || currentUser?.id;
      if (!currentUser || !userId) {
        this.lastError = 'Authentication required: User must be signed in to trigger emergency SOS';
        this.setState('ERROR');
        throw new Error(this.lastError);
      }

      // 2. Generate unique event ID
      const eventId = `sos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const timestamp = new Date().toISOString();

      // 3. Persist emergency incident in SQLite
      await incidentRepository.createIncident({
        id: eventId,
        userId,
        incidentType: 'MANUAL_SOS',
        detectionResult: 'MANUAL_USER_TRIGGER',
        alertStatus: 'TRIGGERED',
        timestamp,
      });

      // 4. Construct domain event
      const event: ManualSOSEvent = {
        eventId,
        userId,
        type: 'MANUAL_SOS',
        status: 'TRIGGERED',
        timestamp,
        source,
        countdownSeconds: this.config.countdownSeconds,
      };


      this.activeEvent = event;
      this.lastTriggerTime = now;
      this.setState('TRIGGERED');
      this.notifyTriggerListeners(event);

      return event;
    } catch (err: any) {
      this.lastError = err?.message || 'Failed to trigger emergency SOS';
      this.setState('ERROR');
      throw err;
    }
  }

  /**
   * Resets the SOS service back to IDLE (e.g. after standing down from confirmed screen).
   */
  public resetSOS(): void {
    this.clearTimer();
    this.activeEvent = null;
    this.secondsLeft = this.config.countdownSeconds;
    this.lastError = null;
    this.setState('IDLE');
  }

  private clearTimer(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  // ==========================================
  // 3. OBSERVERS & SUBSCRIPTIONS
  // ==========================================

  private setState(newState: ManualSOSState): void {
    this.state = newState;
    this.notifyStateListeners(newState);
  }

  private notifyStateListeners(state: ManualSOSState): void {
    this.stateListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.warn('ManualSOSService state listener error:', err);
      }
    });
  }

  private notifyTickListeners(secondsLeft: number): void {
    this.tickListeners.forEach((listener) => {
      try {
        listener(secondsLeft);
      } catch (err) {
        console.warn('ManualSOSService tick listener error:', err);
      }
    });
  }

  private notifyTriggerListeners(event: ManualSOSEvent): void {
    this.triggerListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.warn('ManualSOSService trigger listener error:', err);
      }
    });
  }

  private notifyCancelListeners(): void {
    this.cancelListeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.warn('ManualSOSService cancel listener error:', err);
      }
    });
  }

  public subscribeState(callback: StateListener): () => void {
    this.stateListeners.add(callback);
    callback(this.state);
    return () => this.stateListeners.delete(callback);
  }

  public onCountdownTick(callback: TickListener): () => void {
    this.tickListeners.add(callback);
    return () => this.tickListeners.delete(callback);
  }

  public onSOSTriggered(callback: TriggerListener): () => void {
    this.triggerListeners.add(callback);
    return () => this.triggerListeners.delete(callback);
  }

  public onCountdownCancelled(callback: CancelListener): () => void {
    this.cancelListeners.add(callback);
    return () => this.cancelListeners.delete(callback);
  }

  public cleanup(): void {
    this.clearTimer();
    this.resetSOS();
    this.stateListeners.clear();
    this.tickListeners.clear();
    this.triggerListeners.clear();
    this.cancelListeners.clear();
  }
}

export const manualSOSService = new ManualSOSService();
