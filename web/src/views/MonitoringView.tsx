import React, { useState, useEffect, useRef } from 'react';
import {
  MonitoringState,
  LiveSoundCheckState,
  LiveSoundCheckStatus,
  SoundLevelData,
  UserProfile,
  EmergencyContact,
  GPSLocation,
} from '../types';
import { audioMonitoringService } from '../services/AudioMonitoringService';
import { geolocationService } from '../services/GeolocationService';
import { cloudStorageService } from '../services/CloudStorageService';
import { whatsAppService } from '../services/WhatsAppService';
import { webNotificationService } from '../services/WebNotificationService';

interface MonitoringViewProps {
  currentUser: UserProfile | null;
  isMonitoring: boolean;
  onToggleMonitoring: () => void;
}

export const MonitoringView: React.FC<MonitoringViewProps> = ({
  currentUser,
  isMonitoring,
  onToggleMonitoring,
}) => {
  const [monitoringState, setMonitoringState] = useState<MonitoringState>(
    audioMonitoringService.getState()
  );
  const [checklist, setChecklist] = useState<LiveSoundCheckState>(
    audioMonitoringService.getChecklist()
  );
  const [soundData, setSoundData] = useState<SoundLevelData>({
    decibels: audioMonitoringService.getCurrentDecibels(),
    normalizedLevel: 0,
    isLoud: false,
    timestamp: new Date().toISOString(),
  });
  const [waveformBars, setWaveformBars] = useState<number[]>(new Array(16).fill(0));
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [gpsLocation, setGpsLocation] = useState<GPSLocation | null>(null);
  const [lastAlertSentTime, setLastAlertSentTime] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Keep a stable ref so emergency callback never captures stale props
  const userRef = useRef<UserProfile | null>(currentUser);
  userRef.current = currentUser;
  const contactsRef = useRef<EmergencyContact[]>(contacts);
  contactsRef.current = contacts;

  // Load contacts
  useEffect(() => {
    if (currentUser) {
      cloudStorageService.getContacts(currentUser.id).then(setContacts);
    }
  }, [currentUser]);

  // Fetch current GPS location silently
  useEffect(() => {
    geolocationService.getCurrentPosition().then((res) => {
      if (res.success && res.location) {
        setGpsLocation(res.location);
      }
    });
  }, []);

  // Subscribe to real-time audio monitoring updates
  // CRITICAL: This NEVER triggers route navigation. It only updates component local state.
  useEffect(() => {
    const unsubLevel = audioMonitoringService.onLevelUpdate((data, waveform) => {
      setSoundData(data);
      if (waveform && waveform.length === 16) {
        setWaveformBars(waveform);
      }
    });

    const unsubState = audioMonitoringService.onStateUpdate((state, newChecklist) => {
      setMonitoringState(state);
      setChecklist(newChecklist);
    });

    const unsubEmergency = audioMonitoringService.onEmergencyVerified(async (event) => {
      const user = userRef.current;
      const contactList = contactsRef.current;

      // 1. Send browser notification
      webNotificationService.notifyEmergency(
        'LifeGuard AI – Emergency Verified!',
        `Loud sound detected (${event.decibels.toFixed(1)} dB). Please verify user safety.`
      );

      // 2. Refresh GPS coordinates for the alert
      let loc = gpsLocation;
      const locRes = await geolocationService.getCurrentPosition();
      if (locRes.success && locRes.location) {
        loc = locRes.location;
        setGpsLocation(loc);
      }

      // 3. Save incident to cloud storage if user is logged in
      if (user) {
        await cloudStorageService.createIncident(user.id, {
          incidentType: 'AI_DETECTED',
          detectionResult: 'SCREAM',
          soundLevel: event.soundLevel,
          decibels: event.decibels,
          confidence: 0.95,
          humanSoundStatus: 'HUMAN_DETECTED',
          latitude: loc?.latitude,
          longitude: loc?.longitude,
          locationAccuracy: loc?.accuracy,
          alertStatus: contactList.length > 0 ? 'OPENED_IN_WHATSAPP' : 'NO_CONTACTS',
        });
      }

      // 4. Dispatch WhatsApp to primary contact if available
      if (contactList.length > 0 && user) {
        const primary = contactList[0];
        whatsAppService.dispatchAlert(
          primary,
          user,
          `Verified Distress Scream (${event.decibels.toFixed(1)} dB > 90.0 dB threshold)`,
          loc
        );
        setLastAlertSentTime(new Date().toLocaleTimeString());
      }
    });

    return () => {
      unsubLevel();
      unsubState();
      unsubEmergency();
    };
  }, []);

  const handleToggle = async () => {
    setErrorMessage(null);
    if (isMonitoring) {
      await audioMonitoringService.stopMonitoring();
      onToggleMonitoring();
    } else {
      const res = await audioMonitoringService.startMonitoring();
      if (res.success) {
        onToggleMonitoring();
      } else {
        setErrorMessage(res.error || 'Failed to start microphone monitoring.');
      }
    }
  };

  const getStatusGlyph = (status: LiveSoundCheckStatus) => {
    switch (status) {
      case 'CONFIRMED':
        return { glyph: '✓', text: 'Confirmed', className: 'status-confirmed' };
      case 'CHECKING':
        return { glyph: '⟳', text: 'Checking...', className: 'status-checking' };
      case 'NOT_DETECTED':
        return { glyph: '✗', text: 'Not detected', className: 'status-not-detected' };
      case 'UNAVAILABLE':
        return { glyph: '⚠', text: 'Unavailable', className: 'status-unavailable' };
      case 'WAITING':
      default:
        return { glyph: '○', text: 'Waiting', className: 'status-waiting' };
    }
  };

  return (
    <div className="view-container">
      {/* Notice regarding page stability */}
      <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>🛡️</span>
        <span style={{ fontSize: 13, color: 'var(--primary-dark)', fontWeight: 500 }}>
          <strong>Continuous Protection Mode:</strong> This monitoring screen remains permanently open and active during loud sound events. It will <em>never</em> automatically navigate back to Home.
        </span>
      </div>

      {errorMessage && (
        <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {errorMessage}
        </div>
      )}

      {/* Main Monitoring Gauge Card */}
      <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, background: isMonitoring ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)', color: isMonitoring ? 'var(--safe)' : 'var(--text-muted)', fontWeight: 700, fontSize: 13, marginBottom: 16 }}>
          <span className={isMonitoring ? 'live-dot' : ''} style={{ background: isMonitoring ? 'var(--safe)' : 'var(--text-muted)' }} />
          <span>{isMonitoring ? 'MONITORING ACTIVE — LISTENING' : 'AUDIO MONITORING STOPPED'}</span>
        </div>

        {/* Big Decibel Meter */}
        <div style={{ margin: '16px 0' }}>
          <div style={{
            fontSize: 64,
            fontWeight: 900,
            fontFamily: 'monospace',
            lineHeight: 1,
            color: soundData.decibels > 90 ? 'var(--danger)' : isMonitoring ? 'var(--primary)' : 'var(--text-muted)',
            transition: 'color 0.15s ease',
          }}>
            {isMonitoring ? soundData.decibels.toFixed(1) : '0.0'}
            <span style={{ fontSize: 24, fontWeight: 600, marginLeft: 6, color: 'var(--text-muted)' }}>dB</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
            Threshold: strictly <strong style={{ color: 'var(--danger)' }}>&gt; 90.0 dB</strong>
            {soundData.decibels > 90 && (
              <span style={{ color: 'var(--danger)', fontWeight: 800, marginLeft: 8 }}>
                [ABOVE 90 dB THRESHOLD]
              </span>
            )}
          </div>
        </div>

        {/* 16-Bar Responsive Equalizer Waveform */}
        <div className="audio-visualizer-bars" style={{ maxWidth: 460, margin: '24px auto', height: 60 }}>
          {waveformBars.map((height, i) => (
            <div
              key={i}
              className="waveform-bar"
              style={{
                height: isMonitoring ? `${Math.max(8, height * 100)}%` : '8%',
                background: soundData.decibels > 90 ? 'var(--danger)' : undefined,
              }}
            />
          ))}
        </div>

        {/* Control Button */}
        <div style={{ marginTop: 20 }}>
          <button
            className={`btn ${isMonitoring ? 'btn-danger' : 'btn-primary'}`}
            style={{ padding: '14px 36px', fontSize: 16, fontWeight: 700, minWidth: 220 }}
            onClick={handleToggle}
          >
            {isMonitoring ? '⏹ Stop Audio Monitoring' : '▶ Start Audio Monitoring'}
          </button>
        </div>
      </div>

      {/* LIVE SOUND CHECK Checklist */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">🔍 LIVE SOUND CHECK</h3>
            <p className="card-subtitle">Real-time multi-stage verification status</p>
          </div>
          <span className="status-badge status-safe" style={{ fontSize: 11 }}>
            Strict &gt; 90.0 dB Rule
          </span>
        </div>

        <div className="sound-check-list" style={{ marginTop: 16 }}>
          {/* Step 1: Sound Detected */}
          {(() => {
            const item = getStatusGlyph(checklist.soundDetected);
            return (
              <div className="sound-check-item">
                <span className={`check-glyph ${item.className}`}>{item.glyph}</span>
                <div className="check-text">
                  <div className="check-title">1. Sound Detected</div>
                  <div className="check-desc">Audio input received via browser microphone API</div>
                </div>
                <span className={`check-status-badge ${item.className}`}>{item.text}</span>
              </div>
            );
          })()}

          {/* Step 2: Above 90 dB */}
          {(() => {
            const item = getStatusGlyph(checklist.above90dB);
            return (
              <div className="sound-check-item">
                <span className={`check-glyph ${item.className}`}>{item.glyph}</span>
                <div className="check-text">
                  <div className="check-title">2. Above 90.0 dB Threshold</div>
                  <div className="check-desc">
                    Strict trigger: 90.0 dB does not trigger; 90.1+ dB triggers analysis
                  </div>
                </div>
                <span className={`check-status-badge ${item.className}`}>{item.text}</span>
              </div>
            );
          })()}

          {/* Step 3: Human Sound Check */}
          {(() => {
            const item = getStatusGlyph(checklist.humanSound);
            return (
              <div className="sound-check-item">
                <span className={`check-glyph ${item.className}`}>{item.glyph}</span>
                <div className="check-text">
                  <div className="check-title">3. Human Sound Check</div>
                  <div className="check-desc">
                    {checklist.humanSoundReason ||
                      'Spectral classification distinguishes vocal formants from environmental noises (horns, slams, construction)'}
                  </div>
                </div>
                <span className={`check-status-badge ${item.className}`}>{item.text}</span>
              </div>
            );
          })()}

          {/* Step 4: Distress / Scream Check */}
          {(() => {
            const item = getStatusGlyph(checklist.distressScream);
            return (
              <div className="sound-check-item">
                <span className={`check-glyph ${item.className}`}>{item.glyph}</span>
                <div className="check-text">
                  <div className="check-title">4. Distress &amp; Scream Analysis</div>
                  <div className="check-desc">
                    {checklist.screamReason ||
                      'High-frequency vocal tract resonance check (1.2 kHz - 4.0 kHz scream band)'}
                  </div>
                </div>
                <span className={`check-status-badge ${item.className}`}>{item.text}</span>
              </div>
            );
          })()}

          {/* Step 5: Emergency Verified */}
          {(() => {
            const item = getStatusGlyph(checklist.emergencyVerified);
            return (
              <div className="sound-check-item">
                <span className={`check-glyph ${item.className}`}>{item.glyph}</span>
                <div className="check-text">
                  <div className="check-title">5. Emergency Verification</div>
                  <div className="check-desc">
                    {checklist.verificationReason ||
                      'Confirmed emergency state — prepares immediate family contact alert'}
                  </div>
                </div>
                <span className={`check-status-badge ${item.className}`}>{item.text}</span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Emergency Action & WhatsApp Dispatch Status */}
      {checklist.emergencyVerified === 'CONFIRMED' && (
        <div className="card" style={{ marginTop: 20, borderColor: 'var(--danger-border)', background: 'var(--danger-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontWeight: 800, fontSize: 18 }}>
                <span>🚨</span> EMERGENCY INCIDENT VERIFIED
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-main)', marginTop: 4 }}>
                A distress scream exceeding 90.0 dB was verified by the AI acoustic engine.
                {lastAlertSentTime && ` Automated alert triggered at ${lastAlertSentTime}.`}
              </p>
            </div>
            {contacts.length > 0 && currentUser && (
              <button
                className="btn btn-danger"
                style={{ padding: '10px 20px', fontSize: 14, fontWeight: 700 }}
                onClick={() => {
                  whatsAppService.dispatchAlert(
                    contacts[0],
                    currentUser,
                    `Verified Distress Scream (${soundData.decibels.toFixed(1)} dB > 90.0 dB threshold)`,
                    gpsLocation
                  );
                }}
              >
                Send WhatsApp Alert to {contacts[0].name} ({contacts[0].phoneNumber}) ↗
              </button>
            )}
          </div>
        </div>
      )}

      {/* Browser Limitations Notice */}
      <div className="card" style={{ marginTop: 20, background: 'var(--bg-app)', borderStyle: 'dashed' }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
          ℹ️ Web Browser Audio Information &amp; Technical Capabilities
        </h4>
        <ul style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, paddingLeft: 18, margin: 0 }}>
          <li>
            <strong>Web Audio Metering:</strong> Browser microphones capture relative Sound Pressure Level (SPL) normalized against ambient background baseline. For certified laboratory precision, dedicated hardware SPL meters are required.
          </li>
          <li>
            <strong>Background Execution:</strong> Modern mobile web browsers (Safari iOS, Chrome Android) suspend Web Audio API input when the tab is placed in the background or when the phone screen is locked. Keep this tab visible for uninterrupted real-time protection.
          </li>
          <li>
            <strong>Environmental Noise Rejection:</strong> Vehicle horns, loud traffic, door slams, dropped objects, and clapping are classified as <code>ENVIRONMENTAL_SOUND</code> and will not trigger emergency alarms.
          </li>
        </ul>
      </div>
    </div>
  );
};
