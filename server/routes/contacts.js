const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/contacts?userId=...
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }

    const result = await db.query(
      `SELECT * FROM trusted_contacts WHERE user_id = $1 ORDER BY priority_order ASC, created_at ASC`,
      [userId]
    );

    const contacts = result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.contact_name,
      phoneNumber: row.contact_phone,
      relationship: row.relationship,
      priorityOrder: row.priority_order,
      connectionState: row.status === 'connected' ? 'Connected' : 'Pending',
      lastActive: row.last_active,
      createdAt: row.created_at,
    }));

    res.json(contacts);
  } catch (err) {
    console.error('[Contacts GET Error]:', err);
    res.status(500).json({ error: 'Failed to fetch contacts', details: err.message });
  }
});

// POST /api/contacts
router.post('/', async (req, res) => {
  try {
    const { userId, name, phoneNumber, relationship, priorityOrder, connectionState } = req.body;
    if (!userId || !name || !phoneNumber) {
      return res.status(400).json({ error: 'userId, name, and phoneNumber are required' });
    }

    const id = `cnt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const status = connectionState === 'Pending' ? 'pending' : 'connected';

    const result = await db.query(
      `INSERT INTO trusted_contacts (id, user_id, contact_name, contact_phone, relationship, priority_order, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, userId, name, phoneNumber, relationship || 'Emergency Contact', priorityOrder || 1, status]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      userId: row.user_id,
      name: row.contact_name,
      phoneNumber: row.contact_phone,
      relationship: row.relationship,
      priorityOrder: row.priority_order,
      connectionState: row.status === 'connected' ? 'Connected' : 'Pending',
      createdAt: row.created_at,
    });
  } catch (err) {
    console.error('[Contacts POST Error]:', err);
    res.status(500).json({ error: 'Failed to add contact', details: err.message });
  }
});

// PUT /api/contacts/:id/status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const dbStatus = status === 'Connected' ? 'connected' : 'pending';

    const result = await db.query(
      `UPDATE trusted_contacts SET status = $1, last_active = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [dbStatus, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      userId: row.user_id,
      connectionState: row.status === 'connected' ? 'Connected' : 'Pending',
      lastActive: row.last_active,
    });
  } catch (err) {
    console.error('[Contacts PUT Error]:', err);
    res.status(500).json({ error: 'Failed to update contact status', details: err.message });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query(`DELETE FROM trusted_contacts WHERE id = $1`, [req.params.id]);
    res.json({ success: true, message: 'Contact deleted' });
  } catch (err) {
    console.error('[Contacts DELETE Error]:', err);
    res.status(500).json({ error: 'Failed to delete contact', details: err.message });
  }
});

module.exports = router;
