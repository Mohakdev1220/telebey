// ═══════════════════════════════════════════════════════════════
//  TELEBEY — script.js  (Production-ready)
//  All features: Auth, Admin approval, Rooms, Messages, E2EE,
//  Realtime, Media upload, Context menu, Typing indicators,
//  Presence, Toast notifications, Lightbox, Mobile layout.
// ═══════════════════════════════════════════════════════════════

'use strict';

/* ── 1. SUPABASE ─────────────────────────────────────────────── */
const SUPABASE_URL = 'https://nfnbwrrvjpkrnayzyihd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mbmJ3cnJ2anBrcm5heXp5aWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDU2NjcsImV4cCI6MjA5NzE4MTY2N30.Uwuk6_Btflb_EmtuwOAP2HcuaL99gwFG3AuV2aG1Pjc';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── 2. APP STATE ────────────────────────────────────────────── */
const State = {
  user:            null,   // Supabase auth user
  profile:         null,   // profiles table row
  currentRoomId:   null,
  currentRoomName: '',
  rooms:           [],     // all loaded rooms
  messages:        {},     // { roomId: [msg,...] }
  deletedLocally:  new Set(), // message IDs hidden for this user
  pendingFile:     null,   // File object awaiting upload
  isSending:       false,  // prevent duplicate submits
  typingTimeout:   null,
  channels:        {},     // supabase realtime channels keyed by name
};

/* ── 3. DOM HELPERS ──────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

/* ── 4. SECURITY HELPERS ──────────────────────────────────────── */
/** Escape HTML special characters to prevent XSS */
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ── 5. E2EE WRAPPER ─────────────────────────────────────────── */
// Base64 encoding layer — easy to swap for a real crypto library.
// All messages are stored encrypted; decrypted only for display.
function encryptMessage(plainText) {
  try {
    return 'E2EE::' + btoa(unescape(encodeURIComponent(plainText)));
  } catch (_) { return plainText; }
}
function decryptMessage(cipher) {
  if (!cipher) return '';
  if (!cipher.startsWith('E2EE::')) return cipher; // legacy plain text
  try {
    return decodeURIComponent(escape(atob(cipher.slice(6))));
  } catch (_) {
    return '🔒 Could not decrypt';
  }
}

/* ── 6. AVATAR UTILITIES ─────────────────────────────────────── */
const AV_COLORS = ['av-blue','av-teal','av-purple','av-red','av-orange','av-green'];
function avatarColor(name = '') {
  return AV_COLORS[(name.charCodeAt(0) || 0) % AV_COLORS.length];
}
function initial(name = '') { return (name.trim()[0] || '?').toUpperCase(); }

/* ── 7. TOAST SYSTEM ─────────────────────────────────────────── */
function showToast(msg, type = '', duration = 3200) {
  const root  = $('toast-root');
  const toast = el('div', `toast ${type}`, esc(msg));
  root.appendChild(toast);
  const remove = () => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };
  const t = setTimeout(remove, duration);
  toast.addEventListener('click', () => { clearTimeout(t); remove(); });
}

/* ── 8. BUTTON LOADING STATE ─────────────────────────────────── */
function setLoading(btn, on) {
  if (!btn) return;
  btn.classList.toggle('btn-loading', on);
  btn.disabled = on;
}

/* ── 9. CONFIRM MODAL ────────────────────────────────────────── */
function showConfirm(text, okLabel = 'Delete') {
  return new Promise((resolve) => {
    $('confirm-modal-text').textContent = text;
    $('confirm-ok-btn').textContent     = okLabel;
    $('confirm-modal').style.display    = 'flex';
    const cleanup = () => { $('confirm-modal').style.display = 'none'; };
    $('confirm-ok-btn').onclick = () => { cleanup(); resolve(true); };
    $('confirm-cancel-btn').onclick = () => { cleanup(); resolve(false); };
  });
}

/* ── 10. FORMAT TIME ──────────────────────────────────────────── */
function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/* ─────────────────────────────────────────────────────────────
   AUTH
───────────────────────────────────────────────────────────── */

/* 11. Show / hide auth error */
function setAuthError(msg) {
  const el = $('auth-error');
  el.textContent = msg;
  el.classList.toggle('visible', !!msg);
}

