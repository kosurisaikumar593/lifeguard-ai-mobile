import React from 'react';
import { AppAlertPayload } from '../types';
import { emergencyAlertService } from '../services/EmergencyAlertService';

interface ActiveAlertBannerProps {
  alert: AppAlertPayload | null;
  onViewMap?: () => void;
}

export const ActiveAlertBanner: React.FC<ActiveAlertBannerProps> = ({ alert, onViewMap }) => {
  if (!alert) return null;

  const isAck = alert.overallStatus === 'ACKNOWLEDGED';
  const ackRecipients = alert.recipients.filter((r) => r.deliveryStatus === 'Acknowledged');

  return (
    <div
      style={{
        background: isAck ? 'var(--success-light)' : 'var(--danger-light)',
        border: `1.5px solid ${isAck ? 'var(--success)' : 'var(--danger)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
        marginBottom: 20,
        boxShadow: isAck
          ? '0 4px 14px rgba(16, 185, 129, 0.2)'
          : '0 4px 14px rgba(239, 68, 68, 0.25)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: isAck ? 'var(--success)' : 'var(--danger)',
              color: '#FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            {isAck ? '✓' : '🚨'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h4 style={{ fontSize: 16, fontWeight: 800, color: isAck ? 'var(--success)' : 'var(--danger)' }}>
                {isAck ? 'Emergency Alert Acknowledged by Contact' : 'Direct App-to-App Emergency Alert Active'}
              </h4>
              <span className={`badge ${isAck ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 11 }}>
                {alert.overallStatus}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-main)', marginTop: 2 }}>
              {alert.type === 'AI_DISTRESS'
                ? `Acoustic distress verified (${alert.decibels?.toFixed(1) || '>90'} dB)`
                : alert.type === 'MANUAL_SOS'
                ? 'Manual Emergency SOS Triggered'
                : 'Live GPS Location Shared'}
              {ackRecipients.length > 0 && (
                <strong style={{ color: 'var(--success)', marginLeft: 6 }}>
                  — {ackRecipients.map((r) => `${r.name} (${r.acknowledgedAt || 'Acknowledged'})`).join(', ')}
                </strong>
              )}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {onViewMap && alert.location && (
            <button className="btn btn-outline" style={{ padding: '8px 14px', fontSize: 13 }} onClick={onViewMap}>
              📍 View Map
            </button>
          )}

          {!isAck && (
            <button
              className="btn btn-outline"
              style={{ padding: '8px 14px', fontSize: 13, borderColor: 'var(--success)', color: 'var(--success)' }}
              onClick={() => emergencyAlertService.acknowledgeActiveAlert()}
              title="Simulate recipient response"
            >
              Simulate Acknowledge
            </button>
          )}

          <button
            className="btn btn-outline"
            style={{ padding: '8px 14px', fontSize: 13 }}
            onClick={() => emergencyAlertService.dismissActiveAlert()}
          >
            Dismiss Alert
          </button>
        </div>
      </div>
    </div>
  );
};
