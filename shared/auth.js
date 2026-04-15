/*  ==============================
    Auth Module 鈥?鐧诲綍 / 娉ㄥ唽 / 鐢ㄦ埛鐘舵€?
    ==============================  */

// 褰撳墠鐢ㄦ埛淇℃伅缂撳瓨锛堣棣栭〉涓庤瘎璁烘ā鍧楀鐢級
let currentUser = null;
let currentProfile = null;

const AVATAR_EMOJIS = [
  '🙂', '😄', '😆', '😉', '😊', '🥰', '😎', '🤩', '🧐', '🤖',
  '🦊', '🐼', '🐯', '🐨', '🦁', '🦉', '🦄', '🐬', '🐳', '🦋',
  '🐶', '🐱', '🌙', '⭐', '✨', '🔥', '🌈', '🍀', '🌸', '🌻',
  '🍃', '💫', '🎭', '🎨', '🎵', '📚', '🧠', '💡', '🕊️', '☀️',
  '🌊', '🏔️'
];

let profileAvatarDraft = {
  emoji: '🙂',
  file: null,
  previewUrl: ''
};

const PROFILE_AVATAR_CANDIDATE_FIELDS = ['avatar_url', 'avatar', 'avatar_emoji'];
let resolvedProfileAvatarField = null;
let profileAvatarFieldResolved = false;
let authMode = 'login';
let pendingRegisterEmail = '';
let pendingRegisterNickname = '';
let otpCooldownTimer = null;
let otpCooldownSeconds = 0;
const NETWORK_TIMEOUT_MS = 12000;
const MIN_PASSWORD_LENGTH = 6;

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
  return `<img class="${className}" src="${escapeAttr(normalized)}" alt="澶村儚">`;
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
  const lowerMsg = String(msg).toLowerCase();
  if (msg.includes('同步用户资料超时') || msg.includes('读取用户资料超时') || msg.includes('保存资料超时')) {
    return '网络较慢，资料同步超时，请稍后刷新页面查看结果';
  }
  if (msg.includes('Cannot read properties of undefined') && msg.includes('signUp')) {
    return '认证模块初始化失败，请刷新页面后重试';
  }
  if (msg.includes('over_email_send_rate_limit') || msg.includes('email rate limit exceeded') || msg.includes('Too Many Requests')) {
    return '当前注册邮件发送过于频繁，请稍后再试';
  }
  if (msg.includes('upstream request timeout') || msg.includes('Gateway Timeout') || msg.includes('504')) {
    return '邮件发送超时，请稍后再试';
  }
  if (msg.includes('email_address_invalid') || msg.includes('Unable to validate email address')) {
    return '邮箱地址格式不正确，请更换常用邮箱重试';
  }
  if (msg.includes('Password should be at least')) return `密码至少需要 ${MIN_PASSWORD_LENGTH} 位`;
  if (lowerMsg.includes('weak password')) return `密码强度不足，请至少使用 ${MIN_PASSWORD_LENGTH} 位`;
  if (msg.includes('Invalid login')) return '邮箱或密码错误';
  if (msg.includes('Email not confirmed')) return '邮箱未验证，请先完成邮箱验证';
  if (msg.includes('Signups not allowed')) return '当前站点暂未开放注册，请联系管理员';
  if (msg.includes('Invalid API key')) return '站点认证配置异常';
  if (lowerMsg.includes('user already registered') || lowerMsg.includes('already registered')) return '该邮箱已注册，请直接登录';
  if (lowerMsg.includes('invalid') && lowerMsg.includes('token')) return '验证码无效，请重新输入';
  if (lowerMsg.includes('expired') && lowerMsg.includes('token')) return '验证码已过期，请重新获取';
  if (lowerMsg.includes('otp_expired')) return '验证码已过期，请重新获取';
  if (lowerMsg.includes('otp_disabled')) return '当前未开启邮箱验证码登录';
  if (msg.includes('already registered')) return '该邮箱已注册，请直接登录';
  if (msg.includes('valid email')) return '请输入有效邮箱';
  return msg;
}

