const db = require('../config/db');
const { sendEmergencyPushNotification } = require('../config/firebase');

/**
 * Create Emergency Event
 * POST /api/emergency/create
 */
async function createEmergency(req, res) {
  try {
    const userId = req.user.id;
    const {
      detection_type, // 'sound_monitoring', 'manual_sos', 'alarm_only'
      sound_level,
      sound_type,
      sound_subtype,
      ai_confidence,
      possible_emergency,
      ai_reason,
      user_response, // 'help', 'no_response', 'manual_sos', 'safe'
      latitude,
      longitude,
      location_address
    } = req.body;

    const status = user_response === 'safe' ? 'cancelled' : 'alerted';

    // 1. Insert emergency event
    const [result] = await db.query(
      `INSERT INTO emergency_events 
       (user_id, detection_type, sound_level, sound_type, sound_subtype, ai_confidence, possible_emergency, ai_reason, user_response, emergency_status, latitude, longitude, location_address) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        detection_type || 'sound_monitoring',
        sound_level ? parseInt(sound_level) : null,
        sound_type || 'unknown',
        sound_subtype || null,
        ai_confidence ? parseFloat(ai_confidence) : null,
        possible_emergency !== undefined ? Boolean(possible_emergency) : false,
        ai_reason || null,
        user_response || 'no_response',
        status,
        latitude ? parseFloat(latitude) : null,
        longitude ? parseFloat(longitude) : null,
        location_address || null
      ]
    );

    const emergencyId = result.insertId;

    // 2. Save location record if coordinates exist
    if (latitude && longitude) {
      await db.query(
        'INSERT INTO location_records (user_id, emergency_id, latitude, longitude, address) VALUES (?, ?, ?, ?, ?)',
        [userId, emergencyId, parseFloat(latitude), parseFloat(longitude), location_address || null]
      );
    }

    // If cancelled by user saying safe, don't blast contacts
    if (user_response === 'safe') {
      return res.status(201).json({
        success: true,
        message: 'Safety confirmed. Incident saved as cancelled.',
        emergencyId,
        status: 'cancelled',
        contactsNotified: 0
      });
    }

    // 3. Find connected contacts for this user
    const [connectedContacts] = await db.query(
      `SELECT c.id, c.contact_user_id, c.contact_name, c.contact_mobile, u.fcm_token 
       FROM contacts c 
       LEFT JOIN users u ON c.contact_user_id = u.id 
       WHERE c.user_id = ? AND c.status = 'connected'`,
      [userId]
    );

    let notifiedCount = 0;

    // 4. Send FCM Push Notification and store in-app notification for each contact
    if (connectedContacts && connectedContacts.length > 0) {
      for (const contact of connectedContacts) {
        // Send FCM if token available
        if (contact.fcm_token) {
          await sendEmergencyPushNotification(contact.fcm_token, {
            emergencyId,
            senderName: req.user.name,
            soundLevel,
            latitude,
            longitude,
            address: location_address
          });
        }

        // Store notification record
        if (contact.contact_user_id) {
          await db.query(
            `INSERT INTO notifications (user_id, sender_id, emergency_id, type, title, message, data_payload) 
             VALUES (?, ?, ?, 'EMERGENCY_ALERT', ?, ?, ?)`,
            [
              contact.contact_user_id,
              userId,
              emergencyId,
              'EMERGENCY ALERT',
              `${req.user.name} reported an emergency! Possible distress detected.`,
              JSON.stringify({
                emergencyId,
                sound_level,
                latitude,
                longitude,
                address: location_address
              })
            ]
          );
        }

        notifiedCount++;
      }
    }

    // Update contacts notified count
    await db.query('UPDATE emergency_events SET contacts_notified_count = ? WHERE id = ?', [notifiedCount, emergencyId]);

    return res.status(201).json({
      success: true,
      message: 'Emergency alert initiated successfully.',
      emergencyId,
      status: 'alerted',
      contactsNotified: notifiedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Create Emergency Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to create emergency event.' });
  }
}

/**
 * Update Location for Ongoing Emergency
 * POST /api/emergency/location
 */
async function updateEmergencyLocation(req, res) {
  try {
    const { emergencyId, latitude, longitude, accuracy, address } = req.body;

    if (!emergencyId || !latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Emergency ID, latitude, and longitude are required.' });
    }

    await db.query(
      'UPDATE emergency_events SET latitude = ?, longitude = ?, location_address = ? WHERE id = ?',
      [parseFloat(latitude), parseFloat(longitude), address || null, parseInt(emergencyId)]
    );

    await db.query(
      'INSERT INTO location_records (user_id, emergency_id, latitude, longitude, accuracy, address) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, parseInt(emergencyId), parseFloat(latitude), parseFloat(longitude), accuracy || null, address || null]
    );

    return res.json({
      success: true,
      message: 'Location updated for emergency event.'
    });
  } catch (error) {
    console.error('[Update Emergency Location Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to update location.' });
  }
}

/**
 * Acknowledge Emergency by Contact
 * POST /api/emergency/acknowledge
 */
async function acknowledgeEmergency(req, res) {
  try {
    const { emergencyId } = req.body;

    if (!emergencyId) {
      return res.status(400).json({ success: false, message: 'Emergency ID is required.' });
    }

    await db.query(
      'UPDATE emergency_events SET emergency_status = "acknowledged" WHERE id = ?',
      [parseInt(emergencyId)]
    );

    // Notify the original sender
    const [events] = await db.query('SELECT user_id FROM emergency_events WHERE id = ?', [parseInt(emergencyId)]);
    if (events && events.length > 0) {
      const senderId = events[0].user_id;
      await db.query(
        `INSERT INTO notifications (user_id, sender_id, emergency_id, type, title, message) 
         VALUES (?, ?, ?, 'ALERT_ACKNOWLEDGED', 'Emergency Acknowledged', ?)`,
        [senderId, req.user.id, parseInt(emergencyId), `${req.user.name} acknowledged your emergency alert.`]
      );
    }

    return res.json({
      success: true,
      message: 'Emergency alert acknowledged.'
    });
  } catch (error) {
    console.error('[Acknowledge Emergency Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to acknowledge emergency.' });
  }
}

/**
 * Get Incident History for User
 * GET /api/emergency/history
 */
async function getEmergencyHistory(req, res) {
  try {
    const userId = req.user.id;
    const [events] = await db.query(
      `SELECT id, user_id, detection_type, sound_level, sound_type, sound_subtype, ai_confidence, 
              possible_emergency, ai_reason, user_response, emergency_status, latitude, longitude, 
              location_address, contacts_notified_count, created_at 
       FROM emergency_events 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.json({
      success: true,
      history: events || []
    });
  } catch (error) {
    console.error('[Get History Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve incident history.' });
  }
}

/**
 * Get Specific Emergency Event
 * GET /api/emergency/:id
 */
async function getEmergencyById(req, res) {
  try {
    const eventId = req.params.id;
    const [events] = await db.query(
      `SELECT e.id, e.user_id, e.detection_type, e.sound_level, e.sound_type, e.sound_subtype, 
              e.ai_confidence, e.possible_emergency, e.ai_reason, e.user_response, e.emergency_status, 
              e.latitude, e.longitude, e.location_address, e.contacts_notified_count, e.created_at, e.resolved_at,
              u.name AS user_name, u.mobile AS user_mobile 
       FROM emergency_events e 
       JOIN users u ON e.user_id = u.id 
       WHERE e.id = ?`,
      [eventId]
    );

    if (!events || events.length === 0) {
      return res.status(404).json({ success: false, message: 'Emergency event not found.' });
    }

    return res.json({
      success: true,
      event: events[0]
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve emergency details.' });
  }
}

module.exports = {
  createEmergency,
  updateEmergencyLocation,
  acknowledgeEmergency,
  getEmergencyHistory,
  getEmergencyById
};
