"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAuthTests = runAuthTests;
const validation_1 = require("../src/utils/validation");
const crypto_1 = require("../src/utils/crypto");
const AuthService_1 = require("../src/services/AuthService");
const OtpService_1 = require("../src/services/OtpService");
let passed = 0;
let failed = 0;
function check(desc, condition) {
    if (condition) {
        passed++;
        console.log(`  ✓ ${desc}`);
    }
    else {
        failed++;
        console.error(`  ✗ FAIL: ${desc}`);
    }
}
async function runAuthTests() {
    console.log('\n======================================================');
    console.log('LIFEGUARD AI: PHASE 4 AUTHENTICATION & OTP TEST SUITE');
    console.log('======================================================\n');
    // --- 1. Mobile Number Validation ---
    console.log('--- 1. MOBILE NUMBER VALIDATION (+91) ---');
    check('Valid 10-digit mobile (9876543210)', (0, validation_1.validateIndianMobile)('9876543210').isValid === true);
    check('Formats to +919876543210', (0, validation_1.validateIndianMobile)('9876543210').formattedNumber === '+919876543210');
    check('Rejects short number (9876543)', (0, validation_1.validateIndianMobile)('9876543').isValid === false);
    check('Rejects long number (987654321012)', (0, validation_1.validateIndianMobile)('987654321012').isValid === false);
    check('Rejects invalid start digit (1234567890)', (0, validation_1.validateIndianMobile)('1234567890').isValid === false);
    check('Rejects empty number', (0, validation_1.validateIndianMobile)('').isValid === false);
    check('Masks number (+91 ******3210)', (0, validation_1.maskMobileNumber)('+919876543210') === '+91 ******3210');
    // --- 2. Password Validation Criteria ---
    console.log('\n--- 2. PASSWORD VALIDATION CRITERIA ---');
    check('Valid password: Safety123', (0, validation_1.validatePassword)('Safety123').isValid === true);
    check('Rejects no uppercase: safety123', (0, validation_1.validatePassword)('safety123').isValid === false);
    check('Rejects no lowercase: SAFETY123', (0, validation_1.validatePassword)('SAFETY123').isValid === false);
    check('Rejects no number: Safetyabc', (0, validation_1.validatePassword)('Safetyabc').isValid === false);
    check('Rejects < 8 chars: Saf1', (0, validation_1.validatePassword)('Saf1').isValid === false);
    // --- 3. Password Hashing ---
    console.log('\n--- 3. PASSWORD HASHING (SHA-256) ---');
    const h1 = (0, crypto_1.hashPassword)('Safety123');
    const h2 = (0, crypto_1.hashPassword)('Safety123');
    const hDiff = (0, crypto_1.hashPassword)('Safety999');
    check('Deterministic SHA-256 hash', h1 === h2);
    check('Different passwords produce different hashes', h1 !== hDiff);
    check('Hash length is 64 hex characters', h1.length === 64);
    check('No plaintext exposure in hash', !h1.includes('Safety123'));
    // --- 4. User Registration ---
    console.log('\n--- 4. USER REGISTRATION ---');
    const reg1 = await AuthService_1.authService.register('Priya Sharma', '9123456780', 'Safety123', 'Safety123');
    check('Registration succeeds with valid fields', Boolean(reg1.success && reg1.user));
    check('User record contains +91 countryCode', Boolean(reg1.user?.countryCode === '+91'));
    check('User record stores +919123456780', Boolean(reg1.user?.mobileNumber === '+919123456780'));
    // Password mismatch
    const regMismatch = await AuthService_1.authService.register('Priya Sharma', '9123456781', 'Safety123', 'Safety999');
    check('Registration fails on password mismatch', Boolean(!regMismatch.success && regMismatch.error?.includes('Confirm Password')));
    // Duplicate mobile number
    const regDup = await AuthService_1.authService.register('Duplicate User', '9123456780', 'Safety123', 'Safety123');
    check('Registration blocks duplicate mobile number', Boolean(!regDup.success && regDup.error?.includes('already registered')));
    // --- 5. User Login ---
    console.log('\n--- 5. USER LOGIN ---');
    // Baseline seeded user: Sai Kumar (+919876543210 / Safety123)
    const loginBaseline = await AuthService_1.authService.login('9876543210', 'Safety123');
    check('Login succeeds for seeded user (+919876543210 / Safety123)', Boolean(loginBaseline.success && loginBaseline.user?.fullName === 'Sai Kumar'));
    // Registered user login
    const loginReg = await AuthService_1.authService.login('9123456780', 'Safety123');
    check('Login succeeds for newly registered user', Boolean(loginReg.success && loginReg.user?.fullName === 'Priya Sharma'));
    // Wrong password
    const loginWrongPass = await AuthService_1.authService.login('9123456780', 'WrongPass1');
    check('Login fails on wrong password', Boolean(!loginWrongPass.success && loginWrongPass.error?.includes('Incorrect password')));
    // Unregistered mobile number
    const loginUnreg = await AuthService_1.authService.login('9999999999', 'Safety123');
    check('Login fails for unregistered number', Boolean(!loginUnreg.success && loginUnreg.error?.includes('not registered')));
    // --- 6. Forgot Password & OTP Flow ---
    console.log('\n--- 6. FORGOT PASSWORD & OTP WORKFLOW ---');
    // Check mobile registered
    const checkReg = await AuthService_1.authService.checkMobileRegistered('9123456780');
    check('Registered mobile confirmed for OTP', Boolean(checkReg.isRegistered));
    const checkUnreg = await AuthService_1.authService.checkMobileRegistered('9999999999');
    check('Unregistered mobile rejected for OTP', Boolean(!checkUnreg.isRegistered));
    // Send OTP
    const otpRes = await OtpService_1.otpService.sendOtp('+919123456780');
    check('OTP dispatched successfully', Boolean(otpRes.success));
    check('Masked mobile returned (+91 ******6780)', Boolean(otpRes.maskedMobile === '+91 ******6780'));
    const generatedOtp = otpRes.devOtp || '';
    check('Dynamic 6-digit OTP generated', Boolean(generatedOtp.length === 6 && !isNaN(Number(generatedOtp))));
    // Verify Incorrect OTP
    const badVerify = await OtpService_1.otpService.verifyOtp('+919123456780', '000000');
    check('Incorrect OTP rejected with attempts remaining', Boolean(!badVerify.success && badVerify.error?.includes('remaining')));
    // Verify Correct OTP
    const goodVerify = await OtpService_1.otpService.verifyOtp('+919123456780', generatedOtp);
    check('Correct OTP verified successfully', Boolean(goodVerify.success && goodVerify.resetToken));
    const resetToken = goodVerify.resetToken || '';
    // Single-use token: second verification with same OTP fails
    const reuseOtp = await OtpService_1.otpService.verifyOtp('+919123456780', generatedOtp);
    check('OTP invalidated immediately after use', Boolean(!reuseOtp.success));
    // --- 7. Password Reset & Re-Login ---
    console.log('\n--- 7. PASSWORD RESET & NEW LOGIN ---');
    // Attempt reset with invalid criteria
    const resetWeak = await AuthService_1.authService.resetPassword('+919123456780', resetToken, 'weak', 'weak');
    check('Reset fails on weak password', Boolean(!resetWeak.success));
    // Valid reset
    const resetGood = await AuthService_1.authService.resetPassword('+919123456780', resetToken, 'NewSafety456', 'NewSafety456');
    check('Password reset succeeds with valid criteria', Boolean(resetGood.success));
    // Token consumed
    const reuseToken = await AuthService_1.authService.resetPassword('+919123456780', resetToken, 'AnotherPass789', 'AnotherPass789');
    check('Reset token burned after single use', Boolean(!reuseToken.success));
    // Login with old password fails
    const loginOld = await AuthService_1.authService.login('9123456780', 'Safety123');
    check('Login with old password fails', Boolean(!loginOld.success));
    // Login with new password succeeds
    const loginNew = await AuthService_1.authService.login('9123456780', 'NewSafety456');
    check('Login with newly reset password succeeds', Boolean(loginNew.success && loginNew.user?.fullName === 'Priya Sharma'));
    // --- 8. Session & Logout ---
    console.log('\n--- 8. SESSION MANAGEMENT & LOGOUT ---');
    check('Current user active in session', Boolean(AuthService_1.authService.getCurrentUser()?.fullName === 'Priya Sharma'));
    await AuthService_1.authService.logout();
    check('Session cleared after logout', Boolean(AuthService_1.authService.getCurrentUser() === null));
    // Seeded user Sai Kumar can still log in
    const reloginSai = await AuthService_1.authService.login('9876543210', 'Safety123');
    check('User accounts persisted across logins', Boolean(reloginSai.success && reloginSai.user?.fullName === 'Sai Kumar'));
    console.log('\n======================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');
    return { passed, failed };
}
