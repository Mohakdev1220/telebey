// ============================================================
//  TELEBEY — Production Script
//  Features: Auth, Rooms, Realtime, E2EE, Media Upload, Search
// ============================================================

// ── 1. SUPABASE INIT ──────────────────────────────────────
const SUPABASE_URL = 'https://nfnbwrrvjpkrnayzyihd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mbmJ3cnJ2anBrcm5heXp5aWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDU2NjcsImV4cCI6MjA5NzE4MTY2N30.Uwuk6_Btflb_EmtuwOAP2HcuaL99gwFG3AuV2aG1Pjc';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── 2. APP STATE ──────────────────────────────────────────
const App = {
    currentUser:     null,
    currentGroupId:  null,
    realtimeChannel: null,
    allGroups:       [],
    pendingImageFile: null,
};

// ── 3. DOM REFS ───────────────────────────────────────────
const DOM = {
    authContainer:    () => document.getElementById('auth-container'),
    mainApp:          () => document.getElementById('main-app'),
    emailInput:       () => document.getElementById('auth-email'),
    passwordInput:    () => document.getElementById('auth-password'),
    loginBtn:         () => document.getElementById('login-btn'),
    signupBtn:        () => document.getElementById('signup-btn'),
    authError:        () => document.getElementById('auth-error'),
    togglePw:         () => document.getElementById('toggle-pw'),
    userDisplayName:  () => document.getElementById('user-display-name'),
    userAvatarSidebar:() => document.getElementById('user-avatar-sidebar'),
    groupList:        () => document.getElementById('group-list'),
    roomSearch:       () => document.getElementById('room-search'),
    newRoomBtn:       () => document.getElementById('new-room-btn'),
    emptyNewRoomBtn:  () => document.getElementById('empty-new-room-btn'),
    newRoomModal:     () => document.getElementById('new-room-modal'),
    closeModalBtn:    () => document.getElementById('close-modal-btn'),
    cancelModalBtn:   () => document.getElementById('cancel-modal-btn'),
    makeGroupBtn:     () => document.getElementById('make-group-btn'),
    newGroupName:     () => document.getElementById('new-group-name'),
    newGroupDesc:     () => document.getElementById('new-group-desc'),
    emptyState:       () => document.getElementById('empty-state'),
    chatView:         () => document.getElementById('chat-view'),
    messageBox:       () => document.getElementById('message-box'),
    userInput:        () => document.getElementById('user-input'),
    sendBtn:          () => document.getElementById('send-btn'),
    attachBtn:        () => document.getElementById('attach-btn'),
    mediaInput:       () => document.getElementById('media-input'),
    imagePreviewBar:  () => document.getElementById('image-preview-bar'),
    previewImg:       () => document.getElementById('preview-img'),
    cancelImageBtn:   () => document.getElementById('cancel-image-btn'),
    chatRoomName:     () => document.getElementById('chat-room-name'),
    chatRoomStatus:   () => document.getElementById('chat-room-status'),
    chatAvatar:       () => document.getElementById('chat-avatar'),
    backBtn:          () => document.getElementById('back-btn'),
    logoutBtn:        () => document.getElementById('logout-btn'),
    notifSound:       () => document.getElementById('notif-sound'),
    sidebar:          () => document.getElementById('sidebar'),
};

// ── 4. UTILITIES ──────────────────────────────────────────

/** Show a toast message */
function showToast(msg, type = '') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3100);
}

/** Show / hide auth error */
function setAuthError(msg) {
    const el = DOM.authError();
    if (msg) { el.textContent = msg; el.style.display = 'block'; }
    else      { el.textContent = ''; el.style.display = 'none'; }
}

/** Set loading state on a button */
function setButtonLoading(btn, loading) {
    const text   = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');
    if (!text || !loader) { btn.disabled = loading; return; }
    text.style.display   = loading ? 'none' : '';
    loader.style.display = loading ? 'inline-block' : 'none';
    btn.disabled = loading;
}