function isMissingProfilesColumnError(error) {
  const msg = String(error?.message || '');
  return msg.includes("column of 'profiles' in the schema cache");
}

function getAvatarFromProfileRecord(record, seed) {
  if (!record || typeof record !== 'object') return normalizeAvatarValue('', seed);
  if (typeof record.avatar_url === 'string' && record.avatar_url) return normalizeAvatarValue(record.avatar_url, seed);
  if (typeof record.avatar === 'string' && record.avatar) return normalizeAvatarValue(record.avatar, seed);
  if (typeof record.avatar_emoji === 'string' && record.avatar_emoji) return normalizeAvatarValue(`emoji:${record.avatar_emoji}`, seed);
  return normalizeAvatarValue('', seed);
}

function getAvatarStorageValue(field, normalizedAvatarValue, seed) {
  if (field === 'avatar_emoji') return getEmojiFromAvatarValue(normalizedAvatarValue, seed);
  return normalizedAvatarValue;
}

function inferAvatarFieldFromProfile(record) {
  if (!record || typeof record !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(record, 'avatar_url')) return 'avatar_url';
  if (Object.prototype.hasOwnProperty.call(record, 'avatar')) return 'avatar';
  if (Object.prototype.hasOwnProperty.call(record, 'avatar_emoji')) return 'avatar_emoji';
  return null;
}

async function resolveProfileAvatarField(client) {
  if (profileAvatarFieldResolved) return resolvedProfileAvatarField;

  for (const field of PROFILE_AVATAR_CANDIDATE_FIELDS) {
    const { error } = await client.from('profiles').select(field).limit(1);
    if (!error) {
      resolvedProfileAvatarField = field;
      profileAvatarFieldResolved = true;
      return resolvedProfileAvatarField;
    }
    if (!isMissingProfilesColumnError(error)) {
      break;
    }
  }

  resolvedProfileAvatarField = null;
  profileAvatarFieldResolved = true;
  return null;
}

async function upsertProfileCompat(client, basePayload, avatarValue, seed) {
  const field = await resolveProfileAvatarField(client);
  const payload = { ...basePayload };
  if (field) payload[field] = getAvatarStorageValue(field, avatarValue, seed);

  const { error } = await client.from('profiles').upsert(payload);
  if (!error) return;

  if (field && isMissingProfilesColumnError(error)) {
    // schema cache may be stale or field differs; retry without avatar field
    profileAvatarFieldResolved = false;
    resolvedProfileAvatarField = null;
    const retryPayload = { ...basePayload };
    const { error: retryError } = await client.from('profiles').upsert(retryPayload);
    if (retryError) throw retryError;
    return;
  }
  throw error;
}

async function updateProfileCompat(client, userId, nickname, avatarValue, seed) {
  const field = await resolveProfileAvatarField(client);
  const payload = { nickname };
  if (field) payload[field] = getAvatarStorageValue(field, avatarValue, seed);

  const { error } = await client.from('profiles').update(payload).eq('id', userId);
  if (!error) return;

  if (field && isMissingProfilesColumnError(error)) {
    profileAvatarFieldResolved = false;
    resolvedProfileAvatarField = null;
    const retryPayload = { nickname };
    const { error: retryError } = await client.from('profiles').update(retryPayload).eq('id', userId);
    if (retryError) throw retryError;
    return;
  }
  throw error;
}

function escapeAttr(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function withTimeout(promise, ms, message) {
  let timer = null;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    })
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function buildFallbackNickname(seed) {
  return `觉者${100 + (hashSeed(seed || Date.now()) % 900)}`;
}

async function generateDefaultNickname(client) {
  let candidateNumber = 100;

  try {
    const { count, error } = await client
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (!error) {
      candidateNumber = 100 + (count || 0);
    }
  } catch (_error) {
    candidateNumber = 100 + (Date.now() % 900);
  }

  for (let offset = 0; offset < 8; offset++) {
    const nickname = `觉者${candidateNumber + offset}`;
    try {
      const { data, error } = await client
        .from('profiles')
        .select('id')
        .eq('nickname', nickname)
        .limit(1);

      if (error || !Array.isArray(data) || data.length === 0) {
        return nickname;
      }
    } catch (_error) {
      return nickname;
    }
  }

  return buildFallbackNickname(Date.now());
}

