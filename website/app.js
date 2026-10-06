/**
 * LIFEGUARD AI — OFFICIAL WEB CLIENT APPLICATION
 * Tagline: "Your Safety, Our Priority"
 * 
 * Features:
 * - Public & Authenticated SPA Routing
 * - Real REST API integration with LifeGuard AI Node/Express backend & MySQL
 * - Zero fake data: 100% real database results and error handling
 * - Zero cloud AI for audio classification (On-device Android TFLite only)
 * - App-to-App contact connections & Emergency response workflows
 */

// Application State
const state = {
  user: JSON.parse(localStorage.getItem('lifeguard_user') || 'null'),
  token: localStorage.getItem('lifeguard_token') || null,
  activeView: 'home',
  serverHealth: null,
  activeEmergency: null,
  contacts: [],
  incomingRequests: [],
  emergencyHistory: [],
  notifications: [],
  adminStats: null,
  adminUsers: [],
  adminIncidents: [],
  selectedIncident: null,
  pollTimer: null,
  mapInstance: null
};

// API Base URL configuration
function getApiBase() {
  const customUrl = localStorage.getItem('lifeguard_api_url');
  if (customUrl && customUrl.trim()) {
    return customUrl.trim().replace(/\/+$/, '');
  }
  // If hosted on GitHub Pages or file, default to localhost:5000
  if (window.location.origin.includes('github.io') || window.location.protocol === 'file:') {
    return 'http://localhost:5000';
  }
  // If served directly by backend
  return window.location.origin;
}

// Universal API Fetcher with Error Handling & Auth
async function apiFetch(endpoint, options = {}) {
  const baseUrl = getApiBase();
  const url = `${baseUrl}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  try {
    const response = await fetch(url, { ...options, headers });
    
    // Handle 401 Session Expiry
    if (response.status === 401) {
      if (state.token) {
        showToast('Your session has expired. Please log in again.', 'warning');
        logout();
      }
      return { success: false, message: 'Unauthorized session.' };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[LifeGuard API Error] ${endpoint}:`, error);
    updateServerStatusIndicator(false);
    return {
      success: false,
      message: 'Unable to connect to LifeGuard AI server. Please verify the backend is running.'
    };
  }
}

// ============================================================
// INITIALIZATION & ROUTING
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  checkServerHealth();
  
  // Hash routing
  const initialHash = window.location.hash.replace('#', '') || 'home';
  navigateTo(initialHash);

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') || 'home';
    navigateTo(hash);
  });

  // Start background status poller
  startPolling();
});

function initUI() {
  updateNavState();

  // Mobile menu button
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const navMenu = document.getElementById('navLinks');
  if (mobileBtn && navMenu) {
    mobileBtn.addEventListener('click', () => {
      navMenu.classList.toggle('open');
    });
  }

  // API Server setting input initialization
  const apiInput = document.getElementById('cfgApiUrl');
  if (apiInput) {
    apiInput.value = getApiBase();
  }

  // Night Mode automatic check (after 6:00 PM)
  const currentHour = new Date().getHours();
  if (currentHour >= 18 || currentHour < 6) {
    console.log('[LifeGuard AI] Night Safety Mode Active (6:00 PM - 6:00 AM)');
  }
}

function updateNavState() {
  const isLoggedIn = !!state.token;
  
  document.querySelectorAll('.public-nav-item').forEach(el => {
    el.style.display = isLoggedIn ? 'none' : 'block';
  });

  document.querySelectorAll('.auth-nav-item').forEach(el => {
    el.style.display = isLoggedIn ? 'block' : 'none';
  });

  const userBadge = document.getElementById('userNavBadge');
  if (userBadge) {
    userBadge.textContent = state.user ? state.user.name : '';
  }
}

