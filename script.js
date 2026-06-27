/* ================================================
   TELEBEY — script.js  v2.0 Production
   Features: Google Sign-In, Reactions, Reply,
   Forward, Edit, Pin, Save, Emoji Picker,
   Command Palette, Undo Send, Offline Queue,
   Notifications, Privacy, Themes, Search & more
   ================================================ */
'use strict';

// ─────────────────────────────────────────────
// 0. CONFIG
// ─────────────────────────────────────────────
const SUPABASE_URL  = 'https://nfnbwrrvjpkrnayzyihd.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mbmJ3cnJ2anBrcm5heXp5aWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDU2NjcsImV4cCI6MjA5NzE4MTY2N30.Uwuk6_Btflb_EmtuwOAP2HcuaL99gwFG3AuV2aG1Pjc';
const MEDIA_BUCKET  = 'telebey-media';
const UNDO_DELAY_MS = 5000;

// ─────────────────────────────────────────────
// 1. SUPABASE CLIENT
// ─────────────────────────────────────────────
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

// ─────────────────────────────────────────────
// 2. APP STATE
// ─────────────────────────────────────────────
let currentUser    = null;
let currentProfile = null;
let activeRoomId   = null;
let activeRoom     = null;
let roomMembers    = [];
let myRoomRole     = 'member';
let rooms          = [];
let profileCache   = {};

let realtimeChannel   = null;
let roomsChannel      = null;

let mediaRecorder     = null;
let audioChunks       = [];
let recordingTimerInt = null;
let recordingSeconds  = 0;
let isRecording       = false;

let contextTargetMsg  = null;
let replyTargetMsg    = null;
let searchDebounceTimer = null;
let cmdDebounceTimer  = null;

// Undo send
let undoTimer       = null;
let pendingMsgId    = null;

// Offline queue
let offlineQueue    = JSON.parse(localStorage.getItem('tb_offline_queue') || '[]');
let isOnline        = navigator.onLine;

// Search in chat
let chatSearchResults   = [];
let chatSearchCurrent   = -1;

// Notification permission
let notifPermission = Notification.permission;

// ─────────────────────────────────────────────
// 3. DOM REFERENCES
// ─────────────────────────────────────────────
const $ = id => document.getElementById(id);

const DOM = {
  loadingScreen:     $('loading-screen'),
  authScreen:        $('auth-screen'),
  app:               $('app'),

  // Auth
  authTabs:          document.querySelectorAll('.auth-tab'),
  authPanelLogin:    $('auth-panel-login'),
  authPanelRegister: $('auth-panel-register'),
  authPanelForgot:   $('auth-panel-forgot'),
  methodBtns:        document.querySelectorAll('.method-btn'),
  loginEmailForm:    $('login-email-form'),
  loginPhoneForm:    $('login-phone-form'),
  loginEmail:        $('login-email'),
  loginPassword:     $('login-password'),
  btnEmailLogin:     $('btn-email-login'),
  btnGoogleLogin:    $('btn-google-login'),
  btnGoogleRegister: $('btn-google-register'),
  loginPhone:        $('login-phone'),
  btnSendOtp:        $('btn-send-otp'),
  phoneStep1:        $('phone-step-1'),
  phoneStep2:        $('phone-step-2'),
  loginOtp:          $('login-otp'),
  btnVerifyOtp:      $('btn-verify-otp'),
  btnResendOtp:      $('btn-resend-otp'),
  regUsername:       $('reg-username'),
  regDisplayName:    $('reg-display-name'),
  regPhone:          $('reg-phone'),
  regEmail:          $('reg-email'),
  regPassword:       $('reg-password'),
  btnRegister:       $('btn-register'),
  btnForgotPw:       $('btn-forgot-password'),
  forgotEmail:       $('forgot-email'),
  btnSendReset:      $('btn-send-reset'),
  btnBackToLogin:    $('btn-back-to-login'),
  toggleLoginPw:     $('toggle-login-pw'),
  toggleRegPw:       $('toggle-reg-pw'),
  passwordStrength:  $('password-strength'),

  // Sidebar
  sidebar:           $('sidebar'),
  btnNewGroup:       $('btn-new-group'),
  btnSavedMessages:  $('btn-saved-messages'),
  searchInput:       $('search-input'),
  btnSearchClear:    $('btn-search-clear'),
  contactResults:    $('contact-search-results'),
  filterTabs:        document.querySelectorAll('.filter-tab'),
  roomList:          $('room-list'),
  roomListEmpty:     $('room-list-empty'),
  notifPill:         $('notif-pill'),
  sidebarAvatar:     $('sidebar-user-avatar'),
  sidebarUsername:   $('sidebar-username'),
  sidebarStatusText: $('sidebar-status-text'),
  btnNotifications:  $('btn-notifications'),
  notifBadge:        $('notif-badge'),
  btnSettings:       $('btn-settings'),
  btnSignout:        $('btn-signout'),

  // Chat
  chatEmptyState:    $('chat-empty-state'),
  chatView:          $('chat-view'),
  chatHeaderInfoBtn: $('chat-header-info-btn'),
  chatHeaderAvatar:  $('chat-header-avatar'),
  chatHeaderName:    $('chat-header-name'),
  chatHeaderMeta:    $('chat-header-meta'),
  btnToggleInfo:     $('btn-toggle-info'),
  btnBackToList:     $('btn-back-to-list'),
  btnSearchMsgs:     $('btn-search-msgs'),
  inChatSearch:      $('in-chat-search'),
  inChatSearchInput: $('in-chat-search-input'),
  inChatSearchCount: $('in-chat-search-count'),
  btnSearchPrev:     $('btn-search-msgs-prev'),
  btnSearchNext:     $('btn-search-msgs-next'),
  btnCloseSearch:    $('btn-close-search-msgs'),
  pinnedBar:         $('pinned-bar'),
  pinnedBarText:     $('pinned-bar-text'),
  btnClosePinnedBar: $('btn-close-pinned-bar'),
  typingIndicator:   $('typing-indicator'),
  typingText:        $('typing-text'),
  messagesContainer: $('messages-container'),
  messagesLoading:   $('messages-loading'),
  messagesList:      $('messages-list'),
  messagesAnchor:    $('messages-bottom-anchor'),
  btnScrollBottom:   $('btn-scroll-bottom'),
  scrollUnreadCount: $('scroll-unread-count'),

  replyPreview:      $('reply-preview'),
  replyPreviewSender:$('reply-preview-sender'),
  replyPreviewText:  $('reply-preview-text'),
  btnCancelReply:    $('btn-cancel-reply'),

  inputBar:          $('input-bar'),
  btnAttach:         $('btn-attach'),
  attachPopup:       $('attach-popup'),
  attImage:          $('att-image'),
  attFile:           $('att-file'),
  attGif:            $('att-gif'),
  fileInput:         $('file-input'),
  fileInputAny:      $('file-input-any'),
  btnEmoji:          $('btn-emoji'),
  emojiContainer:    $('emoji-picker-container'),
  messageInput:      $('message-input'),
  btnSend:           $('btn-send'),
  btnMic:            $('btn-mic'),
  micIconNormal:     $('mic-icon-normal'),
  micIconRecording:  $('mic-icon-recording'),
  recordingIndicator:$('recording-indicator'),
  recordingTimer:    $('recording-timer'),
  btnCancelRecording:$('btn-cancel-recording'),

  infoPanel:         $('info-panel'),
  infoPanelContent:  $('info-panel-content'),
  btnCloseInfo:      $('btn-close-info'),

  notifPanel:        $('notif-panel'),
  notifList:         $('notif-list'),
  btnCloseNotif:     $('btn-close-notif'),
  btnMarkAllRead:    $('btn-mark-all-read'),

  commandPalette:    $('command-palette'),
  commandInput:      $('command-input'),
  commandResults:    $('command-results'),

  undoBar:           $('undo-bar'),
  btnUndoSend:       $('btn-undo-send'),

  // Modals
  modalNewGroup:     $('modal-new-group'),
  groupAvatarPreview:$('group-avatar-preview'),
  groupLogoInput:    $('group-logo-input'),
  btnUploadGroupLogo:$('btn-upload-group-logo'),
  newGroupName:      $('new-group-name'),
  newGroupDesc:      $('new-group-desc'),
  groupIsPublic:     $('group-is-public'),
  btnCreateGroup:    $('btn-create-group'),

  modalSettings:     $('modal-settings'),
  settingsNavItems:  document.querySelectorAll('.settings-nav-item'),
  settingsSections:  document.querySelectorAll('.settings-section'),
  settingsAvatar:    $('settings-avatar-preview'),
  settingsAvatarInput:$('settings-avatar-input'),
  btnUploadAvatar:   $('btn-upload-avatar'),
  settingsUsername:  $('settings-username'),
  settingsDisplayName:$('settings-display-name'),
  settingsBio:       $('settings-bio'),
  settingsStatusEmoji:$('settings-status-emoji'),
  settingsStatusText:$('settings-status-text'),
  settingsPhone:     $('settings-phone'),
  settingsBirthday:  $('settings-birthday'),
  privacyLastSeen:   $('privacy-last-seen'),
  privacyOnline:     $('privacy-online'),
  privacyAvatar:     $('privacy-avatar'),
  privacyReadReceipts:$('privacy-read-receipts'),
  privacyWhoMessage: $('privacy-who-message'),
  themeButtons:      document.querySelectorAll('.theme-btn'),
  accentButtons:     document.querySelectorAll('.accent-btn'),
  customAccent:      $('custom-accent'),
  fontButtons:       document.querySelectorAll('.font-btn'),
  notifSound:        $('notif-sound'),
  btnRequestNotif:   $('btn-request-notif'),
  settingsNewPw:     $('settings-new-password'),
  btnChangePw:       $('btn-change-password'),
  btnLogoutAll:      $('btn-logout-all'),
  btnSaveSettings:   $('btn-save-settings'),

  modalSaved:        $('modal-saved'),
  savedMessagesList: $('saved-messages-list'),

  modalForward:      $('modal-forward'),
  forwardSearch:     $('forward-search'),
  forwardList:       $('forward-list'),

  modalLightbox:     $('modal-lightbox'),
  lightboxImg:       $('lightbox-img'),
  btnCloseLightbox:  $('btn-close-lightbox'),
  btnLightboxDl:     $('btn-lightbox-download'),
  btnLightboxZoomIn: $('btn-lightbox-zoomin'),
  btnLightboxZoomOut:$('btn-lightbox-zoomout'),

  reactionPicker:    $('reaction-picker'),
  contextMenu:       $('context-menu'),
  toastContainer:    $('toast-container'),
};

// ─────────────────────────────────────────────
// 4. TOAST
// ─────────────────────────────────────────────
function showToast(message, type = 'info', duration = 4000) {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = message;
  DOM.toastContainer.appendChild(t);
  setTimeout(() => {
    t.classList.add('fade-out');
    setTimeout(() => t.remove(), 350);
  }, duration);
}

// ─────────────────────────────────────────────
// 5. HELPERS
// ─────────────────────────────────────────────
const formatTime = iso => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function formatDate(iso) {
  const d = new Date(iso), now = new Date(), diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDuration(s) {
  return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1048576).toFixed(1) + ' MB';
}

function avatarInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase();
}

function setAvatarEl(el, avatarUrl, name) {
  el.innerHTML = '';
  if (avatarUrl) {
    const img = document.createElement('img');
    img.src = avatarUrl; img.alt = name || '';
    img.onerror = () => { el.innerHTML = ''; el.textContent = avatarInitials(name); };
    el.appendChild(img);
  } else {
    el.textContent = avatarInitials(name);
  }
}

function openModal(id)  { $(id)?.classList.remove('hidden'); }
function closeModal(id) { $(id)?.classList.add('hidden'); }

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function renderMarkdown(text) {
  if (!text) return '';
  let t = escapeHtml(text);
  t = t.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/_([^_]+)_/g, '<em>$1</em>');
  t = t.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  t = t.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:var(--accent)">$1</a>');
  return t;
}

async function downloadFileFromUrl(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'telebey-media';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  } catch (e) { showToast('Download failed: ' + e.message, 'error'); }
}

async function getOrFetchProfile(userId) {
  if (profileCache[userId]) return profileCache[userId];
  try {
    const { data } = await sb.from('profiles').select('*').eq('id', userId).single();
    if (data) profileCache[userId] = data;
    return data;
  } catch { return null; }
}

function getPublicUrl(path) {
  const { data } = sb.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function getFileIcon(mime) {
  if (!mime) return '📄';
  if (mime.startsWith('image/')) return '🖼';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.includes('pdf')) return '📕';
  if (mime.includes('zip') || mime.includes('rar')) return '🗜';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  if (mime.includes('sheet') || mime.includes('excel')) return '📊';
  return '📎';
}

// ─────────────────────────────────────────────
// 6. OFFLINE QUEUE
// ─────────────────────────────────────────────
window.addEventListener('online',  () => { isOnline = true;  showToast('Back online! Sending queued messages…', 'success', 2500); flushOfflineQueue(); });
window.addEventListener('offline', () => { isOnline = false; showToast('You are offline. Messages will be sent when reconnected.', 'warning', 5000); });

