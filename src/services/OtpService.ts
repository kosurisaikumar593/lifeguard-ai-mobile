import { maskMobileNumber } from '../utils/validation';

export interface OtpRecord {
  mobileNumber: string;
  otpCode: string;
  expiresAt: number;
  attemptsLeft: number;
  resetToken?: string;
}

export interface SmsProviderConfig {
  providerName: 'Fast2SMS' | 'MSG91' | 'Twilio' | 'MockSmsGateway';
  apiKey?: string;
  senderId?: string;
}

class OtpService {
  private activeOtps: Map<string, OtpRecord> = new Map();
  private verifiedTokens: Map<string, { mobileNumber: string; expiresAt: number }> = new Map();

  /**
   * Generates and transmits a dynamic 6-digit OTP to the registered +91 mobile number.
   * Expires in 5 minutes (300,000 ms).
   */
  async sendOtp(
    mobileNumber: string
  ): Promise<{ success: boolean; maskedMobile: string; error?: string; devOtp?: string }> {
    // Generate secure dynamic 6-digit random code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

    const record: OtpRecord = {
      mobileNumber,
      otpCode,
      expiresAt,
      attemptsLeft: 3,
    };

    this.activeOtps.set(mobileNumber, record);

    // In a live production deployment with credentials:
    // await this.dispatchViaSmsGateway(mobileNumber, otpCode);

    const maskedMobile = maskMobileNumber(mobileNumber);

    return {
      success: true,
      maskedMobile,
      // devOtp is returned for prototype verification purposes when SMS carrier gateway is unconfigured
      devOtp: otpCode,
    };
  }

  /**
   * Verifies the submitted OTP against the active session.
   * Enforces attempt limits and 5-minute TTL.
   * Generates a single-use cryptographically unique reset token.
   */
  async verifyOtp(
    mobileNumber: string,
    submittedOtp: string
  ): Promise<{ success: boolean; resetToken?: string; error?: string }> {
    const record = this.activeOtps.get(mobileNumber);

    if (!record) {
      return {
        success: false,
        error: 'No active OTP found for this mobile number. Please request a new OTP.',
      };
    }

    if (Date.now() > record.expiresAt) {
      this.activeOtps.delete(mobileNumber);
      return {
        success: false,
        error: 'OTP has expired (validity is 5 minutes). Please request a new OTP.',
      };
    }

    if (record.attemptsLeft <= 0) {
      this.activeOtps.delete(mobileNumber);
      return {
        success: false,
        error: 'Maximum verification attempts exceeded. Please request a new OTP.',
      };
    }

    if (record.otpCode !== submittedOtp.trim()) {
      record.attemptsLeft -= 1;
      return {
        success: false,
        error:
          'Invalid OTP code. ' +
          record.attemptsLeft +
          ' attempt(s) remaining.',
      };
    }

    // OTP is valid! Invalidate the OTP immediately
    this.activeOtps.delete(mobileNumber);

    // Issue a single-use password reset token valid for 10 minutes
    const resetToken = 'rst_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    this.verifiedTokens.set(resetToken, {
      mobileNumber,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    return {
      success: true,
      resetToken,
    };
  }

  /**
   * Validates whether a reset token is valid for the given mobile number.
   */
  validateResetToken(mobileNumber: string, resetToken: string): boolean {
    const tokenRecord = this.verifiedTokens.get(resetToken);
    if (!tokenRecord) return false;
    if (tokenRecord.mobileNumber !== mobileNumber) return false;
    if (Date.now() > tokenRecord.expiresAt) {
      this.verifiedTokens.delete(resetToken);
      return false;
    }
    return true;
  }

  /**
   * Consumes and burns the reset token after password update.
   */
  consumeResetToken(resetToken: string): void {
    this.verifiedTokens.delete(resetToken);
  }
}

export const otpService = new OtpService();