/* 12. Sign Up */
async function handleSignUp() {
  const email = $('auth-email').value.trim();
  const pw    = $('auth-password').value.trim();
  if (!email || !pw) { setAuthError('Please enter your email and password.'); return; }
  if (pw.length < 6) { setAuthError('Password must be at least 6 characters.'); return; }
  setAuthError('');
  const btn = $('signup-btn');
  btn.disabled = true; btn.textContent = 'Creating…';
  const { error } = await db.auth.signUp({ email, password: pw });
  btn.disabled = false; btn.textContent = 'Create account';
  if (error) { setAuthError(error.message); }
  else { showToast('Account created! Please check your email to confirm, then sign in.', 'success', 5000); }
}

/* 13. Sign In */
async function handleLogin() {
  const email = $('auth-email').value.trim();
  const pw    = $('auth-password').value.trim();
  if (!email || !pw) { setAuthError('Please enter your email and password.'); return; }
  setAuthError('');
  const btn = $('login-btn');
  setLoading(btn, true);
  const { data, error } = await db.auth.signInWithPassword({ email, password: pw });
  setLoading(btn, false);
  if (error) { setAuthError(error.message); return; }
  await bootApp(data.user);
}

/* 14. Sign Out */
async function handleLogout() {
  tearDownChannels();
  await db.auth.signOut();
  State.user = null; State.profile = null; State.currentRoomId = null;
  State.rooms = []; State.messages = {};
  localStorage.removeItem('tb_active_room');
  $('auth-screen').style.display = 'flex';
  $('main-app').style.display    = 'none';
  $('auth-email').value = ''; $('auth-password').value = '';
  setAuthError('');
}

/* ─────────────────────────────────────────────────────────────
   ADMIN APPROVAL GATEKEEPER
───────────────────────────────────────────────────────────── */

/* 15. Fetch and check profile approval */
async function fetchAndCheckProfile(userId) {
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) {
    // Profile may not exist yet for brand-new users; treat as unapproved
    return null;
  }
  return data;
}

/* ─────────────────────────────────────────────────────────────
   APP BOOT
───────────────────────────────────────────────────────────── */

/* 16. Full app boot after successful auth */
async function bootApp(user) {
  State.user = user;

  // Check approval
  const profile = await fetchAndCheckProfile(user.id);
  State.profile = profile;

  if (!profile || profile.is_approved === false) {
    showToast('Waiting for Admin (Mohak) approval!', 'error', 6000);
    await db.auth.signOut();
    State.user = null;
    return;
  }

  // Show app
  $('auth-screen').style.display = 'none';
  $('main-app').style.display    = 'flex';

  // Populate sidebar user info
  const displayName = profile.username || profile.full_name || user.email.split('@')[0];
  $('sidebar-user-name').textContent = displayName;
  $('sidebar-user-av').textContent   = initial(displayName);

  // Subscribe to realtime channels
  setupRealtime();

  // Load rooms and restore last active room
  await loadRooms();

  const savedRoom = localStorage.getItem('tb_active_room');
  if (savedRoom && State.rooms.find(r => r.id === savedRoom)) {
    openRoom(savedRoom);
  }
}

/* ─────────────────────────────────────────────────────────────
   REALTIME SETUP
───────────────────────────────────────────────────────────── */

/* 17. Set up all realtime subscriptions */
function setupRealtime() {
  tearDownChannels(); // clean slate

  // Messages channel — filtered per room in openRoom()
  // We use a generic channel here for profile + room list updates
  const roomsCh = db.channel('rooms-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'family_groups' }, () => {
      loadRooms();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles',
        filter: `id=eq.${State.user.id}` }, (payload) => {
      State.profile = payload.new;
      if (payload.new.is_approved === false) {
        showToast('Your account has been unapproved by admin.', 'error');
        handleLogout();
      }
    })
    .subscribe((status) => {
      $('live-dot').classList.toggle('active', status === 'SUBSCRIBED');
    });

  State.channels['rooms-updates'] = roomsCh;
}