function buildLocalProfile(user) {
  const nickname = user?.user_metadata?.nickname || currentProfile?.nickname || buildFallbackNickname(user?.id || user?.email);
  const metadataAvatar = user?.user_metadata?.avatar_url || (user?.user_metadata?.avatar_emoji ? `emoji:${user.user_metadata.avatar_emoji}` : '');
  const avatarEmoji = user?.user_metadata?.avatar_emoji || pickAvatarEmoji(user?.id || nickname);
  return {
    email: user?.email || '',
    nickname,
    avatar_url: normalizeAvatarValue(metadataAvatar || `emoji:${avatarEmoji}`, user?.id || nickname)
  };
}

async function syncProfileAfterAuth(client, user) {
  if (!client || !user?.id) return;

  const localProfile = buildLocalProfile(user);
  currentUser = user;
  currentProfile = { ...(currentProfile || {}), ...localProfile, id: user.id };
  renderAuthUI();

  try {
    await withTimeout(
      upsertProfileCompat(client, { id: user.id, email: user.email || '', nickname: localProfile.nickname }, localProfile.avatar_url, user.id),
      NETWORK_TIMEOUT_MS,
      '同步用户资料超时'
    );
  } catch (_e) {
    // Keep UI usable even if profile sync is delayed upstream.
  }

  try {
    await withTimeout(loadProfile(), NETWORK_TIMEOUT_MS, '读取用户资料超时');
  } catch (_e) {
    currentProfile = { ...(currentProfile || {}), ...localProfile, id: user.id };
  }

  renderAuthUI();
}

/* 鈹€鈹€ 鍒濆鍖栵細妫€鏌ョ櫥褰曠姸鎬?鈹€鈹€ */
async function initAuth() {
  const client = getAuthClient();
  if (!client?.auth) {
    console.error('Supabase Client 未初始化，auth 模块未启动');
    return;
  }

  try {
    const { data: { session } } = await withTimeout(
      client.auth.getSession(),
      NETWORK_TIMEOUT_MS,
      '读取登录状态超时'
    );
    if (session) {
      await syncProfileAfterAuth(client, session.user);
    }
    renderAuthUI();
  } catch (err) {
    console.error(normalizeAuthErrorMessage(err?.message || '初始化登录状态失败'));
    renderAuthUI();
  }

  client.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      await syncProfileAfterAuth(client, session.user);
    } else {
      currentUser = null;
      currentProfile = null;
    }
    renderAuthUI();
  });
}

/* 鈹€鈹€ 鍔犺浇鐢ㄦ埛 Profile 鈹€鈹€ */
async function loadProfile() {
  const client = getAuthClient();
  if (!client || !currentUser) return;

  const { data } = await client
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .maybeSingle();

  if (data) {
    const inferredField = inferAvatarFieldFromProfile(data);
    if (inferredField) {
      resolvedProfileAvatarField = inferredField;
      profileAvatarFieldResolved = true;
    }
    const metadataAvatar = buildLocalProfile(currentUser).avatar_url;
    const normalizedAvatar = inferredField
      ? getAvatarFromProfileRecord(data, currentUser.id)
      : metadataAvatar;
    currentProfile = { ...data, avatar_url: normalizedAvatar };
    const originalAvatar = getAvatarFromProfileRecord({
      avatar_url: data.avatar_url,
      avatar: data.avatar,
      avatar_emoji: data.avatar_emoji
    }, currentUser.id);
    if (normalizedAvatar !== originalAvatar) {
      try {
        await updateProfileCompat(client, currentUser.id, currentProfile.nickname || '匿名觉者', normalizedAvatar, currentUser.id);
      } catch (_e) {
        // ignore avatar normalization failure to avoid blocking auth flow
      }
    }
    return;
  }

  const avatarEmoji = currentUser.user_metadata?.avatar_emoji || pickAvatarEmoji(currentUser.id);
  const normalizedAvatar = normalizeAvatarValue(`emoji:${avatarEmoji}`, currentUser.id);
  try {
    await upsertProfileCompat(client, {
      id: currentUser.id,
      email: currentUser.email || '',
      nickname: currentUser.user_metadata?.nickname || '匿名觉者'
    }, normalizedAvatar, currentUser.id);
  } catch (_e) {
    // if profiles write fails, still keep auth usable with metadata fallback
  }

  const { data: fallbackProfile } = await client
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .maybeSingle();

  if (fallbackProfile) {
    const fallbackAvatar = getAvatarFromProfileRecord(fallbackProfile, currentUser.id);
    currentProfile = { ...fallbackProfile, avatar_url: fallbackAvatar };
    return;
  }

  currentProfile = {
    nickname: currentUser.user_metadata?.nickname || currentUser.email || '用户',
    avatar_url: normalizedAvatar
  };
}

