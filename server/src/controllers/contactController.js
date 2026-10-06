const db = require('../config/db');
const { sendContactRequestPushNotification } = require('../config/firebase');

/**
 * List Contacts for logged-in user
 * GET /api/contacts
 */
async function getContacts(req, res) {
  try {
    const userId = req.user.id;
    const [contacts] = await db.query(
      'SELECT c.id, c.user_id, c.contact_user_id, c.contact_name, c.contact_mobile, c.status, c.is_emergency_recipient, c.created_at FROM contacts c WHERE c.user_id = ?',
      [userId]
    );

    // Also fetch incoming pending requests for this user
    const [incomingRequests] = await db.query(
      'SELECT c.id, c.user_id AS requester_id, u.name AS requester_name, u.mobile AS requester_mobile, c.status, c.created_at FROM contacts c JOIN users u ON c.user_id = u.id WHERE (c.contact_user_id = ? OR c.contact_mobile = ?) AND c.status = "pending"',
      [userId, req.user.mobile]
    );

    return res.json({
      success: true,
      contacts: contacts || [],
      incomingRequests: incomingRequests || []
    });
  } catch (error) {
    console.error('[Get Contacts Error]', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving contacts.' });
  }
}

/**
 * Send Contact Invitation / Request
 * POST /api/contacts/request
 */
async function requestContact(req, res) {
  try {
    const userId = req.user.id;
    const { contact_name, contact_mobile } = req.body;

    if (!contact_mobile) {
      return res.status(400).json({ success: false, message: 'Contact mobile number is required.' });
    }

    if (contact_mobile === req.user.mobile) {
      return res.status(400).json({ success: false, message: 'You cannot add yourself as an emergency contact.' });
    }

    // Check if recipient is a registered LifeGuard AI user
    const [registeredUsers] = await db.query('SELECT id, name, mobile, fcm_token FROM users WHERE mobile = ?', [contact_mobile]);
    const recipientUser = registeredUsers && registeredUsers.length > 0 ? registeredUsers[0] : null;

    // Check if already in contact list
    const [existing] = await db.query(
      'SELECT id, status FROM contacts WHERE user_id = ? AND contact_mobile = ?',
      [userId, contact_mobile]
    );

    if (existing && existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Contact already exists with status: ${existing[0].status}`
      });
    }

    const displayName = contact_name || (recipientUser ? recipientUser.name : contact_mobile);

    const [result] = await db.query(
      'INSERT INTO contacts (user_id, contact_user_id, contact_name, contact_mobile, status) VALUES (?, ?, ?, ?, ?)',
      [userId, recipientUser ? recipientUser.id : null, displayName, contact_mobile, 'pending']
    );

    // Send push notification if recipient has FCM token
    if (recipientUser && recipientUser.fcm_token) {
      await sendContactRequestPushNotification(recipientUser.fcm_token, {
        senderName: req.user.name,
        senderMobile: req.user.mobile
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Contact invitation sent successfully.',
      contactId: result.insertId,
      status: 'pending'
    });
  } catch (error) {
    console.error('[Request Contact Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to send contact invitation.' });
  }
}

/**
 * Accept Contact Request
 * POST /api/contacts/accept
 */
async function acceptContact(req, res) {
  try {
    const { contactId, requesterId } = req.body;

    let targetContactId = contactId;
    if (!targetContactId && requesterId) {
      const [matches] = await db.query(
        'SELECT id FROM contacts WHERE user_id = ? AND (contact_user_id = ? OR contact_mobile = ?)',
        [requesterId, req.user.id, req.user.mobile]
      );
      if (matches && matches.length > 0) {
        targetContactId = matches[0].id;
      }
    }

    if (!targetContactId) {
      return res.status(400).json({ success: false, message: 'Contact ID is required to accept.' });
    }

    // Update status to 'connected'
    await db.query('UPDATE contacts SET status = "connected" WHERE id = ?', [targetContactId]);

    // Create reciprocal contact connection so both users are connected
    const [existingContact] = await db.query('SELECT * FROM contacts WHERE id = ?', [targetContactId]);
    if (existingContact && existingContact.length > 0) {
      const original = existingContact[0];
      const [reciprocal] = await db.query(
        'SELECT id FROM contacts WHERE user_id = ? AND contact_user_id = ?',
        [req.user.id, original.user_id]
      );

      if (!reciprocal || reciprocal.length === 0) {
        // Fetch sender's name
        const [senders] = await db.query('SELECT name, mobile FROM users WHERE id = ?', [original.user_id]);
        const sender = senders[0];
        if (sender) {
          await db.query(
            'INSERT INTO contacts (user_id, contact_user_id, contact_name, contact_mobile, status) VALUES (?, ?, ?, ?, "connected")',
            [req.user.id, original.user_id, sender.name, sender.mobile]
          );
        }
      }
    }

    return res.json({
      success: true,
      message: 'Contact connection accepted. You are now connected.',
      status: 'connected'
    });
  } catch (error) {
    console.error('[Accept Contact Error]', error);
    return res.status(500).json({ success: false, message: 'Failed to accept contact request.' });
  }
}

/**
 * Remove or Reject Contact
 * DELETE /api/contacts/:id
 */
async function removeContact(req, res) {
  try {
    const contactId = req.params.id;
    await db.query('DELETE FROM contacts WHERE id = ?', [contactId]);

    return res.json({
      success: true,
      message: 'Contact removed successfully.'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to remove contact.' });
  }
}

module.exports = {
  getContacts,
  requestContact,
  acceptContact,
  removeContact
};