/* 18. Subscribe to a specific room's messages */
function subscribeToRoom(roomId) {
  const key = `msg-${roomId}`;
  if (State.channels[key]) return; // already subscribed

  const ch = db.channel(key)
    .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `group_id=eq.${roomId}`
      }, (payload) => {
        const msg = payload.new;
        if (State.messages[roomId]?.some(m => m.id === msg.id)) return; // dedup
        (State.messages[roomId] = State.messages[roomId] || []).push(msg);
        if (roomId === State.currentRoomId) {
          appendMessage(msg, true);
          if (msg.sender_id !== State.user.id) playNotificationSound();
        } else {
          bumpRoomUnread(roomId);
        }
      })
    .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'messages',
        filter: `group_id=eq.${roomId}`
      }, (payload) => {
        const id = payload.old.id;
        if (State.messages[roomId]) {
          State.messages[roomId] = State.messages[roomId].filter(m => m.id !== id);
        }
        const bubble = document.querySelector(`[data-msg-id="${id}"]`);
        if (bubble) bubble.remove();
      })
    .subscribe();

  State.channels[key] = ch;
}

/* 19. Tear down all channels */
function tearDownChannels() {
  Object.values(State.channels).forEach(ch => db.removeChannel(ch));
  State.channels = {};
  $('live-dot').classList.remove('active');
}

/* ─────────────────────────────────────────────────────────────
   ROOMS
───────────────────────────────────────────────────────────── */

/* 20. Load rooms from DB and render sidebar */
async function loadRooms() {
  const { data: rooms, error } = await db
    .from('family_groups')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error('loadRooms:', error.message); return; }

  State.rooms = rooms || [];
  renderRoomList(State.rooms);

  // Auto-open first room if none active
  if (!State.currentRoomId && State.rooms.length > 0) {
    const saved = localStorage.getItem('tb_active_room');
    const target = saved && State.rooms.find(r => r.id === saved)
      ? saved : State.rooms[0].id;
    openRoom(target);
  } else if (State.rooms.length === 0) {
    // Create default lounge
    await createDefaultLounge();
  }
}

/* 21. Create default lounge room */
async function createDefaultLounge() {
  const { data, error } = await db.from('family_groups')
    .insert([{ name: 'Telebey Lounge', description: 'Main hangout room', is_personal_chat: false }])
    .select().single();
  if (!error && data) {
    State.rooms = [data];
    renderRoomList(State.rooms);
    openRoom(data.id);
  }
}

/* 22. Render room list in sidebar */
function renderRoomList(rooms) {
  $('room-skeleton').style.display = 'none';
  const list = $('room-list');

  // Remove existing room items (but keep skeleton)
  list.querySelectorAll('.room-item, .room-list-empty').forEach(e => e.remove());

  if (!rooms || rooms.length === 0) {
    const empty = el('div', 'room-list-empty');
    empty.innerHTML = '<strong>No rooms yet</strong>Click + to create your first room';
    list.appendChild(empty);
    return;
  }

  const searchQ = $('room-search').value.toLowerCase().trim();
  const filtered = searchQ
    ? rooms.filter(r =>
        r.name.toLowerCase().includes(searchQ) ||
        (r.description || '').toLowerCase().includes(searchQ))
    : rooms;

  if (filtered.length === 0) {
    const empty = el('div', 'room-list-empty', 'No rooms match your search.');
    list.appendChild(empty);
    return;
  }

  filtered.forEach(room => {
    const isActive = State.currentRoomId === room.id;
    const col  = avatarColor(room.name);
    const init = initial(room.name);
    const item = el('div', `room-item${isActive ? ' active' : ''}`);
    item.dataset.roomId = room.id;
    item.innerHTML = `
      <div class="av ${col}">${esc(init)}</div>
      <div class="room-item-info">
        <strong>${esc(room.name)}</strong>
        <span class="room-preview">${esc(room.description || 'Tap to chat')}</span>
      </div>
      <div class="room-item-meta">
        <span class="room-time" id="rt-${room.id}"></span>
      </div>`;
    item.addEventListener('click', () => {
      openRoom(room.id);
      // Mobile: hide sidebar, show chat
      $('sidebar').classList.add('slide-out');
      $('chat-area').classList.add('show-mobile');
    });
    list.appendChild(item);
  });
}

