import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, SafeAreaView, Dimensions } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { ShieldLogo } from '../components/ShieldLogo';
import { Colors } from '../theme/colors';

const { width } = Dimensions.get('window');

import { authService } from '../services/AuthService';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  useEffect(() => {
    let mounted = true;

    const initApp = async () => {
      // Initialize database and attempt session restoration
      try {
        await authService.init();
      } catch (e) {
        console.warn('Splash auth check notice:', e);
      }

      // Minimum splash visibility duration (1.8s) for smooth branding experience
      setTimeout(() => {
        if (!mounted) return;
        if (authService.isAuthenticated()) {
          navigation.replace('MainTabs');
        } else {
          navigation.replace('GetStarted');
        }
      }, 1800);
    };

    initApp();

    return () => {
      mounted = false;
    };
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A3F9C" />
      
      {/* Decorative background aura */}
      <View style={styles.backgroundAuraOuter}>
        <View style={styles.backgroundAuraInner} />
      </View>

      {/* Main Centered Branding */}
      <View style={styles.centerContent}>
        <View style={styles.shieldWrapper}>
          <ShieldLogo size="xl" inverted={true} />
        </View>

        <Text style={styles.appName} accessibilityRole="header">LifeGuard AI</Text>
        <Text style={styles.tagline}>"Your Safety, Our Priority"</Text>

        <View style={styles.safetyBadge}>
          <Ionicons name="shield-checkmark" size={14} color="#BFDBFE" style={{ marginRight: 6 }} />
          <Text style={styles.safetyBadgeText}>Personal Safety System</Text>
        </View>
      </View>

      {/* Bottom Visual Indicator */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Smart Acoustic Emergency Assistance</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A3F9C',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 40,
  },
  backgroundAuraOuter: {
    position: 'absolute',
    top: '30%',
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: (width * 0.9) / 2,
    backgroundColor: 'rgba(30, 96, 226, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundAuraInner: {
    width: width * 0.65,
    height: width * 0.65,
    borderRadius: (width * 0.65) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 2,
  },
  shieldWrapper: {
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  appName: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  tagline: {
    fontSize: 16,
    color: '#E0EDFF',
    marginTop: 8,
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  safetyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  safetyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E0EDFF',
    letterSpacing: 0.4,
  },
  footer: {
    alignItems: 'center',
    marginBottom: 16,
    zIndex: 2,
  },
  footerText: {
    fontSize: 12,
    color: '#93C5FD',
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