function saveOfflineQueue() {
  localStorage.setItem('tb_offline_queue', JSON.stringify(offlineQueue));
}

async function flushOfflineQueue() {
  if (!offlineQueue.length || !currentUser) return;
  const toSend = [...offlineQueue];
  offlineQueue = [];
  saveOfflineQueue();
  for (const item of toSend) {
    try {
      await sb.from('messages').insert({
        room_id: item.room_id, sender_id: currentUser.id,
        content: item.content, message_type: 'text',
      });
    } catch (e) {
      offlineQueue.unshift(item);
      saveOfflineQueue();
      break;
    }
  }
}

// ─────────────────────────────────────────────
// 7. THEME / PREFERENCES
// ─────────────────────────────────────────────
function applyTheme(theme) {
  document.body.dataset.theme = theme || 'dark';
  localStorage.setItem('tb_theme', theme);
  DOM.themeButtons?.forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
}

function applyAccent(color) {
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-hover', shadeColor(color, -20));
  document.documentElement.style.setProperty('--accent-dim', color + '2e');
  document.documentElement.style.setProperty('--accent-glow', color + '59');
  localStorage.setItem('tb_accent', color);
  DOM.accentButtons?.forEach(b => b.classList.toggle('active', b.dataset.color === color));
  if (DOM.customAccent) DOM.customAccent.value = color;
}

function applyFontSize(size) {
  document.body.dataset.font = size || 'medium';
  localStorage.setItem('tb_font', size);
  DOM.fontButtons?.forEach(b => b.classList.toggle('active', b.dataset.size === size));
}

function shadeColor(hex, pct) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + pct));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xFF) + pct));
  const b = Math.min(255, Math.max(0, (n & 0xFF) + pct));
  return '#' + ((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);
}

function loadSavedPrefs() {
  applyTheme(localStorage.getItem('tb_theme') || 'dark');
  applyAccent(localStorage.getItem('tb_accent') || '#5865f2');
  applyFontSize(localStorage.getItem('tb_font') || 'medium');
}
loadSavedPrefs();

// Theme buttons
DOM.themeButtons?.forEach(btn => {
  btn.addEventListener('click', () => {
    applyTheme(btn.dataset.theme);
    if (currentProfile) {
      sb.from('profiles').update({ theme: btn.dataset.theme }).eq('id', currentUser.id);
    }
  });
});
DOM.accentButtons?.forEach(btn => {
  btn.addEventListener('click', () => applyAccent(btn.dataset.color));
});
DOM.customAccent?.addEventListener('input', e => applyAccent(e.target.value));
DOM.fontButtons?.forEach(btn => {
  btn.addEventListener('click', () => applyFontSize(btn.dataset.size));
});

// ─────────────────────────────────────────────
// 8. AUTH
// ─────────────────────────────────────────────
function showAuthScreen() {
  DOM.loadingScreen?.classList.add('fade-out');
  setTimeout(() => { if(DOM.loadingScreen) DOM.loadingScreen.style.display='none'; }, 400);
  DOM.authScreen.classList.remove('hidden');
  DOM.app.classList.add('hidden');
}

function showApp() {
  DOM.loadingScreen?.classList.add('fade-out');
  setTimeout(() => { if(DOM.loadingScreen) DOM.loadingScreen.style.display='none'; }, 400);
  DOM.authScreen.classList.add('hidden');
  DOM.app.classList.remove('hidden');
}

async function loadCurrentProfile(userId) {
  try {
    let { data, error } = await sb.from('profiles').select('*').eq('id', userId).single();
    if (error && error.code === 'PGRST116') {
      const { data: np, error: ie } = await sb.from('profiles')
        .insert({ id: userId, username: 'user_' + userId.slice(0,6), is_approved: true })
        .select().single();
      if (ie) throw ie;
      data = np;
    } else if (error) throw error;
    currentProfile = data;
    profileCache[userId] = data;
    renderSidebarUser();
    if (data?.theme)  applyTheme(data.theme);
    if (data?.accent_color) applyAccent(data.accent_color);
    if (data?.font_size) applyFontSize(data.font_size);
  } catch (e) { showToast('Profile load failed: ' + e.message, 'error'); }
}

function renderSidebarUser() {
  if (!currentProfile) return;
  setAvatarEl(DOM.sidebarAvatar, currentProfile.avatar_url, currentProfile.display_name || currentProfile.username);
  DOM.sidebarUsername.textContent = currentProfile.display_name || currentProfile.username || 'Me';
  DOM.sidebarStatusText.textContent = (currentProfile.status_emoji || '') + ' ' + (currentProfile.status_text || '');
}

// Auth tab switching
DOM.authTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    DOM.authTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const which = tab.dataset.tab;
    DOM.authPanelLogin.classList.toggle('active', which === 'login');
    DOM.authPanelRegister.classList.toggle('active', which === 'register');
    DOM.authPanelForgot.classList.remove('active');
  });
});

// Method toggle
DOM.methodBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    DOM.methodBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    DOM.loginEmailForm.classList.toggle('active', btn.dataset.method === 'email');
    DOM.loginPhoneForm.classList.toggle('active', btn.dataset.method === 'phone');
  });
});

// Toggle password visibility
DOM.toggleLoginPw?.addEventListener('click', () => {
  const t = DOM.loginPassword.type === 'password' ? 'text' : 'password';
  DOM.loginPassword.type = t;
  DOM.toggleLoginPw.textContent = t === 'password' ? '👁' : '🙈';
});
DOM.toggleRegPw?.addEventListener('click', () => {
  const t = DOM.regPassword.type === 'password' ? 'text' : 'password';
  DOM.regPassword.type = t;
  DOM.toggleRegPw.textContent = t === 'password' ? '👁' : '🙈';
});

// Password strength
DOM.regPassword?.addEventListener('input', () => {
  const v = DOM.regPassword.value;
  let strength = '';
  if (v.length >= 8) {
    const hasUpper = /[A-Z]/.test(v), hasNum = /[0-9]/.test(v), hasSpec = /[^A-Za-z0-9]/.test(v);
    if (hasUpper && hasNum && hasSpec) strength = 'strong';
    else if ((hasUpper || hasNum) && v.length >= 8) strength = 'medium';
    else strength = 'weak';
  }
  DOM.passwordStrength.dataset.strength = strength;
});

// Google Sign-In
async function signInWithGoogle() {
  try {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        queryParams: { access_type: 'offline', prompt: 'consent' }
      }
    });
    if (error) throw error;
  } catch (e) { showToast('Google sign-in failed: ' + e.message, 'error'); }
}
DOM.btnGoogleLogin?.addEventListener('click', signInWithGoogle);
DOM.btnGoogleRegister?.addEventListener('click', signInWithGoogle);

// Email login
DOM.btnEmailLogin?.addEventListener('click', async () => {
  const email = DOM.loginEmail.value.trim();
  const password = DOM.loginPassword.value;
  if (!email || !password) return showToast('Enter email and password.', 'warning');
  DOM.btnEmailLogin.disabled = true; DOM.btnEmailLogin.textContent = 'Signing in…';
  try {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (DOM['remember-me']?.checked) localStorage.setItem('tb_remember', email);
  } catch (e) { showToast(e.message, 'error'); }
  finally { DOM.btnEmailLogin.disabled = false; DOM.btnEmailLogin.textContent = 'Sign In'; }
});
DOM.loginEmail?.addEventListener('keydown', e => { if (e.key==='Enter') DOM.btnEmailLogin.click(); });
DOM.loginPassword?.addEventListener('keydown', e => { if (e.key==='Enter') DOM.btnEmailLogin.click(); });

// OTP
DOM.btnSendOtp?.addEventListener('click', async () => {
  const phone = DOM.loginPhone.value.trim();
  if (!phone) return showToast('Enter a phone number.', 'warning');
  DOM.btnSendOtp.disabled = true; DOM.btnSendOtp.textContent = 'Sending…';
  try {
    const { error } = await sb.auth.signInWithOtp({ phone });
    if (error) throw error;
    DOM.phoneStep1.classList.add('hidden'); DOM.phoneStep2.classList.remove('hidden');
    showToast('OTP sent! Check your phone.', 'success');
  } catch (e) { showToast(e.message, 'error'); }
  finally { DOM.btnSendOtp.disabled = false; DOM.btnSendOtp.textContent = 'Send OTP'; }
});

DOM.btnVerifyOtp?.addEventListener('click', async () => {
  const phone = DOM.loginPhone.value.trim(), token = DOM.loginOtp.value.trim();
  if (!token) return showToast('Enter the OTP code.', 'warning');
  DOM.btnVerifyOtp.disabled = true; DOM.btnVerifyOtp.textContent = 'Verifying…';
  try {
    const { error } = await sb.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) throw error;
  } catch (e) { showToast(e.message, 'error'); }
  finally { DOM.btnVerifyOtp.disabled = false; DOM.btnVerifyOtp.textContent = 'Verify & Sign In'; }
});

DOM.btnResendOtp?.addEventListener('click', () => {
  DOM.phoneStep2.classList.add('hidden'); DOM.phoneStep1.classList.remove('hidden');
  DOM.loginOtp.value = '';
});

// Register
DOM.btnRegister?.addEventListener('click', async () => {
  const username = DOM.regUsername.value.trim();
  const email    = DOM.regEmail.value.trim();
  const password = DOM.regPassword.value;
  const displayName = DOM.regDisplayName.value.trim();
  const phone    = DOM.regPhone.value.trim();
  if (!username || !email || !password) return showToast('Fill in required fields.', 'warning');
  if (password.length < 8) return showToast('Password must be at least 8 characters.', 'warning');
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return showToast('Username: letters, numbers, underscores only.', 'warning');
  DOM.btnRegister.disabled = true; DOM.btnRegister.textContent = 'Creating…';
  try {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    const userId = data.user?.id;
    if (userId) {
      await sb.from('profiles').upsert({
        id: userId, username, display_name: displayName || username,
        phone_number: phone || null, is_approved: true
      }, { onConflict: 'id' });
    }
    showToast('Account created! Check your email to confirm.', 'success', 6000);
  } catch (e) { showToast(e.message, 'error'); }
  finally { DOM.btnRegister.disabled = false; DOM.btnRegister.textContent = 'Create Account'; }
});

// Forgot password
DOM.btnForgotPw?.addEventListener('click', () => {
  DOM.authPanelLogin.classList.remove('active');
  DOM.authPanelForgot.classList.add('active');
});
DOM.btnBackToLogin?.addEventListener('click', () => {
  DOM.authPanelForgot.classList.remove('active');
  DOM.authPanelLogin.classList.add('active');
});
DOM.btnSendReset?.addEventListener('click', async () => {
  const email = DOM.forgotEmail.value.trim();
  if (!email) return showToast('Enter your email.', 'warning');
  DOM.btnSendReset.disabled = true; DOM.btnSendReset.textContent = 'Sending…';
  try {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname + '?reset=1'
    });
    if (error) throw error;
    showToast('Password reset email sent!', 'success');
  } catch (e) { showToast(e.message, 'error'); }
  finally { DOM.btnSendReset.disabled = false; DOM.btnSendReset.textContent = 'Send Reset Link'; }
});

// Sign out
DOM.btnSignout?.addEventListener('click', async () => {
  // Mark offline
  if (currentUser) {
    await sb.from('profiles').update({ is_online: false, last_seen: new Date().toISOString() }).eq('id', currentUser.id);
  }
  await sb.auth.signOut();
  currentUser = null; currentProfile = null;
  activeRoomId = null; activeRoom = null;
  rooms = []; profileCache = {};
  cleanupRealtime();
  DOM.messagesList.innerHTML = ''; DOM.roomList.innerHTML = '';
  showAuthScreen();
});

// ─────────────────────────────────────────────
// 9. AUTH STATE OBSERVER
// ─────────────────────────────────────────────
sb.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    currentUser = session.user;
    await loadCurrentProfile(session.user.id);
    showApp();
    await loadRooms();
    subscribeRoomsRealtime();
    subscribeNotifications();
    // Mark online
    sb.from('profiles').update({ is_online: true }).eq('id', currentUser.id);
    // Flush offline queue
    if (isOnline) flushOfflineQueue();
  } else {
    currentUser = null;
    showAuthScreen();
  }
});

// ─────────────────────────────────────────────
// 10. ROOMS / SIDEBAR
// ─────────────────────────────────────────────
let activeFilter = 'all';

DOM.filterTabs?.forEach(tab => {
  tab.addEventListener('click', () => {
    DOM.filterTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeFilter = tab.dataset.filter;
    renderRoomList();
  });
});

async function loadRooms() {
  if (!currentUser) return;
  try {
    const { data: memberships, error: me } = await sb.from('room_members')
      .select('room_id, is_pinned, is_archived, is_muted, unread_count')
      .eq('user_id', currentUser.id);
    if (me) throw me;
    if (!memberships?.length) { rooms = []; renderRoomList(); return; }

    const roomIds = memberships.map(m => m.room_id);
    const { data: roomData, error: re } = await sb.from('rooms')
      .select('*').in('id', roomIds).order('last_msg_at', { ascending: false, nullsFirst: false });
    if (re) throw re;

    // Merge membership data into rooms
    const memberMap = {};
    memberships.forEach(m => memberMap[m.room_id] = m);
    rooms = (roomData || []).map(r => ({ ...r, _member: memberMap[r.id] }));
    renderRoomList();
  } catch (e) { showToast('Failed to load conversations: ' + e.message, 'error'); }
}

