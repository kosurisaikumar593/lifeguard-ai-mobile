import { getDatabase } from './database';
import { UserRow } from './schema';
import { User } from '../types';

export class UserRepository {
  /**
   * Maps SQLite database row to domain User model
   */
  private mapRowToUser(row: UserRow): User {
    return {
      id: row.user_id,
      userId: row.user_id,
      fullName: row.full_name,
      countryCode: row.country_code || '+91',
      mobileNumber: row.mobile_number,
      passwordHash: row.password_hash,
      createdAt: row.created_at,
    };
  }

  /**
   * Generates a unique sequential/entropy-backed user ID (e.g. usr_1001, usr_1002...)
   */
  private generateUserId(): string {
    const timestamp = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 6);
    return `usr_${timestamp}_${rand}`;
  }

  /**
   * Creates a new user record in the USERS table.
   * Rejects duplicate mobile numbers through SQLite UNIQUE constraint.
   */
  async createUser(data: {
    id?: string;
    fullName: string;
    countryCode?: string;
    mobileNumber: string;
    passwordHash: string;
    createdAt?: string;
  }): Promise<User> {
    const db = await getDatabase();
    const userId = data.id || this.generateUserId();
    const countryCode = data.countryCode || '+91';
    const createdAt = data.createdAt || new Date().toISOString();

    await db.runAsync(
      `INSERT INTO users (user_id, full_name, country_code, mobile_number, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, data.fullName.trim(), countryCode, data.mobileNumber, data.passwordHash, createdAt]
    );

    return {
      id: userId,
      fullName: data.fullName.trim(),
      countryCode,
      mobileNumber: data.mobileNumber,
      passwordHash: data.passwordHash,
      createdAt,
    };
  }

  /**
   * Finds user by unique mobile number
   */
  async findByMobileNumber(mobileNumber: string): Promise<User | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<UserRow>(
      `SELECT user_id, full_name, country_code, mobile_number, password_hash, created_at
       FROM users WHERE mobile_number = ?`,
      [mobileNumber]
    );

    if (!row) {
      return null;
    }
    return this.mapRowToUser(row);
  }

  /**
   * Finds user by unique user ID (used for data isolation and relational lookup)
   */
  async findById(userId: string): Promise<User | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<UserRow>(
      `SELECT user_id, full_name, country_code, mobile_number, password_hash, created_at
       FROM users WHERE user_id = ?`,
      [userId]
    );

    if (!row) {
      return null;
    }
    return this.mapRowToUser(row);
  }

  /**
   * Updates user password hash (used after OTP verification)
   */
  async updatePassword(userId: string, newPasswordHash: string): Promise<boolean> {
    const db = await getDatabase();
    const res = await db.runAsync(
      `UPDATE users SET password_hash = ? WHERE user_id = ?`,
      [newPasswordHash, userId]
    );
    return res.changes > 0;
  }

  /**
   * Updates user full name in SQLite database with user isolation
   */
  async updateFullName(userId: string, newFullName: string): Promise<boolean> {
    if (!userId || !newFullName || newFullName.trim().length === 0) return false;
    const db = await getDatabase();
    const res = await db.runAsync(
      `UPDATE users SET full_name = ? WHERE user_id = ?`,
      [newFullName.trim(), userId]
    );
    return res.changes > 0;
  }

  /**
   * Updates profile data in SQLite
   */
  async updateProfile(userId: string, data: { fullName: string }): Promise<boolean> {
    return this.updateFullName(userId, data.fullName);
  }

  /**
   * Returns all users in the database
   */
  async getAllUsers(): Promise<User[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<UserRow>(
      `SELECT user_id, full_name, country_code, mobile_number, password_hash, created_at FROM users`
    );
    return rows.map((r) => this.mapRowToUser(r));
  }

  /**
   * Returns total count of registered users
   */
  async count(): Promise<number> {
    const db = await getDatabase();
    const res = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM users`);
    return res ? res.count : 0;
  }
}

export const userRepository = new UserRepository();