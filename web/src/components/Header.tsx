import React from 'react';
import { ActiveTab, UserProfile } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  isMonitoring: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  onOpenAuth,
  onLogout,
  isMonitoring,
}) => {
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
          <span>👥</span> Emergency Contacts
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
          <span>⚙️</span> Settings
        </button>
      </nav>

      {/* Right Actions */}
      <div className="header-actions">
        {currentUser ? (
          <div className="user-pill">
            <span>👤</span>
            <span>{currentUser.fullName}</span>
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
