-- ====================================================================
-- LifeGuard AI — PostgreSQL Database Schema
-- ====================================================================

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(32) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    country_code VARCHAR(8) DEFAULT '+91',
    password_hash VARCHAR(255),
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

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON trusted_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_incidents_user ON incidents(user_id);