/* 鈹€鈹€ 娓叉煋椤堕儴鐧诲綍鐘舵€?鈹€鈹€ */
function renderAuthUI() {
  const container = document.getElementById('auth-status');
  if (!container) return;

  if (currentUser) {
    const displayName = currentProfile?.nickname || currentUser.user_metadata?.nickname || currentUser.email || '用户';
    const avatarHtml = avatarToBadgeHtml(currentProfile?.avatar_url, currentUser.id, 'auth-avatar');
    container.innerHTML = `
      <div class="auth-user" onclick="openEditProfile()">
        ${avatarHtml}
        <span class="auth-name">${displayName}</span>
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

function openAuthModal() {
  const existing = document.getElementById('auth-modal');
  if (existing) existing.remove();
  authMode = 'login';
  pendingRegisterEmail = '';
  pendingRegisterNickname = '';

  const modal = document.createElement('div');
  modal.id = 'auth-modal';
  modal.className = 'auth-modal';
  modal.innerHTML = `
    <div class="auth-modal-backdrop" onclick="closeAuthModal()"></div>
    <div class="auth-modal-content">
      <button class="auth-modal-close" onclick="closeAuthModal()">✕</button>
      <div class="auth-mode-switch">
        <button type="button" class="auth-mode-tab active" id="auth-tab-login" onclick="setAuthMode('login')">登录</button>
        <button type="button" class="auth-mode-tab" id="auth-tab-register" onclick="setAuthMode('register')">注册</button>
      </div>
      <p class="auth-modal-sub auth-modal-sub-main" id="auth-modal-sub">登录后可修改昵称</p>

      <form id="auth-form" onsubmit="handleAuthSubmit(event)">
        <div class="auth-field">
          <label>邮箱</label>
          <input type="email" id="auth-email" placeholder="your@email.com" required autocomplete="email">
        </div>

        <div class="auth-field">
          <label>密码</label>
          <input type="password" id="auth-password" placeholder="请输入密码" required autocomplete="current-password" minlength="6">
        </div>

        <div class="auth-otp-row is-hidden" id="auth-otp-row">
          <div class="auth-field auth-otp-code-field">
            <label>验证码</label>
            <input type="text" id="auth-code" placeholder="输入验证码" autocomplete="one-time-code" inputmode="numeric">
          </div>
          <button type="button" class="auth-otp-send-btn" id="auth-send-btn" onclick="sendRegisterOtpCode()">发送验证码</button>
        </div>

        <p class="auth-error" id="auth-error"></p>
        <button type="submit" class="auth-submit-btn" id="auth-submit-btn">登录</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('show'));

  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const codeInput = document.getElementById('auth-code');
  if (emailInput) emailInput.addEventListener('input', updateAuthSubmitState);
  if (passwordInput) passwordInput.addEventListener('input', updateAuthSubmitState);
  if (codeInput) codeInput.addEventListener('input', updateAuthSubmitState);
  setAuthMode('login');
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }
  pendingRegisterEmail = '';
  pendingRegisterNickname = '';
  if (otpCooldownTimer) {
    clearInterval(otpCooldownTimer);
    otpCooldownTimer = null;
  }
  otpCooldownSeconds = 0;
}

function setAuthMode(mode) {
  authMode = mode === 'register' ? 'register' : 'login';
  updateAuthModalUI();
}

