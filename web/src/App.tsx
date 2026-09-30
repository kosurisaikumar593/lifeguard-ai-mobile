import React, { useState, useEffect } from 'react';
import { ActiveTab, UserProfile } from './types';
import { cloudStorageService } from './services/CloudStorageService';
import { audioMonitoringService } from './services/AudioMonitoringService';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { AuthModal } from './components/AuthModal';

import { DashboardView } from './views/DashboardView';
import { MonitoringView } from './views/MonitoringView';
import { SOSView } from './views/SOSView';
import { EmergencyContactsView } from './views/EmergencyContactsView';
import { HistoryView } from './views/HistoryView';
import { ProfileView } from './views/ProfileView';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(
    cloudStorageService.getCurrentUser()
  );
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(
    audioMonitoringService.isMonitoringActive()
  );

  useEffect(() => {
    // Keep monitoring state synchronized
    const unsub = audioMonitoringService.onStateUpdate((state) => {
      setIsMonitoring(state !== 'STOPPED' && state !== 'ERROR');
    });
    return () => unsub();
  }, []);

  const handleToggleMonitoring = async () => {
    if (isMonitoring) {
      await audioMonitoringService.stopMonitoring();
      setIsMonitoring(false);
    } else {
      const res = await audioMonitoringService.startMonitoring();
      if (res.success) {
        setIsMonitoring(true);
      }
    }
  };

  const handleLogout = () => {
    cloudStorageService.logout();
    setCurrentUser(null);
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        isMonitoring={isMonitoring}
      />

      {/* Main Responsive Views */}
      <main className="app-main">
        {activeTab === 'dashboard' && (
          <DashboardView
            currentUser={currentUser}
            onNavigate={setActiveTab}
            onOpenAuth={() => setIsAuthOpen(true)}
            isMonitoring={isMonitoring}
            onToggleMonitoring={handleToggleMonitoring}
          />
        )}

        {activeTab === 'monitoring' && (
          <MonitoringView
            currentUser={currentUser}
            isMonitoring={isMonitoring}
            onToggleMonitoring={handleToggleMonitoring}
          />
        )}

        {activeTab === 'sos' && (
          <SOSView
            currentUser={currentUser}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}

        {activeTab === 'contacts' && (
          <EmergencyContactsView
            currentUser={currentUser}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            currentUser={currentUser}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            currentUser={currentUser}
            onOpenAuth={() => setIsAuthOpen(true)}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isMonitoring={isMonitoring}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthOpen(false);
        }}
      />
    </div>
  );
};
