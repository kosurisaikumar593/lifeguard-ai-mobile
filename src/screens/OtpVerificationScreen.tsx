import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { AppHeader } from '../components/AppHeader';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { otpService } from '../services/OtpService';
import { Colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'OtpVerification'>;

export const OtpVerificationScreen: React.FC<Props> = ({ route, navigation }) => {
  const { mobileNumber, maskedMobile, devOtp: initialDevOtp } = route.params;

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [devOtp, setDevOtp] = useState<string | undefined>(initialDevOtp);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleVerify = async () => {
    setError(null);

    if (otp.trim().length !== 6) {
      setError('Please enter the complete 6-digit OTP.');
      return;
    }

    setLoading(true);

    try {
      const res = await otpService.verifyOtp(mobileNumber, otp.trim());

      if (!res.success || !res.resetToken) {
        setError(res.error || 'Verification failed. Please check the OTP.');
        setLoading(false);
        return;
      }

      setLoading(false);

      // Navigate to Create New Password screen
      navigation.replace('ResetPassword', {
        mobileNumber,
        resetToken: res.resetToken,
      });
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Please try again.');
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;

    setError(null);
    setLoading(true);

    try {
      const res = await otpService.sendOtp(mobileNumber);
      setLoading(false);

      if (res.success) {
        setDevOtp(res.devOtp);
        setResendTimer(60);
        setOtp('');
      } else {
        setError(res.error || 'Could not resend OTP. Please wait a moment.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to resend OTP.');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <AppHeader
        title="Verify OTP"
        subtitle="Security Verification"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Icon & Masked Mobile Display */}
          <View style={styles.topSection}>
            <View style={styles.iconCircle}>
              <Ionicons name="chatbox-ellipses-outline" size={40} color={Colors.primary} />
            </View>
            <Text style={styles.title}>Verify your mobile number</Text>
            <Text style={styles.subtitle}>
              Enter the OTP sent to <Text style={styles.maskedNumber}>{maskedMobile}</Text>
            </Text>
          </View>

          {/* Dev/Sandbox OTP Display Banner (Required when SMS API credentials are absent) */}
          {devOtp && (
            <View style={styles.devBanner}>
              <View style={styles.devBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#065F46" style={{ marginRight: 4 }} />
                <Text style={styles.devBadgeText}>SMS Service Simulator</Text>
              </View>
              <Text style={styles.devOtpText}>
                Generated 6-Digit OTP: <Text style={styles.devOtpCode}>{devOtp}</Text>
              </Text>
              <TouchableOpacity
                onPress={() => setOtp(devOtp)}
                style={styles.autoFillBtn}
              >
                <Text style={styles.autoFillText}>Tap to autofill</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Error Banner */}
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={Colors.danger} style={{ marginRight: 8 }} />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          {/* OTP Input Card */}
          <AppCard style={styles.card}>
            <Text style={styles.inputLabel}>6-Digit Verification Code</Text>

            <View style={styles.otpInputContainer}>
              <TextInput
                style={styles.otpInput}
                value={otp}
                onChangeText={(text) => {
                  const cleaned = text.replace(/\D/g, '').slice(0, 6);
                  setOtp(cleaned);
                  if (error) setError(null);
                }}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="• • • • • •"
                placeholderTextColor="#CBD5E1"
                autoFocus={true}
                accessibilityLabel="Enter 6-digit OTP code"
              />
            </View>

            <AppButton
              title="Verify OTP & Proceed"
              onPress={handleVerify}
              size="lg"
              loading={loading}
              disabled={otp.length !== 6}
              style={{ marginTop: 14 }}
            />

            {/* Resend OTP & Countdown Timer */}
            <View style={styles.resendSection}>
              {resendTimer > 0 ? (
                <View style={styles.timerRow}>
                  <Ionicons name="time-outline" size={16} color="#64748B" style={{ marginRight: 4 }} />
                  <Text style={styles.timerText}>
                    Resend OTP in <Text style={{ fontWeight: '700', color: Colors.primary }}>{resendTimer}s</Text>
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={handleResend}
                  style={styles.resendBtn}
                  disabled={loading}
                >
                  <Ionicons name="refresh" size={16} color={Colors.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.resendBtnText}>Resend OTP</Text>
                </TouchableOpacity>
              )}
            </View>
          </AppCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 30,
  },
  topSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  maskedNumber: {
    fontWeight: '800',
    color: Colors.primary,
  },
  devBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  devBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 4,
  },
  devBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  devOtpText: {
    fontSize: 13,
    color: '#065F46',
    fontWeight: '600',
  },
  devOtpCode: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#047857',
  },
  autoFillBtn: {
    marginTop: 4,
  },
  autoFillText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    fontSize: 13,
    color: Colors.danger,
    fontWeight: '600',
    flex: 1,
  },
  card: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  otpInputContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  otpInput: {
    width: '100%',
    height: 56,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
    color: Colors.textPrimary,
  },
  resendSection: {
    alignItems: 'center',
    marginTop: 18,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerText: {
    fontSize: 13,
    color: '#64748B',
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  resendBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
});
