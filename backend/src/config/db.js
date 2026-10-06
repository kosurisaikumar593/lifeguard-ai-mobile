const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

let pool = null;
let useMock = false;

// In-Memory store fallback if MySQL server is not locally running
const mockDb = {
  users: [],
  otp_records: [],
  contacts: [],
  emergency_events: [],
  location_records: [],
  notifications: [],
  autoId: { users: 1, otp_records: 1, contacts: 1, emergency_events: 1, location_records: 1, notifications: 1 }
};

async function initDb() {
  try {
    // Attempt connecting to MySQL
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'lifeguard_ai',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    const conn = await pool.getConnection();
    console.log('[Database] Successfully connected to MySQL server.');
    conn.release();
    useMock = false;
  } catch (err) {
    console.warn(`[Database] MySQL connection notice: ${err.message}.`);
    console.warn('[Database] Running in resilient in-memory database mode for development & testing.');
    useMock = true;
  }
}

// Universal query runner supporting both MySQL and resilient mock mode
async function query(sql, params = []) {
  if (!useMock && pool) {
    try {
      const [rows, fields] = await pool.execute(sql, params);
      return [rows, fields];
    } catch (err) {
      console.warn(`[Database] MySQL query failed: ${err.message}. Falling back to memory handler.`);
    }
  }

  // Handle mock operations
  return handleMockQuery(sql, params);
}

