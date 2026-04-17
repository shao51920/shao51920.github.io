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
  '🌊', '🏔️', '🪐', '🌌', '🐚', '🍄', '🕯️', '🎐'
];

let profileAvatarDraft = {
  emoji: '🙂',
  value: '',
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
const NETWORK_TIMEOUT_MS = 25000;
const OTP_VERIFY_TIMEOUT_MS = 20000;
const MIN_PASSWORD_LENGTH = 6;
const PROFILE_SAVE_TIMEOUT_CODE = 'PROFILE_DB_SAVE_TIMEOUT';

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

function revokeDraftPreviewUrl(url) {
  if (typeof url === 'string' && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
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

async function updateProfileCompat(client, userId, nickname, avatarValue, seed, bio = '') {
  const field = await resolveProfileAvatarField(client);
  const payload = { nickname, bio };
  if (field) payload[field] = getAvatarStorageValue(field, avatarValue, seed);

  const { error } = await client.from('profiles').update(payload).eq('id', userId);
  if (!error) return;

  if (field && isMissingProfilesColumnError(error)) {
    profileAvatarFieldResolved = false;
    resolvedProfileAvatarField = null;
    const retryPayload = { nickname, bio };
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProfileSaveTimeout(error) {
  const message = String(error?.message || '');
  return message.includes(PROFILE_SAVE_TIMEOUT_CODE) || message.includes('淇濆瓨鍚屾鍒版暟鎹簱瓒呮椂');
}

function profileMatchesExpected(record, expectedProfile, userId) {
  if (!record || typeof record !== 'object') return false;
  if (String(record.nickname || '') !== String(expectedProfile.nickname || '')) return false;

  if (Object.prototype.hasOwnProperty.call(record, 'bio')) {
    if (String(record.bio || '') !== String(expectedProfile.bio || '')) return false;
  }

  const hasAvatarField = ['avatar_url', 'avatar', 'avatar_emoji'].some((field) =>
    Object.prototype.hasOwnProperty.call(record, field)
  );
  if (!hasAvatarField) return true;

  return getAvatarFromProfileRecord(record, userId) === normalizeAvatarValue(expectedProfile.avatar_url, userId);
}

async function verifyProfilePersisted(client, userId, expectedProfile) {
  const retryDelays = [0, 900, 1400, 2200, 3200];

  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt] > 0) {
      await sleep(retryDelays[attempt]);
    }

    try {
      const { data, error } = await withTimeout(
        client
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
        6000,
        '璇诲彇鐢ㄦ埛璧勬枡瓒呮椂'
      );

      if (error) throw error;
      if (profileMatchesExpected(data, expectedProfile, userId)) {
        return true;
      }
    } catch (verifyError) {
      console.warn('Profile save verification retry failed:', verifyError);
    }
  }

  return false;
}

function getAuthSubmitLabel(mode = authMode) {
  return mode === 'register' ? '验证注册' : '登录';
}

function markAuthMessage(message, success = false, targetId = 'auth-error') {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('is-success', Boolean(message) && success);
}

function clearAuthActionParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('auth_action')) return;
  url.searchParams.delete('auth_action');
  window.history.replaceState({}, '', url.toString());
}

function getPasswordResetRedirectUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('auth_action', 'reset');
  url.hash = '';
  return url.toString();
}

function shouldOpenPasswordReset() {
  try {
    return new URL(window.location.href).searchParams.get('auth_action') === 'reset';
  } catch (_error) {
    return false;
  }
}

function isSupabaseLockStealError(error) {
  const msg = String(error?.message || error || '');
  return msg.includes('another request stole it') || msg.includes('Lock "') || msg.includes('lock:sb-');
}

