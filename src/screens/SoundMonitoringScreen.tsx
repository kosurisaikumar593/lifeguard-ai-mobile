import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { AppHeader } from '../components/AppHeader';
import { AppCard } from '../components/AppCard';
import { StatusBadge } from '../components/StatusBadge';
import { AppButton } from '../components/AppButton';
import { permissionService } from '../services/PermissionService';
import { soundMonitoringService } from '../services/SoundMonitoringService';
import { audioCaptureService } from '../services/AudioCaptureService';
import { screamDetectionService } from '../services/ScreamDetectionService';
import { emergencyVerificationService } from '../services/EmergencyVerificationService';
import { whatsAppService } from '../services/WhatsAppService';
import {
  DetailedPermissionsState,
  MonitoringState,
  SoundLevelUpdate,
  CaptureState,
  ModelStatus,
  ScreamInferenceResult,
  LoudSoundEvent,
  AudioSample,
  VerificationState,
  VerificationResult,
} from '../types';
import { Colors } from '../theme/colors';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const SoundMonitoringScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [permissions, setPermissions] = useState<DetailedPermissionsState>(
    permissionService.getState()
  );
  const [monitoringState, setMonitoringState] = useState<MonitoringState>(
    soundMonitoringService.getState()
  );
  const [soundLevel, setSoundLevel] = useState<number>(
    soundMonitoringService.getCurrentLevel()
  );
  const [decibels, setDecibels] = useState<number>(
    soundMonitoringService.getCurrentDecibels()
  );
  const [isLoud, setIsLoud] = useState<boolean>(false);
  const [loudCount, setLoudCount] = useState<number>(0);
  const [captureState, setCaptureState] = useState<CaptureState>(
    audioCaptureService.getState()
  );
  const [modelStatus, setModelStatus] = useState<ModelStatus>(
    screamDetectionService.getModelStatus()
  );
  const [lastInference, setLastInference] = useState<ScreamInferenceResult | null>(
    screamDetectionService.getLastInferenceResult()
  );
  const [verificationState, setVerificationState] = useState<VerificationState>(
    emergencyVerificationService.getState()
  );
  const [lastVerification, setLastVerification] = useState<VerificationResult | null>(
    emergencyVerificationService.getLastResult()
  );
  const [loading, setLoading] = useState<boolean>(false);

  // Synchronize state with background/foreground service whenever screen regains focus
  useFocusEffect(
    useCallback(() => {
      soundMonitoringService.syncWithForegroundService().catch(() => {});
      setMonitoringState(soundMonitoringService.getState());
      setSoundLevel(soundMonitoringService.getCurrentLevel());
      setDecibels(soundMonitoringService.getCurrentDecibels());
    }, [])
  );

  useEffect(() => {
    // Initialize model status check
    screamDetectionService.initModel().catch(() => {});

    // 1. Permission subscription
    const unsubPerms = permissionService.subscribe((p) => setPermissions(p));
    permissionService.checkMicrophonePermission();

    // 2. Sound monitoring status subscription
    const unsubStatus = soundMonitoringService.subscribeStatus((state) => {
      setMonitoringState(state);
    });

    // 3. Sound level & decibel meter subscription
    const unsubLevel = soundMonitoringService.subscribeLevel((update: SoundLevelUpdate) => {
      setSoundLevel(update.normalizedLevel);
      setDecibels(update.decibels);
      setIsLoud(update.isLoud);
    });

    // 4. Loud sound event subscription: Triggers Phase 10 Audio Capture
    const unsubLoud = soundMonitoringService.onLoudSoundDetected((event: LoudSoundEvent) => {
      setLoudCount((prev) => prev + 1);
      audioCaptureService.captureTriggeredAudio(event).catch((err) => {
        console.warn('Audio capture trigger error:', err);
      });
    });

    // 5. Audio capture state subscription
    const unsubCapture = audioCaptureService.subscribeCaptureState((state) => {
      setCaptureState(state);
    });

    // 6. Audio sample handoff subscription: Triggers Phase 11 AI/ML Analysis and Phase 12 Verification
    const unsubSample = audioCaptureService.onAudioSampleCaptured((sample: AudioSample) => {
      screamDetectionService
        .analyzeAudio(sample)
        .then((result) => {
          emergencyVerificationService.verifyScreamEvent(sample, result).catch((err: any) => {
            console.warn('Emergency verification error:', err);
          });
        })
        .catch((err: any) => {
          console.warn('Scream detection error:', err);
        });
    });

    // 7. Model status subscription
    const unsubModel = screamDetectionService.subscribeModelStatus((status: ModelStatus) => {
      setModelStatus(status);
    });

    // 8. Inference completion subscription
    const unsubInference = screamDetectionService.onAnalysisComplete((result: ScreamInferenceResult) => {
      setLastInference(result);
    });

    // 9. Phase 12 Verification state subscription
    const unsubVerificationState = emergencyVerificationService.subscribeState((state: VerificationState) => {
      setVerificationState(state);
    });

    // 10. Phase 12 Verification result subscription
    const unsubVerificationResult = emergencyVerificationService.onVerificationCompleted((res: VerificationResult) => {
      setLastVerification(res);
    });


    return () => {
      unsubPerms();
      unsubStatus();
      unsubLevel();
      unsubLoud();
      unsubCapture();
      unsubSample();
      unsubModel();
      unsubInference();
      unsubVerificationState();
      unsubVerificationResult();
    };
  }, []);


  const handleToggleMonitoring = async () => {
    if (loading) return;

    if (soundMonitoringService.isMonitoringActive()) {
      setLoading(true);
      await soundMonitoringService.stopMonitoring();
      setLoading(false);
    } else {
      // Check microphone permission before starting
      if (permissions.microphone !== 'granted') {
        const req = await permissionService.requestMicrophonePermission();
        if (req.status !== 'granted') {
          Alert.alert(
            'Microphone Permission Required',
            'Sound monitoring requires microphone access to measure surrounding noise levels.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Manage Permissions', onPress: () => navigation.navigate('Permissions') },
            ]
          );
          return;
        }
      }

      setLoading(true);
      const result = await soundMonitoringService.startMonitoring();
      setLoading(false);

      if (!result.success) {
        Alert.alert('Monitoring Failed', result.error || 'Unable to start sound monitoring.');
      }
    }
  };

  const isMonitoring = soundMonitoringService.isMonitoringActive();
  const threshold = soundMonitoringService.getLoudSoundThreshold();

  // Waveform visualization bars dynamically computed from real-time level
  const baseMultipliers = [0.35, 0.55, 0.8, 1.0, 0.7, 0.45, 0.9, 1.15, 0.75, 0.5, 0.85, 0.6, 0.4];
  const waveformHeights = baseMultipliers.map((m) => {
    if (!isMonitoring) return 10;
    const computed = 12 + Math.min(88, soundLevel * 90 * m);
    return Math.round(computed);
  });

  const [whatsAppSending, setWhatsAppSending] = useState(false);

  const handleSendWhatsAppAlert = async () => {
    setWhatsAppSending(true);
    try {
      const res = await whatsAppService.dispatchWhatsAppAlert();
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

  const getSoundDetectedStatus = () => {
    if (isMonitoring && (decibels > 30 || soundLevel > 0.02)) {
      return {
        icon: 'checkmark-circle' as const,
        color: '#16A34A',
        label: '✓ Confirmed',
        status: 'active' as const,
        desc: `Acoustic audio input detected (${decibels} dB)`,
      };
    }
    return {
      icon: 'ellipse-outline' as const,
      color: '#94A3B8',
      label: '○ Waiting',
      status: 'inactive' as const,
      desc: isMonitoring ? 'Awaiting surrounding sound activity...' : 'Monitoring currently inactive',
    };
  };

  const getSoundThresholdStatus = () => {
    if (isMonitoring && decibels > 90.0) {
      return {
        icon: 'checkmark-circle' as const,
        color: '#DC2626',
        label: '✓ Confirmed',
        status: 'emergency' as const,
        desc: `High volume threshold reached (${decibels} dB > 90 dB)`,
      };
    }
    return {
      icon: 'ellipse-outline' as const,
      color: '#94A3B8',
      label: '○ Waiting',
      status: 'inactive' as const,
      desc: `Current level: ${decibels} dB (Strict trigger threshold: > 90 dB)`,
    };
  };

  const getHumanSoundStatus = () => {
    if (lastInference?.humanSoundStatus === 'HUMAN_DETECTED' || lastInference?.isHumanSound === true) {
      return {
        icon: 'checkmark-circle' as const,
        color: '#16A34A',
        label: '✓ Confirmed',
        status: 'active' as const,
        desc: 'Human vocal characteristics detected (voice / shout / scream)',
      };
    }
    if ((monitoringState === 'LOUD_SOUND_DETECTED' || captureState === 'CAPTURING' || modelStatus === 'ANALYZING') && decibels > 90.0) {
      return {
        icon: 'sync-outline' as const,
        color: '#D97706',
        label: '⟳ Checking',
        status: 'warning' as const,
        desc: 'Checking human sound vs environmental noise...',
      };
    }
    if (lastInference?.humanSoundStatus === 'ENVIRONMENTAL_SOUND' || lastInference?.classification === 'ENVIRONMENTAL') {
      return {
        icon: 'close-circle' as const,
        color: '#DC2626',
        label: '✗ Not detected',
        status: 'emergency' as const,
        desc: 'Human sound not detected (Environmental sound: horn/slam/noise)',
      };
    }
    if (modelStatus === 'MODEL_NOT_FOUND' || lastInference?.humanSoundStatus === 'ANALYSIS_UNAVAILABLE') {
      return {
        icon: 'alert-circle' as const,
        color: '#D97706',
        label: '⚠ Analysis unavailable',
        status: 'warning' as const,
        desc: 'Human sound analysis unavailable (AI model unavailable)',
      };
    }
    return {
      icon: 'ellipse-outline' as const,
      color: '#94A3B8',
      label: '○ Waiting',
      status: 'inactive' as const,
      desc: 'Awaiting sound exceeding 90 dB',
    };
  };

  const getDistressScreamStatus = () => {
    if (lastInference?.isDistressScream === true) {
      return {
        icon: 'checkmark-circle' as const,
        color: '#DC2626',
        label: '✓ Confirmed',
        status: 'emergency' as const,
        desc: 'Distress scream signature detected',
      };
    }
    if (modelStatus === 'ANALYZING' && (lastInference?.isHumanSound === true || lastInference?.humanSoundStatus === 'HUMAN_DETECTED')) {
      return {
        icon: 'sync-outline' as const,
        color: '#D97706',
        label: '⟳ Checking',
        status: 'warning' as const,
        desc: 'Checking distress scream probability...',
      };
    }
    if (lastInference?.isHumanSound === true && !lastInference?.isDistressScream) {
      return {
        icon: 'close-circle' as const,
        color: '#64748B',
        label: '✗ Not detected',
        status: 'inactive' as const,
        desc: 'Normal human sound (no distress scream detected)',
      };
    }
    if (modelStatus === 'MODEL_NOT_FOUND' || lastInference?.analysisStatus === 'MODEL_MISSING') {
      return {
        icon: 'alert-circle' as const,
        color: '#D97706',
        label: '⚠ Analysis unavailable',
        status: 'warning' as const,
        desc: 'AI model unavailable (TFLite weights required)',
      };
    }
    return {
      icon: 'ellipse-outline' as const,
      color: '#94A3B8',
      label: '○ Waiting',
      status: 'inactive' as const,
      desc: 'Awaiting human sound trigger',
    };
  };

  const getEmergencyVerifiedStatus = () => {
    if (lastVerification?.status === 'CONFIRMED_EMERGENCY') {
      return {
        icon: 'shield-checkmark' as const,
        color: '#DC2626',
        label: '✓ Confirmed',
        status: 'emergency' as const,
        desc: `Emergency verified (${lastVerification.durationMs}ms duration)`,
      };
    }
    if (verificationState === 'VERIFYING') {
      return {
        icon: 'hourglass-outline' as const,
        color: '#D97706',
        label: '⟳ Checking',
        status: 'warning' as const,
        desc: 'Verifying duration and false-alarm criteria...',
      };
    }
    if (lastVerification?.status === 'UNCONFIRMED_EVENT') {
      return {
        icon: 'close-circle' as const,
        color: '#64748B',
        label: '✗ Not detected',
        status: 'inactive' as const,
        desc: lastVerification.reason || 'Event filtered: not confirmed',
      };
    }
    if (modelStatus === 'MODEL_NOT_FOUND' && !lastVerification) {
      return {
        icon: 'alert-circle' as const,
        color: '#D97706',
        label: '⚠ Analysis unavailable',
        status: 'warning' as const,
        desc: 'Awaiting trained model verification',
      };
    }
    return {
      icon: 'ellipse-outline' as const,
      color: '#94A3B8',
      label: '○ Waiting',
      status: 'inactive' as const,
      desc: 'Awaiting verified acoustic trigger',
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <AppHeader
        title="Sound Monitoring"
        subtitle="Real-time Acoustic Analysis"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Status Badge Banner */}
        <View style={styles.statusRow}>
          <StatusBadge
            label={
              captureState === 'CAPTURING'
                ? 'Capturing Audio...'
                : modelStatus === 'ANALYZING'
                ? 'Analyzing Audio...'
                : monitoringState === 'MONITORING'
                ? 'Actively Monitoring'
                : monitoringState === 'LOUD_SOUND_DETECTED'
                ? 'Loud Sound Detected'
                : monitoringState === 'ERROR'
                ? 'Monitoring Error'
                : 'Monitoring Off'
            }
            status={
              captureState === 'CAPTURING'
                ? 'emergency'
                : modelStatus === 'ANALYZING'
                ? 'warning'
                : monitoringState === 'MONITORING'
                ? 'active'
                : monitoringState === 'LOUD_SOUND_DETECTED'
                ? 'warning'
                : 'inactive'
            }
            size="md"
          />

          {/* Environment Detection Badge */}
          <View
            style={[
              styles.envBadge,
              captureState === 'CAPTURING'
                ? styles.envBadgeCapture
                : monitoringState === 'LOUD_SOUND_DETECTED'
                ? styles.envBadgeLoud
                : isMonitoring
                ? styles.envBadgeNormal
                : styles.envBadgeInactive,
            ]}
          >
            <Ionicons
              name={
                captureState === 'CAPTURING'
                  ? 'radio'
                  : monitoringState === 'LOUD_SOUND_DETECTED'
                  ? 'alert-circle'
                  : isMonitoring
                  ? 'checkmark-circle'
                  : 'pause-circle'
              }
              size={14}
              color={
                captureState === 'CAPTURING'
                  ? '#DC2626'
                  : monitoringState === 'LOUD_SOUND_DETECTED'
                  ? '#DC2626'
                  : isMonitoring
                  ? '#16A34A'
                  : '#64748B'
              }
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.envBadgeText,
                {
                  color:
                    captureState === 'CAPTURING'
                      ? '#DC2626'
                      : monitoringState === 'LOUD_SOUND_DETECTED'
                      ? '#DC2626'
                      : isMonitoring
                      ? '#16A34A'
                      : '#64748B',
                },
              ]}
            >
              {captureState === 'CAPTURING'
                ? 'Capturing Sample'
                : monitoringState === 'LOUD_SOUND_DETECTED'
                ? 'Loud Sound'
                : isMonitoring
                ? 'Normal'
                : 'Standby'}
            </Text>
          </View>
        </View>

        {/* Prominent Always-Visible Emergency SOS Button */}
        <TouchableOpacity
          style={styles.sosBannerButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('ManualSOS')}
          accessibilityRole="button"
          accessibilityLabel="Emergency SOS button"
        >
          <View style={styles.sosBannerContent}>
            <View style={styles.sosIconCircle}>
              <Ionicons name="warning" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.sosBannerTitle}>EMERGENCY SOS</Text>
              <Text style={styles.sosBannerSubtitle}>Tap to immediately trigger emergency alert</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* Microphone Permission Warning if Missing */}
        {permissions.microphone !== 'granted' && (
          <TouchableOpacity
            style={styles.permWarningBanner}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Permissions')}
          >
            <Ionicons name="mic-off" size={22} color="#DC2626" />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.permWarningTitle}>Microphone Access Required</Text>
              <Text style={styles.permWarningSub}>
                Surrounding sound monitoring cannot measure audio activity without microphone access. Tap to configure.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#DC2626" />
          </TouchableOpacity>
        )}

        {/* Real-time Waveform & Audio Meter Card */}
        <AppCard style={styles.waveformCard}>
          <View style={styles.waveformVisual}>
            {waveformHeights.map((height, idx) => (
              <View
                key={idx}
                style={[
                  styles.waveformBar,
                  {
                    height,
                    backgroundColor: !isMonitoring
                      ? '#CBD5E1'
                      : isLoud || captureState === 'CAPTURING'
                      ? '#DC2626'
                      : Colors.primary,
                  },
                ]}
              />
            ))}
          </View>

          <Text style={styles.listeningText}>
            {captureState === 'CAPTURING'
              ? 'Capturing 2.5s temporary audio sample...'
              : modelStatus === 'ANALYZING'
              ? 'Processing acoustic frames for AI classification...'
              : monitoringState === 'LOUD_SOUND_DETECTED'
              ? 'Loud sound detected above threshold!'
              : isMonitoring
              ? 'Actively measuring surrounding sound levels...'
              : 'Sound monitoring is paused'}
          </Text>

          {/* Level & dB Readout */}
          <View style={styles.meterValuesRow}>
            <View style={styles.meterStatBox}>
              <Text style={styles.meterStatLabel}>ACTIVITY LEVEL</Text>
              <Text
                style={[
                  styles.meterStatNumber,
                  { color: isLoud ? '#DC2626' : Colors.textPrimary },
                ]}
              >
                {soundLevel.toFixed(2)}
              </Text>
              <Text style={styles.meterStatUnit}>normalized (0-1)</Text>
            </View>

            <View style={styles.dividerVertical} />

            <View style={styles.meterStatBox}>
              <Text style={styles.meterStatLabel}>SOUND LEVEL</Text>
              <Text
                style={[
                  styles.meterStatNumber,
                  { color: isLoud ? '#DC2626' : Colors.primary },
                ]}
              >
                {decibels} dB
              </Text>
              <Text style={styles.meterStatUnit}>approx. dB SPL</Text>
            </View>

            <View style={styles.dividerVertical} />

            <View style={styles.meterStatBox}>
              <Text style={styles.meterStatLabel}>LOUD TRIGGERS</Text>
              <Text style={styles.meterStatNumber}>{loudCount}</Text>
              <Text style={styles.meterStatUnit}>this session</Text>
            </View>
          </View>

          {/* Threshold Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressHeaderRow}>
              <Text style={styles.progressLabel}>Current Activity</Text>
              <Text style={styles.progressThresholdLabel}>
                Threshold: {(threshold * 100).toFixed(0)}%
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(100, Math.round(soundLevel * 100))}%`,
                    backgroundColor: isLoud ? '#DC2626' : Colors.primary,
                  },
                ]}
              />
              {/* Threshold indicator line */}
              <View
                style={[
                  styles.thresholdMarker,
                  { left: `${Math.round(threshold * 100)}%` },
                ]}
              />
            </View>
          </View>
        </AppCard>

        {/* Monitoring Control Button */}
        <AppButton
          title={isMonitoring ? 'Stop Sound Monitoring' : 'Start Sound Monitoring'}
          variant={isMonitoring ? 'danger' : 'primary'}
          size="lg"
          loading={loading}
          onPress={handleToggleMonitoring}
          leftIcon={
            <Ionicons
              name={isMonitoring ? 'mic-off' : 'mic'}
              size={20}
              color="#FFFFFF"
            />
          }
          style={{ marginTop: 14 }}
        />

        {/* AI Acoustic Analysis Output Card */}
        {lastInference && (
          <AppCard
            style={[
              styles.analysisCard,
              lastInference.classification === 'SCREAM'
                ? styles.analysisCardDanger
                : lastInference.classification === 'NON_SCREAM'
                ? styles.analysisCardSafe
                : styles.analysisCardNeutral,
            ]}
          >
            <View style={styles.analysisHeaderRow}>
              <Ionicons
                name={
                  lastInference.classification === 'SCREAM'
                    ? 'alert-circle'
                    : lastInference.classification === 'NON_SCREAM'
                    ? 'checkmark-circle'
                    : 'information-circle'
                }
                size={22}
                color={
                  lastInference.classification === 'SCREAM'
                    ? '#DC2626'
                    : lastInference.classification === 'NON_SCREAM'
                    ? '#16A34A'
                    : Colors.primary
                }
              />
              <Text style={styles.analysisTitle}>AI Acoustic Analysis</Text>
              <StatusBadge
                label={
                  lastInference.classification === 'SCREAM'
                    ? 'SCREAM'
                    : lastInference.classification === 'NON_SCREAM'
                    ? 'NORMAL'
                    : 'PRIMED'
                }
                status={
                  lastInference.classification === 'SCREAM'
                    ? 'emergency'
                    : lastInference.classification === 'NON_SCREAM'
                    ? 'active'
                    : 'info'
                }
                size="sm"
              />
            </View>

            <Text style={styles.analysisResultText}>
              {lastInference.classification === 'SCREAM'
                ? 'Potential distress scream detected.'
                : lastInference.classification === 'NON_SCREAM'
                ? 'No distress scream detected.'
                : 'Acoustic sample captured. Awaiting trained AI model artifact.'}
            </Text>

            <View style={styles.analysisMetaRow}>
              <Text style={styles.analysisMetaLabel}>Sample Duration: {lastInference.durationMs}ms</Text>
              {lastInference.confidence !== undefined && (
                <Text style={styles.analysisMetaLabel}>
                  Confidence: {(lastInference.confidence * 100).toFixed(0)}%
                </Text>
              )}
            </View>

            {lastInference.errorMessage && (
              <Text style={styles.analysisNote}>{lastInference.errorMessage}</Text>
            )}
          </AppCard>
        )}

        {/* Phase 12 False-Alarm & Duration Verification Output Card */}
        {(lastVerification || verificationState === 'VERIFYING') && (
          <AppCard
            style={[
              styles.analysisCard,
              verificationState === 'VERIFYING'
                ? styles.analysisCardNeutral
                : lastVerification?.status === 'CONFIRMED_EMERGENCY'
                ? styles.analysisCardDanger
                : styles.analysisCardSafe,
            ]}
          >
            <View style={styles.analysisHeaderRow}>
              <Ionicons
                name={
                  verificationState === 'VERIFYING'
                    ? 'hourglass-outline'
                    : lastVerification?.status === 'CONFIRMED_EMERGENCY'
                    ? 'warning'
                    : 'shield-checkmark'
                }
                size={22}
                color={
                  verificationState === 'VERIFYING'
                    ? Colors.primary
                    : lastVerification?.status === 'CONFIRMED_EMERGENCY'
                    ? '#DC2626'
                    : '#16A34A'
                }
              />
              <Text style={styles.analysisTitle}>Duration & False-Alarm Verification</Text>
              <StatusBadge
                label={
                  verificationState === 'VERIFYING'
                    ? 'VERIFYING'
                    : lastVerification?.status === 'CONFIRMED_EMERGENCY'
                    ? 'CONFIRMED'
                    : lastVerification?.status === 'UNCONFIRMED_EVENT'
                    ? 'FILTERED'
                    : 'ERROR'
                }
                status={
                  verificationState === 'VERIFYING'
                    ? 'warning'
                    : lastVerification?.status === 'CONFIRMED_EMERGENCY'
                    ? 'emergency'
                    : 'active'
                }
                size="sm"
              />
            </View>

            <Text style={styles.analysisResultText}>
              {verificationState === 'VERIFYING'
                ? 'VERIFYING EVENT...'
                : lastVerification?.status === 'CONFIRMED_EMERGENCY'
                ? 'DISTRESS EVENT CONFIRMED'
                : 'EVENT NOT CONFIRMED'}
            </Text>

            {lastVerification?.reason && (
              <Text style={styles.analysisNote}>{lastVerification.reason}</Text>
            )}

            {lastVerification && (
              <View style={styles.analysisMetaRow}>
                <Text style={styles.analysisMetaLabel}>
                  Verified Duration: {lastVerification.durationMs}ms (Min: {emergencyVerificationService.getConfig().minDurationMs}ms)
                </Text>
                {lastVerification.confidence !== undefined && (
                  <Text style={styles.analysisMetaLabel}>
                    Model Confidence: {(lastVerification.confidence * 100).toFixed(0)}%
                  </Text>
                )}
              </View>
            )}
          </AppCard>
        )}

        {/* Dynamic 5-Step LIVE SOUND CHECK Checklist */}
        <Text style={styles.sectionHeader}>LIVE SOUND CHECK</Text>
        <AppCard style={styles.checklistCard}>
          {/* 1. Sound detected */}
          {(() => {
            const item = getSoundDetectedStatus();
            return (
              <View style={styles.checklistItemRow}>
                <View style={[styles.checklistIconCircle, item.status === 'active' ? styles.circleActive : styles.circleInactive]}>
                  <Ionicons name={item.icon} size={22} color={item.color} />
                </View>
                <View style={styles.checklistTextContainer}>
                  <Text style={styles.checklistTitle}>1. Sound Detected</Text>
                  <Text style={styles.checklistDesc}>{item.desc}</Text>
                </View>
                <StatusBadge label={item.label} status={item.status} size="sm" />
              </View>
            );
          })()}

          <View style={styles.checklistDivider} />

          {/* 2. Sound level > 90 dB */}
          {(() => {
            const item = getSoundThresholdStatus();
            return (
              <View style={styles.checklistItemRow}>
                <View style={[styles.checklistIconCircle, item.status === 'emergency' ? styles.circleDanger : styles.circleInactive]}>
                  <Ionicons name={item.icon} size={22} color={item.color} />
                </View>
                <View style={styles.checklistTextContainer}>
                  <Text style={styles.checklistTitle}>2. Sound Level &gt; 90 dB</Text>
                  <Text style={styles.checklistDesc}>{item.desc}</Text>
                </View>
                <StatusBadge label={item.label} status={item.status} size="sm" />
              </View>
            );
          })()}

          <View style={styles.checklistDivider} />

          {/* 3. Human sound detected */}
          {(() => {
            const item = getHumanSoundStatus();
            return (
              <View style={styles.checklistItemRow}>
                <View
                  style={[
                    styles.checklistIconCircle,
                    item.status === 'active'
                      ? styles.circleActive
                      : item.status === 'emergency'
                      ? styles.circleDanger
                      : item.status === 'warning'
                      ? styles.circleWarning
                      : styles.circleNeutral,
                  ]}
                >
                  <Ionicons name={item.icon} size={22} color={item.color} />
                </View>
                <View style={styles.checklistTextContainer}>
                  <Text style={styles.checklistTitle}>3. Human Sound Detected</Text>
                  <Text style={styles.checklistDesc}>{item.desc}</Text>
                </View>
                <StatusBadge label={item.label} status={item.status} size="sm" />
              </View>
            );
          })()}

          <View style={styles.checklistDivider} />

          {/* 4. Distress / scream detected */}
          {(() => {
            const item = getDistressScreamStatus();
            return (
              <View style={styles.checklistItemRow}>
                <View
                  style={[
                    styles.checklistIconCircle,
                    item.status === 'emergency'
                      ? styles.circleDanger
                      : item.status === 'warning'
                      ? styles.circleWarning
                      : styles.circleNeutral,
                  ]}
                >
                  <Ionicons name={item.icon} size={22} color={item.color} />
                </View>
                <View style={styles.checklistTextContainer}>
                  <Text style={styles.checklistTitle}>4. Distress / Scream Detected</Text>
                  <Text style={styles.checklistDesc}>{item.desc}</Text>
                </View>
                <StatusBadge label={item.label} status={item.status} size="sm" />
              </View>
            );
          })()}

          <View style={styles.checklistDivider} />

          {/* 5. Emergency verified */}
          {(() => {
            const item = getEmergencyVerifiedStatus();
            return (
              <View style={styles.checklistItemRow}>
                <View
                  style={[
                    styles.checklistIconCircle,
                    item.status === 'emergency'
                      ? styles.circleDanger
                      : item.status === 'warning'
                      ? styles.circleWarning
                      : styles.circleInactive,
                  ]}
                >
                  <Ionicons name={item.icon} size={22} color={item.color} />
                </View>
                <View style={styles.checklistTextContainer}>
                  <Text style={styles.checklistTitle}>5. Emergency Verified</Text>
                  <Text style={styles.checklistDesc}>{item.desc}</Text>
                </View>
                <StatusBadge label={item.label} status={item.status} size="sm" />
              </View>
            );
          })()}
        </AppCard>

        {/* WhatsApp Emergency Alert Action Card (Shows when emergency verified) */}
        {lastVerification?.status === 'CONFIRMED_EMERGENCY' && (
          <AppCard style={[styles.analysisCard, styles.analysisCardDanger, { marginTop: 12 }]}>
            <View style={styles.analysisHeaderRow}>
              <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
              <Text style={[styles.analysisTitle, { color: '#0F172A', marginLeft: 8 }]}>WhatsApp Emergency Dispatch</Text>
              <StatusBadge label="VERIFIED" status="emergency" size="sm" />
            </View>
            <Text style={[styles.analysisResultText, { marginTop: 6 }]}>
              Acoustic emergency verified. Ready to dispatch alert with GPS coordinates to configured emergency contacts via WhatsApp.
            </Text>
            <AppButton
              title="Share Alert via WhatsApp"
              variant="primary"
              size="md"
              loading={whatsAppSending}
              onPress={handleSendWhatsAppAlert}
              leftIcon={<Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />}
              style={{ marginTop: 12, backgroundColor: '#25D366' }}
              accessibilityLabel="Share emergency alert on WhatsApp with contacts"
            />
          </AppCard>
        )}


        {/* Strict Privacy Guarantee Banner */}
        <AppCard style={styles.privacyCard}>
          <View style={styles.privacyHeader}>
            <Ionicons name="shield-checkmark" size={20} color="#15803D" style={{ marginRight: 8 }} />
            <Text style={styles.privacyTitle}>Strict Privacy Architecture</Text>
          </View>
          <Text style={styles.privacyBody}>
            Surrounding audio is monitored in volatile memory. When triggered, only a short 2.5-second buffer is temporarily captured for AI analysis and immediately purged. Audio is NEVER permanently recorded, stored in database, or uploaded.
          </Text>
        </AppCard>

        {/* Emergency Manual SOS Link */}
        <AppButton
          title="Open Emergency Manual SOS"
          variant="outline"
          onPress={() => navigation.navigate('ManualSOS')}
          size="md"
          leftIcon={<Ionicons name="alert-circle-outline" size={18} color={Colors.primary} />}
          style={{ marginTop: 14 }}
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
    paddingBottom: 28,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  envBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  envBadgeNormal: {
    backgroundColor: '#DCFCE7',
  },
  envBadgeLoud: {
    backgroundColor: '#FEE2E2',
  },
  envBadgeCapture: {
    backgroundColor: '#FEE2E2',
  },
  envBadgeInactive: {
    backgroundColor: '#F1F5F9',
  },
  envBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  waveformCard: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  waveformVisual: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 90,
    width: '100%',
    paddingHorizontal: 8,
  },
  waveformBar: {
    width: 8,
    borderRadius: 4,
    marginHorizontal: 3,
  },
  listeningText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 14,
    textAlign: 'center',
  },
  meterValuesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    marginTop: 18,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  meterStatBox: {
    alignItems: 'center',
    flex: 1,
  },
  meterStatLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  meterStatNumber: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  meterStatUnit: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  dividerVertical: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0',
  },
  progressContainer: {
    width: '100%',
    marginTop: 16,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  progressThresholdLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  thresholdMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#DC2626',
  },
  analysisCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  analysisCardDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  analysisCardSafe: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  analysisCardNeutral: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  analysisHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  analysisTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    flex: 1,
    marginLeft: 8,
  },
  analysisResultText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  analysisMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  analysisMetaLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  analysisNote: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 4,
  },
  sosBannerButton: {
    backgroundColor: '#DC2626',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
    elevation: 3,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  sosBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sosIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosBannerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  sosBannerSubtitle: {
    color: '#FEE2E2',
    fontSize: 11,
    marginTop: 1,
    fontWeight: '600',
  },
  checklistCard: {
    padding: 16,
  },
  checklistItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checklistIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleActive: {
    backgroundColor: '#DCFCE7',
  },
  circleDanger: {
    backgroundColor: '#FEE2E2',
  },
  circleWarning: {
    backgroundColor: '#FEF3C7',
  },
  circleNeutral: {
    backgroundColor: '#F1F5F9',
  },
  circleInactive: {
    backgroundColor: '#F8FAFC',
  },
  checklistTextContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  checklistTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  checklistDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
    marginTop: 2,
  },
  checklistDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
    marginLeft: 48,
  },
  privacyCard: {
    marginTop: 14,
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    padding: 14,
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  privacyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  privacyBody: {
    fontSize: 11,
    color: '#166534',
    lineHeight: 16,
  },
  permWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
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
});
