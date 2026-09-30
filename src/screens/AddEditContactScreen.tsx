import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { AppHeader } from '../components/AppHeader';
import { AppCard } from '../components/AppCard';
import { AppButton } from '../components/AppButton';
import { PhoneInput } from '../components/PhoneInput';
import { contactService } from '../services/ContactService';
import { Colors } from '../theme/colors';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'AddEditContact'>;

const RELATIONSHIP_OPTIONS = [
  'Parent',
  'Father',
  'Mother',
  'Brother',
  'Sister',
  'Spouse',
  'Friend',
  'Guardian',
  'Other',
];

export const AddEditContactScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();

  const contactId = route.params?.contactId;
  const isEditing = Boolean(contactId);

  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [relationship, setRelationship] = useState('');
  const [customRelationship, setCustomRelationship] = useState('');
  const [isCustomRelation, setIsCustomRelation] = useState(false);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load existing contact details if editing
  useEffect(() => {
    if (!contactId) return;

    let isMounted = true;
    (async () => {
      try {
        const contact = await contactService.getContactById(contactId);
        if (!isMounted) return;

        if (contact) {
          setName(contact.name);
          // Strip country code if present to extract national 10 digits
          const rawDigits = contact.mobile_number.replace(/\D/g, '');
          const tenDigits = rawDigits.startsWith('91') && rawDigits.length === 12
            ? rawDigits.substring(2)
            : rawDigits;
          setMobileNumber(tenDigits);

          if (RELATIONSHIP_OPTIONS.includes(contact.relationship)) {
            setRelationship(contact.relationship);
            setIsCustomRelation(false);
          } else {
            setRelationship('Other');
            setCustomRelationship(contact.relationship);
            setIsCustomRelation(true);
          }
        } else {
          Alert.alert('Error', 'Contact could not be found.', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        }
      } catch (err) {
        console.error('Failed to load contact:', err);
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [contactId, navigation]);

  const handleSelectRelationship = (option: string) => {
    setRelationship(option);
    if (option === 'Other') {
      setIsCustomRelation(true);
    } else {
      setIsCustomRelation(false);
      setCustomRelationship('');
    }
    setErrorMessage(null);
  };

  const handleSave = async () => {
    setErrorMessage(null);

    // Validation
    if (!name || name.trim().length === 0) {
      setErrorMessage('Please enter the contact full name.');
      return;
    }

    if (!mobileNumber || mobileNumber.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    const resolvedRelation = isCustomRelation ? customRelationship.trim() : relationship.trim();
    if (!resolvedRelation) {
      setErrorMessage('Please select or specify a relationship.');
      return;
    }

    setLoading(true);

    try {
      if (isEditing && contactId) {
        const result = await contactService.updateContact(contactId, {
          name: name.trim(),
          mobileNumber: mobileNumber.trim(),
          relationship: resolvedRelation,
        });

        if (!result.success) {
          setErrorMessage(result.error || 'Failed to update contact.');
          setLoading(false);
          return;
        }
      } else {
        const result = await contactService.addContact({
          name: name.trim(),
          mobileNumber: mobileNumber.trim(),
          relationship: resolvedRelation,
        });

        if (!result.success) {
          setErrorMessage(result.error || 'Failed to save contact.');
          setLoading(false);
          return;
        }
      }

      // Success -> Return to contacts list
      navigation.goBack();
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <AppHeader
        title={isEditing ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
        subtitle={isEditing ? 'Update contact information' : 'Add a trusted emergency contact'}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {errorMessage && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <AppCard style={styles.formCard}>
            {/* 1. Full Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color="#64748B"
                  style={styles.fieldIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Ramesh Kumar"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={(val) => {
                    setName(val);
                    setErrorMessage(null);
                  }}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* 2. Mobile Number (+91 fixed Indian Mobile) */}
            <View style={styles.fieldGroup}>
              <PhoneInput
                label="Mobile Number"
                value={mobileNumber}
                onChangeText={(val) => {
                  setMobileNumber(val);
                  setErrorMessage(null);
                }}
                placeholder="10-digit mobile number"
              />
              <Text style={styles.helperText}>
                Indian mobile format. Only 10 digits required (+91 will be prefixed automatically).
              </Text>
            </View>

            {/* 3. Relationship Selection */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Relationship</Text>
              <View style={styles.chipsContainer}>
                {RELATIONSHIP_OPTIONS.map((item) => {
                  const isSelected = relationship === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => handleSelectRelationship(item)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {isCustomRelation && (
                <View style={[styles.inputContainer, { marginTop: 12 }]}>
                  <Ionicons
                    name="heart-outline"
                    size={20}
                    color="#64748B"
                    style={styles.fieldIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Specify relationship (e.g. Cousin, Neighbor)"
                    placeholderTextColor="#94A3B8"
                    value={customRelationship}
                    onChangeText={(val) => {
                      setCustomRelationship(val);
                      setErrorMessage(null);
                    }}
                  />
                </View>
              )}
            </View>
          </AppCard>

          {/* Privacy & Safety Note */}
          <View style={styles.privacyNote}>
            <Ionicons name="lock-closed-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
            <Text style={styles.privacyNoteText}>
              Emergency contacts are stored securely and associated only with your account.
              No automated alerts or messages will be sent at this stage.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.bottomSection}>
        <AppButton
          title={isEditing ? 'Save Changes' : 'Save Contact'}
          variant="primary"
          size="lg"
          loading={loading || initialLoading}
          disabled={loading || initialLoading}
          onPress={handleSave}
        />
      </View>
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#B91C1C',
    flex: 1,
    lineHeight: 18,
  },
  formCard: {
    padding: 18,
    marginBottom: 16,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  fieldIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: 12,
  },
  helperText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 6,
    marginLeft: 4,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginTop: 4,
    marginBottom: 20,
  },
  privacyNoteText: {
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 16,
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
});
