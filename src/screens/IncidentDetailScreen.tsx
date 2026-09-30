import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../components/AppHeader';
import { AppCard } from '../components/AppCard';
import { AppButton } from '../components/AppButton';
import { StatusBadge } from '../components/StatusBadge';
import { Colors } from '../theme/colors';
import { RootStackParamList } from '../types/navigation';
import { EmergencyIncident, EmergencyAlertResult } from '../types';
import { emergencyIncidentService } from '../services/emergencyIncidentService';
import { emergencyAlertService } from '../services/emergencyAlertService';
import { authService } from '../services/AuthService';

type IncidentDetailScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'IncidentDetail'
>;
type IncidentDetailScreenRouteProp = RouteProp<RootStackParamList, 'IncidentDetail'>;

export const IncidentDetailScreen: React.FC = () => {
  const navigation = useNavigation<IncidentDetailScreenNavigationProp>();
  const route = useRoute<IncidentDetailScreenRouteProp>();
  const { incidentId } = route.params;

  const [incident, setIncident] = useState<EmergencyIncident | null>(null);
  const [alertResult, setAlertResult] = useState<EmergencyAlertResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIncidentDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const currentUser = authService.getCurrentUser();
    const userId = currentUser?.userId || currentUser?.id;

    if (!userId) {
      setError('Authentication required to view incident records.');
      setIsLoading(false);
      return;
    }

    try {
      // 1. Strict User Isolation: Fetch incident using both incidentId AND userId
      const record = await emergencyIncidentService.getIncidentById(incidentId, userId);
      if (!record) {
        setError('Incident record not found or access is unauthorized.');
        setIncident(null);
      } else {
        setIncident(record);
        // 2. Fetch in-memory alert delivery details if available from Phase 16
        const alertRes = emergencyAlertService.getIncidentAlertResult(incidentId);
        setAlertResult(alertRes);
      }
    } catch (err: any) {
      setError('Unable to load incident details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    fetchIncidentDetails();
  }, [fetchIncidentDetails]);

  // Handle View Location on Google Maps
  const handleOpenMap = async (lat: number, lng: number) => {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(`geo:${lat},${lng}`);
      }
    } catch (e) {
      console.warn('Could not open map link:', e);
    }
  };

  // Helper for alert status formatting
  const resolveAlertStatus = (statusStr: string | undefined): { label: string; badge: 'emergency' | 'active' | 'warning' | 'info' | 'inactive' } => {
    const s = (statusStr || '').toUpperCase();
    if (s === 'ALERT_SENT' || s === 'SENT') {
      return { label: 'Alert Sent', badge: 'emergency' };
    }
    if (s === 'PARTIALLY_SENT') {
      return { label: 'Partially Sent', badge: 'warning' };
    }
    if (s === 'ALERT_FAILED' || s === 'FAILED') {
      return { label: 'Alert Failed', badge: 'inactive' };
    }
    if (s === 'NO_CONTACTS') {
      return { label: 'No Contacts', badge: 'warning' };
    }
    if (s === 'SENDING') {
      return { label: 'Sending Alert...', badge: 'info' };
    }
    if (s === 'ALERT_PENDING' || s === 'PENDING') {
      return { label: 'Alert Pending', badge: 'info' };
    }
    if (s === 'CONFIRMED') {
      return { label: 'Confirmed', badge: 'emergency' };
    }
    if (s === 'RESOLVED') {
      return { label: 'Resolved', badge: 'active' };
    }
    if (s === 'TRIGGERED') {
      return { label: 'Triggered', badge: 'warning' };
    }
    return { label: statusStr || 'Unknown', badge: 'inactive' };
  };

  // Format timestamp
  const formatDateTime = (isoString?: string) => {
    if (!isoString) return { date: 'Unknown Date', time: 'Unknown Time' };
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return { date: isoString, time: '' };
      const date = d.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const time = d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      return { date, time };
    } catch {
      return { date: isoString, time: '' };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <AppHeader
        title="Incident Details"
        subtitle={incidentId}
        onBack={() => navigation.goBack()}
      />

      {/* 1. LOADING STATE */}
      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading incident record...</Text>
        </View>
      ) : error || !incident ? (
        /* 2. ERROR / NOT FOUND STATE */
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={54} color={Colors.danger} />
          <Text style={styles.errorTitle}>Incident Not Found</Text>
          <Text style={styles.errorSubtitle}>
            {error || 'The requested emergency record is unavailable or belongs to another user.'}
          </Text>
          <View style={styles.errorActions}>
            <AppButton
              title="Try Again"
              variant="outline"
              size="sm"
              onPress={fetchIncidentDetails}
              style={{ marginRight: 10, width: 120 }}
            />
            <AppButton
              title="Go Back"
              variant="primary"
              size="sm"
              onPress={() => navigation.goBack()}
              style={{ width: 120 }}
            />
          </View>
        </View>
      ) : (
        /* 3. INCIDENT DETAIL CONTENT */
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Card 1: Overview & Status */}
          <AppCard style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.typeBadgeContainer}>
                <View
                  style={[
                    styles.typeIconBox,
                    {
                      backgroundColor:
                        incident.incidentType === 'MANUAL_SOS' ? '#FEF2F2' : '#EFF6FF',
                    },
                  ]}
                >
                  <Ionicons
                    name={incident.incidentType === 'MANUAL_SOS' ? 'notifications' : 'mic'}
                    size={22}
                    color={incident.incidentType === 'MANUAL_SOS' ? Colors.danger : Colors.primary}
                  />
                </View>
                <View>
                  <Text style={styles.incidentTypeTitle}>
                    {incident.incidentType === 'MANUAL_SOS'
                      ? 'MANUAL SOS EMERGENCY'
                      : 'AI DETECTED EMERGENCY'}
                  </Text>
                  <Text style={styles.incidentIdText}>ID: {incident.incidentId}</Text>
                </View>
              </View>

              <StatusBadge
                label={resolveAlertStatus(incident.status).label}
                status={resolveAlertStatus(incident.status).badge}
                size="md"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.metaGrid}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Date</Text>
                <Text style={styles.metaValue}>{formatDateTime(incident.timestamp).date}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Time</Text>
                <Text style={styles.metaValue}>{formatDateTime(incident.timestamp).time}</Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Trigger Source:</Text>
              <Text style={styles.metaValueInline}>
                {incident.source === 'MANUAL_BUTTON'
                  ? 'Manual SOS Button Tap'
                  : incident.source === 'AI_MICROPHONE_STREAM'
                  ? 'Microphone Acoustic Detection'
                  : incident.source || 'Emergency Trigger'}
              </Text>
            </View>
          </AppCard>

          {/* Card 2: AI & Acoustic Analysis (Only if AI Detected or Classification Available) */}
          <AppCard style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="hardware-chip-outline" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>Detection & Classification</Text>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Event Classification</Text>
              <Text style={styles.fieldValue}>
                {incident.classification === 'SCREAM'
                  ? 'Distress Scream (Verified)'
                  : incident.classification === 'MANUAL_SOS'
                  ? 'User Initiated SOS'
                  : incident.classification || 'Emergency Distress'}
              </Text>
            </View>

            {/* Confidence displayed ONLY if genuinely present in database */}
            {incident.confidence !== null && incident.confidence !== undefined ? (
              <View style={styles.confidenceBox}>
                <View style={styles.confidenceHeader}>
                  <Text style={styles.confidenceLabel}>AI Model Confidence Score</Text>
                  <Text style={styles.confidenceValue}>
                    {incident.confidence <= 1
                      ? `${Math.round(incident.confidence * 100)}%`
                      : `${Math.round(incident.confidence)}%`}
                  </Text>
                </View>
                <View style={styles.confidenceBarBg}>
                  <View
                    style={[
                      styles.confidenceBarFill,
                      {
                        width: `${Math.min(
                          100,
                          incident.confidence <= 1
                            ? Math.round(incident.confidence * 100)
                            : Math.round(incident.confidence)
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.confidenceHint}>
                  Acoustic frequency spectrum analysis confirmed distress signature.
                </Text>
              </View>
            ) : (
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Confidence Metric</Text>
                <Text style={styles.fieldValueSubtle}>
                  Not applicable for manual triggers.
                </Text>
              </View>
            )}
          </AppCard>

          {/* Card 3: GPS Location Information */}
          <AppCard style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location-outline" size={20} color="#0284C7" style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>Incident GPS Location</Text>
            </View>

            {incident.latitude !== null &&
            incident.latitude !== undefined &&
            incident.longitude !== null &&
            incident.longitude !== undefined ? (
              <View>
                <View style={styles.coordBox}>
                  <View style={styles.coordItem}>
                    <Text style={styles.coordLabel}>Latitude</Text>
                    <Text style={styles.coordValue}>{incident.latitude.toFixed(6)}° N</Text>
                  </View>
                  <View style={styles.coordDivider} />
                  <View style={styles.coordItem}>
                    <Text style={styles.coordLabel}>Longitude</Text>
                    <Text style={styles.coordValue}>{incident.longitude.toFixed(6)}° E</Text>
                  </View>
                </View>

                {incident.locationAccuracy !== null && incident.locationAccuracy !== undefined ? (
                  <View style={styles.accuracyRow}>
                    <Ionicons name="shield-checkmark-outline" size={14} color="#10B981" style={{ marginRight: 6 }} />
                    <Text style={styles.accuracyText}>
                      Estimated GPS Accuracy: ±{Math.round(incident.locationAccuracy)} meters
                    </Text>
                  </View>
                ) : null}

                <AppButton
                  title="View Location on Map"
                  variant="primary"
                  size="md"
                  onPress={() => handleOpenMap(incident.latitude!, incident.longitude!)}
                  style={styles.mapBtn}
                  accessibilityLabel="Open incident coordinates in Google Maps"
                />
              </View>
            ) : (
              /* Missing Location Truthful Fallback */
              <View style={styles.noLocationBox}>
                <Ionicons name="location-outline" size={28} color="#94A3B8" />
                <Text style={styles.noLocationTitle}>Location unavailable</Text>
                <Text style={styles.noLocationDesc}>
                  GPS coordinates were not acquired at the moment this emergency incident occurred.
                </Text>
              </View>
            )}
          </AppCard>

          {/* Card 4: Alert Delivery Summary (Phase 16 Integration) */}
          <AppCard style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="send-outline" size={20} color="#4F46E5" style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>Alert Delivery Status</Text>
            </View>

            <View style={styles.alertStatusRow}>
              <Text style={styles.fieldLabel}>Dispatch Status</Text>
              <StatusBadge
                label={resolveAlertStatus(incident.status).label}
                status={resolveAlertStatus(incident.status).badge}
                size="sm"
              />
            </View>

            {alertResult ? (
              <View style={styles.alertDetailBox}>
                <Text style={styles.alertSummaryText}>
                  Recipients: {alertResult.successfulDeliveries} of {alertResult.totalContacts} contacts notified.
                </Text>
                {alertResult.deliveryResults.map((contact, idx) => (
                  <View key={contact.contactId || idx} style={styles.recipientRow}>
                    <Ionicons
                      name={contact.status === 'SENT' ? 'checkmark-circle' : 'close-circle'}
                      size={18}
                      color={contact.status === 'SENT' ? '#10B981' : '#EF4444'}
                      style={{ marginRight: 8 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recipientName}>{contact.name}</Text>
                      <Text style={styles.recipientPhone}>{contact.phoneNumber} ({contact.channel})</Text>
                    </View>
                    <Text
                      style={[
                        styles.recipientStatusText,
                        contact.status === 'SENT' ? { color: '#059669' } : { color: '#DC2626' },
                      ]}
                    >
                      {contact.status === 'SENT' ? 'Delivered' : 'Failed'}
                    </Text>
                  </View>
                ))}
              </View>
            ) : incident.status === 'NO_CONTACTS' ? (
              <View style={styles.infoNotice}>
                <Ionicons name="information-circle-outline" size={18} color="#D97706" style={{ marginRight: 6 }} />
                <Text style={styles.infoNoticeText}>
                  No emergency contacts were configured. Add trusted contacts from the Emergency Contacts screen.
                </Text>
              </View>
            ) : incident.status === 'ALERT_SENT' ? (
              <Text style={styles.plainAlertNote}>
                Emergency alert payload dispatched to registered emergency contacts.
              </Text>
            ) : incident.status === 'ALERT_FAILED' ? (
              <Text style={styles.plainAlertFailNote}>
                Alert transmission failed. Please verify cellular signal or contact phone numbers.
              </Text>
            ) : null}
          </AppCard>

          {/* Prototype Safety Notice */}
          <View style={styles.safetyNoticeBox}>
            <Ionicons name="information-circle" size={18} color="#64748B" style={{ marginRight: 8 }} />
            <Text style={styles.safetyNoticeText}>
              Prototype Notice: Emergency alerts are sent only to personal contacts configured by the user.
              Emergency services (112 / Police) are NOT contacted by this prototype.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 12,
    marginBottom: 6,
  },
  errorSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  errorActions: {
    flexDirection: 'row',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  card: {
    marginVertical: 6,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  typeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  incidentTypeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  incidentIdText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metaValueInline: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginLeft: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  fieldRow: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  fieldValueSubtle: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  confidenceBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
  },
  confidenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  confidenceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
  },
  confidenceValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  confidenceBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DBEAFE',
    overflow: 'hidden',
    marginBottom: 6,
  },
  confidenceBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  confidenceHint: {
    fontSize: 11,
    color: '#3B82F6',
    lineHeight: 15,
  },
  coordBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
  },
  coordItem: {
    flex: 1,
    alignItems: 'center',
  },
  coordLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
    marginBottom: 2,
  },
  coordValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  coordDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
  accuracyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  accuracyText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  mapBtn: {
    marginTop: 4,
  },
  noLocationBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noLocationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 6,
    marginBottom: 2,
  },
  noLocationDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  alertStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertDetailBox: {
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  alertSummaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  recipientName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  recipientPhone: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  recipientStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  infoNoticeText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
  },
  plainAlertNote: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  plainAlertFailNote: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 6,
  },
  safetyNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  safetyNoticeText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
    lineHeight: 16,
  },
});
