import React, { useState, useEffect } from 'react';
import { UserProfile, EmergencyContact, GPSLocation, AppAlertPayload } from '../types';
import { cloudStorageService } from '../services/CloudStorageService';
import { emergencyAlertService } from '../services/EmergencyAlertService';
import { geolocationService } from '../services/GeolocationService';

interface EmergencyContactsViewProps {
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
}

export const EmergencyContactsView: React.FC<EmergencyContactsViewProps> = ({
  currentUser,
  onOpenAuth,
}) => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [relationship, setRelationship] = useState('Parent');
  const [connectionState, setConnectionState] = useState<'Connected' | 'Pending'>('Connected');
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<GPSLocation | null>(null);
  const [activeAlert, setActiveAlert] = useState<AppAlertPayload | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadContacts = async () => {
    if (currentUser) {
      const list = await cloudStorageService.getContacts(currentUser.id);
      setContacts(list);
    } else {
      setContacts([]);
    }
  };

  useEffect(() => {
    loadContacts();
    geolocationService.getCurrentPosition().then((res) => {
      if (res.success && res.location) {
        setLocation(res.location);
      }
    });

    const unsub = emergencyAlertService.subscribe(setActiveAlert);
    return () => unsub();
  }, [currentUser]);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setError(null);

    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');
    if (!name.trim()) {
      setError('Contact name is required.');
      return;
    }
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number or international phone format.');
      return;
    }

    await cloudStorageService.addContact(currentUser.id, {
      name: name.trim(),
      phoneNumber: cleanPhone,
      relationship,
      priorityOrder: contacts.length + 1,
      connectionState,
      lastActive: connectionState === 'Connected' ? 'Active just now' : 'Pending Pairing',
    });

    setName('');
    setPhoneNumber('');
    setRelationship('Parent');
    setConnectionState('Connected');
    setShowAddModal(false);
    loadContacts();
    showToast(`✓ Contact "${name.trim()}" added to your LifeGuard network.`);
  };

  const handleToggleConnection = async (contactId: string) => {
    if (!currentUser) return;
    const updated = await cloudStorageService.toggleContactConnection(currentUser.id, contactId);
    if (updated) {
      loadContacts();
      showToast(`Connection state updated to: ${updated.connectionState}`);
    }
  };

  const handleDeleteContact = async (id: string, contactName: string) => {
    if (!currentUser) return;
    if (window.confirm(`Are you sure you want to disconnect ${contactName}?`)) {
      await cloudStorageService.deleteContact(currentUser.id, id);
      loadContacts();
      showToast(`Contact ${contactName} removed.`);
    }
  };

  const handleTestAppAlert = (contact: EmergencyContact) => {
    if (!currentUser) return;

    emergencyAlertService.dispatchAlert({
      user: currentUser,
      contacts: [contact],
      type: 'MANUAL_SOS',
      location,
      customNote: `Direct Test App Alert sent to ${contact.name}.`,
    });

    showToast(`📡 Direct App-to-App Alert dispatched to ${contact.name}!`);
  };

  const handleAddDefaults = async () => {
    if (!currentUser) return;
    await cloudStorageService.addContact(currentUser.id, {
      name: 'Dad',
      phoneNumber: '+91 98765 43211',
      relationship: 'Father',
      priorityOrder: 1,
      connectionState: 'Connected',
      lastActive: 'Active 2m ago',
    });
    await cloudStorageService.addContact(currentUser.id, {
      name: 'Dr. Sarah',
      phoneNumber: '+91 98765 43212',
      relationship: 'Emergency Physician',
      priorityOrder: 2,
      connectionState: 'Connected',
      lastActive: 'Active 10m ago',
    });
    loadContacts();
    showToast('✓ Added default connected family contacts.');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  if (!currentUser) {
    return (
      <div className="view-container">
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
            Connected Safety Contacts
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 440, margin: '0 auto 20px' }}>
            Please log in or create an account to configure your personal emergency family contacts and enable direct app-to-app alert delivery.
          </p>
          <button className="btn btn-primary" onClick={onOpenAuth}>
            Log In or Register
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 76,
          right: 20,
          background: 'var(--text-main)',
          color: 'var(--text-inverse)',
          padding: '10px 18px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 700,
          boxShadow: 'var(--shadow-lg)',
          zIndex: 9999,
        }}>
          {toastMessage}
        </div>
      )}

      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', marginBottom: 4 }}>
            Connected Trusted Contacts ({contacts.length})
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Standalone app-to-app network: Alerts are dispatched directly with verified GPS payloads.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <span>➕</span> Connect New Contact
        </button>
      </div>

      {/* Contacts List */}
      {contacts.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {contacts.map((contact, index) => {
            const activeRecipient = activeAlert?.recipients.find((r) => r.contactId === contact.id);
            const isAck = activeRecipient?.deliveryStatus === 'Acknowledged';

            return (
              <div key={contact.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          background: index === 0 ? 'var(--primary)' : 'var(--primary-light)',
                          color: index === 0 ? '#fff' : 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: 18,
                        }}
                      >
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 2 }}>
                          {contact.name}
                        </h3>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {contact.relationship}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span className={`badge ${contact.connectionState === 'Connected' ? 'badge-success' : 'badge-warning'}`}>
                        ● {contact.connectionState || 'Connected'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>Priority {contact.priorityOrder || index + 1}</span>
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', background: 'var(--bg-app)', borderRadius: 8, marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Device Channel:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>LifeGuard App P2P</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Mobile Number:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{contact.phoneNumber}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Last Network Ping:</span>
                      <span style={{ color: 'var(--text-main)' }}>{contact.lastActive || 'Active'}</span>
                    </div>

                    {activeRecipient && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 12 }}>
                        <span style={{ fontWeight: 700, color: isAck ? 'var(--success)' : 'var(--primary)' }}>
                          Live Alert Status: {activeRecipient.deliveryStatus}
                        </span>
                        {activeRecipient.responseNote && (
                          <div style={{ color: 'var(--text-main)', fontStyle: 'italic', marginTop: 2 }}>
                            "{activeRecipient.responseNote}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '8px 12px', fontSize: 13 }}
                    onClick={() => handleTestAppAlert(contact)}
                    title="Send a direct app-to-app test alert"
                  >
                    📡 Test Alert
                  </button>

                  <button
                    className="btn btn-outline"
                    style={{ padding: '8px 12px', fontSize: 12 }}
                    onClick={() => handleToggleConnection(contact.id)}
                    title="Toggle simulated connection state"
                  >
                    {contact.connectionState === 'Connected' ? 'Set Pending' : 'Set Connected'}
                  </button>

                  <button
                    className="btn btn-outline"
                    style={{ color: 'var(--danger)', borderColor: 'var(--danger)', padding: '8px 12px', fontSize: 13 }}
                    onClick={() => handleDeleteContact(contact.id, contact.name)}
                    title="Disconnect Contact"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Zero Connected Trusted Contacts Empty State (Feature 7) */
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', border: '2px dashed var(--border-strong)' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>👥</div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', marginBottom: 6 }}>
            Zero Connected Trusted Contacts
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 480, margin: '0 auto 20px', lineHeight: 1.5 }}>
            To enable direct app-to-app emergency alerts and instant live location sharing, connect at least one family member or trusted safety contact.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              ➕ Connect First Contact
            </button>
            <button className="btn btn-outline" onClick={handleAddDefaults}>
              ⚡ Add Default Family Contacts
            </button>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', marginBottom: 4 }}>
              Connect Trusted Emergency Contact
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Contacts will receive high-priority standalone app alerts with your verified GPS coordinates.
            </p>

            {error && (
              <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleAddContact}>
              <div className="form-group">
                <label className="form-label">Contact Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Mom, Brother, Sarah"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="e.g. +91 98765 43210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Relationship</label>
                <select
                  className="form-input"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                >
                  <option value="Parent">Parent</option>
                  <option value="Spouse">Spouse / Partner</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Child">Child</option>
                  <option value="Emergency Physician">Emergency Physician</option>
                  <option value="Friend">Friend</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Initial App Connection State</label>
                <select
                  className="form-input"
                  value={connectionState}
                  onChange={(e) => setConnectionState(e.target.value as any)}
                >
                  <option value="Connected">Connected (Active on LifeGuard Network)</option>
                  <option value="Pending">Pending (Invitation Sent)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Save &amp; Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
