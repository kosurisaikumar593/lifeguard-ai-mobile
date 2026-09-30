"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const crypto_1 = require("../utils/crypto");
const validation_1 = require("../utils/validation");
const OtpService_1 = require("./OtpService");
class AuthService {
    constructor() {
        this.users = new Map();
        this.currentUser = null;
        this.currentSession = null;
        this.listeners = new Set();
        this.seedDefaultUser();
    }
    /**
     * Seeds the default baseline user from EPICS prototype specification:
     * Sai Kumar (+919876543210) with initial password 'Safety123'
     */
    seedDefaultUser() {
        const defaultUser = {
            id: 'usr_default_sai_kumar',
            fullName: 'Sai Kumar',
            countryCode: '+91',
            mobileNumber: '+919876543210',
            passwordHash: (0, crypto_1.hashPassword)('Safety123'),
            createdAt: '2026-09-27T10:00:00Z',
        };
        this.users.set(defaultUser.mobileNumber, defaultUser);
        // Pre-seed session for baseline tests if needed, or require explicit login
        this.currentUser = defaultUser;
    }
    getCurrentUser() {
        return this.currentUser;
    }
    getCurrentSession() {
        return this.currentSession;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.currentUser);
        return () => this.listeners.delete(listener);
    }
    notify() {
        this.listeners.forEach((listener) => listener(this.currentUser));
    }
    /**
     * Registers a new user with +91 Indian mobile number and strict password criteria.
     */
    async register(fullName, rawMobile, password, confirmPassword) {
        if (!fullName || fullName.trim().length === 0) {
            return { success: false, error: 'Full Name is required.' };
        }
        const mobileCheck = (0, validation_1.validateIndianMobile)(rawMobile);
        if (!mobileCheck.isValid) {
            return { success: false, error: mobileCheck.error };
        }
        const formattedMobile = mobileCheck.formattedNumber;
        // Duplicate mobile number check
        if (this.users.has(formattedMobile)) {
            return {
                success: false,
                error: 'This mobile number is already registered. Please login or reset your password.',
            };
        }
        const passwordCheck = (0, validation_1.validatePassword)(password);
        if (!passwordCheck.isValid) {
            return { success: false, error: passwordCheck.error };
        }
        if (password !== confirmPassword) {
            return { success: false, error: 'Confirm Password does not match Password.' };
        }
        const newUser = {
            id: 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
            fullName: fullName.trim(),
            countryCode: '+91',
            mobileNumber: formattedMobile,
            passwordHash: (0, crypto_1.hashPassword)(password),
            createdAt: new Date().toISOString(),
        };
        this.users.set(formattedMobile, newUser);
        this.currentUser = newUser;
        this.currentSession = {
            user: newUser,
            token: 'tok_' + Math.random().toString(36).substring(2),
            loginTime: new Date().toISOString(),
        };
        this.notify();
        return { success: true, user: newUser };
    }
    /**
     * Authenticates user using +91 mobile number and password.
     */
    async login(rawMobile, password) {
        const mobileCheck = (0, validation_1.validateIndianMobile)(rawMobile);
        if (!mobileCheck.isValid) {
            return { success: false, error: mobileCheck.error };
        }
        const formattedMobile = mobileCheck.formattedNumber;
        const user = this.users.get(formattedMobile);
        if (!user) {
            return {
                success: false,
                error: 'This mobile number is not registered. Please create a new account.',
            };
        }
        const inputHash = (0, crypto_1.hashPassword)(password);
        if (user.passwordHash !== inputHash) {
            return {
                success: false,
                error: 'Incorrect password. Please verify and try again.',
            };
        }
        this.currentUser = user;
        this.currentSession = {
            user,
            token: 'tok_' + Math.random().toString(36).substring(2),
            loginTime: new Date().toISOString(),
        };
        this.notify();
        return { success: true, user };
    }
    /**
     * Checks if a mobile number is registered (for Forgot Password initiation).
     */
    async checkMobileRegistered(rawMobile) {
        const mobileCheck = (0, validation_1.validateIndianMobile)(rawMobile);
        if (!mobileCheck.isValid) {
            return { isRegistered: false, formattedMobile: '', error: mobileCheck.error };
        }
        const formattedMobile = mobileCheck.formattedNumber;
        const isRegistered = this.users.has(formattedMobile);
        return {
            isRegistered,
            formattedMobile,
            error: isRegistered ? undefined : 'This mobile number is not registered with LifeGuard AI.',
        };
    }
    /**
     * Resets user password after successful OTP verification with resetToken.
     */
    async resetPassword(formattedMobile, resetToken, newPassword, confirmNewPassword) {
        const isTokenValid = OtpService_1.otpService.validateResetToken(formattedMobile, resetToken);
        if (!isTokenValid) {
            return {
                success: false,
                error: 'Password reset session expired or invalid. Please verify OTP again.',
            };
        }
        const passwordCheck = (0, validation_1.validatePassword)(newPassword);
        if (!passwordCheck.isValid) {
            return { success: false, error: passwordCheck.error };
        }
        if (newPassword !== confirmNewPassword) {
            return {
                success: false,
                error: 'Confirm New Password does not match New Password.',
            };
        }
        const user = this.users.get(formattedMobile);
        if (!user) {
            return { success: false, error: 'User account not found.' };
        }
        // Update password hash
        user.passwordHash = (0, crypto_1.hashPassword)(newPassword);
        this.users.set(formattedMobile, user);
        // Burn reset token
        OtpService_1.otpService.consumeResetToken(resetToken);
        return { success: true };
    }
    /**
     * Clears active session on logout.
     */
    async logout() {
        this.currentUser = null;
        this.currentSession = null;
        this.notify();
    }
}
exports.authService = new AuthService();