const AuthTemplates = {
  authStatus() {
    if (currentUser) {
      const displayName = currentProfile?.nickname || currentUser.user_metadata?.nickname || currentUser.email || '用户';
      const avatarHtml = avatarToBadgeHtml(currentProfile?.avatar_url, currentUser.id, 'auth-avatar');
      return `
        <div class="auth-user" onclick="openEditProfile()">
          ${avatarHtml}
          <span class="auth-name">${displayName}</span>
        </div>
      `;
    }

    return `
      <button class="auth-login-btn" onclick="openAuthModal()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        登录
      </button>
    `;
  },

  authModal() {
    return `
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
            <div class="auth-input-wrap">
              <input type="password" id="auth-password" placeholder="请输入密码" required autocomplete="current-password" minlength="6">
              <button type="button" class="auth-password-toggle" onclick="togglePasswordVisibility('auth-password', this)" aria-label="显示密码">👁</button>
            </div>
          </div>

          <div class="auth-otp-row is-hidden" id="auth-otp-row">
            <div class="auth-field auth-otp-code-field">
              <label>验证码</label>
              <input type="text" id="auth-code" placeholder="输入验证码" autocomplete="one-time-code" inputmode="numeric">
            </div>
            <button type="button" class="auth-otp-send-btn" id="auth-send-btn" onclick="sendRegisterOtpCode()">发送验证码</button>
          </div>

          <div class="auth-helper-row" id="auth-helper-row">
            <button type="button" class="auth-text-link" id="auth-forgot-btn" onclick="sendPasswordResetLink()">忘记密码？</button>
          </div>

          <p class="auth-error" id="auth-error"></p>
          <button type="submit" class="auth-submit-btn" id="auth-submit-btn">登录</button>
        </form>
      </div>
    `;
  },

  profileModal() {
    const isAdmin = currentUser?.app_metadata?.role === 'admin' || currentUser?.app_metadata?.is_admin === true;
    return `
      <div class="auth-modal-backdrop" onclick="closeProfileModal()"></div>
      <div class="auth-modal-content profile-edit-content modern-profile">
        <button class="auth-modal-close" onclick="closeProfileModal()">✕</button>
        
        <div class="profile-header-group">
          <div class="profile-avatar-wrapper">
             <div class="profile-avatar-preview" id="profile-avatar-preview"></div>
             <label class="avatar-edit-badge" title="上传头像">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <input type="file" id="profile-avatar-file" accept="image/*" style="display:none" onchange="handleProfileAvatarFile(this)">
             </label>
          </div>
          <div class="profile-main-meta">
            <input type="text" id="profile-nickname" class="minimal-input nickname-input" maxlength="20" placeholder="昵称" value="${escapeAttr(currentProfile?.nickname || '')}">
            <input type="text" id="profile-bio" class="minimal-input bio-input" maxlength="100" placeholder="点击添加个人签名..." value="${escapeAttr(currentProfile?.bio || '')}">
          </div>
        </div>

        <div class="profile-emoji-section">
          <div class="section-divider"><span>或选择内置图标</span></div>
          <div class="profile-emoji-grid-wrapper" id="profile-emoji-wrapper">
             <div class="profile-emoji-grid" id="profile-emoji-grid">
               ${AVATAR_EMOJIS.map((emoji) => `
                 <button type="button" class="profile-emoji-option${isEmojiAvatarValue(profileAvatarDraft.value) && emoji === profileAvatarDraft.emoji ? ' active' : ''}" 
                   onclick="selectProfileEmoji('${emoji}')">${emoji}</button>
               `).join('')}
             </div>
          </div>
          <button type="button" class="profile-emoji-toggle" id="profile-emoji-toggle" onclick="toggleEmojiGrid()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 9l-7 7-7-7"/>
            </svg>
            <span>更多图标</span>
          </button>
        </div>

        <div class="profile-footer-actions">
           <button type="button" class="sub-action-btn" onclick="jumpToMyComments()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            我的评论
          </button>
          ${isAdmin ? `<a href="/admin/index.html" class="sub-action-link">管理后台</a>` : ''}
          <div class="flex-spacer"></div>
          <button type="button" class="logout-link-btn" onclick="confirmLogout()">退出登录</button>
        </div>

        <p class="auth-error" id="profile-edit-error"></p>
        <button type="button" class="auth-submit-btn profile-save-btn" id="profile-save-btn" onclick="saveProfileChanges()">保存</button>
      </div>
    `;
  },

  passwordResetModal() {
    return `
      <div class="auth-modal-backdrop" onclick="closePasswordResetModal()"></div>
      <div class="auth-modal-content">
        <button class="auth-modal-close" onclick="closePasswordResetModal()">✕</button>
        <h3 class="profile-edit-title">重置密码</h3>
        <p class="auth-modal-sub auth-modal-sub-main">请输入新的登录密码</p>
        <div class="auth-field">
          <label>新密码</label>
          <div class="auth-input-wrap">
            <input type="password" id="reset-password-input" placeholder="至少6位" autocomplete="new-password" minlength="6">
            <button type="button" class="auth-password-toggle" onclick="togglePasswordVisibility('reset-password-input', this)" aria-label="显示密码">👁</button>
          </div>
        </div>
        <p class="auth-error" id="reset-password-error"></p>
        <button type="button" class="auth-submit-btn" id="reset-password-btn" onclick="submitPasswordReset()">保存新密码</button>
      </div>
    `;
  }
};