function handleMockQuery(sql, params) {
  const normalized = sql.trim().toUpperCase();

  // 1. SELECT queries
  if (normalized.startsWith('SELECT')) {
    if (normalized.includes('FROM USERS')) {
      if (normalized.includes('WHERE MOBILE =')) {
        const mobile = params[0];
        const rows = mockDb.users.filter(u => u.mobile === mobile);
        return [rows, []];
      }
      if (normalized.includes('WHERE ID =')) {
        const id = parseInt(params[0]);
        const rows = mockDb.users.filter(u => u.id === id);
        return [rows, []];
      }
      return [mockDb.users, []];
    }

    if (normalized.includes('FROM OTP_RECORDS')) {
      if (normalized.includes('WHERE MOBILE =')) {
        const mobile = params[0];
        const rows = mockDb.otp_records
          .filter(o => o.mobile === mobile)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return [rows, []];
      }
      return [mockDb.otp_records, []];
    }

    if (normalized.includes('FROM CONTACTS')) {
      if (normalized.includes('USER_ID = ?') || normalized.includes('USER_ID=')) {
        const userId = parseInt(params[0]);
        const rows = mockDb.contacts.filter(c => c.user_id === userId);
        return [rows, []];
      }
      if (normalized.includes('CONTACT_USER_ID = ?') || normalized.includes('CONTACT_MOBILE =')) {
        const val = params[0];
        const rows = mockDb.contacts.filter(c => c.contact_user_id === parseInt(val) || c.contact_mobile === val);
        return [rows, []];
      }
      return [mockDb.contacts, []];
    }

    if (normalized.includes('FROM EMERGENCY_EVENTS')) {
      if (normalized.includes('WHERE ID =') || normalized.includes('WHERE E.ID =') || normalized.includes('WHERE ID=?') || normalized.includes('WHERE E.ID=?')) {
        const id = parseInt(params[0]);
        const rows = mockDb.emergency_events.filter(e => e.id === id);
        return [rows, []];
      }
      if (normalized.includes('WHERE USER_ID =')) {
        const userId = parseInt(params[0]);
        const rows = mockDb.emergency_events
          .filter(e => e.user_id === userId)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return [rows, []];
      }
      return [mockDb.emergency_events, []];
    }

    if (normalized.includes('FROM NOTIFICATIONS')) {
      const userId = parseInt(params[0]);
      const rows = mockDb.notifications
        .filter(n => n.user_id === userId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return [rows, []];
    }

    return [[], []];
  }

  // 2. INSERT queries
  if (normalized.startsWith('INSERT INTO USERS')) {
    const id = mockDb.autoId.users++;
    // (name, mobile, password_hash)
    const newUser = {
      id,
      name: params[0],
      mobile: params[1],
      password_hash: params[2],
      fcm_token: params[3] || null,
      safety_status: 'idle',
      created_at: new Date()
    };
    mockDb.users.push(newUser);
    return [{ insertId: id, affectedRows: 1 }, []];
  }

  if (normalized.startsWith('INSERT INTO OTP_RECORDS')) {
    const id = mockDb.autoId.otp_records++;
    const newOtp = {
      id,
      mobile: params[0],
      otp_code: params[1],
      purpose: params[2],
      is_verified: false,
      expires_at: params[3] || new Date(Date.now() + 10 * 60 * 1000),
      created_at: new Date()
    };
    mockDb.otp_records.push(newOtp);
    return [{ insertId: id, affectedRows: 1 }, []];
  }

  if (normalized.startsWith('INSERT INTO CONTACTS')) {
    const id = mockDb.autoId.contacts++;
    const newContact = {
      id,
      user_id: parseInt(params[0]),
      contact_user_id: params[1] ? parseInt(params[1]) : null,
      contact_name: params[2],
      contact_mobile: params[3],
      status: params[4] || 'pending',
      created_at: new Date()
    };
    mockDb.contacts.push(newContact);
    return [{ insertId: id, affectedRows: 1 }, []];
  }

  if (normalized.startsWith('INSERT INTO EMERGENCY_EVENTS')) {
    const id = mockDb.autoId.emergency_events++;
    const newEmergency = {
      id,
      user_id: parseInt(params[0]),
      detection_type: params[1],
      sound_level: params[2],
      sound_type: params[3],
      sound_subtype: params[4],
      ai_confidence: params[5],
      possible_emergency: Boolean(params[6]),
      ai_reason: params[7],
      user_response: params[8] || 'no_response',
      emergency_status: params[9] || 'initiated',
      latitude: params[10],
      longitude: params[11],
      location_address: params[12],
      contacts_notified_count: params[13] || 0,
      created_at: new Date()
    };
    mockDb.emergency_events.push(newEmergency);
    return [{ insertId: id, affectedRows: 1 }, []];
  }

  if (normalized.startsWith('INSERT INTO LOCATION_RECORDS')) {
    const id = mockDb.autoId.location_records++;
    const newLoc = {
      id,
      user_id: parseInt(params[0]),
      emergency_id: params[1] ? parseInt(params[1]) : null,
      latitude: params[2],
      longitude: params[3],
      accuracy: params[4] || null,
      address: params[5] || null,
      created_at: new Date()
    };
    mockDb.location_records.push(newLoc);
    return [{ insertId: id, affectedRows: 1 }, []];
  }

  if (normalized.startsWith('INSERT INTO NOTIFICATIONS')) {
    const id = mockDb.autoId.notifications++;
    const newNotif = {
      id,
      user_id: parseInt(params[0]),
      sender_id: params[1] ? parseInt(params[1]) : null,
      emergency_id: params[2] ? parseInt(params[2]) : null,
      type: params[3],
      title: params[4],
      message: params[5],
      data_payload: params[6] || null,
      is_read: false,
      created_at: new Date()
    };
    mockDb.notifications.push(newNotif);
    return [{ insertId: id, affectedRows: 1 }, []];
  }

  // 3. UPDATE queries
  if (normalized.startsWith('UPDATE USERS')) {
    if (normalized.includes('SET PASSWORD_HASH')) {
      const hash = params[0];
      const mobile = params[1];
      const user = mockDb.users.find(u => u.mobile === mobile);
      if (user) user.password_hash = hash;
      return [{ affectedRows: user ? 1 : 0 }, []];
    }
    if (normalized.includes('SET FCM_TOKEN')) {
      const token = params[0];
      const id = parseInt(params[1]);
      const user = mockDb.users.find(u => u.id === id);
      if (user) user.fcm_token = token;
      return [{ affectedRows: user ? 1 : 0 }, []];
    }
    return [{ affectedRows: 1 }, []];
  }

  if (normalized.startsWith('UPDATE OTP_RECORDS')) {
    if (normalized.includes('IS_VERIFIED = TRUE') || normalized.includes('IS_VERIFIED = 1')) {
      const id = parseInt(params[0]);
      const rec = mockDb.otp_records.find(o => o.id === id);
      if (rec) rec.is_verified = true;
      return [{ affectedRows: rec ? 1 : 0 }, []];
    }
    return [{ affectedRows: 1 }, []];
  }

  if (normalized.startsWith('UPDATE CONTACTS')) {
    if (normalized.includes('SET STATUS =')) {
      const status = params[0];
      const contactId = parseInt(params[1]);
      const contact = mockDb.contacts.find(c => c.id === contactId);
      if (contact) {
        contact.status = status;
        return [{ affectedRows: 1 }, []];
      }
    }
    return [{ affectedRows: 0 }, []];
  }

  if (normalized.startsWith('UPDATE EMERGENCY_EVENTS')) {
    if (normalized.includes('SET EMERGENCY_STATUS =')) {
      const status = params[0];
      const id = parseInt(params[1]);
      const ev = mockDb.emergency_events.find(e => e.id === id);
      if (ev) {
        ev.emergency_status = status;
        return [{ affectedRows: 1 }, []];
      }
    }
    if (normalized.includes('SET LATITUDE =')) {
      const lat = params[0];
      const lng = params[1];
      const addr = params[2];
      const id = parseInt(params[3]);
      const ev = mockDb.emergency_events.find(e => e.id === id);
      if (ev) {
        ev.latitude = lat;
        ev.longitude = lng;
        ev.location_address = addr;
        return [{ affectedRows: 1 }, []];
      }
    }
    return [{ affectedRows: 1 }, []];
  }

  if (normalized.startsWith('UPDATE NOTIFICATIONS')) {
    const userId = parseInt(params[0]);
    mockDb.notifications.filter(n => n.user_id === userId).forEach(n => n.is_read = true);
    return [{ affectedRows: 1 }, []];
  }

  // 4. DELETE queries
  if (normalized.startsWith('DELETE FROM CONTACTS')) {
    const id = parseInt(params[0]);
    const initLen = mockDb.contacts.length;
    mockDb.contacts = mockDb.contacts.filter(c => c.id !== id);
    return [{ affectedRows: initLen - mockDb.contacts.length }, []];
  }

  return [{ affectedRows: 1, insertId: 1 }, []];
}

module.exports = {
  initDb,
  query,
  getMockDb: () => mockDb
};
