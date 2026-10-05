import React from 'react';

interface OfflineBannerProps {
  isOffline: boolean;
  onRetry: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ isOffline, onRetry }) => {
  if (!isOffline) return null;

  return (
    <div
      style={{
        background: '#FEF3C7',
        borderBottom: '1px solid #F59E0B',
        color: '#92400E',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        fontSize: 13,
        fontWeight: 600,
        zIndex: 40,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>⚠️</span>
        <span>
          <strong>No Internet Connection Detected:</strong> LifeGuard AI device audio monitoring and local SOS triggers remain active. Cloud synchronization and remote contact alerting will automatically resume once reconnected.
        </span>
      </div>
      <button
        onClick={onRetry}
        style={{
          background: '#92400E',
          color: '#FFF',
          border: 'none',
          padding: '4px 12px',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        Retry Connection ↻
      </button>
    </div>
  );
};
