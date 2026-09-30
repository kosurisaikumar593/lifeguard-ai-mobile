import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { AppCard } from '../components/AppCard';
import { AppButton } from '../components/AppButton';
import { StatusBadge } from '../components/StatusBadge';
import { authService } from '../services/AuthService';
import { permissionService } from '../services/PermissionService';
import { contactService } from '../services/ContactService';
import { soundMonitoringService } from '../services/SoundMonitoringService';
import { User, DetailedPermissionsState, MonitoringState } from '../types';
import { Colors } from '../theme/colors';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const HomeDashboardScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [user, setUser] = useState<User | null>(authService.getCurrentUser());
  const [permissions, setPermissions] = useState<DetailedPermissionsState>(
    permissionService.getState()
  );
  const [monitoringState, setMonitoringState] = useState<MonitoringState>(
    soundMonitoringService.getState()
  );
  const [contactCount, setContactCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reload data from services
  const refreshDashboardData = useCallback(async () => {
    try {
      setError(null);
      const currentUser = authService.getCurrentUser();
      setUser(currentUser);

      const perms = await permissionService.checkAllPermissions();
      setPermissions(perms);

      const count = await contactService.getContactCount();
      setContactCount(count);

      setMonitoringState(soundMonitoringService.getState());
    } catch (err: any) {
      console.warn('Dashboard data refresh warning:', err);
      setError('Unable to load full safety information. Tap to retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Real-time refresh whenever screen gains focus
  useFocusEffect(
    useCallback(() => {
      refreshDashboardData();
    }, [refreshDashboardData])
  );

  // Real-time event subscriptions
  useEffect(() => {
    const unsubAuth = authService.subscribe((u) => {
      setUser(u);
    });

    const unsubPerms = permissionService.subscribe((p) => {
      setPermissions(p);
    });

    const unsubContacts = contactService.subscribe(async () => {
      try {
        const count = await contactService.getContactCount();
        setContactCount(count);
      } catch (e) {
        console.warn('Contact subscription count error:', e);
      }
    });

    const unsubMonitoring = soundMonitoringService.subscribeStatus((state) => {
      setMonitoringState(state);
    });

    return () => {
      unsubAuth();
      unsubPerms();
      unsubContacts();
      unsubMonitoring();
    };
  }, []);

  // User initials for avatar
  const getInitials = (name?: string): string => {
    if (!name || name.trim().length === 0) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const allPermsGranted = permissionService.areAllGranted();

  const quickActions = [
    {
      title: 'Sound Monitoring',
      subtitle:
        monitoringState === 'MONITORING'
          ? 'Actively listening'
          : monitoringState === 'LOUD_SOUND_DETECTED'
          ? 'Loud sound detected'
          : 'Real-time sound analysis',
      icon: 'mic',
      color: Colors.primary,
      bgColor: '#EFF6FF',
      route: 'SoundMonitoring' as const,
      accessibilityLabel: 'Open sound monitoring screen',
    },
    {
      title: 'Emergency Contacts',
      subtitle:
        contactCount === 0
          ? '0 contacts configured'
          : contactCount === 1
          ? '1 trusted contact'
          : `${contactCount} trusted contacts`,
      icon: 'people',
      color: '#4F46E5',
      bgColor: '#EEF2FF',
      route: 'EmergencyContacts' as const,
      accessibilityLabel: 'Open emergency contacts list',
    },
    {
      title: 'Safety Permissions',
      subtitle: allPermsGranted ? 'All 3 granted' : 'Configuration required',
      icon: 'shield-checkmark',
      color: allPermsGranted ? '#10B981' : '#F59E0B',
      bgColor: allPermsGranted ? '#ECFDF5' : '#FFFBEB',
      route: 'Permissions' as const,
      accessibilityLabel: 'Manage safety permissions',
    },
    {
      title: 'Live Location',
      subtitle: 'Real-time GPS status',
      icon: 'location',
      color: '#0284C7',
      bgColor: '#F0F9FF',
      route: 'LiveLocation' as const,
      accessibilityLabel: 'Open live location coordinates',
    },
    {
      title: 'Alert History',
      subtitle: 'Incident logs & records',
      icon: 'time',
      color: '#D97706',
      bgColor: '#FFFBEB',
      route: 'AlertHistory' as const,
      accessibilityLabel: 'View past emergency alert history',
    },
    {
      title: 'Profile & Settings',
      subtitle: 'Account & preferences',
      icon: 'settings',
      color: '#475569',
      bgColor: '#F8FAFC',
      route: 'ProfileSettings' as const,
      accessibilityLabel: 'Open account profile and settings',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* 1. DASHBOARD HEADER */}
      <View style={styles.topBanner}>
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <View style={styles.shieldBadge}>
              <Ionicons name="shield-checkmark" size={24} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.appName}>LifeGuard AI</Text>
              <Text style={styles.userGreeting}>
                Hello, {user?.fullName ? user.fullName : 'User'} 👋
              </Text>
              <Text style={styles.companionSubtitle}>Your safety companion is ready.</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.profileAvatar}
            onPress={() => navigation.navigate('ProfileSettings')}
            accessibilityLabel="Open profile and settings"
            accessibilityRole="button"
            activeOpacity={0.8}
          >
            <Text style={styles.avatarInitials}>{getInitials(user?.fullName)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Error banner if loading fails */}
        {error && (
          <TouchableOpacity
            style={styles.errorBanner}
            onPress={refreshDashboardData}
            activeOpacity={0.8}
          >
            <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginRight: 8 }} />
            <Text style={styles.errorText}>{error}</Text>
          </TouchableOpacity>
        )}

        {/* 2. SAFETY STATUS CARD (Section 3) */}
        <AppCard
          style={[
            styles.statusCard,
            monitoringState === 'MONITORING'
              ? { borderLeftColor: '#10B981' }
              : monitoringState === 'LOUD_SOUND_DETECTED'
              ? { borderLeftColor: '#F59E0B' }
              : monitoringState === 'ERROR'
              ? { borderLeftColor: '#EF4444' }
              : { borderLeftColor: '#10B981' },
          ]}
        >
          <View style={styles.statusCardHeader}>
            <Text style={styles.statusCategoryLabel}>LIFEGUARD STATUS</Text>
            <StatusBadge
              label={
                monitoringState === 'MONITORING'
                  ? 'Monitoring Active'
                  : monitoringState === 'LOUD_SOUND_DETECTED'
                  ? 'Loud Sound'
                  : monitoringState === 'ERROR'
                  ? 'Error'
                  : 'Ready'
              }
              status={
                monitoringState === 'MONITORING'
                  ? 'active'
                  : monitoringState === 'LOUD_SOUND_DETECTED'
                  ? 'warning'
                  : monitoringState === 'ERROR'
                  ? 'inactive'
                  : 'active'
              }
              size="sm"
            />
          </View>

          <View style={styles.statusCardBody}>
            <View
              style={[
                styles.statusIconWrap,
                monitoringState === 'LOUD_SOUND_DETECTED'
                  ? { backgroundColor: '#FEF3C7' }
                  : monitoringState === 'ERROR'
                  ? { backgroundColor: '#FEE2E2' }
                  : { backgroundColor: '#ECFDF5' },
              ]}
            >
              <Ionicons
                name={
                  monitoringState === 'MONITORING'
                    ? 'mic'
                    : monitoringState === 'LOUD_SOUND_DETECTED'
                    ? 'alert-circle'
                    : monitoringState === 'ERROR'
                    ? 'warning'
                    : 'shield-checkmark'
                }
                size={28}
                color={
                  monitoringState === 'MONITORING'
                    ? '#10B981'
                    : monitoringState === 'LOUD_SOUND_DETECTED'
                    ? '#F59E0B'
                    : monitoringState === 'ERROR'
                    ? '#EF4444'
                    : '#10B981'
                }
              />
            </View>
            <View style={styles.statusTextWrap}>
              <Text style={styles.statusTitle}>
                {monitoringState === 'MONITORING'
                  ? 'Sound Monitoring Active'
                  : monitoringState === 'LOUD_SOUND_DETECTED'
                  ? 'Loud Sound Detected'
                  : monitoringState === 'ERROR'
                  ? 'Monitoring Issue'
                  : 'System Ready'}
              </Text>
              <Text style={styles.statusSubtitle}>
                {monitoringState === 'MONITORING'
                  ? 'Surrounding acoustic levels are being actively monitored in real time. System is ready to capture audio if distress is detected.'
                  : monitoringState === 'LOUD_SOUND_DETECTED'
                  ? 'Acoustic levels exceeded safe threshold. Audio buffer capture is primed for safety analysis.'
                  : monitoringState === 'ERROR'
                  ? 'Microphone permission or audio input hardware requires configuration. Tap to resolve.'
                  : 'Your safety system is ready. Acoustic sound monitoring and emergency responder alert dispatch are ready to engage when activated.'}
              </Text>
            </View>
          </View>

          <View style={styles.statusActionRow}>
            <TouchableOpacity
              style={[
                styles.primaryActionBtn,
                monitoringState === 'MONITORING'
                  ? { backgroundColor: '#059669' }
                  : monitoringState === 'LOUD_SOUND_DETECTED'
                  ? { backgroundColor: '#D97706' }
                  : { backgroundColor: Colors.primary },
              ]}
              onPress={() => navigation.navigate('SoundMonitoring')}
              activeOpacity={0.8}
              accessibilityLabel="Open sound monitoring"
              accessibilityRole="button"
            >
              <Ionicons
                name={monitoringState === 'MONITORING' ? 'pulse' : 'mic'}
                size={18}
                color="#FFFFFF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.primaryActionText}>
                {monitoringState === 'MONITORING'
                  ? 'View Live Monitoring'
                  : monitoringState === 'LOUD_SOUND_DETECTED'
                  ? 'View Sound Alert'
                  : 'Start Safety Monitoring'}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        </AppCard>


        {/* 3. PERMISSION STATUS SECTION (Section 4) */}
        <AppCard style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="key-outline" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.cardSectionTitle}>Safety Permissions</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Permissions')}
              accessibilityLabel="Manage permissions"
              accessibilityRole="button"
            >
              <Text style={styles.linkText}>Manage</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.permissionsList}>
            {/* Microphone */}
            <View style={styles.permItemRow}>
              <View style={styles.permLabelCol}>
                <Ionicons
                  name={permissions.microphone === 'granted' ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={permissions.microphone === 'granted' ? '#10B981' : '#F59E0B'}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.permName}>Microphone</Text>
              </View>
              <Text
                style={[
                  styles.permStatusText,
                  permissions.microphone === 'granted' ? styles.permGranted : styles.permRequired,
                ]}
              >
                {permissions.microphone === 'granted' ? 'Allowed' : 'Permission required'}
              </Text>
            </View>

            {/* Location */}
            <View style={styles.permItemRow}>
              <View style={styles.permLabelCol}>
                <Ionicons
                  name={permissions.location === 'granted' ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={permissions.location === 'granted' ? '#10B981' : '#F59E0B'}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.permName}>Location</Text>
              </View>
              <Text
                style={[
                  styles.permStatusText,
                  permissions.location === 'granted' ? styles.permGranted : styles.permRequired,
                ]}
              >
                {permissions.location === 'granted' ? 'Allowed' : 'Permission required'}
              </Text>
            </View>

            {/* Notifications */}
            <View style={[styles.permItemRow, { borderBottomWidth: 0 }]}>
              <View style={styles.permLabelCol}>
                <Ionicons
                  name={permissions.notifications === 'granted' ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={permissions.notifications === 'granted' ? '#10B981' : '#F59E0B'}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.permName}>Notifications</Text>
              </View>
              <Text
                style={[
                  styles.permStatusText,
                  permissions.notifications === 'granted' ? styles.permGranted : styles.permRequired,
                ]}
              >
                {permissions.notifications === 'granted' ? 'Allowed' : 'Permission required'}
              </Text>
            </View>
          </View>
        </AppCard>

        {/* 4. EMERGENCY CONTACT SUMMARY (Section 5) */}
        <AppCard style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="people-outline" size={20} color="#4F46E5" style={{ marginRight: 8 }} />
              <Text style={styles.cardSectionTitle}>Emergency Contacts</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('EmergencyContacts')}
              accessibilityLabel="View emergency contacts"
              accessibilityRole="button"
            >
              <Text style={styles.linkText}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.contactsContent}>
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingRowText}>Loading contacts count...</Text>
              </View>
            ) : contactCount > 0 ? (
              <View>
                <Text style={styles.contactCountHeadline}>
                  {contactCount === 1 ? '1 trusted contact' : `${contactCount} trusted contacts`}
                </Text>
                <Text style={styles.contactCountDesc}>
                  Configured to automatically receive your emergency alerts and live GPS coordinates.
                </Text>
                <AppButton
                  title="View Contacts"
                  variant="outline"
                  size="sm"
                  onPress={() => navigation.navigate('EmergencyContacts')}
                  style={{ marginTop: 12 }}
                />
              </View>
            ) : (
              <View>
                <Text style={styles.contactCountHeadline}>0 trusted contacts</Text>
                <Text style={styles.contactCountDesc}>
                  No emergency contacts added yet. Add trusted family members or friends who can be
                  notified during an emergency.
                </Text>
                <AppButton
                  title="+ Add Emergency Contact"
                  variant="primary"
                  size="sm"
                  onPress={() => navigation.navigate('EmergencyContacts')}
                  style={{ marginTop: 12 }}
                />
              </View>
            )}
          </View>
        </AppCard>

        {/* 5. EMERGENCY MANUAL SOS ENTRY (Section 7 & 15) */}
        <AppCard style={styles.sosCard}>
          <View style={styles.sosHeaderRow}>
            <View style={styles.sosIconBox}>
              <Ionicons name="alert-circle" size={26} color="#DC2626" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.sosCardTitle}>Emergency SOS</Text>
              <Text style={styles.sosCardSub}>Send an emergency alert manually</Text>
            </View>
          </View>
          <Text style={styles.sosCardDesc}>
            Triggers manual emergency alert flow with a 5-second countdown to cancel false alarms.
          </Text>
          <AppButton
            title="Open Emergency SOS"
            variant="danger"
            size="md"
            onPress={() => navigation.navigate('ManualSOS')}
            style={styles.sosBtn}
            accessibilityLabel="Open Emergency SOS screen"
          />
        </AppCard>

        {/* 6. QUICK ACTIONS GRID (Section 8) */}
        <Text style={styles.sectionHeaderTitle}>Quick Actions</Text>
        <View style={styles.grid}>
          {quickActions.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.gridCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate(item.route as any)}
              accessibilityLabel={item.accessibilityLabel}
              accessibilityRole="button"
            >
              <View style={[styles.cardIconBox, { backgroundColor: item.bgColor }]}>
                <Ionicons name={item.icon as any} size={22} color={item.color} />
              </View>
              <Text style={styles.gridCardTitle}>{item.title}</Text>
              <Text style={styles.gridCardSubtitle}>{item.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 7. RECENT SAFETY ACTIVITY (Section 9) */}
        <Text style={styles.sectionHeaderTitle}>Recent Safety Activity</Text>
        <AppCard style={styles.activityCard}>
          <View style={styles.activityEmptyWrap}>
            <View style={styles.activityIconCircle}>
              <Ionicons name="time-outline" size={32} color="#94A3B8" />
            </View>
            <Text style={styles.activityEmptyTitle}>No emergency incidents yet.</Text>
            <Text style={styles.activityEmptyDesc}>
              Incident history, distress sound detections, and manual SOS triggers will appear here
              once active monitoring is engaged.
            </Text>
          </View>
        </AppCard>

        {/* Footer info */}
        <View style={styles.footerNote}>
          <Ionicons name="shield-outline" size={14} color="#94A3B8" style={{ marginRight: 6 }} />
          <Text style={styles.footerNoteText}>
            LifeGuard AI • Your Safety, Our Priority
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBanner: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 22,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  shieldBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  appName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  userGreeting: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  companionSubtitle: {
    fontSize: 12,
    color: '#DBEAFE',
    marginTop: 1,
  },
  profileAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    marginLeft: 10,
  },
  avatarInitials: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 12,
    color: '#B91C1C',
    flex: 1,
  },
  statusCard: {
    padding: 18,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  statusCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusCategoryLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  statusCardBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusTextWrap: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statusSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 4,
  },
  statusActionRow: {
    marginTop: 4,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionCard: {
    padding: 16,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  permissionsList: {
    marginTop: 2,
  },
  permItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  permLabelCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  permName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  permStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  permGranted: {
    color: '#10B981',
  },
  permRequired: {
    color: '#F59E0B',
  },
  contactsContent: {
    paddingVertical: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  loadingRowText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginLeft: 8,
  },
  contactCountHeadline: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  contactCountDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 4,
  },
  sosCard: {
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  sosHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sosIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#B91C1C',
  },
  sosCardSub: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  sosCardDesc: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 16,
    marginBottom: 12,
  },
  sosBtn: {
    marginTop: 4,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 10,
    marginTop: 6,
    letterSpacing: 0.2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  gridCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  gridCardSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 14,
  },
  activityCard: {
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  activityEmptyWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  activityIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  activityEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  activityEmptyDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  footerNoteText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
});