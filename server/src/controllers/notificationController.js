const db = require('../config/db');

/**
 * Get Notifications for User
 * GET /api/notifications
 */
async function getNotifications(req, res) {
  try {
    const userId = req.user.id;
    const [notifications] = await db.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [userId]
    );

    return res.json({
      success: true,
      notifications: notifications || []
    });
  } catch (error) {
    console.error('[Get Notifications Error]', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving notifications.' });
  }
}

/**
 * Mark Notifications as Read
 * POST /api/notifications/read
 */
async function markAsRead(req, res) {
  try {
    const userId = req.user.id;
    await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [userId]);

    return res.json({
      success: true,
      message: 'Notifications marked as read.'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update notifications.' });
  }
}

module.exports = {
  getNotifications,
  markAsRead
};
