/*  ==============================
    Auth Module — 登录 / 注册 / 用户状态
    ==============================  */

// 当前用户信息缓存（被首页与评论模块复用）
let currentUser = null;
let currentProfile = null;

const AVATAR_EMOJIS = ['🙂', '😎', '🤖', '🦊', '🐼', '🦄', '🍀', '🌙', '🔥', '✨', '🎭', '🧠'];

let profileAvatarDraft = {
  emoji: '🙂',
  file: null,
  previewUrl: ''
};

function getAuthClient() {
  if (typeof supabase !== 'undefined' && supabase?.auth) return supabase;
  if (window.supabaseClient?.auth) return window.supabaseClient;
  if (window.db?.auth) return window.db;
  return null;
}

function hashSeed(input) {
  const text = String(input || '');
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickAvatarEmoji(seed) {
  return AVATAR_EMOJIS[hashSeed(seed) % AVATAR_EMOJIS.length];
}

function isEmojiAvatarValue(value) {
  return typeof value === 'string' && value.startsWith('emoji:');
}

function isUrlAvatarValue(value) {
  return typeof value === 'string' && /^(https?:\/\/|data:image\/)/.test(value);
}

function isLegacyAvatarValue(value) {
  return typeof value === 'string' && value.includes('api.dicebear.com/7.x/bottts-neutral');
}

function getEmojiFromAvatarValue(value, seed) {
  if (isEmojiAvatarValue(value)) {
    const emoji = value.slice('emoji:'.length).trim();
    return emoji || pickAvatarEmoji(seed);
  }
  return pickAvatarEmoji(seed);
}

function emojiToDataUrl(emoji) {
  const safeEmoji = emoji || '🙂';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <rect width="96" height="96" rx="48" fill="#f5f3ff"/>
      <text x="50%" y="54%" font-size="52" text-anchor="middle" dominant-baseline="middle">${safeEmoji}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function normalizeAvatarValue(value, seed) {
  if (isEmojiAvatarValue(value)) return value;
  if (isUrlAvatarValue(value) && !isLegacyAvatarValue(value)) return value;
  return `emoji:${getEmojiFromAvatarValue(value, seed)}`;
}

function resolveAvatarSrc(value, seed) {
  const normalized = normalizeAvatarValue(value, seed);
  if (isEmojiAvatarValue(normalized)) return emojiToDataUrl(getEmojiFromAvatarValue(normalized, seed));
  return normalized;
}

function avatarToBadgeHtml(value, seed, className) {
  const normalized = normalizeAvatarValue(value, seed);
  if (isEmojiAvatarValue(normalized)) {
    return `<span class="${className} auth-avatar-emoji">${getEmojiFromAvatarValue(normalized, seed)}</span>`;
  }
  return `<img class="${className}" src="${escapeAttr(normalized)}" alt="头像">`;
}

window.AvatarKit = {
  pickAvatarEmoji,
  normalizeAvatarValue,
  resolveAvatarSrc,
  getEmojiFromAvatarValue,
  avatarToBadgeHtml
};

function normalizeAuthErrorMessage(msg) {
  if (!msg) return '操作失败';
  if (msg.includes('Cannot read properties of undefined') && msg.includes('signUp')) {
    return '认证模块初始化失败，请刷新页面后重试';
  }
  if (msg.includes('over_email_send_rate_limit') || msg.includes('email rate limit exceeded') || msg.includes('Too Many Requests')) {
    return '当前注册邮件发送过于频繁，请稍后再试（或在 Supabase 调高邮件发送额度）';
  }
  if (msg.includes('upstream request timeout') || msg.includes('Gateway Timeout') || msg.includes('504')) {
    return '注册邮件发送超时：请检查 Supabase 自定义 SMTP 连通性与账号配置';
  }
  if (msg.includes('email_address_invalid') || msg.includes('Unable to validate email address')) {
    return '邮箱地址格式不正确，请更换常用邮箱重试';
  }
  if (msg.includes('Invalid login')) return '邮箱或密码错误';
  if (msg.includes('Email not confirmed')) return '邮箱未验证，请先去邮箱完成验证';
  if (msg.includes('Signups not allowed')) return '当前站点暂未开放注册，请联系管理员';
  if (msg.includes('Invalid API key')) return '站点认证配置异常（Supabase Key 无效）';
  if (msg.includes('already registered')) return '该邮箱已注册，请直接登录';
  if (msg.includes('valid email')) return '请输入有效邮箱';
  return msg;
}

function escapeAttr(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ── 初始化：检查登录状态 ── */
async function initAuth() {
  const client = getAuthClient();
  if (!client?.auth) {
    console.error('Supabase Client 未初始化，auth 模块未启动');
    return;
  }

  const { data: { session } } = await client.auth.getSession();
  if (session) {
    currentUser = session.user;
    await loadProfile();
  }
  renderAuthUI();

  client.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      currentUser = session.user;
      await loadProfile();
    } else {
      currentUser = null;
      currentProfile = null;
    }
    renderAuthUI();
  });
}

