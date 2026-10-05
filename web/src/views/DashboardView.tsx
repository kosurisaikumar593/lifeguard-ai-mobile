import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ActiveTab,
  UserProfile,
  EmergencyContact,
  EmergencyIncident,
  GPSLocation,
  AppAlertPayload,
  LiveSoundCheckState,
  LiveSoundCheckStatus,
} from '../types';
import { audioMonitoringService } from '../services/AudioMonitoringService';
import { geolocationService } from '../services/GeolocationService';
import { cloudStorageService } from '../services/CloudStorageService';
import { emergencyAlertService } from '../services/EmergencyAlertService';
import { cloudInferenceService } from '../services/CloudInferenceService';
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
  const [waveformBars, setWaveformBars] = useState<number[]>(new Array(16).fill(0.08));
  const [checklist, setChecklist] = useState<LiveSoundCheckState>(
    audioMonitoringService.getChecklist()
  );
  const [showMapModal, setShowMapModal] = useState(false);
  const [activeAlert, setActiveAlert] = useState<AppAlertPayload | null>(null);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Leaflet embedded mini-map
  const miniMapRef = useRef<HTMLDivElement>(null);
  const leafletMapInstance = useRef<L.Map | null>(null);

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
    const unsubLevel = audioMonitoringService.onLevelUpdate((data, waveform) => {
      setCurrentDecibels(data.decibels);
      if (waveform && waveform.length === 16) {
        setWaveformBars(waveform);
      }
    });

    const unsubState = audioMonitoringService.onStateUpdate((_state, newChecklist) => {
      setChecklist(newChecklist);
    });

    const unsubAlert = emergencyAlertService.subscribe((alert) => {
      setActiveAlert(alert);
    });

    return () => {
      unsubLevel();
      unsubState();
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
      setLocError(res.error || 'Could not acquire GPS position.');
    }
  };

  useEffect(() => {
    handleFetchLocation();
  }, []);

  // Initialize embedded Leaflet map when location is available
  useEffect(() => {
    if (!location || !miniMapRef.current) return;

    const lat = location.latitude;
    const lng = location.longitude;

    if (leafletMapInstance.current) {
      leafletMapInstance.current.remove();
      leafletMapInstance.current = null;
    }

    const pinIcon = L.divIcon({
      className: 'mini-map-pin',
      html: `
        <div style="
          width: 24px;
          height: 24px;
          background: #0D52D6;
          border: 2.5px solid #FFFFFF;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(13, 82, 214, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFF;
          font-size: 12px;
        ">
          📍
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const map = L.map(miniMapRef.current, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    });

    leafletMapInstance.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
    }).addTo(map);

    L.marker([lat, lng], { icon: pinIcon }).addTo(map);

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      if (leafletMapInstance.current) {
        leafletMapInstance.current.remove();
        leafletMapInstance.current = null;
      }
    };
  }, [location]);

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

    // Record incident (Metadata only — strictly NO raw audio)
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

  const handleCopyLink = () => {
    if (!location) return;
    navigator.clipboard.writeText(location.googleMapsUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getStatusGlyph = (status: LiveSoundCheckStatus) => {
    switch (status) {
      case 'CONFIRMED':
        return { glyph: '✓', text: 'Confirmed', className: 'glyph-confirmed' };
      case 'CHECKING':
        return { glyph: '⟳', text: 'Analyzing API...', className: 'glyph-checking' };
      case 'NOT_DETECTED':
        return { glyph: '✗', text: 'Filtered / Normal', className: 'glyph-not-detected' };
      case 'UNAVAILABLE':
        return { glyph: '⚠', text: 'API Offline', className: 'glyph-unavailable' };
      case 'WAITING':
      default:
        return { glyph: '○', text: 'Waiting', className: 'glyph-waiting' };
    }
  };

  return (
    <div className="view-container">
      {/* Active App Alert Banner */}
      <ActiveAlertBanner alert={activeAlert} onViewMap={() => setShowMapModal(true)} />

      {/* Welcome Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #0D52D6 0%, #1A73E8 100%)', color: '#fff', border: 'none', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.18)', padding: '4px 10px', borderRadius: 20, fontSize: 12, marginBottom: 8 }}>
              <span className={isMonitoring ? 'live-dot' : ''} style={{ background: isMonitoring ? '#10B981' : '#94A3B8' }} />
              <span>{isMonitoring ? 'AI Audio Protection ACTIVE' : 'Audio Protection STANDBY'}</span>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
              {currentUser ? `Welcome back, ${currentUser.fullName}` : 'LifeGuard AI - Executive Safety'}
            </h2>
            <p style={{ opacity: 0.9, fontSize: 14 }}>
              Your Safety, Our Priority • Real-time acoustic safety &amp; direct app-to-app emergency response.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn-outline"
              style={{ background: 'rgba(255,255,255,0.18)', color: '#FFF', borderColor: 'rgba(255,255,255,0.35)', padding: '10px 16px', fontSize: 13 }}
              onClick={() => setShowMapModal(true)}
            >
              📍 Full Screen Map
            </button>
            {!currentUser && (
              <button className="btn btn-secondary" onClick={onOpenAuth}>
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Executive 2-Column Desktop Architecture */}
      <div className="executive-dashboard-grid">
        
        {/* ====================================================
            LEFT COLUMN: Live Monitoring & SOS Panel
           ==================================================== */}
        <div className="dashboard-col-left">
          
          {/* Card 1: Live Monitoring & Web Audio API Meter */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">🛡️ Live Sound Monitoring</h3>
                <p className="card-subtitle">Real-time Web Audio API meter sampling live decibels</p>
              </div>
              <span className={`status-badge ${isMonitoring ? 'status-safe' : 'status-waiting'}`}>
                {isMonitoring ? '● Active Listening' : '○ Standby'}
              </span>
            </div>

            {/* Meter Readout */}
            <div style={{ textAlign: 'center', margin: '14px 0', padding: 18, background: 'var(--bg-app)', borderRadius: 12 }}>
              <div style={{
                fontSize: 54,
                fontWeight: 900,
                fontFamily: 'monospace',
                lineHeight: 1,
                color: currentDecibels > 90 ? 'var(--danger)' : isMonitoring ? 'var(--primary)' : 'var(--text-muted)',
                transition: 'color 0.15s ease',
              }}>
                {isMonitoring ? currentDecibels.toFixed(1) : '0.0'}
                <span style={{ fontSize: 20, fontWeight: 700, marginLeft: 6, color: 'var(--text-muted)' }}>dB</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                Strict Trigger Filter: <strong style={{ color: 'var(--danger)' }}>&gt; 90.0 dB</strong>
                {currentDecibels > 90 && (
                  <span style={{ color: 'var(--danger)', fontWeight: 800, marginLeft: 6 }}>
                    [EVALUATING TRIGGER]
                  </span>
                )}
              </div>

              {/* 16-Bar Waveform */}
              <div className="waveform-container" style={{ height: 48, margin: '14px auto 0', maxWidth: 360 }}>
                {waveformBars.map((height, i) => (
                  <div
                    key={i}
                    className={`waveform-bar ${currentDecibels > 90 ? 'loud' : ''}`}
                    style={{
                      height: isMonitoring ? `${Math.max(8, height * 100)}%` : '8%',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Monitoring Controls */}
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                className={`btn ${isMonitoring ? 'btn-danger' : 'btn-primary'}`}
                style={{ flex: 1, padding: '12px 18px', fontSize: 14, fontWeight: 800 }}
                onClick={onToggleMonitoring}
              >
                {isMonitoring ? '⏹ Stop Protection' : '▶ Start Audio Monitoring'}
              </button>
            </div>

            {/* Dynamic 3-Tier Audio Analysis Pipeline Checklist */}
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Dynamic 3-Tier Audio Analysis Pipeline:
                </span>
                <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700 }}>
                  API-Only Structure
                </span>
              </div>

              <div className="checklist-container" style={{ border: 'none', padding: 0, margin: 0 }}>
                {/* 1. Sound detected */}
                {(() => {
                  const item = getStatusGlyph(checklist.soundDetected);
                  return (
                    <div className="checklist-item" style={{ padding: '10px 14px' }}>
                      <div className="checklist-label">
                        <span className={`checklist-glyph ${item.className}`}>{item.glyph}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>Sound detected</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Web Audio API ambient input &ge; 35 dB</div>
                        </div>
                      </div>
                      <span className={`badge ${checklist.soundDetected === 'CONFIRMED' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 11 }}>
                        {item.text}
                      </span>
                    </div>
                  );
                })()}

                {/* 2. Level > 90 dB */}
                {(() => {
                  const item = getStatusGlyph(checklist.above90dB);
                  return (
                    <div className="checklist-item" style={{ padding: '10px 14px' }}>
                      <div className="checklist-label">
                        <span className={`checklist-glyph ${item.className}`}>{item.glyph}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>Level &gt; 90 dB</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Strict evaluation trigger: &gt; 90.0 dB threshold filter</div>
                        </div>
                      </div>
                      <span className={`badge ${checklist.above90dB === 'CONFIRMED' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: 11 }}>
                        {item.text}
                      </span>
                    </div>
                  );
                })()}

                {/* 3. Human sound vs. Environmental sound check (API integration structure) */}
                {(() => {
                  const item = getStatusGlyph(checklist.humanSound);
                  return (
                    <div className="checklist-item" style={{ padding: '10px 14px' }}>
                      <div className="checklist-label">
                        <span className={`checklist-glyph ${item.className}`}>{item.glyph}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>Human sound vs. Environmental check</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            API integration structure: Formant resonance filter
                          </div>
                        </div>
                      </div>
                      <span className={`badge ${checklist.humanSound === 'CONFIRMED' ? 'badge-success' : checklist.humanSound === 'NOT_DETECTED' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: 11 }}>
                        {item.text}
                      </span>
                    </div>
                  );
                })()}

                {/* 4. AI Scream / Distress Analysis (API integration structure) */}
                {(() => {
                  const item = getStatusGlyph(checklist.distressScream);
                  return (
                    <div className="checklist-item" style={{ padding: '10px 14px' }}>
                      <div className="checklist-label">
                        <span className={`checklist-glyph ${item.className}`}>{item.glyph}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>AI Scream / Distress Analysis</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            API integration structure: 1.2 kHz - 4.0 kHz cloud inference
                          </div>
                        </div>
                      </div>
                      <span className={`badge ${checklist.distressScream === 'CONFIRMED' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: 11 }}>
                        {item.text}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Test Simulation Suite */}
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
                🧪 Quick Pipeline Simulation Stream:
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-outline"
                  style={{ flex: 1, padding: '7px 10px', fontSize: 11, borderColor: 'var(--danger)', color: 'var(--danger)', minWidth: 130 }}
                  onClick={() => audioMonitoringService.simulateAcousticEvent('SCREAM_95DB')}
                >
                  ▶ Distress Scream (95 dB)
                </button>
                <button
                  className="btn btn-outline"
                  style={{ flex: 1, padding: '7px 10px', fontSize: 11, borderColor: '#D97706', color: '#D97706', minWidth: 130 }}
                  onClick={() => audioMonitoringService.simulateAcousticEvent('ENVIRONMENTAL_HORN_92DB')}
                >
                  ▶ Horn Noise (92 dB)
                </button>
                <button
                  className="btn btn-outline"
                  style={{ flex: 1, padding: '7px 10px', fontSize: 11, minWidth: 110 }}
                  onClick={() => audioMonitoringService.simulateAcousticEvent('NORMAL_TALK_65DB')}
                >
                  ▶ Speech (65 dB)
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Prominent Emergency SOS Panel */}
          <div className="card" style={{ border: '2px solid var(--danger-light)', background: 'var(--bg-card)' }}>
            <div className="card-header">
              <div>
                <h3 className="card-title" style={{ color: 'var(--danger)' }}>🚨 Emergency SOS Trigger</h3>
                <p className="card-subtitle">Manual trigger arms 5-second buffer before instant broadcast</p>
              </div>
              <span className="badge badge-danger">High Priority</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--danger-light)', borderRadius: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--danger)' }}>
                  Instant Distress Broadcast
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-main)', marginTop: 2 }}>
                  Dispatches verified GPS coordinates to all connected contacts
                </div>
              </div>
              <button
                className="btn btn-danger"
                style={{ padding: '12px 24px', fontSize: 15, fontWeight: 800 }}
                onClick={onRequestSOS}
              >
                HOLD / TRIGGER SOS
              </button>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              🛡️ <strong>Safety Safeguard:</strong> Triggering activates the clean <strong>5-second emergency buffer modal</strong> with an immediate <strong>"I'm Safe"</strong> button to cancel false alarms.
            </div>
          </div>
        </div>

        {/* ====================================================
            RIGHT COLUMN: GPS Location Preview & Trusted Contacts
           ==================================================== */}
        <div className="dashboard-col-right">
          
          {/* Card 1: GPS Location Preview & Embedded Interactive Map */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">📍 Live GPS Location Sharing</h3>
                <p className="card-subtitle">Interactive Leaflet preview &amp; valid GPS payload</p>
              </div>
              <button
                onClick={handleFetchLocation}
                disabled={locLoading}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
              >
                {locLoading ? '⟳ Locating...' : 'Refresh ↻'}
              </button>
            </div>

            {/* Embedded Mini Leaflet Map Preview */}
            <div
              ref={miniMapRef}
              style={{
                height: 180,
                width: '100%',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
                marginBottom: 14,
              }}
            />

            {location ? (
              <div style={{ padding: 12, background: 'var(--bg-app)', borderRadius: 10, marginBottom: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Latitude</span>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>{location.latitude.toFixed(6)}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Longitude</span>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>{location.longitude.toFixed(6)}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--success)', fontWeight: 700 }}>Accuracy: &plusmn;{location.accuracy}m</span>
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                    onClick={handleCopyLink}
                  >
                    {copiedLink ? '✓ Copied!' : 'Copy Google Maps URL ↗'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: 16, textAlign: 'center', background: 'var(--bg-app)', borderRadius: 10, fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                {locError ? <span style={{ color: 'var(--danger)' }}>{locError}</span> : 'Acquiring browser GPS coordinates...'}
              </div>
            )}

            {/* Share My Location Action Shortcut */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, padding: '11px 16px', fontSize: 14 }}
                onClick={handleShareLocation}
              >
                📡 Share My Location
              </button>
              <button
                className="btn btn-outline"
                style={{ padding: '11px 16px', fontSize: 14 }}
                onClick={() => setShowMapModal(true)}
              >
                🗺️ Expand Map
              </button>
            </div>

            {shareSuccess && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--success-light)', color: 'var(--success)', borderRadius: 6, fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
                ✓ GPS payload shared directly with connected contacts!
              </div>
            )}
          </div>

          {/* Card 2: Connected Trusted Contacts (Standalone App-to-App) */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">👥 Connected Trusted Contacts</h3>
                <p className="card-subtitle">Standalone app-to-app alerting (No WhatsApp)</p>
              </div>
              <button
                onClick={() => onNavigate('contacts')}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
              >
                Manage ({contacts.length}) →
              </button>
            </div>

            {contacts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {contacts.slice(0, 2).map((contact) => (
                  <div
                    key={contact.id}
                    style={{
                      padding: 12,
                      background: 'var(--bg-app)',
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15 }}>
                        {contact.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>
                          {contact.name} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({contact.relationship})</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {contact.lastActive || 'Active on LifeGuard'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span className={`badge ${contact.connectionState === 'Connected' ? 'badge-success' : 'badge-warning'}`}>
                        ● {contact.connectionState || 'Connected'}
                      </span>
                      <button
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                        onClick={() => {
                          emergencyAlertService.dispatchAlert({
                            user: currentUser!,
                            contacts: [contact],
                            type: 'MANUAL_SOS',
                            location,
                          });
                        }}
                      >
                        Ping Alert
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 18, textAlign: 'center', background: 'var(--bg-app)', borderRadius: 10 }}>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
                  Zero connected contacts.
                </p>
                <button className="btn btn-primary" onClick={() => onNavigate('contacts')} style={{ padding: '8px 14px', fontSize: 12 }}>
                  + Connect Safety Contact
                </button>
              </div>
            )}
          </div>

          {/* Card 3: Recent Incident Activity (Metadata Only) */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">📋 Incident Activity Log</h3>
                <p className="card-subtitle">Metadata only (Timestamps, GPS, Badges — Zero audio)</p>
              </div>
              <button
                onClick={() => onNavigate('history')}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
              >
                All →
              </button>
            </div>

            {recentIncidents.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 10,
                      background: 'var(--bg-app)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                        {inc.incidentType === 'AI_DETECTED'
                          ? 'AI Distress Incident'
                          : inc.incidentType === 'LOCATION_SHARE'
                          ? 'Live Location Share'
                          : 'Manual SOS Broadcast'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span className={`badge ${inc.alertStatus === 'CANCELLED_SAFE' ? 'badge-warning' : 'badge-success'}`}>
                      {inc.alertStatus === 'CANCELLED_SAFE' ? 'Cancelled (Safe)' : inc.alertStatus}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                No incidents recorded. System is secure.
              </div>
            )}
          </div>
        </div>
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
