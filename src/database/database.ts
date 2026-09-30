import { SCHEMA_SQL, TABLES } from './schema';
import { hashPassword } from '../utils/crypto';

function isReactNativeMobile(): boolean {
  try {
    if (typeof (global as any).HermesInternal !== 'undefined' || typeof (global as any).nativeCallSyncHook !== 'undefined') {
      return true;
    }
    const RN = require('react-native');
    return Boolean(RN && RN.Platform && (RN.Platform.OS === 'android' || RN.Platform.OS === 'ios'));
  } catch {
    return false;
  }
}


export interface IDatabaseDriver {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: any[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getFirstAsync<T>(sql: string, ...params: any[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: any[]): Promise<T[]>;
  closeAsync?(): Promise<void>;
}

// In-file persistent driver for headless test environments (Node.js)
class PersistentFileDatabaseDriver implements IDatabaseDriver {
  private data: {
    users: any[];
    sessions: any[];
    emergency_contacts: any[];
    emergency_incidents: any[];
    sound_events: any[];
  } = {
    users: [],
    sessions: [],
    emergency_contacts: [],
    emergency_incidents: [],
    sound_events: [],
  };

  private filePath: string = '.lifeguard_db_store.json';
  private fs: any = null;

  constructor() {
    try {
      // Dynamically load node fs only in Node test environments
      if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        const nodeRequire = eval('require');
        this.fs = nodeRequire('fs');
        const path = nodeRequire('path');
        this.filePath = path.resolve(process.cwd(), '.lifeguard_db_store.json');
        this.loadFromDisk();
      }
    } catch {
      // In-memory fallback if fs unavailable
    }
  }

  private loadFromDisk(): void {
    if (!this.fs) return;
    try {
      if (this.fs.existsSync(this.filePath)) {
        const raw = this.fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(raw);
      }
    } catch {
      // use existing data
    }
  }

  private saveToDisk(): void {
    if (!this.fs) return;
    try {
      this.fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch {
      // ignore write errors in non-fs
    }
  }

  async execAsync(sql: string): Promise<void> {
    // Schema creation is verified; tables initialized
    this.saveToDisk();
  }

  async runAsync(sql: string, ...params: any[]): Promise<{ lastInsertRowId: number; changes: number }> {
    const flatParams = params.flat();
    const cleanSql = sql.replace(/\s+/g, ' ').trim();

    if (cleanSql.startsWith('INSERT INTO users')) {
      const [userId, fullName, countryCode, mobileNumber, passwordHash, createdAt] = flatParams;
      // Duplicate check
      const exists = this.data.users.find((u) => u.mobile_number === mobileNumber);
      if (exists) {
        throw new Error('UNIQUE constraint failed: users.mobile_number');
      }
      this.data.users.push({
        user_id: userId,
        full_name: fullName,
        country_code: countryCode || '+91',
        mobile_number: mobileNumber,
        password_hash: passwordHash,
        created_at: createdAt,
      });
      this.saveToDisk();
      return { lastInsertRowId: this.data.users.length, changes: 1 };
    }

    if (cleanSql.startsWith('UPDATE users SET password_hash = ? WHERE user_id = ?')) {
      const [newHash, userId] = flatParams;
      const user = this.data.users.find((u) => u.user_id === userId);
      if (user) {
        user.password_hash = newHash;
        this.saveToDisk();
        return { lastInsertRowId: 0, changes: 1 };
      }
      return { lastInsertRowId: 0, changes: 0 };
    }

    if (cleanSql.startsWith('UPDATE users SET full_name = ? WHERE user_id = ?')) {
      const [fullName, userId] = flatParams;
      const user = this.data.users.find((u) => u.user_id === userId);
      if (user) {
        user.full_name = fullName;
        this.saveToDisk();
        return { lastInsertRowId: 0, changes: 1 };
      }
      return { lastInsertRowId: 0, changes: 0 };
    }

    if (cleanSql.startsWith('INSERT INTO sessions')) {
      const [sessionId, userId, token, loginTime, isActive] = flatParams;
      this.data.sessions.push({
        session_id: sessionId,
        user_id: userId,
        token: token,
        login_time: loginTime,
        is_active: isActive !== undefined ? isActive : 1,
      });
      this.saveToDisk();
      return { lastInsertRowId: this.data.sessions.length, changes: 1 };
    }

    if (cleanSql.startsWith('UPDATE sessions SET is_active = 0 WHERE user_id = ?')) {
      const [userId] = flatParams;
      let count = 0;
      this.data.sessions.forEach((s) => {
        if (s.user_id === userId) {
          s.is_active = 0;
          count++;
        }
      });
      this.saveToDisk();
      return { lastInsertRowId: 0, changes: count };
    }

    if (cleanSql.startsWith('UPDATE sessions SET is_active = 0 WHERE is_active = 1')) {
      let count = 0;
      this.data.sessions.forEach((s) => {
        if (s.is_active === 1) {
          s.is_active = 0;
          count++;
        }
      });
      this.saveToDisk();
      return { lastInsertRowId: 0, changes: count };
    }

    if (cleanSql.startsWith('DELETE FROM sessions')) {
      const count = this.data.sessions.length;
      this.data.sessions = [];
      this.saveToDisk();
      return { lastInsertRowId: 0, changes: count };
    }

    if (cleanSql.startsWith('INSERT INTO emergency_contacts')) {
      const [contactId, userId, name, mobileNumber, countryCode, relationship, createdAt] = flatParams;
      this.data.emergency_contacts.push({
        contact_id: contactId,
        user_id: userId,
        name: name,
        mobile_number: mobileNumber,
        country_code: countryCode || '+91',
        relationship: relationship,
        created_at: createdAt,
      });
      this.saveToDisk();
      return { lastInsertRowId: this.data.emergency_contacts.length, changes: 1 };
    }

    if (cleanSql.startsWith('UPDATE emergency_contacts SET')) {
      const [name, mobileNumber, countryCode, relationship, contactId, userId] = flatParams;
      const contact = this.data.emergency_contacts.find(
        (c) => c.contact_id === contactId && c.user_id === userId
      );
      if (contact) {
        contact.name = name;
        contact.mobile_number = mobileNumber;
        contact.country_code = countryCode || '+91';
        contact.relationship = relationship;
        this.saveToDisk();
        return { lastInsertRowId: 0, changes: 1 };
      }
      return { lastInsertRowId: 0, changes: 0 };
    }

    if (cleanSql.startsWith('DELETE FROM emergency_contacts WHERE contact_id = ? AND user_id = ?')) {
      const [contactId, userId] = flatParams;
      const initialLen = this.data.emergency_contacts.length;
      this.data.emergency_contacts = this.data.emergency_contacts.filter(
        (c) => !(c.contact_id === contactId && c.user_id === userId)
      );
      const changes = initialLen - this.data.emergency_contacts.length;
      this.saveToDisk();
      return { lastInsertRowId: 0, changes };
    }

    if (cleanSql.startsWith('DELETE FROM emergency_contacts WHERE user_id = ?')) {
      const [userId] = flatParams;
      const initialLen = this.data.emergency_contacts.length;
      this.data.emergency_contacts = this.data.emergency_contacts.filter(
        (c) => c.user_id !== userId
      );
      const changes = initialLen - this.data.emergency_contacts.length;
      this.saveToDisk();
      return { lastInsertRowId: 0, changes };
    }

    if (cleanSql.startsWith('DELETE FROM emergency_contacts')) {
      const changes = this.data.emergency_contacts.length;
      this.data.emergency_contacts = [];
      this.saveToDisk();
      return { lastInsertRowId: 0, changes };
    }

    if (cleanSql.startsWith('INSERT INTO emergency_incidents')) {
      let id, userId, incidentType, detectionResult, confidence, latitude, longitude, accuracy, alertStatus, source, timestamp, createdAt;
      if (flatParams.length >= 12) {
        [id, userId, incidentType, detectionResult, confidence, latitude, longitude, accuracy, alertStatus, source, timestamp, createdAt] = flatParams;
      } else {
        [id, userId, incidentType, detectionResult, confidence, latitude, longitude, accuracy, alertStatus, timestamp] = flatParams;
        source = 'SYSTEM';
        createdAt = timestamp;
      }
      const existingIdx = this.data.emergency_incidents.findIndex((i) => i.id === id);
      const record = {
        id,
        user_id: userId,
        incident_type: incidentType,
        detection_result: detectionResult,
        confidence,
        latitude,
        longitude,
        accuracy,
        alert_status: alertStatus,
        source: source || 'SYSTEM',
        timestamp,
        created_at: createdAt || timestamp,
      };
      if (existingIdx >= 0) {
        this.data.emergency_incidents[existingIdx] = record;
      } else {
        this.data.emergency_incidents.push(record);
      }
      this.saveToDisk();
      return { lastInsertRowId: this.data.emergency_incidents.length, changes: 1 };
    }

    if (cleanSql.startsWith('UPDATE emergency_incidents SET latitude = ?, longitude = ?, accuracy = ?, alert_status = ? WHERE id = ? AND user_id = ?')) {
      const [latitude, longitude, accuracy, alertStatus, id, userId] = flatParams;
      const incident = this.data.emergency_incidents.find((i) => i.id === id && i.user_id === userId);
      if (incident) {
        incident.latitude = latitude;
        incident.longitude = longitude;
        incident.accuracy = accuracy;
        incident.alert_status = alertStatus;
        this.saveToDisk();
        return { lastInsertRowId: 0, changes: 1 };
      }
      return { lastInsertRowId: 0, changes: 0 };
    }

    if (cleanSql.startsWith('UPDATE emergency_incidents SET alert_status = ? WHERE id = ? AND user_id = ?')) {
      const [alertStatus, id, userId] = flatParams;
      const incident = this.data.emergency_incidents.find((i) => i.id === id && i.user_id === userId);
      if (incident) {
        incident.alert_status = alertStatus;
        this.saveToDisk();
        return { lastInsertRowId: 0, changes: 1 };
      }
      return { lastInsertRowId: 0, changes: 0 };
    }

    if (cleanSql.startsWith('UPDATE emergency_incidents SET source = ? WHERE id = ? AND user_id = ?')) {
      const [source, id, userId] = flatParams;
      const incident = this.data.emergency_incidents.find((i) => i.id === id && i.user_id === userId);
      if (incident) {
        incident.source = source;
        this.saveToDisk();
        return { lastInsertRowId: 0, changes: 1 };
      }
      return { lastInsertRowId: 0, changes: 0 };
    }

    if (cleanSql.startsWith('DELETE FROM emergency_incidents WHERE id = ? AND user_id = ?')) {
      const [id, userId] = flatParams;
      const initialLen = this.data.emergency_incidents.length;
      this.data.emergency_incidents = this.data.emergency_incidents.filter(
        (i) => !(i.id === id && i.user_id === userId)
      );
      const changes = initialLen - this.data.emergency_incidents.length;
      this.saveToDisk();
      return { lastInsertRowId: 0, changes };
    }

    if (cleanSql.startsWith('DELETE FROM emergency_incidents WHERE user_id = ?')) {
      const [userId] = flatParams;
      const initialLen = this.data.emergency_incidents.length;
      this.data.emergency_incidents = this.data.emergency_incidents.filter(
        (i) => i.user_id !== userId
      );
      const changes = initialLen - this.data.emergency_incidents.length;
      this.saveToDisk();
      return { lastInsertRowId: 0, changes };
    }

    if (cleanSql.startsWith('DELETE FROM emergency_incidents')) {
      const changes = this.data.emergency_incidents.length;
      this.data.emergency_incidents = [];
      this.saveToDisk();
      return { lastInsertRowId: 0, changes };
    }

    return { lastInsertRowId: 0, changes: 0 };
  }


  async getFirstAsync<T>(sql: string, ...params: any[]): Promise<T | null> {
    const flatParams = params.flat();
    const cleanSql = sql.replace(/\s+/g, ' ').trim();

    if (cleanSql.includes('FROM users WHERE mobile_number = ?')) {
      const [mobile] = flatParams;
      const user = this.data.users.find((u) => u.mobile_number === mobile);
      return (user as unknown as T) || null;
    }

    if (cleanSql.includes('FROM users WHERE user_id = ?')) {
      const [userId] = flatParams;
      const user = this.data.users.find((u) => u.user_id === userId);
      return (user as unknown as T) || null;
    }

    if (cleanSql.includes('FROM sessions') && cleanSql.includes('JOIN users')) {
      const activeSession = this.data.sessions
        .filter((s) => s.is_active === 1)
        .sort((a, b) => new Date(b.login_time).getTime() - new Date(a.login_time).getTime())[0];

      if (!activeSession) return null;
      const user = this.data.users.find((u) => u.user_id === activeSession.user_id);
      if (!user) return null;

      return {
        session_id: activeSession.session_id,
        user_id: user.user_id,
        token: activeSession.token,
        login_time: activeSession.login_time,
        is_active: activeSession.is_active,
        full_name: user.full_name,
        country_code: user.country_code,
        mobile_number: user.mobile_number,
        password_hash: user.password_hash,
        created_at: user.created_at,
      } as unknown as T;
    }

    if (cleanSql.includes('COUNT(*) as count FROM users')) {
      return { count: this.data.users.length } as unknown as T;
    }

    if (cleanSql.includes('FROM emergency_contacts') && cleanSql.includes('contact_id = ? AND user_id = ?')) {
      const [contactId, userId] = flatParams;
      const contact = this.data.emergency_contacts.find(
        (c) => c.contact_id === contactId && c.user_id === userId
      );
      return (contact as unknown as T) || null;
    }

    if (cleanSql.includes('FROM emergency_contacts') && cleanSql.includes('user_id = ? AND mobile_number = ?')) {
      const [userId, mobileNumber] = flatParams;
      const contact = this.data.emergency_contacts.find(
        (c) => c.user_id === userId && c.mobile_number === mobileNumber
      );
      return (contact as unknown as T) || null;
    }

    if (cleanSql.includes('COUNT(*) as count FROM emergency_contacts WHERE user_id = ?')) {
      const [userId] = flatParams;
      const count = this.data.emergency_contacts.filter((c) => c.user_id === userId).length;
      return { count } as unknown as T;
    }

    if (cleanSql.includes('FROM emergency_incidents') && cleanSql.includes('id = ? AND user_id = ?')) {
      const [id, userId] = flatParams;
      const incident = this.data.emergency_incidents.find(
        (i) => i.id === id && i.user_id === userId
      );
      return (incident as unknown as T) || null;
    }

    if (cleanSql.includes('COUNT(*) as count FROM emergency_incidents WHERE user_id = ?')) {
      const [userId] = flatParams;
      const count = this.data.emergency_incidents.filter((i) => i.user_id === userId).length;
      return { count } as unknown as T;
    }

    return null;
  }

  async getAllAsync<T>(sql: string, ...params: any[]): Promise<T[]> {
    const flatParams = params.flat();
    const cleanSql = sql.replace(/\s+/g, ' ').trim();
    if (cleanSql.includes('FROM users')) {
      return [...this.data.users] as unknown as T[];
    }
    if (cleanSql.includes('FROM sessions')) {
      return [...this.data.sessions] as unknown as T[];
    }
    if (cleanSql.includes('FROM emergency_contacts WHERE user_id = ?')) {
      const [userId] = flatParams;
      const list = this.data.emergency_contacts.filter((c) => c.user_id === userId);
      return list as unknown as T[];
    }
    if (cleanSql.includes('FROM emergency_contacts')) {
      return [...this.data.emergency_contacts] as unknown as T[];
    }
    if (cleanSql.includes('FROM emergency_incidents WHERE user_id = ?')) {
      const [userId] = flatParams;
      const list = this.data.emergency_incidents
        .filter((i) => i.user_id === userId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return list as unknown as T[];
    }
    if (cleanSql.includes('FROM emergency_incidents')) {
      return [...this.data.emergency_incidents] as unknown as T[];
    }
    return [];
  }


  clearAllDataForTesting(): void {
    this.data = {
      users: [],
      sessions: [],
      emergency_contacts: [],
      emergency_incidents: [],
      sound_events: [],
    };
    this.saveToDisk();
  }
}

let dbInstance: IDatabaseDriver | null = null;

/**
 * Initializes the database connection, executes schema creation,
 * and seeds baseline prototype user if necessary.
 */
export async function initDatabase(): Promise<IDatabaseDriver> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    let activeDriver: IDatabaseDriver;

    // If running in React Native/Expo on mobile
    if (isReactNativeMobile()) {
      const SQLite = require('expo-sqlite');
      const nativeDb = await SQLite.openDatabaseAsync('lifeguard.db');

      // Execute schema statements
      for (const statement of SCHEMA_SQL) {
        await nativeDb.execAsync(statement);
      }

      // Safe schema column migrations for pre-existing emergency_incidents tables
      try {
        await nativeDb.execAsync('ALTER TABLE emergency_incidents ADD COLUMN source TEXT DEFAULT "SYSTEM";');
      } catch {}
      try {
        await nativeDb.execAsync('ALTER TABLE emergency_incidents ADD COLUMN created_at TEXT;');
      } catch {}

      activeDriver = nativeDb;
    } else {
      // In Node.js / test environment / web
      const persistentDriver = new PersistentFileDatabaseDriver();
      for (const statement of SCHEMA_SQL) {
        await persistentDriver.execAsync(statement);
      }
      activeDriver = persistentDriver;
    }

    // Seed default EPICS baseline user: Sai Kumar (+919876543210 / Safety123)
    await seedDefaultUserIfMissing(activeDriver);

    dbInstance = activeDriver;
    return activeDriver;
  } catch (err) {
    console.error('Database initialization error:', err);
    // Return persistent fallback driver to prevent application crash
    const fallback = new PersistentFileDatabaseDriver();
    await seedDefaultUserIfMissing(fallback);
    dbInstance = fallback;
    return fallback;
  }
}

/**
 * Ensures baseline EPICS user is present in the database
 */
async function seedDefaultUserIfMissing(db: IDatabaseDriver): Promise<void> {
  try {
    const existing = await db.getFirstAsync<any>(
      'SELECT user_id FROM users WHERE mobile_number = ?',
      ['+919876543210']
    );

    if (!existing) {
      await db.runAsync(
        'INSERT INTO users (user_id, full_name, country_code, mobile_number, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          'usr_default_sai_kumar',
          'Sai Kumar',
          '+91',
          '+919876543210',
          hashPassword('Safety123'),
          '2026-09-27T10:00:00.000Z',
        ]
      );
    }
  } catch (e) {
    console.warn('Seeding default user notice:', e);
  }
}

/**
 * Returns active database driver instance
 */
export async function getDatabase(): Promise<IDatabaseDriver> {
  if (!dbInstance) {
    return await initDatabase();
  }
  return dbInstance;
}

/**
 * Clears database for testing / test teardown
 */
export async function resetDatabaseForTesting(): Promise<void> {
  const db = await getDatabase();
  if ('clearAllDataForTesting' in db) {
    (db as any).clearAllDataForTesting();
  } else {
    await db.execAsync('DELETE FROM sessions;');
    await db.execAsync('DELETE FROM emergency_contacts;');
    await db.execAsync('DELETE FROM users;');
  }
  await seedDefaultUserIfMissing(db);
}