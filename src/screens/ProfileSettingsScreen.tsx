import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { AppHeader } from '../components/AppHeader';
import { AppCard } from '../components/AppCard';
import { AppButton } from '../components/AppButton';
import { StatusBadge } from '../components/StatusBadge';
import { authService } from '../services/AuthService';
import { permissionService } from '../services/PermissionService';
import { Colors } from '../theme/colors';
import { User } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const ProfileSettingsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  // Profile state
  const [user, setUser] = useState<User | null>(authService.getCurrentUser());
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);

  // Edit Profile Modal state
  const [isEditModalVisible, setIsEditModalVisible] = useState<boolean>(false);
  const [editFullName, setEditFullName] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // Logout Modal state
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  // About & Privacy Modals
  const [isAboutModalVisible, setIsAboutModalVisible] = useState<boolean>(false);
  const [isPrivacyModalVisible, setIsPrivacyModalVisible] = useState<boolean>(false);

  // Permission status
  const [allPermsGranted, setAllPermsGranted] = useState<boolean>(permissionService.areAllGranted());

  // Subscribe to auth state updates
  useEffect(() => {
    const unsubAuth = authService.subscribe((u) => {
      setUser(u);
      if (u) {
        setEditFullName(u.fullName);
      }
    });

    const unsubPerms = permissionService.subscribe(() => {
      setAllPermsGranted(permissionService.areAllGranted());
    });

    return () => {
      unsubAuth();
      unsubPerms();
    };
  }, []);

  // Format initials for avatar
  const getInitials = (name?: string): string => {
    if (!name || name.trim().length === 0) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Open Edit Profile Modal
  const handleOpenEditModal = () => {
    if (user) {
      setEditFullName(user.fullName);
    }
    setEditError(null);
    setProfileSuccessMsg(null);
    setIsEditModalVisible(true);
  };

  // Save Profile Changes
  const handleSaveProfile = async () => {
    if (!editFullName || editFullName.trim().length < 2) {
      setEditError('Full Name must be at least 2 characters long.');
      return;
    }

    if (!user) {
      setEditError('No active user session found.');
      return;
    }

    setIsSavingProfile(true);
    setEditError(null);

    try {
      const res = await authService.updateCurrentUserProfile(editFullName.trim());
      if (res.success && res.user) {
        setUser(res.user);
        setIsEditModalVisible(false);
        setProfileSuccessMsg('Profile updated successfully!');
        setTimeout(() => setProfileSuccessMsg(null), 4000);
      } else {
        setEditError(res.error || 'Failed to update profile. Please try again.');
      }
    } catch (err: any) {
      setEditError(err.message || 'An unexpected error occurred while updating profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Confirm and Execute Logout
  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authService.logout();
      setIsLogoutModalVisible(false);
      // Reset navigation stack to Login screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (err) {
      console.error('Logout error:', err);
      setIsLoggingOut(false);
      Alert.alert('Logout Error', 'Unable to complete logout. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <AppHeader
        title="Profile & Settings"
        subtitle="Account & Preferences"
        showBack={true}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Success Feedback Banner */}
        {profileSuccessMsg && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#059669" style={{ marginRight: 8 }} />
            <Text style={styles.successBannerText}>{profileSuccessMsg}</Text>
          </View>
        )}

        {/* 1. USER PROFILE CARD */}
        <AppCard style={styles.profileCard}>
          <View style={styles.profileHeaderRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{getInitials(user?.fullName)}</Text>
            </View>

            <View style={styles.profileDetails}>
              <Text style={styles.userName}>{user?.fullName || 'Authenticated User'}</Text>
              <Text style={styles.userPhone}>
                {user?.countryCode || '+91'} {user?.mobileNumber?.replace('+91', '') || 'XXXXXXXXXX'}
              </Text>
              <View style={styles.badgeRow}>
                <StatusBadge label="Active Session" status="active" size="sm" />
              </View>
            </View>

            <TouchableOpacity
              style={styles.editIconBtn}
              onPress={handleOpenEditModal}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Edit profile full name"
            >
              <Ionicons name="pencil" size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.profileMetaDivider} />

          <View style={styles.profileMetaGrid}>
            <View style={styles.profileMetaCol}>
              <Text style={styles.profileMetaLabel}>Country Code</Text>
              <Text style={styles.profileMetaValue}>{user?.countryCode || '+91'} (India)</Text>
            </View>
            <View style={styles.profileMetaCol}>
              <Text style={styles.profileMetaLabel}>Account Type</Text>
              <Text style={styles.profileMetaValue}>Personal Safety</Text>
            </View>
          </View>
        </AppCard>

        {/* 2. ACCOUNT MANAGEMENT SECTION */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Account</Text>
          <AppCard style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleOpenEditModal}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Edit account profile name"
            >
              <View style={[styles.menuIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="person-outline" size={20} color={Colors.primary} />
              </View>
              <View style={styles.menuItemCenter}>
                <Text style={styles.menuItemText}>Edit Profile</Text>
                <Text style={styles.menuItemSub}>Update your full name</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </AppCard>
        </View>

        {/* 3. SAFETY CONFIGURATION SECTION */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Safety & Monitoring</Text>
          <AppCard style={styles.menuCard}>
            {/* Emergency Contacts */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('EmergencyContacts')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Manage emergency contacts"
            >
              <View style={[styles.menuIconBox, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="people-outline" size={20} color="#4F46E5" />
              </View>
              <View style={styles.menuItemCenter}>
                <Text style={styles.menuItemText}>Emergency Contacts</Text>
                <Text style={styles.menuItemSub}>Predefined alert recipients</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {/* Safety Permissions */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('Permissions')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Review application safety permissions"
            >
              <View style={[styles.menuIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="key-outline" size={20} color="#059669" />
              </View>
              <View style={styles.menuItemCenter}>
                <Text style={styles.menuItemText}>Safety Permissions</Text>
                <Text style={styles.menuItemSub}>
                  Microphone, Location & Notifications
                </Text>
              </View>
              <StatusBadge
                label={allPermsGranted ? 'Granted' : 'Review'}
                status={allPermsGranted ? 'active' : 'warning'}
                size="sm"
                style={{ marginRight: 6 }}
              />
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {/* Sound Monitoring Settings */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('SoundMonitoring')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Open sound monitoring settings"
            >
              <View style={[styles.menuIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="mic-outline" size={20} color={Colors.primary} />
              </View>
              <View style={styles.menuItemCenter}>
                <Text style={styles.menuItemText}>Sound Monitoring</Text>
                <Text style={styles.menuItemSub}>Acoustic detection status</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {/* Live Location Tracking */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('LiveLocation')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Open live location coordinates"
            >
              <View style={[styles.menuIconBox, { backgroundColor: '#F0F9FF' }]}>
                <Ionicons name="location-outline" size={20} color="#0284C7" />
              </View>
              <View style={styles.menuItemCenter}>
                <Text style={styles.menuItemText}>Live Location</Text>
                <Text style={styles.menuItemSub}>On-demand GPS readiness</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {/* Alert & Incident History */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('AlertHistory')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="View emergency alert and incident history"
            >
              <View style={[styles.menuIconBox, { backgroundColor: '#FFFBEB' }]}>
                <Ionicons name="time-outline" size={20} color="#D97706" />
              </View>
              <View style={styles.menuItemCenter}>
                <Text style={styles.menuItemText}>Alert & Incident History</Text>
                <Text style={styles.menuItemSub}>Past emergency logs</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </AppCard>
        </View>

        {/* 4. ABOUT & PRIVACY SECTION */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Application Information</Text>
          <AppCard style={styles.menuCard}>
            {/* About LifeGuard AI */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setIsAboutModalVisible(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Open About LifeGuard AI information"
            >
              <View style={[styles.menuIconBox, { backgroundColor: '#F1F5F9' }]}>
                <Ionicons name="information-circle-outline" size={20} color="#475569" />
              </View>
              <View style={styles.menuItemCenter}>
                <Text style={styles.menuItemText}>About LifeGuard AI</Text>
                <Text style={styles.menuItemSub}>App specification & version</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {/* Privacy & Safety Scope */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setIsPrivacyModalVisible(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Open Privacy and Safety Architecture information"
            >
              <View style={[styles.menuIconBox, { backgroundColor: '#F1F5F9' }]}>
                <Ionicons name="shield-outline" size={20} color="#475569" />
              </View>
              <View style={styles.menuItemCenter}>
                <Text style={styles.menuItemText}>Privacy & Safety Scope</Text>
                <Text style={styles.menuItemSub}>Data protection & boundary notice</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </AppCard>
        </View>

        {/* 5. LOGOUT BUTTON */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => setIsLogoutModalVisible(true)}
          activeOpacity={0.7}
          accessibilityLabel="Logout from account"
          accessibilityRole="button"
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Footer Note */}
        <View style={styles.footerNote}>
          <Text style={styles.footerNoteText}>
            LifeGuard AI • Version 1.1.0
          </Text>
          <Text style={styles.footerSubNote}>
            Your Safety, Our Priority
          </Text>
        </View>
      </ScrollView>

      {/* ============================================================ */}
      {/* MODAL 1: EDIT PROFILE MODAL */}
      {/* ============================================================ */}
      <Modal
        visible={isEditModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconBox}>
                <Ionicons name="person" size={22} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                <Text style={styles.modalSubtitle}>Update your personal information</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
                accessibilityLabel="Close edit profile modal"
              >
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {editError && (
              <View style={styles.modalErrorBox}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.modalErrorText}>{editError}</Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.textInput}
                value={editFullName}
                onChangeText={(text) => {
                  setEditFullName(text);
                  setEditError(null);
                }}
                placeholder="Enter your full name"
                placeholderTextColor="#94A3B8"
                autoCapitalize="words"
                maxLength={50}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Registered Mobile Number</Text>
              <View style={styles.disabledInputBox}>
                <Text style={styles.disabledInputText}>
                  {user?.countryCode || '+91'} {user?.mobileNumber?.replace('+91', '') || ''}
                </Text>
                <Ionicons name="lock-closed" size={16} color="#94A3B8" />
              </View>
              <Text style={styles.inputHint}>
                Mobile number is your verified identifier and cannot be changed directly.
              </Text>
            </View>

            <View style={styles.modalButtonRow}>
              <AppButton
                title="Cancel"
                variant="outline"
                size="md"
                onPress={() => setIsEditModalVisible(false)}
                style={{ flex: 1, marginRight: 10 }}
                disabled={isSavingProfile}
              />
              <AppButton
                title={isSavingProfile ? 'Saving...' : 'Save Changes'}
                variant="primary"
                size="md"
                onPress={handleSaveProfile}
                style={{ flex: 1 }}
                loading={isSavingProfile}
                disabled={isSavingProfile}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 2: LOGOUT CONFIRMATION MODAL */}
      {/* ============================================================ */}
      <Modal
        visible={isLogoutModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.logoutModalIconCircle}>
              <Ionicons name="log-out-outline" size={32} color={Colors.danger} />
            </View>

            <Text style={styles.logoutModalTitle}>Logout Confirmation</Text>
            <Text style={styles.logoutModalMessage}>
              Are you sure you want to logout?{'\n'}
              Your active session will be closed on this device.
            </Text>

            <View style={styles.modalButtonRow}>
              <AppButton
                title="Cancel"
                variant="outline"
                size="md"
                onPress={() => setIsLogoutModalVisible(false)}
                style={{ flex: 1, marginRight: 10 }}
                disabled={isLoggingOut}
              />
              <AppButton
                title={isLoggingOut ? 'Logging out...' : 'Logout'}
                variant="danger"
                size="md"
                onPress={handleConfirmLogout}
                style={{ flex: 1 }}
                loading={isLoggingOut}
                disabled={isLoggingOut}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 3: ABOUT LIFEGUARD AI MODAL */}
      {/* ============================================================ */}
      <Modal
        visible={isAboutModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsAboutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="shield-checkmark" size={22} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>LifeGuard AI</Text>
                <Text style={styles.modalSubtitle}>Your Safety, Our Priority</Text>
              </View>
              <TouchableOpacity onPress={() => setIsAboutModalVisible(false)}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300, marginVertical: 12 }}>
              <Text style={styles.infoModalHeading}>LifeGuard AI Personal Safety</Text>
              <Text style={styles.infoModalParagraph}>
                LifeGuard AI is an automated mobile personal-safety system designed to provide
                immediate distress detection and automated alerts for users in emergency situations.
              </Text>

              <Text style={styles.infoModalSubheading}>Core Capabilities:</Text>
              <View style={styles.bulletRow}>
                <Ionicons name="mic" size={16} color={Colors.primary} style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: '700' }}>Sound Monitoring:</Text> Real-time acoustic level measurement to detect surrounding loud sounds.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Ionicons name="hardware-chip" size={16} color={Colors.primary} style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: '700' }}>AI Scream Detection:</Text> Machine learning classification differentiating distress screams from environmental noise.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Ionicons name="location" size={16} color="#0284C7" style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: '700' }}>GPS Coordinates:</Text> High-accuracy location acquisition attached directly to emergency alerts.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Ionicons name="send" size={16} color="#059669" style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: '700' }}>Emergency Alerts:</Text> Automated alert dispatch to predefined trusted contacts.
                </Text>
              </View>

              <View style={styles.scopeNoticeBox}>
                <Ionicons name="warning-outline" size={18} color="#D97706" style={{ marginRight: 6 }} />
                <Text style={styles.scopeNoticeText}>
                  Prototype Scope: The system sends alerts only to personal contacts configured by the user.
                  Direct communication with 112 / police is NOT active in this prototype.
                </Text>
              </View>
            </ScrollView>

            <AppButton
              title="Close"
              variant="primary"
              size="md"
              onPress={() => setIsAboutModalVisible(false)}
            />
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 4: PRIVACY & SAFETY SCOPE MODAL */}
      {/* ============================================================ */}
      <Modal
        visible={isPrivacyModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsPrivacyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="lock-closed" size={22} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Privacy & Safety Scope</Text>
                <Text style={styles.modalSubtitle}>How your personal data is protected</Text>
              </View>
              <TouchableOpacity onPress={() => setIsPrivacyModalVisible(false)}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300, marginVertical: 12 }}>
              <View style={styles.privacyItem}>
                <Text style={styles.privacyItemTitle}>🎙️ Zero Continuous Audio Storage</Text>
                <Text style={styles.privacyItemDesc}>
                  Microphone access is used solely for real-time acoustic level measurement and short
                  temporary audio capture during loud-sound events. Audio is never stored continuously,
                  uploaded to external servers, or retained in database records.
                </Text>
              </View>

              <View style={styles.privacyItem}>
                <Text style={styles.privacyItemTitle}>📍 On-Demand Location Acquisition</Text>
                <Text style={styles.privacyItemDesc}>
                  GPS coordinates are acquired strictly when an emergency event (confirmed distress scream
                  or manual SOS) is verified. Background continuous location tracking is strictly disabled.
                </Text>
              </View>

              <View style={styles.privacyItem}>
                <Text style={styles.privacyItemTitle}>👥 User-Specific Data Isolation</Text>
                <Text style={styles.privacyItemDesc}>
                  All emergency contact lists, incident records, and alert histories are strictly isolated
                  in SQLite and filtered by your authenticated account ID. No other user can access your data.
                </Text>
              </View>

              <View style={styles.privacyItem}>
                <Text style={styles.privacyItemTitle}>🚨 Contact Alerts Scope</Text>
                <Text style={styles.privacyItemDesc}>
                  Alerts are dispatched only to your designated emergency contacts. Public emergency
                  dispatchers (Police / 112) are not contacted by this prototype.
                </Text>
              </View>
            </ScrollView>

            <AppButton
              title="Understood"
              variant="primary"
              size="md"
              onPress={() => setIsPrivacyModalVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 36,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  successBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#065F46',
    flex: 1,
  },
  profileCard: {
    padding: 18,
    marginBottom: 16,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  profileDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  userPhone: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  badgeRow: {
    marginTop: 6,
  },
  editIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  profileMetaDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  profileMetaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  profileMetaCol: {
    flex: 1,
  },
  profileMetaLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
    marginBottom: 2,
  },
  profileMetaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuCard: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  menuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemCenter: {
    flex: 1,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  menuItemSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 50,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.danger,
  },
  footerNote: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  footerNoteText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  footerSubNote: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  modalErrorText: {
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
  },
  formGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  textInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: '#F8FAFC',
  },
  disabledInputBox: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
  },
  disabledInputText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  inputHint: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  modalButtonRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  logoutModalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  logoutModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  logoutModalMessage: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  infoModalHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  infoModalParagraph: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  infoModalSubheading: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bulletText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 17,
  },
  scopeNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    marginBottom: 8,
  },
  scopeNoticeText: {
    fontSize: 11,
    color: '#92400E',
    flex: 1,
    lineHeight: 16,
  },
  privacyItem: {
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  privacyItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  privacyItemDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
});