/* ── 加载用户 Profile ── */
async function loadProfile() {
  const client = getAuthClient();
  if (!client || !currentUser) return;

  const { data } = await client
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .maybeSingle();

  if (data) {
    const normalizedAvatar = normalizeAvatarValue(data.avatar_url, currentUser.id);
    currentProfile = { ...data, avatar_url: normalizedAvatar };
    if (normalizedAvatar !== data.avatar_url) {
      await client.from('profiles').update({ avatar_url: normalizedAvatar }).eq('id', currentUser.id);
    }
    return;
  }

  const avatarEmoji = currentUser.user_metadata?.avatar_emoji || pickAvatarEmoji(currentUser.id);
  await client.from('profiles').upsert({
    id: currentUser.id,
    nickname: currentUser.user_metadata?.nickname || '匿名觉者',
    avatar_url: `emoji:${avatarEmoji}`
  });

  const { data: fallbackProfile } = await client
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .maybeSingle();

  currentProfile = fallbackProfile || {
    nickname: currentUser.user_metadata?.nickname || currentUser.email || '用户',
    avatar_url: `emoji:${avatarEmoji}`
  };
}

/* ── 渲染顶部登录状态 ── */
function renderAuthUI() {
  const container = document.getElementById('auth-status');
  if (!container) return;

  if (currentUser) {
    const displayName = currentProfile?.nickname || currentUser.user_metadata?.nickname || currentUser.email || '用户';
    const avatarHtml = avatarToBadgeHtml(currentProfile?.avatar_url, currentUser.id, 'auth-avatar');
    container.innerHTML = `
      <div class="auth-user" onclick="toggleAuthMenu()">
        ${avatarHtml}
        <span class="auth-name">${displayName}</span>
      </div>
      <div class="auth-menu" id="auth-menu">
        <button onclick="openEditProfile()">编辑资料</button>
        <button onclick="handleLogout()">退出登录</button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <button class="auth-login-btn" onclick="openAuthModal()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        登录
      </button>
    `;
  }
}

function toggleAuthMenu() {
  const menu = document.getElementById('auth-menu');
  if (menu) menu.classList.toggle('show');
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('auth-menu');
  if (menu && !e.target.closest('.auth-user')) {
    menu.classList.remove('show');
  }
});

