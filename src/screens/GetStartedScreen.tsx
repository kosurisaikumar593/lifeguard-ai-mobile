import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { ShieldLogo } from '../components/ShieldLogo';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { Colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'GetStarted'>;

export const GetStartedScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Top Header Branding */}
        <View style={styles.topHeader}>
          <ShieldLogo size="lg" />
          <Text style={styles.appName} accessibilityRole="header">LifeGuard AI</Text>
          <Text style={styles.tagline}>"Your Safety, Our Priority"</Text>
        </View>

        {/* Central Safety Concept Card */}
        <AppCard style={styles.conceptCard}>
          <View style={styles.illustrationWrapper}>
            <View style={styles.radarRingOuter}>
              <View style={styles.radarRingInner}>
                <View style={styles.shieldCenter}>
                  <Ionicons name="shield-checkmark" size={48} color={Colors.primary} />
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.summaryTitle}>AI-Powered Emergency Assistance</Text>
          <Text style={styles.summaryText}>
            An AI-based personal safety application that can detect distress sounds and
            assist with emergency alerts and location sharing.
          </Text>

          {/* Core Highlights */}
          <View style={styles.highlightsContainer}>
            <View style={styles.highlightRow}>
              <Ionicons name="mic-outline" size={18} color={Colors.primary} style={styles.highlightIcon} />
              <Text style={styles.highlightText}>Acoustic scream & distress sound analysis</Text>
            </View>
            <View style={styles.highlightRow}>
              <Ionicons name="location-outline" size={18} color={Colors.primary} style={styles.highlightIcon} />
              <Text style={styles.highlightText}>Real-time GPS emergency location dispatch</Text>
            </View>
            <View style={styles.highlightRow}>
              <Ionicons name="paper-plane-outline" size={18} color={Colors.primary} style={styles.highlightIcon} />
              <Text style={styles.highlightText}>Automated notifications to trusted contacts</Text>
            </View>
          </View>
        </AppCard>

        {/* Action Buttons */}
        <View style={styles.bottomSection}>
          <AppButton
            title="GET STARTED"
            onPress={() => navigation.navigate('Introduction')}
            size="lg"
            rightIcon={<Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
            accessibilityLabel="Get Started with LifeGuard AI Introduction"
          />
          <AppButton
            title="Already have an account? Login"
            variant="ghost"
            onPress={() => navigation.navigate('Login')}
            style={styles.loginGhostBtn}
            accessibilityLabel="Already have an account? Login"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    justifyContent: 'space-between',
    minHeight: '100%',
  },
  topHeader: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 12,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 14,
    color: Colors.primary,
    marginTop: 4,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  conceptCard: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginVertical: 10,
  },
  illustrationWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  radarRingOuter: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
  },
  radarRingInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shieldCenter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  highlightsContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  highlightIcon: {
    marginRight: 10,
  },
  highlightText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    flex: 1,
  },
  bottomSection: {
    marginTop: 20,
    marginBottom: 10,
  },
  loginGhostBtn: {
    marginTop: 6,
  },
});
