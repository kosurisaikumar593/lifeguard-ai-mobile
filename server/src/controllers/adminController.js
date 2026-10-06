const db = require('../config/db');

/**
 * Get Platform Statistics from MySQL / database
 * GET /api/admin/stats
 */
async function getStats(req, res) {
  try {
    const [[usersRow]] = await db.query('SELECT COUNT(*) AS total_users FROM users');
    const [[incidentsRow]] = await db.query('SELECT COUNT(*) AS total_incidents FROM emergency_events');
    const [[activeRow]] = await db.query('SELECT COUNT(*) AS active_incidents FROM emergency_events WHERE emergency_status = "alerted"');
    const [[resolvedRow]] = await db.query('SELECT COUNT(*) AS resolved_incidents FROM emergency_events WHERE emergency_status IN ("cancelled", "acknowledged", "resolved")');
    const [[contactsRow]] = await db.query('SELECT COUNT(*) AS connected_contacts FROM contacts WHERE status = "connected"');

    const totalUsers = (usersRow && usersRow.total_users !== undefined) ? usersRow.total_users : 0;
    const totalIncidents = (incidentsRow && incidentsRow.total_incidents !== undefined) ? incidentsRow.total_incidents : 0;
    const activeIncidents = (activeRow && activeRow.active_incidents !== undefined) ? activeRow.active_incidents : 0;
    const resolvedIncidents = (resolvedRow && resolvedRow.resolved_incidents !== undefined) ? resolvedRow.resolved_incidents : 0;
    const connectedContacts = (contactsRow && contactsRow.connected_contacts !== undefined) ? contactsRow.connected_contacts : 0;

    return res.json({
      success: true,
      stats: {
        total_users: totalUsers,
        total_incidents: totalIncidents,
        active_incidents: activeIncidents,
        resolved_incidents: resolvedIncidents,
        connected_contacts: connectedContacts,
        server_status: 'online',
        uptime_seconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Admin Stats Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve admin statistics.' });
  }
}

/**
 * Get User List from Database
 * GET /api/admin/users
 */
async function getUsers(req, res) {
  try {
    const [users] = await db.query(
      'SELECT id, name, mobile, safety_status, created_at FROM users ORDER BY created_at DESC'
    );

    return res.json({
      success: true,
      users: users || []
    });
  } catch (error) {
    console.error('[Admin Users Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve users.' });
  }
}

/**
 * Get All Incident Records from Database
 * GET /api/admin/incidents
 */
async function getIncidents(req, res) {
  try {
    const [events] = await db.query(
      `SELECT e.id, e.user_id, e.detection_type, e.sound_level, e.sound_type, e.sound_subtype, 
              e.ai_confidence, e.possible_emergency, e.ai_reason, e.user_response, e.emergency_status, 
              e.latitude, e.longitude, e.location_address, e.contacts_notified_count, e.created_at 
       FROM emergency_events e 
       ORDER BY e.created_at DESC`
    );

    return res.json({
      success: true,
      incidents: events || []
    });
  } catch (error) {
    console.error('[Admin Incidents Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve incidents.' });
  }
}

module.exports = {
  getStats,
  getUsers,
  getIncidents
};
