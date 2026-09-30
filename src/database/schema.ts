/**
 * LifeGuard AI — SQLite Database Schema Definitions
 * Supports persistent user authentication, session management,
 * and user-isolated tables for emergency contacts, sound events, and incidents.
 */

export const TABLES = {
  USERS: 'users',
  SESSIONS: 'sessions',
  EMERGENCY_CONTACTS: 'emergency_contacts',
  EMERGENCY_INCIDENTS: 'emergency_incidents',
  SOUND_EVENTS: 'sound_events',
} as const;

export const SCHEMA_SQL = [
  // 0. Enable foreign key support in SQLite
  `PRAGMA foreign_keys = ON;`,

  // 1. USERS Table
  `CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY NOT NULL,
    full_name TEXT NOT NULL,
    country_code TEXT NOT NULL DEFAULT '+91',
    mobile_number TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,

  `CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile_number);`,

  // 2. SESSIONS Table (Persistent Authentication Session across App Restarts)
  `CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL,
    login_time TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  );`,

  `CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active);`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);`,

  // 3. EMERGENCY_CONTACTS Table (Phase 7 — User Isolated)
  `CREATE TABLE IF NOT EXISTS emergency_contacts (
    contact_id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    country_code TEXT NOT NULL DEFAULT '+91',
    relationship TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  );`,

  `CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user_id ON emergency_contacts(user_id);`,

  // 4. EMERGENCY_INCIDENTS Table (Phase 13 Manual SOS & Phase 15 Incident Tracking — User Isolated)
  `CREATE TABLE IF NOT EXISTS emergency_incidents (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    incident_type TEXT NOT NULL,
    detection_result TEXT NOT NULL,
    confidence REAL,
    latitude REAL,
    longitude REAL,
    accuracy REAL,
    alert_status TEXT NOT NULL,
    source TEXT DEFAULT 'SYSTEM',
    timestamp TEXT NOT NULL,
    created_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  );`,

  `CREATE INDEX IF NOT EXISTS idx_emergency_incidents_user_id ON emergency_incidents(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_emergency_incidents_timestamp ON emergency_incidents(timestamp);`,

  // 5. SOUND_EVENTS Table (Future Module Schema — User Isolated)
  `CREATE TABLE IF NOT EXISTS sound_events (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    detection_result TEXT NOT NULL,
    confidence REAL,
    decibel_level REAL NOT NULL,
    duration_ms INTEGER NOT NULL,
    is_confirmed_emergency INTEGER NOT NULL DEFAULT 0,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  );`,

  `CREATE INDEX IF NOT EXISTS idx_sound_events_user_id ON sound_events(user_id);`,
];

export interface UserRow {
  user_id: string;
  full_name: string;
  country_code: string;
  mobile_number: string;
  password_hash: string;
  created_at: string;
}

export interface SessionRow {
  session_id: string;
  user_id: string;
  token: string;
  login_time: string;
  is_active: number;
}

export interface EmergencyContactRow {
  contact_id: string;
  user_id: string;
  name: string;
  mobile_number: string;
  country_code: string;
  relationship: string;
  created_at: string;
}

export interface EmergencyIncidentRow {
  id: string;
  user_id: string;
  incident_type: string;
  detection_result: string;
  confidence?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  alert_status: string;
  source?: string | null;
  timestamp: string;
  created_at?: string | null;
}