function navigateTo(viewId) {
  // Authentication Guard for Protected Views
  const protectedViews = ['dashboard', 'contacts', 'connections', 'history', 'location', 'notifications', 'profile', 'settings', 'admin'];
  if (protectedViews.includes(viewId) && !state.token) {
    showToast('Please log in to access this section.', 'warning');
    viewId = 'login';
  }

  // Hide all sections
  document.querySelectorAll('.view-section').forEach(section => {
    section.classList.remove('active');
  });

  // Activate target section
  const targetSection = document.getElementById(`view-${viewId}`);
  if (targetSection) {
    targetSection.classList.add('active');
    state.activeView = viewId;
    window.location.hash = viewId;
  } else {
    // Fallback to home if section not found
    document.getElementById('view-home')?.classList.add('active');
    state.activeView = 'home';
    window.location.hash = 'home';
  }

  // Close mobile navigation drawer if open
  document.getElementById('navLinks')?.classList.remove('open');

  // Update active navigation link styles
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.remove('active');
    if (a.getAttribute('href') === `#${viewId}`) {
      a.classList.add('active');
    }
  });

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Load view-specific data
  handleViewActivated(viewId);
}

function handleViewActivated(viewId) {
  switch (viewId) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'contacts':
    case 'connections':
      loadContacts();
      break;
    case 'history':
      loadHistory();
      break;
    case 'location':
      loadLocationView();
      break;
    case 'notifications':
      loadNotifications();
      break;
    case 'profile':
      loadProfile();
      break;
    case 'admin':
      loadAdminData();
      break;
  }
}

// ============================================================
// SERVER HEALTH & STATUS POLLER
// ============================================================
async function checkServerHealth() {
  const result = await apiFetch('/api/health');
  if (result && result.status === 'healthy') {
    state.serverHealth = result;
    updateServerStatusIndicator(true, result.database);
  } else {
    updateServerStatusIndicator(false);
  }
}

function updateServerStatusIndicator(isOnline, dbEngine = 'MySQL') {
  const dot = document.getElementById('serverStatusDot');
  const text = document.getElementById('serverStatusText');
  if (dot && text) {
    if (isOnline) {
      dot.className = 'status-dot';
      text.textContent = `Server Online (${dbEngine})`;
    } else {
      dot.className = 'status-dot offline';
      text.textContent = 'Server Disconnected (Click to Configure)';
    }
  }
}

function startPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(() => {
    if (state.token && state.activeView === 'dashboard') {
      loadDashboard(true);
    }
  }, 12000);
}

// ============================================================
// AUTHENTICATION (LOGIN, REGISTER, OTP, LOGOUT)
// ============================================================
async function handleLogin(e) {
  e.preventDefault();
  const mobile = document.getElementById('loginMobile').value.trim();
  const password = document.getElementById('loginPassword').value;
  const alertEl = document.getElementById('loginAlert');

  if (!mobile || !password) {
    showFormAlert(alertEl, 'Please enter both mobile number and password.', 'error');
    return;
  }

  const submitBtn = document.getElementById('loginSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Authenticating...';

  const result = await apiFetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({ mobile, password })
  });

  submitBtn.disabled = false;
  submitBtn.textContent = 'Sign In';

  if (result.success && result.token) {
    state.token = result.token;
    state.user = result.user;
    localStorage.setItem('lifeguard_token', result.token);
    localStorage.setItem('lifeguard_user', JSON.stringify(result.user));

    showToast(`Welcome back, ${result.user.name}!`, 'success');
    updateNavState();
    navigateTo('dashboard');
  } else {
    showFormAlert(alertEl, result.message || 'Login failed. Please check credentials.', 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const mobile = document.getElementById('regMobile').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;
  const alertEl = document.getElementById('regAlert');

  if (!name || !mobile || !password) {
    showFormAlert(alertEl, 'All fields are required.', 'error');
    return;
  }

  if (password.length < 6) {
    showFormAlert(alertEl, 'Password must be at least 6 characters.', 'error');
    return;
  }

  if (password !== confirmPassword) {
    showFormAlert(alertEl, 'Passwords do not match.', 'error');
    return;
  }

  const submitBtn = document.getElementById('regSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating Account...';

  const result = await apiFetch('/api/register', {
    method: 'POST',
    body: JSON.stringify({ name, mobile, password })
  });

  submitBtn.disabled = false;
  submitBtn.textContent = 'Create Account';

  if (result.success) {
    // Open OTP Verification Modal
    openOtpModal(mobile, result.otpCode);
  } else {
    showFormAlert(alertEl, result.message || 'Registration failed.', 'error');
  }
}

function openOtpModal(mobile, code) {
  document.getElementById('otpMobileDisplay').textContent = mobile;
  document.getElementById('otpMobileInput').value = mobile;
  
  const demoHint = document.getElementById('otpDemoHint');
  if (demoHint && code) {
    demoHint.innerHTML = `<strong>Verification Code:</strong> <code>${code}</code> (Generated by LifeGuard AI)`;
    demoHint.style.display = 'block';
  }

  document.getElementById('otpModal').classList.add('open');
}

function closeOtpModal() {
  document.getElementById('otpModal').classList.remove('open');
}

async function handleVerifyOtp(e) {
  e.preventDefault();
  const mobile = document.getElementById('otpMobileInput').value.trim();
  const otpCode = document.getElementById('otpCodeInput').value.trim();
  const alertEl = document.getElementById('otpAlert');

  if (!otpCode || otpCode.length !== 6) {
    showFormAlert(alertEl, 'Please enter the 6-digit numeric OTP.', 'error');
    return;
  }

  const submitBtn = document.getElementById('otpSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Verifying...';

  const result = await apiFetch('/api/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile, otpCode, purpose: 'registration' })
  });

  submitBtn.disabled = false;
  submitBtn.textContent = 'Verify & Activate Account';

  if (result.success && result.token) {
    state.token = result.token;
    state.user = result.user;
    localStorage.setItem('lifeguard_token', result.token);
    localStorage.setItem('lifeguard_user', JSON.stringify(result.user));

    closeOtpModal();
    showToast('Account activated successfully!', 'success');
    updateNavState();
    navigateTo('dashboard');
  } else {
    showFormAlert(alertEl, result.message || 'Invalid OTP code.', 'error');
  }
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('lifeguard_token');
  localStorage.removeItem('lifeguard_user');
  updateNavState();
  showToast('You have been logged out.', 'info');
  navigateTo('home');
}

// Password toggle helper
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input) {
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = 'Hide';
    } else {
      input.type = 'password';
      btn.textContent = 'Show';
    }
  }
}

