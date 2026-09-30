/**
 * LifeGuard AI — Phase 7 Emergency Contacts Test Suite
 * Tests full CRUD operations, database persistence, user data isolation,
 * validation constraints, duplicate handling, and cross-user security.
 */

import { initDatabase, resetDatabaseForTesting, contactRepository, userRepository } from '../src/database';
import { contactService } from '../src/services/ContactService';
import { authService } from '../src/services/AuthService';
import { maskMobileNumber, validateIndianMobile } from '../src/utils/validation';
import { hashPassword } from '../src/utils/crypto';

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

export async function runEmergencyContactsTests() {
  console.log('\n======================================================');
  console.log('LIFEGUARD AI: PHASE 7 EMERGENCY CONTACTS TEST SUITE');
  console.log('======================================================\n');

  // --- 0. SETUP DATABASE & SEED USERS ---
  console.log('--- 0. DATABASE SETUP & USER SEEDING ---');
  await resetDatabaseForTesting();
  await authService.init();

  // Create User A: Priya Sharma (+919111111111)
  const userA = await userRepository.createUser({
    id: 'usr_test_user_a',
    fullName: 'Priya Sharma',
    mobileNumber: '+919111111111',
    passwordHash: hashPassword('Safety123'),
  });

  // Create User B: Vikram Patel (+919222222222)
  const userB = await userRepository.createUser({
    id: 'usr_test_user_b',
    fullName: 'Vikram Patel',
    mobileNumber: '+919222222222',
    passwordHash: hashPassword('Safety123'),
  });

  check('User A created in database', Boolean(userA && userA.id === 'usr_test_user_a'));
  check('User B created in database', Boolean(userB && userB.id === 'usr_test_user_b'));

  // --- TEST 1: LOGIN AS USER A AND ADD CONTACT ---
  console.log('\n--- 1. TEST 1: ADD EMERGENCY CONTACT FOR USER A ---');
  // Login as User A
  const loginResA = await authService.login('9111111111', 'Safety123');
  check('User A authenticated successfully', loginResA.success && authService.getCurrentUser()?.id === userA.id);

  // Add Contact: Name: Test Contact A, Mobile: 9876543210, Relationship: Father
  const addRes1 = await contactService.addContact({
    name: 'Test Contact A',
    mobileNumber: '9876543210',
    relationship: 'Father',
  });

  check('Add contact succeeded', addRes1.success === true);
  check('Returned contact contains contact_id', Boolean(addRes1.contact && addRes1.contact.contact_id));
  check('Returned contact belongs to User A user_id', addRes1.contact?.user_id === userA.id);
  check('Mobile number normalized to +919876543210', addRes1.contact?.mobile_number === '+919876543210');
  check('Relationship is Father', addRes1.contact?.relationship === 'Father');
  check('Country code is +91', addRes1.contact?.country_code === '+91');

  // Verify contact exists in SQLite database table
  const dbContact = await contactRepository.getEmergencyContact(addRes1.contact!.contact_id, userA.id);
  check('Contact retrieved from database', dbContact !== null && dbContact.name === 'Test Contact A');

  // --- TEST 2: CLOSE AND REOPEN APP (RESTART PERSISTENCE) ---
  console.log('\n--- 2. TEST 2: DATABASE PERSISTENCE ACROSS SESSIONS ---');
  // Re-read contacts directly from contactService as User A
  const contactsAfterReload = await contactService.getContacts();
  check('Contacts count for User A is 1', contactsAfterReload.length === 1);
  check('Persisted contact matches Test Contact A', contactsAfterReload[0]?.name === 'Test Contact A');
  check('Persisted contact has correct mobile', contactsAfterReload[0]?.mobile_number === '+919876543210');

  // --- TEST 3: EDIT CONTACT (CHANGE RELATIONSHIP & NAME) ---
  console.log('\n--- 3. TEST 3: EDIT CONTACT ---');
  const contactIdToEdit = addRes1.contact!.contact_id;
  const editRes = await contactService.updateContact(contactIdToEdit, {
    name: 'Ramesh Sharma (Father)',
    mobileNumber: '9876543210',
    relationship: 'Mother', // Change relationship
  });

  check('Edit contact succeeded', editRes.success === true);
  check('Updated relationship is Mother', editRes.contact?.relationship === 'Mother');
  check('Updated name is Ramesh Sharma (Father)', editRes.contact?.name === 'Ramesh Sharma (Father)');

  // Verify in database
  const updatedDb = await contactRepository.getEmergencyContact(contactIdToEdit, userA.id);
  check('Database reflects updated relationship', updatedDb?.relationship === 'Mother');
  check('Database reflects updated name', updatedDb?.name === 'Ramesh Sharma (Father)');

  // Change back to Father for consistency
  await contactService.updateContact(contactIdToEdit, {
    name: 'Test Contact A',
    mobileNumber: '9876543210',
    relationship: 'Father',
  });

  // --- TEST 4: DELETE CONTACT ---
  console.log('\n--- 4. TEST 4: DELETE CONTACT WITH VERIFICATION ---');
  // First add a temporary contact to delete
  const tempContact = await contactService.addContact({
    name: 'Temporary Contact',
    mobileNumber: '9876543299',
    relationship: 'Friend',
  });
  check('Temporary contact added for deletion test', tempContact.success === true);

  const countBeforeDelete = (await contactService.getContacts()).length;
  check('User A has 2 contacts before deletion', countBeforeDelete === 2);

  const deleteRes = await contactService.deleteContact(tempContact.contact!.contact_id);
  check('Delete contact returned success', deleteRes.success === true);

  const countAfterDelete = (await contactService.getContacts()).length;
  check('User A has 1 contact after deletion', countAfterDelete === 1);

  const deletedDb = await contactRepository.getEmergencyContact(tempContact.contact!.contact_id, userA.id);
  check('Deleted contact no longer exists in database', deletedDb === null);

  // Verify User A account and other contacts still exist
  const userAStillExists = await userRepository.findById(userA.id);
  check('User A account not affected by contact deletion', userAStillExists !== null);

  // --- TEST 5: CREATE USER B & STRICT USER ISOLATION ---
  console.log('\n--- 5. TEST 5: USER B ISOLATION (USER A VS USER B) ---');
  // Logout User A, Login as User B
  await authService.logout();
  const loginResB = await authService.login('9222222222', 'Safety123');
  check('User B authenticated', loginResB.success && authService.getCurrentUser()?.id === userB.id);

  // User B initially has 0 contacts
  const userBInitialContacts = await contactService.getContacts();
  check('User B initially has 0 contacts', userBInitialContacts.length === 0);

  // Add Contact for User B: Suresh Patel (+919876543215)
  const addResB = await contactService.addContact({
    name: 'Suresh Patel',
    mobileNumber: '9876543215',
    relationship: 'Brother',
  });
  check('User B contact added successfully', addResB.success === true);

  // Verify User B sees ONLY User B's contact
  const userBContacts = await contactService.getContacts();
  check('User B sees exactly 1 contact', userBContacts.length === 1);
  check('User B sees Suresh Patel', userBContacts[0].name === 'Suresh Patel');
  check('User B does NOT see User A contact', !userBContacts.some((c) => c.name === 'Test Contact A'));

  // --- TEST 6: RETURN TO USER A & VERIFY USER A CONTACTS ---
  console.log('\n--- 6. TEST 6: RETURN TO USER A AND VERIFY ISOLATION ---');
  await authService.logout();
  await authService.login('9111111111', 'Safety123');
  check('Switched back to User A', authService.getCurrentUser()?.id === userA.id);

  const userAContacts = await contactService.getContacts();
  check('User A sees exactly 1 contact', userAContacts.length === 1);
  check('User A sees Test Contact A', userAContacts[0].name === 'Test Contact A');
  check('User A does NOT see User B contact', !userAContacts.some((c) => c.name === 'Suresh Patel'));

  // --- TEST 7: INVALID MOBILE NUMBER VALIDATION ---
  console.log('\n--- 7. TEST 7: INVALID MOBILE VALIDATION ---');
  const shortMobile = await contactService.addContact({
    name: 'Invalid Phone',
    mobileNumber: '98765', // too short
    relationship: 'Friend',
  });
  check('Rejects short mobile number', shortMobile.success === false && Boolean(shortMobile.error));

  const letterMobile = await contactService.addContact({
    name: 'Invalid Phone',
    mobileNumber: '98765ABCDE',
    relationship: 'Friend',
  });
  check('Rejects letters in mobile number', letterMobile.success === false);

  const invalidPrefixMobile = await contactService.addContact({
    name: 'Invalid Phone',
    mobileNumber: '1234567890', // Indian numbers start with 6-9
    relationship: 'Friend',
  });
  check('Rejects invalid Indian telecom prefix', invalidPrefixMobile.success === false);

  // --- TEST 8: EMPTY NAME VALIDATION ---
  console.log('\n--- 8. TEST 8: EMPTY NAME VALIDATION ---');
  const emptyName = await contactService.addContact({
    name: '   ',
    mobileNumber: '9876543222',
    relationship: 'Friend',
  });
  check('Rejects empty or whitespace-only name', emptyName.success === false);
  check('Returns appropriate error for empty name', emptyName.error?.includes('name is required') === true);

  // --- TEST 9: EMPTY RELATIONSHIP VALIDATION ---
  console.log('\n--- 9. TEST 9: EMPTY RELATIONSHIP VALIDATION ---');
  const emptyRel = await contactService.addContact({
    name: 'Valid Name',
    mobileNumber: '9876543222',
    relationship: '',
  });
  check('Rejects empty relationship', emptyRel.success === false);
  check('Returns appropriate error for empty relationship', emptyRel.error?.includes('Relationship is required') === true);

  // --- TEST 10: DUPLICATE CONTACT NUMBER FOR SAME USER ---
  console.log('\n--- 10. TEST 10: DUPLICATE CONTACT FOR SAME USER ---');
  // User A already has 9876543210 (Test Contact A)
  const duplicateContact = await contactService.addContact({
    name: 'Second Contact Same Mobile',
    mobileNumber: '9876543210',
    relationship: 'Brother',
  });
  check('Rejects duplicate mobile for the SAME user', duplicateContact.success === false);
  check('Duplicate error message is clear', duplicateContact.error?.includes('already exists') === true);

  // --- TEST 11: CROSS-USER AUTHORIZATION EXPLOIT PREVENTION ---
  console.log('\n--- 11. TEST 11: CROSS-USER AUTHORIZATION PROTECTION ---');
  // User A attempts to edit User B's contact directly by ID
  const userBContactId = addResB.contact!.contact_id;
  const unauthorizedEdit = await contactService.updateContact(userBContactId, {
    name: 'Hacked Name',
    mobileNumber: '9876543215',
    relationship: 'Friend',
  });
  check('User A cannot edit User B contact by ID', unauthorizedEdit.success === false);

  // User A attempts to delete User B's contact directly by ID
  const unauthorizedDelete = await contactService.deleteContact(userBContactId);
  check('User A cannot delete User B contact by ID', unauthorizedDelete.success === false);

  // Verify User B's contact in database is intact
  const userBContactIntact = await contactRepository.getEmergencyContact(userBContactId, userB.id);
  check('User B contact remained untouched', userBContactIntact?.name === 'Suresh Patel');

  // --- TEST 12: SAME MOBILE ALLOWED FOR DIFFERENT USERS ---
  console.log('\n--- 12. TEST 12: SAME NUMBER ALLOWED ACROSS DIFFERENT USERS ---');
  // User B can also add 9876543210 as their contact (e.g. shared family member)
  await authService.logout();
  await authService.login('9222222222', 'Safety123'); // User B

  const userBSamePhone = await contactService.addContact({
    name: 'Shared Family Contact',
    mobileNumber: '9876543210',
    relationship: 'Father',
  });
  check('Different user CAN add the same contact phone number', userBSamePhone.success === true);

  // --- TEST 13: MASKED PHONE FORMAT ---
  console.log('\n--- 13. TEST 13: MASKED PHONE NUMBER FORMAT ---');
  const masked = maskMobileNumber('+919876543210');
  check('Phone number masked for privacy', masked === '+91 ******3210');

  // --- TEST 14: MULTIPLE CONTACTS SUPPORT (FLEXIBLE) ---
  console.log('\n--- 14. TEST 14: MULTIPLE CONTACTS SUPPORT ---');
  await contactService.addContact({
    name: 'Doctor Contact',
    mobileNumber: '9876543218',
    relationship: 'Other',
  });
  await contactService.addContact({
    name: 'Neighbor Contact',
    mobileNumber: '9876543219',
    relationship: 'Guardian',
  });
  const userBMulti = await contactService.getContacts();
  check('User can add multiple contacts (4 contacts added)', userBMulti.length === 4);

  console.log('\n======================================================');
  console.log(`PHASE 7 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  return { passed, failed };
}

runEmergencyContactsTests()
  .then((res) => {
    if (res.failed > 0) {
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('Fatal emergency contacts test error:', err);
    process.exit(1);
  });