function filterRooms(filter, text = '') {
  const lower = text.toLowerCase();
  return rooms.filter(r => {
    const m = r._member || {};
    if (text && !r.name.toLowerCase().includes(lower)) return false;
    if (filter === 'pinned')   return m.is_pinned;
    if (filter === 'archived') return m.is_archived;
    if (filter === 'unread')   return (m.unread_count || 0) > 0;
    return !m.is_archived;
  });
}

function renderRoomList(filterText = '') {
  DOM.roomList.querySelectorAll('.room-item').forEach(i => i.remove());
  const visible = filterRooms(activeFilter, filterText);
  DOM.roomListEmpty.classList.toggle('hidden', visible.length > 0);
  visible.forEach(room => DOM.roomList.appendChild(buildRoomItem(room)));
}

function buildRoomItem(room) {
  const m = room._member || {};
  const el = document.createElement('div');
  el.className = 'room-item' + (room.id === activeRoomId ? ' active' : '') + (m.is_muted ? ' room-item-muted' : '');
  el.dataset.roomId = room.id;

  const av = document.createElement('div');
  av.className = 'avatar md';
  setAvatarEl(av, room.avatar_url, room.name);

  const info = document.createElement('div');
  info.className = 'room-item-info';

  const row1 = document.createElement('div'); row1.className = 'room-item-row1';
  const nameEl = document.createElement('span'); nameEl.className = 'room-item-name'; nameEl.textContent = room.name;
  const timeEl = document.createElement('span'); timeEl.className = 'room-item-time';
  timeEl.textContent = room.last_msg_at ? formatTime(room.last_msg_at) : '';
  row1.appendChild(nameEl); row1.appendChild(timeEl);

  const lastEl = document.createElement('div'); lastEl.className = 'room-item-last-msg';
  lastEl.textContent = room.last_msg_preview || room.description || 'No messages yet';

  const badges = document.createElement('div'); badges.className = 'room-item-badges';
  if (m.is_pinned) { const pin = document.createElement('span'); pin.className='room-item-pin-icon'; pin.textContent='📌'; badges.appendChild(pin); }
  if ((m.unread_count || 0) > 0) {
    const ub = document.createElement('span'); ub.className='room-item-unread'; ub.textContent=m.unread_count; badges.appendChild(ub);
  }

  info.appendChild(row1); info.appendChild(lastEl); info.appendChild(badges);
  el.appendChild(av); el.appendChild(info);

  // Right-click room context
  el.addEventListener('contextmenu', e => { e.preventDefault(); showRoomContextMenu(e, room); });
  el.addEventListener('click', () => openRoom(room.id));
  return el;
}

function showRoomContextMenu(e, room) {
  // simple inline menu
  const existing = document.getElementById('room-ctx-menu');
  if (existing) existing.remove();
  const m = room._member || {};
  const menu = document.createElement('div');
  menu.id = 'room-ctx-menu';
  menu.className = 'context-menu';
  menu.style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
  menu.style.top  = Math.min(e.clientY, window.innerHeight - 180) + 'px';

  const items = [
    { label: m.is_pinned ? '📌 Unpin' : '📌 Pin', action: async () => {
      await sb.from('room_members').update({ is_pinned: !m.is_pinned }).eq('room_id', room.id).eq('user_id', currentUser.id);
      const r = rooms.find(r => r.id === room.id);
      if (r) r._member.is_pinned = !m.is_pinned;
      renderRoomList(); menu.remove();
    }},
    { label: m.is_muted ? '🔔 Unmute' : '🔕 Mute', action: async () => {
      await sb.from('room_members').update({ is_muted: !m.is_muted }).eq('room_id', room.id).eq('user_id', currentUser.id);
      const r = rooms.find(r => r.id === room.id);
      if (r) r._member.is_muted = !m.is_muted;
      renderRoomList(); menu.remove();
    }},
    { label: m.is_archived ? '📂 Unarchive' : '📁 Archive', action: async () => {
      await sb.from('room_members').update({ is_archived: !m.is_archived }).eq('room_id', room.id).eq('user_id', currentUser.id);
      const r = rooms.find(r => r.id === room.id);
      if (r) r._member.is_archived = !m.is_archived;
      renderRoomList(); menu.remove();
    }},
  ];

  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'context-item'; btn.textContent = item.label;
    btn.addEventListener('click', item.action);
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  setTimeout(() => { document.addEventListener('click', () => menu.remove(), { once: true }); }, 10);
}

function updateRoomItemInSidebar(room) {
  const existing = DOM.roomList.querySelector(`[data-room-id="${room.id}"]`);
  const newEl = buildRoomItem(room);
  if (existing) DOM.roomList.replaceChild(newEl, existing);
  else { DOM.roomList.prepend(newEl); DOM.roomListEmpty.classList.add('hidden'); }
}

// ─────────────────────────────────────────────
// 11. OPEN ROOM
// ─────────────────────────────────────────────
async function openRoom(roomId) {
  if (activeRoomId === roomId) return;

  // Reset state
  cancelReply();
  closeEmojiPicker();
  activeRoomId = roomId;
  chatSearchResults = []; chatSearchCurrent = -1;
  DOM.inChatSearch.classList.add('hidden');

  DOM.roomList.querySelectorAll('.room-item').forEach(el =>
    el.classList.toggle('active', el.dataset.roomId === roomId)
  );

  DOM.chatEmptyState.classList.add('hidden');
  DOM.chatView.classList.remove('hidden');
  if (window.innerWidth <= 768) DOM.sidebar.classList.add('hidden-mobile');

  DOM.messagesLoading.classList.remove('hidden');
  DOM.messagesList.innerHTML = '';
  DOM.pinnedBar.classList.add('hidden');

  try {
    const { data: room, error: rErr } = await sb.from('rooms').select('*').eq('id', roomId).single();
    if (rErr) throw rErr;
    activeRoom = room;
    renderChatHeader(room);
    await loadRoomMembers(roomId);

    const { data: msgs, error: mErr } = await sb.from('messages')
      .select('*').eq('room_id', roomId).eq('is_scheduled', false)
      .order('created_at', { ascending: true });
    if (mErr) throw mErr;

    DOM.messagesLoading.classList.add('hidden');
    const filtered = (msgs || []).filter(m => !m.deleted_by_users?.includes(currentUser.id) && !m.deleted_for_all);
    await renderMessages(filtered);
    scrollToBottom(true);

    subscribeRoomRealtime(roomId);

    // Reset unread count
    await sb.from('room_members').update({ unread_count: 0 }).eq('room_id', roomId).eq('user_id', currentUser.id);
    const r = rooms.find(r => r.id === roomId);
    if (r && r._member) { r._member.unread_count = 0; updateRoomItemInSidebar(r); }

    // Load pinned message
    loadPinnedMessage(roomId);

  } catch (e) {
    DOM.messagesLoading.classList.add('hidden');
    showToast('Failed to open chat: ' + e.message, 'error');
  }
}

