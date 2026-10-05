import React, { useState, useEffect } from 'react';
import { UserProfile, EmergencyContact, GPSLocation, AppAlertPayload } from '../types';
import { geolocationService } from '../services/GeolocationService';
import { cloudStorageService } from '../services/CloudStorageService';
import { emergencyAlertService } from '../services/EmergencyAlertService';
import { webNotificationService } from '../services/WebNotificationService';
import { InteractiveMapModal } from '../components/InteractiveMapModal';
import { ActiveAlertBanner } from '../components/ActiveAlertBanner';

interface SOSViewProps {
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onRequestBufferModal: (params: { decibels?: number; reason: string }) => void;
}

export const SOSView: React.FC<SOSViewProps> = ({
  currentUser,
  onOpenAuth,
  onRequestBufferModal,
}) => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [location, setLocation] = useState<GPSLocation | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [activeAlert, setActiveAlert] = useState<AppAlertPayload | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);

  useEffect(() => {
    if (currentUser) {
      cloudStorageService.getContacts(currentUser.id).then(setContacts);
    }
    fetchLocation();
    const unsub = emergencyAlertService.subscribe(setActiveAlert);
    return () => unsub();
  }, [currentUser]);

  const fetchLocation = async () => {
    setLocLoading(true);
    const res = await geolocationService.getCurrentPosition();
    setLocLoading(false);
    if (res.success && res.location) {
      setLocation(res.location);
    }
  };

  const handleTriggerSOS = () => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }

    // Opens the 5-second buffer modal
    onRequestBufferModal({
      reason: 'Manual Emergency SOS Button Activated',
    });
  };

  return (
    <div className="view-container">
      {/* Active App Alert Banner */}
      <ActiveAlertBanner alert={activeAlert} onViewMap={() => setShowMapModal(true)} />

      {/* Main SOS Box */}
      <div className="card" style={{ textAlign: 'center', padding: '36px 20px', borderColor: activeAlert ? 'var(--danger)' : undefined }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--danger)', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
          <span>🚨</span> Standalone App-to-App Emergency Alert System
        </div>

        <h2 style={{ fontSize: 26, fontWeight: 900, color: 'var(--danger)', marginBottom: 8 }}>
          EMERGENCY SOS BROADCAST
        </h2>

        <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 520, margin: '0 auto 28px' }}>
          Instantly dispatch your real-time verified GPS coordinates and high-priority distress status to all connected family and safety contacts.
        </p>

        {/* Big SOS Button */}
        <div className="sos-pulse-container">
          <button
            className="sos-big-btn"
            onClick={handleTriggerSOS}
            aria-label="Trigger Emergency SOS"
          >
            SOS
            <span className="sos-subtext">HOLD / TAP</span>
          </button>
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
            Tapping arms the 5-second safety buffer before instant app-to-app dispatch
          </p>
        </div>

        {/* Live GPS Coordinates Attachment */}
        <div style={{ maxWidth: 520, margin: '20px auto 0', padding: 16, background: 'var(--bg-app)', borderRadius: 12, textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
              📍 Verified GPS Payload
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowMapModal(true)}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
              >
                View Map ↗
              </button>
              <button
                onClick={fetchLocation}
                disabled={locLoading}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
              >
                {locLoading ? 'Acquiring...' : 'Refresh ↻'}
              </button>
            </div>
          </div>
          {location ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              <div>Coordinates: <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-main)' }}>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</span> (±{location.accuracy}m accuracy)</div>
              <div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 11, color: 'var(--text-subtle)' }}>
                Payload Link: {location.googleMapsUrl}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Acquiring browser GPS coordinates...
            </div>
          )}
        </div>
      </div>

      {/* Recipient App-to-App Network Status */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">📡 Connected Alert Network Recipients</h3>
            <p className="card-subtitle">Real-time recipient device connection &amp; acknowledgement status</p>
          </div>
        </div>

        {!currentUser ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Please <button onClick={onOpenAuth} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>log in</button> to view and alert your connected contacts.
          </div>
        ) : contacts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {contacts.map((c) => {
              const activeRecipient = activeAlert?.recipients.find((r) => r.contactId === c.id);
              const isAck = activeRecipient?.deliveryStatus === 'Acknowledged';

              return (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 14,
                    background: 'var(--bg-app)',
                    borderRadius: 10,
                    borderLeft: `4px solid ${isAck ? 'var(--success)' : c.connectionState === 'Connected' ? 'var(--primary)' : 'var(--warning)'}`,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{c.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({c.relationship})</span>
                      <span className={`badge ${c.connectionState === 'Connected' ? 'badge-success' : 'badge-warning'}`}>
                        {c.connectionState || 'Connected'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                      {c.phoneNumber} • {c.lastActive || 'Online'}
                    </div>
                    {activeRecipient && (
                      <div style={{ fontSize: 12, color: isAck ? 'var(--success)' : 'var(--primary)', fontWeight: 700, marginTop: 4 }}>
                        Status: {activeRecipient.deliveryStatus} {activeRecipient.acknowledgedAt && `at ${activeRecipient.acknowledgedAt}`}
                        {activeRecipient.responseNote && ` — "${activeRecipient.responseNote}"`}
                      </div>
                    )}
                  </div>

                  <button
                    className="btn btn-outline"
                    style={{ padding: '8px 14px', fontSize: 13, borderColor: 'var(--danger)', color: 'var(--danger)' }}
                    onClick={() => {
                      emergencyAlertService.dispatchAlert({
                        user: currentUser,
                        contacts: [c],
                        type: 'MANUAL_SOS',
                        location,
                        customNote: `Urgent single-recipient SOS sent to ${c.name}.`,
                      });
                    }}
                  >
                    Direct Alert
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Zero connected contacts. Please add trusted contacts to enable direct app-to-app alerting.
          </div>
        )}
      </div>

      {/* Interactive Map Modal */}
      <InteractiveMapModal
        isOpen={showMapModal}
        location={location}
        onClose={() => setShowMapModal(false)}
      />
    </div>
  );
};
