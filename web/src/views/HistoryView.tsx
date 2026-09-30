import React, { useState, useEffect } from 'react';
import { UserProfile, EmergencyIncident } from '../types';
import { cloudStorageService } from '../services/CloudStorageService';

interface HistoryViewProps {
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ currentUser, onOpenAuth }) => {
  const [incidents, setIncidents] = useState<EmergencyIncident[]>([]);

  const loadIncidents = async () => {
    if (currentUser) {
      const list = await cloudStorageService.getIncidents(currentUser.id);
      setIncidents(list);
    } else {
      setIncidents([]);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, [currentUser]);

  const handleClearHistory = () => {
    if (!currentUser) return;
    if (window.confirm('Clear your entire emergency incident log? This cannot be undone.')) {
      try {
        localStorage.removeItem(`lifeguard_incidents_${currentUser.id}`);
        setIncidents([]);
      } catch (e) {}
    }
  };

  if (!currentUser) {
    return (
      <div className="view-container">
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
            Emergency Incident History
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 440, margin: '0 auto 20px' }}>
            Please log in to view your verified emergency incidents, AI detection logs, and safety records.
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
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', marginBottom: 4 }}>
            Emergency Incident History ({incidents.length})
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Full timeline of AI sound-verified distress incidents and manual SOS triggers.
          </p>
        </div>
        {incidents.length > 0 && (
          <button
            className="btn btn-secondary"
            onClick={handleClearHistory}
            style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)', fontSize: 13 }}
          >
            Clear Log
          </button>
        )}
      </div>

      {incidents.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {incidents.map((inc) => {
            const isAI = inc.incidentType === 'AI_DETECTED';
            const dateStr = new Date(inc.createdAt).toLocaleString('en-US', {
              dateStyle: 'medium',
              timeStyle: 'medium',
            });

            return (
              <div key={inc.id} className="card" style={{ borderLeft: `4px solid ${isAI ? 'var(--purple)' : 'var(--danger)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 24 }}>{isAI ? '🛡️' : '🚨'}</span>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>
                        {isAI ? 'AI Sound Detection Incident' : 'Manual Emergency SOS Trigger'}
                      </h3>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dateStr}</div>
                    </div>
                  </div>

                  <span className={`status-badge ${inc.alertStatus === 'OPENED_IN_WHATSAPP' || inc.alertStatus === 'ALERT_SENT' ? 'status-safe' : 'status-danger'}`}>
                    {inc.alertStatus}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 14, padding: 12, background: 'var(--bg-app)', borderRadius: 8, fontSize: 13 }}>
                  {isAI && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Acoustic Intensity</div>
                      <div style={{ fontWeight: 700, color: 'var(--danger)', marginTop: 2 }}>
                        {inc.decibels ? `${inc.decibels.toFixed(1)} dB` : 'Loud Sound (>90 dB)'}
                      </div>
                    </div>
                  )}

                  {inc.detectionResult && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Detection Classification</div>
                      <div style={{ fontWeight: 700, marginTop: 2 }}>
                        {inc.detectionResult}
                      </div>
                    </div>
                  )}

                  {inc.latitude && inc.longitude ? (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>GPS Coordinates</div>
                      <div style={{ marginTop: 2 }}>
                        <a
                          href={`https://maps.google.com/?q=${inc.latitude},${inc.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}
                        >
                          {inc.latitude.toFixed(5)}, {inc.longitude.toFixed(5)} ↗
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>GPS Location</div>
                      <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>Not captured</div>
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Incident ID</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {inc.id}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🛡️</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No Incidents Recorded</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Your account is safe. Detections and emergency SOS triggers will be logged here with timestamps and GPS positions.
          </p>
        </div>
      )}
    </div>
  );
};
