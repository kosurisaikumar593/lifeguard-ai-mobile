import React, { useState, useEffect, useRef } from 'react';

interface EmergencyBufferModalProps {
  isOpen: boolean;
  triggerReason: string;
  decibels?: number;
  onSafe: () => void;
  onDispatchNow: () => void;
}

export const EmergencyBufferModal: React.FC<EmergencyBufferModalProps> = ({
  isOpen,
  triggerReason,
  decibels,
  onSafe,
  onDispatchNow,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(5);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) clearInterval(timerRef.current);
      setSecondsRemaining(5);
      return;
    }

    setSecondsRemaining(5);
    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          onDispatchNow();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const progressPercent = ((5 - secondsRemaining) / 5) * 100;

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div
        className="modal-card"
        style={{
          textAlign: 'center',
          maxWidth: 440,
          border: '2px solid var(--danger)',
          boxShadow: '0 10px 40px rgba(239, 68, 68, 0.35)',
          padding: '32px 24px',
        }}
      >
        {/* Urgent Header */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--danger)', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
          <span>⚠️</span> 5-Second Emergency Safety Buffer
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-main)', marginBottom: 8 }}>
          Emergency Dispatch In Progress
        </h2>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20 }}>
          {triggerReason}
          {decibels && <strong> ({decibels.toFixed(1)} dB)</strong>}.
          <br />
          Dispatching your live location to connected contacts automatically unless cancelled.
        </p>

        {/* Circular Countdown Display */}
        <div style={{ margin: '16px auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              width: 110,
              height: 110,
              borderRadius: '50%',
              background: 'var(--danger-light)',
              border: '4px solid var(--danger)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--danger)',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)',
              transition: 'all 0.3s ease',
            }}
          >
            <span style={{ fontSize: 44, fontWeight: 900, lineHeight: 1, fontFamily: 'monospace' }}>
              {secondsRemaining}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>
              seconds
            </span>
          </div>

          {/* Depleting progress bar */}
          <div
            style={{
              width: '100%',
              maxWidth: 240,
              height: 6,
              background: 'var(--border)',
              borderRadius: 3,
              marginTop: 18,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: 'var(--danger)',
                transition: 'width 1s linear',
              }}
            />
          </div>
        </div>

        {/* Actions: "I'm Safe" (Blue secondary action) & "Send Alert Now" (Red primary action) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
          {/* Primary Action: Send Alert Now */}
          <button
            className="btn btn-danger btn-block"
            style={{
              padding: '14px 20px',
              fontSize: 16,
              fontWeight: 800,
              boxShadow: '0 4px 14px var(--danger-glow)',
            }}
            onClick={onDispatchNow}
          >
            🚨 Send Alert Now (Dispatch Immediately)
          </button>

          {/* Secondary Action: I'm Safe (Blue Secondary Action) */}
          <button
            className="btn btn-block"
            style={{
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              border: '1.5px solid var(--primary)',
              padding: '12px 20px',
              fontSize: 15,
              fontWeight: 700,
            }}
            onClick={onSafe}
          >
            🛡️ I'm Safe (Cancel Alert &amp; Reset)
          </button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 14 }}>
          If you do not touch anything, an app-to-app alert payload will be dispatched when the timer reaches 0.
        </p>
      </div>
    </div>
  );
};
