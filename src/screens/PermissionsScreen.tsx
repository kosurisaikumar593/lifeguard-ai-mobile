import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  AppState,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { permissionService } from '../services/PermissionService';
import { DetailedPermissionsState, PermissionStatus } from '../types';
import { AppHeader } from '../components/AppHeader';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { Colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Permissions'>;

export const PermissionsScreen: React.FC<Props> = ({ navigation }) => {
  const [permissions, setPermissions] = useState<DetailedPermissionsState>(
    permissionService.getState()
  );
  const [loadingType, setLoadingType] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to permission changes
    const unsub = permissionService.subscribe((state) => {
      setPermissions(state);
    });

    // Re-check permissions when returning to app from phone settings
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        permissionService.checkAllPermissions();
      }
    });

    permissionService.checkAllPermissions();

    return () => {
      unsub();
      appStateSub.remove();
    };
  }, []);

  const handleRequestMicrophone = async () => {
    setLoadingType('microphone');
    try {
      if (permissions.microphone === 'permanently_denied') {
        await permissionService.openAppSettings();
      } else {
        await permissionService.requestMicrophonePermission();
      }
    } finally {
      setLoadingType(null);
    }
  };

  const handleRequestLocation = async () => {
    setLoadingType('location');
    try {
      if (permissions.location === 'permanently_denied') {
        await permissionService.openAppSettings();
      } else {
        await permissionService.requestLocationPermission();
      }
    } finally {
      setLoadingType(null);
    }
  };

  const handleRequestNotifications = async () => {
    setLoadingType('notifications');
    try {
      if (permissions.notifications === 'permanently_denied') {
        await permissionService.openAppSettings();
      } else {
        await permissionService.requestNotificationPermission();
      }
    } finally {
      setLoadingType(null);
    }
  };

  const handleContinue = () => {
    const missing = permissionService.getMissingPermissions();

    if (missing.length === 0) {
      // All granted — proceed smoothly
      navigation.replace('MainTabs');
    } else {
      // Some permissions missing — explain which features will be disabled
      Alert.alert(
        'Missing Safety Permissions',
        `The following permissions have not been granted:\n• ${missing.join('\n• ')}\n\nCertain safety features (such as acoustic sound detection or GPS location sharing) will be unavailable until enabled.\n\nDo you want to proceed anyway?`,
        [
          { text: 'Review Permissions', style: 'cancel' },
          {
            text: 'Proceed to App',
            style: 'default',
            onPress: () => navigation.replace('MainTabs'),
          },
        ]
      );
    }
  };

  const renderBadge = (status: PermissionStatus) => {
    if (status === 'granted') {
      return (
        <View style={[styles.badge, styles.badgeSuccess]}>
          <Ionicons name="checkmark-circle" size={14} color="#10B981" />
          <Text style={styles.badgeSuccessText}>Allowed</Text>
        </View>
      );
    }
    if (status === 'permanently_denied') {
      return (
        <View style={[styles.badge, styles.badgeError]}>
          <Ionicons name="lock-closed" size={14} color="#EF4444" />
          <Text style={styles.badgeErrorText}>Denied (Settings)</Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, styles.badgeWarning]}>
        <Ionicons name="alert-circle" size={14} color="#F59E0B" />
        <Text style={styles.badgeWarningText}>Not Allowed</Text>
      </View>
    );
  };

  const grantedCount = [
    permissions.microphone,
    permissions.location,
    permissions.notifications,
  ].filter((s) => s === 'granted').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <AppHeader
        title="Safety Permissions"
        showBack={true}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Overview Banner */}
        <View style={styles.introBanner}>
          <View style={styles.introIconWrapper}>
            <Ionicons name="shield-checkmark" size={28} color={Colors.primary} />
          </View>
          <View style={styles.introTextWrapper}>
            <Text style={styles.introTitle}>Configure Emergency Access</Text>
            <Text style={styles.introSubtitle}>
              LifeGuard AI requires specific device permissions to monitor distress sounds,
              locate you in an emergency, and send alert updates.
            </Text>
          </View>
        </View>

        {/* Prototype Disclaimer */}
        <View style={styles.disclaimerBox}>
          <Ionicons name="information-circle-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.disclaimerText}>
            Prototype Safety System: Direct communication with police or 911/112 services is outside
            the prototype scope. Audio is never stored or recorded continuously.
          </Text>
        </View>

        {/* 1. Microphone Card */}
        <AppCard style={styles.permCard}>
          <View style={styles.permHeader}>
            <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="mic" size={22} color={Colors.primary} />
            </View>
            <View style={styles.permTitleBox}>
              <Text style={styles.permTitle}>Microphone Access</Text>
              <Text style={styles.permSubtitle}>Distress Scream Detection</Text>
            </View>
            {renderBadge(permissions.microphone)}
          </View>
          <Text style={styles.permDescription}>
            Allows LifeGuard AI to monitor surrounding audio levels for possible distress screams and
            acoustic anomalies during safety sessions. Continuous audio is never saved.
          </Text>
          <View style={styles.actionRow}>
            {permissions.microphone === 'granted' ? (
              <View style={styles.grantedRow}>
                <Ionicons name="checkmark-done" size={18} color="#10B981" />
                <Text style={styles.grantedLabel}>Microphone ready for monitoring</Text>
              </View>
            ) : (
              <AppButton
                title={
                  permissions.microphone === 'permanently_denied'
                    ? 'Open Settings'
                    : 'Allow Microphone'
                }
                variant={permissions.microphone === 'permanently_denied' ? 'outline' : 'primary'}
                size="sm"
                loading={loadingType === 'microphone'}
                onPress={handleRequestMicrophone}
                style={styles.actionBtn}
              />
            )}
          </View>
        </AppCard>

        {/* 2. Location Card */}
        <AppCard style={styles.permCard}>
          <View style={styles.permHeader}>
            <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="location" size={22} color="#16A34A" />
            </View>
            <View style={styles.permTitleBox}>
              <Text style={styles.permTitle}>Location Access</Text>
              <Text style={styles.permSubtitle}>GPS Coordinates for Alerts</Text>
            </View>
            {renderBadge(permissions.location)}
          </View>
          <Text style={styles.permDescription}>
            Allows LifeGuard AI to attach your real-time GPS coordinates (latitude, longitude, and accuracy)
            to emergency alerts sent to your designated trusted contacts.
          </Text>
          <View style={styles.actionRow}>
            {permissions.location === 'granted' ? (
              <View style={styles.grantedRow}>
                <Ionicons name="checkmark-done" size={18} color="#10B981" />
                <Text style={styles.grantedLabel}>GPS ready for emergency dispatch</Text>
              </View>
            ) : (
              <AppButton
                title={
                  permissions.location === 'permanently_denied'
                    ? 'Open Settings'
                    : 'Allow Location'
                }
                variant={permissions.location === 'permanently_denied' ? 'outline' : 'primary'}
                size="sm"
                loading={loadingType === 'location'}
                onPress={handleRequestLocation}
                style={styles.actionBtn}
              />
            )}
          </View>
        </AppCard>

        {/* 3. Notifications Card */}
        <AppCard style={styles.permCard}>
          <View style={styles.permHeader}>
            <View style={[styles.iconBox, { backgroundColor: '#FFFBEB' }]}>
              <Ionicons name="notifications" size={22} color="#D97706" />
            </View>
            <View style={styles.permTitleBox}>
              <Text style={styles.permTitle}>Notifications</Text>
              <Text style={styles.permSubtitle}>Emergency Alert Status</Text>
            </View>
            {renderBadge(permissions.notifications)}
          </View>
          <Text style={styles.permDescription}>
            Allows LifeGuard AI to deliver critical emergency warnings, SOS countdown reminders, and
            alert delivery confirmations directly to your device.
          </Text>
          <View style={styles.actionRow}>
            {permissions.notifications === 'granted' ? (
              <View style={styles.grantedRow}>
                <Ionicons name="checkmark-done" size={18} color="#10B981" />
                <Text style={styles.grantedLabel}>Alert notifications enabled</Text>
              </View>
            ) : (
              <AppButton
                title={
                  permissions.notifications === 'permanently_denied'
                    ? 'Open Settings'
                    : 'Allow Notifications'
                }
                variant={permissions.notifications === 'permanently_denied' ? 'outline' : 'primary'}
                size="sm"
                loading={loadingType === 'notifications'}
                onPress={handleRequestNotifications}
                style={styles.actionBtn}
              />
            )}
          </View>
        </AppCard>

        {/* Status Summary & Continue Action */}
        <View style={styles.footerSection}>
          <View style={styles.summaryBar}>
            <Ionicons
              name={grantedCount === 3 ? 'shield-checkmark' : 'shield-outline'}
              size={18}
              color={grantedCount === 3 ? '#10B981' : '#F59E0B'}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.summaryText}>
              {grantedCount === 3
                ? 'All permissions active (3 of 3)'
                : `${grantedCount} of 3 permissions granted`}
            </Text>
          </View>

          <AppButton
            title="Continue to Dashboard"
            variant="primary"
            size="lg"
            onPress={handleContinue}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  introBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  introIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  introTextWrapper: {
    flex: 1,
  },
  introTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  introSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  permCard: {
    marginBottom: 14,
    padding: 16,
  },
  permHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  permTitleBox: {
    flex: 1,
  },
  permTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  permSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  badgeSuccessText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
    marginLeft: 4,
  },
  badgeWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  badgeWarningText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    marginLeft: 4,
  },
  badgeError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  badgeErrorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
    marginLeft: 4,
  },
  permDescription: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 14,
  },
  actionRow: {
    alignItems: 'flex-start',
  },
  actionBtn: {
    minWidth: 150,
  },
  grantedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  grantedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    marginLeft: 6,
  },
  footerSection: {
    marginTop: 12,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
});