import React, { useState, useEffect } from 'react';
import { UserProfile, ThemeMode, PermissionState } from '../types';
import { webNotificationService } from '../services/WebNotificationService';
import { geolocationService } from '../services/GeolocationService';
import { themeService } from '../services/ThemeService';
import { cloudInferenceService } from '../services/CloudInferenceService';

interface ProfileViewProps {
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  isSimulatedOffline?: boolean;
  onToggleSimulateOffline?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  onOpenAuth,
  onLogout,
  isSimulatedOffline,
  onToggleSimulateOffline,
}) => {
  const [micStatus, setMicStatus] = useState<PermissionState>('prompt');
  const [geoStatus, setGeoStatus] = useState<PermissionState>('prompt');
  const [notifStatus, setNotifStatus] = useState<string>('default');
  const [themeMode, setThemeMode] = useState<ThemeMode>(themeService.getMode());
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(themeService.getResolvedTheme());
  const [cloudEndpoint, setCloudEndpoint] = useState<string>(cloudInferenceService.getEndpoint());
  const [cloudApiKey, setCloudApiKey] = useState<string>(cloudInferenceService.getApiKey());
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [apiSaveStatus, setApiSaveStatus] = useState<string | null>(null);

  const checkPermissions = async () => {
    // 1. Notification
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifStatus(Notification.permission);
    }

    // 2. Microphone & Geolocation via Permissions API
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const mic = await navigator.permissions.query({ name: 'microphone' as any });
        setMicStatus(mic.state as PermissionState);
        mic.onchange = () => setMicStatus(mic.state as PermissionState);
      } catch {
        setMicStatus('prompt');
      }

      try {
        const geo = await navigator.permissions.query({ name: 'geolocation' as any });
        setGeoStatus(geo.state as PermissionState);
        geo.onchange = () => setGeoStatus(geo.state as PermissionState);
      } catch {
        setGeoStatus('prompt');
      }
    }
  };

  useEffect(() => {
    checkPermissions();
    return themeService.subscribe((mode, resolved) => {
      setThemeMode(mode);
      setResolvedTheme(resolved);
    });
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

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicStatus('granted');
    } catch {
      setMicStatus('denied');
    }
  };

  const handleThemeChange = (mode: ThemeMode) => {
    themeService.setMode(mode);
  };

  if (!currentUser) {
    return (
      <div className="view-container">
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>User Profile &amp; Settings</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 440, margin: '0 auto 20px' }}>
            Log in to view your profile settings, configure audio threshold rules, and manage hardware permissions.
          </p>
          <button className="btn btn-primary" onClick={onOpenAuth}>
            Log In or Register
          </button>
        </div>
      </div>
    );
  }

  const hasDeniedPermissions = micStatus === 'denied' || geoStatus === 'denied';

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
              boxShadow: '0 4px 12px var(--primary-glow)',
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
              LifeGuard Account ID: <code>{currentUser.id}</code>
            </div>
          </div>
          <button
            className="btn btn-outline"
            onClick={onLogout}
            style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
          >
            Log Out
          </button>
        </div>
      </div>

      {/* Dedicated Hardware Permissions Step (Feature 6 & 7) */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">🔒 Dedicated Hardware Permissions Step</h3>
            <p className="card-subtitle">Explicit permission status check required before activating protection</p>
          </div>
          <button
            onClick={checkPermissions}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
          >
            Re-check Permissions ↻
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
          {/* Microphone */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, background: 'var(--bg-app)', borderRadius: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>🎙️ Microphone (Web Audio API)</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Required for real-time ambient decibel sampling and distress classification</div>
            </div>
            {micStatus === 'granted' ? (
              <span className="badge badge-success">✓ Granted</span>
            ) : micStatus === 'denied' ? (
              <span className="badge badge-danger">✗ Denied</span>
            ) : (
              <button
                className="btn btn-primary"
                style={{ padding: '6px 14px', fontSize: 12 }}
                onClick={requestMicPermission}
              >
                Grant Microphone
              </button>
            )}
          </div>

          {/* Location */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, background: 'var(--bg-app)', borderRadius: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>📍 Device Location (GPS API)</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Required to attach verified GPS coordinates and interactive maps to emergency dispatches</div>
            </div>
            {geoStatus === 'granted' ? (
              <span className="badge badge-success">✓ Granted</span>
            ) : geoStatus === 'denied' ? (
              <span className="badge badge-danger">✗ Denied</span>
            ) : (
              <button
                className="btn btn-primary"
                style={{ padding: '6px 14px', fontSize: 12 }}
                onClick={requestGeolocationPermission}
              >
                Grant Location
              </button>
            )}
          </div>

          {/* Web Notifications */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, background: 'var(--bg-app)', borderRadius: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>🔔 System Notifications</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Alerts you if distress is classified while browsing other tabs</div>
            </div>
            {notifStatus === 'granted' ? (
              <span className="badge badge-success">✓ Granted</span>
            ) : (
              <button
                className="btn btn-outline"
                style={{ padding: '6px 14px', fontSize: 12 }}
                onClick={requestNotificationPermission}
              >
                Enable Notifications
              </button>
            )}
          </div>
        </div>

        {/* Step-by-Step Permission Denied Guidance (Feature 7) */}
        {hasDeniedPermissions && (
          <div style={{ marginTop: 16, padding: 14, background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 10 }}>
            <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--danger)', marginBottom: 6 }}>
              ⚠️ Permissions Denied — How to Re-enable in Browser:
            </h4>
            <ol style={{ fontSize: 12, color: 'var(--text-main)', paddingLeft: 18, lineHeight: 1.6 }}>
              <li>Click the <strong>Lock / Tune icon</strong> located on the left of the browser URL bar.</li>
              <li>Toggle <strong>Microphone</strong> and <strong>Location</strong> to <strong>"Allow"</strong>.</li>
              <li>Click the <strong>"Re-check Permissions"</strong> button above or reload the page.</li>
            </ol>
          </div>
        )}
      </div>

      {/* Dynamic Day & Night Theme Selection (Feature 5) */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">🌓 Dynamic Day &amp; Night Safety Theme</h3>
            <p className="card-subtitle">Automatic 6:00 PM time-based switching or manual override</p>
          </div>
          <span className="badge badge-primary">
            Active: {resolvedTheme === 'dark' ? 'Night (#0F172A)' : 'Day (#F8FAFC)'}
          </span>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          Theme changes are purely visual and do not pause, restart, or reset active audio monitoring services.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <button
            className={`btn ${themeMode === 'auto' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '12px 14px', fontSize: 13 }}
            onClick={() => handleThemeChange('auto')}
          >
            ⏱️ Automatic (Time-Based)
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
              Day before 6 PM / Night after 6 PM
            </div>
          </button>

          <button
            className={`btn ${themeMode === 'day' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '12px 14px', fontSize: 13 }}
            onClick={() => handleThemeChange('day')}
          >
            ☀️ Force Day Mode
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
              Light Background (#F8FAFC)
            </div>
          </button>

          <button
            className={`btn ${themeMode === 'night' ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '12px 14px', fontSize: 13 }}
            onClick={() => handleThemeChange('night')}
          >
            🌙 Force Night Safety Mode
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
              High-contrast Dark Slate (#0F172A)
            </div>
          </button>
        </div>
      </div>

      {/* API-Only Infrastructure & Cloud Inference Configuration */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">☁️ Remote Cloud AI Inference API</h3>
            <p className="card-subtitle">API-only architecture — zero local/on-device model training</p>
          </div>
          <span className="badge badge-success">
            {cloudApiKey ? 'API Key Configured' : 'Deterministic Fallback Active'}
          </span>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          LifeGuard AI extracts lightweight audio descriptors (RMS, formants, decibels) in the browser and sends them to your remote AI inference endpoint. Lightweight and secure, avoiding browser lag.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--text-main)' }}>
              Inference Endpoint URL
            </label>
            <input
              type="text"
              className="input-field"
              value={cloudEndpoint}
              onChange={(e) => setCloudEndpoint(e.target.value)}
              placeholder="https://api.lifeguard.ai/v1/audio/infer"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--text-main)' }}>
              Cloud API Key
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                className="input-field"
                value={cloudApiKey}
                onChange={(e) => setCloudApiKey(e.target.value)}
                placeholder="Enter Cloud AI / Gemini / LifeGuard API Key"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '8px 12px', fontSize: 12 }}
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <button
              className="btn btn-primary"
              style={{ padding: '8px 20px', fontSize: 13 }}
              onClick={() => {
                cloudInferenceService.setEndpoint(cloudEndpoint);
                cloudInferenceService.setApiKey(cloudApiKey);
                setApiSaveStatus('Settings saved successfully!');
                setTimeout(() => setApiSaveStatus(null), 3000);
              }}
            >
              Save API Configuration
            </button>
            {apiSaveStatus && (
              <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 700 }}>
                ✓ {apiSaveStatus}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Privacy & Zero-Audio Storage Safeguards */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">🛡️ Privacy &amp; Data Safeguards</h3>
            <p className="card-subtitle">Strict metadata-only telemetry policy</p>
          </div>
          <span className="badge badge-primary">Zero Audio Storage</span>
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-main)', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 8px 0' }}>
            <strong>LifeGuard AI guarantees complete privacy:</strong>
          </p>
          <ul style={{ paddingLeft: 20, margin: 0, color: 'var(--text-muted)' }}>
            <li>No raw audio streams or voice recordings are ever stored or cached on-device.</li>
            <li>No microphone audio is ever uploaded to permanent media storage.</li>
            <li>Emergency incident logs contain strictly operational metadata: exact timestamp, GPS coordinates, interactive map URL, and delivery status.</li>
          </ul>
        </div>
      </div>

      {/* Fault-Tolerant Edge Testing Suite (Feature 7) */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">🧪 Edge State &amp; Fault-Tolerance Simulation</h3>
            <p className="card-subtitle">Verify offline fallback screens and fault handling</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, background: 'var(--bg-app)', borderRadius: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>Simulate Offline Mode</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Tests the offline warning banner and local fallback audio state
            </div>
          </div>
          <button
            className={`btn ${isSimulatedOffline ? 'btn-danger' : 'btn-outline'}`}
            style={{ padding: '8px 16px', fontSize: 13 }}
            onClick={onToggleSimulateOffline}
          >
            {isSimulatedOffline ? 'Disable Simulation' : 'Simulate Offline'}
          </button>
        </div>
      </div>
    </div>
  );
};
