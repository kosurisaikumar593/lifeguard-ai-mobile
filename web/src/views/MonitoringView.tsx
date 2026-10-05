import React, { useState, useEffect } from 'react';
import {
  MonitoringState,
  LiveSoundCheckState,
  LiveSoundCheckStatus,
  SoundLevelData,
  UserProfile,
  EmergencyContact,
} from '../types';
import { audioMonitoringService } from '../services/AudioMonitoringService';
import { cloudStorageService } from '../services/CloudStorageService';

interface MonitoringViewProps {
  currentUser: UserProfile | null;
  isMonitoring: boolean;
  onToggleMonitoring: () => void;
  onRequestBufferModal: (params: { decibels: number; reason: string }) => void;
}

export const MonitoringView: React.FC<MonitoringViewProps> = ({
  currentUser,
  isMonitoring,
  onToggleMonitoring,
  onRequestBufferModal,
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
  const [waveformBars, setWaveformBars] = useState<number[]>(new Array(16).fill(0.08));
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load contacts
  useEffect(() => {
    if (currentUser) {
      cloudStorageService.getContacts(currentUser.id).then(setContacts);
    }
  }, [currentUser]);

  // Subscribe to real-time audio monitoring updates
  // CRITICAL: NEVER navigates away from MonitoringView
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

    const unsubBuffer = audioMonitoringService.onEmergencyBufferTrigger((event) => {
      // Trigger the 5-second emergency safety buffer modal
      onRequestBufferModal({
        decibels: event.decibels,
        reason: 'Acoustic Distress Scream Verified (>90.0 dB threshold)',
      });
    });

    return () => {
      unsubLevel();
      unsubState();
      unsubBuffer();
    };
  }, [onRequestBufferModal]);

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
        return { glyph: '✓', text: 'Confirmed', className: 'glyph-confirmed' };
      case 'CHECKING':
        return { glyph: '⟳', text: 'Analyzing...', className: 'glyph-checking' };
      case 'NOT_DETECTED':
        return { glyph: '✗', text: 'Filtered / Not Detected', className: 'glyph-not-detected' };
      case 'UNAVAILABLE':
        return { glyph: '⚠', text: 'Unavailable', className: 'glyph-unavailable' };
      case 'WAITING':
      default:
        return { glyph: '○', text: 'Waiting', className: 'glyph-waiting' };
    }
  };

  return (
    <div className="view-container">
      {/* Notice regarding page stability */}
      <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-glow)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>🛡️</span>
        <span style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 500 }}>
          <strong>Continuous Protection Mode:</strong> This monitoring screen stays permanently open and active during loud acoustic spikes. It will <em>never</em> automatically navigate back to Home.
        </span>
      </div>

      {errorMessage && (
        <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: 14, borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
          <strong>Microphone Error:</strong> {errorMessage}
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-outline" style={{ padding: '6px 14px', fontSize: 12, borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={handleToggle}>
              Retry Microphone Access ↻
            </button>
          </div>
        </div>
      )}

      {/* Main Monitoring Gauge Card */}
      <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, background: isMonitoring ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.12)', color: isMonitoring ? 'var(--success)' : 'var(--text-muted)', fontWeight: 700, fontSize: 13, marginBottom: 16 }}>
          <span className={isMonitoring ? 'live-dot' : ''} style={{ background: isMonitoring ? 'var(--success)' : 'var(--text-muted)' }} />
          <span>{isMonitoring ? 'MONITORING ACTIVE — WEB AUDIO API LISTENING' : 'AUDIO PROTECTION STANDBY'}</span>
        </div>

        {/* Big Decibel Meter */}
        <div style={{ margin: '14px 0' }}>
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
            Evaluation Trigger: strictly <strong style={{ color: 'var(--danger)' }}>&gt; 90.0 dB</strong>
            {soundData.decibels > 90 && (
              <span style={{ color: 'var(--danger)', fontWeight: 800, marginLeft: 8 }}>
                [ABOVE 90 dB THRESHOLD]
              </span>
            )}
          </div>
        </div>

        {/* 16-Bar Responsive Equalizer Waveform */}
        <div className="waveform-container" style={{ maxWidth: 460, margin: '20px auto', height: 60 }}>
          {waveformBars.map((height, i) => (
            <div
              key={i}
              className={`waveform-bar ${soundData.decibels > 90 ? 'loud' : ''}`}
              style={{
                height: isMonitoring ? `${Math.max(8, height * 100)}%` : '8%',
              }}
            />
          ))}
        </div>

        {/* Start / Stop Toggle */}
        <div style={{ marginTop: 20 }}>
          <button
            className={`btn ${isMonitoring ? 'btn-danger' : 'btn-primary'}`}
            style={{ padding: '14px 36px', fontSize: 16, fontWeight: 800, minWidth: 230 }}
            onClick={handleToggle}
          >
            {isMonitoring ? '⏹ Stop Audio Monitoring' : '▶ Start Audio Monitoring'}
          </button>
        </div>
      </div>

      {/* Dynamic 3-Tier Visual Decision Checklist */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">🔍 Dynamic 3-Tier Audio Analysis Pipeline</h3>
            <p className="card-subtitle">Real-time visual decision checklist with strict &gt;90.0 dB trigger</p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className="badge badge-primary" style={{ fontSize: 11 }}>
              Strict &gt;90 dB Rule
            </span>
            <span className="badge badge-success" style={{ fontSize: 11 }}>
              API-Only Remote AI
            </span>
          </div>
        </div>

        <div className="checklist-container" style={{ border: 'none', padding: 0, marginTop: 12 }}>
          {/* Decision 1: Sound detected */}
          {(() => {
            const item = getStatusGlyph(checklist.soundDetected);
            return (
              <div className="checklist-item">
                <div className="checklist-label">
                  <span className={`checklist-glyph ${item.className}`}>{item.glyph}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>[✓] Sound detected</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ambient audio input received via Web Audio API stream</div>
                  </div>
                </div>
                <span className={`badge ${checklist.soundDetected === 'CONFIRMED' ? 'badge-success' : 'badge-warning'}`}>
                  {item.text}
                </span>
              </div>
            );
          })()}

          {/* Decision 2: Level > 90 dB */}
          {(() => {
            const item = getStatusGlyph(checklist.above90dB);
            return (
              <div className="checklist-item">
                <div className="checklist-label">
                  <span className={`checklist-glyph ${item.className}`}>{item.glyph}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>[✓] Level &gt; 90 dB (Evaluation Trigger strictly &gt;90.0 dB)</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Strict evaluation trigger: 90.0 dB does not trigger; 90.1+ dB initiates Tier 3 classification
                    </div>
                  </div>
                </div>
                <span className={`badge ${checklist.above90dB === 'CONFIRMED' ? 'badge-danger' : 'badge-warning'}`}>
                  {item.text}
                </span>
              </div>
            );
          })()}

          {/* Decision 3: Human sound vs. Environmental sound check (API integration structure) */}
          {(() => {
            const item = getStatusGlyph(checklist.humanSound);
            return (
              <div className="checklist-item">
                <div className="checklist-label">
                  <span className={`checklist-glyph ${item.className}`}>{item.glyph}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      Human sound vs. Environmental sound check (API integration structure)
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {checklist.humanSoundReason ||
                        'Spectral formant analysis via remote cloud API rejects horns, slamming doors, dropped objects, and ambient clatter'}
                    </div>
                  </div>
                </div>
                <span className={`badge ${checklist.humanSound === 'CONFIRMED' ? 'badge-success' : checklist.humanSound === 'NOT_DETECTED' ? 'badge-danger' : 'badge-warning'}`}>
                  {item.text}
                </span>
              </div>
            );
          })()}

          {/* Decision 4: AI Scream / Distress Analysis (API integration structure) */}
          {(() => {
            const item = getStatusGlyph(checklist.distressScream);
            return (
              <div className="checklist-item">
                <div className="checklist-label">
                  <span className={`checklist-glyph ${item.className}`}>{item.glyph}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      AI Scream / Distress Analysis (API integration structure)
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {checklist.screamReason ||
                        'High-frequency vocal tract resonance check (1.2 kHz – 4.0 kHz distress scream band) via cloud inference'}
                    </div>
                  </div>
                </div>
                <span className={`badge ${checklist.distressScream === 'CONFIRMED' ? 'badge-danger' : 'badge-warning'}`}>
                  {item.text}
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Acoustic Simulation Suite (Mock Streams / Testing) */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">🧪 Audio Test &amp; Pipeline Simulation Suite</h3>
            <p className="card-subtitle">Test real-time pipeline decisions without needing a loud environment</p>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          Click any sample stream below to verify how LifeGuard AI evaluates decibels, classifies vocal formants, filters environmental noises, and arms the 5-second buffer:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <button
            className="btn btn-outline"
            style={{ borderColor: 'var(--danger)', color: 'var(--danger)', padding: '12px 14px', fontSize: 13, textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
            onClick={() => audioMonitoringService.simulateAcousticEvent('SCREAM_95DB')}
          >
            <span style={{ fontWeight: 800 }}>▶ Simulate Distress Scream (95 dB)</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Passes &gt;90 dB, Human vocal + Scream verified → Arms 5s Buffer
            </span>
          </button>

          <button
            className="btn btn-outline"
            style={{ borderColor: '#D97706', color: '#D97706', padding: '12px 14px', fontSize: 13, textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
            onClick={() => audioMonitoringService.simulateAcousticEvent('ENVIRONMENTAL_HORN_92DB')}
          >
            <span style={{ fontWeight: 800 }}>▶ Simulate Vehicle Horn (92 dB)</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Passes &gt;90 dB → Filtered at Tier 3 as ENVIRONMENTAL_SOUND
            </span>
          </button>

          <button
            className="btn btn-outline"
            style={{ padding: '12px 14px', fontSize: 13, textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
            onClick={() => audioMonitoringService.simulateAcousticEvent('NORMAL_TALK_65DB')}
          >
            <span style={{ fontWeight: 800 }}>▶ Simulate Normal Speech (65 dB)</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Below 90.0 dB threshold → No evaluation triggered
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
