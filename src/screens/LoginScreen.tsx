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
import { authService } from '../services/AuthService';
import { Colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [mobileNumber, setMobileNumber] = useState('9876543210');
  const [password, setPassword] = useState('Safety123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgotShortcut, setShowForgotShortcut] = useState(false);
  const [showRegisterShortcut, setShowRegisterShortcut] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setShowForgotShortcut(false);
    setShowRegisterShortcut(false);

    if (mobileNumber.trim().length !== 10) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      const res = await authService.login(mobileNumber, password);
      setLoading(false);

      if (!res.success) {
        setError(res.error || 'Authentication failed. Please verify credentials.');
        if (res.error?.includes('not registered')) {
          setShowRegisterShortcut(true);
        } else if (res.error?.includes('Incorrect password')) {
          setShowForgotShortcut(true);
        }
        return;
      }

      // Successful login! Navigate to main safety dashboard
      navigation.replace('MainTabs');
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Login failed. Please try again.');
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
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Login with your mobile number to continue</Text>
          </View>

          {/* Login / Register Segmented Toggle */}
          <View style={styles.segmentedControl}>
            <TouchableOpacity style={[styles.segmentBtn, styles.segmentActive]}>
              <Text style={styles.segmentTextActive}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.segmentBtn}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.segmentText}>Register</Text>
            </TouchableOpacity>
          </View>

          {/* Error Banner with contextual recovery shortcuts */}
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={Colors.danger} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.errorBannerText}>{error}</Text>
                {showForgotShortcut && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('ForgotPassword')}
                    style={styles.errorActionBtn}
                  >
                    <Text style={styles.errorActionText}>Forgot your password? Reset here</Text>
                  </TouchableOpacity>
                )}
                {showRegisterShortcut && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Register')}
                    style={styles.errorActionBtn}
                  >
                    <Text style={styles.errorActionText}>New to LifeGuard AI? Create Account</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Form Inputs */}
          <View style={styles.form}>
            {/* Indian Mobile Number Input (+91) */}
            <PhoneInput
              value={mobileNumber}
              onChangeText={(text) => {
                setMobileNumber(text);
                if (error) setError(null);
              }}
              label="Mobile Number (+91)"
            />

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={Colors.primary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (error) setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  accessibilityLabel="Password"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                  accessibilityLabel="Toggle password visibility"
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot Password Action Link */}
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => navigation.navigate('ForgotPassword')}
              accessibilityLabel="Forgot Password? Reset via OTP"
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <AppButton
              title="Login"
              onPress={handleLogin}
              size="lg"
              loading={loading}
              style={{ marginTop: 12 }}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <AppButton
              title="Create New Account"
              variant="outline"
              onPress={() => navigation.navigate('Register')}
              size="lg"
            />
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
    marginTop: 12,
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
    marginBottom: 20,
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
  errorActionBtn: {
    marginTop: 6,
  },
  errorActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  form: {
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
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
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  forgotText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '700',
  },
});