function updateAuthModalUI() {
  const loginTab = document.getElementById('auth-tab-login');
  const registerTab = document.getElementById('auth-tab-register');
  const subtitle = document.getElementById('auth-modal-sub');
  const otpRow = document.getElementById('auth-otp-row');
  const passwordInput = document.getElementById('auth-password');
  const codeInput = document.getElementById('auth-code');
  const submitBtn = document.getElementById('auth-submit-btn');
  const errorEl = document.getElementById('auth-error');
  if (!loginTab || !registerTab || !subtitle || !otpRow || !passwordInput || !codeInput || !submitBtn || !errorEl) return;

  const registerMode = authMode === 'register';
  loginTab.classList.toggle('active', !registerMode);
  registerTab.classList.toggle('active', registerMode);
  subtitle.textContent = registerMode ? '登录后可获得更多权限' : '登录后可修改昵称';
  otpRow.classList.toggle('is-hidden', !registerMode);
  passwordInput.autocomplete = registerMode ? 'new-password' : 'current-password';
  codeInput.required = registerMode;
  submitBtn.textContent = registerMode ? '验证注册' : '登录';
  errorEl.textContent = '';
  setOtpButtonLabel();
  updateAuthSubmitState();
}

function updateAuthSubmitState() {
  const submitBtn = document.getElementById('auth-submit-btn');
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const codeInput = document.getElementById('auth-code');
  if (!submitBtn || !emailInput || !passwordInput || !codeInput) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  const code = codeInput.value.trim();
  const registerMode = authMode === 'register';
  submitBtn.disabled = !email || !password || (registerMode && !code);
}

function setOtpButtonLabel() {
  const sendBtn = document.getElementById('auth-send-btn');
  if (!sendBtn) return;
  sendBtn.textContent = otpCooldownSeconds > 0 ? `${otpCooldownSeconds}s` : '发送验证码';
  sendBtn.disabled = otpCooldownSeconds > 0;
}

function startOtpCooldown(seconds) {
  otpCooldownSeconds = seconds;
  setOtpButtonLabel();
  if (otpCooldownTimer) clearInterval(otpCooldownTimer);
  otpCooldownTimer = setInterval(() => {
    otpCooldownSeconds -= 1;
    if (otpCooldownSeconds <= 0) {
      otpCooldownSeconds = 0;
      clearInterval(otpCooldownTimer);
      otpCooldownTimer = null;
    }
    setOtpButtonLabel();
  }, 1000);
}

function primeAuthenticatedUI(authedUser, overrideNickname) {
  const localProfile = buildLocalProfile({
    ...authedUser,
    user_metadata: {
      ...(authedUser?.user_metadata || {}),
      ...(overrideNickname ? { nickname: overrideNickname } : {})
    }
  });
  const avatarEmoji = getEmojiFromAvatarValue(localProfile.avatar_url, authedUser.id);

  currentUser = {
    ...authedUser,
    user_metadata: {
      ...(authedUser?.user_metadata || {}),
      nickname: localProfile.nickname,
      avatar_emoji: avatarEmoji,
      avatar_url: localProfile.avatar_url
    }
  };
  currentProfile = { ...(currentProfile || {}), ...localProfile, id: authedUser.id };
  renderAuthUI();
  return localProfile;
}

async function ensureRegisterAccountAvailable(client, email) {
  const { data, error } = await client
    .from('profiles')
    .select('id')
    .eq('email', email)
    .limit(1);

  if (!error && (data || []).length > 0) {
    throw new Error('该邮箱已注册，请直接登录');
  }
}

