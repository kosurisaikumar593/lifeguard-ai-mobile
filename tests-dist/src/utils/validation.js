"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePassword = validatePassword;
exports.validateIndianMobile = validateIndianMobile;
exports.maskMobileNumber = maskMobileNumber;
function validatePassword(password) {
    const criteria = {
        minLength: password.length >= 8,
        hasUpper: /[A-Z]/.test(password),
        hasLower: /[a-z]/.test(password),
        hasNumber: /[0-9]/.test(password),
    };
    const isValid = criteria.minLength &&
        criteria.hasUpper &&
        criteria.hasLower &&
        criteria.hasNumber;
    let error;
    if (!criteria.minLength) {
        error = 'Password must be at least 8 characters long.';
    }
    else if (!criteria.hasUpper) {
        error = 'Password must contain at least one uppercase letter (A-Z).';
    }
    else if (!criteria.hasLower) {
        error = 'Password must contain at least one lowercase letter (a-z).';
    }
    else if (!criteria.hasNumber) {
        error = 'Password must contain at least one number (0-9).';
    }
    return { isValid, criteria, error };
}
function validateIndianMobile(raw) {
    // Strip all non-digit characters
    const cleaned = raw.replace(/\D/g, '');
    // Extract 10 digits whether entered as 9876543210 or 919876543210 or +91 9876543210
    let nationalNumber = cleaned;
    if (cleaned.startsWith('91') && cleaned.length === 12) {
        nationalNumber = cleaned.substring(2);
    }
    if (nationalNumber.length === 0) {
        return {
            isValid: false,
            nationalNumber: '',
            formattedNumber: '',
            error: 'Mobile number cannot be empty.',
        };
    }
    if (nationalNumber.length < 10) {
        return {
            isValid: false,
            nationalNumber,
            formattedNumber: '+91' + nationalNumber,
            error: 'Mobile number must be exactly 10 digits (' + nationalNumber.length + '/10 entered).',
        };
    }
    if (nationalNumber.length > 10) {
        return {
            isValid: false,
            nationalNumber,
            formattedNumber: '+91' + nationalNumber,
            error: 'Mobile number cannot exceed 10 digits.',
        };
    }
    // Check valid first digit for Indian mobile (6, 7, 8, 9)
    if (!/^[6-9]/.test(nationalNumber)) {
        return {
            isValid: false,
            nationalNumber,
            formattedNumber: '+91' + nationalNumber,
            error: 'Invalid mobile number. Indian mobile numbers must start with 6, 7, 8, or 9.',
        };
    }
    return {
        isValid: true,
        nationalNumber,
        formattedNumber: '+91' + nationalNumber,
    };
}
function maskMobileNumber(fullNumber) {
    const digits = fullNumber.replace(/\D/g, '');
    const national = digits.length === 12 && digits.startsWith('91') ? digits.substring(2) : digits;
    if (national.length === 10) {
        const last4 = national.substring(6);
        return '+91 ******' + last4;
    }
    return fullNumber;
}