async function loadPinnedMessage(roomId) {
  try {
    const { data } = await sb.from('pinned_messages').select('*, messages(*)').eq('room_id', roomId).limit(1).maybeSingle();
    if (data?.messages) {
      const msg = data.messages;
      DOM.pinnedBarText.textContent = '📍 ' + (msg.content || '(media message)');
      DOM.pinnedBar.classList.remove('hidden');
      DOM.pinnedBar.onclick = () => {
        const el = DOM.messagesList.querySelector(`[data-msg-id="${msg.id}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
    }
  } catch {}
}

DOM.btnClosePinnedBar?.addEventListener('click', e => { e.stopPropagation(); DOM.pinnedBar.classList.add('hidden'); });

function renderChatHeader(room) {
  setAvatarEl(DOM.chatHeaderAvatar, room.avatar_url, room.name);
  DOM.chatHeaderName.textContent = room.name;
  DOM.chatHeaderMeta.textContent = room.is_personal_chat ? 'Personal Chat' : `${roomMembers.length} member${roomMembers.length!==1?'s':''}`;
}

async function loadRoomMembers(roomId) {
  roomMembers = []; myRoomRole = 'member';
  try {
    const { data } = await sb.from('room_members').select('*, profiles(*)').eq('room_id', roomId);
    roomMembers = data || [];
    const me = roomMembers.find(m => m.user_id === currentUser.id);
    if (me) myRoomRole = me.role;
    roomMembers.forEach(m => { if (m.profiles) profileCache[m.user_id] = m.profiles; });
  } catch {}
}

// ─────────────────────────────────────────────
// 12. RENDER MESSAGES
// ─────────────────────────────────────────────
async function renderMessages(msgs) {
  DOM.messagesList.innerHTML = '';
  let lastDate = null, lastSenderId = null;
  for (const msg of msgs) {
    const msgDate = formatDate(msg.created_at);
    if (msgDate !== lastDate) {
      DOM.messagesList.appendChild(buildDateSeparator(msgDate));
      lastDate = msgDate; lastSenderId = null;
    }
    const isOwn = msg.sender_id === currentUser.id;
    const isGroup = activeRoom && !activeRoom.is_personal_chat;
    const showSender = isGroup && !isOwn && msg.sender_id !== lastSenderId;
    const el = await buildMessageGroup(msg, isOwn, showSender);
    DOM.messagesList.appendChild(el);
    lastSenderId = msg.sender_id;
  }
}

function buildDateSeparator(label) {
  const el = document.createElement('div');
  el.className = 'date-separator'; el.textContent = label;
  return el;
}

async function buildMessageGroup(msg, isOwn, showSender) {
  const group = document.createElement('div');
  group.className = `message-group ${isOwn ? 'outgoing' : 'incoming'}`;
  group.dataset.msgId = msg.id;

  if (showSender && !isOwn) {
    const profile = await getOrFetchProfile(msg.sender_id);
    const sRow = document.createElement('div');
    sRow.className = 'message-group-sender-row';
    const av = document.createElement('div'); av.className = 'avatar xs';
    setAvatarEl(av, profile?.avatar_url, profile?.username);
    const nm = document.createElement('span'); nm.className = 'sender-name-label';
    nm.textContent = profile?.display_name || profile?.username || 'Unknown';
    sRow.appendChild(av); sRow.appendChild(nm);
    group.appendChild(sRow);
  }

  const row = document.createElement('div'); row.className = 'message-row';

  if (!isOwn) {
    const slot = document.createElement('div'); slot.className = 'message-avatar-slot';
    if (showSender) {
      const profile = await getOrFetchProfile(msg.sender_id);
      const av = document.createElement('div'); av.className = 'avatar xs';
      setAvatarEl(av, profile?.avatar_url, profile?.username);
      slot.appendChild(av);
    }
    row.appendChild(slot);
  }

  const bubbleWrap = document.createElement('div'); bubbleWrap.style.display='flex'; bubbleWrap.style.flexDirection='column';
  if (isOwn) bubbleWrap.style.alignItems='flex-end';

  const bubble = await buildBubble(msg, isOwn);
  bubbleWrap.appendChild(bubble);

  // Reactions
  const reactions = await buildReactions(msg);
  if (reactions) bubbleWrap.appendChild(reactions);

  row.appendChild(bubbleWrap);
  group.appendChild(row);

  // Hover actions bar
  const actBar = buildHoverActions(msg, isOwn, group);
  group.appendChild(actBar);

  // Context menu
  group.addEventListener('contextmenu', e => { e.preventDefault(); openContextMenu(e, msg, group); });
  let lp;
  group.addEventListener('touchstart', () => { lp = setTimeout(() => openContextMenu({clientX:100,clientY:200}, msg, group), 600); });
  group.addEventListener('touchend',   () => clearTimeout(lp));
  group.addEventListener('touchmove',  () => clearTimeout(lp));

  return group;
}

function buildHoverActions(msg, isOwn, group) {
  const bar = document.createElement('div');
  bar.className = 'bubble-hover-actions';
  bar.style.cssText = `
    position:absolute; ${isOwn?'left':'right'}:calc(100% + 4px); top:50%; transform:translateY(-50%);
    display:none; gap:2px; background:var(--bg-elevated);
    border:1px solid var(--border); border-radius:var(--radius-sm);
    padding:2px; box-shadow:var(--shadow-sm); z-index:10;
  `;
  group.style.position='relative';
  group.addEventListener('mouseenter', () => bar.style.display='flex');
  group.addEventListener('mouseleave', () => bar.style.display='none');

  const actions = [
    { title:'React', icon:'😊', action: e => openReactionPicker(e, msg, group) },
    { title:'Reply', icon:'↩',  action: () => setReply(msg) },
  ];
  if (isOwn && msg.message_type === 'text') actions.push({ title:'Edit', icon:'✏️', action: () => startEdit(msg, group) });
  actions.push({ title:'Forward', icon:'↗', action: () => openForwardModal(msg) });

  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.title = a.title; btn.textContent = a.icon;
    btn.style.cssText='background:none;border:none;cursor:pointer;padding:3px 5px;font-size:13px;border-radius:4px;';
    btn.addEventListener('click', e => { e.stopPropagation(); a.action(e); });
    bar.appendChild(btn);
  });
  return bar;
}

async function buildBubble(msg, isOwn) {
  const bubble = document.createElement('div');

  // Reply preview
  if (msg.reply_to) {
    const replyMsg = await getMessageById(msg.reply_to);
    if (replyMsg) {
      const replyDiv = document.createElement('div');
      replyDiv.className = 'reply-bubble';
      const replyProfile = await getOrFetchProfile(replyMsg.sender_id);
      replyDiv.innerHTML = `<div class="reply-bubble-sender">${escapeHtml(replyProfile?.username||'Unknown')}</div>
        <div class="reply-bubble-text">${escapeHtml(replyMsg.content||'(media)')}</div>`;
      replyDiv.addEventListener('click', () => {
        const el = DOM.messagesList.querySelector(`[data-msg-id="${msg.reply_to}"]`);
        if (el) el.scrollIntoView({behavior:'smooth',block:'center'});
      });
      bubble.appendChild(replyDiv);
    }
  }

  switch(msg.message_type) {
    case 'image': {
      bubble.className = 'bubble bubble-image';
      const inner = document.createElement('div'); inner.className = 'bubble-image-inner';
      const img = document.createElement('img');
      img.src = escapeHtml(msg.media_url); img.alt = 'Image'; img.loading = 'lazy';
      img.addEventListener('click', () => openLightbox(msg.media_url));
      const overlay = document.createElement('div'); overlay.className = 'bubble-image-overlay';
      const exBtn = document.createElement('button'); exBtn.className='bubble-expand-btn'; exBtn.textContent='🔍 View';
      exBtn.addEventListener('click', e => { e.stopPropagation(); openLightbox(msg.media_url); });
      const dlBtn = document.createElement('button'); dlBtn.className='bubble-dl-btn'; dlBtn.textContent='⬇ Save';
      dlBtn.addEventListener('click', e => { e.stopPropagation(); downloadFileFromUrl(msg.media_url,'img_'+msg.id); });
      overlay.appendChild(exBtn); overlay.appendChild(dlBtn);
      inner.appendChild(img); inner.appendChild(overlay);
      const footer = document.createElement('div'); footer.className='bubble-footer';
      footer.innerHTML=`<span class="bubble-time">${formatTime(msg.created_at)}</span>`;
      inner.appendChild(footer);
      bubble.appendChild(inner);
      break;
    }
    case 'audio': {
      bubble.className = 'bubble bubble-audio';
      const audioId = 'audio-' + msg.id;
      bubble.innerHTML = `
        <div class="audio-player">
          <button class="audio-play-btn"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg></button>
          <div class="audio-track-wrap">
            <input type="range" class="audio-track" min="0" max="100" value="0" step="0.1" />
            <div class="audio-time"><span class="audio-current">0:00</span><span class="audio-duration">0:00</span></div>
          </div>
        </div>
        <audio id="${audioId}" src="${escapeHtml(msg.media_url)}" preload="metadata"></audio>
        <div class="bubble-footer"><span class="bubble-time">${formatTime(msg.created_at)}</span></div>`;
      wireAudioPlayer(bubble);
      break;
    }
    case 'file': {
      bubble.className = 'bubble bubble-file';
      bubble.innerHTML = `
        <div class="file-icon">${getFileIcon(msg.media_mime)}</div>
        <div class="file-info">
          <div class="file-name">${escapeHtml(msg.media_name||'File')}</div>
          <div class="file-size">${formatFileSize(msg.media_size)}</div>
        </div>
        <button class="file-dl-btn" title="Download">⬇</button>
        <div class="bubble-footer"><span class="bubble-time">${formatTime(msg.created_at)}</span></div>`;
      bubble.querySelector('.file-dl-btn')?.addEventListener('click', () => downloadFileFromUrl(msg.media_url, msg.media_name||'file'));
      break;
    }
    default: {
      bubble.className = 'bubble';
      const textEl = document.createElement('div'); textEl.className='bubble-text';
      textEl.innerHTML = renderMarkdown(msg.content || '');
      bubble.appendChild(textEl);
      const footer = document.createElement('div'); footer.className='bubble-footer';
      const timeEl = document.createElement('span'); timeEl.className='bubble-time'; timeEl.textContent=formatTime(msg.created_at);
      footer.appendChild(timeEl);
      if (msg.is_edited) { const ed=document.createElement('span'); ed.className='bubble-edited'; ed.textContent='edited'; footer.appendChild(ed); }
      if (isOwn) { const st=document.createElement('span'); st.className='bubble-status'; st.textContent='✓✓'; footer.appendChild(st); }
      bubble.appendChild(footer);
    }
  }
  return bubble;
}

async function buildReactions(msg) {
  try {
    const { data } = await sb.from('message_reactions').select('*').eq('message_id', msg.id);
    if (!data?.length) return null;

    const grouped = {};
    data.forEach(r => {
      if (!grouped[r.emoji]) grouped[r.emoji] = [];
      grouped[r.emoji].push(r.user_id);
    });

    const wrap = document.createElement('div'); wrap.className='bubble-reactions';
    Object.entries(grouped).forEach(([emoji, users]) => {
      const chip = document.createElement('button'); chip.className='reaction-chip';
      if (users.includes(currentUser.id)) chip.classList.add('mine');
      chip.innerHTML = `${emoji}<span class="count">${users.length}</span>`;
      chip.title = users.length + ' reaction(s)';
      chip.addEventListener('click', () => toggleReaction(msg.id, emoji));
      wrap.appendChild(chip);
    });
    return wrap;
  } catch { return null; }
}

async function getMessageById(id) {
  try {
    const { data } = await sb.from('messages').select('*').eq('id', id).single();
    return data;
  } catch { return null; }
}

// ─────────────────────────────────────────────
// 13. APPEND MESSAGE (realtime)
// ─────────────────────────────────────────────
async function appendMessage(msg) {
  if (!msg || msg.room_id !== activeRoomId) return;
  if (msg.deleted_by_users?.includes(currentUser?.id) || msg.deleted_for_all) return;
  const placeholder = document.createElement('div');
  DOM.messagesList.appendChild(placeholder);
  try {
    const isOwn   = msg.sender_id === currentUser?.id;
    const isGroup = activeRoom && !activeRoom.is_personal_chat;
    const prev    = placeholder.previousElementSibling;
    const showSender = isGroup && !isOwn && (msg.sender_id !== prev?.dataset?.lastSenderId);
    const groupEl = await buildMessageGroup(msg, isOwn, showSender);
    groupEl.dataset.lastSenderId = msg.sender_id;
    placeholder.replaceWith(groupEl);
    const atBottom = DOM.messagesContainer.scrollHeight - DOM.messagesContainer.scrollTop - DOM.messagesContainer.clientHeight < 100;
    if (atBottom) scrollToBottom();
    else showScrollButton();
    // Desktop notification
    if (!isOwn && notifPermission === 'granted') {
      const profile = await getOrFetchProfile(msg.sender_id);
      new Notification(`${profile?.username || 'Someone'} in ${activeRoom?.name || 'Telebey'}`, {
        body: msg.content || '(media)',
        icon: profile?.avatar_url || '/icon-192.png'
      });
    }
    // Notification sound
    if (!isOwn && localStorage.getItem('tb_notif_sound') !== 'false') playNotifSound();
  } catch(e) { placeholder.remove(); }
}

function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

function scrollToBottom(instant = false) {
  DOM.messagesAnchor.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' });
  DOM.btnScrollBottom.classList.add('hidden');
}

function showScrollButton() {
  DOM.btnScrollBottom.classList.remove('hidden');
}

DOM.btnScrollBottom?.addEventListener('click', () => scrollToBottom());

DOM.messagesContainer?.addEventListener('scroll', () => {
  const atBottom = DOM.messagesContainer.scrollHeight - DOM.messagesContainer.scrollTop - DOM.messagesContainer.clientHeight < 60;
  if (atBottom) DOM.btnScrollBottom.classList.add('hidden');
});

// ─────────────────────────────────────────────
// 14. SEND MESSAGES
// ─────────────────────────────────────────────
async function sendTextMessage() {
  const content = DOM.messageInput.value.trim();
  if (!content || !activeRoomId) return;
  DOM.messageInput.value = ''; DOM.messageInput.style.height='auto';

  if (!isOnline) {
    offlineQueue.push({ room_id: activeRoomId, content, created_at: new Date().toISOString() });
    saveOfflineQueue();
    showToast('Offline — message queued.', 'warning', 3000);
    return;
  }

  const msgPayload = {
    room_id: activeRoomId, sender_id: currentUser.id,
    content, message_type: 'text',
    reply_to: replyTargetMsg?.id || null,
  };
  cancelReply();

  try {
    const { data: inserted, error } = await sb.from('messages').insert(msgPayload).select().single();
    if (error) throw error;
    pendingMsgId = inserted.id;

    // Append optimistically
    await appendMessage(inserted);
    updateRoomPreview(activeRoomId, content, inserted.created_at);

    // Show undo bar
    showUndoBar(inserted.id);
  } catch (e) { showToast('Failed to send: ' + e.message, 'error'); }
}

function showUndoBar(msgId) {
  if (undoTimer) clearTimeout(undoTimer);
  DOM.undoBar.classList.remove('hidden');
  // reset animation
  const prog = $('undo-progress');
  prog.style.animation = 'none'; prog.offsetHeight;
  prog.style.animation = '';
  undoTimer = setTimeout(() => DOM.undoBar.classList.add('hidden'), UNDO_DELAY_MS);
  pendingMsgId = msgId;
}

DOM.btnUndoSend?.addEventListener('click', async () => {
  if (!pendingMsgId) return;
  clearTimeout(undoTimer);
  DOM.undoBar.classList.add('hidden');
  try {
    await sb.from('messages').delete().eq('id', pendingMsgId);
    DOM.messagesList.querySelector(`[data-msg-id="${pendingMsgId}"]`)?.remove();
    showToast('Message unsent.', 'info', 2000);
  } catch (e) { showToast('Could not undo: ' + e.message, 'error'); }
  pendingMsgId = null;
});

async function sendImageMessage(file) {
  if (!file || !activeRoomId) return;
  const ext  = file.name.split('.').pop() || 'jpg';
  const path = `images/${activeRoomId}/${Date.now()}_${currentUser.id}.${ext}`;
  showToast('Uploading…', 'info', 3000);
  try {
    const { error: up } = await sb.storage.from(MEDIA_BUCKET).upload(path, file, { cacheControl:'3600', upsert:false, contentType:file.type });
    if (up) throw up;
    const { error } = await sb.from('messages').insert({
      room_id: activeRoomId, sender_id: currentUser.id, content:'',
      message_type: 'image', media_url: getPublicUrl(path),
      reply_to: replyTargetMsg?.id || null,
    });
    if (error) throw error;
    cancelReply();
    updateRoomPreview(activeRoomId, '📷 Photo', new Date().toISOString());
  } catch (e) { showToast('Upload failed: ' + e.message, 'error'); }
}

async function sendFileMessage(file) {
  if (!file || !activeRoomId) return;
  const path = `files/${activeRoomId}/${Date.now()}_${encodeURIComponent(file.name)}`;
  showToast('Uploading file…', 'info', 3000);
  try {
    const { error: up } = await sb.storage.from(MEDIA_BUCKET).upload(path, file, { cacheControl:'3600', upsert:false, contentType:file.type });
    if (up) throw up;
    const { error } = await sb.from('messages').insert({
      room_id: activeRoomId, sender_id: currentUser.id, content:'',
      message_type: 'file', media_url: getPublicUrl(path),
      media_name: file.name, media_size: file.size, media_mime: file.type,
      reply_to: replyTargetMsg?.id || null,
    });
    if (error) throw error;
    cancelReply();
    updateRoomPreview(activeRoomId, '📎 ' + file.name, new Date().toISOString());
  } catch (e) { showToast('Upload failed: ' + e.message, 'error'); }
}

async function sendAudioMessage(blob) {
  if (!activeRoomId) return;
  const path = `audio/${activeRoomId}/${Date.now()}_${currentUser.id}.webm`;
  showToast('Sending voice note…', 'info', 2000);
  try {
    const { error: up } = await sb.storage.from(MEDIA_BUCKET).upload(path, blob, { cacheControl:'3600', upsert:false, contentType:'audio/webm' });
    if (up) throw up;
    const { error } = await sb.from('messages').insert({
      room_id: activeRoomId, sender_id: currentUser.id, content:'',
      message_type: 'audio', media_url: getPublicUrl(path),
    });
    if (error) throw error;
    updateRoomPreview(activeRoomId, '🎤 Voice Note', new Date().toISOString());
  } catch (e) { showToast('Voice send failed: ' + e.message, 'error'); }
}

function updateRoomPreview(roomId, preview, time) {
  const idx = rooms.findIndex(r => r.id === roomId);
  if (idx !== -1) {
    rooms[idx].last_msg_preview = preview; rooms[idx].last_msg_at = time;
    updateRoomItemInSidebar(rooms[idx]);
  }
}

// ─────────────────────────────────────────────
// 15. INPUT EVENT HANDLERS
// ─────────────────────────────────────────────
DOM.btnSend?.addEventListener('click', sendTextMessage);
DOM.messageInput?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTextMessage(); }
});
DOM.messageInput?.addEventListener('input', () => {
  DOM.messageInput.style.height = 'auto';
  DOM.messageInput.style.height = Math.min(DOM.messageInput.scrollHeight, 140) + 'px';
});

// Attach popup
DOM.btnAttach?.addEventListener('click', e => { e.stopPropagation(); DOM.attachPopup.classList.toggle('hidden'); });
document.addEventListener('click', () => DOM.attachPopup?.classList.add('hidden'));
DOM.attImage?.addEventListener('click', () => { DOM.attachPopup.classList.add('hidden'); DOM.fileInput.click(); });
DOM.attFile?.addEventListener('click',  () => { DOM.attachPopup.classList.add('hidden'); DOM.fileInputAny.click(); });
DOM.attGif?.addEventListener('click',   () => { DOM.attachPopup.classList.add('hidden'); showToast('GIF support coming soon!', 'info'); });

DOM.fileInput?.addEventListener('change', async () => {
  const file = DOM.fileInput.files[0];
  if (file) { await sendImageMessage(file); DOM.fileInput.value = ''; }
});
DOM.fileInputAny?.addEventListener('change', async () => {
  const file = DOM.fileInputAny.files[0];
  if (file) { await sendFileMessage(file); DOM.fileInputAny.value = ''; }
});

// Drag & drop
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', async e => {
  e.preventDefault();
  if (!activeRoomId) return;
  const files = Array.from(e.dataTransfer.files);
  for (const file of files) {
    if (file.type.startsWith('image/')) await sendImageMessage(file);
    else await sendFileMessage(file);
  }
});

// Emoji picker
DOM.btnEmoji?.addEventListener('click', e => { e.stopPropagation(); toggleEmojiPicker(); });
DOM.emojiContainer?.addEventListener('emoji-click', e => {
  DOM.messageInput.value += e.detail.unicode;
  DOM.messageInput.focus();
});
document.addEventListener('click', e => {
  if (!DOM.emojiContainer?.contains(e.target) && e.target !== DOM.btnEmoji) closeEmojiPicker();
});
function toggleEmojiPicker() { DOM.emojiContainer?.classList.toggle('hidden'); }
function closeEmojiPicker()  { DOM.emojiContainer?.classList.add('hidden'); }

// ─────────────────────────────────────────────
// 16. REPLY
// ─────────────────────────────────────────────
function setReply(msg) {
  replyTargetMsg = msg;
  DOM.replyPreview.classList.remove('hidden');
  getOrFetchProfile(msg.sender_id).then(p => {
    DOM.replyPreviewSender.textContent = p?.username || 'Unknown';
  });
  DOM.replyPreviewText.textContent = msg.content || '(media)';
  DOM.messageInput.focus();
}
function cancelReply() {
  replyTargetMsg = null;
  DOM.replyPreview.classList.add('hidden');
}
DOM.btnCancelReply?.addEventListener('click', cancelReply);

// ─────────────────────────────────────────────
// 17. EDIT MESSAGE
// ─────────────────────────────────────────────
function startEdit(msg, groupEl) {
  const bubble = groupEl.querySelector('.bubble');
  const textEl = bubble.querySelector('.bubble-text');
  if (!textEl) return;

  const original = msg.content;
  const textarea = document.createElement('textarea');
  textarea.className = 'bubble-edit-input';
  textarea.value = original;
  textarea.rows = 2;
  textEl.replaceWith(textarea);

  const actions = document.createElement('div'); actions.className='bubble-edit-actions';
  const saveBtn   = document.createElement('button'); saveBtn.className='bubble-edit-save';   saveBtn.textContent='Save';
  const cancelBtn = document.createElement('button'); cancelBtn.className='bubble-edit-cancel'; cancelBtn.textContent='Cancel';
  actions.appendChild(cancelBtn); actions.appendChild(saveBtn);
  bubble.appendChild(actions);
  textarea.focus();

  cancelBtn.addEventListener('click', () => {
    textarea.replaceWith(textEl); actions.remove();
  });
  saveBtn.addEventListener('click', async () => {
    const newContent = textarea.value.trim();
    if (!newContent || newContent === original) { textarea.replaceWith(textEl); actions.remove(); return; }
    try {
      const { error } = await sb.from('messages').update({ content: newContent, is_edited: true, edited_at: new Date().toISOString() }).eq('id', msg.id);
      if (error) throw error;
      msg.content = newContent;
      const newText = document.createElement('div'); newText.className='bubble-text';
      newText.innerHTML = renderMarkdown(newContent);
      textarea.replaceWith(newText); actions.remove();
      // update edited label
      const footer = bubble.querySelector('.bubble-footer');
      if (footer && !footer.querySelector('.bubble-edited')) {
        const ed = document.createElement('span'); ed.className='bubble-edited'; ed.textContent='edited';
        footer.insertBefore(ed, footer.querySelector('.bubble-status'));
      }
      showToast('Message edited.', 'success', 2000);
    } catch (e) { showToast(e.message, 'error'); }
  });
}

// ─────────────────────────────────────────────
// 18. REACTIONS
// ─────────────────────────────────────────────
function openReactionPicker(e, msg, groupEl) {
  DOM.reactionPicker.classList.remove('hidden');
  const x = Math.min(e.clientX || 100, window.innerWidth  - 220);
  const y = Math.max((e.clientY || 200) - 60, 10);
  DOM.reactionPicker.style.left = x + 'px';
  DOM.reactionPicker.style.top  = y + 'px';
  DOM.reactionPicker.dataset.msgId = msg.id;
  setTimeout(() => {
    document.addEventListener('click', () => DOM.reactionPicker.classList.add('hidden'), { once: true });
  }, 10);
}

DOM.reactionPicker?.addEventListener('click', async e => {
  const btn = e.target.closest('.react-btn');
  if (!btn) return;
  const msgId = DOM.reactionPicker.dataset.msgId;
  DOM.reactionPicker.classList.add('hidden');
  if (msgId) await toggleReaction(msgId, btn.dataset.emoji);
});

async function toggleReaction(messageId, emoji) {
  if (!currentUser) return;
  try {
    const { data: existing } = await sb.from('message_reactions')
      .select('id').eq('message_id', messageId).eq('user_id', currentUser.id).eq('emoji', emoji).maybeSingle();
    if (existing) {
      await sb.from('message_reactions').delete().eq('id', existing.id);
    } else {
      await sb.from('message_reactions').insert({ message_id: messageId, user_id: currentUser.id, emoji });
    }
    // Refresh reactions on message
    const groupEl = DOM.messagesList.querySelector(`[data-msg-id="${messageId}"]`);
    if (groupEl) {
      const msg = await getMessageById(messageId);
      if (msg) {
        const oldReactions = groupEl.querySelector('.bubble-reactions');
        const newReactions = await buildReactions(msg);
        if (oldReactions) { if (newReactions) oldReactions.replaceWith(newReactions); else oldReactions.remove(); }
        else if (newReactions) groupEl.querySelector('.message-row')?.appendChild(newReactions);
      }
    }
  } catch(e) { showToast(e.message, 'error'); }
}

// ─────────────────────────────────────────────
// 19. FORWARD MESSAGE
// ─────────────────────────────────────────────
let forwardMsg = null;

function openForwardModal(msg) {
  forwardMsg = msg;
  DOM.forwardSearch.value = '';
  renderForwardList('');
  openModal('modal-forward');
}

function renderForwardList(query) {
  DOM.forwardList.innerHTML = '';
  const lower = query.toLowerCase();
  const filtered = rooms.filter(r => !query || r.name.toLowerCase().includes(lower));
  filtered.forEach(room => {
    const el = document.createElement('div'); el.className='forward-room-item';
    const av = document.createElement('div'); av.className='avatar sm';
    setAvatarEl(av, room.avatar_url, room.name);
    const name = document.createElement('span'); name.className='name'; name.textContent=room.name;
    const btn = document.createElement('button'); btn.className='fwd-btn'; btn.textContent='Forward';
    btn.addEventListener('click', async () => {
      closeModal('modal-forward');
      if (!forwardMsg) return;
      try {
        await sb.from('messages').insert({
          room_id: room.id, sender_id: currentUser.id,
          content: forwardMsg.content || '',
          message_type: forwardMsg.message_type,
          media_url: forwardMsg.media_url || null,
          forward_from: forwardMsg.id,
        });
        showToast(`Forwarded to ${room.name}!`, 'success', 2000);
      } catch(e) { showToast(e.message, 'error'); }
    });
    el.appendChild(av); el.appendChild(name); el.appendChild(btn);
    DOM.forwardList.appendChild(el);
  });
}

DOM.forwardSearch?.addEventListener('input', () => renderForwardList(DOM.forwardSearch.value.trim()));

// ─────────────────────────────────────────────
// 20. SAVE / BOOKMARK MESSAGES
// ─────────────────────────────────────────────
async function saveMessage(msg) {
  try {
    await sb.from('message_bookmarks').upsert({ user_id: currentUser.id, message_id: msg.id }, { onConflict: 'user_id,message_id' });
    showToast('Message saved! ✨', 'success', 2000);
  } catch(e) { showToast(e.message, 'error'); }
}

async function loadSavedMessages() {
  DOM.savedMessagesList.innerHTML = '';
  try {
    const { data } = await sb.from('message_bookmarks').select('*, messages(*, profiles(*))').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    if (!data?.length) {
      DOM.savedMessagesList.innerHTML = '<div class="empty-state-sm">No saved messages yet.<br><small>Right-click any message to save it.</small></div>';
      return;
    }
    data.forEach(bm => {
      const msg = bm.messages; if (!msg) return;
      const el = document.createElement('div'); el.className='saved-msg-item';
      const av = document.createElement('div'); av.className='avatar xs';
      setAvatarEl(av, msg.profiles?.avatar_url, msg.profiles?.username);
      const content = document.createElement('div'); content.className='sm-content';
      content.innerHTML=`<div class="sm-sender">${escapeHtml(msg.profiles?.username||'Unknown')}</div>
        <div class="sm-text">${escapeHtml(msg.content||'(media)')}</div>
        <div class="sm-time">${formatDate(msg.created_at)} ${formatTime(msg.created_at)}</div>`;
      const removeBtn = document.createElement('button'); removeBtn.className='saved-msg-remove'; removeBtn.textContent='×';
      removeBtn.addEventListener('click', async () => {
        await sb.from('message_bookmarks').delete().eq('user_id', currentUser.id).eq('message_id', msg.id);
        el.remove();
        showToast('Removed from saved.', 'info', 1500);
      });
      el.appendChild(av); el.appendChild(content); el.appendChild(removeBtn);
      DOM.savedMessagesList.appendChild(el);
    });
  } catch(e) { DOM.savedMessagesList.innerHTML = '<div class="empty-state-sm">Failed to load.</div>'; }
}

DOM.btnSavedMessages?.addEventListener('click', async () => { await loadSavedMessages(); openModal('modal-saved'); });

// ─────────────────────────────────────────────
// 21. PIN MESSAGE
// ─────────────────────────────────────────────
async function pinMessage(msg) {
  if (!activeRoom || myRoomRole === 'member') return showToast('Only admins can pin messages.', 'warning');
  try {
    await sb.from('pinned_messages').upsert({ room_id: activeRoom.id, message_id: msg.id, pinned_by: currentUser.id }, { onConflict: 'room_id,message_id' });
    DOM.pinnedBarText.textContent = '📍 ' + (msg.content || '(media)');
    DOM.pinnedBar.classList.remove('hidden');
    showToast('Message pinned!', 'success', 2000);
  } catch(e) { showToast(e.message, 'error'); }
}

// ─────────────────────────────────────────────
// 22. IN-CHAT SEARCH
// ─────────────────────────────────────────────
DOM.btnSearchMsgs?.addEventListener('click', () => {
  DOM.inChatSearch.classList.toggle('hidden');
  if (!DOM.inChatSearch.classList.contains('hidden')) DOM.inChatSearchInput.focus();
});
DOM.btnCloseSearch?.addEventListener('click', () => {
  DOM.inChatSearch.classList.add('hidden');
  clearChatSearch();
});

DOM.inChatSearchInput?.addEventListener('input', () => {
  const q = DOM.inChatSearchInput.value.trim();
  if (!q) { clearChatSearch(); return; }
  const allGroups = DOM.messagesList.querySelectorAll('.message-group');
  chatSearchResults = [];
  allGroups.forEach(g => {
    const text = g.querySelector('.bubble-text')?.textContent || '';
    if (text.toLowerCase().includes(q.toLowerCase())) chatSearchResults.push(g);
  });
  DOM.inChatSearchCount.textContent = `${chatSearchResults.length} result(s)`;
  chatSearchCurrent = chatSearchResults.length ? 0 : -1;
  scrollToChatSearchResult();
});

DOM.btnSearchNext?.addEventListener('click', () => {
  if (!chatSearchResults.length) return;
  chatSearchCurrent = (chatSearchCurrent + 1) % chatSearchResults.length;
  scrollToChatSearchResult();
});
DOM.btnSearchPrev?.addEventListener('click', () => {
  if (!chatSearchResults.length) return;
  chatSearchCurrent = (chatSearchCurrent - 1 + chatSearchResults.length) % chatSearchResults.length;
  scrollToChatSearchResult();
});

function scrollToChatSearchResult() {
  chatSearchResults.forEach((g,i) => g.classList.toggle('msg-search-current', i===chatSearchCurrent));
  if (chatSearchCurrent >= 0) chatSearchResults[chatSearchCurrent]?.scrollIntoView({ behavior:'smooth', block:'center' });
}
function clearChatSearch() {
  chatSearchResults.forEach(g => g.classList.remove('msg-search-current'));
  chatSearchResults = []; chatSearchCurrent = -1;
  DOM.inChatSearchCount.textContent = '';
}

// ─────────────────────────────────────────────
// 23. VOICE RECORDING
// ─────────────────────────────────────────────
DOM.btnMic?.addEventListener('click', async () => { isRecording ? stopRecording() : await startRecording(); });
DOM.btnCancelRecording?.addEventListener('click', cancelRecording);

async function startRecording() {
  if (!activeRoomId) return showToast('Open a chat first.', 'warning');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      if (audioChunks.length && recordingSeconds > 0) await sendAudioMessage(new Blob(audioChunks, { type:'audio/webm' }));
      audioChunks = [];
    };
    mediaRecorder.start(100);
    isRecording = true; recordingSeconds = 0;
    DOM.recordingIndicator.classList.remove('hidden');
    DOM.micIconNormal.classList.add('hidden'); DOM.micIconRecording.classList.remove('hidden');
    DOM.btnMic.classList.add('recording'); DOM.recordingTimer.textContent = '0:00';
    recordingTimerInt = setInterval(() => {
      recordingSeconds++;
      DOM.recordingTimer.textContent = formatDuration(recordingSeconds);
    }, 1000);
  } catch(e) { showToast('Microphone access denied.', 'error'); }
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state==='inactive') return;
  clearInterval(recordingTimerInt);
  mediaRecorder.stop(); isRecording = false;
  DOM.recordingIndicator.classList.add('hidden');
  DOM.micIconNormal.classList.remove('hidden'); DOM.micIconRecording.classList.add('hidden');
  DOM.btnMic.classList.remove('recording');
}

function cancelRecording() {
  audioChunks = []; recordingSeconds = 0;
  stopRecording();
}

function wireAudioPlayer(bubble) {
  const audio   = bubble.querySelector('audio');
  const playBtn = bubble.querySelector('.audio-play-btn');
  const track   = bubble.querySelector('.audio-track');
  const currEl  = bubble.querySelector('.audio-current');
  const durEl   = bubble.querySelector('.audio-duration');
  const playIcon  = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>`;
  const pauseIcon = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
  audio.addEventListener('loadedmetadata', () => { durEl.textContent=formatDuration(Math.floor(audio.duration)); track.max=audio.duration; });
  audio.addEventListener('timeupdate', () => { currEl.textContent=formatDuration(Math.floor(audio.currentTime)); if(!isNaN(audio.duration)) track.value=audio.currentTime; });
  audio.addEventListener('ended', () => { playBtn.innerHTML=playIcon; track.value=0; currEl.textContent='0:00'; });
  playBtn.addEventListener('click', () => {
    if (audio.paused) { document.querySelectorAll('audio').forEach(a => { if(a!==audio) a.pause(); }); audio.play(); playBtn.innerHTML=pauseIcon; }
    else { audio.pause(); playBtn.innerHTML=playIcon; }
  });
  track.addEventListener('input', () => { audio.currentTime=parseFloat(track.value); });
}

// ─────────────────────────────────────────────
// 24. REALTIME
// ─────────────────────────────────────────────
function cleanupRealtime() {
  if (realtimeChannel) { sb.removeChannel(realtimeChannel); realtimeChannel=null; }
  if (roomsChannel)    { sb.removeChannel(roomsChannel);    roomsChannel=null; }
}

function subscribeRoomRealtime(roomId) {
  if (realtimeChannel) sb.removeChannel(realtimeChannel);
  realtimeChannel = sb.channel('room-' + roomId)
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages', filter:`room_id=eq.${roomId}` }, async payload => {
      const msg = payload.new;
      if (msg.sender_id !== currentUser?.id) await appendMessage(msg);
    })
    .on('postgres_changes', { event:'UPDATE', schema:'public', table:'messages', filter:`room_id=eq.${roomId}` }, payload => {
      const msg = payload.new;
      const el  = DOM.messagesList.querySelector(`[data-msg-id="${msg.id}"]`);
      if (!el) return;
      if (msg.deleted_for_all || msg.deleted_by_users?.includes(currentUser?.id)) { el.remove(); return; }
      // Refresh bubble text on edit
      const textEl = el.querySelector('.bubble-text');
      if (textEl && msg.is_edited) textEl.innerHTML = renderMarkdown(msg.content || '');
    })
    .on('postgres_changes', { event:'DELETE', schema:'public', table:'messages' }, payload => {
      DOM.messagesList.querySelector(`[data-msg-id="${payload.old.id}"]`)?.remove();
    })
    .subscribe();
}

function subscribeRoomsRealtime() {
  if (roomsChannel) sb.removeChannel(roomsChannel);
  roomsChannel = sb.channel('rooms-' + currentUser.id)
    .on('postgres_changes', { event:'*', schema:'public', table:'rooms' }, async payload => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const room = payload.new;
        const { data: mem } = await sb.from('room_members').select('id').eq('room_id',room.id).eq('user_id',currentUser.id).maybeSingle();
        if (mem) {
          const idx = rooms.findIndex(r => r.id===room.id);
          if (idx !== -1) rooms[idx] = { ...rooms[idx], ...room };
          else rooms.unshift({ ...room, _member: {} });
          updateRoomItemInSidebar(rooms.find(r=>r.id===room.id));
        }
      } else if (payload.eventType === 'DELETE') {
        rooms = rooms.filter(r => r.id !== payload.old.id);
        DOM.roomList.querySelector(`[data-room-id="${payload.old.id}"]`)?.remove();
        if (activeRoomId === payload.old.id) {
          activeRoomId=null; activeRoom=null;
          DOM.chatView.classList.add('hidden'); DOM.chatEmptyState.classList.remove('hidden');
        }
      }
    }).subscribe();
}

