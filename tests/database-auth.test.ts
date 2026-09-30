import { authService } from '../src/services/AuthService';
import { otpService } from '../src/services/OtpService';
import { userRepository, sessionRepository, initDatabase, resetDatabaseForTesting, TABLES } from '../src/database';
import { validateIndianMobile } from '../src/utils/validation';
import { hashPassword } from '../src/utils/crypto';

let passed = 0;
let failed = 0;

function check(desc: string, condition: boolean) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${desc}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${desc}`);
  }
}

export async function runDatabaseAuthTests() {
  console.log('\n======================================================');
  console.log('LIFEGUARD AI: PHASE 5 DATABASE & AUTH TEST SUITE');
  console.log('======================================================\n');

  // --- 0. Database Initialization & Schema ---
  console.log('--- 0. DATABASE INITIALIZATION & SCHEMA SETUP ---');
  await resetDatabaseForTesting();
  const db = await initDatabase();
  check('Database initializes without throwing', Boolean(db));
  check('Schema exports USERS table', TABLES.USERS === 'users');
  check('Schema exports SESSIONS table', TABLES.SESSIONS === 'sessions');
  check('Schema exports EMERGENCY_CONTACTS table', TABLES.EMERGENCY_CONTACTS === 'emergency_contacts');
  check('Schema exports EMERGENCY_INCIDENTS table', TABLES.EMERGENCY_INCIDENTS === 'emergency_incidents');
  check('Schema exports SOUND_EVENTS table', TABLES.SOUND_EVENTS === 'sound_events');

  // Check baseline user seeded
  const seeded = await userRepository.findByMobileNumber('+919876543210');
  check('Default user Sai Kumar seeded in database', Boolean(seeded && seeded.fullName === 'Sai Kumar'));
  check('Seeded user has unique user_id', Boolean(seeded?.id === 'usr_default_sai_kumar'));
  check('Seeded user password is not plaintext', Boolean(seeded?.passwordHash !== 'Safety123' && seeded?.passwordHash.length === 64));

  // --- 1. TEST 1 — REGISTER NEW USER ---
  console.log('\n--- 1. TEST 1: REGISTER NEW USER & PERSISTENCE ---');
  const regResult = await authService.register(
    'Ananya Roy',
    '9988776655',
    'LifeGuard#2026',
    'LifeGuard#2026'
  );
  check('Registration succeeds with valid fields', Boolean(regResult.success && regResult.user));
  const ananya = regResult.user!;
  check('User ID is generated uniquely (starts with usr_)', Boolean(ananya.id && ananya.id.startsWith('usr_')));
  check('Country code is fixed +91', ananya.countryCode === '+91');
  check('Mobile number normalized to +919988776655', ananya.mobileNumber === '+919988776655');
  check('Password is cryptographically hashed (SHA-256)', Boolean(ananya.passwordHash !== 'LifeGuard#2026' && ananya.passwordHash.length === 64));

  // Check user is physically in database
  const fromDb = await userRepository.findByMobileNumber('+919988776655');
  check('User record found in SQLite USERS table', Boolean(fromDb && fromDb.id === ananya.id));
  check('Active session created on registration', authService.isAuthenticated() === true);

  // --- 2. TEST 2 — DUPLICATE USER REJECTION ---
  console.log('\n--- 2. TEST 2: DUPLICATE MOBILE REJECTION ---');
  const dupResult = await authService.register(
    'Ananya Duplicate',
    '9988776655',
    'LifeGuard#2026',
    'LifeGuard#2026'
  );
  check('Duplicate mobile registration is rejected', dupResult.success === false);
  check('Duplicate error message is clear and user-friendly', Boolean(dupResult.error?.includes('already registered')));

  // --- 3. TEST 3 — LOGIN ---
  console.log('\n--- 3. TEST 3: LOGIN WITH +91 MOBILE & PASSWORD ---');
  // First logout
  await authService.logout();
  check('Logged out before test 3', authService.isAuthenticated() === false);

  const loginRes = await authService.login('9988776655', 'LifeGuard#2026');
  check('Login succeeds with correct credentials', Boolean(loginRes.success && loginRes.user));
  check('Current user matches Ananya Roy', authService.getCurrentUser()?.fullName === 'Ananya Roy');
  check('Session state is authenticated', authService.isAuthenticated() === true);

  // --- 4. TEST 4 — WRONG PASSWORD ---
  console.log('\n--- 4. TEST 4: WRONG PASSWORD REJECTION ---');
  const wrongPassRes = await authService.login('9988776655', 'WrongPassword123');
  check('Login rejected on incorrect password', wrongPassRes.success === false);
  check('Error message indicates incorrect password', Boolean(wrongPassRes.error?.includes('Incorrect password')));

  // Unregistered mobile
  const unregRes = await authService.login('9111222333', 'LifeGuard#2026');
  check('Login rejected on unregistered mobile', unregRes.success === false);

  // --- 5. TEST 5 — LOGOUT ---
  console.log('\n--- 5. TEST 5: LOGOUT & SESSION TERMINATION ---');
  await authService.logout();
  check('Current user cleared after logout', authService.getCurrentUser() === null);
  check('Auth state is unauthenticated', authService.isAuthenticated() === false);
  const activeSessAfterLogout = await sessionRepository.getActiveSession();
  check('Database active session cleared on logout', activeSessAfterLogout === null);

  // User still exists in USERS table after logout
  const userStillInDb = await userRepository.findByMobileNumber('+919988776655');
  check('User account preserved in database after logout', Boolean(userStillInDb && userStillInDb.id === ananya.id));

  // --- 6. TEST 6 — APP RESTART & SESSION PERSISTENCE ---
  console.log('\n--- 6. TEST 6: APP RESTART SESSION RESTORATION ---');
  // Log in again as Ananya
  await authService.login('9988776655', 'LifeGuard#2026');
  check('User logged in before simulated restart', authService.isAuthenticated() === true);

  // Simulate app kill and fresh launch: create new AuthService instance
  // or clear in-memory state and re-initialize
  (authService as any).currentUser = null;
  (authService as any).currentSession = null;
  (authService as any).initialized = false;

  check('In-memory session wiped (simulating app process kill)', authService.getCurrentUser() === null);

  // App reopens: init() runs
  await authService.init();
  check('Authentication state restored from database on restart', authService.isAuthenticated() === true);
  check('Restored user matches Ananya Roy', authService.getCurrentUser()?.fullName === 'Ananya Roy');
  check('Restored user ID matches', authService.getCurrentUser()?.id === ananya.id);

  // --- 7. TEST 7 — DATABASE PERSISTENCE ACROSS RESTARTS ---
  console.log('\n--- 7. TEST 7: DATABASE RECORD PERSISTENCE ---');
  const allUsers = await userRepository.getAllUsers();
  check('Database persists users across restarts', allUsers.length >= 2);
  check('Seeded user still present', allUsers.some((u) => u.mobileNumber === '+919876543210'));
  check('Newly registered user still present', allUsers.some((u) => u.mobileNumber === '+919988776655'));

  // --- 8. TEST 8 — USER DATA RETRIEVAL BY USER ID ---
  console.log('\n--- 8. TEST 8: USER DATA ISOLATION VIA USER ID ---');
  const userById = await authService.getUserById(ananya.id);
  check('User details retrievable by user_id', Boolean(userById && userById.fullName === 'Ananya Roy'));
  check('User ID lookup isolates correct mobile number', userById?.mobileNumber === '+919988776655');

  const defaultUserById = await authService.getUserById('usr_default_sai_kumar');
  check('Default user retrievable by unique user_id', Boolean(defaultUserById && defaultUserById.fullName === 'Sai Kumar'));

  // --- 9. TEST 9 — FORGOT PASSWORD & OTP CONNECTED TO DATABASE ---
  console.log('\n--- 9. TEST 9: FORGOT PASSWORD & OTP DATABASE INTEGRATION ---');
  // Check registration check
  const regCheck = await authService.checkMobileRegistered('9988776655');
  check('checkMobileRegistered finds account in database', regCheck.isRegistered === true);

  const regCheckBad = await authService.checkMobileRegistered('9000000000');
  check('checkMobileRegistered rejects unknown number', regCheckBad.isRegistered === false);

  // Dispatch OTP
  const otpRes = await otpService.sendOtp('+919988776655');
  check('OTP dispatched successfully', otpRes.success === true);
  const otpCode = otpRes.devOtp!;

  // Verify OTP
  const verifyRes = await otpService.verifyOtp('+919988776655', otpCode);
  check('OTP verified successfully', verifyRes.success === true);
  const resetToken = verifyRes.resetToken!;
  check('Single-use reset token generated', Boolean(resetToken && resetToken.length > 10));

  // Reset password in database
  const resetRes = await authService.resetPassword(
    '+919988776655',
    resetToken,
    'NewSafePass#2026',
    'NewSafePass#2026'
  );
  check('resetPassword succeeds in database', resetRes.success === true);

  // Old password fails
  const loginOld = await authService.login('9988776655', 'LifeGuard#2026');
  check('Login with old password fails after reset', loginOld.success === false);

  // New password succeeds
  const loginNew = await authService.login('9988776655', 'NewSafePass#2026');
  check('Login with new password succeeds from database', loginNew.success === true);
  check('Logged in user after reset is Ananya Roy', authService.getCurrentUser()?.fullName === 'Ananya Roy');

  console.log('\n======================================================');
  console.log(`PHASE 5 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  return { passed, failed };
}

runDatabaseAuthTests().then((res) => {
  if (res.failed > 0) {
    process.exit(1);
  }
}).catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});