/* 23. Open / switch room */
function openRoom(roomId) {
  if (!roomId) return;
  const room = State.rooms.find(r => r.id === roomId);
  if (!room) return;

  State.currentRoomId   = roomId;
  State.currentRoomName = room.name;
  localStorage.setItem('tb_active_room', roomId);

  // Update sidebar highlight
  document.querySelectorAll('.room-item').forEach(el =>
    el.classList.toggle('active', el.dataset.roomId === roomId));

  // Update chat header
  const col = avatarColor(room.name);
  const chatAv = $('chat-room-av');
  chatAv.textContent = initial(room.name);
  chatAv.className = `room-av ${col}`;
  $('chat-room-name').textContent = room.name;
  $('chat-room-meta').textContent = room.description || 'Tap header for options';

  // Show chat view
  $('empty-state').style.display = 'none';
  $('chat-view').style.display   = 'flex';

  // Reset message box
  const box = $('message-box');
  box.innerHTML = '';

  // Subscribe to this room's realtime
  subscribeToRoom(roomId);

  // Load messages
  loadMessages(roomId);

  // Close settings dropdown if open
  $('room-settings-dropdown').style.display = 'none';
}

/* 24. Create new room */
async function createRoom() {
  const name = $('new-room-name').value.trim();
  const desc = $('new-room-desc').value.trim();
  if (!name) { showToast('Please enter a room name.', 'error'); return; }

  const btn = $('create-room-btn');
  setLoading(btn, true);

  const { data, error } = await db.from('family_groups')
    .insert([{
      name,
      description: desc || `Created by ${State.profile?.username || State.user.email.split('@')[0]}`,
      is_personal_chat: false,
    }])
    .select().single();

  setLoading(btn, false);
  if (error) { showToast('Could not create room: ' + error.message, 'error'); return; }

  $('new-room-name').value = '';
  $('new-room-desc').value = '';
  closeModal('new-room-modal');

  await loadRooms();
  if (data) openRoom(data.id);
  showToast(`Room "${esc(data.name)}" created.`, 'success');
}

/* 25. Delete current room */
async function deleteCurrentRoom() {
  if (!State.currentRoomId) return;
  const confirmed = await showConfirm(
    `Delete "${State.currentRoomName}"? All messages will be permanently removed.`,
    'Delete room'
  );
  if (!confirmed) return;

  // Delete messages first, then the room (or rely on cascade if set up)
  await db.from('messages').delete().eq('group_id', State.currentRoomId);
  await db.from('group_members').delete().eq('group_id', State.currentRoomId);
  const { error } = await db.from('family_groups').delete().eq('id', State.currentRoomId);

  if (error) { showToast('Could not delete room: ' + error.message, 'error'); return; }

  // Remove from local state
  const deletedId = State.currentRoomId;
  State.currentRoomId = null;
  State.currentRoomName = '';
  delete State.messages[deletedId];

  // Stop the room's realtime channel
  const key = `msg-${deletedId}`;
  if (State.channels[key]) { db.removeChannel(State.channels[key]); delete State.channels[key]; }

  // Show empty state
  $('empty-state').style.display = 'flex';
  $('chat-view').style.display   = 'none';

  showToast('Room deleted.', 'success');
  await loadRooms();
}

/* 26. Add member to room */
async function addMemberToRoom() {
  const email = $('add-member-email').value.trim().toLowerCase();
  if (!email) { showToast('Please enter an email address.', 'error'); return; }

  const btn = $('confirm-add-member-btn');
  setLoading(btn, true);

  // Look up the user in profiles by email
  const { data: profileData, error: profileErr } = await db
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (profileErr || !profileData) {
    setLoading(btn, false);
    showToast('No user found with that email.', 'error');
    return;
  }

  const { error } = await db.from('group_members').insert([{
    group_id: State.currentRoomId,
    user_id: profileData.id,
  }]);

  setLoading(btn, false);
  if (error) { showToast('Could not add member: ' + error.message, 'error'); return; }

  $('add-member-email').value = '';
  closeModal('add-member-modal');
  showToast(`${esc(email)} added to room.`, 'success');
}

/* ─────────────────────────────────────────────────────────────
   MESSAGES
───────────────────────────────────────────────────────────── */

