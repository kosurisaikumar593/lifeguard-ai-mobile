import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ActiveTab, UserProfile, GPSLocation, AppAlertPayload } from './types';
import { cloudStorageService } from './services/CloudStorageService';
import { audioMonitoringService } from './services/AudioMonitoringService';
import { emergencyAlertService } from './services/EmergencyAlertService';
import { geolocationService } from './services/GeolocationService';
import { webNotificationService } from './services/WebNotificationService';
import { themeService } from './services/ThemeService';

import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { AuthModal } from './components/AuthModal';
import { EmergencyBufferModal } from './components/EmergencyBufferModal';
import { OfflineBanner } from './components/OfflineBanner';
import { InteractiveMapModal } from './components/InteractiveMapModal';

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

  // 5-Second Emergency Buffer Modal State
  const [isBufferOpen, setIsBufferOpen] = useState(false);
  const [bufferReason, setBufferReason] = useState('Distress Sound Detected');
  const [bufferDecibels, setBufferDecibels] = useState<number | undefined>(undefined);

  // Global Map Modal State
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [mapLocation, setMapLocation] = useState<GPSLocation | null>(null);

  // Network State
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);

  // Active Alert Tracking
  const [activeAlert, setActiveAlert] = useState<AppAlertPayload | null>(null);

  // Keep references to prevent stale closures
  const userRef = useRef<UserProfile | null>(currentUser);
  userRef.current = currentUser;

  useEffect(() => {
    // Keep monitoring state synchronized
    const unsubState = audioMonitoringService.onStateUpdate((state) => {
      setIsMonitoring(state !== 'STOPPED' && state !== 'ERROR');
    });

    const unsubAlert = emergencyAlertService.subscribe((alert) => {
      setActiveAlert(alert);
    });

    // Network status listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubState();
      unsubAlert();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
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

  // Open 5-second buffer modal
  const handleRequestBufferModal = useCallback((params: { decibels?: number; reason: string }) => {
    setBufferReason(params.reason);
    setBufferDecibels(params.decibels);
    setIsBufferOpen(true);
  }, []);

  // Action: "I'm Safe" clicked -> Cancel trigger and return to monitoring
  const handleCancelSafe = async () => {
    setIsBufferOpen(false);
    audioMonitoringService.returnToMonitoring();

    if (userRef.current) {
      await cloudStorageService.createIncident(userRef.current.id, {
        incidentType: 'AI_DETECTED',
        detectionResult: 'FALSE_ALARM',
        decibels: bufferDecibels,
        alertStatus: 'CANCELLED_SAFE',
        bufferCancelled: true,
      });
    }
  };

  // Action: "Send Alert Now" or 5s buffer countdown expired
  const handleDispatchNow = async () => {
    setIsBufferOpen(false);

    const user = userRef.current;
    if (!user) return;

    // 1. Acquire current real-time GPS location
    const locRes = await geolocationService.getCurrentPosition();
    const loc = locRes.success && locRes.location ? locRes.location : null;

    // 2. Fetch connected contacts
    const contacts = await cloudStorageService.getContacts(user.id);

    // 3. Dispatch standalone app-to-app alert payload
    const payload = emergencyAlertService.dispatchAlert({
      user,
      contacts,
      type: bufferReason.includes('SOS') ? 'MANUAL_SOS' : 'AI_DISTRESS',
      decibels: bufferDecibels,
      location: loc,
      customNote: bufferReason,
    });

    // 4. Save to persistent incident log
    await cloudStorageService.createIncident(user.id, {
      incidentType: bufferReason.includes('SOS') ? 'MANUAL_SOS' : 'AI_DETECTED',
      detectionResult: bufferReason.includes('SOS') ? 'MANUAL_TRIGGER' : 'SCREAM',
      decibels: bufferDecibels,
      confidence: 0.98,
      humanSoundStatus: 'HUMAN_DETECTED',
      latitude: loc?.latitude,
      longitude: loc?.longitude,
      locationAccuracy: loc?.accuracy,
      alertStatus: 'APP_ALERT_DELIVERED',
      recipientsSummary: `Dispatched to ${payload.recipients.length} recipients`,
    });

    // 5. System notification
    webNotificationService.notifyEmergency(
      '🚨 LIFEGUARD AI – EMERGENCY ALERT DISPATCHED',
      `Verified distress alert and live GPS location sent to your connected contacts.`
    );
  };

  // Trigger test incident for HistoryView empty state test action
  const handleTriggerTestIncident = async () => {
    if (!currentUser) return;
    const locRes = await geolocationService.getCurrentPosition();
    await cloudStorageService.createIncident(currentUser.id, {
      incidentType: 'AI_DETECTED',
      detectionResult: 'SCREAM',
      decibels: 94.6,
      confidence: 0.96,
      humanSoundStatus: 'HUMAN_DETECTED',
      latitude: locRes.location?.latitude,
      longitude: locRes.location?.longitude,
      locationAccuracy: locRes.location?.accuracy,
      alertStatus: 'APP_ALERT_DELIVERED',
      recipientsSummary: 'Safe Simulation Test Logged',
    });
    // Force reload tab view
    setActiveTab('history');
  };

  const isActuallyOffline = !isOnline || isSimulatedOffline;

  return (
    <div className="app-container">
      {/* Offline Status Fallback Banner (Feature 7) */}
      <OfflineBanner
        isOffline={isActuallyOffline}
        onRetry={() => {
          setIsSimulatedOffline(false);
          setIsOnline(navigator.onLine);
        }}
      />

      {/* Top Header */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        isMonitoring={isMonitoring}
        isOffline={isActuallyOffline}
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
            onRequestSOS={() =>
              handleRequestBufferModal({
                reason: 'Dashboard Quick Emergency SOS Triggered',
              })
            }
          />
        )}

        {activeTab === 'monitoring' && (
          <MonitoringView
            currentUser={currentUser}
            isMonitoring={isMonitoring}
            onToggleMonitoring={handleToggleMonitoring}
            onRequestBufferModal={handleRequestBufferModal}
          />
        )}

        {activeTab === 'sos' && (
          <SOSView
            currentUser={currentUser}
            onOpenAuth={() => setIsAuthOpen(true)}
            onRequestBufferModal={handleRequestBufferModal}
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
            onTriggerTestIncident={handleTriggerTestIncident}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            currentUser={currentUser}
            onOpenAuth={() => setIsAuthOpen(true)}
            onLogout={handleLogout}
            isSimulatedOffline={isSimulatedOffline}
            onToggleSimulateOffline={() => setIsSimulatedOffline(!isSimulatedOffline)}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isMonitoring={isMonitoring}
      />

      {/* 5-Second Emergency Buffer Modal (Feature 2) */}
      <EmergencyBufferModal
        isOpen={isBufferOpen}
        triggerReason={bufferReason}
        decibels={bufferDecibels}
        onSafe={handleCancelSafe}
        onDispatchNow={handleDispatchNow}
      />

      {/* Authentication Modal (Feature 6) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthOpen(false);
        }}
      />

      {/* Global Interactive Map Modal (Feature 4) */}
      <InteractiveMapModal
        isOpen={mapModalOpen}
        location={mapLocation}
        onClose={() => setMapModalOpen(false)}
      />
    </div>
  );
};