// ============================================================
// DASHBOARD & EMERGENCY TELEMETRY
// ============================================================
async function loadDashboard(isBackgroundSync = false) {
  if (!state.token) return;

  // Set greeting
  const greetingEl = document.getElementById('dashGreeting');
  if (greetingEl && state.user) {
    greetingEl.textContent = `Hello, ${state.user.name} 👋`;
  }

  // 1. Fetch Profile for latest status
  const profileRes = await apiFetch('/api/profile');
  if (profileRes.success && profileRes.user) {
    state.user = { ...state.user, ...profileRes.user };
    localStorage.setItem('lifeguard_user', JSON.stringify(state.user));
    renderMonitoringStatus(profileRes.user.safety_status);
  }

  // 2. Fetch Contacts count
  const contactsRes = await apiFetch('/api/contacts');
  if (contactsRes.success) {
    state.contacts = contactsRes.contacts || [];
    const connectedCount = state.contacts.filter(c => c.status === 'connected').length;
    document.getElementById('dashContactsCount').textContent = connectedCount;
  }

  // 3. Fetch History & Latest Emergency
  const historyRes = await apiFetch('/api/emergency/history');
  if (historyRes.success) {
    state.emergencyHistory = historyRes.history || [];
    renderDashboardEmergencyState(state.emergencyHistory);
  }

  // 4. Fetch Unread Notifications
  const notifRes = await apiFetch('/api/notifications');
  if (notifRes.success) {
    state.notifications = notifRes.notifications || [];
    const unreadCount = state.notifications.filter(n => !n.is_read).length;
    document.getElementById('dashUnreadNotifs').textContent = unreadCount;
    const navBadge = document.getElementById('notifNavBadge');
    if (navBadge) {
      navBadge.textContent = unreadCount;
      navBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }
  }
}