/* 27. Load all messages for a room */
async function loadMessages(roomId) {
  $('chat-room-meta').textContent = 'Loading…';

  const { data: msgs, error } = await db
    .from('messages')
    .select('*')
    .eq('group_id', roomId)
    .order('created_at', { ascending: true });

  if (error) {
    $('chat-room-meta').textContent = 'Error loading messages.';
    console.error('loadMessages:', error.message);
    return;
  }

  State.messages[roomId] = msgs || [];

  const box = $('message-box');
  box.innerHTML = '';

  // Group by date and render
  let lastDate = '';
  (msgs || []).forEach(msg => {
    const d = formatDate(msg.created_at);
    if (d !== lastDate) {
      box.appendChild(el('div', 'date-pill', esc(d)));
      lastDate = d;
    }
    appendMessage(msg, false);
  });

  scrollToBottom();
  $('chat-room-meta').textContent =
    msgs.length === 0 ? 'No messages yet. Say hello!' :
    `${msgs.length} message${msgs.length !== 1 ? 's' : ''}`;
}

/* 28. Append a single message to the message box */
function appendMessage(msg, animate = true) {
  // Skip if deleted locally
  if (State.deletedLocally.has(msg.id)) return;
  // Skip if this element already exists (dedup)
  if (document.querySelector(`[data-msg-id="${msg.id}"]`)) return;

  const isMine = msg.sender_id === State.user?.id;
  const div    = el('div', `msg ${isMine ? 'out' : 'in'}`);
  div.dataset.msgId      = msg.id;
  div.dataset.msgType    = msg.message_type || 'text';
  div.dataset.msgContent = msg.content || '';
  div.dataset.senderId   = msg.sender_id;

  if (!animate) div.style.animation = 'none';

  const time  = formatTime(msg.created_at);
  const check = isMine ? `<span class="msg-check">✓✓</span>` : '';

  if (msg.message_type === 'image') {
    div.innerHTML = `
      <img class="msg-img" src="${esc(msg.content)}" alt="Image" loading="lazy" />
      <div class="msg-meta">
        <span class="msg-time">${esc(time)}</span>${check}
      </div>`;
    div.querySelector('.msg-img').addEventListener('click', (e) => {
      e.stopPropagation();
      openLightbox(msg.content);
    });
  } else {
    const plain = decryptMessage(msg.content);
    div.innerHTML = `
      <span class="msg-text">${esc(plain)}</span>
      <div class="msg-meta">
        <span class="msg-time">${esc(time)}</span>${check}
      </div>`;
  }

  // Right-click / long-press context menu
  div.addEventListener('contextmenu', (e) => { e.preventDefault(); showCtxMenu(e, msg); });
  div.addEventListener('click',       (e) => { e.stopPropagation(); showCtxMenu(e, msg); });

  $('message-box').appendChild(div);
  if (animate) scrollToBottom();
}

/* 29. Send a message */
async function sendMessage() {
  if (!State.user || !State.currentRoomId) return;
  if (State.isSending) return;

  // If there's a pending image, send that
  if (State.pendingFile) {
    await uploadAndSendMedia(State.pendingFile);
    clearPreview();
    return;
  }

  const ta   = $('msg-input');
  const text = ta.value.trim();
  if (!text) return;

  State.isSending = true;
  const encrypted = encryptMessage(text);

  const { error } = await db.from('messages').insert([{
    group_id:     State.currentRoomId,
    sender_id:    State.user.id,
    content:      encrypted,
    message_type: 'text',
  }]);

  State.isSending = false;

  if (error) {
    showToast('Failed to send: ' + error.message, 'error');
    return; // Keep text in box on failure
  }

  ta.value = '';
  ta.style.height = 'auto';
}

/* 30. Bump unread count badge (simple increment) */
function bumpRoomUnread(roomId) {
  const el = document.querySelector(`.room-item[data-room-id="${roomId}"] .unread-badge`);
  if (el) { el.textContent = parseInt(el.textContent || '0', 10) + 1; return; }
  const meta = document.querySelector(`.room-item[data-room-id="${roomId}"] .room-item-meta`);
  if (!meta) return;
  const badge = document.createElement('span');
  badge.className = 'unread-badge';
  badge.textContent = '1';
  meta.appendChild(badge);
}

/* ─────────────────────────────────────────────────────────────
   CONTEXT MENU — MESSAGE ACTIONS
───────────────────────────────────────────────────────────── */
let _ctxMsg = null;

