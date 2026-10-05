import React, { useState, useEffect } from 'react';
import { UserProfile, EmergencyIncident, GPSLocation } from '../types';
import { cloudStorageService } from '../services/CloudStorageService';
import { InteractiveMapModal } from '../components/InteractiveMapModal';

interface HistoryViewProps {
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onTriggerTestIncident?: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  currentUser,
  onOpenAuth,
  onTriggerTestIncident,
}) => {
  const [incidents, setIncidents] = useState<EmergencyIncident[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<GPSLocation | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);

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

  const handleViewMap = (inc: EmergencyIncident) => {
    if (inc.latitude && inc.longitude) {
      setSelectedLocation({
        latitude: inc.latitude,
        longitude: inc.longitude,
        accuracy: inc.locationAccuracy || 10,
        timestamp: Date.now(),
        googleMapsUrl: `https://maps.google.com/?q=${inc.latitude},${inc.longitude}`,
      });
      setShowMapModal(true);
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
            Full timeline of AI sound-verified distress incidents, manual SOS triggers, and live location shares.
          </p>
        </div>
        {incidents.length > 0 && (
          <button
            className="btn btn-outline"
            onClick={handleClearHistory}
            style={{ color: 'var(--danger)', borderColor: 'var(--danger)', fontSize: 13 }}
          >
            Clear Log
          </button>
        )}
      </div>

      {incidents.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {incidents.map((inc) => {
            const isAI = inc.incidentType === 'AI_DETECTED';
            const isLocation = inc.incidentType === 'LOCATION_SHARE';
            const isCancelled = inc.alertStatus === 'CANCELLED_SAFE';
            const dateStr = new Date(inc.createdAt).toLocaleString('en-US', {
              dateStyle: 'medium',
              timeStyle: 'medium',
            });

            return (
              <div
                key={inc.id}
                className="card"
                style={{
                  borderLeft: `5px solid ${isCancelled ? 'var(--warning)' : isAI ? 'var(--purple-ai)' : isLocation ? 'var(--primary)' : 'var(--danger)'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 24 }}>
                      {isCancelled ? '✓' : isAI ? '🛡️' : isLocation ? '📍' : '🚨'}
                    </span>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>
                        {isCancelled
                          ? 'Emergency Trigger Cancelled ("I\'m Safe")'
                          : isAI
                          ? 'AI Sound Distress Incident'
                          : isLocation
                          ? 'Live Location Shared with Contacts'
                          : 'Manual Emergency SOS Trigger'}
                      </h3>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dateStr}</div>
                    </div>
                  </div>

                  <span
                    className={`badge ${isCancelled ? 'badge-warning' : 'badge-success'}`}
                  >
                    {isCancelled ? 'Cancelled (Safe)' : inc.alertStatus}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 14, padding: 12, background: 'var(--bg-app)', borderRadius: 8, fontSize: 13 }}>
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
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Classification</div>
                      <div style={{ fontWeight: 700, marginTop: 2 }}>
                        {inc.detectionResult}
                      </div>
                    </div>
                  )}

                  {inc.latitude && inc.longitude ? (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>GPS Coordinates</div>
                      <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'monospace' }}>
                          {inc.latitude.toFixed(5)}, {inc.longitude.toFixed(5)}
                        </span>
                        <button
                          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                          onClick={() => handleViewMap(inc)}
                        >
                          View Map ↗
                        </button>
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

                {inc.recipientsSummary && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                    Payload: {inc.recipientsSummary}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty Incident History State (Feature 7) */
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', border: '2px dashed var(--border-strong)' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🛡️</div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', marginBottom: 6 }}>
            All Clear — No Incidents Recorded
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 460, margin: '0 auto 20px', lineHeight: 1.5 }}>
            No distress events or emergency alarms have been recorded for your account. LifeGuard AI monitoring engine is ready on standby.
          </p>
          {onTriggerTestIncident && (
            <button className="btn btn-outline" onClick={onTriggerTestIncident}>
              🧪 Log Safe Simulation Test Incident
            </button>
          )}
        </div>
      )}

      {/* Interactive Map Modal */}
      <InteractiveMapModal
        isOpen={showMapModal}
        location={selectedLocation}
        onClose={() => setShowMapModal(false)}
      />
    </div>
  );
};