/* ── 登录弹窗 ── */
function openAuthModal() {
  const existing = document.getElementById('auth-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'auth-modal';
  modal.className = 'auth-modal';
  modal.innerHTML = `
    <div class="auth-modal-backdrop" onclick="closeAuthModal()"></div>
    <div class="auth-modal-content">
      <button class="auth-modal-close" onclick="closeAuthModal()">✕</button>
      <p class="auth-modal-sub auth-modal-sub-main">登录后可获得更多权限</p>

      <div class="auth-tabs">
        <button class="auth-tab active" onclick="switchAuthTab('login', this)">登录</button>
        <button class="auth-tab" onclick="switchAuthTab('register', this)">注册</button>
      </div>

      <form id="auth-form" onsubmit="handleAuthSubmit(event)">
        <div class="auth-field">
          <label>邮箱</label>
          <input type="email" id="auth-email" placeholder="your@email.com" required autocomplete="email">
        </div>
        <div class="auth-field">
          <label>密码</label>
          <input type="password" id="auth-password" placeholder="至少6位" required minlength="6" autocomplete="current-password">
        </div>
        <div class="auth-field auth-nickname-field" style="display:none">
          <label>昵称</label>
          <input type="text" id="auth-nickname" placeholder="给自己取个名字" autocomplete="nickname">
        </div>
        <p class="auth-error" id="auth-error"></p>
        <button type="submit" class="auth-submit-btn" id="auth-submit-btn">登录</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('show'));
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }
}

let authMode = 'login';

function switchAuthTab(mode, btn) {
  authMode = mode;
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  const nicknameField = document.querySelector('.auth-nickname-field');
  const submitBtn = document.getElementById('auth-submit-btn');
  const passwordInput = document.getElementById('auth-password');

  if (mode === 'register') {
    nicknameField.style.display = 'block';
    submitBtn.textContent = '注册';
    if (passwordInput) passwordInput.setAttribute('autocomplete', 'new-password');
  } else {
    nicknameField.style.display = 'none';
    submitBtn.textContent = '登录';
    if (passwordInput) passwordInput.setAttribute('autocomplete', 'current-password');
  }
  document.getElementById('auth-error').textContent = '';
}

/* ── 提交登录/注册 ── */
async function handleAuthSubmit(e) {
  e.preventDefault();
  const client = getAuthClient();

  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errorEl = document.getElementById('auth-error');
  const submitBtn = document.getElementById('auth-submit-btn');

  submitBtn.disabled = true;
  submitBtn.textContent = '处理中...';
  errorEl.textContent = '';

  try {
    if (!client?.auth) {
      throw new Error('认证模块初始化失败，请刷新页面后重试');
    }

    if (authMode === 'register') {
      const nickname = document.getElementById('auth-nickname').value.trim() || '匿名觉者';
      const avatarEmoji = pickAvatarEmoji(email || nickname || Date.now());
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { nickname, avatar_emoji: avatarEmoji }
        }
      });
      if (error) throw error;

      if (data.user && data.session) {
        await client.from('profiles').upsert({
          id: data.user.id,
          nickname,
          avatar_url: `emoji:${avatarEmoji}`
        });
      }

      if (!data.session) {
        errorEl.textContent = '注册成功，请先去邮箱完成验证，再返回登录。';
        return;
      }
      closeAuthModal();
    } else {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      closeAuthModal();
    }
  } catch (err) {
    errorEl.textContent = normalizeAuthErrorMessage(err?.message || '操作失败');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = authMode === 'register' ? '注册' : '登录';
  }
}

/* ── 退出 ── */
async function handleLogout() {
  const client = getAuthClient();
  if (!client?.auth) return;
  await client.auth.signOut();
  currentUser = null;
  currentProfile = null;
  renderAuthUI();
}

/* ── 编辑资料（昵称 / 表情头像 / 上传头像） ── */
function openEditProfile() {
  if (!currentUser) return;

  const menu = document.getElementById('auth-menu');
  if (menu) menu.classList.remove('show');

  const existing = document.getElementById('profile-modal');
  if (existing) existing.remove();

  profileAvatarDraft = {
    emoji: getEmojiFromAvatarValue(currentProfile?.avatar_url, currentUser.id),
    file: null,
    previewUrl: ''
  };

  const modal = document.createElement('div');
  modal.id = 'profile-modal';
  modal.className = 'auth-modal';
  modal.innerHTML = `
    <div class="auth-modal-backdrop" onclick="closeProfileModal()"></div>
    <div class="auth-modal-content profile-edit-content">
      <button class="auth-modal-close" onclick="closeProfileModal()">✕</button>
      <h3 class="profile-edit-title">编辑资料</h3>

      <div class="profile-avatar-preview" id="profile-avatar-preview"></div>

      <div class="auth-field">
        <label>昵称</label>
        <input type="text" id="profile-nickname" maxlength="20" value="${escapeAttr(currentProfile?.nickname || '')}">
      </div>

      <div class="profile-emoji-grid" id="profile-emoji-grid">
        ${AVATAR_EMOJIS.map(emoji => `
          <button type="button" class="profile-emoji-option${emoji === profileAvatarDraft.emoji ? ' active' : ''}" onclick="selectProfileEmoji('${emoji}')">${emoji}</button>
        `).join('')}
      </div>

      <label class="profile-upload-btn">
        上传头像图片（可覆盖表情头像）
        <input type="file" id="profile-avatar-file" accept="image/*" onchange="handleProfileAvatarFile(this)">
      </label>

      <p class="auth-error" id="profile-edit-error"></p>
      <button type="button" class="auth-submit-btn" id="profile-save-btn" onclick="saveProfileChanges()">保存资料</button>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('show'));
  refreshProfileAvatarPreview();
}

function closeProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }

  if (profileAvatarDraft.previewUrl) {
    URL.revokeObjectURL(profileAvatarDraft.previewUrl);
  }
  profileAvatarDraft.previewUrl = '';
  profileAvatarDraft.file = null;
}

function refreshProfileAvatarPreview() {
  const preview = document.getElementById('profile-avatar-preview');
  if (!preview) return;

  if (profileAvatarDraft.previewUrl) {
    preview.innerHTML = `<img class="profile-avatar-preview-img" src="${profileAvatarDraft.previewUrl}" alt="头像预览">`;
  } else {
    preview.innerHTML = `<span class="profile-avatar-preview-emoji">${profileAvatarDraft.emoji}</span>`;
  }
}

function selectProfileEmoji(emoji) {
  profileAvatarDraft.emoji = emoji;
  profileAvatarDraft.file = null;

  if (profileAvatarDraft.previewUrl) {
    URL.revokeObjectURL(profileAvatarDraft.previewUrl);
    profileAvatarDraft.previewUrl = '';
  }

  const input = document.getElementById('profile-avatar-file');
  if (input) input.value = '';

  document.querySelectorAll('.profile-emoji-option').forEach(btn => {
    btn.classList.toggle('active', btn.textContent === emoji);
  });
  refreshProfileAvatarPreview();
}

function handleProfileAvatarFile(input) {
  const file = input.files && input.files[0];
  const errorEl = document.getElementById('profile-edit-error');
  if (errorEl) errorEl.textContent = '';

  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    if (errorEl) errorEl.textContent = '头像图片不能超过 5MB';
    input.value = '';
    return;
  }

  profileAvatarDraft.file = file;
  if (profileAvatarDraft.previewUrl) URL.revokeObjectURL(profileAvatarDraft.previewUrl);
  profileAvatarDraft.previewUrl = URL.createObjectURL(file);
  refreshProfileAvatarPreview();
}

async function saveProfileChanges() {
  const client = getAuthClient();
  if (!client || !currentUser) return;

  const nicknameInput = document.getElementById('profile-nickname');
  const saveBtn = document.getElementById('profile-save-btn');
  const errorEl = document.getElementById('profile-edit-error');
  if (!nicknameInput || !saveBtn || !errorEl) return;

  const nickname = nicknameInput.value.trim() || '匿名觉者';
  saveBtn.disabled = true;
  saveBtn.textContent = '保存中...';
  errorEl.textContent = '';

  try {
    let avatarValue = `emoji:${profileAvatarDraft.emoji || pickAvatarEmoji(currentUser.id)}`;

    if (profileAvatarDraft.file) {
      const ext = profileAvatarDraft.file.name.split('.').pop() || 'png';
      const filePath = `avatars/${currentUser.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await client.storage
        .from('comment-images')
        .upload(filePath, profileAvatarDraft.file, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicData } = client.storage.from('comment-images').getPublicUrl(filePath);
      avatarValue = publicData.publicUrl;
    }

    const { error } = await client
      .from('profiles')
      .update({ nickname, avatar_url: avatarValue })
      .eq('id', currentUser.id);
    if (error) throw error;

    currentProfile = { ...(currentProfile || {}), nickname, avatar_url: avatarValue };
    renderAuthUI();
    closeProfileModal();
  } catch (err) {
    errorEl.textContent = normalizeAuthErrorMessage(err?.message || '保存失败');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '保存资料';
  }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initAuth);