async function sendRegisterOtpCode() {
  const client = getAuthClient();
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const sendBtn = document.getElementById('auth-send-btn');
  const errorEl = document.getElementById('auth-error');
  if (!client?.auth || !emailInput || !passwordInput || !sendBtn || !errorEl) return;

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value.trim();
  if (!email) {
    errorEl.textContent = '请输入邮箱';
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    errorEl.textContent = `密码至少需要 ${MIN_PASSWORD_LENGTH} 位`;
    return;
  }

  errorEl.textContent = '';
  sendBtn.disabled = true;
  sendBtn.textContent = '发送中...';

  try {
    await ensureRegisterAccountAvailable(client, email);
    pendingRegisterNickname = await generateDefaultNickname(client);
    const { error } = await withTimeout(
      client.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: {
            nickname: pendingRegisterNickname
          }
        }
      }),
      NETWORK_TIMEOUT_MS,
      '发送验证码超时'
    );
    if (error) throw error;

    pendingRegisterEmail = email;
    startOtpCooldown(60);
  } catch (err) {
    errorEl.textContent = normalizeAuthErrorMessage(err?.message || '发送验证码失败');
    otpCooldownSeconds = 0;
    setOtpButtonLabel();
  }
}

async function finishPasswordAuth(client, authedUser, overrideNickname) {
  if (!authedUser?.id) return;

  const localProfile = primeAuthenticatedUI(authedUser, overrideNickname);
  const avatarEmoji = getEmojiFromAvatarValue(localProfile.avatar_url, authedUser.id);

  await Promise.allSettled([
    withTimeout(
      upsertProfileCompat(
        client,
        {
          id: authedUser.id,
          email: authedUser.email || '',
          nickname: localProfile.nickname
        },
        localProfile.avatar_url,
        authedUser.id
      ),
      NETWORK_TIMEOUT_MS,
      '同步用户资料超时'
    ),
    withTimeout(
      client.auth.updateUser({
        data: {
          nickname: localProfile.nickname,
          avatar_emoji: avatarEmoji,
          avatar_url: localProfile.avatar_url
        }
      }),
      NETWORK_TIMEOUT_MS,
      '更新用户元数据超时'
    )
  ]);

  try {
    await withTimeout(loadProfile(), NETWORK_TIMEOUT_MS, '读取用户资料超时');
  } catch (_error) {
    currentProfile = { ...(currentProfile || {}), ...localProfile, id: authedUser.id };
  }

  renderAuthUI();
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const client = getAuthClient();
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const codeInput = document.getElementById('auth-code');
  const errorEl = document.getElementById('auth-error');
  const submitBtn = document.getElementById('auth-submit-btn');
  if (!emailInput || !passwordInput || !codeInput || !submitBtn || !errorEl) return;

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value.trim();
  const code = codeInput.value.trim();
  if (!email || !password) {
    errorEl.textContent = '请输入邮箱和密码';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = authMode === 'register' ? '验证中...' : '登录中...';
  errorEl.textContent = '';

  try {
    if (!client?.auth) {
      throw new Error('认证模块初始化失败，请刷新页面后重试');
    }

    if (authMode === 'register') {
      const registerNickname = pendingRegisterNickname || await generateDefaultNickname(client);
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`密码至少需要 ${MIN_PASSWORD_LENGTH} 位`);
      }
      if (!code) {
        throw new Error('请输入验证码');
      }

      const verifyEmail = pendingRegisterEmail || email;
      const { data, error } = await withTimeout(
        client.auth.verifyOtp({
          email: verifyEmail,
          token: code,
          type: 'email'
        }),
        NETWORK_TIMEOUT_MS,
        '验证码验证超时'
      );
      if (error) throw error;

      const authedUser = data?.user || data?.session?.user;
      if (!authedUser?.id) {
        throw new Error('验证码验证失败，请重新获取');
      }

      await withTimeout(
        Promise.allSettled([
          withTimeout(
            client.auth.updateUser({
              password,
              data: {
                nickname: registerNickname
              }
            }),
            NETWORK_TIMEOUT_MS,
            '设置密码超时'
          ),
          withTimeout(
            upsertProfileCompat(
              client,
              {
                id: authedUser.id,
                email: authedUser.email || email,
                nickname: registerNickname
              },
              buildLocalProfile({
                ...authedUser,
                user_metadata: {
                  ...(authedUser.user_metadata || {}),
                  nickname: registerNickname
                }
              }).avatar_url,
              authedUser.id
            ),
            NETWORK_TIMEOUT_MS,
            '同步用户资料超时'
          )
        ]),
        NETWORK_TIMEOUT_MS,
        '设置注册资料超时'
      );

      await client.auth.signOut();
      currentUser = null;
      currentProfile = null;
      setAuthMode('login');
      emailInput.value = email;
      passwordInput.value = password;
      codeInput.value = '';
      pendingRegisterEmail = '';
      pendingRegisterNickname = '';
      renderAuthUI();
      updateAuthSubmitState();
      return;
    }

    const { data, error } = await withTimeout(
      client.auth.signInWithPassword({ email, password }),
      NETWORK_TIMEOUT_MS,
      '登录超时'
    );
    if (error) throw error;

    if (data?.user) {
      primeAuthenticatedUI(data.user);
      closeAuthModal();
      finishPasswordAuth(client, data.user).catch((syncError) => {
        console.error('登录后资料同步失败:', syncError);
      });
    }
  } catch (err) {
    errorEl.textContent = normalizeAuthErrorMessage(err?.message || '操作失败');
  } finally {
    const activeSubmitBtn = document.getElementById('auth-submit-btn');
    if (activeSubmitBtn) {
      activeSubmitBtn.textContent = authMode === 'register' ? '验证注册' : '登录';
    }
    updateAuthSubmitState();
  }
}

