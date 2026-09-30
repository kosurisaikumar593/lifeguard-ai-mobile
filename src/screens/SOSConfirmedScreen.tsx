import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, ScrollView, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { Colors } from '../theme/colors';
import { manualSOSService } from '../services/ManualSOSService';
import { authService } from '../services/AuthService';
import { locationService } from '../services/LocationService';
import { emergencyAlertService } from '../services/emergencyAlertService';
import { whatsAppService } from '../services/WhatsAppService';
import { LocationData, LocationState, EmergencyAlertResult, AlertDeliveryStatus } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'SOSConfirmed'>;

export const SOSConfirmedScreen: React.FC<Props> = ({ navigation }) => {
  const activeEvent = manualSOSService.getActiveEvent();
  const currentUser = authService.getCurrentUser();
  const [locationState, setLocationState] = useState<LocationState>(locationService.getState());
  const [locationData, setLocationData] = useState<LocationData | null>(locationService.getLastLocation());
  const [alertResult, setAlertResult] = useState<EmergencyAlertResult | null>(
    activeEvent ? emergencyAlertService.getIncidentAlertResult(activeEvent.eventId) : null
  );
  const [alertStatus, setAlertStatus] = useState<AlertDeliveryStatus | null>(
    activeEvent ? emergencyAlertService.getAlertStatus(activeEvent.eventId) : null
  );
  const [whatsAppSending, setWhatsAppSending] = useState(false);

  const handleSendWhatsAppAlert = async () => {
    setWhatsAppSending(true);
    try {
      const res = await whatsAppService.dispatchWhatsAppAlert({
        incident: activeEvent ? ({
          incidentId: activeEvent.eventId,
          id: activeEvent.eventId,
          userId: activeEvent.userId,
          incidentType: 'MANUAL_SOS',
          timestamp: activeEvent.timestamp,
          latitude: locationData?.latitude ?? null,
          longitude: locationData?.longitude ?? null,
          accuracy: locationData?.accuracy ?? null,
        } as any) : null,
      });

      if (!res.success) {
        Alert.alert(
          'WhatsApp Alert',
          res.error || 'No emergency contacts found. Please add contacts in Family/Contacts.',
          [{ text: 'OK' }]
        );
      }
    } catch (err: any) {
      Alert.alert('WhatsApp Error', err?.message || 'Failed to open WhatsApp');
    } finally {
      setWhatsAppSending(false);
    }
  };

  useEffect(() => {
    const unsubState = locationService.subscribeState((s) => setLocationState(s));
    const unsubLoc = locationService.onLocationAcquired((d) => setLocationData(d));
    const unsubAlert = emergencyAlertService.onAlertDispatched((res) => {
      if (!activeEvent || res.incidentId === activeEvent.eventId) {
        setAlertResult(res);
        setAlertStatus(res.status);
      }
    });
    const unsubAlertStatus = emergencyAlertService.onAlertStatusChanged((st, incId) => {
      if (!activeEvent || incId === activeEvent.eventId) {
        setAlertStatus(st);
      }
    });

    return () => {
      unsubState();
      unsubLoc();
      unsubAlert();
      unsubAlertStatus();
    };
  }, [activeEvent]);

  const handleReturnToDashboard = () => {
    navigation.replace('MainTabs');
  };

  const handleStandDown = () => {
    manualSOSService.resetSOS();
    navigation.replace('MainTabs');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Success / Activation Emblem */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircleOuter}>
            <View style={styles.iconCircleInner}>
              <Ionicons name="alert-circle" size={48} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <Text style={styles.title}>SOS ACTIVATED</Text>
        <Text style={styles.subtitle}>
          Emergency process started.
        </Text>

        {/* Real Event Metadata Card */}
        <AppCard style={styles.metaCard}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>EVENT ID</Text>
            <Text style={styles.metaValue}>{activeEvent?.eventId || 'sos_active'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>USER</Text>
            <Text style={styles.metaValue}>
              {currentUser?.fullName || 'Authenticated User'} ({currentUser?.mobileNumber || '+91XXXXXXXXXX'})
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>TIMESTAMP</Text>
            <Text style={styles.metaValue}>
              {activeEvent?.timestamp ? new Date(activeEvent.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>STATUS</Text>
            <Text style={[styles.metaValue, { color: '#EF4444', fontWeight: '800' }]}>
              {activeEvent?.status || 'TRIGGERED'}
            </Text>
          </View>
        </AppCard>

        {/* System Pipeline Status */}
        <View style={styles.stepsContainer}>
          <Text style={styles.sectionTitle}>Process Lifecycle</Text>

          {/* Step 1: Completed */}
          <AppCard style={styles.stepCard}>
            <View style={styles.stepIconBoxCompleted}>
              <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
            </View>
            <View style={styles.stepTextWrapper}>
              <Text style={styles.stepTitle}>Manual SOS Event Created</Text>
              <Text style={styles.stepDetail}>
                Event logged and persisted to local SQLite emergency database.
              </Text>
            </View>
          </AppCard>

          {/* Step 2: GPS Location Pipeline State */}
          <AppCard style={styles.stepCard}>
            <View style={locationData ? styles.stepIconBoxCompleted : styles.stepIconBoxPending}>
              <Ionicons
                name={locationData ? 'checkmark-circle' : (locationState === 'GETTING_LOCATION' ? 'sync-outline' : 'location-outline')}
                size={22}
                color={locationData ? Colors.success : '#0284C7'}
              />
            </View>
            <View style={styles.stepTextWrapper}>
              <Text style={styles.stepTitle}>
                {locationData ? 'GPS Location Attached' : (locationState === 'GETTING_LOCATION' ? 'Acquiring GPS Fix...' : 'GPS Location Acquisition')}
              </Text>
              <Text style={styles.stepDetail}>
                {locationData
                  ? `${locationService.formatCoordinates(locationData.latitude, locationData.longitude)} (±${Math.round(locationData.accuracy || 0)}m)`
                  : (locationState === 'LOCATION_ERROR'
                      ? 'GPS coordinates unavailable. Alert recorded without location.'
                      : 'Fetching high-accuracy satellite coordinates for emergency record.')}
              </Text>
            </View>
          </AppCard>

          {/* Step 3: Emergency Responder Alert Dispatch (Phase 16) */}
          <AppCard style={styles.stepCard}>
            <View
              style={
                alertStatus === 'SENT' || alertStatus === 'PARTIALLY_SENT'
                  ? styles.stepIconBoxCompleted
                  : alertStatus === 'NO_CONTACTS'
                  ? [styles.stepIconBoxPending, { backgroundColor: '#FEF3C7' }]
                  : alertStatus === 'FAILED'
                  ? [styles.stepIconBoxPending, { backgroundColor: '#FEE2E2' }]
                  : styles.stepIconBoxPending
              }
            >
              <Ionicons
                name={
                  alertStatus === 'SENT' || alertStatus === 'PARTIALLY_SENT'
                    ? 'checkmark-circle'
                    : alertStatus === 'NO_CONTACTS'
                    ? 'alert-circle'
                    : alertStatus === 'FAILED'
                    ? 'close-circle'
                    : alertStatus === 'SENDING'
                    ? 'sync-outline'
                    : 'paper-plane-outline'
                }
                size={22}
                color={
                  alertStatus === 'SENT' || alertStatus === 'PARTIALLY_SENT'
                    ? Colors.success
                    : alertStatus === 'NO_CONTACTS'
                    ? '#D97706'
                    : alertStatus === 'FAILED'
                    ? '#DC2626'
                    : '#4F46E5'
                }
              />
            </View>
            <View style={styles.stepTextWrapper}>
              <Text style={styles.stepTitle}>
                {alertStatus === 'SENT'
                  ? 'Alert Dispatched to Contacts'
                  : alertStatus === 'PARTIALLY_SENT'
                  ? 'Alert Partially Dispatched'
                  : alertStatus === 'NO_CONTACTS'
                  ? 'No Emergency Contacts Found'
                  : alertStatus === 'FAILED'
                  ? (alertResult?.error?.includes('not configured') ? 'SMS Service Not Configured' : 'Unable to Send SMS')
                  : alertStatus === 'SENDING'
                  ? 'Dispatching Emergency Alerts...'
                  : 'Emergency Contact Alert Dispatch'}
              </Text>
              <Text style={styles.stepDetail}>
                {alertResult && (alertStatus === 'SENT' || alertStatus === 'PARTIALLY_SENT')
                  ? `Successfully notified ${alertResult.successfulDeliveries} of ${alertResult.totalContacts} predefined contacts with GPS coordinates.`
                  : alertStatus === 'NO_CONTACTS'
                  ? 'No trusted emergency contacts configured. Please add contacts in Emergency Contacts.'
                  : alertStatus === 'FAILED'
                  ? (alertResult?.error || 'SMS service not configured. Incident safely saved to History.')
                  : alertStatus === 'SENDING'
                  ? 'Transmitting emergency alert with location to predefined contacts...'
                  : 'Preparing automated alert notification for predefined emergency contacts.'}
              </Text>
            </View>
          </AppCard>
        </View>

        {/* Truthful Boundary Notice */}
        <View style={styles.boundaryNotice}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.boundaryText}>
            Prototype Safety Scope: Alerts are dispatched strictly to your predefined personal emergency contacts. Direct police or 112 emergency services communication is not enabled in this prototype.
          </Text>
        </View>
      </ScrollView>

      {/* Footer Navigation Buttons */}
      <View style={styles.bottomSection}>
        <AppButton
          title="Share Alert via WhatsApp"
          variant="primary"
          size="lg"
          loading={whatsAppSending}
          onPress={handleSendWhatsAppAlert}
          leftIcon={<Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />}
          style={{ marginBottom: 10, backgroundColor: '#25D366' }}
          accessibilityLabel="Share emergency alert on WhatsApp with contacts"
        />
        <AppButton
          title="Return to Dashboard"
          variant="primary"
          size="lg"
          onPress={handleReturnToDashboard}
          style={{ marginBottom: 10 }}
          accessibilityLabel="Return to home dashboard"
        />
        <AppButton
          title="Stand Down / Reset SOS"
          variant="outline"
          size="md"
          onPress={handleStandDown}
          accessibilityLabel="Stand down and reset emergency SOS state"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconCircleOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  metaCard: {
    width: '100%',
    padding: 14,
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 6,
  },
  stepsContainer: {
    width: '100%',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
  },
  stepIconBoxCompleted: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepIconBoxPending: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepTextWrapper: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  stepDetail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  boundaryNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 12,
    width: '100%',
    marginTop: 8,
  },
  boundaryText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
    lineHeight: 15,
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
});