const AuthService = (() => {
  const listeners = new Set();

  function notify(type, payload = {}) {
    const snapshot = {
      currentUser,
      currentProfile,
      authMode,
      pendingRegisterEmail,
      pendingRegisterNickname,
      otpCooldownSeconds,
      profileAvatarDraft: { ...profileAvatarDraft }
    };
    listeners.forEach((listener) => {
      try {
        listener(snapshot, { type, ...payload });
      } catch (error) {
        console.error('Auth state listener failed:', error);
      }
    });
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function setSession(user, profile, type = 'session') {
    currentUser = user;
    currentProfile = profile;
    notify(type);
  }

  function setAuthModeState(mode) {
    authMode = mode === 'register' ? 'register' : 'login';
    notify('auth-mode');
  }

  function resetFlowState() {
    pendingRegisterEmail = '';
    pendingRegisterNickname = '';
    if (otpCooldownTimer) {
      clearInterval(otpCooldownTimer);
      otpCooldownTimer = null;
    }
    otpCooldownSeconds = 0;
    authMode = 'login';
    notify('auth-flow-reset');
  }

  function startCooldown(seconds) {
    otpCooldownSeconds = seconds;
    notify('otp-cooldown');
    if (otpCooldownTimer) clearInterval(otpCooldownTimer);
    otpCooldownTimer = setInterval(() => {
      otpCooldownSeconds -= 1;
      if (otpCooldownSeconds <= 0) {
        otpCooldownSeconds = 0;
        clearInterval(otpCooldownTimer);
        otpCooldownTimer = null;
      }
      notify('otp-cooldown');
    }, 1000);
  }

  function syncProfileDraft() {
    if (!currentUser) return;
    const currentAvatarValue = normalizeAvatarValue(
      currentProfile?.avatar_url
        || currentUser?.user_metadata?.avatar_url
        || (currentUser?.user_metadata?.avatar_emoji ? `emoji:${currentUser.user_metadata.avatar_emoji}` : ''),
      currentUser.id
    );
    profileAvatarDraft = {
      emoji: getEmojiFromAvatarValue(currentAvatarValue, currentUser.id),
      value: currentAvatarValue,
      file: null,
      previewUrl: isUrlAvatarValue(currentAvatarValue) ? currentAvatarValue : ''
    };
    notify('profile-draft');
  }

  function setProfileDraftEmoji(emoji) {
    profileAvatarDraft.emoji = emoji;
    profileAvatarDraft.value = `emoji:${emoji}`;
    profileAvatarDraft.file = null;
    if (profileAvatarDraft.previewUrl) {
      revokeDraftPreviewUrl(profileAvatarDraft.previewUrl);
      profileAvatarDraft.previewUrl = '';
    }
    notify('profile-draft');
  }

  function setProfileDraftFile(file, previewUrl) {
    if (profileAvatarDraft.previewUrl) {
      revokeDraftPreviewUrl(profileAvatarDraft.previewUrl);
    }
    profileAvatarDraft.value = '';
    profileAvatarDraft.file = file;
    profileAvatarDraft.previewUrl = previewUrl;
    notify('profile-draft');
  }

  function releaseProfileDraft() {
    if (profileAvatarDraft.previewUrl) {
      revokeDraftPreviewUrl(profileAvatarDraft.previewUrl);
    }
    profileAvatarDraft.previewUrl = '';
    profileAvatarDraft.value = '';
    profileAvatarDraft.file = null;
    notify('profile-draft');
  }

  async function sendOtp(email, password) {
    const client = getAuthClient();
    if (!client?.auth) throw new Error('认证模块初始化失败，请刷新页面后重试');
    if (!email) throw new Error('请输入邮箱');
    if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`密码至少需要 ${MIN_PASSWORD_LENGTH} 位`);

    await ensureRegisterAccountAvailable(client, email);
    pendingRegisterNickname = await generateDefaultNickname(client);
    notify('auth-flow-reset');

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
    notify('auth-flow-reset');
    startCooldown(60);
  }

  async function sendResetLink(email) {
    const client = getAuthClient();
    if (!client?.auth) throw new Error('认证模块初始化失败，请刷新页面后重试');
    if (!email) throw new Error('请先输入邮箱');

    const { error } = await withTimeout(
      client.auth.resetPasswordForEmail(email, {
        redirectTo: getPasswordResetRedirectUrl()
      }),
      NETWORK_TIMEOUT_MS,
      '发送重置链接超时'
    );
    if (error) throw error;
  }

  // 注册进度回调，用于UI状态更新
  let registerProgressCallback = null;

  function setRegisterProgressCallback(callback) {
    registerProgressCallback = callback;
  }

  function updateRegisterProgress(stage, message) {
    if (registerProgressCallback) {
      registerProgressCallback({ stage, message });
    }
  }

  async function submitAuthForm({ email, password, code }) {
    const client = getAuthClient();
    if (!client?.auth) throw new Error('认证模块初始化失败，请刷新页面后重试');

    if (authMode === 'register') {
      const registerNickname = pendingRegisterNickname || await generateDefaultNickname(client);
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`密码至少需要 ${MIN_PASSWORD_LENGTH} 位`);
      }
      if (!code) {
        throw new Error('请输入验证码');
      }

      const verifyEmail = pendingRegisterEmail || email;
      let verifyResult = null;

      // 阶段1: 验证验证码
      updateRegisterProgress('verifying', '正在验证验证码...');
      try {
        verifyResult = await withTimeout(
          client.auth.verifyOtp({
            email: verifyEmail,
            token: code,
            type: 'email'
          }),
          OTP_VERIFY_TIMEOUT_MS,
          '验证码验证超时'
        );
      } catch (verifyError) {
        const { data: sessionData } = await client.auth.getSession();
        const sessionUser = sessionData?.session?.user;
        if (sessionUser?.id && String(sessionUser.email || '').toLowerCase() === verifyEmail) {
          verifyResult = { data: { user: sessionUser, session: sessionData.session }, error: null };
        } else {
          throw verifyError;
        }
      }
      const { data, error } = verifyResult || {};
      if (error) throw error;

      const authedUser = data?.user || data?.session?.user;
      if (!authedUser?.id) {
        throw new Error('验证码验证失败，请重新获取');
      }

      // 阶段2: 设置账户信息
      updateRegisterProgress('creating', '正在创建您的账户...');
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

      // 阶段3: 自动登录（不再signOut，保持会话）
      updateRegisterProgress('logging_in', '正在自动登录...');

      // 清理注册状态
      pendingRegisterEmail = '';
      pendingRegisterNickname = '';
      authMode = 'login';
      if (otpCooldownTimer) {
        clearInterval(otpCooldownTimer);
        otpCooldownTimer = null;
      }
      otpCooldownSeconds = 0;

      // 初始化用户UI并同步资料
      primeAuthenticatedUI(authedUser, registerNickname);
      finishPasswordAuth(client, authedUser, registerNickname).catch((syncError) => {
        console.error('注册后资料同步失败:', syncError);
      });

      notify('register-complete');

      // 返回登录成功状态，包含用户信息
      return {
        mode: 'register',
        email,
        password,
        autoLogin: true,
        user: authedUser
      };
    }

    const { data, error } = await withTimeout(
      client.auth.signInWithPassword({ email, password }),
      NETWORK_TIMEOUT_MS,
      '登录超时'
    );
    if (error) throw error;

    if (data?.user) {
      primeAuthenticatedUI(data.user);
      finishPasswordAuth(client, data.user).catch((syncError) => {
        console.error('登录后资料同步失败:', syncError);
      });
    }

    return { mode: 'login', data };
  }

  async function logoutSession() {
    const client = getAuthClient();
    currentUser = null;
    currentProfile = null;
    notify('logout-local');

    if (!client?.auth) return;

    try {
      await withTimeout(client.auth.signOut(), 5000, '退出登录超时');
    } catch (error) {
      console.error('退出登录失败:', error);
    }
  }

  async function saveProfile(nickname, bio = '') {
    const client = getAuthClient();
    if (!client || !currentUser) throw new Error('用户未登录');

    const nextNickname = nickname || currentProfile?.nickname || buildFallbackNickname(currentUser.id);
    await ensureNicknameAvailable(client, nextNickname, currentUser.id);

    let avatarValue = normalizeAvatarValue(
      profileAvatarDraft.value
        || currentProfile?.avatar_url
        || currentUser?.user_metadata?.avatar_url
        || (currentUser?.user_metadata?.avatar_emoji ? `emoji:${currentUser.user_metadata.avatar_emoji}` : '')
        || `emoji:${profileAvatarDraft.emoji || pickAvatarEmoji(currentUser.id)}`,
      currentUser.id
    );

    if (profileAvatarDraft.file) {
      if (saveBtn) saveBtn.textContent = '正在上传图片...';
      const ext = profileAvatarDraft.file.name.split('.').pop() || 'png';
      const filePath = `avatars/${currentUser.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      
      const { error: uploadError } = await withTimeout(
        client.storage
          .from('comment-images')
          .upload(filePath, profileAvatarDraft.file, { cacheControl: '3600', upsert: true }),
        60000,
        '头像上传超时，请尝试压缩图片或检查网络后再试'
      );
      if (uploadError) throw uploadError;

      const { data: publicData } = client.storage.from('comment-images').getPublicUrl(filePath);
      avatarValue = publicData.publicUrl;
      if (saveBtn) saveBtn.textContent = '正在保存资料...';
    }

    const avatarEmoji = getEmojiFromAvatarValue(avatarValue, currentUser.id);
    currentUser = {
      ...(currentUser || {}),
      user_metadata: {
        ...((currentUser && currentUser.user_metadata) || {}),
        nickname: nextNickname,
        avatar_url: avatarValue,
        avatar_emoji: avatarEmoji,
        bio: bio
      }
    };
    currentProfile = { ...(currentProfile || {}), nickname: nextNickname, avatar_url: avatarValue, bio: bio, id: currentUser.id };
    notify('profile-saved-local');
    
    // 触发评论区更新，同步显示最新头像昵称和简介
    if (typeof window !== 'undefined' && window.updateCommentsProfile) {
      window.updateCommentsProfile(currentUser.id, {
        nickname: nextNickname,
        avatar_url: avatarValue,
        bio: bio
      });
    }

    const expectedProfile = {
      nickname: nextNickname,
      bio: bio,
      avatar_url: avatarValue
    };

    const dbSyncPromise = updateProfileCompat(
      client,
      currentUser.id,
      nextNickname,
      avatarValue,
      currentUser.id,
      bio
    );
    dbSyncPromise.catch((lateError) => {
      console.warn('Profile write settled late with error:', lateError);
    });

    const results = await Promise.allSettled([
      withTimeout(
        dbSyncPromise,
        NETWORK_TIMEOUT_MS,
        '保存同步到数据库超时'
      ).catch(async (error) => {
        if (!isProfileSaveTimeout(error)) throw error;

        const persisted = await verifyProfilePersisted(client, currentUser.id, expectedProfile);
        if (!persisted) throw error;
      }),
      withTimeout(
        client.auth.updateUser({
          data: {
            nickname: nextNickname,
            avatar_url: avatarValue,
            avatar_emoji: avatarEmoji,
            bio: bio
          }
        }),
        15000, 
        '更新身份元数据超时'
      )
    ]);
    
    // 核心逻辑：只要数据库更新成功（results[0]），就认为主流程成功
    if (results[0].status === 'rejected') {
      console.error('资料数据库保存失败:', results[0].reason);
      throw results[0].reason;
    }

    if (results[1].status === 'rejected') {
      console.warn('身份元数据同步延迟，但不影响保存结果:', results[1].reason);
    }

    // 记录保存成功，即使后续重载缓慢
    try {
      await withTimeout(loadProfile(), 8000, '重载超时');
    } catch (e) {
      console.warn('重载云端资料超时，回退到本地已保存数据:', e);
      AuthService.notify('session-synced');
    }
  }

  async function resetPassword(password) {
    const client = getAuthClient();
    if (!client?.auth) throw new Error('认证模块初始化失败，请刷新页面后重试');
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`密码至少需要 ${MIN_PASSWORD_LENGTH} 位`);
    }

    try {
      const { error } = await withTimeout(
        client.auth.updateUser({ password }),
        NETWORK_TIMEOUT_MS,
        '重置密码超时'
      );

      if (error && !isSupabaseLockStealError(error)) {
        throw error;
      }
    } catch (error) {
      if (!isSupabaseLockStealError(error)) {
        throw error;
      }
    }

    clearAuthActionParam();
  }

  return {
    subscribe,
    notify,
    setSession,
    setAuthModeState,
    resetFlowState,
    startCooldown,
    syncProfileDraft,
    setProfileDraftEmoji,
    setProfileDraftFile,
    releaseProfileDraft,
    sendOtp,
    sendResetLink,
    submitAuthForm,
    logoutSession,
    saveProfile,
    resetPassword,
    setRegisterProgressCallback,
    updateRegisterProgress
  };
})();

const AuthUI = (() => {
  function createModal(id, html) {
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'auth-modal';
    modal.innerHTML = html;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('show'));
    return modal;
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }

  AuthService.subscribe((_snapshot, change) => {
    if (change.type === 'auth-mode' || change.type === 'auth-flow-reset') {
      if (document.getElementById('auth-modal')) {
        updateAuthModalUI();
      }
    }
    if (change.type === 'otp-cooldown' && document.getElementById('auth-send-btn')) {
      setOtpButtonLabel();
    }
    if (change.type === 'profile-draft' && document.getElementById('profile-avatar-preview')) {
      refreshProfileAvatarPreview();
    }
    if (
      change.type === 'session' ||
      change.type === 'session-primed' ||
      change.type === 'session-synced' ||
      change.type === 'logout-local' ||
      change.type === 'profile-saved-local'
    ) {
      if (typeof renderAuthUI === 'function') renderAuthUI();
    }
  });

  return {
    createModal,
    closeModal
  };
})();

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

async function ensureNicknameAvailable(client, nickname, excludeUserId) {
  const trimmedNickname = String(nickname || '').trim();
  if (!trimmedNickname) {
    throw new Error('昵称不能为空');
  }

  const { data, error } = await client
    .from('profiles')
    .select('id, nickname')
    .ilike('nickname', trimmedNickname)
    .limit(12);

  if (error) {
    throw error;
  }

  const normalized = trimmedNickname.toLowerCase();
  const conflict = (data || []).find((row) => row.id !== excludeUserId && String(row.nickname || '').trim().toLowerCase() === normalized);
  if (conflict) {
    throw new Error('昵称已存在，请换一个');
  }
}

function buildLocalProfile(user) {
  const nickname = user?.user_metadata?.nickname || currentProfile?.nickname || buildFallbackNickname(user?.id || user?.email);
  const metadataAvatar = user?.user_metadata?.avatar_url || (user?.user_metadata?.avatar_emoji ? `emoji:${user.user_metadata.avatar_emoji}` : '');
  const avatarEmoji = user?.user_metadata?.avatar_emoji || pickAvatarEmoji(user?.id || nickname);
  const bio = user?.user_metadata?.bio || currentProfile?.bio || '';
  return {
    email: user?.email || '',
    nickname,
    avatar_url: normalizeAvatarValue(metadataAvatar || `emoji:${avatarEmoji}`, user?.id || nickname),
    bio
  };
}

async function syncProfileAfterAuth(client, user) {
  if (!client || !user?.id) return;

  const localProfile = buildLocalProfile(user);
  AuthService.setSession(user, { ...(currentProfile || {}), ...localProfile, id: user.id }, 'session');

  try {
    await withTimeout(
      upsertProfileCompat(client, { id: user.id, email: user.email || '', nickname: localProfile.nickname, bio: localProfile.bio }, localProfile.avatar_url, user.id),
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
    AuthService.notify('session-synced');
  }
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
      if (shouldOpenPasswordReset()) {
        openPasswordResetModal();
      }
    }
    AuthService.notify('session-synced');
  } catch (err) {
    console.error(normalizeAuthErrorMessage(err?.message || '初始化登录状态失败'));
    AuthService.notify('session-synced');
  }

  client.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session?.user) {
      await syncProfileAfterAuth(client, session.user);
      openPasswordResetModal();
      return;
    }

    if (session) {
      await syncProfileAfterAuth(client, session.user);
    } else {
      AuthService.setSession(null, null, 'session');
    }
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
    
    // 确保合并时保留 bio 属性
    currentProfile = { 
      ...data, 
      avatar_url: normalizedAvatar,
      bio: data.bio || currentUser.user_metadata?.bio || currentProfile?.bio || '' 
    };
    const originalAvatar = getAvatarFromProfileRecord({
      avatar_url: data.avatar_url,
      avatar: data.avatar,
      avatar_emoji: data.avatar_emoji
    }, currentUser.id);
    if (normalizedAvatar !== originalAvatar) {
      try {
        await updateProfileCompat(client, currentUser.id, currentProfile.nickname || '匿名觉者', normalizedAvatar, currentUser.id, currentProfile.bio || '');
      } catch (_e) {
        // ignore avatar normalization failure to avoid blocking auth flow
      }
    }
    AuthService.notify('session-synced');
    return;
  }

  const avatarEmoji = currentUser.user_metadata?.avatar_emoji || pickAvatarEmoji(currentUser.id);
  const normalizedAvatar = normalizeAvatarValue(`emoji:${avatarEmoji}`, currentUser.id);
  try {
    await upsertProfileCompat(client, {
      id: currentUser.id,
      email: currentUser.email || '',
      nickname: currentUser.user_metadata?.nickname || '匿名觉者',
      bio: currentUser.user_metadata?.bio || ''
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
    AuthService.notify('session-synced');
    return;
  }

  currentProfile = {
    nickname: currentUser.user_metadata?.nickname || currentUser.email || '用户',
    avatar_url: normalizedAvatar
  };
  AuthService.notify('session-synced');
}

/* 鈹€鈹€ 娓叉煋椤堕儴鐧诲綍鐘舵€?鈹€鈹€ */
function renderAuthUI() {
  const container = document.getElementById('auth-status');
  if (!container) return;
  container.innerHTML = AuthTemplates.authStatus();
}

function openAuthModal() {
  const existing = document.getElementById('auth-modal');
  if (existing) existing.remove();
  AuthService.resetFlowState();
  AuthUI.createModal('auth-modal', AuthTemplates.authModal());

  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const codeInput = document.getElementById('auth-code');
  if (emailInput) emailInput.addEventListener('input', updateAuthSubmitState);
  if (passwordInput) passwordInput.addEventListener('input', updateAuthSubmitState);
  if (codeInput) codeInput.addEventListener('input', updateAuthSubmitState);
  setAuthMode('login');
}

function closeAuthModal() {
  AuthUI.closeModal('auth-modal');
  AuthService.resetFlowState();
}

function togglePasswordVisibility(inputId, trigger) {
  const input = document.getElementById(inputId);
  if (!input || !trigger) return;

  const showPassword = input.type === 'password';
  input.type = showPassword ? 'text' : 'password';
  trigger.textContent = showPassword ? '🙈' : '👁';
  trigger.setAttribute('aria-label', showPassword ? '隐藏密码' : '显示密码');
}

function setAuthMode(mode) {
  AuthService.setAuthModeState(mode);
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
  const helperRow = document.getElementById('auth-helper-row');
  const errorEl = document.getElementById('auth-error');
  if (!loginTab || !registerTab || !subtitle || !otpRow || !passwordInput || !codeInput || !submitBtn || !errorEl || !helperRow) return;

  const registerMode = authMode === 'register';
  loginTab.classList.toggle('active', !registerMode);
  registerTab.classList.toggle('active', registerMode);
  subtitle.textContent = registerMode ? '登录后可获得更多权限' : '登录后可修改昵称';
  otpRow.classList.toggle('is-hidden', !registerMode);
  helperRow.classList.toggle('is-hidden', registerMode);
  passwordInput.autocomplete = registerMode ? 'new-password' : 'current-password';
  codeInput.required = registerMode;
  submitBtn.textContent = getAuthSubmitLabel();
  markAuthMessage('');
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
  AuthService.startCooldown(seconds);
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
  AuthService.notify('session-primed');
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
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const sendBtn = document.getElementById('auth-send-btn');
  if (!emailInput || !passwordInput || !sendBtn) return;

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value.trim();
  markAuthMessage('');
  sendBtn.disabled = true;
  sendBtn.textContent = '发送中...';

  try {
    await AuthService.sendOtp(email, password);
    markAuthMessage('验证码已发送，请查收邮箱', true);
  } catch (err) {
    markAuthMessage(normalizeAuthErrorMessage(err?.message || '发送验证码失败'));
    otpCooldownSeconds = 0;
    setOtpButtonLabel();
  }
}

async function sendPasswordResetLink() {
  const emailInput = document.getElementById('auth-email');
  if (!emailInput) return;

  const email = emailInput.value.trim().toLowerCase();
  const forgotBtn = document.getElementById('auth-forgot-btn');
  if (forgotBtn) {
    forgotBtn.disabled = true;
    forgotBtn.textContent = '发送中...';
  }

  try {
    await AuthService.sendResetLink(email);
    markAuthMessage('重置链接已发送，请查收邮箱', true);
  } catch (err) {
    markAuthMessage(normalizeAuthErrorMessage(err?.message || '发送重置链接失败'));
  } finally {
    if (forgotBtn) {
      forgotBtn.disabled = false;
      forgotBtn.textContent = '忘记密码？';
    }
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

  AuthService.notify('session-synced');
}

// 注册进度UI更新
function updateRegisterProgressUI({ stage, message }) {
  const submitBtn = document.getElementById('auth-submit-btn');
  const errorEl = document.getElementById('auth-error');
  if (submitBtn) {
    submitBtn.textContent = message;
  }
  if (errorEl && message) {
    errorEl.classList.add('is-progress');
    errorEl.textContent = message;
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
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

  // 设置进度回调
  AuthService.setRegisterProgressCallback(updateRegisterProgressUI);

  submitBtn.disabled = true;
  submitBtn.textContent = authMode === 'register' ? '验证中...' : '登录中...';
  markAuthMessage('');

  try {
    const result = await AuthService.submitAuthForm({ email, password, code });
    if (result.mode === 'register') {
      if (result.autoLogin && result.user) {
        // 注册并自动登录成功
        closeAuthModal();
        // 显示欢迎提示
        showWelcomeToast();
        // 如果在非首页，跳转到首页
        const currentPath = window.location.pathname;
        const isHomePage = currentPath === '/' || currentPath === '/index.html' || currentPath.endsWith('/index.html') || currentPath === '';
        if (!isHomePage) {
          window.location.href = '/index.html?welcome=newuser';
        } else {
          // 在首页，添加URL参数标记新用户
          const url = new URL(window.location.href);
          url.searchParams.set('welcome', 'newuser');
          window.history.replaceState({}, '', url.toString());
        }
      } else {
        // 兼容旧逻辑
        setAuthMode('login');
        emailInput.value = email;
        passwordInput.value = password;
        codeInput.value = '';
        updateAuthSubmitState();
      }
      return;
    }

    if (result.data?.user) {
      closeAuthModal();
    }
  } catch (err) {
    markAuthMessage(normalizeAuthErrorMessage(err?.message || '操作失败'));
  } finally {
    AuthService.setRegisterProgressCallback(null);
    const activeSubmitBtn = document.getElementById('auth-submit-btn');
    if (activeSubmitBtn) {
      activeSubmitBtn.textContent = getAuthSubmitLabel();
    }
    updateAuthSubmitState();
  }
}

async function handleLogout() {
  return AuthService.logoutSession();
}

function openEditProfile() {
  if (!currentUser) return;

  const existing = document.getElementById('profile-modal');
  if (existing) existing.remove();
  AuthService.syncProfileDraft();
  AuthUI.createModal('profile-modal', AuthTemplates.profileModal());
  refreshProfileAvatarPreview();
}

async function confirmLogout() {
  if (confirm('确定退出登录吗？')) {
    closeProfileModal();
    handleLogout();
  }
}

function closeProfileModal() {
  AuthUI.closeModal('profile-modal');
  AuthService.releaseProfileDraft();
}

function refreshProfileAvatarPreview() {
  const preview = document.getElementById('profile-avatar-preview');
  if (!preview) return;

  if (profileAvatarDraft.previewUrl) {
    preview.innerHTML = `<img class="profile-avatar-preview-img" src="${profileAvatarDraft.previewUrl}" alt="头像预览">`;
  } else if (isUrlAvatarValue(profileAvatarDraft.value)) {
    preview.innerHTML = `<img class="profile-avatar-preview-img" src="${escapeAttr(profileAvatarDraft.value)}" alt="澶村儚棰勮">`;
  } else {
    preview.innerHTML = `<span class="profile-avatar-preview-emoji">${getEmojiFromAvatarValue(profileAvatarDraft.value || `emoji:${profileAvatarDraft.emoji}`, currentUser?.id)}</span>`;
  }
}

function selectProfileEmoji(emoji) {
  AuthService.setProfileDraftEmoji(emoji);

  const input = document.getElementById('profile-avatar-file');
  if (input) input.value = '';

  document.querySelectorAll('.profile-emoji-option').forEach(btn => {
    btn.classList.toggle('active', btn.textContent === emoji);
  });
  refreshProfileAvatarPreview();
}

function toggleEmojiGrid() {
  const wrapper = document.getElementById('profile-emoji-wrapper');
  const toggleBtn = document.getElementById('profile-emoji-toggle');
  if (!wrapper || !toggleBtn) return;
  
  const isExpanded = wrapper.classList.toggle('is-expanded');
  const span = toggleBtn.querySelector('span');
  if (span) span.textContent = isExpanded ? '收起图标' : '更多图标';
  const svg = toggleBtn.querySelector('svg');
  if (svg) svg.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
}

function jumpToMyComments() {
  if (!currentUser) return;
  closeProfileModal(); // 先退出资料页
  showCommentPageSelector(['soullab', 'objtest']);
}

function showCommentPageSelector(types) {
  const dialogId = 'comment-page-selector';
  if (document.getElementById(dialogId)) return;

  const overlay = document.createElement('div');
  overlay.id = dialogId;
  overlay.className = 'auth-modal-overlay';
  overlay.style.cssText = 'z-index: 5000; position: fixed; inset: 0; background: rgba(8, 4, 20, 0.85); backdrop-filter: blur(15px); display: flex; align-items: center; justify-content: center;';
  
  const labelMap = {
    'soullab': '灵性人格测试评论区',
    'objtest': '自我客体化测评评论区'
  };

  overlay.innerHTML = `
    <div class="comment-selector-dialog" style="background: rgba(18, 8, 32, 0.95); border: 1px solid rgba(201, 168, 76, 0.3); border-radius: 30px; padding: 40px; width: 360px; text-align: center; box-shadow: 0 20px 80px rgba(0,0,0,0.8);">
      <h3 style="font-size: 1.25rem; color: #f0d080; margin-bottom: 30px; font-weight: 600; letter-spacing: 2px;">选择评论区</h3>
      <div style="display:flex; flex-direction:column; gap: 16px;">
        ${types.map(t => `
          <button class="btn-choice" style="background: rgba(201, 168, 76, 0.08); border: 1px solid rgba(201, 168, 76, 0.3); color: #f0d080; padding: 16px; border-radius: 16px; cursor: pointer; font-size: 0.95rem; font-weight: 500; transition: all 0.4s; letter-spacing: 1px;"
            onmouseover="this.style.background='rgba(201, 168, 76, 0.15)'; this.style.borderColor='#f0d080'; this.style.transform='translateY(-2px)'"
            onmouseout="this.style.background='rgba(201, 168, 76, 0.08)'; this.style.borderColor='rgba(201, 168, 76, 0.3)'; this.style.transform='translateY(0)'"
            onclick="redirectToCommentPage('${t}'); document.getElementById('${dialogId}').remove();">
            ${labelMap[t] || t}
          </button>
        `).join('')}
        <button style="margin-top: 20px; background: transparent; border: none; color: rgba(255,255,255,0.4); font-size: 0.85rem; cursor: pointer; transition: color 0.3s;" 
          onmouseover="this.style.color='#fff'"
          onmouseout="this.style.color='rgba(255,255,255,0.4)'"
          onclick="document.getElementById('${dialogId}').remove()">暂不查看</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function redirectToCommentPage(type) {
  const currentContainer = document.getElementById('comments-section');
  const currentPageType = currentContainer ? currentContainer.dataset.page : null;

  if (currentPageType === type && currentContainer && window.location.pathname.includes('comments.html')) {
    closeProfileModal();
    currentContainer.scrollIntoView({ behavior: 'smooth' });
  } else {
    closeProfileModal();
    let targetPath = '';
    if (type === 'objtest') {
      targetPath = '/ObjTest/comments.html';
    } else {
      targetPath = '/SoulLab/comments.html';
    }

    const isSubDir = window.location.pathname.includes('/SoulLab/') || window.location.pathname.includes('/ObjTest/') || window.location.pathname.includes('/Snow/') || window.location.pathname.includes('/admin/');
    if (isSubDir) {
      window.location.href = '..' + targetPath;
    } else {
      window.location.href = '.' + targetPath;
    }
  }
}

// 暴露函数到全局
window.redirectToCommentPage = redirectToCommentPage;

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

  AuthService.setProfileDraftFile(file, URL.createObjectURL(file));
}

async function saveProfileChanges() {
  const nicknameInput = document.getElementById('profile-nickname');
  const bioInput = document.getElementById('profile-bio');
  const saveBtn = document.getElementById('profile-save-btn');
  const errorEl = document.getElementById('profile-edit-error');
  if (!nicknameInput || !saveBtn || !errorEl) return;
  saveBtn.disabled = true;
  saveBtn.textContent = '保存中...';
  errorEl.textContent = '';

  try {
    const nickname = nicknameInput.value.trim() || currentProfile?.nickname || buildFallbackNickname(currentUser?.id);
    const bio = bioInput?.value?.trim() || '';
    await AuthService.saveProfile(nickname, bio);
    closeProfileModal();
  } catch (err) {
    errorEl.textContent = normalizeAuthErrorMessage(err?.message || '保存失败');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '保存资料';
  }
}

function openPasswordResetModal() {
  const existing = document.getElementById('password-reset-modal');
  if (existing) existing.remove();
  AuthUI.createModal('password-reset-modal', AuthTemplates.passwordResetModal());
}

function closePasswordResetModal() {
  AuthUI.closeModal('password-reset-modal');
}

async function submitPasswordReset() {
  const passwordInput = document.getElementById('reset-password-input');
  const submitBtn = document.getElementById('reset-password-btn');
  if (!passwordInput || !submitBtn) return;

  const password = passwordInput.value.trim();
  submitBtn.disabled = true;
  submitBtn.textContent = '保存中...';
  markAuthMessage('', false, 'reset-password-error');

  try {
    await AuthService.resetPassword(password);
    closePasswordResetModal();
    alert('密码已重置，请使用新密码登录');
  } catch (err) {
    markAuthMessage(normalizeAuthErrorMessage(err?.message || '重置密码失败'), false, 'reset-password-error');
  } finally {
    const activeBtn = document.getElementById('reset-password-btn');
    if (activeBtn) {
      activeBtn.disabled = false;
      activeBtn.textContent = '保存新密码';
    }
  }
}

// 欢迎提示Toast函数
function showWelcomeToast() {
  // 检查是否已存在欢迎提示
  if (document.getElementById('welcome-toast')) return;

  const toast = document.createElement('div');
  toast.id = 'welcome-toast';
  toast.innerHTML = `
    <div class="welcome-toast-content">
      <span class="welcome-toast-icon">✦</span>
      <span class="welcome-toast-text">恭喜成为觉醒诗社的一员！</span>
      <span class="welcome-toast-icon">✦</span>
    </div>
  `;
  document.body.appendChild(toast);

  // 触发动画
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // 3秒后淡出
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 600);
  }, 3000);
}