async function handleLogout() {
  const client = getAuthClient();
  currentUser = null;
  currentProfile = null;
  renderAuthUI();

  if (!client?.auth) return;

  try {
    await withTimeout(client.auth.signOut(), 5000, '退出登录超时');
  } catch (err) {
    console.error('退出登录失败:', err);
  }
}

function openEditProfile() {
  if (!currentUser) return;

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
      <button class="auth-modal-logout" onclick="confirmLogout()" title="退出登录" aria-label="退出登录">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
      </button>
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
        上传头像图片
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

async function confirmLogout() {
  if (confirm('是否退出登录？')) {
    closeProfileModal();
    await handleLogout();
  }
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

  const nickname = nicknameInput.value.trim() || currentProfile?.nickname || buildFallbackNickname(currentUser.id);
  saveBtn.disabled = true;
  saveBtn.textContent = '保存中...';
  errorEl.textContent = '';

  try {
    let avatarValue = normalizeAvatarValue(`emoji:${profileAvatarDraft.emoji || pickAvatarEmoji(currentUser.id)}`, currentUser.id);

    if (profileAvatarDraft.file) {
      const ext = profileAvatarDraft.file.name.split('.').pop() || 'png';
      const filePath = `avatars/${currentUser.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await withTimeout(
        client.storage
          .from('comment-images')
          .upload(filePath, profileAvatarDraft.file, { cacheControl: '3600', upsert: true }),
        NETWORK_TIMEOUT_MS,
        '头像上传超时'
      );
      if (uploadError) throw uploadError;

      const { data: publicData } = client.storage.from('comment-images').getPublicUrl(filePath);
      avatarValue = publicData.publicUrl;
    }

    const avatarEmoji = getEmojiFromAvatarValue(avatarValue, currentUser.id);

    currentUser = {
      ...(currentUser || {}),
      user_metadata: {
        ...((currentUser && currentUser.user_metadata) || {}),
        nickname,
        avatar_url: avatarValue,
        avatar_emoji: avatarEmoji
      }
    };

    currentProfile = { ...(currentProfile || {}), nickname, avatar_url: avatarValue, id: currentUser.id };
    renderAuthUI();
    closeProfileModal();

    Promise.allSettled([
      withTimeout(
        updateProfileCompat(client, currentUser.id, nickname, avatarValue, currentUser.id),
        NETWORK_TIMEOUT_MS,
        '保存资料超时'
      ),
      withTimeout(
        client.auth.updateUser({
          data: {
            nickname,
            avatar_url: avatarValue,
            avatar_emoji: avatarEmoji
          }
        }),
        NETWORK_TIMEOUT_MS,
        '更新用户元数据超时'
      )
    ]).then((results) => {
      const rejected = results.find(result => result.status === 'rejected');
      if (rejected) {
        console.error('资料同步失败:', rejected.reason);
      }
    });
  } catch (err) {
    errorEl.textContent = normalizeAuthErrorMessage(err?.message || '保存失败');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '保存资料';
  }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initAuth);

