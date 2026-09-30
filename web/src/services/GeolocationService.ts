/**
 * LifeGuard AI Web — Geolocation Service
 * 
 * Uses browser navigator.geolocation.getCurrentPosition()
 * Acquires real-time GPS coordinates and builds Google Maps links.
 * Works dynamically from any city, state, or country in the world without hardcoded coordinates.
 */

import { GPSLocation } from '../types';

export class GeolocationService {
  private lastLocation: GPSLocation | null = null;

  public getLastLocation(): GPSLocation | null {
    return this.lastLocation;
  }

  /**
   * Acquires the user's current GPS position via the browser Geolocation API
   */
  public async getCurrentPosition(): Promise<{
    success: boolean;
    location?: GPSLocation;
    error?: string;
  }> {
    if (!navigator.geolocation) {
      return {
        success: false,
        error: 'Geolocation API is not supported by your browser.',
      };
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = Math.round(position.coords.accuracy * 10) / 10;
          const timestamp = position.timestamp;
          const googleMapsUrl = `https://maps.google.com/?q=${lat},${lng}`;

          const loc: GPSLocation = {
            latitude: lat,
            longitude: lng,
            accuracy,
            timestamp,
            googleMapsUrl,
          };

          this.lastLocation = loc;
          resolve({ success: true, location: loc });
        },
        (error) => {
          let errorMsg = 'Failed to retrieve location.';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMsg = 'Location permission is required to share emergency location. Please enable location permissions in your browser.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMsg = 'GPS location is currently unavailable on this device.';
              break;
            case error.TIMEOUT:
              errorMsg = 'Location request timed out. Please verify your GPS signal.';
              break;
          }
          resolve({ success: false, error: errorMsg });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }
}

export const geolocationService = new GeolocationService();
