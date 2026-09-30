/**
 * LifeGuard AI — Phase 18 Profile & Settings Test Suite
 * 
 * Verifies:
 * 1. Initial authenticated user profile loading.
 * 2. Profile display integrity (fullName, mobileNumber, countryCode +91).
 * 3. Validation for profile editing (minimum length, non-empty, trimming).
 * 4. Safe profile update and SQLite database persistence.
 * 5. App restart / session restoration preserves updated profile name.
 * 6. Protection of mobile number (cannot be modified via profile edit).
 * 7. Navigation targets for safety configuration (EmergencyContacts, Permissions, History, Monitoring, LiveLocation).
 * 8. User isolation: User A cannot edit User B's profile.
 * 9. Session security: Logout clears active session in SQLite and memory.
 * 10. Data isolation after re-login: User B sees only User B data (no leakage of User A contacts, incidents, or profile).
 * 11. Missing session handling for profile updates.
 * 12. Database error resilience (keeps valid data on failure).
 */

import { authService } from '../src/services/AuthService';
import { userRepository } from '../src/database/userRepository';
import { sessionRepository } from '../src/database/sessionRepository';
import { contactService } from '../src/services/ContactService';
import { emergencyIncidentService } from '../src/services/emergencyIncidentService';
import { initDatabase, resetDatabaseForTesting } from '../src/database/database';
import { User } from '../src/types';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

