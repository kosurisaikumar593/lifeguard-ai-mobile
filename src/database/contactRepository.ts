import { getDatabase } from './database';
import { EmergencyContactRow } from './schema';
import { EmergencyContact } from '../types';

export class ContactRepository {
  /**
   * Maps SQLite database row to domain EmergencyContact model
   */
  private mapRowToContact(row: EmergencyContactRow): EmergencyContact {
    return {
      contact_id: row.contact_id,
      id: row.contact_id,
      user_id: row.user_id,
      userId: row.user_id,
      name: row.name,
      mobile_number: row.mobile_number,
      phone: row.mobile_number,
      country_code: row.country_code || '+91',
      relationship: row.relationship,
      created_at: row.created_at,
    };
  }

  /**
   * Generates a unique sequential/entropy-backed contact ID (e.g. cnt_...)
   */
  private generateContactId(): string {
    const timestamp = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 6);
    return `cnt_${timestamp}_${rand}`;
  }

  /**
   * Retrieves all emergency contacts belonging to the specified user_id.
   * NEVER loads other users' contacts.
   */
  async getEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
    if (!userId) return [];
    const db = await getDatabase();
    const rows = await db.getAllAsync<EmergencyContactRow>(
      `SELECT contact_id, user_id, name, mobile_number, country_code, relationship, created_at
       FROM emergency_contacts
       WHERE user_id = ?
       ORDER BY created_at ASC`,
      [userId]
    );
    return rows.map((r) => this.mapRowToContact(r));
  }

  /**
   * Retrieves a single emergency contact by contact_id, strictly scoped by user_id.
   */
  async getEmergencyContact(contactId: string, userId: string): Promise<EmergencyContact | null> {
    if (!contactId || !userId) return null;
    const db = await getDatabase();
    const row = await db.getFirstAsync<EmergencyContactRow>(
      `SELECT contact_id, user_id, name, mobile_number, country_code, relationship, created_at
       FROM emergency_contacts
       WHERE contact_id = ? AND user_id = ?`,
      [contactId, userId]
    );
    return row ? this.mapRowToContact(row) : null;
  }

  /**
   * Looks up whether a contact with the given mobile number already exists for this user.
   */
  async findByMobileNumber(userId: string, mobileNumber: string): Promise<EmergencyContact | null> {
    if (!userId || !mobileNumber) return null;
    const db = await getDatabase();
    const row = await db.getFirstAsync<EmergencyContactRow>(
      `SELECT contact_id, user_id, name, mobile_number, country_code, relationship, created_at
       FROM emergency_contacts
       WHERE user_id = ? AND mobile_number = ?`,
      [userId, mobileNumber]
    );
    return row ? this.mapRowToContact(row) : null;
  }

  /**
   * Adds a new emergency contact associated with the authenticated user's user_id.
   */
  async addEmergencyContact(
    userId: string,
    data: {
      name: string;
      mobileNumber: string;
      countryCode?: string;
      relationship: string;
      contactId?: string;
      createdAt?: string;
    }
  ): Promise<EmergencyContact> {
    if (!userId) {
      throw new Error('Cannot add contact: user_id is required.');
    }
    const db = await getDatabase();
    const contactId = data.contactId || this.generateContactId();
    const countryCode = data.countryCode || '+91';
    const createdAt = data.createdAt || new Date().toISOString();

    await db.runAsync(
      `INSERT INTO emergency_contacts (contact_id, user_id, name, mobile_number, country_code, relationship, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [contactId, userId, data.name.trim(), data.mobileNumber, countryCode, data.relationship.trim(), createdAt]
    );

    return {
      contact_id: contactId,
      id: contactId,
      user_id: userId,
      userId: userId,
      name: data.name.trim(),
      mobile_number: data.mobileNumber,
      phone: data.mobileNumber,
      country_code: countryCode,
      relationship: data.relationship.trim(),
      created_at: createdAt,
    };
  }

  /**
   * Updates an existing emergency contact.
   * Requires both contact_id AND user_id to prevent cross-user unauthorized edits.
   */
  async updateEmergencyContact(
    contactId: string,
    userId: string,
    data: {
      name: string;
      mobileNumber: string;
      countryCode?: string;
      relationship: string;
    }
  ): Promise<EmergencyContact> {
    if (!contactId || !userId) {
      throw new Error('Cannot update contact: contact_id and user_id are required.');
    }
    const db = await getDatabase();
    const countryCode = data.countryCode || '+91';

    const result = await db.runAsync(
      `UPDATE emergency_contacts
       SET name = ?, mobile_number = ?, country_code = ?, relationship = ?
       WHERE contact_id = ? AND user_id = ?`,
      [data.name.trim(), data.mobileNumber, countryCode, data.relationship.trim(), contactId, userId]
    );

    if (result.changes === 0) {
      throw new Error('Contact not found or does not belong to the authenticated user.');
    }

    const updated = await this.getEmergencyContact(contactId, userId);
    if (!updated) {
      throw new Error('Failed to retrieve updated contact.');
    }
    return updated;
  }

  /**
   * Deletes an emergency contact.
   * Requires both contact_id AND user_id to prevent cross-user unauthorized deletes.
   */
  async deleteEmergencyContact(contactId: string, userId: string): Promise<boolean> {
    if (!contactId || !userId) return false;
    const db = await getDatabase();
    const result = await db.runAsync(
      `DELETE FROM emergency_contacts WHERE contact_id = ? AND user_id = ?`,
      [contactId, userId]
    );
    return result.changes > 0;
  }

  /**
   * Counts the number of emergency contacts for a given user.
   */
  async count(userId: string): Promise<number> {
    if (!userId) return 0;
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM emergency_contacts WHERE user_id = ?`,
      [userId]
    );
    return result ? Number(result.count) : 0;
  }

  /**
   * Clears all contacts for a user (used for testing or account cleanup).
   */
  async clearUserContacts(userId: string): Promise<number> {
    if (!userId) return 0;
    const db = await getDatabase();
    const result = await db.runAsync(
      `DELETE FROM emergency_contacts WHERE user_id = ?`,
      [userId]
    );
    return result.changes;
  }
}

export const contactRepository = new ContactRepository();
