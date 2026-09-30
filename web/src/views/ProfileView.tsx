import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { webNotificationService } from '../services/WebNotificationService';
import { geolocationService } from '../services/GeolocationService';

interface ProfileViewProps {
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  onOpenAuth,
  onLogout,
}) => {
  const [micStatus, setMicStatus] = useState<'granted' | 'prompt' | 'denied' | 'unknown'>('unknown');
  const [geoStatus, setGeoStatus] = useState<'granted' | 'prompt' | 'denied' | 'unknown'>('unknown');
  const [notifStatus, setNotifStatus] = useState<string>('default');

  useEffect(() => {
    // Check Notification status
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifStatus(Notification.permission);
    }

    // Check Permissions API if supported
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'microphone' as any })
        .then((res) => setMicStatus(res.state as any))
        .catch(() => setMicStatus('unknown'));

      navigator.permissions
        .query({ name: 'geolocation' as any })
        .then((res) => setGeoStatus(res.state as any))
        .catch(() => setGeoStatus('unknown'));
    }
  }, []);

  const requestNotificationPermission = async () => {
    const granted = await webNotificationService.requestPermission();
    setNotifStatus(granted ? 'granted' : 'denied');
  };

  const requestGeolocationPermission = async () => {
    const res = await geolocationService.getCurrentPosition();
    if (res.success) {
      setGeoStatus('granted');
    } else {
      setGeoStatus('denied');
    }
  };

  if (!currentUser) {
    return (
      <div className="view-container">
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>User Profile &amp; Settings</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 440, margin: '0 auto 20px' }}>
            Log in to view your profile settings, configure audio threshold rules, and manage multi-device sync.
          </p>
          <button className="btn btn-primary" onClick={onOpenAuth}>
            Log In or Register
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      {/* Profile Header Card */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary) 0%, #1A73E8 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              fontWeight: 800,
              boxShadow: '0 4px 12px rgba(13, 82, 214, 0.25)',
            }}
          >
            {currentUser.fullName.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', marginBottom: 2 }}>
              {currentUser.fullName}
            </h2>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              {currentUser.mobileNumber} • {currentUser.email}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Account ID: <code>{currentUser.id}</code>
            </div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={onLogout}
            style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
          >
            Log Out
          </button>
        </div>
      </div>

      {/* Safety & Threshold Configuration */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">⚙️ Safety Engine Configuration</h3>
            <p className="card-subtitle">AI audio analysis and trigger parameters</p>
          </div>
          <span className="status-badge status-safe">Verified Settings</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
          <div style={{ padding: 12, background: 'var(--bg-app)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Sound Trigger Threshold</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Strict trigger condition: 90.0 dB does not trigger; 90.1+ dB triggers analysis
              </div>
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--danger)', fontFamily: 'monospace' }}>
              &gt; 90.0 dB
            </span>
          </div>

          <div style={{ padding: 12, background: 'var(--bg-app)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Human Voice Formant Filter</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Rejects non-human sounds (traffic horns, slams, construction, music)
              </div>
            </div>
            <span className="status-badge status-safe">Active (100 Hz – 3.5 kHz)</span>
          </div>

          <div style={{ padding: 12, background: 'var(--bg-app)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Distress Scream Frequency Band</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Vocal tract resonance concentration check
              </div>
            </div>
            <span className="status-badge status-safe">1.2 kHz – 4.0 kHz</span>
          </div>

          <div style={{ padding: 12, background: 'var(--bg-app)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Auto-Navigation Behavior</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Monitoring screen remains stable on sound trigger (zero unwanted navigation)
              </div>
            </div>
            <span className="status-badge status-safe">Permanent Screen Lock</span>
          </div>
        </div>
      </div>

      {/* Browser Permissions Status */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">🔒 Browser Hardware Permissions</h3>
            <p className="card-subtitle">Required browser APIs for acoustic safety and emergency location</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
          {/* Microphone */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: 'var(--bg-app)', borderRadius: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>🎙️ Microphone (Web Audio API)</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Required for real-time sound decibel monitoring</div>
            </div>
            <span className={`status-badge ${micStatus === 'granted' ? 'status-safe' : 'status-waiting'}`}>
              {micStatus === 'granted' ? 'Granted' : 'Click "Start Monitoring"'}
            </span>
          </div>

          {/* Geolocation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: 'var(--bg-app)', borderRadius: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>📍 Location (Geolocation API)</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Required to attach GPS coordinates to emergency alerts</div>
            </div>
            {geoStatus === 'granted' ? (
              <span className="status-badge status-safe">Granted</span>
            ) : (
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={requestGeolocationPermission}
              >
                Grant Access
              </button>
            )}
          </div>

          {/* Notifications */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: 'var(--bg-app)', borderRadius: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>🔔 Browser Notifications</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Shows immediate alerts on distress verification</div>
            </div>
            {notifStatus === 'granted' ? (
              <span className="status-badge status-safe">Granted</span>
            ) : (
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={requestNotificationPermission}
              >
                Enable Notifications
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Device Architecture Card */}
      <div className="card" style={{ marginTop: 20 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
          ☁️ User Data Isolation &amp; Multi-Device Access
        </h4>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
          Your profile, emergency family contacts, and incident logs are scoped exclusively to your unique User ID (<code>{currentUser.id}</code>). When accessing LifeGuard AI from other phones, laptops, or tablets, logging in with your mobile number or email synchronizes your designated emergency contacts and history securely.
        </p>
      </div>
    </div>
  );
};
