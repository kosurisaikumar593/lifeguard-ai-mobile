const express = require('express');
const db = require('../db');

module.exports = function (io) {
  const router = express.Router();

  // GET /api/incidents?userId=...
  router.get('/', async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ error: 'userId query parameter is required' });
      }

      const result = await db.query(
        `SELECT * FROM incidents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [userId]
      );

      const incidents = result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        incidentType: row.detection_type === 'manual_sos' ? 'MANUAL_SOS' : 'DISTRESS_SCREAM',
        detectionResult: row.detection_type === 'manual_sos' ? 'Manual SOS Pressed' : 'Distress Scream Verified',
        decibels: parseFloat(row.decibels || 0),
        confidence: parseFloat(row.confidence_score || 0),
        latitude: row.latitude ? parseFloat(row.latitude) : undefined,
        longitude: row.longitude ? parseFloat(row.longitude) : undefined,
        locationAccuracy: row.location_accuracy ? parseFloat(row.location_accuracy) : undefined,
        locationAddress: row.location_address,
        alertStatus: row.alert_status?.toUpperCase() || 'SENT',
        createdAt: row.created_at,
        recipientsSummary: row.recipients_summary,
        bufferCancelled: row.buffer_cancelled,
      }));

      res.json(incidents);
    } catch (err) {
      console.error('[Incidents GET Error]:', err);
      res.status(500).json({ error: 'Failed to fetch incidents', details: err.message });
    }
  });

  // POST /api/incidents
  // Logs incident into PostgreSQL & emits real-time WebSocket alert via Socket.io
  router.post('/', async (req, res) => {
    try {
      const {
        userId,
        incidentType,
        detectionResult,
        decibels,
        confidence,
        latitude,
        longitude,
        locationAccuracy,
        locationAddress,
        alertStatus,
        recipientsSummary,
        bufferCancelled,
      } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const id = `inc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const mapUrl = latitude && longitude
        ? `https://maps.google.com/?q=${latitude},${longitude}`
        : null;

      const detectionType = incidentType === 'MANUAL_SOS' ? 'manual_sos' : 'scream';

      const result = await db.query(
        `INSERT INTO incidents (
          id, user_id, detection_type, confidence_score, decibels, 
          latitude, longitude, location_accuracy, location_address, 
          map_url, alert_status, recipients_summary, buffer_cancelled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          id,
          userId,
          detectionType,
          confidence || 0.0,
          decibels || 0.0,
          latitude || null,
          longitude || null,
          locationAccuracy || null,
          locationAddress || null,
          mapUrl,
          (alertStatus || 'sent').toLowerCase(),
          JSON.stringify(recipientsSummary || []),
          bufferCancelled || false,
        ]
      );

      const row = result.rows[0];
      const savedIncident = {
        id: row.id,
        userId: row.user_id,
        incidentType: row.detection_type === 'manual_sos' ? 'MANUAL_SOS' : 'DISTRESS_SCREAM',
        detectionResult: detectionResult || 'Emergency Incident Dispatched',
        decibels: parseFloat(row.decibels || 0),
        confidence: parseFloat(row.confidence_score || 0),
        latitude: row.latitude ? parseFloat(row.latitude) : undefined,
        longitude: row.longitude ? parseFloat(row.longitude) : undefined,
        locationAddress: row.location_address,
        alertStatus: row.alert_status?.toUpperCase() || 'SENT',
        createdAt: row.created_at,
        mapUrl: row.map_url,
        recipientsSummary: row.recipients_summary,
        bufferCancelled: row.buffer_cancelled,
      };

      // REAL-TIME WEBSOCKET BROADCAST via Socket.io
      if (io) {
        // Emit to user's private room and to global connected contacts
        io.to(`user_${userId}`).emit('emergency_alert', savedIncident);
        io.emit('emergency_alert_broadcast', {
          senderId: userId,
          incident: savedIncident,
          timestamp: new Date().toISOString(),
        });
        console.log(`[Socket.io] Emitted emergency_alert for user ${userId}`);
      }

      res.status(201).json(savedIncident);
    } catch (err) {
      console.error('[Incidents POST Error]:', err);
      res.status(500).json({ error: 'Failed to record incident', details: err.message });
    }
  });

  return router;
};
