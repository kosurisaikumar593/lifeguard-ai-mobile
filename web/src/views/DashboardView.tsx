import React, { useState, useEffect } from 'react';
import { ActiveTab, UserProfile, EmergencyContact, EmergencyIncident, GPSLocation } from '../types';
import { audioMonitoringService } from '../services/AudioMonitoringService';
import { geolocationService } from '../services/GeolocationService';
import { cloudStorageService } from '../services/CloudStorageService';

interface DashboardViewProps {
  currentUser: UserProfile | null;
  onNavigate: (tab: ActiveTab) => void;
  onOpenAuth: () => void;
  isMonitoring: boolean;
  onToggleMonitoring: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  onNavigate,
  onOpenAuth,
  isMonitoring,
  onToggleMonitoring,
}) => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<EmergencyIncident[]>([]);
  const [location, setLocation] = useState<GPSLocation | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [currentDecibels, setCurrentDecibels] = useState<number>(0);

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
    // Listen for level updates when monitoring is active
    const unsubscribe = audioMonitoringService.onLevelUpdate((data) => {
      setCurrentDecibels(data.decibels);
    });
    return () => unsubscribe();
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

  const primaryContact = contacts[0] || null;

  return (
    <div className="view-container">
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
              Real-time acoustic safety, emergency response, and verified location sharing.
            </p>
          </div>
          {!currentUser && (
            <button className="btn btn-secondary" onClick={onOpenAuth} style={{ alignSelf: 'flex-start' }}>
              Sign In / Register
            </button>
          )}
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
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)'
            }}>
              🚨
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger)', marginBottom: 2 }}>
                Instant Emergency SOS
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Tap to broadcast emergency alerts with live GPS location to your family contacts.
              </p>
            </div>
          </div>
          <button
            className="btn btn-danger"
            style={{ padding: '12px 24px', fontSize: 15, fontWeight: 700 }}
            onClick={() => onNavigate('sos')}
          >
            Open SOS Trigger
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
              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>90.0 dB Alert Threshold</span>
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
              Live Visualizer →
            </button>
          </div>
        </div>

        {/* Card: Live GPS Status */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">📍 Live GPS Coordinates</h3>
              <p className="card-subtitle">Real-time device Geolocation API</p>
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
                <span>GPS Accuracy: ±{location.accuracy} meters</span>
                <a
                  href={location.googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}
                >
                  View on Google Maps ↗
                </a>
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

          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Coordinates are automatically attached to all WhatsApp SOS broadcasts and verified emergency incidents.
          </p>
        </div>

        {/* Card: Emergency Family Contacts */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">👥 Primary Emergency Contact</h3>
              <p className="card-subtitle">Receives automated WhatsApp emergency alerts</p>
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
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-main)' }}>
                    {primaryContact.name} ({primaryContact.relationship})
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {primaryContact.phoneNumber}
                  </div>
                </div>
              </div>
              <span className="status-badge status-safe">Priority 1</span>
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: 'center', background: 'var(--bg-app)', borderRadius: 10, marginTop: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                No emergency contacts registered yet.
              </p>
              <button className="btn btn-primary" onClick={() => onNavigate('contacts')} style={{ padding: '8px 16px', fontSize: 13 }}>
                + Add Emergency Contact
              </button>
            </div>
          )}
        </div>

        {/* Card: Safety Pipeline Architecture */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">⚙️ Safety Verification Pipeline</h3>
              <p className="card-subtitle">Multi-stage false alarm filtering</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '6px 10px', background: 'var(--bg-app)', borderRadius: 6 }}>
              <span style={{ color: 'var(--primary)', fontWeight: 800 }}>1</span>
              <span>Sound Threshold: strictly &gt; 90.0 dB</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '6px 10px', background: 'var(--bg-app)', borderRadius: 6 }}>
              <span style={{ color: 'var(--purple)', fontWeight: 800 }}>2</span>
              <span>Human Vocal Formant Check (100 Hz – 3.5 kHz)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '6px 10px', background: 'var(--bg-app)', borderRadius: 6 }}>
              <span style={{ color: 'var(--warning)', fontWeight: 800 }}>3</span>
              <span>Distress & Scream Spectral Check (1.2 kHz – 4 kHz)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '6px 10px', background: 'var(--bg-app)', borderRadius: 6 }}>
              <span style={{ color: 'var(--danger)', fontWeight: 800 }}>4</span>
              <span>Emergency Verification & Instant WhatsApp Dispatch</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Incidents Section */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">📋 Recent Incident Activity</h3>
            <p className="card-subtitle">Verified emergency events and manual SOS triggers</p>
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
                    {inc.incidentType === 'AI_DETECTED' ? 'AI Sound Detection' : 'Manual SOS Trigger'}
                    {inc.decibels ? ` (${inc.decibels.toFixed(1)} dB)` : ''}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(inc.createdAt).toLocaleString()}
                  </div>
                </div>
                <span className={`status-badge ${inc.alertStatus === 'OPENED_IN_WHATSAPP' || inc.alertStatus === 'ALERT_SENT' ? 'status-safe' : 'status-danger'}`}>
                  {inc.alertStatus}
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
    </div>
  );
};
