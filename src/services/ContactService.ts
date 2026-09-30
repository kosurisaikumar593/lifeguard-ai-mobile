import { EmergencyContact } from '../types';
import { contactRepository } from '../database';
import { authService } from './AuthService';
import { validateIndianMobile } from '../utils/validation';

type ContactListener = () => void;

export class ContactService {
  private listeners: Set<ContactListener> = new Set();

  /**
   * Resolves the active user ID from authService or returns the optional override.
   */
  private getActiveUserId(overrideUserId?: string): string | null {
    if (overrideUserId) return overrideUserId;
    const currentUser = authService.getCurrentUser();
    return currentUser ? currentUser.id : null;
  }

  /**
   * Subscribes to contact change events (add, edit, delete).
   */
  subscribe(listener: ContactListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.warn('Contact listener notification error:', e);
      }
    });
  }

  /**
   * Retrieves all emergency contacts for the authenticated user.
   */
  async getContacts(overrideUserId?: string): Promise<EmergencyContact[]> {
    const userId = this.getActiveUserId(overrideUserId);
    if (!userId) {
      return [];
    }
    return await contactRepository.getEmergencyContacts(userId);
  }

  /**
   * Retrieves a single emergency contact for the authenticated user by contact_id.
   */
  async getContactById(contactId: string, overrideUserId?: string): Promise<EmergencyContact | null> {
    const userId = this.getActiveUserId(overrideUserId);
    if (!userId || !contactId) {
      return null;
    }
    return await contactRepository.getEmergencyContact(contactId, userId);
  }

  /**
   * Validates and saves a new emergency contact.
   */
  async addContact(
    data: {
      name: string;
      mobileNumber: string;
      relationship: string;
    },
    overrideUserId?: string
  ): Promise<{ success: boolean; contact?: EmergencyContact; error?: string }> {
    const userId = this.getActiveUserId(overrideUserId);
    if (!userId) {
      return { success: false, error: 'You must be logged in to add emergency contacts.' };
    }

    // 1. Name validation
    if (!data.name || data.name.trim().length === 0) {
      return { success: false, error: 'Contact name is required.' };
    }

    // 2. Mobile validation
    const mobileCheck = validateIndianMobile(data.mobileNumber);
    if (!mobileCheck.isValid) {
      return {
        success: false,
        error: mobileCheck.error || 'Please enter a valid 10-digit Indian mobile number.',
      };
    }

    // 3. Relationship validation
    if (!data.relationship || data.relationship.trim().length === 0) {
      return { success: false, error: 'Relationship is required.' };
    }

    // 4. Duplicate mobile check for the current user
    const existing = await contactRepository.findByMobileNumber(userId, mobileCheck.formattedNumber);
    if (existing) {
      return {
        success: false,
        error: `An emergency contact with mobile number ${mobileCheck.formattedNumber} already exists in your list.`,
      };
    }

    try {
      const newContact = await contactRepository.addEmergencyContact(userId, {
        name: data.name.trim(),
        mobileNumber: mobileCheck.formattedNumber,
        countryCode: '+91',
        relationship: data.relationship.trim(),
      });

      this.notify();
      return { success: true, contact: newContact };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to save emergency contact.' };
    }
  }

  /**
   * Validates and updates an existing emergency contact.
   */
  async updateContact(
    contactId: string,
    data: {
      name: string;
      mobileNumber: string;
      relationship: string;
    },
    overrideUserId?: string
  ): Promise<{ success: boolean; contact?: EmergencyContact; error?: string }> {
    const userId = this.getActiveUserId(overrideUserId);
    if (!userId) {
      return { success: false, error: 'You must be logged in to edit emergency contacts.' };
    }

    if (!contactId) {
      return { success: false, error: 'Contact ID is required.' };
    }

    // 1. Name validation
    if (!data.name || data.name.trim().length === 0) {
      return { success: false, error: 'Contact name is required.' };
    }

    // 2. Mobile validation
    const mobileCheck = validateIndianMobile(data.mobileNumber);
    if (!mobileCheck.isValid) {
      return {
        success: false,
        error: mobileCheck.error || 'Please enter a valid 10-digit Indian mobile number.',
      };
    }

    // 3. Relationship validation
    if (!data.relationship || data.relationship.trim().length === 0) {
      return { success: false, error: 'Relationship is required.' };
    }

    // 4. Verify contact exists and belongs to this user
    const current = await contactRepository.getEmergencyContact(contactId, userId);
    if (!current) {
      return { success: false, error: 'Contact not found or does not belong to your account.' };
    }

    // 5. Duplicate check (another contact with this number)
    const existingWithNumber = await contactRepository.findByMobileNumber(userId, mobileCheck.formattedNumber);
    if (existingWithNumber && existingWithNumber.contact_id !== contactId) {
      return {
        success: false,
        error: `Another emergency contact with mobile number ${mobileCheck.formattedNumber} already exists in your list.`,
      };
    }

    try {
      const updated = await contactRepository.updateEmergencyContact(contactId, userId, {
        name: data.name.trim(),
        mobileNumber: mobileCheck.formattedNumber,
        countryCode: '+91',
        relationship: data.relationship.trim(),
      });

      this.notify();
      return { success: true, contact: updated };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update emergency contact.' };
    }
  }

  /**
   * Deletes an emergency contact.
   */
  async deleteContact(
    contactId: string,
    overrideUserId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const userId = this.getActiveUserId(overrideUserId);
    if (!userId) {
      return { success: false, error: 'You must be logged in to delete emergency contacts.' };
    }

    if (!contactId) {
      return { success: false, error: 'Contact ID is required.' };
    }

    try {
      const deleted = await contactRepository.deleteEmergencyContact(contactId, userId);
      if (!deleted) {
        return { success: false, error: 'Contact not found or does not belong to your account.' };
      }
      this.notify();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete emergency contact.' };
    }
  }

  /**
   * Returns total count of contacts for the authenticated user.
   */
  async getContactCount(overrideUserId?: string): Promise<number> {
    const userId = this.getActiveUserId(overrideUserId);
    if (!userId) return 0;
    return await contactRepository.count(userId);
  }
}

export const contactService = new ContactService();
