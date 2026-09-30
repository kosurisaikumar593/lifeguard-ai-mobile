import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../components/AppHeader';
import { AppCard } from '../components/AppCard';
import { AppButton } from '../components/AppButton';
import { StatusBadge } from '../components/StatusBadge';
import { Colors } from '../theme/colors';
import { EmergencyIncident } from '../types';
import { RootStackParamList } from '../types/navigation';
import { emergencyIncidentService } from '../services/emergencyIncidentService';
import { emergencyAlertService } from '../services/emergencyAlertService';
import { authService } from '../services/AuthService';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type FilterType = 'ALL' | 'AI_DETECTED' | 'MANUAL_SOS';

export const AlertHistoryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const [incidents, setIncidents] = useState<EmergencyIncident[]>([]);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches actual emergency incident records strictly for the authenticated user.
   */
  const loadIncidents = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    const currentUser = authService.getCurrentUser();
    const userId = currentUser?.userId || currentUser?.id;

    if (!userId) {
      setError('Please sign in to view your emergency alert history.');
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      // Strict User Isolation: All queries filter by authenticated user_id
      const records = await emergencyIncidentService.getUserIncidentHistory(userId);

      // Deterministic sort: newest incidents first by timestamp
      const sorted = [...records].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setIncidents(sorted);
    } catch (err: any) {
      console.error('Failed to load emergency incidents:', err);
      setError('Unable to load emergency history.');
      setIncidents([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // 1. Refresh whenever screen gains focus or returns from detail screen
  useFocusEffect(
    useCallback(() => {
      loadIncidents(false);
    }, [loadIncidents])
  );

  // 2. React to dynamic pipeline updates (new incidents created or alert status changes)
  useEffect(() => {
    const unsubCreated = emergencyIncidentService.onIncidentCreated(() => {
      loadIncidents(false);
    });

    const unsubUpdated = emergencyIncidentService.onIncidentUpdated(() => {
      loadIncidents(false);
    });

    const unsubAlert = emergencyAlertService.onAlertStatusChanged(() => {
      loadIncidents(false);
    });

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubAlert();
    };
  }, [loadIncidents]);

  // Client-side filtering across the user's isolated records
  const filteredIncidents = useMemo(() => {
    if (filter === 'AI_DETECTED') {
      return incidents.filter(
        (inc) => inc.incidentType === 'AI_DETECTED' || inc.incidentType === 'CONFIRMED_SCREAM'
      );
    }
    if (filter === 'MANUAL_SOS') {
      return incidents.filter((inc) => inc.incidentType === 'MANUAL_SOS');
    }
    return incidents;
  }, [incidents, filter]);

  // Resolves human-readable alert delivery status
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

  // Formats incident timestamp into clean date and time
  const formatDateTime = (isoString: string) => {
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
        title="Alert History"
        subtitle="Emergency Incident Records"
        onBack={() => navigation.goBack()}
      />

      {/* FILTER CHIPS */}
      <View style={styles.filterRow}>
        {(
          [
            { key: 'ALL', label: 'All Incidents' },
            { key: 'AI_DETECTED', label: 'AI Detected' },
            { key: 'MANUAL_SOS', label: 'Manual SOS' },
          ] as const
        ).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterChip, filter === tab.key && styles.filterChipActive]}
            onPress={() => setFilter(tab.key)}
            accessibilityRole="button"
            accessibilityLabel={`Filter by ${tab.label}`}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === tab.key && styles.filterChipTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 1. LOADING STATE */}
      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading emergency history...</Text>
        </View>
      ) : error ? (
        /* 2. ERROR STATE */
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={54} color={Colors.danger} />
          <Text style={styles.errorTitle}>Unable to load emergency history.</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <AppButton
            title="Try Again"
            variant="primary"
            size="md"
            onPress={() => loadIncidents(false)}
            style={styles.retryButton}
            accessibilityLabel="Retry loading emergency incidents"
          />
        </View>
      ) : filteredIncidents.length === 0 ? (
        /* 3. EMPTY STATE (Mandatory zero-fake-data state) */
        <ScrollView
          contentContainerStyle={styles.emptyScroll}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadIncidents(true)}
              tintColor={Colors.primary}
            />
          }
        >
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="shield-checkmark-outline" size={44} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>NO EMERGENCY INCIDENTS</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'ALL'
                ? 'No emergency incidents have been recorded yet.'
                : `No ${filter === 'AI_DETECTED' ? 'AI detected' : 'Manual SOS'} incidents recorded.`}
            </Text>
            <Text style={styles.emptyHint}>
              All genuine distress detections and manual SOS triggers will be logged here for review.
            </Text>
          </View>
        </ScrollView>
      ) : (
        /* 4. REAL INCIDENT LIST */
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadIncidents(true)}
              tintColor={Colors.primary}
            />
          }
        >
          {filteredIncidents.map((incident) => {
            const hasLocation =
              incident.latitude !== null &&
              incident.latitude !== undefined &&
              incident.longitude !== null &&
              incident.longitude !== undefined;
            const { date, time } = formatDateTime(incident.timestamp);
            const alertStatusInfo = resolveAlertStatus(incident.status);
            const isManual = incident.incidentType === 'MANUAL_SOS';

            return (
              <TouchableOpacity
                key={incident.incidentId}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate('IncidentDetail', {
                    incidentId: incident.incidentId,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`View details for ${isManual ? 'Manual SOS' : 'AI Detected'} incident, status ${alertStatusInfo.label}`}
              >
                <AppCard style={styles.incidentCard}>
                  {/* Card Header: Icon, Title, ID, and Status Badge */}
                  <View style={styles.incidentHeader}>
                    <View style={styles.iconAndTitle}>
                      <View
                        style={[
                          styles.incidentIcon,
                          {
                            backgroundColor: isManual ? '#FEF2F2' : '#EFF6FF',
                          },
                        ]}
                      >
                        <Ionicons
                          name={isManual ? 'notifications' : 'mic'}
                          size={20}
                          color={isManual ? Colors.danger : Colors.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.incidentTitle}>
                          {isManual ? 'MANUAL SOS' : 'AI DETECTED EMERGENCY'}
                        </Text>
                        <Text style={styles.incidentId}>{incident.incidentId}</Text>
                      </View>
                    </View>

                    <StatusBadge
                      label={alertStatusInfo.label}
                      status={alertStatusInfo.badge}
                      size="sm"
                    />
                  </View>

                  {/* Date & Time Row */}
                  <View style={styles.infoRow}>
                    <View style={styles.infoItem}>
                      <Ionicons name="calendar-outline" size={15} color="#64748B" style={{ marginRight: 5 }} />
                      <Text style={styles.infoText}>{date}</Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Ionicons name="time-outline" size={15} color="#64748B" style={{ marginRight: 5 }} />
                      <Text style={styles.infoText}>{time}</Text>
                    </View>
                  </View>

                  {/* Location Status Row */}
                  <View style={styles.locationRow}>
                    <Ionicons
                      name={hasLocation ? 'location' : 'location-outline'}
                      size={15}
                      color={hasLocation ? '#0284C7' : '#94A3B8'}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.locationText,
                        hasLocation ? styles.locationAvailable : styles.locationUnavailable,
                      ]}
                    >
                      Location: {hasLocation ? 'Available' : 'Unavailable'}
                    </Text>

                    {hasLocation && incident.locationAccuracy ? (
                      <Text style={styles.accuracyTag}>
                        (±{Math.round(incident.locationAccuracy)}m)
                      </Text>
                    ) : null}
                  </View>

                  {/* AI Confidence Row (Only if genuinely available) */}
                  {incident.confidence !== null && incident.confidence !== undefined ? (
                    <View style={styles.confidenceRow}>
                      <Ionicons name="hardware-chip-outline" size={15} color="#1E40AF" style={{ marginRight: 6 }} />
                      <Text style={styles.confidenceText}>
                        Detection Confidence:{' '}
                        <Text style={{ fontWeight: '800' }}>
                          {incident.confidence <= 1
                            ? `${Math.round(incident.confidence * 100)}%`
                            : `${Math.round(incident.confidence)}%`}
                        </Text>
                      </Text>
                    </View>
                  ) : null}

                  {/* Tap for details indicator */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.viewDetailLink}>View Details</Text>
                    <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
                  </View>
                </AppCard>
              </TouchableOpacity>
            );
          })}
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    width: 140,
  },
  emptyScroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 18,
  },
  emptyHint: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  incidentCard: {
    marginVertical: 6,
    padding: 16,
  },
  incidentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconAndTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  incidentIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  incidentTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  incidentId: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  infoText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '600',
  },
  locationAvailable: {
    color: '#0284C7',
  },
  locationUnavailable: {
    color: '#94A3B8',
  },
  accuracyTag: {
    fontSize: 11,
    color: Colors.textMuted,
    marginLeft: 4,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  confidenceText: {
    fontSize: 12,
    color: '#1E40AF',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  viewDetailLink: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    marginRight: 4,
  },
});