window.AuthService = AuthService;
window.AuthUI = AuthUI;
window.initAuth = initAuth;
window.renderAuthUI = renderAuthUI;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.setAuthMode = setAuthMode;
window.updateAuthModalUI = updateAuthModalUI;
window.updateAuthSubmitState = updateAuthSubmitState;
window.setOtpButtonLabel = setOtpButtonLabel;
window.togglePasswordVisibility = togglePasswordVisibility;
window.sendRegisterOtpCode = sendRegisterOtpCode;
window.sendPasswordResetLink = sendPasswordResetLink;
window.handleAuthSubmit = handleAuthSubmit;
window.handleLogout = handleLogout;
window.openEditProfile = openEditProfile;
window.confirmLogout = confirmLogout;
window.closeProfileModal = closeProfileModal;
window.refreshProfileAvatarPreview = refreshProfileAvatarPreview;
window.jumpToMyComments = jumpToMyComments;
window.selectProfileEmoji = selectProfileEmoji;
window.toggleEmojiGrid = toggleEmojiGrid;
window.handleProfileAvatarFile = handleProfileAvatarFile;
window.saveProfileChanges = saveProfileChanges;
window.openPasswordResetModal = openPasswordResetModal;
window.closePasswordResetModal = closePasswordResetModal;
window.submitPasswordReset = submitPasswordReset;
window.showWelcomeToast = showWelcomeToast;

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initAuth);
