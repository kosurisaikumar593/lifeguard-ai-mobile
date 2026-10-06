-- LifeGuard AI MySQL Database Schema
-- Database: lifeguard_ai

CREATE DATABASE IF NOT EXISTS lifeguard_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lifeguard_ai;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    mobile VARCHAR(20) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    fcm_token TEXT DEFAULT NULL,
    safety_status ENUM('safe', 'distress', 'monitoring', 'idle') DEFAULT 'idle',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_mobile (mobile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. OTP Records Table
CREATE TABLE IF NOT EXISTS otp_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mobile VARCHAR(20) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    purpose ENUM('registration', 'forgot_password', 'verification') NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_otp_mobile (mobile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Contacts Table (App-to-App contacts between LifeGuard AI users)
CREATE TABLE IF NOT EXISTS contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    contact_user_id INT DEFAULT NULL,
    contact_name VARCHAR(120) NOT NULL,
    contact_mobile VARCHAR(20) NOT NULL,
    status ENUM('pending', 'accepted', 'connected') DEFAULT 'pending',
    is_emergency_recipient BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_contact_user (user_id),
    INDEX idx_contact_recipient (contact_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Emergency Events Table
CREATE TABLE IF NOT EXISTS emergency_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    detection_type VARCHAR(60) DEFAULT 'sound_monitoring',
    sound_level INT DEFAULT NULL,
    sound_type ENUM('human', 'environmental', 'unknown', 'manual') DEFAULT 'unknown',
    sound_subtype VARCHAR(80) DEFAULT NULL,
    ai_confidence DECIMAL(4, 2) DEFAULT NULL,
    possible_emergency BOOLEAN DEFAULT FALSE,
    ai_reason TEXT DEFAULT NULL,
    user_response ENUM('safe', 'help', 'no_response', 'manual_sos', 'alarm_only') DEFAULT 'no_response',
    emergency_status ENUM('initiated', 'alerted', 'acknowledged', 'cancelled', 'resolved') DEFAULT 'initiated',
    latitude DECIMAL(10, 7) DEFAULT NULL,
    longitude DECIMAL(10, 7) DEFAULT NULL,
    location_address VARCHAR(255) DEFAULT NULL,
    contacts_notified_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_emergency_user (user_id),
    INDEX idx_emergency_status (emergency_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Location Records Table
CREATE TABLE IF NOT EXISTS location_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    emergency_id INT DEFAULT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    accuracy FLOAT DEFAULT NULL,
    address VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (emergency_id) REFERENCES emergency_events(id) ON DELETE SET NULL,
    INDEX idx_location_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    sender_id INT DEFAULT NULL,
    emergency_id INT DEFAULT NULL,
    type VARCHAR(60) NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    data_payload JSON DEFAULT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notif_user (user_id),
    INDEX idx_notif_unread (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
