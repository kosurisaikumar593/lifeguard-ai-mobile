const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool(
  connectionString
    ? {
        connectionString,
        ssl: process.env.NODE_ENV === 'production' || connectionString.includes('sslmode=require')
          ? { rejectUnauthorized: false }
          : false,
      }
    : {
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432', 10),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'lifeguard_db',
      }
);

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool] Unexpected error on idle client:', err);
});

// Auto-initialize schema on server boot
async function initDatabase() {
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          full_name VARCHAR(255) NOT NULL,
          phone_number VARCHAR(32) NOT NULL UNIQUE,
          email VARCHAR(255) UNIQUE,
          country_code VARCHAR(8) DEFAULT '+91',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS trusted_contacts (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          contact_name VARCHAR(255) NOT NULL,
          contact_phone VARCHAR(32) NOT NULL,
          relationship VARCHAR(128) DEFAULT 'Emergency Contact',
          priority_order INT DEFAULT 1,
          status VARCHAR(32) DEFAULT 'connected',
          last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS incidents (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          detection_type VARCHAR(64) NOT NULL,
          confidence_score NUMERIC(5,2) DEFAULT 0.0,
          decibels NUMERIC(5,2) DEFAULT 0.0,
          latitude NUMERIC(10,7),
          longitude NUMERIC(10,7),
          location_accuracy NUMERIC(8,2),
          location_address TEXT,
          map_url TEXT,
          alert_status VARCHAR(32) DEFAULT 'sent',
          recipients_summary JSONB DEFAULT '[]'::jsonb,
          buffer_cancelled BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS location_updates (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          latitude NUMERIC(10,7) NOT NULL,
          longitude NUMERIC(10,7) NOT NULL,
          accuracy NUMERIC(8,2),
          address TEXT,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[PostgreSQL] Database tables verified & initialized successfully.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('[PostgreSQL] Could not connect to PostgreSQL instance:', err.message);
    console.warn('[PostgreSQL] Note: Set DATABASE_URL in .env to connect a live PostgreSQL database.');
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  initDatabase,
};
