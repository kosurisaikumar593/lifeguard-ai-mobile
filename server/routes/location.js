const express = require('express');
const db = require('../db');

module.exports = function (io) {
  const router = express.Router();

  // POST /api/location/share
  // Records live GPS coordinates & broadcasts location ping via Socket.io
  router.post('/share', async (req, res) => {
    try {
      const { userId, latitude, longitude, accuracy, address } = req.body;
      if (!userId || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'userId, latitude, and longitude are required' });
      }

      const result = await db.query(
        `INSERT INTO location_updates (user_id, latitude, longitude, accuracy, address)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, latitude, longitude, accuracy || null, address || null]
      );

      const loc = result.rows[0];
      const payload = {
        userId: loc.user_id,
        latitude: parseFloat(loc.latitude),
        longitude: parseFloat(loc.longitude),
        accuracy: loc.accuracy ? parseFloat(loc.accuracy) : null,
        address: loc.address,
        mapUrl: `https://maps.google.com/?q=${loc.latitude},${loc.longitude}`,
        timestamp: loc.timestamp,
      };

      if (io) {
        io.to(`user_${userId}`).emit('live_location_update', payload);
        io.emit('contact_location_update', payload);
      }

      res.status(201).json({ success: true, location: payload });
    } catch (err) {
      console.error('[Location Share Error]:', err);
      res.status(500).json({ error: 'Failed to record location', details: err.message });
    }
  });

  // GET /api/location/last/:userId
  router.get('/last/:userId', async (req, res) => {
    try {
      const result = await db.query(
        `SELECT * FROM location_updates WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 1`,
        [req.params.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No location found for this user' });
      }

      const loc = result.rows[0];
      res.json({
        userId: loc.user_id,
        latitude: parseFloat(loc.latitude),
        longitude: parseFloat(loc.longitude),
        accuracy: loc.accuracy ? parseFloat(loc.accuracy) : null,
        address: loc.address,
        mapUrl: `https://maps.google.com/?q=${loc.latitude},${loc.longitude}`,
        timestamp: loc.timestamp,
      });
    } catch (err) {
      console.error('[Location Get Error]:', err);
      res.status(500).json({ error: 'Failed to fetch location', details: err.message });
    }
  });

  return router;
};
