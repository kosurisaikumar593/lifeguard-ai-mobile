import React, { useState, useEffect } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { AppHeader } from '../components/AppHeader';
import { AppCard } from '../components/AppCard';
import { AppButton } from '../components/AppButton';
import { StatusBadge } from '../components/StatusBadge';
import { permissionService } from '../services/PermissionService';
import { locationService } from '../services/LocationService';
import { DetailedPermissionsState, LocationData, LocationState } from '../types';
import { Colors } from '../theme/colors';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const LiveLocationScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [permissions, setPermissions] = useState<DetailedPermissionsState>(
    permissionService.getState()
  );
  const [locationState, setLocationState] = useState<LocationState>(
    locationService.getState()
  );
  const [locationData, setLocationData] = useState<LocationData | null>(
    locationService.getLastLocation()
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(
    locationService.getLastError()
  );
  const [isFetching, setIsFetching] = useState<boolean>(false);

  useEffect(() => {
    const unsubPerm = permissionService.subscribe((p) => setPermissions(p));
    const unsubState = locationService.subscribeState((s) => setLocationState(s));
    const unsubLoc = locationService.onLocationAcquired((d) => {
      setLocationData(d);
      setErrorMessage(null);
    });

    permissionService.checkLocationPermission();

    return () => {
      unsubPerm();
      unsubState();
      unsubLoc();
    };
  }, []);

  const handleFetchLocation = async () => {
    setIsFetching(true);
    setErrorMessage(null);
    try {
      const result = await locationService.getCurrentLocation();
      if (result.success && result.location) {
        setLocationData(result.location);
        setErrorMessage(null);
      } else {
        setErrorMessage(result.error || 'Unable to retrieve GPS coordinates.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error occurred while requesting GPS location.');
    } finally {
      setIsFetching(false);
    }
  };

  const getStatusBadgeConfig = () => {
    if (locationState === 'LOCATION_READY' && locationData) {
      const acc = locationData.accuracy ? ` (±${Math.round(locationData.accuracy)}m)` : '';
      return { label: `GPS Signal: Acquired${acc}`, status: 'active' as const };
    }
    if (locationState === 'GETTING_LOCATION' || isFetching) {
      return { label: 'GPS Signal: Acquiring Satellite Fix...', status: 'warning' as const };
    }
    if (locationState === 'REQUESTING_PERMISSION') {
      return { label: 'GPS: Verifying Permissions...', status: 'warning' as const };
    }
    if (locationState === 'LOCATION_ERROR' || errorMessage) {
      return { label: 'GPS Signal: Unavailable', status: 'emergency' as const };
    }
    return { label: 'GPS Signal: Standby', status: 'inactive' as const };
  };

  const badgeConfig = getStatusBadgeConfig();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <AppHeader
        title="Live Location"
        subtitle="GPS Emergency Coordinates"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Location Permission Warning */}
        {permissions.location !== 'granted' && (
          <TouchableOpacity
            style={styles.permWarningBanner}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Permissions')}
          >
            <Ionicons name="location-outline" size={22} color="#DC2626" />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.permWarningTitle}>Location Access Required</Text>
              <Text style={styles.permWarningSub}>
                GPS coordinates cannot be acquired or attached to emergency alerts without location permission. Tap to configure.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#DC2626" />
          </TouchableOpacity>
        )}

        {/* Map Visual Simulation Card */}
        <AppCard style={styles.mapCard}>
          <View style={styles.mapGridBackground}>
            <View style={styles.radarPulseOuter}>
              <View style={styles.radarPulseInner}>
                <View style={[
                  styles.markerPin,
                  locationState === 'LOCATION_READY'
                    ? { backgroundColor: Colors.success, shadowColor: Colors.success }
                    : locationState === 'LOCATION_ERROR'
                    ? { backgroundColor: Colors.danger, shadowColor: Colors.danger }
                    : { backgroundColor: Colors.primary, shadowColor: Colors.primary }
                ]}>
                  {isFetching ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="location" size={28} color="#FFFFFF" />
                  )}
                </View>
              </View>
            </View>
          </View>
          <View style={styles.mapFooter}>
            <StatusBadge label={badgeConfig.label} status={badgeConfig.status} size="sm" />
          </View>
        </AppCard>

        {/* Error message card if any */}
        {errorMessage && (
          <AppCard style={styles.errorCard}>
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          </AppCard>
        )}

        {/* Coordinates Metrics Card */}
        <Text style={styles.sectionTitle}>Current Location Details</Text>
        <AppCard>
          <View style={styles.metricRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Latitude</Text>
              <Text style={styles.metricValue}>
                {locationData
                  ? `${Math.abs(locationData.latitude).toFixed(4)}° ${locationData.latitude >= 0 ? 'N' : 'S'}`
                  : '—'}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Longitude</Text>
              <Text style={styles.metricValue}>
                {locationData
                  ? `${Math.abs(locationData.longitude).toFixed(4)}° ${locationData.longitude >= 0 ? 'E' : 'W'}`
                  : '—'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.metricRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Accuracy</Text>
              <Text style={styles.metricValue}>
                {locationData?.accuracy !== null && locationData?.accuracy !== undefined
                  ? `±${Math.round(locationData.accuracy)} meters`
                  : '—'}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Last Updated</Text>
              <Text style={styles.metricValue}>
                {locationData
                  ? new Date(locationData.timestamp).toLocaleTimeString()
                  : 'Not acquired'}
              </Text>
            </View>
          </View>

          <View style={styles.addressBox}>
            <Ionicons name="navigate-circle" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.addressText} numberOfLines={2}>
              {locationData
                ? `GPS Fix: ${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}`
                : 'Coordinates not yet acquired. Tap below to fetch live GPS fix.'}
            </Text>
          </View>
        </AppCard>

        {/* Privacy Note */}
        <View style={styles.privacyNoteBox}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.privacyNoteText}>
            Privacy Guaranteed: Continuous tracking is disabled. GPS location is retrieved on-demand only during emergencies or manual checks.
          </Text>
        </View>

        {/* Action Button */}
        <AppButton
          title={isFetching ? 'Acquiring GPS Position...' : (locationData ? 'Refresh GPS Coordinates' : 'Get Current Location')}
          variant="primary"
          size="lg"
          loading={isFetching}
          leftIcon={<Ionicons name="navigate-outline" size={18} color="#FFFFFF" />}
          onPress={handleFetchLocation}
          style={{ marginTop: 16 }}
        />
      </ScrollView>
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
    paddingTop: 16,
    paddingBottom: 24,
  },
  mapCard: {
    padding: 0,
    overflow: 'hidden',
    height: 220,
    borderRadius: 20,
    marginBottom: 16,
  },
  mapGridBackground: {
    flex: 1,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarPulseOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarPulseInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(2, 132, 199, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerPin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  mapFooter: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    marginLeft: 4,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  addressText: {
    fontSize: 12,
    color: '#1E40AF',
    flex: 1,
    fontWeight: '500',
  },
  permWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  permWarningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  permWarningSub: {
    fontSize: 11,
    color: '#7F1D1D',
    marginTop: 1,
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    marginBottom: 16,
    padding: 12,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    color: '#991B1B',
    flex: 1,
    fontWeight: '500',
  },
  privacyNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  privacyNoteText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
    lineHeight: 16,
  },
});