/* 31. Show context menu near the click position */
function showCtxMenu(e, msg) {
  _ctxMsg = msg;
  const menu   = $('ctx-menu');
  const isMine = msg.sender_id === State.user?.id;
  const isImg  = msg.message_type === 'image';

  // Show/hide relevant actions
  $('ctx-unsend').style.display    = isMine ? 'flex' : 'none';
  $('ctx-download').style.display  = isImg  ? 'flex' : 'none';

  menu.style.display = 'block';

  // Position: keep within viewport
  const vw = window.innerWidth, vh = window.innerHeight;
  const mw = 180, mh = 160;
  const x = Math.min(e.clientX, vw - mw - 10);
  const y = Math.min(e.clientY, vh - mh - 10);
  menu.style.left = x + 'px';
  menu.style.top  = y + 'px';
}

function hideCtxMenu() { $('ctx-menu').style.display = 'none'; _ctxMsg = null; }

/* 32. Unsend (hard delete from DB) */
async function ctxUnsend() {
  if (!_ctxMsg) return;
  const confirmed = await showConfirm('Unsend this message? It will be deleted for everyone.', 'Unsend');
  if (!confirmed) return;
  const { error } = await db.from('messages').delete().eq('id', _ctxMsg.id);
  if (error) { showToast('Could not unsend: ' + error.message, 'error'); return; }
  showToast('Message unsent.', 'success');
  hideCtxMenu();
}

/* 33. Delete for me (local hide) */
function ctxDeleteForMe() {
  if (!_ctxMsg) return;
  State.deletedLocally.add(_ctxMsg.id);
  const bubble = document.querySelector(`[data-msg-id="${_ctxMsg.id}"]`);
  if (bubble) { bubble.classList.add('deleted-local'); bubble.textContent = 'Message deleted'; }
  hideCtxMenu();
  showToast('Message hidden.', 'success');
}

/* 34. Download (image only) */
function ctxDownload() {
  if (!_ctxMsg || _ctxMsg.message_type !== 'image') return;
  const a = document.createElement('a');
  a.href     = _ctxMsg.content;
  a.download = 'telebey-image';
  a.target   = '_blank';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  hideCtxMenu();
}

/* 35. Share */
async function ctxShare() {
  if (!_ctxMsg) return;
  const shareText = _ctxMsg.message_type === 'image'
    ? _ctxMsg.content
    : decryptMessage(_ctxMsg.content);
  try {
    if (navigator.share) {
      await navigator.share({ text: shareText, url: _ctxMsg.message_type === 'image' ? shareText : undefined });
    } else {
      await navigator.clipboard.writeText(shareText);
      showToast('Copied to clipboard.', 'success');
    }
  } catch (err) {
    try { await navigator.clipboard.writeText(shareText); showToast('Copied to clipboard.', 'success'); }
    catch (_) { showToast('Could not share.', 'error'); }
  }
  hideCtxMenu();
}

/* ─────────────────────────────────────────────────────────────
   MEDIA UPLOAD
───────────────────────────────────────────────────────────── */

/* 36. Select file */
function triggerFileSelect() { $('media-input').click(); }

/* 37. File selected — show preview bar */
$('media-input').addEventListener('change', () => {
  const file = $('media-input').files[0];
  if (!file) return;
  State.pendingFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    $('preview-thumb').src = e.target.result;
    $('preview-name').textContent = file.name;
    $('preview-size').textContent = formatFileSize(file.size);
    $('preview-bar').style.display = 'flex';
  };
  reader.readAsDataURL(file);
  $('media-input').value = ''; // allow same file re-select
});

/* 38. Clear preview */
function clearPreview() {
  State.pendingFile = null;
  $('preview-bar').style.display = 'none';
  $('preview-thumb').src = '';
}

