import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GPSLocation } from '../types';

interface InteractiveMapModalProps {
  isOpen: boolean;
  location: GPSLocation | null;
  onClose: () => void;
  onShareToContacts?: () => void;
}

export const InteractiveMapModal: React.FC<InteractiveMapModalProps> = ({
  isOpen,
  location,
  onClose,
  onShareToContacts,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !location || !mapContainerRef.current) return;

    const lat = location.latitude;
    const lng = location.longitude;

    // Fix default Leaflet icon paths in bundled environments
    const customIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background: #0D52D6;
          border: 3px solid #FFFFFF;
          border-radius: 50%;
          box-shadow: 0 0 16px rgba(13, 82, 214, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFF;
          font-size: 16px;
        ">
          📍
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    // Clean up existing map if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Initialize Leaflet map
    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: 16,
      zoomControl: true,
    });

    mapInstanceRef.current = map;

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Add marker and accuracy circle
    L.marker([lat, lng], { icon: customIcon })
      .addTo(map)
      .bindPopup(`<b>LifeGuard Verified Location</b><br>${lat.toFixed(5)}, ${lng.toFixed(5)}<br>Accuracy: ±${location.accuracy}m`)
      .openPopup();

    if (location.accuracy && location.accuracy < 500) {
      L.circle([lat, lng], {
        radius: location.accuracy,
        color: '#0D52D6',
        fillColor: '#0D52D6',
        fillOpacity: 0.15,
        weight: 1,
      }).addTo(map);
    }

    // Invalidate size after rendering to avoid grey tiles
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, location]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (!location) return;
    navigator.clipboard.writeText(location.googleMapsUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={onClose}>
      <div
        className="modal-card"
        style={{
          maxWidth: 620,
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>
              📍 Interactive Live Location Map
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Verified browser GPS coordinates &amp; real-time satellite map
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Map Container */}
        <div
          ref={mapContainerRef}
          style={{
            height: 320,
            width: '100%',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            marginBottom: 16,
          }}
        />

        {/* Coordinates Details & Payload */}
        {location ? (
          <div style={{ background: 'var(--bg-card-subtle)', padding: 14, borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Latitude</span>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>{location.latitude.toFixed(6)}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Longitude</span>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>{location.longitude.toFixed(6)}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Accuracy</span>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--success)' }}>±{location.accuracy} meters</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Payload: {location.googleMapsUrl}
              </span>
              <button
                className="btn btn-outline"
                style={{ padding: '6px 12px', fontSize: 12, flexShrink: 0 }}
                onClick={handleCopyLink}
              >
                {copied ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Acquiring current GPS position...
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          {onShareToContacts && (
            <button
              className="btn btn-primary"
              style={{ flex: 1, padding: '12px 20px', fontSize: 14 }}
              onClick={() => {
                onShareToContacts();
                onClose();
              }}
            >
              📡 Broadcast Location to Connected Contacts
            </button>
          )}
          <button
            className="btn btn-outline"
            style={{ padding: '12px 20px', fontSize: 14 }}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