function renderMonitoringStatus(safetyStatus) {
  const badge = document.getElementById('dashMonitoringBadge');
  const desc = document.getElementById('dashMonitoringDesc');
  const btn = document.getElementById('toggleMonitoringBtn');
  
  if (!badge) return;

  if (safetyStatus === 'monitoring') {
    badge.className = 'badge badge-success';
    badge.textContent = 'Monitoring ACTIVE';
    desc.textContent = 'Surrounding sound level is monitored via the LifeGuard AI Android application.';
    if (btn) btn.textContent = 'Set Status: Idle';
  } else {
    badge.className = 'badge badge-neutral';
    badge.textContent = 'Monitoring OFF';
    desc.textContent = 'Start monitoring inside the LifeGuard AI Android app when entering high-risk areas.';
    if (btn) btn.textContent = 'Set Status: Active Monitoring';
  }
}

async function toggleMonitoringStatus() {
  const newStatus = (state.user && state.user.safety_status === 'monitoring') ? 'idle' : 'monitoring';
  const res = await apiFetch('/api/profile/status', {
    method: 'POST',
    body: JSON.stringify({ safety_status: newStatus })
  });

  if (res.success) {
    state.user.safety_status = newStatus;
    localStorage.setItem('lifeguard_user', JSON.stringify(state.user));
    renderMonitoringStatus(newStatus);
    showToast(`Status updated: ${newStatus.toUpperCase()}`, 'success');
  } else {
    showToast(res.message || 'Failed to update status.', 'error');
  }
}

function renderDashboardEmergencyState(history) {
  const banner = document.getElementById('activeEmergencyBanner');
  const statusBadge = document.getElementById('dashEmergencyBadge');
  const lastIncidentText = document.getElementById('dashLastIncidentText');
  const lastLocationText = document.getElementById('dashLastLocationText');

  // Check if any incident is currently alerted
  const activeEvent = history.find(e => e.emergency_status === 'alerted');
  state.activeEmergency = activeEvent || null;

  if (activeEvent) {
    if (banner) {
      banner.style.display = 'flex';
      document.getElementById('activeEmergencyType').textContent = `ACTIVE ALERT: ${activeEvent.detection_type.replace('_', ' ').toUpperCase()}`;
      document.getElementById('activeEmergencyLocation').textContent = activeEvent.location_address || `Coordinates: ${activeEvent.latitude}, ${activeEvent.longitude}`;
    }
    if (statusBadge) {
      statusBadge.className = 'badge badge-danger';
      statusBadge.textContent = 'EMERGENCY TRIGGERED';
    }
  } else {
    if (banner) banner.style.display = 'none';
    if (statusBadge) {
      statusBadge.className = 'badge badge-success';
      statusBadge.textContent = 'NO ACTIVE EMERGENCY';
    }
  }

  // Last Emergency Summary
  if (history.length > 0) {
    const latest = history[0];
    const dateStr = new Date(latest.created_at).toLocaleString();
    if (lastIncidentText) {
      lastIncidentText.innerHTML = `<strong>${latest.detection_type.toUpperCase()}</strong> &bull; ${dateStr} (${latest.emergency_status})`;
    }
    if (lastLocationText) {
      lastLocationText.textContent = latest.location_address || (latest.latitude ? `${latest.latitude}, ${latest.longitude}` : 'Location unavailable');
    }
  } else {
    if (lastIncidentText) lastIncidentText.textContent = 'No emergency incidents recorded.';
    if (lastLocationText) lastLocationText.textContent = 'Location unavailable.';
  }
}