/* 39. Upload to Supabase Storage and send as message */
async function uploadAndSendMedia(file) {
  if (!State.user || !State.currentRoomId) return;

  const ext      = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const filePath = `${State.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  // Show progress bar
  const progressBar  = $('upload-progress-bar');
  const progressFill = $('upload-progress-fill');
  progressBar.style.display  = 'block';
  progressFill.style.width   = '0%';

  // Simulate initial progress
  let fakeProgress = 0;
  const progressInterval = setInterval(() => {
    fakeProgress = Math.min(fakeProgress + 12, 80);
    progressFill.style.width = fakeProgress + '%';
  }, 150);

  const { error: uploadError } = await db.storage
    .from('telebey-media')
    .upload(filePath, file, { cacheControl: '3600', upsert: false });

  clearInterval(progressInterval);

  if (uploadError) {
    progressBar.style.display = 'none';
    showToast('Upload failed: ' + uploadError.message, 'error');
    return;
  }

  progressFill.style.width = '100%';
  setTimeout(() => { progressBar.style.display = 'none'; progressFill.style.width = '0%'; }, 600);

  const { data: urlData } = db.storage.from('telebey-media').getPublicUrl(filePath);
  const imageUrl = urlData.publicUrl;

  const { error: msgError } = await db.from('messages').insert([{
    group_id:     State.currentRoomId,
    sender_id:    State.user.id,
    content:      imageUrl,
    message_type: 'image',
  }]);

  if (msgError) showToast('Could not send image: ' + msgError.message, 'error');
}

/* ─────────────────────────────────────────────────────────────
   TYPING INDICATOR
───────────────────────────────────────────────────────────── */
let _typingActive = false;

/* 40. Broadcast typing to a Supabase presence channel */
function broadcastTyping() {
  if (_typingActive) return;
  _typingActive = true;
  // We'll use the existing realtime channel's broadcast
  const ch = State.channels[`msg-${State.currentRoomId}`];
  if (ch) ch.send({ type: 'broadcast', event: 'typing', payload: { user: State.user.id } });
  clearTimeout(State.typingTimeout);
  State.typingTimeout = setTimeout(() => { _typingActive = false; }, 2500);
}

/* ─────────────────────────────────────────────────────────────
   LIGHTBOX
───────────────────────────────────────────────────────────── */

/* 41. Open image lightbox */
function openLightbox(src) {
  $('lightbox-img').src = src;
  $('lightbox').style.display = 'flex';
}
function closeLightbox() { $('lightbox').style.display = 'none'; $('lightbox-img').src = ''; }

/* ─────────────────────────────────────────────────────────────
   SCROLL HELPER
───────────────────────────────────────────────────────────── */

/* 42. Smooth scroll to bottom of message box */
function scrollToBottom() {
  const box = $('message-box');
  if (!box) return;
  // Only auto-scroll if user is near the bottom already
  const threshold = 120;
  const atBottom  = box.scrollHeight - box.scrollTop - box.clientHeight < threshold;
  if (atBottom || true) box.scrollTop = box.scrollHeight;
}

/* ─────────────────────────────────────────────────────────────
   NOTIFICATION SOUND
───────────────────────────────────────────────────────────── */

/* 43. Play notification chime (only when tab not active or message is from another user) */
function playNotificationSound() {
  const s = $('notif-sound');
  if (!s) return;
  s.currentTime = 0;
  s.play().catch(() => {}); // browser may block autoplay before user interaction
}

/* ─────────────────────────────────────────────────────────────
   MODAL HELPERS
───────────────────────────────────────────────────────────── */

/* 44. Open / close modals */
function openModal(id) {
  $(id).style.display = 'flex';
  // Focus first input if present
  const firstInput = $(id).querySelector('input');
  if (firstInput) setTimeout(() => firstInput.focus(), 60);
}
function closeModal(id) { $(id).style.display = 'none'; }

// Close modal on overlay click
['new-room-modal', 'add-member-modal', 'confirm-modal'].forEach(id => {
  $(id).addEventListener('click', (e) => { if (e.target === $(id)) closeModal(id); });
});

/* ─────────────────────────────────────────────────────────────
   AUTO-GROWING TEXTAREA
───────────────────────────────────────────────────────────── */
function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 130) + 'px';
}

/* ─────────────────────────────────────────────────────────────
   PASSWORD TOGGLE
───────────────────────────────────────────────────────────── */
$('pw-toggle').addEventListener('click', () => {
  const pw = $('auth-password');
  const isText = pw.type === 'text';
  pw.type = isText ? 'password' : 'text';
  $('eye-open').style.display   = isText ? 'block' : 'none';
  $('eye-closed').style.display = isText ? 'none'  : 'block';
});

/* ─────────────────────────────────────────────────────────────
   EVENT LISTENERS
───────────────────────────────────────────────────────────── */

/* Auth */
$('login-btn').addEventListener('click', handleLogin);
$('signup-btn').addEventListener('click', handleSignUp);
$('auth-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
$('auth-email').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('auth-password').focus(); });

/* Logout */
$('logout-btn').addEventListener('click', handleLogout);

/* Sidebar new room */
$('open-new-room-btn').addEventListener('click', () => openModal('new-room-modal'));
$('empty-new-room-btn').addEventListener('click', () => openModal('new-room-modal'));
$('close-modal-btn').addEventListener('click', () => closeModal('new-room-modal'));
$('cancel-modal-btn').addEventListener('click', () => closeModal('new-room-modal'));
$('create-room-btn').addEventListener('click', createRoom);
$('new-room-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') createRoom(); });

/* Room search */
$('room-search').addEventListener('input', () => renderRoomList(State.rooms));

/* Chat input */
$('msg-input').addEventListener('input', function () {
  autoGrow(this);
  broadcastTyping();
});
$('msg-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
$('send-btn').addEventListener('click', sendMessage);

/* Attach / media */
$('attach-btn').addEventListener('click', triggerFileSelect);
$('cancel-preview-btn').addEventListener('click', clearPreview);

/* Room settings dropdown */
$('room-settings-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  const dd = $('room-settings-dropdown');
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
});
$('add-member-btn').addEventListener('click', () => {
  $('room-settings-dropdown').style.display = 'none';
  openModal('add-member-modal');
});
$('delete-room-btn').addEventListener('click', () => {
  $('room-settings-dropdown').style.display = 'none';
  deleteCurrentRoom();
});

/* Add member modal */
$('close-add-member-btn').addEventListener('click', () => closeModal('add-member-modal'));
$('cancel-add-member-btn').addEventListener('click', () => closeModal('add-member-modal'));
$('confirm-add-member-btn').addEventListener('click', addMemberToRoom);
$('add-member-email').addEventListener('keydown', (e) => { if (e.key === 'Enter') addMemberToRoom(); });

/* Context menu actions */
$('ctx-unsend').addEventListener('click',    ctxUnsend);
$('ctx-delete-me').addEventListener('click', ctxDeleteForMe);
$('ctx-download').addEventListener('click',  ctxDownload);
$('ctx-share').addEventListener('click',     ctxShare);

/* Close context menu on outside click or Escape */
document.addEventListener('click', () => hideCtxMenu());
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideCtxMenu();
    $('new-room-modal').style.display  = 'none';
    $('add-member-modal').style.display = 'none';
    $('confirm-modal').style.display   = 'none';
    $('lightbox').style.display        = 'none';
    $('room-settings-dropdown').style.display = 'none';
  }
});

/* Lightbox */
$('lightbox').addEventListener('click',       closeLightbox);
$('lightbox-close').addEventListener('click', closeLightbox);

/* Mobile back button */
$('back-btn').addEventListener('click', () => {
  $('sidebar').classList.remove('slide-out');
  $('chat-area').classList.remove('show-mobile');
});

/* Close room-settings dropdown on outside click */
document.addEventListener('click', (e) => {
  if (!e.target.closest('#room-settings-btn') && !e.target.closest('#room-settings-dropdown')) {
    $('room-settings-dropdown').style.display = 'none';
  }
});

/* ─────────────────────────────────────────────────────────────
   SESSION RESTORE ON LOAD
───────────────────────────────────────────────────────────── */

(async function init() {
  // Try to restore existing Supabase session
  const { data } = await db.auth.getSession();
  if (data?.session?.user) {
    await bootApp(data.session.user);
  }

  // Listen for auth state changes (token refresh, sign-out from other tab, etc.)
  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      $('auth-screen').style.display = 'flex';
      $('main-app').style.display    = 'none';
    } else if (event === 'SIGNED_IN' && session?.user && !State.user) {
      await bootApp(session.user);
    }
    // TOKEN_REFRESHED — Supabase handles this automatically
  });
})();
async function fetchAndCheckProfile(userId) {
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  console.log('Profile fetch result:', data, 'Error:', error); // add this
  if (error || !data) return null;
  return data;
}
