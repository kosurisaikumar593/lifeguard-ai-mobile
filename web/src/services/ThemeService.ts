/**
 * LifeGuard AI Web — Dynamic Day & Night Safety Theme Service
 * 
 * Implements automatic theme switching based on local device time:
 * - Before 6:00 PM (18:00) → Clean Day Mode (#F8FAFC background)
 * - After 6:00 PM (18:00) → High-Contrast Night Safety Mode (#0F172A dark slate)
 * - User can manually override: "auto" | "day" | "night"
 * - Strictly visual: NEVER unmounts components or resets active Web Audio monitoring
 */

import { ThemeMode } from '../types';

const THEME_STORAGE_KEY = 'lifeguard_theme_mode';

export class ThemeService {
  private mode: ThemeMode = 'auto';
  private resolved: 'light' | 'dark' = 'light';
  private listeners: Set<(mode: ThemeMode, resolved: 'light' | 'dark') => void> = new Set();
  private timer: any = null;

  constructor() {
    this.restoreMode();
    this.applyTheme();
    // Check every minute for 6:00 PM transition
    this.timer = setInterval(() => {
      if (this.mode === 'auto') {
        this.applyTheme();
      }
    }, 60000);
  }

  private restoreMode() {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode;
      if (saved && (saved === 'auto' || saved === 'day' || saved === 'night')) {
        this.mode = saved;
      }
    } catch {}
  }

  public getMode(): ThemeMode {
    return this.mode;
  }

  public getResolvedTheme(): 'light' | 'dark' {
    return this.resolved;
  }

  public setMode(newMode: ThemeMode) {
    this.mode = newMode;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch {}
    this.applyTheme();
  }

  private applyTheme() {
    let target: 'light' | 'dark' = 'light';

    if (this.mode === 'night') {
      target = 'dark';
    } else if (this.mode === 'day') {
      target = 'light';
    } else {
      // Auto: Based on local time (after 6:00 PM is night)
      const currentHour = new Date().getHours();
      target = (currentHour >= 18 || currentHour < 6) ? 'dark' : 'light';
    }

    this.resolved = target;
    if (typeof document !== 'undefined') {
      if (target === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    }

    this.listeners.forEach((cb) => cb(this.mode, this.resolved));
  }

  public subscribe(cb: (mode: ThemeMode, resolved: 'light' | 'dark') => void): () => void {
    this.listeners.add(cb);
    cb(this.mode, this.resolved);
    return () => {
      this.listeners.delete(cb);
    };
  }
}

export const themeService = new ThemeService();