function subscribeNotifications() {
  sb.channel('notifs-' + currentUser.id)
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'notifications', filter:`user_id=eq.${currentUser.id}` }, payload => {
      addNotification(payload.new);
    }).subscribe();
}

// ─────────────────────────────────────────────
// 25. NOTIFICATIONS
// ─────────────────────────────────────────────
let notifCount = 0;

function addNotification(notif) {
  notifCount++;
  DOM.notifBadge.textContent = notifCount;
  DOM.notifBadge.classList.remove('hidden');

  const empty = DOM.notifList.querySelector('.notif-empty');
  if (empty) empty.remove();

  const el = document.createElement('div'); el.className='notif-item unread';
  const av = document.createElement('div'); av.className='avatar xs';
  const content = document.createElement('div'); content.className='notif-item-content';
  content.innerHTML = `<div class="notif-item-text">${escapeHtml(notif.content||'New notification')}</div>
    <div class="notif-item-time">${formatTime(notif.created_at)}</div>`;
  el.appendChild(av); el.appendChild(content);
  el.addEventListener('click', async () => {
    el.classList.remove('unread');
    await sb.from('notifications').update({ is_read: true }).eq('id', notif.id);
    if (notif.room_id) { openRoom(notif.room_id); DOM.notifPanel.classList.remove('open'); }
  });
  DOM.notifList.insertBefore(el, DOM.notifList.firstChild);
}

