import React from 'react';
import { ActiveTab } from '../types';

interface BottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  isMonitoring: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelectTab, isMonitoring }) => {
  return (
    <nav className="mobile-bottom-nav">
      <button
        className={`bottom-tab-item ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => onSelectTab('dashboard')}
      >
        <span className="bottom-tab-icon" style={{ position: 'relative' }}>
          🏠
          {isMonitoring && (
            <span
              className="live-dot"
              style={{
                position: 'absolute',
                top: -2,
                right: -4,
                width: 6,
                height: 6,
              }}
            />
          )}
        </span>
        <span>Home</span>
      </button>

      <button
        className={`bottom-tab-item ${activeTab === 'contacts' ? 'active' : ''}`}
        onClick={() => onSelectTab('contacts')}
      >
        <span className="bottom-tab-icon">👥</span>
        <span>Contacts</span>
      </button>

      <button
        className={`bottom-tab-item ${activeTab === 'history' ? 'active' : ''}`}
        onClick={() => onSelectTab('history')}
      >
        <span className="bottom-tab-icon">📋</span>
        <span>History</span>
      </button>

      <button
        className={`bottom-tab-item ${activeTab === 'profile' ? 'active' : ''}`}
        onClick={() => onSelectTab('profile')}
      >
        <span className="bottom-tab-icon">⚙️</span>
        <span>Settings</span>
      </button>
    </nav>
  );
};
