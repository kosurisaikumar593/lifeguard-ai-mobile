import React, { useState, useEffect } from 'react';
import { UserProfile, EmergencyContact, GPSLocation } from '../types';
import { cloudStorageService } from '../services/CloudStorageService';
import { whatsAppService } from '../services/WhatsAppService';
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
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<GPSLocation | null>(null);

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
    });

    setName('');
    setPhoneNumber('');
    setRelationship('Parent');
    setShowAddModal(false);
    loadContacts();
  };

  const handleDeleteContact = async (id: string) => {
    if (!currentUser) return;
    if (window.confirm('Are you sure you want to remove this emergency contact?')) {
      await cloudStorageService.deleteContact(currentUser.id, id);
      loadContacts();
    }
  };

  const handleTestWhatsApp = (contact: EmergencyContact) => {
    if (!currentUser) return;
    whatsAppService.dispatchAlert(
      contact,
      currentUser,
      'Test Safety Alert from LifeGuard AI Web Portal',
      location
    );
  };

  if (!currentUser) {
    return (
      <div className="view-container">
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
            Emergency Contacts Management
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 440, margin: '0 auto 20px' }}>
            Please log in or create an account to configure your personal emergency family contacts and ensure multi-device synchronization.
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
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', marginBottom: 4 }}>
            Emergency Contacts ({contacts.length})
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Trusted contacts notified automatically during verified emergencies or manual SOS triggers.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <span>➕</span> Add New Contact
        </button>
      </div>

      {/* Contacts List */}
      {contacts.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {contacts.map((contact, index) => (
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
                  <span className={`status-badge ${index === 0 ? 'status-safe' : 'status-waiting'}`}>
                    Priority {contact.priorityOrder || index + 1}
                  </span>
                </div>

                <div style={{ padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 8, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mobile Number</div>
                  <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-main)', marginTop: 2 }}>
                    {contact.phoneNumber}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '8px 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onClick={() => handleTestWhatsApp(contact)}
                >
                  <span>💬</span> Test WhatsApp
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)', padding: '8px 12px', fontSize: 13 }}
                  onClick={() => handleDeleteContact(contact.id)}
                  title="Delete Contact"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📭</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No Emergency Contacts</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 18 }}>
            Add at least one trusted family member or emergency contact to enable instant WhatsApp emergency alerts.
          </p>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            + Add Contact
          </button>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', marginBottom: 4 }}>
              Add Emergency Contact
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Contacts will receive standardized SOS messages with your live GPS location.
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
                  <option value="Friend">Friend</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
