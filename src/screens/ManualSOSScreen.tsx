import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { AppButton } from '../components/AppButton';
import { Colors } from '../theme/colors';
import { manualSOSService } from '../services/ManualSOSService';
import { authService } from '../services/AuthService';
import { ManualSOSState } from '../types';

export const ManualSOSScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  // Internal screen mode: CONFIRMATION -> COUNTDOWN
  const [screenMode, setScreenMode] = useState<'CONFIRMATION' | 'COUNTDOWN'>('CONFIRMATION');
  const [secondsLeft, setSecondsLeft] = useState<number>(
    manualSOSService.getConfig().countdownSeconds
  );
  const [loading, setLoading] = useState<boolean>(false);
  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    // 1. Tick observer
    const unsubTick = manualSOSService.onCountdownTick((remaining) => {
      setSecondsLeft(remaining);
    });

    // 2. State observer
    const unsubState = manualSOSService.subscribeState((state: ManualSOSState) => {
      if (state === 'TRIGGERED') {
        navigation.replace('SOSConfirmed');
      }
    });

    // 3. Cancel observer
    const unsubCancel = manualSOSService.onCountdownCancelled(() => {
      navigation.goBack();
    });

    return () => {
      unsubTick();
      unsubState();
      unsubCancel();
    };
  }, [navigation]);

  const handleStartCountdown = () => {
    setScreenMode('COUNTDOWN');
    manualSOSService.startCountdown();
  };

  const handleSendImmediately = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await manualSOSService.triggerSOS('MANUAL_BUTTON');
      // State transition will navigate to SOSConfirmed
    } catch (err: any) {
      Alert.alert(
        'SOS Activation Error',
        err?.message || 'Unable to create emergency SOS event. Please check authentication.'
      );
      setLoading(false);
    }
  };

  const handleCancel = () => {
    manualSOSService.cancelSOS();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleCancel}
          accessibilityLabel="Cancel and return"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manual Emergency SOS</Text>
        <View style={{ width: 40 }} />
      </View>

      {screenMode === 'CONFIRMATION' ? (
        // ==========================================
        // 1. CONFIRMATION VIEW
        // ==========================================
        <View style={styles.centerSection}>
          <View style={styles.alertIconBox}>
            <Ionicons name="warning" size={54} color="#EF4444" />
          </View>

          <Text style={styles.confirmTitle}>EMERGENCY SOS</Text>
          <Text style={styles.confirmSubtitle}>
            Are you sure you want to activate emergency SOS?
          </Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
              <Text style={styles.infoText}>
                Includes a {manualSOSService.getConfig().countdownSeconds}-second countdown to cancel if pressed accidentally.
              </Text>
            </View>
            <View style={[styles.infoRow, { marginTop: 10 }]}>
              <Ionicons name="person-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
              <Text style={styles.infoText}>
                User: {currentUser?.fullName || 'Authenticated User'}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        // ==========================================
        // 2. COUNTDOWN VIEW
        // ==========================================
        <View style={styles.centerSection}>
          <View style={styles.outerGlow}>
            <View style={styles.middleGlow}>
              <View style={styles.innerCircle}>
                <Text style={styles.countdownNumber}>{secondsLeft}</Text>
                <Text style={styles.countdownUnit}>Seconds</Text>
              </View>
            </View>
          </View>

          <Text style={styles.preparingText}>SOS ACTIVATING IN</Text>
          <Text style={styles.subtext}>
            Tap 'Cancel Alert' below if this was pressed by mistake.
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.bottomSection}>
        {screenMode === 'CONFIRMATION' ? (
          <>
            <AppButton
              title="ACTIVATE SOS"
              variant="danger"
              size="lg"
              onPress={handleStartCountdown}
              leftIcon={<Ionicons name="alert-circle" size={20} color="#FFFFFF" />}
              style={{ marginBottom: 12 }}
              accessibilityLabel="Confirm and start emergency SOS countdown"
            />
            <AppButton
              title="CANCEL"
              variant="outline"
              size="lg"
              onPress={handleCancel}
              style={styles.cancelButton}
              textStyle={{ color: '#FFFFFF' }}
              accessibilityLabel="Cancel SOS and return to previous screen"
            />
          </>
        ) : (
          <>
            <AppButton
              title="Send Immediately"
              variant="danger"
              size="lg"
              loading={loading}
              onPress={handleSendImmediately}
              leftIcon={<Ionicons name="flash" size={18} color="#FFFFFF" />}
              style={{ marginBottom: 12 }}
              accessibilityLabel="Bypass countdown and send emergency SOS immediately"
            />
            <AppButton
              title="Cancel Alert"
              variant="outline"
              size="lg"
              onPress={handleCancel}
              style={styles.cancelButton}
              textStyle={{ color: '#FFFFFF' }}
              accessibilityLabel="Cancel emergency countdown"
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    height: 60,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  centerSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  alertIconBox: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginBottom: 20,
  },
  confirmTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 1,
    marginBottom: 8,
  },
  confirmSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  infoCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 13,
    color: '#CBD5E1',
    flex: 1,
    lineHeight: 18,
  },
  outerGlow: {
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  middleGlow: {
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  innerCircle: {
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  countdownNumber: {
    fontSize: 54,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  countdownUnit: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FEE2E2',
    letterSpacing: 0.5,
  },
  preparingText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 24,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  cancelButton: {
    borderColor: '#475569',
    backgroundColor: 'transparent',
  },
});