// Manual SOS Trigger via Web
async function triggerManualSos() {
  if (!confirm('Are you sure you want to trigger an EMERGENCY ALERT to all connected contacts?')) {
    return;
  }

  let latitude = null;
  let longitude = null;

  // Try fetching browser geolocation if available
  if (navigator.geolocation) {
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 }));
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch (e) {
      console.warn('Geolocation unavailable:', e.message);
    }
  }

  const result = await apiFetch('/api/emergency/create', {
    method: 'POST',
    body: JSON.stringify({
      detection_type: 'manual_sos',
      sound_type: 'manual',
      user_response: 'manual_sos',
      latitude,
      longitude,
      location_address: latitude ? `Coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : 'Manual SOS from Web Portal'
    })
  });

  if (result.success) {
    showToast(`Emergency alert activated! ${result.contactsNotified} contact(s) notified.`, 'danger');
    loadDashboard();
  } else {
    showToast(result.message || 'Failed to trigger emergency alert.', 'error');
  }
}

// Acknowledge / Cancel Active Emergency
async function acknowledgeActiveEmergency() {
  if (!state.activeEmergency) return;

  const result = await apiFetch('/api/emergency/acknowledge', {
    method: 'POST',
    body: JSON.stringify({ emergencyId: state.activeEmergency.id })
  });

  if (result.success) {
    showToast('Emergency acknowledged.', 'success');
    loadDashboard();
  } else {
    showToast(result.message || 'Failed to acknowledge.', 'error');
  }
}

// ============================================================
// TRUSTED CONTACTS & APP-TO-APP CONNECTIONS
// ============================================================
async function loadContacts() {
  const result = await apiFetch('/api/contacts');
  if (!result.success) {
    showToast(result.message || 'Failed to load contacts.', 'error');
    return;
  }

  state.contacts = result.contacts || [];
  state.incomingRequests = result.incomingRequests || [];

  renderContactsTable(state.contacts);
  renderIncomingRequests(state.incomingRequests);
}

function renderContactsTable(contacts) {
  const tbody = document.getElementById('contactsTableBody');
  const emptyEl = document.getElementById('contactsEmptyState');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (contacts.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  contacts.forEach(c => {
    const tr = document.createElement('tr');
    const dateStr = new Date(c.created_at).toLocaleDateString();
    
    let statusBadge = '<span class="badge badge-warning">Pending</span>';
    if (c.status === 'connected') statusBadge = '<span class="badge badge-success">Connected</span>';
    if (c.status === 'rejected') statusBadge = '<span class="badge badge-danger">Rejected</span>';

    tr.innerHTML = `
      <td><strong>${escapeHtml(c.contact_name)}</strong></td>
      <td><code>${escapeHtml(c.contact_mobile)}</code></td>
      <td>${statusBadge}</td>
      <td>${dateStr}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="removeContact(${c.id})">Remove</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderIncomingRequests(requests) {
  const tbody = document.getElementById('incomingRequestsBody');
  const box = document.getElementById('incomingRequestsBox');
  if (!tbody || !box) return;

  tbody.innerHTML = '';

  if (requests.length === 0) {
    box.style.display = 'none';
    return;
  }

  box.style.display = 'block';

  requests.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(r.requester_name)}</strong></td>
      <td><code>${escapeHtml(r.requester_mobile)}</code></td>
      <td><span class="badge badge-warning">Pending</span></td>
      <td>
        <button class="btn btn-success btn-sm" onclick="acceptContactRequest(${r.id})">Accept Connection</button>
        <button class="btn btn-outline btn-sm" onclick="removeContact(${r.id})">Decline</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function handleAddContact(e) {
  e.preventDefault();
  const name = document.getElementById('newContactName').value.trim();
  const mobile = document.getElementById('newContactMobile').value.trim();

  if (!mobile) {
    showToast('Please enter contact mobile number.', 'warning');
    return;
  }

  const result = await apiFetch('/api/contacts/request', {
    method: 'POST',
    body: JSON.stringify({ contact_name: name, contact_mobile: mobile })
  });

  if (result.success) {
    showToast('Connection invitation sent successfully!', 'success');
    document.getElementById('newContactName').value = '';
    document.getElementById('newContactMobile').value = '';
    loadContacts();
  } else {
    showToast(result.message || 'Failed to send invitation.', 'error');
  }
}

async function acceptContactRequest(contactId) {
  const result = await apiFetch('/api/contacts/accept', {
    method: 'POST',
    body: JSON.stringify({ contactId })
  });

  if (result.success) {
    showToast('Connection accepted. You are now connected!', 'success');
    loadContacts();
  } else {
    showToast(result.message || 'Failed to accept connection.', 'error');
  }
}

async function removeContact(contactId) {
  if (!confirm('Remove this contact from your LifeGuard AI network?')) return;

  const result = await apiFetch(`/api/contacts/${contactId}`, {
    method: 'DELETE'
  });

  if (result.success) {
    showToast('Contact removed.', 'info');
    loadContacts();
  } else {
    showToast(result.message || 'Failed to remove contact.', 'error');
  }
}

// ============================================================
// EMERGENCY HISTORY & INCIDENT DETAILS MODAL
// ============================================================
async function loadHistory() {
  const result = await apiFetch('/api/emergency/history');
  if (!result.success) {
    showToast(result.message || 'Failed to load incident history.', 'error');
    return;
  }

  state.emergencyHistory = result.history || [];
  renderHistoryTable(state.emergencyHistory);
}

function renderHistoryTable(events) {
  const tbody = document.getElementById('historyTableBody');
  const emptyEl = document.getElementById('historyEmptyState');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (events.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  events.forEach(e => {
    const tr = document.createElement('tr');
    const dateStr = new Date(e.created_at).toLocaleString();
    
    let statusBadge = `<span class="badge badge-info">${e.emergency_status}</span>`;
    if (e.emergency_status === 'alerted') statusBadge = `<span class="badge badge-danger">ALERTED</span>`;
    if (e.emergency_status === 'cancelled') statusBadge = `<span class="badge badge-neutral">Cancelled (Safe)</span>`;
    if (e.emergency_status === 'acknowledged') statusBadge = `<span class="badge badge-success">Acknowledged</span>`;

    const locAvailable = (e.latitude && e.longitude) ? '📍 Available' : '—';

    tr.innerHTML = `
      <td>#${e.id}</td>
      <td>${dateStr}</td>
      <td><strong>${escapeHtml(e.detection_type.replace('_', ' ').toUpperCase())}</strong></td>
      <td>${statusBadge}</td>
      <td>${locAvailable}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="openIncidentDetails(${e.id})">View Details</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function openIncidentDetails(incidentId) {
  const result = await apiFetch(`/api/emergency/${incidentId}`);
  if (!result.success || !result.event) {
    showToast(result.message || 'Failed to load incident details.', 'error');
    return;
  }

  const ev = result.event;
  state.selectedIncident = ev;

  document.getElementById('incModalId').textContent = `#${ev.id}`;
  document.getElementById('incModalDate').textContent = new Date(ev.created_at).toLocaleString();
  document.getElementById('incModalType').textContent = ev.detection_type;
  document.getElementById('incModalClass').textContent = `${ev.sound_type} ${ev.sound_subtype ? `(${ev.sound_subtype})` : ''}`;
  document.getElementById('incModalConfidence').textContent = ev.ai_confidence ? `${(ev.ai_confidence * 100).toFixed(1)}%` : 'N/A';
  document.getElementById('incModalStatus').textContent = ev.emergency_status.toUpperCase();
  document.getElementById('incModalAddress').textContent = ev.location_address || 'Address not resolved';
  document.getElementById('incModalCoords').textContent = (ev.latitude && ev.longitude) ? `${ev.latitude}, ${ev.longitude}` : 'Coordinates unavailable';
  document.getElementById('incModalNotified').textContent = `${ev.contacts_notified_count || 0} contact(s)`;
  document.getElementById('incModalResponse').textContent = ev.user_response;

  // Acknowledge button if status is alerted
  const ackBtn = document.getElementById('incModalAckBtn');
  if (ackBtn) {
    ackBtn.style.display = ev.emergency_status === 'alerted' ? 'inline-flex' : 'none';
  }

  document.getElementById('incidentDetailsModal').classList.add('open');
}

function closeIncidentModal() {
  document.getElementById('incidentDetailsModal').classList.remove('open');
}

async function acknowledgeFromModal() {
  if (!state.selectedIncident) return;
  const result = await apiFetch('/api/emergency/acknowledge', {
    method: 'POST',
    body: JSON.stringify({ emergencyId: state.selectedIncident.id })
  });

  if (result.success) {
    showToast('Incident acknowledged.', 'success');
    closeIncidentModal();
    loadHistory();
    loadDashboard();
  } else {
    showToast(result.message || 'Failed to acknowledge.', 'error');
  }
}

// ============================================================
// EMERGENCY LOCATION & MAP
// ============================================================
function loadLocationView() {
  const locTitle = document.getElementById('locViewAddress');
  const locCoords = document.getElementById('locViewCoords');
  const mapContainer = document.getElementById('mapContainer');

  // Find latest event with coordinates
  const eventWithLoc = state.emergencyHistory.find(e => e.latitude && e.longitude);

  if (eventWithLoc) {
    const lat = parseFloat(eventWithLoc.latitude);
    const lng = parseFloat(eventWithLoc.longitude);
    locTitle.textContent = eventWithLoc.location_address || 'Recorded Incident Coordinates';
    locCoords.textContent = `Latitude: ${lat.toFixed(6)} | Longitude: ${lng.toFixed(6)}`;

    // Render Leaflet Map
    renderMap(lat, lng, eventWithLoc.location_address || `Incident #${eventWithLoc.id}`);
  } else {
    locTitle.textContent = 'Location unavailable.';
    locCoords.textContent = 'No GPS coordinates recorded in current incidents.';
    if (mapContainer) {
      mapContainer.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📍</div><div class="empty-state-text">Location unavailable.</div><p style="color: var(--text-muted); font-size: 0.88rem; margin-top: 6px;">GPS coordinates are captured automatically when an emergency triggers on Android.</p></div>';
    }
  }
}

function renderMap(lat, lng, label) {
  const mapContainer = document.getElementById('mapContainer');
  if (!mapContainer || typeof L === 'undefined') return;

  // Clean existing map instance
  if (state.mapInstance) {
    state.mapInstance.remove();
    state.mapInstance = null;
  }

  mapContainer.innerHTML = '';
  const mapDiv = document.createElement('div');
  mapDiv.style.width = '100%';
  mapDiv.style.height = '100%';
  mapContainer.appendChild(mapDiv);

  state.mapInstance = L.map(mapDiv).setView([lat, lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(state.mapInstance);

  L.marker([lat, lng])
    .addTo(state.mapInstance)
    .bindPopup(`<strong>LifeGuard AI Alert</strong><br>${escapeHtml(label)}`)
    .openPopup();
}

// ============================================================
// NOTIFICATIONS
// ============================================================
async function loadNotifications() {
  const result = await apiFetch('/api/notifications');
  if (!result.success) {
    showToast(result.message || 'Failed to load notifications.', 'error');
    return;
  }

  state.notifications = result.notifications || [];
  renderNotificationsList(state.notifications);
}

function renderNotificationsList(notifs) {
  const container = document.getElementById('notificationsList');
  const emptyEl = document.getElementById('notifsEmptyState');
  if (!container) return;

  container.innerHTML = '';

  if (notifs.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  notifs.forEach(n => {
    const div = document.createElement('div');
    div.className = `card ${n.is_read ? '' : 'unread-notif'}`;
    div.style.marginBottom = '12px';
    div.style.padding = '18px 24px';
    if (!n.is_read) {
      div.style.borderLeft = '4px solid var(--primary)';
    }

    const dateStr = new Date(n.created_at).toLocaleString();

    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
        <h4 style="font-size: 1.05rem; font-weight: 700; color: #FFF;">${escapeHtml(n.title)}</h4>
        <span style="font-size: 0.8rem; color: var(--text-muted);">${dateStr}</span>
      </div>
      <p style="color: var(--text-secondary); font-size: 0.92rem; margin-bottom: 8px;">${escapeHtml(n.message)}</p>
      <span class="badge ${n.type === 'EMERGENCY_ALERT' ? 'badge-danger' : 'badge-info'}">${n.type}</span>
    `;
    container.appendChild(div);
  });
}

async function markNotificationsRead() {
  const result = await apiFetch('/api/notifications/read', { method: 'POST' });
  if (result.success) {
    showToast('Notifications marked as read.', 'success');
    loadNotifications();
    loadDashboard();
  }
}

// ============================================================
// PROFILE & SETTINGS
// ============================================================
async function loadProfile() {
  const result = await apiFetch('/api/profile');
  if (result.success && result.user) {
    state.user = { ...state.user, ...result.user };
    document.getElementById('profNameInput').value = result.user.name;
    document.getElementById('profMobileDisplay').textContent = result.user.mobile;
    document.getElementById('profStatusDisplay').textContent = (result.user.safety_status || 'idle').toUpperCase();
    document.getElementById('profJoinedDisplay').textContent = new Date(result.user.created_at).toLocaleDateString();
  }
}

async function handleUpdateProfile(e) {
  e.preventDefault();
  const name = document.getElementById('profNameInput').value.trim();
  if (!name) {
    showToast('Full name is required.', 'warning');
    return;
  }

  const result = await apiFetch('/api/profile', {
    method: 'PUT',
    body: JSON.stringify({ name })
  });

  if (result.success) {
    state.user.name = name;
    localStorage.setItem('lifeguard_user', JSON.stringify(state.user));
    showToast('Profile updated successfully!', 'success');
    updateNavState();
  } else {
    showToast(result.message || 'Failed to update profile.', 'error');
  }
}

function saveApiConfiguration(e) {
  e.preventDefault();
  const input = document.getElementById('cfgApiUrl').value.trim();
  if (!input) {
    localStorage.removeItem('lifeguard_api_url');
    showToast('Reset to default backend URL.', 'info');
  } else {
    localStorage.setItem('lifeguard_api_url', input);
    showToast(`API Server configured: ${input}`, 'success');
  }
  checkServerHealth();
}

async function pingCurrentServer() {
  showToast('Testing connection...', 'info');
  const res = await apiFetch('/api/health');
  if (res && res.status === 'healthy') {
    showToast(`Connected successfully! Database: ${res.database}`, 'success');
  } else {
    showToast('Connection failed. Please check server URL and ensure backend is running.', 'error');
  }
}

// ============================================================
// ADMIN DASHBOARD
// ============================================================
async function loadAdminData() {
  // 1. Stats
  const statsRes = await apiFetch('/api/admin/stats');
  if (statsRes.success && statsRes.stats) {
    const s = statsRes.stats;
    document.getElementById('admTotalUsers').textContent = s.total_users;
    document.getElementById('admTotalIncidents').textContent = s.total_incidents;
    document.getElementById('admActiveIncidents').textContent = s.active_incidents;
    document.getElementById('admResolvedIncidents').textContent = s.resolved_incidents;
    document.getElementById('admConnectedContacts').textContent = s.connected_contacts;
    document.getElementById('admServerUptime').textContent = `${Math.floor(s.uptime_seconds / 60)}m ${s.uptime_seconds % 60}s`;
  }

  // 2. Users
  const usersRes = await apiFetch('/api/admin/users');
  if (usersRes.success) {
    renderAdminUsersTable(usersRes.users || []);
  }

  // 3. Incidents
  const incRes = await apiFetch('/api/admin/incidents');
  if (incRes.success) {
    renderAdminIncidentsTable(incRes.incidents || []);
  }
}

function renderAdminUsersTable(users) {
  const tbody = document.getElementById('admUsersTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No registered users found in MySQL.</td></tr>';
    return;
  }

  users.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${u.id}</td>
      <td><strong>${escapeHtml(u.name)}</strong></td>
      <td><code>${escapeHtml(u.mobile)}</code></td>
      <td><span class="badge ${u.safety_status === 'monitoring' ? 'badge-success' : 'badge-neutral'}">${u.safety_status || 'idle'}</span></td>
      <td>${new Date(u.created_at).toLocaleDateString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAdminIncidentsTable(incidents) {
  const tbody = document.getElementById('admIncidentsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (incidents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">No emergency events recorded in MySQL.</td></tr>';
    return;
  }

  incidents.forEach(ev => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${ev.id}</td>
      <td>User #${ev.user_id}</td>
      <td>${ev.detection_type}</td>
      <td><span class="badge ${ev.emergency_status === 'alerted' ? 'badge-danger' : 'badge-neutral'}">${ev.emergency_status}</span></td>
      <td>${ev.location_address || (ev.latitude ? `${ev.latitude}, ${ev.longitude}` : 'No GPS')}</td>
      <td>${new Date(ev.created_at).toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ============================================================
// UI HELPERS (TOAST, ESCAPE, ALERTS)
// ============================================================
function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `form-alert show ${type === 'danger' || type === 'error' ? 'error' : (type === 'success' ? 'success' : '')}`;
  toast.style.marginBottom = '10px';
  toast.style.boxShadow = 'var(--shadow-lg)';
  toast.textContent = message;

  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function showFormAlert(el, message, type) {
  if (!el) return;
  el.textContent = message;
  el.className = `form-alert show ${type}`;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