/** Get a deterministic avatar color class from a string */
function avatarColor(name = '') {
    const colors = ['av-blue', 'av-teal', 'av-purple', 'av-red', 'av-orange'];
    const idx = name.charCodeAt(0) % colors.length;
    return colors[idx];
}

/** Get initials (up to 2 chars) from a name */
function getInitial(name = '') {
    return name.trim().charAt(0).toUpperCase() || '?';
}

/** Format a UTC timestamp to a short time string (e.g. "18:45") */
function formatTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Auto-grow a textarea */
function autoGrow(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

// ── 5. E2EE (Base64 pseudo-encryption) ────────────────────

function encryptMessage(text) {
    try {
        return 'E2EE::' + btoa(unescape(encodeURIComponent(text)));
    } catch { return text; }
}

function decryptMessage(cipher) {
    if (!cipher || !cipher.startsWith('E2EE::')) return cipher || '';
    try {
        return decodeURIComponent(escape(atob(cipher.replace('E2EE::', ''))));
    } catch {
        return '🔒 (Could not decrypt)';
    }
}

// ── 6. AUTH ───────────────────────────────────────────────

async function handleSignUp() {
    const email    = DOM.emailInput().value.trim();
    const password = DOM.passwordInput().value.trim();

    if (!email || !password) { setAuthError('Please enter your email and password.'); return; }
    if (password.length < 6) { setAuthError('Password must be at least 6 characters.'); return; }

    setAuthError('');
    const btn = DOM.signupBtn();
    btn.disabled = true;
    btn.textContent = 'Creating…';

    const { error } = await db.auth.signUp({ email, password });

    btn.disabled = false;
    btn.textContent = 'Create Account';

    if (error) {
        setAuthError(error.message);
    } else {
        showToast('Account created! Check your email to confirm, then sign in.', 'success');
    }
}

async function handleLogin() {
    const email    = DOM.emailInput().value.trim();
    const password = DOM.passwordInput().value.trim();

    if (!email || !password) { setAuthError('Please enter your email and password.'); return; }

    setAuthError('');
    const btn = DOM.loginBtn();
    setButtonLoading(btn, true);

    const { data, error } = await db.auth.signInWithPassword({ email, password });

    setButtonLoading(btn, false);

    if (error) {
        setAuthError(error.message);
    } else {
        launchApp(data.user);
    }
}

async function handleLogout() {
    await db.auth.signOut();
    App.currentUser    = null;
    App.currentGroupId = null;
    App.allGroups      = [];
    if (App.realtimeChannel) {
        db.removeChannel(App.realtimeChannel);
        App.realtimeChannel = null;
    }
    DOM.mainApp().style.display    = 'none';
    DOM.authContainer().style.display = 'flex';
    DOM.emailInput().value    = '';
    DOM.passwordInput().value = '';
    setAuthError('');
}

// ── 7. APP INIT ───────────────────────────────────────────

function launchApp(user) {
    App.currentUser = user;
    DOM.authContainer().style.display = 'none';
    DOM.mainApp().style.display = 'flex';

    // Show user info in sidebar
    const emailShort = user.email.split('@')[0];
    DOM.userDisplayName().textContent = user.email;
    const avatarEl = DOM.userAvatarSidebar();
    avatarEl.textContent = getInitial(emailShort);
    avatarEl.className = `avatar avatar-sm ${avatarColor(emailShort)}`;

    loadSidebarGroups();
}

// ── 8. SIDEBAR ────────────────────────────────────────────

async function loadSidebarGroups() {
    const { data: groups, error } = await db
        .from('family_groups')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) { console.error('Failed to load rooms:', error.message); return; }

    App.allGroups = groups || [];
    renderGroupList(App.allGroups);

    // If no room is open and there are rooms, open the first
    if (!App.currentGroupId && App.allGroups.length > 0) {
        openRoom(App.allGroups[0].id, App.allGroups[0].name);
    } else if (App.allGroups.length === 0) {
        // Auto-create a default lounge
        const { data: newGroup } = await db
            .from('family_groups')
            .insert([{ name: 'Telebey Lounge', description: 'The main room', is_personal_chat: false }])
            .select();
        if (newGroup && newGroup[0]) {
            App.allGroups = [newGroup[0]];
            renderGroupList(App.allGroups);
            openRoom(newGroup[0].id, newGroup[0].name);
        }
    }
}