DOM.btnNotifications?.addEventListener('click', () => {
  DOM.notifPanel.classList.toggle('open');
  DOM.notifPanel.classList.remove('hidden');
  notifCount = 0;
  DOM.notifBadge.classList.add('hidden');
});
DOM.btnCloseNotif?.addEventListener('click', () => DOM.notifPanel.classList.remove('open'));

DOM.btnMarkAllRead?.addEventListener('click', async () => {
  await sb.from('notifications').update({ is_read: true }).eq('user_id', currentUser.id);
  DOM.notifList.querySelectorAll('.notif-item').forEach(el => el.classList.remove('unread'));
  notifCount = 0; DOM.notifBadge.classList.add('hidden');
  showToast('All marked as read.', 'success', 1500);
});

DOM.btnRequestNotif?.addEventListener('click', async () => {
  const perm = await Notification.requestPermission();
  notifPermission = perm;
  showToast(perm === 'granted' ? 'Notifications enabled! 🎉' : 'Notifications blocked.', perm==='granted'?'success':'warning');
});

// ─────────────────────────────────────────────
// 26. SEARCH (sidebar)
// ─────────────────────────────────────────────
DOM.searchInput?.addEventListener('input', () => {
  const val = DOM.searchInput.value.trim();
  DOM.btnSearchClear.classList.toggle('hidden', !val);
  clearTimeout(searchDebounceTimer);
  if (!val) { DOM.contactResults.classList.add('hidden'); renderRoomList(); return; }
  renderRoomList(val);
  searchDebounceTimer = setTimeout(() => searchContacts(val), 400);
});

DOM.btnSearchClear?.addEventListener('click', () => {
  DOM.searchInput.value = ''; DOM.btnSearchClear.classList.add('hidden');
  DOM.contactResults.classList.add('hidden'); renderRoomList();
});

