import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, EmergencyContact, GPSLocation } from '../types';
import { geolocationService } from '../services/GeolocationService';
import { cloudStorageService } from '../services/CloudStorageService';
import { whatsAppService } from '../services/WhatsAppService';
import { webNotificationService } from '../services/WebNotificationService';

interface SOSViewProps {
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
}

export const SOSView: React.FC<SOSViewProps> = ({ currentUser, onOpenAuth }) => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [location, setLocation] = useState<GPSLocation | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  
  // Countdown states
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  const countdownTimerRef = useRef<any>(null);

  // Triggered alert state
  const [alertTriggered, setAlertTriggered] = useState(false);
  const [triggeredTime, setTriggeredTime] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      cloudStorageService.getContacts(currentUser.id).then(setContacts);
    }
    fetchLocation();
  }, [currentUser]);

  const fetchLocation = async () => {
    setLocLoading(true);
    const res = await geolocationService.getCurrentPosition();
    setLocLoading(false);
    if (res.success && res.location) {
      setLocation(res.location);
    }
  };

  const startSOSCountdown = () => {
    if (isCountingDown || alertTriggered) return;
    setIsCountingDown(true);
    setCountdownSeconds(3);

    countdownTimerRef.current = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          executeEmergencySOS();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelSOSCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    setIsCountingDown(false);
    setCountdownSeconds(3);
  };

  const executeEmergencySOS = async () => {
    setIsCountingDown(false);
    setAlertTriggered(true);
    setTriggeredTime(new Date().toLocaleTimeString());

    // 1. Browser Notification
    webNotificationService.notifyEmergency(
      '🚨 LIFEGUARD AI – MANUAL SOS TRIGGERED',
      'Emergency SOS has been broadcast with your real-time GPS location.'
    );

    // 2. Refresh GPS
    let loc = location;
    const locRes = await geolocationService.getCurrentPosition();
    if (locRes.success && locRes.location) {
      loc = locRes.location;
      setLocation(loc);
    }

    // 3. Save incident
    if (currentUser) {
      await cloudStorageService.createIncident(currentUser.id, {
        incidentType: 'MANUAL_SOS',
        detectionResult: 'MANUAL_TRIGGER',
        confidence: 1.0,
        latitude: loc?.latitude,
        longitude: loc?.longitude,
        locationAccuracy: loc?.accuracy,
        alertStatus: contacts.length > 0 ? 'OPENED_IN_WHATSAPP' : 'NO_CONTACTS',
      });
    }

    // 4. Open WhatsApp for primary contact
    if (contacts.length > 0 && currentUser) {
      whatsAppService.dispatchAlert(
        contacts[0],
        currentUser,
        'MANUAL EMERGENCY SOS ACTIVATION - IMMEDIATE ASSISTANCE REQUESTED',
        loc
      );
    }
  };

  const resetSOS = () => {
    cancelSOSCountdown();
    setAlertTriggered(false);
    setTriggeredTime(null);
  };

  return (
    <div className="view-container">
      {/* Main SOS Box */}
      <div className="card" style={{ textAlign: 'center', padding: '36px 20px', borderColor: alertTriggered ? 'var(--danger)' : undefined }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: 'var(--danger)', marginBottom: 6 }}>
          EMERGENCY SOS BROADCAST
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 500, margin: '0 auto 28px' }}>
          Instantly dispatch your real-time GPS coordinates and an urgent distress message to your designated emergency contacts.
        </p>

        {/* SOS Button or Countdown Overlay */}
        <div style={{ margin: '30px auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {isCountingDown ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: 170,
                  height: 170,
                  borderRadius: '50%',
                  background: 'var(--danger)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 72,
                  fontWeight: 900,
                  boxShadow: '0 0 35px rgba(220, 38, 38, 0.7)',
                  animation: 'sos-pulse 1s infinite',
                }}
              >
                {countdownSeconds}
              </div>
              <p style={{ marginTop: 20, fontSize: 16, fontWeight: 700, color: 'var(--danger)' }}>
                Sending Emergency SOS in {countdownSeconds}s...
              </p>
              <button
                className="btn btn-secondary"
                style={{ marginTop: 14, padding: '10px 28px', fontSize: 15, fontWeight: 700 }}
                onClick={cancelSOSCountdown}
              >
                ✖ Cancel Broadcast
              </button>
            </div>
          ) : alertTriggered ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: 150,
                  height: 150,
                  borderRadius: '50%',
                  background: 'var(--danger)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 64,
                  boxShadow: '0 0 30px rgba(220, 38, 38, 0.6)',
                }}
              >
                🚨
              </div>
              <h3 style={{ marginTop: 18, fontSize: 20, fontWeight: 800, color: 'var(--danger)' }}>
                SOS Alert Dispatched!
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Broadcast initiated at {triggeredTime}
              </p>
              <button
                className="btn btn-secondary"
                style={{ marginTop: 18, padding: '8px 22px', fontSize: 13 }}
                onClick={resetSOS}
              >
                ↺ Reset SOS State
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                className="sos-button"
                onClick={startSOSCountdown}
                aria-label="Trigger Emergency SOS"
              >
                SOS
              </button>
              <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
                Tap the button to start 3-second safety countdown
              </p>
            </div>
          )}
        </div>

        {/* Live GPS Coordinates Attachment */}
        <div style={{ maxWidth: 520, margin: '20px auto 0', padding: 14, background: 'var(--bg-app)', borderRadius: 10, textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
              📍 Attached GPS Location
            </span>
            <button
              onClick={fetchLocation}
              disabled={locLoading}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            >
              {locLoading ? 'Acquiring...' : 'Refresh ↻'}
            </button>
          </div>
          {location ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              <div>Coordinates: <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-main)' }}>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</span> (±{location.accuracy}m)</div>
              <div style={{ marginTop: 4 }}>
                <a href={location.googleMapsUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                  Preview Google Maps link ↗
                </a>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Acquiring browser GPS coordinates...
            </div>
          )}
        </div>
      </div>

      {/* WhatsApp Dispatch List */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">💬 Direct WhatsApp Emergency Alerts</h3>
            <p className="card-subtitle">Manually trigger or re-send WhatsApp alerts to specific contacts</p>
          </div>
        </div>

        {!currentUser ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Please <button onClick={onOpenAuth} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>log in</button> to view and alert your contacts.
          </div>
        ) : contacts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {contacts.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 12,
                  background: 'var(--bg-app)',
                  borderRadius: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {c.name} ({c.relationship})
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {c.phoneNumber}
                  </div>
                </div>
                <button
                  className="btn btn-danger"
                  style={{ padding: '8px 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => {
                    whatsAppService.dispatchAlert(
                      c,
                      currentUser,
                      'MANUAL EMERGENCY SOS ACTIVATION - IMMEDIATE ASSISTANCE REQUESTED',
                      location
                    );
                  }}
                >
                  <span>🚨</span> Send Alert (wa.me)
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No emergency contacts registered. Please add contacts in the Emergency Contacts tab.
          </div>
        )}
      </div>
    </div>
  );
};
