import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { ShieldLogo } from '../components/ShieldLogo';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { StatusBadge } from '../components/StatusBadge';
import { Colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Introduction'>;

interface OnboardingSlide {
  pageNumber: number;
  badge: string;
  badgeStatus: 'active' | 'info' | 'warning';
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  description: string;
  capabilities: string[];
}

export const IntroductionScreen: React.FC<Props> = ({ navigation }) => {
  const [currentPage, setCurrentPage] = useState<number>(0);

  const slides: OnboardingSlide[] = [
    {
      pageNumber: 1,
      badge: 'OBJECTIVE 1 & 2',
      badgeStatus: 'info',
      icon: 'mic',
      iconBg: '#EFF6FF',
      iconColor: Colors.primary,
      title: 'AI-Based Scream Detection',
      subtitle: 'Distress Sound Identification',
      description:
        'The application monitors surrounding sound using the mobile microphone and uses AI/ML acoustic analysis to identify distress screams, differentiating them from normal environmental noise.',
      capabilities: [
        'Acoustic feature extraction (MFCC & frequency analysis)',
        'Classifies screams vs normal ambient sounds',
        'Duration verification to prevent false alarms',
        'Privacy-first: No continuous or permanent audio storage',
      ],
    },
    {
      pageNumber: 2,
      badge: 'OBJECTIVE 3 & 4',
      badgeStatus: 'warning',
      icon: 'notifications',
      iconBg: '#FEF2F2',
      iconColor: Colors.danger,
      title: 'Emergency Alert Notification',
      subtitle: 'Automated Contact Dispatch',
      description:
        'After confirmed emergency detection or manual SOS activation, the application immediately initiates an emergency alert to your predefined trusted emergency contacts.',
      capabilities: [
        'Instant alert delivery to up to 3 predefined contacts',
        'Automated assistance when manual activation is impossible',
        'Maintains detailed emergency incident records in database',
        'Clear confirmation status during the alert process',
      ],
    },
    {
      pageNumber: 3,
      badge: 'OBJECTIVE 3 & 5',
      badgeStatus: 'active',
      icon: 'location',
      iconBg: '#ECFDF5',
      iconColor: Colors.success,
      title: 'Live Location Tracking',
      subtitle: 'Emergency GPS Coordinates',
      description:
        'During an emergency, the system retrieves your current real-time GPS location (latitude, longitude, accuracy) and includes it in the emergency alert response.',
      capabilities: [
        'Real-time GPS coordinate acquisition during incidents',
        'Attaches live location details directly to contact alerts',
        'Stores incident coordinates securely in history',
        'Reduces critical emergency response time',
      ],
    },
  ];

  const currentSlide = slides[currentPage];

  const handleNext = () => {
    if (currentPage < slides.length - 1) {
      setCurrentPage((prev) => prev + 1);
    } else {
      navigation.replace('Login');
    }
  };

  const handleBack = () => {
    if (currentPage > 0) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    navigation.replace('Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Bar: Brand, Page Indicator, and Skip Button */}
      <View style={styles.topBar}>
        <View style={styles.topBrand}>
          <ShieldLogo size="sm" />
          <Text style={styles.brandTitle}>LifeGuard AI</Text>
        </View>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          accessibilityLabel="Skip introduction and proceed to login"
          accessibilityRole="button"
        >
          <Text style={styles.skipText}>Skip</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Main Slide Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Badge & Step */}
        <View style={styles.badgeRow}>
          <StatusBadge
            label={currentSlide.badge}
            status={currentSlide.badgeStatus}
            size="sm"
          />
          <Text style={styles.stepText}>Page {currentPage + 1} of {slides.length}</Text>
        </View>

        {/* Feature Visual Hero Card */}
        <AppCard style={styles.heroCard}>
          <View style={[styles.heroIconCircle, { backgroundColor: currentSlide.iconBg }]}>
            <Ionicons name={currentSlide.icon} size={48} color={currentSlide.iconColor} />
          </View>
          <Text style={styles.slideTitle}>{currentSlide.title}</Text>
          <Text style={styles.slideSubtitle}>{currentSlide.subtitle}</Text>
          <Text style={styles.slideDescription}>{currentSlide.description}</Text>
        </AppCard>

        {/* Capabilities Checklist */}
        <View style={styles.capabilitiesContainer}>
          <Text style={styles.capabilitiesHeader}>System Capabilities</Text>
          {currentSlide.capabilities.map((cap, idx) => (
            <View key={idx} style={styles.capabilityRow}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={Colors.primary}
                style={styles.checkIcon}
              />
              <Text style={styles.capabilityText}>{cap}</Text>
            </View>
          ))}
        </View>

        {/* Prototype Scope Limitation Disclaimer */}
        <View style={styles.scopeNoticeBox}>
          <Ionicons
            name="shield-outline"
            size={16}
            color="#64748B"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.scopeNoticeText}>
            LifeGuard AI is an automated safety-assistance prototype. Does not replace human
            judgment or communicate directly with police services.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Navigation & Pagination Bar */}
      <View style={styles.bottomBar}>
        {/* Interactive Pagination Dots */}
        <View style={styles.paginationDots}>
          {slides.map((_, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => setCurrentPage(idx)}
              style={[
                styles.dot,
                currentPage === idx ? styles.activeDot : styles.inactiveDot,
              ]}
              accessibilityLabel={"Go to onboarding page " + (idx + 1)}
            />
          ))}
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionButtonsRow}>
          {currentPage > 0 ? (
            <AppButton
              title="Back"
              variant="outline"
              size="md"
              onPress={handleBack}
              leftIcon={<Ionicons name="arrow-back" size={16} color={Colors.primary} />}
              style={styles.backButton}
              accessibilityLabel="Go to previous page"
            />
          ) : (
            <View style={{ flex: 0.3 }} />
          )}

          <AppButton
            title={currentPage === slides.length - 1 ? 'Continue' : 'Next'}
            variant="primary"
            size="md"
            onPress={handleNext}
            rightIcon={
              <Ionicons
                name={currentPage === slides.length - 1 ? 'checkmark' : 'arrow-forward'}
                size={16}
                color="#FFFFFF"
              />
            }
            style={styles.nextButton}
            accessibilityLabel={
              currentPage === slides.length - 1
                ? 'Finish onboarding and continue to login'
                : 'Go to next onboarding page'
            }
          />
        </View>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  topBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginLeft: 8,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: Colors.primaryGhost,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    marginRight: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  heroCard: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginVertical: 4,
  },
  heroIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  slideTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  slideSubtitle: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  slideDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 10,
    paddingHorizontal: 6,
  },
  capabilitiesContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  capabilitiesHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  capabilityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 5,
  },
  checkIcon: {
    marginRight: 10,
    marginTop: 1,
  },
  capabilityText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 18,
    fontWeight: '500',
  },
  scopeNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    padding: 10,
    borderRadius: 12,
    marginTop: 14,
  },
  scopeNoticeText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: Colors.primary,
  },
  inactiveDot: {
    width: 8,
    backgroundColor: '#CBD5E1',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flex: 0.35,
    marginRight: 10,
  },
  nextButton: {
    flex: 0.6,
  },
});
