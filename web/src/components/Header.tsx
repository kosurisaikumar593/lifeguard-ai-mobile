import React, { useState, useEffect } from 'react';
import { ActiveTab, UserProfile, ThemeMode } from '../types';
import { themeService } from '../services/ThemeService';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  isMonitoring: boolean;
  isOffline?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  onOpenAuth,
  onLogout,
  isMonitoring,
  isOffline,
}) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(themeService.getMode());
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(themeService.getResolvedTheme());

  useEffect(() => {
    return themeService.subscribe((mode, resolved) => {
      setThemeMode(mode);
      setResolvedTheme(resolved);
    });
  }, []);

  const cycleTheme = () => {
    if (themeMode === 'auto') {
      themeService.setMode('day');
    } else if (themeMode === 'day') {
      themeService.setMode('night');
    } else {
      themeService.setMode('auto');
    }
  };

  const getThemeIcon = () => {
    if (themeMode === 'auto') {
      return resolvedTheme === 'dark' ? '🌙 (Auto)' : '☀️ (Auto)';
    }
    return themeMode === 'night' ? '🌙 Night' : '☀️ Day';
  };

  return (
    <header className="app-header">
      <div className="brand-wrapper" onClick={() => onSelectTab('dashboard')}>
        <img src="./adaptive-icon.png" alt="LifeGuard AI Shield" className="brand-logo-img" />
        <div className="brand-text">
          <h1>LifeGuard AI</h1>
          <p>Your Safety, Our Priority</p>
        </div>
      </div>

      {/* Desktop Navigation */}
      <nav className="desktop-nav">
        <button
          className={`nav-link-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => onSelectTab('dashboard')}
        >
          <span>🏠</span> Dashboard
        </button>
        <button
          className={`nav-link-btn ${activeTab === 'monitoring' ? 'active' : ''}`}
          onClick={() => onSelectTab('monitoring')}
        >
          <span>🛡️</span> Sound Monitoring {isMonitoring && <span className="live-dot" style={{ width: 6, height: 6 }} />}
        </button>
        <button
          className={`nav-link-btn ${activeTab === 'sos' ? 'active' : ''}`}
          onClick={() => onSelectTab('sos')}
        >
          <span>🚨</span> Emergency SOS
        </button>
        <button
          className={`nav-link-btn ${activeTab === 'contacts' ? 'active' : ''}`}
          onClick={() => onSelectTab('contacts')}
        >
          <span>👥</span> Connected Contacts
        </button>
        <button
          className={`nav-link-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => onSelectTab('history')}
        >
          <span>📋</span> Incident History
        </button>
        <button
          className={`nav-link-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => onSelectTab('profile')}
        >
          <span>⚙️</span> Settings &amp; Permissions
        </button>
      </nav>

      {/* Right Actions */}
      <div className="header-actions">
        {/* Dynamic Day / Night Theme Button */}
        <button
          className="btn btn-outline"
          style={{ padding: '6px 12px', fontSize: 12, borderRadius: 'var(--radius-full)' }}
          onClick={cycleTheme}
          title="Toggle Day/Night Safety Theme (Automatic switch at 6:00 PM)"
        >
          <span>{getThemeIcon()}</span>
        </button>

        {isOffline && (
          <span className="badge badge-warning" style={{ fontSize: 11 }}>
            ⚡ Offline
          </span>
        )}

        {currentUser ? (
          <div className="user-pill">
            <span>👤</span>
            <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser.fullName}
            </span>
            <button
              onClick={onLogout}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                marginLeft: 4,
                fontSize: 12,
              }}
              title="Log out"
            >
              (Logout)
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }} onClick={onOpenAuth}>
            Login / Register
          </button>
        )}
      </div>
    </header>
  );
};
