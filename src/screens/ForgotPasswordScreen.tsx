import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { AppHeader } from '../components/AppHeader';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { PhoneInput } from '../components/PhoneInput';
import { authService } from '../services/AuthService';
import { otpService } from '../services/OtpService';
import { Colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [mobileNumber, setMobileNumber] = useState('9876543210');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    setError(null);

    if (mobileNumber.length !== 10) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setLoading(true);

    try {
      // 1. Verify mobile number is registered
      const check = await authService.checkMobileRegistered(mobileNumber);
      if (!check.isRegistered) {
        setError(check.error || 'This mobile number is not registered with LifeGuard AI.');
        setLoading(false);
        return;
      }

      // 2. Dispatch OTP via OTP Service
      const otpRes = await otpService.sendOtp(check.formattedMobile);
      if (!otpRes.success) {
        setError(otpRes.error || 'Failed to send OTP. Please try again.');
        setLoading(false);
        return;
      }

      setLoading(false);

      // 3. Navigate to OTP Verification Screen
      navigation.navigate('OtpVerification', {
        mobileNumber: check.formattedMobile,
        maskedMobile: otpRes.maskedMobile,
        devOtp: otpRes.devOtp,
      });
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <AppHeader
        title="Forgot Password"
        subtitle="Account Recovery"
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
          {/* Recovery Icon & Title Card */}
          <View style={styles.topSection}>
            <View style={styles.iconCircle}>
              <Ionicons name="key-outline" size={40} color={Colors.primary} />
            </View>
            <Text style={styles.title}>Reset Your Password</Text>
            <Text style={styles.subtitle}>
              Enter your registered Indian mobile number to receive a secure 6-digit
              verification OTP.
            </Text>
          </View>

          {/* Error Banner */}
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={Colors.danger} style={{ marginRight: 8 }} />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          {/* Mobile Input Card */}
          <AppCard style={styles.formCard}>
            <PhoneInput
              value={mobileNumber}
              onChangeText={(text) => {
                setMobileNumber(text);
                if (error) setError(null);
              }}
              label="Registered Mobile Number (+91)"
            />

            <AppButton
              title="Send Verification OTP"
              onPress={handleSendOtp}
              size="lg"
              loading={loading}
              rightIcon={<Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" />}
              style={{ marginTop: 8 }}
            />
          </AppCard>

          {/* Quick Shortcuts */}
          <View style={styles.shortcutsRow}>
            <TouchableOpacity
              style={styles.shortcutBtn}
              onPress={() => navigation.navigate('Login')}
            >
              <Ionicons name="arrow-back" size={16} color={Colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.shortcutText}>Back to Login</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shortcutBtn}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.shortcutText}>Create New Account</Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.primary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
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
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 12,
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
  formCard: {
    padding: 20,
  },
  shortcutsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 4,
  },
  shortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  shortcutText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
});
