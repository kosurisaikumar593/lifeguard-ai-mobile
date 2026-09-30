import { User, AuthSession } from '../types';
import { hashPassword } from '../utils/crypto';
import { validateIndianMobile, validatePassword } from '../utils/validation';
import { otpService } from './OtpService';
import { userRepository, sessionRepository, initDatabase } from '../database';

type AuthListener = (user: User | null) => void;

class AuthService {
  private currentUser: User | null = null;
  private currentSession: AuthSession | null = null;
  private listeners: Set<AuthListener> = new Set();
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Eagerly initiate database and session recovery
    this.init().catch((err) => {
      console.warn('Initial auth service setup note:', err);
    });
  }

  /**
   * Initializes the database connection and restores active session from SQLite if present
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        await initDatabase();
        const active = await sessionRepository.getActiveSession();
        if (active) {
          this.currentUser = active.user;
          this.currentSession = active.session;
        } else {
          this.currentUser = null;
          this.currentSession = null;
        }
        this.initialized = true;
        this.notify();
      } catch (err) {
        console.error('Failed to initialize auth and restore session:', err);
        this.initialized = true;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Ensures the service and database are initialized before performing DB operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  getCurrentSession(): AuthSession | null {
    return this.currentSession;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  /**
   * Looks up a user by their unique user_id (for relational data isolation)
   */
  async getUserById(userId: string): Promise<User | null> {
    await this.ensureInitialized();
    return await userRepository.findById(userId);
  }

  subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    listener(this.currentUser);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this.currentUser));
  }

  /**
   * Registers a new user with +91 Indian mobile number, validates password criteria,
   * checks for duplicates, and writes the record to the SQLite USERS table.
   */
  async register(
    fullName: string,
    rawMobile: string,
    password: string,
    confirmPassword: string
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    await this.ensureInitialized();

    if (!fullName || fullName.trim().length === 0) {
      return { success: false, error: 'Full Name is required.' };
    }

    const mobileCheck = validateIndianMobile(rawMobile);
    if (!mobileCheck.isValid) {
      return { success: false, error: mobileCheck.error };
    }

    const formattedMobile = mobileCheck.formattedNumber;

    // Check for existing user in persistent database
    const existing = await userRepository.findByMobileNumber(formattedMobile);
    if (existing) {
      return {
        success: false,
        error: 'This mobile number is already registered. Please login or reset your password.',
      };
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.isValid) {
      return { success: false, error: passwordCheck.error };
    }

    if (password !== confirmPassword) {
      return { success: false, error: 'Confirm Password does not match Password.' };
    }

    // Persist new user in SQLite USERS table
    const newUser = await userRepository.createUser({
      fullName: fullName.trim(),
      countryCode: '+91',
      mobileNumber: formattedMobile,
      passwordHash: hashPassword(password),
    });

    // Create persistent session in SQLite SESSIONS table
    const session = await sessionRepository.createSession(newUser);
    this.currentUser = newUser;
    this.currentSession = session;
    this.notify();

    return { success: true, user: newUser };
  }

  // Alias matching requirement naming convention
  async registerUser(
    fullName: string,
    rawMobile: string,
    password: string,
    confirmPassword: string
  ) {
    return this.register(fullName, rawMobile, password, confirmPassword);
  }

  /**
   * Authenticates user using +91 mobile number and password against SQLite database.
   */
  async login(
    rawMobile: string,
    password: string
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    await this.ensureInitialized();

    const mobileCheck = validateIndianMobile(rawMobile);
    if (!mobileCheck.isValid) {
      return { success: false, error: mobileCheck.error };
    }

    const formattedMobile = mobileCheck.formattedNumber;
    const user = await userRepository.findByMobileNumber(formattedMobile);

    if (!user) {
      return {
        success: false,
        error: 'This mobile number is not registered. Please create a new account.',
      };
    }

    const inputHash = hashPassword(password);
    if (user.passwordHash !== inputHash) {
      return {
        success: false,
        error: 'Incorrect password. Please verify and try again.',
      };
    }

    // Persist active session in SQLite SESSIONS table
    const session = await sessionRepository.createSession(user);
    this.currentUser = user;
    this.currentSession = session;
    this.notify();

    return { success: true, user };
  }

  // Alias matching requirement naming convention
  async loginUser(rawMobile: string, password: string) {
    return this.login(rawMobile, password);
  }

  /**
   * Checks if a mobile number is registered in SQLite (for Forgot Password initiation).
   */
  async checkMobileRegistered(
    rawMobile: string
  ): Promise<{ isRegistered: boolean; formattedMobile: string; error?: string }> {
    await this.ensureInitialized();

    const mobileCheck = validateIndianMobile(rawMobile);
    if (!mobileCheck.isValid) {
      return { isRegistered: false, formattedMobile: '', error: mobileCheck.error };
    }

    const formattedMobile = mobileCheck.formattedNumber;
    const user = await userRepository.findByMobileNumber(formattedMobile);
    const isRegistered = user !== null;

    return {
      isRegistered,
      formattedMobile,
      error: isRegistered ? undefined : 'This mobile number is not registered with LifeGuard AI.',
    };
  }

  /**
   * Resets user password in SQLite after successful OTP verification with resetToken.
   */
  async resetPassword(
    formattedMobile: string,
    resetToken: string,
    newPassword: string,
    confirmNewPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized();

    const isTokenValid = otpService.validateResetToken(formattedMobile, resetToken);
    if (!isTokenValid) {
      return {
        success: false,
        error: 'Password reset session expired or invalid. Please verify OTP again.',
      };
    }

    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.isValid) {
      return { success: false, error: passwordCheck.error };
    }

    if (newPassword !== confirmNewPassword) {
      return {
        success: false,
        error: 'Confirm New Password does not match New Password.',
      };
    }

    const user = await userRepository.findByMobileNumber(formattedMobile);
    if (!user) {
      return { success: false, error: 'User account not found.' };
    }

    // Update password hash in SQLite USERS table
    const newHash = hashPassword(newPassword);
    await userRepository.updatePassword(user.id, newHash);

    // Burn single-use reset token
    otpService.consumeResetToken(resetToken);

    // If the currently logged in user is this user, update currentUser state
    if (this.currentUser && this.currentUser.id === user.id) {
      this.currentUser.passwordHash = newHash;
    }

    return { success: true };
  }

  /**
   * Updates the authenticated user's profile full name in SQLite,
   * updates the current active session state in memory, and notifies listeners.
   */
  async updateProfile(
    userId: string,
    fullName: string
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    await this.ensureInitialized();

    if (!userId || userId.trim().length === 0) {
      return { success: false, error: 'User ID is required.' };
    }

    if (!fullName || fullName.trim().length < 2) {
      return { success: false, error: 'Full Name must be at least 2 characters.' };
    }

    // Security check: Must match currently authenticated user
    const currentId = this.currentUser?.id || this.currentUser?.userId;
    if (!this.currentUser || currentId !== userId) {
      return { success: false, error: 'Unauthorized: Cannot modify another user profile.' };
    }

    const trimmedName = fullName.trim();
    const updated = await userRepository.updateFullName(userId, trimmedName);
    if (!updated) {
      return { success: false, error: 'Failed to update profile in database.' };
    }

    const refreshedUser = await userRepository.findById(userId);
    if (!refreshedUser) {
      return { success: false, error: 'Unable to reload updated profile.' };
    }

    this.currentUser = refreshedUser;
    if (this.currentSession) {
      this.currentSession.user = refreshedUser;
    }
    this.notify();

    return { success: true, user: refreshedUser };
  }

  /**
   * Convenience helper to update the currently logged in user's profile.
   */
  async updateCurrentUserProfile(
    fullName: string
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    const currentId = this.currentUser?.id || this.currentUser?.userId;
    if (!currentId) {
      return { success: false, error: 'No active session found.' };
    }
    return this.updateProfile(currentId, fullName);
  }

  /**
   * Clears active session in database on logout (does NOT delete user record).
   */
  async logout(): Promise<void> {
    await this.ensureInitialized();
    await sessionRepository.clearActiveSession();
    this.currentUser = null;
    this.currentSession = null;
    this.notify();
  }

  // Alias matching requirement naming convention
  async logoutUser() {
    return this.logout();
  }
}

export const authService = new AuthService();