function renderGroupList(groups) {
    const container = DOM.groupList();
    container.innerHTML = '';

    if (groups.length === 0) {
        container.innerHTML = '<div style="padding:20px 14px; color:var(--text-muted); font-size:0.82rem; text-align:center;">No rooms yet. Create one!</div>';
        return;
    }

    groups.forEach(group => {
        const item = document.createElement('div');
        item.className = `chat-item${App.currentGroupId === group.id ? ' active-chat' : ''}`;
        item.dataset.groupId = group.id;

        const colorClass = avatarColor(group.name);
        const initial    = getInitial(group.name);

        item.innerHTML = `
            <div class="avatar ${colorClass}">${initial}</div>
            <div class="chat-info">
                <strong>${escapeHtml(group.name)}</strong>
                <span class="chat-preview">${escapeHtml(group.description || 'Tap to chat')}</span>
            </div>
        `;

        item.addEventListener('click', () => {
            openRoom(group.id, group.name);
            // Mobile: hide sidebar, show chat
            DOM.sidebar().classList.add('hidden-mobile');
            DOM.chatView().parentElement.classList.add('active-mobile');
        });

        container.appendChild(item);
    });
}

// ── 9. ROOM MANAGEMENT ────────────────────────────────────

async function createNewRoom() {
    const name = DOM.newGroupName().value.trim();
    const desc = DOM.newGroupDesc().value.trim();

    if (!name) { showToast('Please enter a room name.', 'error'); return; }

    const btn = DOM.makeGroupBtn();
    btn.disabled = true;
    btn.textContent = 'Creating…';

    const { data, error } = await db
        .from('family_groups')
        .insert([{
            name,
            description: desc || `Created by ${App.currentUser.email.split('@')[0]}`,
            is_personal_chat: false,
        }])
        .select();

    btn.disabled = false;
    btn.textContent = 'Create Room';

    if (error) {
        showToast('Failed to create room: ' + error.message, 'error');
        return;
    }

    DOM.newGroupName().value = '';
    DOM.newGroupDesc().value = '';
    closeModal();

    await loadSidebarGroups();

    if (data && data[0]) {
        openRoom(data[0].id, data[0].name);
    }
}

// ── 10. OPEN / SWITCH ROOM ────────────────────────────────

function openRoom(groupId, groupName) {
    if (App.currentGroupId === groupId) return;

    App.currentGroupId = groupId;

    // Update header
    const initial    = getInitial(groupName);
    const colorClass = avatarColor(groupName);
    DOM.chatAvatar().textContent  = initial;
    DOM.chatAvatar().className    = `chat-header-avatar ${colorClass}`;
    DOM.chatRoomName().textContent = groupName;
    DOM.chatRoomStatus().textContent = 'Loading messages…';

    // Toggle views
    DOM.emptyState().style.display  = 'none';
    const chatView = DOM.chatView();
    chatView.style.display = 'flex';

    // Reset message box
    DOM.messageBox().innerHTML = `<div class="messages-date-label">Today</div>`;

    // Sidebar highlight
    document.querySelectorAll('.chat-item').forEach(el => {
        el.classList.toggle('active-chat', el.dataset.groupId === groupId);
    });

    // Realtime: remove old channel, create new
    if (App.realtimeChannel) {
        db.removeChannel(App.realtimeChannel);
        App.realtimeChannel = null;
    }
    setupRealtimeListener(groupId);

    // Load messages
    loadMessages(groupId);
}

