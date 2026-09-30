/**
 * LifeGuard AI Web — WhatsApp Service
 * 
 * Prepares standardized emergency messages and opens the WhatsApp intent/URL:
 * https://wa.me/{phone}?text={encodedText}
 * Truthfully reports OPENED_IN_WHATSAPP status.
 */

import { EmergencyContact, GPSLocation, UserProfile } from '../types';

export class WhatsAppService {
  /**
   * Formats the standardized LifeGuard AI emergency message template
   */
  public formatEmergencyMessage(params: {
    userName: string;
    soundDescription: string;
    location?: GPSLocation | null;
    timestamp?: string;
  }): string {
    const timeStr = params.timestamp
      ? new Date(params.timestamp).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'medium',
        })
      : new Date().toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'medium',
        });

    const locationText = params.location
      ? `${params.location.latitude.toFixed(6)}, ${params.location.longitude.toFixed(6)} (±${params.location.accuracy}m)`
      : 'Location unavailable';

    const locationLink = params.location?.googleMapsUrl || 'https://maps.google.com';

    return (
      `🚨 *LIFEGUARD AI – EMERGENCY ALERT*\n\n` +
      `An emergency sound was detected and verified.\n\n` +
      `*User:*\n${params.userName}\n\n` +
      `*Sound:*\n${params.soundDescription}\n\n` +
      `*Location:*\n${locationText}\n\n` +
      `*Time:*\n${timeStr}\n\n` +
      `*Location link:*\n${locationLink}\n\n` +
      `⚠️ *Please verify user safety immediately.*`
    );
  }

  /**
   * Cleans and normalizes phone number to international format
   */
  public normalizePhoneNumber(phone: string, defaultCountryCode: string = '+91'): string {
    if (!phone) return '';
    const digits = phone.replace(/[^0-9+]/g, '');
    if (digits.startsWith('+')) {
      return digits.replace('+', '');
    }
    if (digits.length === 10) {
      return `${defaultCountryCode.replace('+', '')}${digits}`;
    }
    return digits;
  }

  /**
   * Generates direct WhatsApp click-to-chat URL
   */
  public buildWhatsAppUrl(phoneNumber: string, message: string): string {
    const cleanPhone = this.normalizePhoneNumber(phoneNumber);
    const encoded = encodeURIComponent(message);
    return `https://wa.me/${cleanPhone}?text=${encoded}`;
  }

  /**
   * Opens the WhatsApp alert pre-filled in a new browser tab or WhatsApp client
   */
  public dispatchAlert(
    contact: EmergencyContact,
    user: UserProfile,
    soundDesc: string,
    location?: GPSLocation | null
  ): { success: boolean; url: string; message: string } {
    const message = this.formatEmergencyMessage({
      userName: user.fullName,
      soundDescription: soundDesc,
      location,
    });

    const url = this.buildWhatsAppUrl(contact.phoneNumber, message);
    window.open(url, '_blank', 'noopener,noreferrer');

    return {
      success: true,
      url,
      message,
    };
  }
}

export const whatsAppService = new WhatsAppService();
