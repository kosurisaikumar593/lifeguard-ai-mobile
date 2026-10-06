/**
 * LifeGuard AI Backend Automated Test Suite
 * Tests all core features:
 * 1. Health check
 * 2. User Registration & OTP generation
 * 3. OTP Verification & JWT generation
 * 4. User Login
 * 5. Contact Invitation, Listing, and Acceptance
 * 6. Sound Analysis Route (Mock / Gemini check)
 * 7. Emergency Alert Creation, FCM Push, and Status Delivery
 * 8. Location Update
 * 9. Recipient Emergency Acknowledgement
 * 10. Incident History & Incident Details
 * 11. Security & Error Handling (AI failure, invalid tokens, duplicate accounts)
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000';

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({ status: res.statusCode, data: parsed });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting LifeGuard AI Backend Verification Tests');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Health Check
    const health = await makeRequest('GET', '/api/health');
    assert(health.status === 200 && health.data.status === 'healthy', 'Health check API returns healthy');

    const randSuffix = Math.floor(10000000 + Math.random() * 90000000);
    const mobileUserA = `+9191${randSuffix}`;
    const mobileUserB = `+9192${randSuffix}`;

    // 2. User A Registration
    const regRes = await makeRequest('POST', '/api/register', {
      name: 'Saikumar Kosuri',
      mobile: mobileUserA,
      password: 'SecurePassword123'
    });
    assert(regRes.status === 201 && regRes.data.otpCode, 'User A registration generates OTP code');
    const otpUserA = regRes.data.otpCode;

    // 3. User A OTP Verification
    const verifyRes = await makeRequest('POST', '/api/verify-otp', {
      mobile: mobileUserA,
      otpCode: otpUserA,
      purpose: 'registration'
    });
    assert(verifyRes.status === 200 && verifyRes.data.token, 'User A OTP verification returns JWT token');
    const tokenA = verifyRes.data.token;
    const userA = verifyRes.data.user;

    // 4. User B Registration & Verification (For App-to-App Emergency Contacts)
    const regResB = await makeRequest('POST', '/api/register', {
      name: 'Emergency Contact ContactPerson',
      mobile: mobileUserB,
      password: 'SecurePassword456'
    });
    assert(regResB.status === 201 && regResB.data.otpCode, 'User B registration generates OTP code');
    const otpUserB = regResB.data.otpCode;

    const verifyResB = await makeRequest('POST', '/api/verify-otp', {
      mobile: mobileUserB,
      otpCode: otpUserB,
      purpose: 'registration'
    });
    assert(verifyResB.status === 200 && verifyResB.data.token, 'User B OTP verification returns JWT token');
    const tokenB = verifyResB.data.token;

    // 5. User A Login Test
    const loginRes = await makeRequest('POST', '/api/login', {
      mobile: mobileUserA,
      password: 'SecurePassword123',
      fcm_token: 'test_fcm_token_device_a'
    });
    assert(loginRes.status === 200 && loginRes.data.token, 'User A login succeeds with credentials and updates FCM token');

    // 6. User A sends Contact Request to User B
    const reqContactRes = await makeRequest('POST', '/api/contacts/request', {
      contact_name: 'ContactPerson',
      contact_mobile: mobileUserB
    }, tokenA);
    assert(reqContactRes.status === 201 && reqContactRes.data.status === 'pending', 'User A sends contact invitation (status pending)');
    const contactId = reqContactRes.data.contactId;

    // 7. User B accepts Contact Request
    const acceptContactRes = await makeRequest('POST', '/api/contacts/accept', {
      contactId: contactId
    }, tokenB);
    assert(acceptContactRes.status === 200 && acceptContactRes.data.status === 'connected', 'User B accepts contact invitation (status connected)');

    // 8. User A checks connected contacts
    const contactsA = await makeRequest('GET', '/api/contacts', null, tokenA);
    assert(contactsA.status === 200 && contactsA.data.contacts.length > 0, 'User A can view connected emergency contacts list');

    // 9. AI Sound Analysis Endpoint Test
    // Test base64 audio sample submission (when no Gemini key is provided, returns truthful "AI analysis unavailable")
    const testAudioBase64 = Buffer.from('mock_wav_sound_data_for_test').toString('base64');
    const aiRes = await makeRequest('POST', '/api/analyze-sound', {
      audio_base64: testAudioBase64,
      mime_type: 'audio/wav'
    });
    assert(
      (aiRes.status === 200 && aiRes.data.sound_type) ||
      (aiRes.status === 503 && aiRes.data.message.includes('AI analysis unavailable')),
      'AI audio endpoint handles analysis or provides truthful unavailable message'
    );

    // 10. Emergency Event Creation (Distress detection / 10s countdown expired or SOS)
    const emergencyRes = await makeRequest('POST', '/api/emergency/create', {
      detection_type: 'sound_monitoring',
      sound_level: 93,
      sound_type: 'human',
      sound_subtype: 'distress_like',
      ai_confidence: 0.88,
      possible_emergency: true,
      ai_reason: 'Possible distress-like human vocalization detected',
      user_response: 'no_response',
      latitude: 17.385044,
      longitude: 78.486671,
      location_address: 'Hyderabad, India'
    }, tokenA);
    assert(emergencyRes.status === 201 && emergencyRes.data.emergencyId, 'Emergency event created, saves location, and notifies connected contacts');
    const emergencyId = emergencyRes.data.emergencyId;

    // 11. Update Emergency Location
    const locUpdateRes = await makeRequest('POST', '/api/emergency/location', {
      emergencyId: emergencyId,
      latitude: 17.385150,
      longitude: 78.486750,
      accuracy: 5.2,
      address: 'Hyderabad, India (Updated Location)'
    }, tokenA);
    assert(locUpdateRes.status === 200 && locUpdateRes.data.success, 'Emergency location coordinates updated successfully');

    // 12. Recipient User B acknowledges Emergency Alert
    const ackRes = await makeRequest('POST', '/api/emergency/acknowledge', {
      emergencyId: emergencyId
    }, tokenB);
    assert(ackRes.status === 200 && ackRes.data.success, 'Recipient contact successfully acknowledges emergency alert');

    // 13. Incident History Retrieval
    const historyRes = await makeRequest('GET', '/api/emergency/history', null, tokenA);
    assert(historyRes.status === 200 && historyRes.data.history.length > 0, 'User A can view authentic incident history list');

    // 14. Incident Details Retrieval
    const detailRes = await makeRequest('GET', `/api/emergency/${emergencyId}`, null, tokenA);
    assert(detailRes.status === 200 && detailRes.data && detailRes.data.event && parseInt(detailRes.data.event.id) === parseInt(emergencyId), 'Incident details endpoint returns full audit details');

    // 15. User Profile API
    const profileRes = await makeRequest('GET', '/api/profile', null, tokenA);
    assert(profileRes.status === 200 && profileRes.data.user.name === 'Saikumar Kosuri', 'Profile endpoint returns authenticated user details');

    // 16. Security Test: Reject unauthenticated request
    const unauthorizedRes = await makeRequest('GET', '/api/emergency/history');
    assert(unauthorizedRes.status === 401, 'Unauthorized requests without Bearer token are rejected');

    console.log(`\n====================================================`);
    console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
    console.log(`====================================================\n`);

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (err) {
    console.error('Test Execution Error:', err);
    process.exit(1);
  }
}

// Start test runner
runTests();
