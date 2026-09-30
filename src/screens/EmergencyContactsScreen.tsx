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
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { AppHeader } from '../components/AppHeader';
import { AppCard } from '../components/AppCard';
import { AppButton } from '../components/AppButton';
import { EmergencyContact } from '../types';
import { contactService } from '../services/ContactService';
import { maskMobileNumber } from '../utils/validation';
import { Colors } from '../theme/colors';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const EmergencyContactsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    try {
      const list = await contactService.getContacts();
      setContacts(list);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload when screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadContacts();
    }, [loadContacts])
  );

  // Subscribe to contactService changes
  useEffect(() => {
    const unsub = contactService.subscribe(() => {
      loadContacts();
    });
    return () => unsub();
  }, [loadContacts]);

  const handleAddContact = () => {
    navigation.navigate('AddEditContact');
  };

  const handleEditContact = (contact: EmergencyContact) => {
    navigation.navigate('AddEditContact', { contactId: contact.contact_id });
  };

  const handleDeleteContact = (contact: EmergencyContact) => {
    Alert.alert(
      'Delete Emergency Contact?',
      `Are you sure you want to remove "${contact.name}" (${contact.relationship}) from your emergency contacts list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(contact.contact_id);
            try {
              const res = await contactService.deleteContact(contact.contact_id);
              if (!res.success) {
                Alert.alert('Error', res.error || 'Failed to delete contact.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'An unexpected error occurred.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <AppHeader
        title="Emergency Contacts"
        subtitle={
          loading
            ? 'Loading contacts...'
            : contacts.length === 1
            ? '1 emergency contact configured'
            : `${contacts.length} emergency contacts configured`
        }
        onBack={() => navigation.goBack()}
        rightElement={
          contacts.length > 0 ? (
            <TouchableOpacity
              style={styles.headerAddBtn}
              onPress={handleAddContact}
              activeOpacity={0.7}
              accessibilityLabel="Add Emergency Contact"
            >
              <Ionicons name="person-add-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons
            name="shield-checkmark"
            size={20}
            color={Colors.primary}
            style={{ marginRight: 10 }}
          />
          <Text style={styles.infoBannerText}>
            These trusted contacts will automatically receive your emergency alert and live GPS location
            when an emergency or distress sound is confirmed.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading your emergency contacts...</Text>
          </View>
        ) : contacts.length === 0 ? (
          /* Empty State (Requirement 13) */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="people-outline" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No emergency contacts added yet</Text>
            <Text style={styles.emptyDescription}>
              Add trusted family members or friends who can be notified immediately during an emergency.
            </Text>
            <AppButton
              title="+ Add Emergency Contact"
              variant="primary"
              size="md"
              onPress={handleAddContact}
              style={styles.emptyAddBtn}
            />
          </View>
        ) : (
          /* Contact Cards List */
          <View style={styles.contactsList}>
            {contacts.map((contact, index) => (
              <AppCard key={contact.contact_id} style={styles.contactCard}>
                <View style={styles.contactRow}>
                  <View style={styles.contactAvatar}>
                    <Ionicons name="person" size={22} color={Colors.primary} />
                  </View>

                  <View style={styles.contactInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.contactIndex}>{index + 1}. </Text>
                      <Text style={styles.contactName} numberOfLines={1}>
                        {contact.name}
                      </Text>
                    </View>

                    <Text style={styles.contactPhone}>
                      {maskMobileNumber(contact.mobile_number)}
                    </Text>

                    <View style={styles.relationPill}>
                      <Text style={styles.relationText}>{contact.relationship}</Text>
                    </View>
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleEditContact(contact)}
                      activeOpacity={0.7}
                      accessibilityLabel={`Edit contact ${contact.name}`}
                    >
                      <Ionicons name="pencil" size={18} color="#64748B" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, styles.deleteBtn]}
                      onPress={() => handleDeleteContact(contact)}
                      activeOpacity={0.7}
                      disabled={deletingId === contact.contact_id}
                      accessibilityLabel={`Delete contact ${contact.name}`}
                    >
                      {deletingId === contact.contact_id ? (
                        <ActivityIndicator size="small" color={Colors.danger} />
                      ) : (
                        <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </AppCard>
            ))}

            {/* Additional Add Button at bottom of list */}
            <TouchableOpacity
              style={styles.addMoreRow}
              onPress={handleAddContact}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={22} color={Colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.addMoreText}>+ Add Another Contact</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Prototype Scope Note */}
        <View style={styles.disclaimerContainer}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={styles.disclaimerText}>
            Phase 7 manages contacts in your local database. Emergency alert dispatch (SMS / Push notifications)
            will be activated in the upcoming emergency alert phase.
          </Text>
        </View>
      </ScrollView>

      {contacts.length > 0 && (
        <View style={styles.bottomSection}>
          <AppButton
            title="+ Add Emergency Contact"
            variant="primary"
            size="lg"
            onPress={handleAddContact}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerAddBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    marginBottom: 16,
  },
  infoBannerText: {
    fontSize: 12,
    color: '#1E40AF',
    flex: 1,
    lineHeight: 18,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginTop: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyAddBtn: {
    minWidth: 200,
  },
  contactsList: {
    marginBottom: 16,
  },
  contactCard: {
    marginVertical: 6,
    padding: 16,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactIndex: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  contactPhone: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  relationPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 6,
  },
  relationText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deleteBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
  addMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  addMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginTop: 12,
    marginBottom: 20,
  },
  disclaimerText: {
    fontSize: 11,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 16,
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