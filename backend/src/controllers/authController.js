const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { generateToken } = require('../middleware/auth');

/**
 * Generate a secure 6-digit numeric OTP
 */
function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Register User
 * POST /api/register
 */
async function register(req, res) {
  try {
    const { name, mobile, password } = req.body;

    if (!name || !mobile || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, mobile number, and password are required.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    // Check if user already exists
    const [existingUsers] = await db.query('SELECT * FROM users WHERE mobile = ?', [mobile]);
    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this mobile number already exists. Please log in.'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const [result] = await db.query(
      'INSERT INTO users (name, mobile, password_hash, fcm_token) VALUES (?, ?, ?, ?)',
      [name, mobile, passwordHash, req.body.fcm_token || null]
    );

    const userId = result.insertId;

    // Generate 6-digit OTP
    const otpCode = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.query(
      'INSERT INTO otp_records (mobile, otp_code, purpose, expires_at) VALUES (?, ?, ?, ?)',
      [mobile, otpCode, 'registration', expiresAt]
    );

    // In a production SMS environment this sends via SMS gateway.
    // For transparent verification during app demo/testing, we return it in the response as well.
    console.log(`[OTP Gateway] Registration OTP for ${mobile}: ${otpCode}`);

    return res.status(201).json({
      success: true,
      message: 'Registration initiated. Please verify your OTP to complete activation.',
      userId,
      mobile,
      otpCode // Included for testing and demonstration convenience
    });
  } catch (error) {
    console.error('[Register Error]', error);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
}

/**
 * Verify OTP
 * POST /api/verify-otp
 */
async function verifyOtp(req, res) {
  try {
    const { mobile, otpCode, purpose } = req.body;

    if (!mobile || !otpCode) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number and OTP code are required.'
      });
    }

    const [records] = await db.query(
      'SELECT * FROM otp_records WHERE mobile = ? ORDER BY created_at DESC',
      [mobile]
    );

    if (!records || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No OTP record found for this mobile number.'
      });
    }

    const latestOtp = records[0];

    // Check if OTP matches
    if (latestOtp.otp_code !== otpCode.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP code. Please enter the correct code.'
      });
    }

    // Check expiry
    if (new Date() > new Date(latestOtp.expires_at)) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new code.'
      });
    }

    // Mark verified
    await db.query('UPDATE otp_records SET is_verified = TRUE WHERE id = ?', [latestOtp.id]);

    // Fetch user details
    const [users] = await db.query('SELECT id, name, mobile, created_at FROM users WHERE mobile = ?', [mobile]);
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = users[0];
    const token = generateToken(user);

    return res.json({
      success: true,
      message: 'OTP verified successfully.',
      token,
      user
    });
  } catch (error) {
    console.error('[Verify OTP Error]', error);
    return res.status(500).json({ success: false, message: 'Server error verifying OTP.' });
  }
}

/**
 * User Login
 * POST /api/login
 */
async function login(req, res) {
  try {
    const { mobile, password, fcm_token } = req.body;

    if (!mobile || !password) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number and password are required.'
      });
    }

    const [users] = await db.query('SELECT * FROM users WHERE mobile = ?', [mobile]);
    if (!users || users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid mobile number or password.'
      });
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid mobile number or password.'
      });
    }

    // Update FCM token if supplied
    if (fcm_token) {
      await db.query('UPDATE users SET fcm_token = ? WHERE id = ?', [fcm_token, user.id]);
    }

    const token = generateToken(user);

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        fcm_token: fcm_token || user.fcm_token,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('[Login Error]', error);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
}

/**
 * Forgot Password - Send OTP
 * POST /api/forgot-password
 */
async function forgotPassword(req, res) {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Mobile number is required.' });
    }

    const [users] = await db.query('SELECT id, name FROM users WHERE mobile = ?', [mobile]);
    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No registered user found with this mobile number.'
      });
    }

    const otpCode = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.query(
      'INSERT INTO otp_records (mobile, otp_code, purpose, expires_at) VALUES (?, ?, ?, ?)',
      [mobile, otpCode, 'forgot_password', expiresAt]
    );

    console.log(`[OTP Gateway] Password Reset OTP for ${mobile}: ${otpCode}`);

    return res.json({
      success: true,
      message: 'Password reset OTP generated.',
      otpCode // Returned for demo/testing convenience
    });
  } catch (error) {
    console.error('[Forgot Password Error]', error);
    return res.status(500).json({ success: false, message: 'Server error generating reset OTP.' });
  }
}

/**
 * Reset Password
 * POST /api/reset-password
 */
async function resetPassword(req, res) {
  try {
    const { mobile, otpCode, newPassword } = req.body;

    if (!mobile || !otpCode || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number, OTP code, and new password are required.'
      });
    }

    const [records] = await db.query(
      'SELECT * FROM otp_records WHERE mobile = ? ORDER BY created_at DESC',
      [mobile]
    );

    if (!records || records.length === 0 || records[0].otp_code !== otpCode.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await db.query('UPDATE users SET password_hash = ? WHERE mobile = ?', [passwordHash, mobile]);

    return res.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in.'
    });
  } catch (error) {
    console.error('[Reset Password Error]', error);
    return res.status(500).json({ success: false, message: 'Server error resetting password.' });
  }
}

/**
 * Get Current User Profile
 * GET /api/profile
 */
async function getProfile(req, res) {
  try {
    const [users] = await db.query(
      'SELECT id, name, mobile, safety_status, fcm_token, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: 'User profile not found.' });
    }

    return res.json({
      success: true,
      user: users[0]
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error fetching profile.' });
  }
}

/**
 * Update FCM Token
 * POST /api/update-fcm-token
 */
async function updateFcmToken(req, res) {
  try {
    const { fcm_token } = req.body;
    if (!fcm_token) {
      return res.status(400).json({ success: false, message: 'fcm_token is required.' });
    }

    await db.query('UPDATE users SET fcm_token = ? WHERE id = ?', [fcm_token, req.user.id]);

    return res.json({
      success: true,
      message: 'FCM token updated successfully.'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update FCM token.' });
  }
}

/**
 * Update Profile
 * PUT /api/profile
 */
async function updateProfile(req, res) {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name cannot be empty.' });
    }

    await db.query('UPDATE users SET name = ? WHERE id = ?', [name.trim(), req.user.id]);

    const [users] = await db.query(
      'SELECT id, name, mobile, safety_status, fcm_token, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: users ? users[0] : null
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
}

/**
 * Update Safety Status
 * POST /api/profile/status
 */
async function updateSafetyStatus(req, res) {
  try {
    const { safety_status } = req.body;
    const allowed = ['safe', 'distress', 'monitoring', 'idle'];
    if (!safety_status || !allowed.includes(safety_status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid safety_status. Allowed values: ${allowed.join(', ')}`
      });
    }

    await db.query('UPDATE users SET safety_status = ? WHERE id = ?', [safety_status, req.user.id]);

    return res.json({
      success: true,
      message: `Safety status updated to ${safety_status}.`,
      safety_status
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update safety status.' });
  }
}

module.exports = {
  register,
  verifyOtp,
  login,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  updateSafetyStatus,
  updateFcmToken
};
