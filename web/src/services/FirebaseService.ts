/**
 * LifeGuard AI Web — Firebase Integration Service
 * 
 * Provides Firebase Authentication (Login, Register, Password Reset)
 * and Cloud Firestore collections (users, contacts sub-collection, incidents)
 * with onSnapshot real-time listeners for live emergency dispatch.
 * 
 * Includes fallback handling when Firebase credentials are not provided.
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { UserProfile, EmergencyContact, EmergencyIncident } from '../types';

export class FirebaseService {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private db: Firestore | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initFirebase();
  }

  private initFirebase() {
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || localStorage.getItem('lifeguard_firebase_api_key');
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || localStorage.getItem('lifeguard_firebase_project_id');
    const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`;
    const appId = import.meta.env.VITE_FIREBASE_APP_ID;

    if (apiKey && projectId) {
      try {
        const config = {
          apiKey,
          authDomain,
          projectId,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: appId || '1:123456789:web:abcdef',
        };

        this.app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
        this.auth = getAuth(this.app);
        this.db = getFirestore(this.app);
        this.isConfigured = true;
      } catch (err) {
        console.warn('[FirebaseService] Init error:', err);
        this.isConfigured = false;
      }
    } else {
      this.isConfigured = false;
    }
  }

  public getIsConfigured(): boolean {
    return this.isConfigured && this.auth !== null && this.db !== null;
  }

  // =========================================================================
  // FIREBASE AUTHENTICATION (Login, Register, Password Reset)
  // =========================================================================

  public async register(
    fullName: string,
    phone: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    if (!this.auth || !this.db) {
      return { success: false, error: 'Firebase is not configured' };
    }

    try {
      const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
      const userEmail = email.trim() || `${cleanPhone}@lifeguard.ai`;

      const userCred = await createUserWithEmailAndPassword(this.auth, userEmail, password);
      await updateProfile(userCred.user, { displayName: fullName });

      const profile: UserProfile = {
        id: userCred.user.uid,
        fullName,
        mobileNumber: `+91${cleanPhone}`,
        email: userEmail,
        countryCode: '+91',
        createdAt: new Date().toISOString(),
      };

      // Create user document in 'users' collection
      await setDoc(doc(this.db, 'users', userCred.user.uid), profile);

      return { success: true, user: profile };
    } catch (err: any) {
      return { success: false, error: err.message || 'Firebase Registration failed' };
    }
  }

  public async login(
    emailOrPhone: string,
    password: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    if (!this.auth || !this.db) {
      return { success: false, error: 'Firebase is not configured' };
    }

    try {
      let targetEmail = emailOrPhone.trim();
      if (!targetEmail.includes('@')) {
        const cleanPhone = emailOrPhone.replace(/[^0-9]/g, '').slice(-10);
        targetEmail = `${cleanPhone}@lifeguard.ai`;
      }

      const userCred = await signInWithEmailAndPassword(this.auth, targetEmail, password);
      const docSnap = await getDoc(doc(this.db, 'users', userCred.user.uid));

      if (docSnap.exists()) {
        return { success: true, user: docSnap.data() as UserProfile };
      }

      const fallbackUser: UserProfile = {
        id: userCred.user.uid,
        fullName: userCred.user.displayName || 'LifeGuard User',
        mobileNumber: '+91 98765 43210',
        email: userCred.user.email || targetEmail,
        countryCode: '+91',
        createdAt: new Date().toISOString(),
      };
      return { success: true, user: fallbackUser };
    } catch (err: any) {
      return { success: false, error: err.message || 'Firebase Login failed' };
    }
  }

  public async sendPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
    if (!this.auth) return { success: false, error: 'Firebase Auth unavailable' };
    try {
      await sendPasswordResetEmail(this.auth, email);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Password reset failed' };
    }
  }

  public async signOut(): Promise<void> {
    if (this.auth) {
      await firebaseSignOut(this.auth);
    }
  }

  // =========================================================================
  // FIRESTORE: CONTACTS SUB-COLLECTION (users/{userId}/contacts)
  // =========================================================================

  public async getContacts(userId: string): Promise<EmergencyContact[]> {
    if (!this.db) return [];
    try {
      const contactsRef = collection(this.db, 'users', userId, 'contacts');
      const snap = await getDocs(contactsRef);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EmergencyContact));
    } catch (err) {
      console.warn('[FirebaseService] getContacts error:', err);
      return [];
    }
  }

  public async addContact(
    userId: string,
    contactData: Omit<EmergencyContact, 'id' | 'userId' | 'createdAt'>
  ): Promise<EmergencyContact | null> {
    if (!this.db) return null;
    try {
      const contactsRef = collection(this.db, 'users', userId, 'contacts');
      const docRef = await addDoc(contactsRef, {
        userId,
        name: contactData.name,
        phoneNumber: contactData.phoneNumber,
        relationship: contactData.relationship || 'Emergency Contact',
        priorityOrder: contactData.priorityOrder || 1,
        connectionState: contactData.connectionState || 'Connected',
        createdAt: new Date().toISOString(),
      });

      return {
        id: docRef.id,
        userId,
        ...contactData,
        createdAt: new Date().toISOString(),
      };
    } catch (err) {
      console.warn('[FirebaseService] addContact error:', err);
      return null;
    }
  }

  public async updateContactStatus(
    userId: string,
    contactId: string,
    status: 'Connected' | 'Pending'
  ): Promise<boolean> {
    if (!this.db) return false;
    try {
      const docRef = doc(this.db, 'users', userId, 'contacts', contactId);
      await updateDoc(docRef, { connectionState: status });
      return true;
    } catch (err) {
      console.warn('[FirebaseService] updateContactStatus error:', err);
      return false;
    }
  }

  public async deleteContact(userId: string, contactId: string): Promise<boolean> {
    if (!this.db) return false;
    try {
      await deleteDoc(doc(this.db, 'users', userId, 'contacts', contactId));
      return true;
    } catch (err) {
      console.warn('[FirebaseService] deleteContact error:', err);
      return false;
    }
  }

  // =========================================================================
  // FIRESTORE: INCIDENTS COLLECTION (Metadata-only, NO raw audio)
  // =========================================================================

  public async createIncident(
    userId: string,
    incident: Omit<EmergencyIncident, 'id' | 'userId' | 'createdAt'>
  ): Promise<EmergencyIncident | null> {
    if (!this.db) return null;
    try {
      const incidentsRef = collection(this.db, 'incidents');
      const docRef = await addDoc(incidentsRef, {
        userId,
        incidentType: incident.incidentType,
        detectionResult: incident.detectionResult,
        decibels: incident.decibels || 0,
        confidence: incident.confidence || 0,
        latitude: incident.latitude || null,
        longitude: incident.longitude || null,
        locationAccuracy: incident.locationAccuracy || null,
        locationAddress: incident.locationAddress || null,
        alertStatus: incident.alertStatus,
        recipientsSummary: incident.recipientsSummary || [],
        bufferCancelled: incident.bufferCancelled || false,
        createdAt: new Date().toISOString(),
      });

      return {
        id: docRef.id,
        userId,
        ...incident,
        createdAt: new Date().toISOString(),
      };
    } catch (err) {
      console.warn('[FirebaseService] createIncident error:', err);
      return null;
    }
  }

  public async getIncidents(userId: string): Promise<EmergencyIncident[]> {
    if (!this.db) return [];
    try {
      const q = query(
        collection(this.db, 'incidents'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EmergencyIncident));
    } catch (err) {
      console.warn('[FirebaseService] getIncidents error:', err);
      return [];
    }
  }

  // =========================================================================
  // FIRESTORE REAL-TIME SNAPSHOT LISTENERS
  // =========================================================================

  public listenToLiveIncidents(
    userId: string,
    onIncident: (incident: EmergencyIncident) => void
  ): () => void {
    if (!this.db) return () => {};
    try {
      const q = query(
        collection(this.db, 'incidents'),
        where('userId', '==', userId)
      );

      return onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            console.log('[Firestore onSnapshot] New emergency incident received:', data);
            onIncident({ id: change.doc.id, ...data } as EmergencyIncident);
          }
        });
      });
    } catch (err) {
      console.warn('[FirebaseService] listenToLiveIncidents error:', err);
      return () => {};
    }
  }
}

export const firebaseService = new FirebaseService();