async function searchContacts(query) {
  try {
    const q = query.replace(/^@/,'');
    const { data } = await sb.from('profiles').select('*')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%,phone_number.ilike.%${q}%`)
      .neq('id', currentUser.id).limit(8);

    DOM.contactResults.classList.remove('hidden'); DOM.contactResults.innerHTML = '';
    if (!data?.length) {
      DOM.contactResults.innerHTML = `<div class="contact-search-no-result">No users found for "${escapeHtml(query)}"</div>`; return;
    }
    data.forEach(profile => {
      const item = document.createElement('div'); item.className='contact-result-item';
      const av = document.createElement('div'); av.className='avatar sm';
      setAvatarEl(av, profile.avatar_url, profile.display_name||profile.username);
      const info = document.createElement('div'); info.className='info';
      info.innerHTML=`<div class="name">${escapeHtml(profile.display_name||profile.username||'Unknown')}</div>
        <div class="phone">${escapeHtml(profile.phone_number||'')}</div>`;
      const msgBtn = document.createElement('button'); msgBtn.className='btn-ghost sm'; msgBtn.textContent='Message';
      msgBtn.addEventListener('click', async e => {
        e.stopPropagation();
        DOM.contactResults.classList.add('hidden'); DOM.searchInput.value='';
        DOM.btnSearchClear.classList.add('hidden'); renderRoomList();
        await openOrCreateDM(profile);
      });
      item.appendChild(av); item.appendChild(info); item.appendChild(msgBtn);
      DOM.contactResults.appendChild(item);
    });
  } catch(e) { showToast('Search failed: ' + e.message, 'error'); }
}

document.addEventListener('click', e => {
  if (!DOM.contactResults?.contains(e.target) && e.target!==DOM.searchInput) DOM.contactResults?.classList.add('hidden');
});

async function openOrCreateDM(targetProfile) {
  try {
    const { data: myMems } = await sb.from('room_members').select('room_id').eq('user_id', currentUser.id);
    const myRoomIds = (myMems||[]).map(m => m.room_id);
    if (myRoomIds.length) {
      const { data: shared } = await sb.from('room_members').select('room_id').eq('user_id', targetProfile.id).in('room_id', myRoomIds);
      const sharedIds = (shared||[]).map(m => m.room_id);
      if (sharedIds.length) {
        const { data: personal } = await sb.from('rooms').select('*').in('id', sharedIds).eq('is_personal_chat', true).limit(1);
        if (personal?.length) { await openRoom(personal[0].id); return; }
      }
    }
    const roomName = [currentProfile?.username, targetProfile.username].filter(Boolean).sort().join(' & ');
    const { data: newRoom, error } = await sb.from('rooms').insert({
      name: roomName, is_personal_chat: true, created_by: currentUser.id,
    }).select().single();
    if (error) throw error;
    await sb.from('room_members').insert([
      { room_id: newRoom.id, user_id: currentUser.id, role:'admin' },
      { room_id: newRoom.id, user_id: targetProfile.id, role:'member' },
    ]);
    rooms.unshift({ ...newRoom, _member: { role:'admin' } });
    updateRoomItemInSidebar(rooms[0]);
    await openRoom(newRoom.id);
    showToast(`Chat with ${targetProfile.username} started!`, 'success', 2000);
  } catch(e) { showToast('Could not start chat: ' + e.message, 'error'); }
}

// ─────────────────────────────────────────────
// 27. COMMAND PALETTE  (Ctrl+K)
// ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if ((e.ctrlKey||e.metaKey) && e.key==='k') { e.preventDefault(); toggleCommandPalette(); }
  if (e.key==='Escape') { closeCommandPalette(); closeContextMenu(); closeInfoPanel(); }
});

function toggleCommandPalette() {
  if (DOM.commandPalette.classList.contains('hidden')) { DOM.commandPalette.classList.remove('hidden'); DOM.commandInput.focus(); renderCommandResults(''); }
  else closeCommandPalette();
}
function closeCommandPalette() { DOM.commandPalette.classList.add('hidden'); DOM.commandInput.value=''; }

DOM.commandInput?.addEventListener('input', () => {
  clearTimeout(cmdDebounceTimer);
  cmdDebounceTimer = setTimeout(() => renderCommandResults(DOM.commandInput.value.trim()), 100);
});
DOM.commandPalette?.addEventListener('click', e => { if (e.target===DOM.commandPalette) closeCommandPalette(); });

function renderCommandResults(query) {
  DOM.commandResults.innerHTML='';
  const lower = query.toLowerCase();

  const sections = [];

  // Chats
  const matchRooms = rooms.filter(r => !query || r.name.toLowerCase().includes(lower)).slice(0,5);
  if (matchRooms.length) {
    sections.push({ label:'Chats', items: matchRooms.map(r => ({
      icon: r.is_personal_chat?'💬':'👥', label:r.name, sub: r.last_msg_preview||'',
      action: () => { openRoom(r.id); closeCommandPalette(); }
    }))});
  }

  // Commands
  const cmds = [
    { icon:'⚙️', label:'Open Settings',      action: ()=>{ openModal('modal-settings'); closeCommandPalette(); } },
    { icon:'📌', label:'Saved Messages',      action: ()=>{ DOM.btnSavedMessages.click(); closeCommandPalette(); } },
    { icon:'👥', label:'Create New Group',    action: ()=>{ DOM.btnNewGroup.click(); closeCommandPalette(); } },
    { icon:'🌙', label:'Toggle Dark/Light',   action: ()=>{ applyTheme(localStorage.getItem('tb_theme')==='light'?'dark':'light'); closeCommandPalette(); } },
    { icon:'🔔', label:'Enable Notifications', action: ()=>{ DOM.btnRequestNotif?.click(); closeCommandPalette(); } },
    { icon:'🚪', label:'Sign Out',            action: ()=>{ DOM.btnSignout.click(); closeCommandPalette(); } },
  ].filter(c => !query || c.label.toLowerCase().includes(lower));

  if (cmds.length) sections.push({ label:'Commands', items: cmds });

  if (!sections.length) {
    DOM.commandResults.innerHTML='<div class="cmd-empty">No results found.</div>'; return;
  }

  sections.forEach(sec => {
    const lbl = document.createElement('div'); lbl.className='cmd-group-label'; lbl.textContent=sec.label;
    DOM.commandResults.appendChild(lbl);
    sec.items.forEach(item => {
      const el = document.createElement('div'); el.className='cmd-item';
      el.innerHTML=`<div class="cmd-item-icon">${item.icon}</div>
        <div><div class="cmd-item-label">${escapeHtml(item.label)}</div>
        ${item.sub?`<div class="cmd-item-sub">${escapeHtml(item.sub)}</div>`:''}
        </div>`;
      el.addEventListener('click', item.action);
      DOM.commandResults.appendChild(el);
    });
  });
}

// ─────────────────────────────────────────────
// 28. GROUP CREATION
// ─────────────────────────────────────────────
let groupLogoFile = null;

DOM.btnNewGroup?.addEventListener('click', () => {
  DOM.newGroupName.value=''; DOM.newGroupDesc.value=''; groupLogoFile=null; DOM.groupIsPublic.checked=false;
  DOM.groupAvatarPreview.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  openModal('modal-new-group');
});
DOM.btnUploadGroupLogo?.addEventListener('click', () => DOM.groupLogoInput.click());
DOM.groupLogoInput?.addEventListener('change', () => {
  const file=DOM.groupLogoInput.files[0]; if(!file) return;
  groupLogoFile=file;
  const r=new FileReader(); r.onload=e=>{ DOM.groupAvatarPreview.innerHTML=`<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`; }; r.readAsDataURL(file);
});
DOM.btnCreateGroup?.addEventListener('click', async () => {
  const name=DOM.newGroupName.value.trim(), desc=DOM.newGroupDesc.value.trim();
  if (!name) return showToast('Group name is required.', 'warning');
  DOM.btnCreateGroup.disabled=true; DOM.btnCreateGroup.textContent='Creating…';
  try {
    let avatarUrl=null;
    if (groupLogoFile) {
      const ext=groupLogoFile.name.split('.').pop()||'jpg';
      const path=`group-logos/${Date.now()}_${currentUser.id}.${ext}`;
      const {error:ue}=await sb.storage.from(MEDIA_BUCKET).upload(path,groupLogoFile,{cacheControl:'3600',upsert:false,contentType:groupLogoFile.type});
      if (ue) throw ue; avatarUrl=getPublicUrl(path);
    }
    const {data:newRoom,error:re}=await sb.from('rooms').insert({
      name,description:desc||null,avatar_url:avatarUrl,
      is_personal_chat:false,is_public:DOM.groupIsPublic.checked,created_by:currentUser.id,
    }).select().single();
    if (re) throw re;
    await sb.from('room_members').insert({room_id:newRoom.id,user_id:currentUser.id,role:'admin'});
    rooms.unshift({...newRoom,_member:{role:'admin',is_pinned:false,is_archived:false,is_muted:false,unread_count:0}});
    updateRoomItemInSidebar(rooms[0]);
    closeModal('modal-new-group');
    await openRoom(newRoom.id);
    showToast(`Group "${name}" created!`, 'success');
  } catch(e) { showToast(e.message,'error'); }
  finally { DOM.btnCreateGroup.disabled=false; DOM.btnCreateGroup.textContent='Create Group'; }
});

// ─────────────────────────────────────────────
// 29. INFO PANEL
// ─────────────────────────────────────────────
function openInfoPanel()  { DOM.infoPanel.classList.add('open');    renderInfoPanel(); }
function closeInfoPanel() { DOM.infoPanel.classList.remove('open'); }
DOM.btnToggleInfo?.addEventListener('click',    () => DOM.infoPanel.classList.contains('open') ? closeInfoPanel() : openInfoPanel());
DOM.chatHeaderInfoBtn?.addEventListener('click',() => DOM.infoPanel.classList.contains('open') ? closeInfoPanel() : openInfoPanel());
DOM.btnCloseInfo?.addEventListener('click', closeInfoPanel);

async function renderInfoPanel() {
  if (!activeRoom) return;
  DOM.infoPanelContent.innerHTML='';
  const isGroup = !activeRoom.is_personal_chat;
  const isAdmin = myRoomRole==='admin'||myRoomRole==='owner';

  // Avatar section
  const avSec=document.createElement('div'); avSec.className='info-avatar-section';
  const av=document.createElement('div'); av.className='avatar lg';
  setAvatarEl(av,activeRoom.avatar_url,activeRoom.name);
  const name=document.createElement('div'); name.className='info-name'; name.textContent=activeRoom.name;
  const meta=document.createElement('div'); meta.className='info-meta';
  meta.textContent=isGroup?`${roomMembers.length} member${roomMembers.length!==1?'s':''}`:'Personal Chat';
  avSec.appendChild(av); avSec.appendChild(name); avSec.appendChild(meta);
  DOM.infoPanelContent.appendChild(avSec);

  if (activeRoom.description) {
    const descSec=document.createElement('div'); descSec.className='info-section';
    descSec.innerHTML=`<div class="info-section-title">About</div><div style="font-size:13px;color:var(--text-secondary)">${escapeHtml(activeRoom.description)}</div>`;
    DOM.infoPanelContent.appendChild(descSec);
  }

  // Members
  if (isGroup) {
    const memSec=document.createElement('div'); memSec.className='info-section';
    const memTitle=document.createElement('div'); memTitle.className='info-section-title'; memTitle.textContent='Members';
    const memList=document.createElement('div'); memList.className='member-list';

    for (const member of roomMembers) {
      const profile=await getOrFetchProfile(member.user_id);
      const isMe=member.user_id===currentUser.id;
      const memberIsAdmin=member.role==='admin'||member.role==='owner';
      const item=document.createElement('div'); item.className='member-item';
      const mav=document.createElement('div'); mav.className='avatar sm';
      setAvatarEl(mav,profile?.avatar_url,profile?.username);
      const info=document.createElement('div'); info.className='member-item-info';
      const nm=document.createElement('div'); nm.className='member-item-name'; nm.textContent=(profile?.display_name||profile?.username||'Unknown')+(isMe?' (You)':'');
      const role=document.createElement('div'); role.className='member-item-role'; role.textContent=member.role;
      info.appendChild(nm); info.appendChild(role);
      item.appendChild(mav); item.appendChild(info);
      if (memberIsAdmin) { const b=document.createElement('span'); b.className='member-badge'; b.textContent='ADMIN'; item.appendChild(b); }
      if (isAdmin && !isMe) {
        const acts=document.createElement('div'); acts.className='member-actions';
        if (!memberIsAdmin) {
          const makeAdminBtn=document.createElement('button'); makeAdminBtn.className='member-action-btn'; makeAdminBtn.textContent='Make Admin';
          makeAdminBtn.addEventListener('click',async()=>{
            await sb.from('room_members').update({role:'admin'}).eq('room_id',activeRoom.id).eq('user_id',member.user_id);
            member.role='admin'; showToast('Admin assigned.','success',2000); renderInfoPanel();
          }); acts.appendChild(makeAdminBtn);
        }
        const kickBtn=document.createElement('button'); kickBtn.className='member-action-btn danger'; kickBtn.textContent='Kick';
        kickBtn.addEventListener('click',async()=>{
          if (!confirm(`Remove ${profile?.username||'this user'}?`)) return;
          await sb.from('room_members').delete().eq('room_id',activeRoom.id).eq('user_id',member.user_id);
          roomMembers=roomMembers.filter(m=>m.user_id!==member.user_id);
          showToast('Member removed.','info',2000); renderInfoPanel(); renderChatHeader(activeRoom);
        }); acts.appendChild(kickBtn);
        item.appendChild(acts);
      }
      memList.appendChild(item);
    }
    memSec.appendChild(memTitle); memSec.appendChild(memList);
    DOM.infoPanelContent.appendChild(memSec);

    if (isAdmin) {
      const addSec=document.createElement('div'); addSec.className='info-section';
      addSec.innerHTML=`<div class="info-section-title">Add Member</div>`;
      const addRow=document.createElement('div'); addRow.className='add-member-row';
      const addInput=document.createElement('input'); addInput.type='text'; addInput.placeholder='Username or phone…';
      const addBtn=document.createElement('button'); addBtn.className='btn-primary'; addBtn.textContent='Add';
      addBtn.addEventListener('click',async()=>{
        const q=addInput.value.trim(); if(!q) return;
        const {data,error}=await sb.from('profiles').select('*').or(`username.ilike.%${q}%,phone_number.ilike.%${q}%`).neq('id',currentUser.id).limit(1).single();
        if (error||!data) return showToast('User not found.','warning');
        if (roomMembers.some(m=>m.user_id===data.id)) return showToast('Already a member.','warning');
        await sb.from('room_members').insert({room_id:activeRoom.id,user_id:data.id,role:'member'});
        profileCache[data.id]=data;
        roomMembers.push({room_id:activeRoom.id,user_id:data.id,role:'member',profiles:data});
        addInput.value=''; showToast(`${data.username} added!`,'success',2000); renderInfoPanel(); renderChatHeader(activeRoom);
      });
      addRow.appendChild(addInput); addRow.appendChild(addBtn); addSec.appendChild(addRow);
      DOM.infoPanelContent.appendChild(addSec);
    }
  }

  // Invite link
  if (isGroup && isAdmin && activeRoom.invite_link) {
    const invSec=document.createElement('div'); invSec.className='info-section';
    invSec.innerHTML=`<div class="info-section-title">Invite Link</div>`;
    const linkEl=document.createElement('div'); linkEl.style.cssText='display:flex;gap:8px;align-items:center;';
    const linkText=document.createElement('code'); linkText.style.cssText='font-size:11px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    linkText.textContent=`${window.location.origin}?join=${activeRoom.invite_link}`;
    const copyBtn=document.createElement('button'); copyBtn.className='btn-ghost sm'; copyBtn.textContent='Copy';
    copyBtn.addEventListener('click',async()=>{ await navigator.clipboard.writeText(linkText.textContent); showToast('Copied!','success',1500); });
    linkEl.appendChild(linkText); linkEl.appendChild(copyBtn); invSec.appendChild(linkEl);
    DOM.infoPanelContent.appendChild(invSec);
  }

  // Actions
  const divider=document.createElement('div'); divider.className='divider';
  DOM.infoPanelContent.appendChild(divider);
  const acts=document.createElement('div'); acts.className='info-section info-actions';

  if (isGroup) {
    const leaveBtn=document.createElement('button'); leaveBtn.className='info-action-btn danger';
    leaveBtn.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Leave Group`;
    leaveBtn.addEventListener('click',async()=>{
      if(!confirm('Leave this group?')) return;
      await sb.from('room_members').delete().eq('room_id',activeRoom.id).eq('user_id',currentUser.id);
      rooms=rooms.filter(r=>r.id!==activeRoom.id);
      DOM.roomList.querySelector(`[data-room-id="${activeRoom.id}"]`)?.remove();
      activeRoomId=null; activeRoom=null;
      DOM.chatView.classList.add('hidden'); DOM.chatEmptyState.classList.remove('hidden');
      closeInfoPanel(); showToast('You left the group.','info');
    }); acts.appendChild(leaveBtn);

    if (activeRoom.created_by===currentUser.id) {
      const delBtn=document.createElement('button'); delBtn.className='info-action-btn danger';
      delBtn.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg> Delete Group`;
      delBtn.addEventListener('click',async()=>{
        if(!confirm('Permanently delete this group?')) return;
        await sb.from('messages').delete().eq('room_id',activeRoom.id);
        await sb.from('room_members').delete().eq('room_id',activeRoom.id);
        await sb.from('rooms').delete().eq('id',activeRoom.id);
        rooms=rooms.filter(r=>r.id!==activeRoom.id);
        DOM.roomList.querySelector(`[data-room-id="${activeRoom.id}"]`)?.remove();
        activeRoomId=null; activeRoom=null;
        DOM.chatView.classList.add('hidden'); DOM.chatEmptyState.classList.remove('hidden');
        closeInfoPanel(); showToast('Group deleted.','info');
      }); acts.appendChild(delBtn);
    }
  }
  DOM.infoPanelContent.appendChild(acts);
}

// ─────────────────────────────────────────────
// 30. SETTINGS
// ─────────────────────────────────────────────
let settingsAvatarFile = null;

// Settings nav
DOM.settingsNavItems?.forEach(item => {
  item.addEventListener('click', () => {
    DOM.settingsNavItems.forEach(i => i.classList.remove('active'));
    DOM.settingsSections?.forEach(s => s.classList.remove('active'));
    item.classList.add('active');
    $('settings-section-' + item.dataset.section)?.classList.add('active');
  });
});

DOM.btnSettings?.addEventListener('click', () => {
  if (!currentProfile) return;
  DOM.settingsUsername.value    = currentProfile.username || '';
  DOM.settingsDisplayName.value = currentProfile.display_name || '';
  DOM.settingsBio.value         = currentProfile.bio || '';
  DOM.settingsStatusEmoji.value = currentProfile.status_emoji || '🟢';
  DOM.settingsStatusText.value  = currentProfile.status_text || '';
  DOM.settingsPhone.value       = currentProfile.phone_number || '';
  DOM.settingsBirthday.value    = currentProfile.birthday || '';
  DOM.privacyLastSeen.value     = currentProfile.privacy_last_seen || 'everyone';
  DOM.privacyOnline.value       = currentProfile.privacy_online || 'everyone';
  DOM.privacyAvatar.value       = currentProfile.privacy_avatar || 'everyone';
  DOM.privacyReadReceipts.checked=currentProfile.privacy_read_receipts !== false;
  DOM.privacyWhoMessage.value   = currentProfile.who_can_message || 'everyone';
  DOM.notifSound.checked        = localStorage.getItem('tb_notif_sound') !== 'false';
  settingsAvatarFile = null;
  setAvatarEl(DOM.settingsAvatar, currentProfile.avatar_url, currentProfile.display_name||currentProfile.username);
  openModal('modal-settings');
});

DOM.btnUploadAvatar?.addEventListener('click', () => DOM.settingsAvatarInput.click());
DOM.settingsAvatarInput?.addEventListener('change', () => {
  const file=DOM.settingsAvatarInput.files[0]; if(!file) return;
  settingsAvatarFile=file;
  const r=new FileReader(); r.onload=e=>{ DOM.settingsAvatar.innerHTML=`<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`; }; r.readAsDataURL(file);
});

DOM.btnSaveSettings?.addEventListener('click', async () => {
  const username=DOM.settingsUsername.value.trim();
  if (!username) return showToast('Username cannot be empty.','warning');
  DOM.btnSaveSettings.disabled=true; DOM.btnSaveSettings.textContent='Saving…';
  try {
    let avatarUrl=currentProfile.avatar_url;
    if (settingsAvatarFile) {
      const ext=settingsAvatarFile.name.split('.').pop()||'jpg';
      const path=`avatars/${currentUser.id}.${ext}`;
      const {error:ue}=await sb.storage.from(MEDIA_BUCKET).upload(path,settingsAvatarFile,{cacheControl:'3600',upsert:true,contentType:settingsAvatarFile.type});
      if (ue) throw ue;
      avatarUrl=getPublicUrl(path)+'?t='+Date.now();
    }
    const updates={
      username, display_name:DOM.settingsDisplayName.value.trim()||username,
      bio:DOM.settingsBio.value.trim()||null,
      status_emoji:DOM.settingsStatusEmoji.value||'🟢',
      status_text:DOM.settingsStatusText.value.trim()||null,
      phone_number:DOM.settingsPhone.value.trim()||null,
      birthday:DOM.settingsBirthday.value||null,
      avatar_url:avatarUrl,
      privacy_last_seen:DOM.privacyLastSeen.value,
      privacy_online:DOM.privacyOnline.value,
      privacy_avatar:DOM.privacyAvatar.value,
      privacy_read_receipts:DOM.privacyReadReceipts.checked,
      who_can_message:DOM.privacyWhoMessage.value,
      accent_color:localStorage.getItem('tb_accent')||'#5865f2',
      theme:localStorage.getItem('tb_theme')||'dark',
      font_size:localStorage.getItem('tb_font')||'medium',
    };
    const {error}=await sb.from('profiles').update(updates).eq('id',currentUser.id);
    if (error) throw error;
    localStorage.setItem('tb_notif_sound', DOM.notifSound.checked ? 'true' : 'false');
    Object.assign(currentProfile, updates);
    profileCache[currentUser.id]=currentProfile;
    renderSidebarUser(); closeModal('modal-settings');
    showToast('Profile updated!','success');
  } catch(e) { showToast('Update failed: '+e.message,'error'); }
  finally { DOM.btnSaveSettings.disabled=false; DOM.btnSaveSettings.textContent='Save Changes'; }
});

DOM.btnChangePw?.addEventListener('click', async () => {
  const newPw=DOM.settingsNewPw.value;
  if (!newPw||newPw.length<8) return showToast('Password must be at least 8 chars.','warning');
  try {
    const {error}=await sb.auth.updateUser({password:newPw});
    if (error) throw error;
    DOM.settingsNewPw.value='';
    showToast('Password updated!','success');
  } catch(e) { showToast(e.message,'error'); }
});

DOM.btnLogoutAll?.addEventListener('click', async () => {
  if (!confirm('Sign out of all devices?')) return;
  await sb.auth.signOut({ scope:'global' });
  showToast('Signed out everywhere.','info');
});

// ─────────────────────────────────────────────
// 31. CONTEXT MENU
// ─────────────────────────────────────────────
function openContextMenu(e, msg, groupEl) {
  contextTargetMsg = { msg, groupEl };
  const menu = DOM.contextMenu;
  menu.classList.remove('hidden');

  const dlBtn     = menu.querySelector('[data-action="download"]');
  const unsendBtn = menu.querySelector('[data-action="unsend"]');
  const editBtn   = menu.querySelector('[data-action="edit"]');
  const pinBtn    = menu.querySelector('[data-action="pin"]');

  dlBtn?.classList.toggle('hidden',     !(msg.message_type==='image'||msg.message_type==='audio'||msg.message_type==='file'));
  unsendBtn?.classList.toggle('hidden', msg.sender_id!==currentUser?.id);
  editBtn?.classList.toggle('hidden',   msg.sender_id!==currentUser?.id || msg.message_type!=='text');
  pinBtn?.classList.toggle('hidden',    myRoomRole==='member');

  const x = Math.min(e.clientX, window.innerWidth  - 200);
  const y = Math.min(e.clientY, window.innerHeight - 280);
  menu.style.left=x+'px'; menu.style.top=y+'px';
}

function closeContextMenu() { DOM.contextMenu.classList.add('hidden'); contextTargetMsg=null; }

DOM.contextMenu?.addEventListener('click', async e => {
  const btn=e.target.closest('[data-action]');
  if (!btn||!contextTargetMsg) return;
  const {msg,groupEl}=contextTargetMsg;
  const action=btn.dataset.action;
  closeContextMenu();

  switch(action) {
    case 'reply':   setReply(msg); break;
    case 'react':   openReactionPicker(e, msg, groupEl); break;
    case 'forward': openForwardModal(msg); break;
    case 'save':    await saveMessage(msg); break;
    case 'pin':     await pinMessage(msg); break;
    case 'edit':    if(groupEl) startEdit(msg,groupEl); break;
    case 'copy': {
      const text=msg.message_type==='text'?msg.content:(msg.media_url||'');
      try { await navigator.clipboard.writeText(text); showToast('Copied!','info',1500); } catch{ showToast('Could not copy.','error'); }
      break;
    }
    case 'download': if(msg.media_url) await downloadFileFromUrl(msg.media_url,'telebey-'+msg.id); break;
    case 'delete-for-me': {
      try {
        const existing=msg.deleted_by_users||[];
        if(!existing.includes(currentUser.id)) existing.push(currentUser.id);
        await sb.from('messages').update({deleted_by_users:existing}).eq('id',msg.id);
        DOM.messagesList.querySelector(`[data-msg-id="${msg.id}"]`)?.remove();
        showToast('Message hidden.','info',2000);
      } catch(e) { showToast(e.message,'error'); }
      break;
    }
    case 'unsend': {
      if (!confirm('Delete for everyone?')) return;
      try {
        await sb.from('messages').delete().eq('id',msg.id);
        DOM.messagesList.querySelector(`[data-msg-id="${msg.id}"]`)?.remove();
        showToast('Message deleted.','info',2000);
      } catch(e) { showToast(e.message,'error'); }
      break;
    }
  }
});

document.addEventListener('click',  e => { if(!DOM.contextMenu?.contains(e.target)) closeContextMenu(); });
document.addEventListener('keydown', e => { if(e.key==='Escape') { closeContextMenu(); closeInfoPanel(); } });

// ─────────────────────────────────────────────
// 32. LIGHTBOX
// ─────────────────────────────────────────────
let lightboxZoom = 1;

function openLightbox(url) {
  DOM.lightboxImg.src=url; DOM.modalLightbox.classList.remove('hidden');
  lightboxZoom=1; DOM.lightboxImg.style.transform='scale(1)';
}
DOM.btnCloseLightbox?.addEventListener('click',()=>{ DOM.modalLightbox.classList.add('hidden'); DOM.lightboxImg.src=''; });
DOM.modalLightbox?.addEventListener('click', e => { if(e.target===DOM.modalLightbox){ DOM.modalLightbox.classList.add('hidden'); DOM.lightboxImg.src=''; } });
DOM.btnLightboxDl?.addEventListener('click',()=>{ if(DOM.lightboxImg.src) downloadFileFromUrl(DOM.lightboxImg.src,'telebey-image'); });
DOM.btnLightboxZoomIn?.addEventListener('click',()=>{ lightboxZoom=Math.min(lightboxZoom+0.25,3); DOM.lightboxImg.style.transform=`scale(${lightboxZoom})`; });
DOM.btnLightboxZoomOut?.addEventListener('click',()=>{ lightboxZoom=Math.max(lightboxZoom-0.25,0.5); DOM.lightboxImg.style.transform=`scale(${lightboxZoom})`; });

// ─────────────────────────────────────────────
// 33. MODAL CLOSE (generic)
// ─────────────────────────────────────────────
document.querySelectorAll('.modal-close,[data-modal]').forEach(btn=>{
  btn.addEventListener('click',()=>{ if(btn.dataset.modal) closeModal(btn.dataset.modal); });
});
document.querySelectorAll('.modal-overlay').forEach(overlay=>{
  overlay.addEventListener('click',e=>{ if(e.target===overlay && overlay.id!=='modal-lightbox') overlay.classList.add('hidden'); });
});

// ─────────────────────────────────────────────
// 34. MOBILE NAVIGATION
// ─────────────────────────────────────────────
DOM.btnBackToList?.addEventListener('click',()=>{
  DOM.sidebar.classList.remove('hidden-mobile');
  DOM.chatView.classList.add('hidden'); DOM.chatEmptyState.classList.remove('hidden');
  activeRoomId=null; activeRoom=null;
  closeInfoPanel();
  DOM.roomList.querySelectorAll('.room-item').forEach(el=>el.classList.remove('active'));
});

// ─────────────────────────────────────────────
// 35. PWA SERVICE WORKER
// ─────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// ─────────────────────────────────────────────
// 36. KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (!currentUser) return;
  if (e.ctrlKey && e.key==='g') { e.preventDefault(); DOM.btnNewGroup?.click(); }
  if (e.ctrlKey && e.key==='s') { e.preventDefault(); DOM.btnSavedMessages?.click(); }
});

// ─────────────────────────────────────────────
// 37. TEXTAREA AUTO-RESIZE
// ─────────────────────────────────────────────
DOM.messageInput?.addEventListener('input',()=>{
  DOM.messageInput.style.height='auto';
  DOM.messageInput.style.height=Math.min(DOM.messageInput.scrollHeight,140)+'px';
});

// ─────────────────────────────────────────────
// 38. INIT
// ─────────────────────────────────────────────
(async()=>{
  // Handle OAuth redirect
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  if (hashParams.get('access_token')) {
    history.replaceState(null, '', window.location.pathname);
  }
  // Handle password reset
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('reset')==='1') {
    history.replaceState(null,'', window.location.pathname);
  }
  // Session handled by onAuthStateChange
})();
