const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { fullName, phoneNumber, email } = req.body;
    if (!fullName || !phoneNumber) {
      return res.status(400).json({ error: 'Full name and phone number are required' });
    }

    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '').slice(-10);
    const userId = `usr_${Buffer.from(cleanPhone).toString('base64').replace(/=/g, '').slice(0, 16)}`;
    const userEmail = email || `${cleanPhone}@lifeguard.ai`;

    const result = await db.query(
      `INSERT INTO users (id, full_name, phone_number, email, country_code)
       VALUES ($1, $2, $3, $4, '+91')
       ON CONFLICT (phone_number) 
       DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email
       RETURNING *`,
      [userId, fullName, `+91${cleanPhone}`, userEmail]
    );

    const user = result.rows[0];
    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        mobileNumber: user.phone_number,
        email: user.email,
        countryCode: user.country_code,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    console.error('[Auth Register Error]:', err);
    res.status(500).json({ error: 'Failed to register user', details: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { emailOrPhone } = req.body;
    if (!emailOrPhone) {
      return res.status(400).json({ error: 'Email or phone number is required' });
    }

    const cleanQuery = emailOrPhone.includes('@')
      ? emailOrPhone.trim().toLowerCase()
      : `%${emailOrPhone.replace(/[^0-9]/g, '').slice(-10)}`;

    const result = await db.query(
      `SELECT * FROM users WHERE email = $1 OR phone_number LIKE $2 LIMIT 1`,
      [emailOrPhone.trim().toLowerCase(), cleanQuery]
    );

    if (result.rows.length === 0) {
      // Auto-provision demo session if not found
      const cleanPhone = emailOrPhone.replace(/[^0-9]/g, '').slice(-10) || '9876543210';
      const userId = `usr_${Buffer.from(cleanPhone).toString('base64').replace(/=/g, '').slice(0, 16)}`;
      const autoUser = await db.query(
        `INSERT INTO users (id, full_name, phone_number, email)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (phone_number) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING *`,
        [userId, 'LifeGuard User', `+91${cleanPhone}`, `${cleanPhone}@lifeguard.ai`]
      );

      const u = autoUser.rows[0];
      return res.json({
        success: true,
        user: {
          id: u.id,
          fullName: u.full_name,
          mobileNumber: u.phone_number,
          email: u.email,
          createdAt: u.created_at,
        },
      });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        mobileNumber: user.phone_number,
        email: user.email,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    console.error('[Auth Login Error]:', err);
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});

// GET /api/auth/me/:userId
router.get('/me/:userId', async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM users WHERE id = $1`, [req.params.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const u = result.rows[0];
    res.json({
      id: u.id,
      fullName: u.full_name,
      mobileNumber: u.phone_number,
      email: u.email,
      createdAt: u.created_at,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user', details: err.message });
  }
});

module.exports = router;