// ── 11. MESSAGES: LOAD ────────────────────────────────────

async function loadMessages(groupId) {
    const { data: messages, error } = await db
        .from('messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Messages load error:', error.message);
        DOM.chatRoomStatus().textContent = 'Error loading messages.';
        return;
    }

    const box = DOM.messageBox();
    box.innerHTML = `<div class="messages-date-label">Today</div>`;

    let prevSenderId = null;
    messages.forEach((msg, i) => {
        const isConsecutive = prevSenderId === msg.sender_id;
        displayMessage(msg, isConsecutive);
        prevSenderId = msg.sender_id;
    });

    box.scrollTop = box.scrollHeight;
    DOM.chatRoomStatus().textContent = `${messages.length} message${messages.length !== 1 ? 's' : ''}`;
}

// ── 12. MESSAGES: DISPLAY ─────────────────────────────────

function displayMessage(msg, consecutive = false) {
    const box       = DOM.messageBox();
    const isMine    = msg.sender_id === App.currentUser?.id;
    const div       = document.createElement('div');

    div.className = `message ${isMine ? 'sent' : 'received'}${consecutive ? (isMine ? ' consecutive-sent' : ' consecutive-recv') : ' different-group'}`;

    const time  = formatTime(msg.created_at);
    const check = isMine ? '<span class="msg-check">✓✓</span>' : '';

    if (msg.message_type === 'image') {
        div.innerHTML = `
            <img class="chat-image" src="${escapeHtml(msg.content)}" alt="Image" loading="lazy">
            <div class="msg-meta"><span class="msg-time">${time}</span>${check}</div>
        `;
        div.querySelector('.chat-image').addEventListener('click', () => openLightbox(msg.content));
    } else {
        const text = decryptMessage(msg.content);
        div.innerHTML = `
            <span class="msg-content">${escapeHtml(text)}</span>
            <div class="msg-meta"><span class="msg-time">${time}</span>${check}</div>
        `;
    }

    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

// ── 13. SEND MESSAGE (CORRECTED) ─────────────────────────

async function sendMessage() {
    if (!App.currentUser || !App.currentGroupId) {
        showToast('Bhai, login session ya group missing hai!', 'error');
        return;
    }

    // Handle pending image
    if (App.pendingImageFile) {
        await uploadAndSendImage(App.pendingImageFile);
        clearImagePreview();
        return;
    }

    const textarea = DOM.userInput();
    const text = textarea.value.trim();
    if (!text) return;

    // E2EE Lock lagao
    const encrypted = encryptMessage(text);

    // Pehle database mein insert karo, value abhi mat udao
    const { error } = await db.from('messages').insert([{
        group_id:     App.currentGroupId,
        sender_id:    App.currentUser.id, // Ensure karo ye App.currentUser.id hi ho
        content:      encrypted,
        message_type: 'text',
    }]);

    if (error) {
        showToast('Send failed: ' + error.message, 'error');
        // Error aaya toh text input mein hi rahega, user ka content bachega
    } else {
        // Success hone par hi text box khali karo
        textarea.value = '';
        autoGrow(textarea);
    }
}

// ── 14. MEDIA UPLOAD ─────────────────────────────────────

function selectFile() {
    DOM.mediaInput().click();
}

DOM.mediaInput().addEventListener('change', () => {
    const file = DOM.mediaInput().files[0];
    if (!file) return;

    // Show preview
    App.pendingImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        DOM.previewImg().src = e.target.result;
        DOM.imagePreviewBar().style.display = 'flex';
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected
    DOM.mediaInput().value = '';
});

function clearImagePreview() {
    App.pendingImageFile = null;
    DOM.imagePreviewBar().style.display = 'none';
    DOM.previewImg().src = '';
}

async function uploadAndSendImage(file) {
    if (!App.currentUser || !App.currentGroupId) return;

    showToast('Uploading image…');

    const ext      = file.name.split('.').pop().toLowerCase() || 'jpg';
    const filePath = `${App.currentUser.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await db.storage
        .from('telebey-media')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
        showToast('Upload failed: ' + uploadError.message, 'error');
        return;
    }

    const { data: publicUrlData } = db.storage.from('telebey-media').getPublicUrl(filePath);
    const imageUrl = publicUrlData.publicUrl;

    const { error: msgError } = await db.from('messages').insert([{
        group_id:     App.currentGroupId,
        sender_id:    App.currentUser.id,
        content:      imageUrl,
        message_type: 'image',
    }]);

    if (msgError) showToast('Failed to send image: ' + msgError.message, 'error');
}

// ── 15. REALTIME ─────────────────────────────────────────

function setupRealtimeListener(groupId) {
    App.realtimeChannel = db
        .channel(`room-${groupId}`)
        .on(
            'postgres_changes',
            {
                event:  'INSERT',
                schema: 'public',
                table:  'messages',
                filter: `group_id=eq.${groupId}`,
            },
            (payload) => {
                const msg = payload.new;
                // Avoid duplicate display (our own sent messages come back via realtime too)
                // Only display if it's from someone else, or for our own messages the insert
                // already rendered them via sendMessage. For simplicity, we always display
                // and rely on the DB insert return to not double-show:
                // Better: only display remote messages, and optimistically display own.
                // Here we display ALL (no optimistic UI) so the DB is the source of truth.
                displayMessage(msg);
                if (msg.sender_id !== App.currentUser?.id) {
                    playNotificationSound();
                }
            }
        )
        .subscribe();
}

// ── 16. SEARCH ────────────────────────────────────────────

DOM.roomSearch().addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const filtered = query
        ? App.allGroups.filter(g => g.name.toLowerCase().includes(query) || (g.description || '').toLowerCase().includes(query))
        : App.allGroups;
    renderGroupList(filtered);
});

// ── 17. MODAL ────────────────────────────────────────────

function openModal() {
    DOM.newRoomModal().style.display = 'flex';
    DOM.newGroupName().focus();
}

function closeModal() {
    DOM.newRoomModal().style.display = 'none';
}

DOM.newRoomModal().addEventListener('click', (e) => {
    if (e.target === DOM.newRoomModal()) closeModal();
});

// ── 18. LIGHTBOX ─────────────────────────────────────────

function openLightbox(src) {
    const lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.innerHTML = `<button id="lightbox-close">✕</button><img src="${escapeHtml(src)}" alt="Image">`;
    document.body.appendChild(lb);
    lb.querySelector('#lightbox-close').addEventListener('click', () => lb.remove());
    lb.addEventListener('click', (e) => { if (e.target === lb) lb.remove(); });
}

// ── 19. NOTIFICATION SOUND ───────────────────────────────

function playNotificationSound() {
    const sound = DOM.notifSound();
    if (!sound) return;
    sound.currentTime = 0;
    sound.play().catch(() => {}); // blocked by browser until user interaction, that's ok
}

// ── 20. MOBILE BACK ──────────────────────────────────────

DOM.backBtn().addEventListener('click', () => {
    DOM.sidebar().classList.remove('hidden-mobile');
    DOM.chatView().parentElement.classList.remove('active-mobile');
});

// ── 21. HELPERS ──────────────────────────────────────────

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ── 22. EVENT LISTENERS ──────────────────────────────────

// Auth
DOM.loginBtn().addEventListener('click', handleLogin);
DOM.signupBtn().addEventListener('click', handleSignUp);
DOM.passwordInput().addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
DOM.emailInput().addEventListener('keydown', (e) => { if (e.key === 'Enter') DOM.passwordInput().focus(); });

// Password toggle
DOM.togglePw().addEventListener('click', () => {
    const pw = DOM.passwordInput();
    pw.type = pw.type === 'password' ? 'text' : 'password';
});

// Logout
DOM.logoutBtn().addEventListener('click', handleLogout);

// Room creation
DOM.newRoomBtn().addEventListener('click', openModal);
DOM.emptyNewRoomBtn().addEventListener('click', openModal);
DOM.makeGroupBtn().addEventListener('click', createNewRoom);
DOM.closeModalBtn().addEventListener('click', closeModal);
DOM.cancelModalBtn().addEventListener('click', closeModal);
DOM.newGroupName().addEventListener('keydown', (e) => { if (e.key === 'Enter') createNewRoom(); });

// Message sending
DOM.sendBtn().addEventListener('click', sendMessage);
DOM.userInput().addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
DOM.userInput().addEventListener('input', function() { autoGrow(this); });

// Media
DOM.attachBtn().addEventListener('click', selectFile);
DOM.cancelImageBtn().addEventListener('click', clearImagePreview);

// ── 23. RESTORE SESSION ON LOAD ──────────────────────────
(async function init() {
    const { data } = await db.auth.getSession();
    if (data?.session?.user) {
        launchApp(data.session.user);
    }

    // Listen for auth changes (e.g. token refresh, sign-out from another tab)
    db.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            DOM.mainApp().style.display    = 'none';
            DOM.authContainer().style.display = 'flex';
        } else if (event === 'SIGNED_IN' && session?.user && !App.currentUser) {
            launchApp(session.user);
        }
    });
})();
// Login hone ke baad ye function check karega ki tum approved ho ya nahi
async function checkAdminApproval(userId) {
    const { data: profile, error } = await db
        .from('profiles')
        .select('is_approved')
        .eq('id', userId)
        .single();

    if (profile && !profile.is_approved) {
        showToast('Bhai, Admin (Mohak) ke approval ka intezaar karo!', 'error');
        // UI ko wapas login screen par fenk do
        DOM.mainApp().style.display = 'none';
        DOM.authContainer().style.display = 'flex';
        return false;
    }
    return true;
}
// ── MESSAGES ADVANCED ACTIONS ───────────────────────────

// A. UNSEND (Delete for Everyone)
async function unsendMessage(messageId, senderId) {
    if (senderId !== App.currentUser.id) {
        showToast("Bhai, dusre ka message unsend nahi kar sakte!", "error");
        return;
    }
    
    // Database mein record delete karne ki jagah content badal do ya entry mita do
    const { error } = await db
        .from('messages')
        .delete()
        .eq('id', messageId);

    if (!error) {
        showToast("Message unsent!");
        loadMessages(); // Refresh chat
    }
}

// B. DELETE FOR ME (Sirf meri screen se gayab ho)
async function deleteForMe(messageId) {
    // Current user ki ID ko array mein push kar do database mein
    const { error } = await db.rpc('append_user_to_deleted', {
        msg_id: messageId,
        user_id: App.currentUser.id
    });
    
    // Sasta frontend jugaad: UI se mita do instantly
    loadMessages();
}

// C. DOWNLOAD FILE / IMAGE
function downloadMedia(fileUrl, filename = 'Telebey-Media.jpg') {
    fetch(fileUrl)
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
        }).catch(() => showToast("Download fail ho gaya", "error"));
}

// D. SHARE MESSAGE
function shareMessage(text, mediaUrl = null) {
    const shareData = {
        title: 'Telebey Messenger',
        text: mediaUrl ? `Sent a file via Telebey: ${text}` : text,
        url: mediaUrl || window.location.href
    };

    if (navigator.share) {
        navigator.share(shareData)
            .then(() => showToast('Shared successfully!'))
            .catch((e) => console.log('Share cancelled', e));
    } else {
        // Fallback: Copy to clipboard agar browser share support nahi karta
        navigator.clipboard.writeText(mediaUrl || text);
        showToast('Link/Text copied to clipboard!');
    }
}
