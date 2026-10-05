import React, { useState, useEffect } from 'react';
import { ActiveTab, UserProfile, EmergencyContact, EmergencyIncident, GPSLocation, AppAlertPayload } from '../types';
import { audioMonitoringService } from '../services/AudioMonitoringService';
import { geolocationService } from '../services/GeolocationService';
import { cloudStorageService } from '../services/CloudStorageService';
import { emergencyAlertService } from '../services/EmergencyAlertService';
import { InteractiveMapModal } from '../components/InteractiveMapModal';
import { ActiveAlertBanner } from '../components/ActiveAlertBanner';

interface DashboardViewProps {
  currentUser: UserProfile | null;
  onNavigate: (tab: ActiveTab) => void;
  onOpenAuth: () => void;
  isMonitoring: boolean;
  onToggleMonitoring: () => void;
  onRequestSOS: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  onNavigate,
  onOpenAuth,
  isMonitoring,
  onToggleMonitoring,
  onRequestSOS,
}) => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<EmergencyIncident[]>([]);
  const [location, setLocation] = useState<GPSLocation | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [currentDecibels, setCurrentDecibels] = useState<number>(0);
  const [showMapModal, setShowMapModal] = useState(false);
  const [activeAlert, setActiveAlert] = useState<AppAlertPayload | null>(null);
  const [shareSuccess, setShareSuccess] = useState(false);

  useEffect(() => {
    if (currentUser) {
      cloudStorageService.getContacts(currentUser.id).then(setContacts);
      cloudStorageService.getIncidents(currentUser.id).then((incs) => setRecentIncidents(incs.slice(0, 3)));
    } else {
      setContacts([]);
      setRecentIncidents([]);
    }
  }, [currentUser]);

  useEffect(() => {
    const unsubLevel = audioMonitoringService.onLevelUpdate((data) => {
      setCurrentDecibels(data.decibels);
    });
    const unsubAlert = emergencyAlertService.subscribe((alert) => {
      setActiveAlert(alert);
    });
    return () => {
      unsubLevel();
      unsubAlert();
    };
  }, []);

  const handleFetchLocation = async () => {
    setLocLoading(true);
    setLocError(null);
    const res = await geolocationService.getCurrentPosition();
    setLocLoading(false);
    if (res.success && res.location) {
      setLocation(res.location);
    } else {
      setLocError(res.error || 'Could not fetch current GPS coordinates.');
    }
  };

  useEffect(() => {
    handleFetchLocation();
  }, []);

  const handleShareLocation = async () => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }

    let loc = location;
    if (!loc) {
      const res = await geolocationService.getCurrentPosition();
      if (res.success && res.location) {
        loc = res.location;
        setLocation(loc);
      }
    }

    // Dispatch direct app-to-app location share payload
    emergencyAlertService.dispatchAlert({
      user: currentUser,
      contacts,
      type: 'LOCATION_SHARE',
      location: loc,
      customNote: 'User shared their live GPS safety coordinates with connected contacts.',
    });

    // Record incident
    await cloudStorageService.createIncident(currentUser.id, {
      incidentType: 'LOCATION_SHARE',
      detectionResult: 'LOCATION_SHARED',
      confidence: 1.0,
      latitude: loc?.latitude,
      longitude: loc?.longitude,
      locationAccuracy: loc?.accuracy,
      alertStatus: 'APP_ALERT_DELIVERED',
      recipientsSummary: `Shared with ${contacts.length} connected contacts`,
    });

    setShareSuccess(true);
    setTimeout(() => setShareSuccess(false), 3000);
  };

  const primaryContact = contacts[0] || null;

  return (
    <div className="view-container">
      {/* Active App-to-App Alert Banner */}
      <ActiveAlertBanner alert={activeAlert} onViewMap={() => setShowMapModal(true)} />

      {/* Welcome Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #0D52D6 0%, #1A73E8 100%)', color: '#fff', border: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.18)', padding: '4px 10px', borderRadius: 20, fontSize: 12, marginBottom: 8 }}>
              <span className={isMonitoring ? 'live-dot' : ''} style={{ background: isMonitoring ? '#10B981' : '#94A3B8' }} />
              <span>{isMonitoring ? 'AI Audio Protection ACTIVE' : 'Audio Protection STANDBY'}</span>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
              {currentUser ? `Welcome back, ${currentUser.fullName}` : 'Welcome to LifeGuard AI'}
            </h2>
            <p style={{ opacity: 0.9, fontSize: 14 }}>
              Real-time acoustic safety, emergency response, and verified app-to-app location sharing.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-outline"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#FFF', borderColor: 'rgba(255,255,255,0.3)', padding: '10px 16px', fontSize: 13 }}
              onClick={() => setShowMapModal(true)}
            >
              📍 Interactive Map
            </button>
            {!currentUser && (
              <button className="btn btn-secondary" onClick={onOpenAuth} style={{ alignSelf: 'flex-start' }}>
                Sign In / Register
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Emergency SOS Quick Trigger Banner */}
      <div className="card" style={{ borderColor: 'var(--danger-border)', background: 'var(--danger-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: 'var(--danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              color: '#fff',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
            }}>
              🚨
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger)', marginBottom: 2 }}>
                Instant Emergency SOS
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Tap to broadcast emergency app alerts with live GPS location to your connected contacts.
              </p>
            </div>
          </div>
          <button
            className="btn btn-danger"
            style={{ padding: '12px 24px', fontSize: 15, fontWeight: 700 }}
            onClick={onRequestSOS}
          >
            Trigger Emergency SOS
          </button>
        </div>
      </div>

      {/* Grid: 2 Columns on desktop, 1 on mobile */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        
        {/* Card: Sound Monitoring Overview */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">🛡️ Sound Protection</h3>
              <p className="card-subtitle">Trigger threshold: strictly &gt; 90.0 dB</p>
            </div>
            <span className={`status-badge ${isMonitoring ? 'status-safe' : 'status-waiting'}`}>
              {isMonitoring ? 'Monitoring' : 'Standby'}
            </span>
          </div>

          <div style={{ margin: '16px 0', padding: 16, background: 'var(--bg-app)', borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Live Microphone Level</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: currentDecibels > 90 ? 'var(--danger)' : 'var(--primary)' }}>
                {isMonitoring ? `${currentDecibels.toFixed(1)} dB` : 'Off'}
              </span>
            </div>
            <div className="audio-gauge-bar-wrapper">
              <div
                className="audio-gauge-bar-fill"
                style={{
                  width: isMonitoring ? `${Math.min(100, Math.max(5, (currentDecibels / 120) * 100))}%` : '0%',
                  background: currentDecibels > 90 ? 'var(--danger)' : 'var(--primary)',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              <span>0 dB</span>
              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>90.0 dB Alert Trigger</span>
              <span>120 dB</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className={`btn ${isMonitoring ? 'btn-secondary' : 'btn-primary'}`}
              style={{ flex: 1 }}
              onClick={onToggleMonitoring}
            >
              {isMonitoring ? '⏹ Stop Protection' : '▶ Start Protection'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onNavigate('monitoring')}
            >
              3-Tier Pipeline →
            </button>
          </div>
        </div>

        {/* Card: Live GPS & Dashboard Location Sharing */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">📍 Live Location Sharing</h3>
              <p className="card-subtitle">Real-time device Geolocation API &amp; Leaflet map</p>
            </div>
            <button
              onClick={handleFetchLocation}
              disabled={locLoading}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              {locLoading ? '⟳ Locating...' : 'Refresh ↻'}
            </button>
          </div>

          {location ? (
            <div style={{ margin: '14px 0', padding: 14, background: 'var(--bg-app)', borderRadius: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Latitude</div>
                  <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace' }}>
                    {location.latitude.toFixed(6)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Longitude</div>
                  <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace' }}>
                    {location.longitude.toFixed(6)}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                <span>GPS Accuracy: ±{location.accuracy}m</span>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => setShowMapModal(true)}
                >
                  Open Interactive Map ↗
                </button>
              </div>
            </div>
          ) : (
            <div style={{ margin: '14px 0', padding: 20, textAlign: 'center', background: 'var(--bg-app)', borderRadius: 10, fontSize: 13, color: 'var(--text-muted)' }}>
              {locError ? (
                <span style={{ color: 'var(--danger)' }}>{locError}</span>
              ) : (
                'Acquiring browser GPS coordinates...'
              )}
            </div>
          )}

          {/* Action: Share My Location Button */}
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1, padding: '10px 16px', fontSize: 14 }}
              onClick={handleShareLocation}
            >
              📡 Share My Location
            </button>
            <button
              className="btn btn-outline"
              style={{ padding: '10px 16px', fontSize: 14 }}
              onClick={() => setShowMapModal(true)}
            >
              🗺️ Map View
            </button>
          </div>

          {shareSuccess && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--success-light)', color: 'var(--success)', borderRadius: 6, fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
              ✓ Live GPS location payload shared with connected contacts!
            </div>
          )}
        </div>

        {/* Card: Standalone App-to-App Connected Contacts */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">👥 Connected Contacts</h3>
              <p className="card-subtitle">Standalone direct app-to-app alert recipients</p>
            </div>
            <button
              onClick={() => onNavigate('contacts')}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              Manage ({contacts.length}) →
            </button>
          </div>

          {primaryContact ? (
            <div style={{ padding: 14, background: 'var(--bg-app)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>
                  {primaryContact.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{primaryContact.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({primaryContact.relationship})</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {primaryContact.lastActive || 'Active on LifeGuard'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span className={`badge ${primaryContact.connectionState === 'Connected' ? 'badge-success' : 'badge-warning'}`}>
                  ● {primaryContact.connectionState || 'Connected'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>Priority 1</span>
              </div>
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: 'center', background: 'var(--bg-app)', borderRadius: 10, marginTop: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                Zero connected trusted contacts registered.
              </p>
              <button className="btn btn-primary" onClick={() => onNavigate('contacts')} style={{ padding: '8px 16px', fontSize: 13 }}>
                + Connect Trusted Contact
              </button>
            </div>
          )}
        </div>

        {/* Card: 3-Tier Pipeline Architecture */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">⚙️ 3-Tier Safety Engine</h3>
              <p className="card-subtitle">Real-time false alarm rejection pipeline</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '8px 12px', background: 'var(--bg-app)', borderRadius: 6 }}>
              <span style={{ color: 'var(--primary)', fontWeight: 800 }}>Tier 1</span>
              <span>Sound Detection (Microphone Web Audio API &gt; 35 dB)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '8px 12px', background: 'var(--bg-app)', borderRadius: 6 }}>
              <span style={{ color: 'var(--danger)', fontWeight: 800 }}>Tier 2</span>
              <span>Evaluation Trigger strictly &gt; 90.0 dB</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '8px 12px', background: 'var(--bg-app)', borderRadius: 6 }}>
              <span style={{ color: 'var(--purple-ai)', fontWeight: 800 }}>Tier 3</span>
              <span>Human vs Environmental &amp; AI Scream / Distress Analysis</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Incidents Section */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">📋 Recent Incident Activity</h3>
            <p className="card-subtitle">Verified distress alerts and emergency dispatches</p>
          </div>
          <button
            onClick={() => onNavigate('history')}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            Full Incident History →
          </button>
        </div>

        {recentIncidents.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {recentIncidents.map((inc) => (
              <div
                key={inc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 12,
                  background: 'var(--bg-app)',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                    {inc.incidentType === 'AI_DETECTED'
                      ? 'AI Sound Detection'
                      : inc.incidentType === 'LOCATION_SHARE'
                      ? 'Live Location Share'
                      : 'Manual SOS Trigger'}
                    {inc.decibels ? ` (${inc.decibels.toFixed(1)} dB)` : ''}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(inc.createdAt).toLocaleString()}
                  </div>
                </div>
                <span className={`badge ${inc.alertStatus === 'CANCELLED_SAFE' ? 'badge-warning' : 'badge-success'}`}>
                  {inc.alertStatus === 'CANCELLED_SAFE' ? '✓ Cancelled (Safe)' : inc.alertStatus}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No emergency incidents recorded. System is secure and ready.
          </div>
        )}
      </div>

      {/* Interactive Map Modal */}
      <InteractiveMapModal
        isOpen={showMapModal}
        location={location}
        onClose={() => setShowMapModal(false)}
        onShareToContacts={handleShareLocation}
      />
    </div>
  );
};