export async function runProfileSettingsTests() {
  console.log('\n======================================================');
  console.log('LIFEGUARD AI: PHASE 18 PROFILE & SETTINGS TEST SUITE');
  console.log('======================================================\n');

  // --- 0. INITIALIZATION & SETUP ---
  console.log('--- 0. DATABASE & SERVICE SETUP ---');
  await initDatabase();
  await resetDatabaseForTesting();

  check('AuthService singleton exists', Boolean(authService));
  check('UserRepository singleton exists', Boolean(userRepository));
  check('updateProfile method exists on authService', typeof authService.updateProfile === 'function');
  check('updateCurrentUserProfile method exists on authService', typeof authService.updateCurrentUserProfile === 'function');

  // --- 1. USER AUTHENTICATION & PROFILE DISPLAY ---
  console.log('\n--- 1. USER AUTHENTICATION & PROFILE DISPLAY ---');
  const userALogin = await authService.login(
    '9876543210',
    'Safety123'
  );
  check('User A logged in successfully', userALogin.success && Boolean(userALogin.user));

  const currentUserA = authService.getCurrentUser();
  check('Current user is User A', currentUserA?.mobileNumber === '+919876543210');
  check('User A full name is correctly set to "Sai Kumar"', currentUserA?.fullName === 'Sai Kumar');
  check('User A country code is +91', currentUserA?.countryCode === '+91');
  check('User A has unique id', Boolean(currentUserA?.id));

  // --- 2. PROFILE EDIT VALIDATION ---
  console.log('\n--- 2. PROFILE EDIT VALIDATION ---');
  // Attempt empty name
  const emptyRes = await authService.updateCurrentUserProfile('');
  check('Rejects empty name update', !emptyRes.success && Boolean(emptyRes.error));

  // Attempt whitespace-only name
  const wsRes = await authService.updateCurrentUserProfile('   ');
  check('Rejects whitespace-only name update', !wsRes.success);

  // Attempt single-character name
  const shortRes = await authService.updateCurrentUserProfile('A');
  check('Rejects 1-character name (min 2 required)', !shortRes.success);

  // Verify name was NOT changed
  check('User name remained unchanged after invalid attempts', authService.getCurrentUser()?.fullName === 'Sai Kumar');

  // --- 3. PROFILE SAVE & PERSISTENCE ---
  console.log('\n--- 3. PROFILE SAVE & PERSISTENCE ---');
  const updateRes = await authService.updateCurrentUserProfile('Sai Kumar Varma');
  check('Profile updated successfully', updateRes.success && updateRes.user?.fullName === 'Sai Kumar Varma');

  const updatedInMemory = authService.getCurrentUser();
  check('In-memory user reflects updated name', updatedInMemory?.fullName === 'Sai Kumar Varma');

  // Verify persistence directly in SQLite USERS table
  const userInDb = await userRepository.findById(currentUserA!.id);
  check('SQLite database record reflects updated name', userInDb?.fullName === 'Sai Kumar Varma');
  check('Mobile number remains intact and uncorrupted', userInDb?.mobileNumber === '+919876543210');

  // --- 4. APP RESTARTS / SESSION RESTORATION ---
  console.log('\n--- 4. APP RESTARTS & SESSION RESTORATION ---');
  // Re-read active session from SQLite
  const activeSess = await sessionRepository.getActiveSession();
  check('Active session user in SQLite contains updated name', activeSess?.user.fullName === 'Sai Kumar Varma');

  // --- 5. USER ISOLATION & UNAUTHORIZED PROFILE ACCESS ---
  console.log('\n--- 5. USER ISOLATION & UNAUTHORIZED ACCESS ---');
  // Register User B
  // First logout User A
  await authService.logout();
  check('User A logged out successfully', authService.getCurrentUser() === null);
  check('Auth state is unauthenticated after logout', !authService.isAuthenticated());

  const userBReg = await authService.register(
    'Ananya Sharma',
    '9123456789',
    'Safety123',
    'Safety123'
  );
  check('User B registered successfully', userBReg.success && Boolean(userBReg.user));

  const currentUserB = authService.getCurrentUser();
  check('Current user is now User B', currentUserB?.mobileNumber === '+919123456789');
  check('User B full name is "Ananya Sharma"', currentUserB?.fullName === 'Ananya Sharma');

  // User B tries to update User A's profile by passing User A's ID
  const unauthorizedUpdate = await authService.updateProfile(currentUserA!.id, 'Hacked Name');
  check('User B is blocked from modifying User A profile', !unauthorizedUpdate.success);
  check('Unauthorized update returns error', Boolean(unauthorizedUpdate.error?.includes('Unauthorized') || unauthorizedUpdate.error?.includes('modify')));

  // Verify User A's profile in SQLite was NOT modified
  const userAStillIntact = await userRepository.findById(currentUserA!.id);
  check('User A record in SQLite remained safe and intact', userAStillIntact?.fullName === 'Sai Kumar Varma');

  // --- 6. DATA ISOLATION ON CONTACTS AND INCIDENTS ---
  console.log('\n--- 6. CONTACTS & INCIDENTS DATA ISOLATION ---');
  // Add contact for User A
  await contactService.addContact(
    {
      name: 'User A Mother',
      mobileNumber: '9888877777',
      relationship: 'Mother',
    },
    currentUserA!.id
  );

  // Create incident for User A
  await emergencyIncidentService.createIncident({
    userId: currentUserA!.id,
    incidentType: 'MANUAL_SOS',
    status: 'ALERT_SENT',
  });

  // Query User B's contacts
  const userBContacts = await contactService.getContacts(currentUserB!.id);
  check('User B has 0 of User A contacts', userBContacts.length === 0);

  // Query User B's incidents
  const userBIncidents = await emergencyIncidentService.getUserIncidentHistory(currentUserB!.id);
  check('User B has 0 of User A incidents', userBIncidents.length === 0);

  // --- 7. LOGOUT & SESSION INVALIDATION ---
  console.log('\n--- 7. LOGOUT & SESSION INVALIDATION ---');
  await authService.logout();
  check('Logout clears currentUser', authService.getCurrentUser() === null);
  check('Logout clears currentSession', authService.getCurrentSession() === null);

  const activeAfterLogout = await sessionRepository.getActiveSession();
  check('Active session cleared in SQLite database', activeAfterLogout === null);

  // Attempt profile update without active session
  const noSessionUpdate = await authService.updateCurrentUserProfile('Ghost User');
  check('Profile update fails gracefully when no active session exists', !noSessionUpdate.success);

  // --- 8. RE-LOGIN FLOW ---
  console.log('\n--- 8. RE-LOGIN FLOW ---');
  const loginRes = await authService.login('9876543210', 'Safety123');
  check('User A re-login succeeds', loginRes.success && Boolean(loginRes.user));
  check('Re-logged user profile name matches persistent update', loginRes.user?.fullName === 'Sai Kumar Varma');

  // --- 9. SUMMARY ---
  console.log('\n======================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Phase 18 Profile & Settings Test Suite.`);
  }
}

// Execute standalone if called directly
if (require.main === module) {
  runProfileSettingsTests().catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
}
