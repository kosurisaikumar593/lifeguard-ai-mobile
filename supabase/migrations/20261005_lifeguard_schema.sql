-- ====================================================================
-- LifeGuard AI — Supabase Database Schema Migration
-- Migration: 20261005_lifeguard_schema.sql
-- Description: Creates users, trusted_contacts, and incidents tables
--              with Row Level Security (RLS) and Supabase Realtime publication.
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. USERS TABLE
-- Stores core profile information mapped to auth.users if Supabase Auth is used,
-- or supports standalone UUIDs for guest/phone-based accounts.
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    country_code TEXT DEFAULT '+91',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for phone/email lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- 3. TRUSTED CONTACTS TABLE
-- Stores connected emergency contacts per user with app-to-app connection status.
CREATE TABLE IF NOT EXISTS public.trusted_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    contact_name TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    relationship TEXT DEFAULT 'Emergency Contact',
    priority_order INTEGER DEFAULT 1,
    status TEXT CHECK (status IN ('pending', 'connected')) DEFAULT 'connected' NOT NULL,
    last_active TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trusted_contacts_user_id ON public.trusted_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_contacts_status ON public.trusted_contacts(status);

-- 4. INCIDENTS TABLE
-- Stores emergency dispatches, acoustic triggers (>90 dB distress screams),
-- and manual SOS activations with metadata (GPS coordinates, map URLs)
-- without saving any raw audio files.
CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    detection_type TEXT CHECK (detection_type IN ('scream', 'manual_sos', 'location_share')) NOT NULL,
    confidence_score NUMERIC(5,2) DEFAULT 0.0,
    decibels NUMERIC(5,2) DEFAULT 0.0,
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    location_accuracy NUMERIC(8,2),
    location_address TEXT,
    map_url TEXT,
    alert_status TEXT CHECK (alert_status IN ('sent', 'delivered', 'acknowledged', 'cancelled', 'failed')) DEFAULT 'sent' NOT NULL,
    recipients_summary JSONB DEFAULT '[]'::jsonb,
    buffer_cancelled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incidents_user_id ON public.incidents(user_id);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON public.incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(alert_status);

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- Allow users to read/update their own profile
CREATE POLICY "Users can read own profile"
    ON public.users FOR SELECT
    USING (auth.uid() IS NULL OR auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() IS NULL OR auth.uid() = id);

CREATE POLICY "Allow user registration insert"
    ON public.users FOR INSERT
    WITH CHECK (true);

-- Allow users to manage their own trusted contacts
CREATE POLICY "Users can manage own contacts"
    ON public.trusted_contacts FOR ALL
    USING (auth.uid() IS NULL OR auth.uid() = user_id)
    WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);

-- Allow users to view and insert their own incidents
CREATE POLICY "Users can manage own incidents"
    ON public.incidents FOR ALL
    USING (auth.uid() IS NULL OR auth.uid() = user_id)
    WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);

-- 6. ENABLE SUPABASE REALTIME REPLICATION
-- Required so connected contacts receive live emergency notifications when
-- an incident is inserted into the incidents table.
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trusted_contacts;
