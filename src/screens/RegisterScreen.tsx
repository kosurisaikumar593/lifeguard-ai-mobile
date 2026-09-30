import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { ShieldLogo } from '../components/ShieldLogo';
import { AppButton } from '../components/AppButton';
import { PhoneInput } from '../components/PhoneInput';
import { PasswordCriteriaView } from '../components/PasswordCriteriaView';
import { authService } from '../services/AuthService';
import { Colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError(null);
    setIsDuplicate(false);

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (mobileNumber.trim().length !== 10) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setLoading(true);

    try {
      const res = await authService.register(
        fullName,
        mobileNumber,
        password,
        confirmPassword
      );

      setLoading(false);

      if (!res.success) {
        setError(res.error || 'Registration failed.');
        if (res.error?.includes('already registered')) {
          setIsDuplicate(true);
        }
        return;
      }

      // Successful registration! Navigate to main safety dashboard
      navigation.replace('MainTabs');
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header branding */}
          <View style={styles.header}>
            <ShieldLogo size="md" />
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Register to activate AI safety monitoring</Text>
          </View>

          {/* Segmented Control */}
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={styles.segmentBtn}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.segmentText}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.segmentBtn, styles.segmentActive]}>
              <Text style={styles.segmentTextActive}>Register</Text>
            </TouchableOpacity>
          </View>

          {/* Error Banner with Duplicate Mobile Shortcuts */}
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={Colors.danger} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.errorBannerText}>{error}</Text>
                {isDuplicate && (
                  <View style={styles.duplicateActions}>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('Login')}
                      style={styles.duplicateBtn}
                    >
                      <Text style={styles.duplicateBtnText}>Go to Login</Text>
                    </TouchableOpacity>
                    <Text style={styles.duplicateDivider}>•</Text>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('ForgotPassword')}
                      style={styles.duplicateBtn}
                    >
                      <Text style={styles.duplicateBtnText}>Forgot Password?</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={styles.form}>
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={Colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="#94A3B8"
                  value={fullName}
                  onChangeText={(t) => {
                    setFullName(t);
                    if (error) setError(null);
                  }}
                  accessibilityLabel="Full Name"
                />
              </View>
            </View>

            {/* Indian Mobile Number (+91) */}
            <PhoneInput
              value={mobileNumber}
              onChangeText={(text) => {
                setMobileNumber(text);
                if (error) setError(null);
              }}
              label="Mobile Number (+91)"
            />

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Create secure password (e.g. Safety123)"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (error) setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  accessibilityLabel="Password"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Live Password Criteria Requirements */}
            <PasswordCriteriaView password={password} />

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter password"
                  placeholderTextColor="#94A3B8"
                  value={confirmPassword}
                  onChangeText={(t) => {
                    setConfirmPassword(t);
                    if (error) setError(null);
                  }}
                  secureTextEntry={!showConfirm}
                  accessibilityLabel="Confirm Password"
                />
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
                  <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>

            <AppButton
              title="Register & Continue"
              onPress={handleRegister}
              size="lg"
              loading={loading}
              style={{ marginTop: 12 }}
            />

            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.loginLinkText}>
                Already registered? <Text style={{ color: Colors.primary, fontWeight: '700' }}>Login</Text>
              </Text>
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
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 10,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: Colors.primary,
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  segmentText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  },
  duplicateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  duplicateBtn: {
    paddingVertical: 2,
  },
  duplicateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  duplicateDivider: {
    marginHorizontal: 8,
    color: '#94A3B8',
  },
  form: {
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  eyeBtn: {
    padding: 6,
  },
  loginLink: {
    marginTop: 18,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
