import { getDatabase } from './database';
import { AuthSession, User } from '../types';

interface ActiveSessionRow {
  session_id: string;
  user_id: string;
  token: string;
  login_time: string;
  is_active: number;
  full_name: string;
  country_code: string;
  mobile_number: string;
  password_hash: string;
  created_at: string;
}

export class SessionRepository {
  /**
   * Generates a unique session identifier
   */
  private generateSessionId(): string {
    return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
  }

  /**
   * Creates a persistent active session in the database for the user.
   * Automatically expires any previously active sessions.
   */
  async createSession(user: User, customToken?: string): Promise<AuthSession> {
    const db = await getDatabase();
    const sessionId = this.generateSessionId();
    const token = customToken || 'tok_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    const loginTime = new Date().toISOString();

    // Deactivate previous active sessions
    await db.runAsync(`UPDATE sessions SET is_active = 0 WHERE is_active = 1`);

    // Insert new active session
    await db.runAsync(
      `INSERT INTO sessions (session_id, user_id, token, login_time, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [sessionId, user.id, token, loginTime]
    );

    return {
      user,
      token,
      loginTime,
    };
  }

  /**
   * Retrieves the currently active session and user from SQLite.
   * Used on application startup to restore authentication state without asking for password.
   */
  async getActiveSession(): Promise<{ session: AuthSession; user: User } | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<ActiveSessionRow>(
      `SELECT s.session_id, s.user_id, s.token, s.login_time, s.is_active,
              u.full_name, u.country_code, u.mobile_number, u.password_hash, u.created_at
       FROM sessions s
       JOIN users u ON s.user_id = u.user_id
       WHERE s.is_active = 1
       ORDER BY s.login_time DESC
       LIMIT 1`
    );

    if (!row) {
      return null;
    }

    const user: User = {
      id: row.user_id,
      fullName: row.full_name,
      countryCode: row.country_code || '+91',
      mobileNumber: row.mobile_number,
      passwordHash: row.password_hash,
      createdAt: row.created_at,
    };

    const session: AuthSession = {
      user,
      token: row.token,
      loginTime: row.login_time,
    };

    return { session, user };
  }

  /**
   * Deactivates the active session upon logout (does NOT delete user record).
   */
  async clearActiveSession(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`UPDATE sessions SET is_active = 0 WHERE is_active = 1`);
  }

  /**
   * Clears all session rows (for testing / reset)
   */
  async clearAll(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM sessions`);
  }
}

export const sessionRepository = new SessionRepository();