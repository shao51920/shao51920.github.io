/*  ==============================
    Auth Module — 登录 / 注册 / 用户状态
    ==============================  */

// 当前用户信息缓存
let currentUser = null;
let currentProfile = null;

/* ── 初始化：检查登录状态 ── */
async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    await loadProfile();
  }
  renderAuthUI();

  // 监听登录状态变化
  supabase.auth.onAuthStateChange(async (event, session) => {
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
  if (!currentUser) return;
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();
  currentProfile = data;
}

/* ── 渲染顶部登录状态 ── */
function renderAuthUI() {
  const container = document.getElementById('auth-status');
  if (!container) return;

  if (currentUser && currentProfile) {
    container.innerHTML = `
      <div class="auth-user" onclick="toggleAuthMenu()">
        <img class="auth-avatar" src="${currentProfile.avatar_url || 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=' + currentUser.id}" alt="头像">
        <span class="auth-name">${currentProfile.nickname || '用户'}</span>
      </div>
      <div class="auth-menu" id="auth-menu">
        <button onclick="openEditProfile()">修改昵称</button>
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

// 点击其他区域关闭菜单
document.addEventListener('click', (e) => {
  const menu = document.getElementById('auth-menu');
  if (menu && !e.target.closest('.auth-user')) {
    menu.classList.remove('show');
  }
});

/* ── 打开登录弹窗 ── */
function openAuthModal() {
  // 如果已有弹窗则移除
  const existing = document.getElementById('auth-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'auth-modal';
  modal.className = 'auth-modal';
  modal.innerHTML = `
    <div class="auth-modal-backdrop" onclick="closeAuthModal()"></div>
    <div class="auth-modal-content">
      <button class="auth-modal-close" onclick="closeAuthModal()">✕</button>
      <h2 class="auth-modal-title">欢迎来到觉醒诗社</h2>
      <p class="auth-modal-sub">登录后可参与评论互动</p>
      
      <div class="auth-tabs">
        <button class="auth-tab active" onclick="switchAuthTab('login', this)">登录</button>
        <button class="auth-tab" onclick="switchAuthTab('register', this)">注册</button>
      </div>

      <form id="auth-form" onsubmit="handleAuthSubmit(event)">
        <div class="auth-field">
          <label>邮箱</label>
          <input type="email" id="auth-email" placeholder="your@email.com" required>
        </div>
        <div class="auth-field">
          <label>密码</label>
          <input type="password" id="auth-password" placeholder="至少6位" required minlength="6">
        </div>
        <div class="auth-field auth-nickname-field" style="display:none">
          <label>昵称</label>
          <input type="text" id="auth-nickname" placeholder="给自己取个名字">
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
  
  if (mode === 'register') {
    nicknameField.style.display = 'block';
    submitBtn.textContent = '注册';
  } else {
    nicknameField.style.display = 'none';
    submitBtn.textContent = '登录';
  }
  document.getElementById('auth-error').textContent = '';
}

/* ── 提交登录/注册 ── */
async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errorEl = document.getElementById('auth-error');
  const submitBtn = document.getElementById('auth-submit-btn');
  
  submitBtn.disabled = true;
  submitBtn.textContent = '处理中...';
  errorEl.textContent = '';

  try {
    if (authMode === 'register') {
      const nickname = document.getElementById('auth-nickname').value.trim() || '匿名觉者';
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      // 创建 profile
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          nickname: nickname,
          avatar_url: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=' + data.user.id
        });
      }
      closeAuthModal();
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      closeAuthModal();
    }
  } catch (err) {
    const msg = err.message || '操作失败';
    // 简单翻译常见错误
    if (msg.includes('Invalid login')) errorEl.textContent = '邮箱或密码错误';
    else if (msg.includes('already registered')) errorEl.textContent = '该邮箱已注册，请直接登录';
    else if (msg.includes('valid email')) errorEl.textContent = '请输入有效邮箱';
    else errorEl.textContent = msg;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = authMode === 'register' ? '注册' : '登录';
  }
}

/* ── 退出 ── */
async function handleLogout() {
  await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
  renderAuthUI();
}

/* ── 修改昵称 ── */
function openEditProfile() {
  const newName = prompt('输入新昵称：', currentProfile?.nickname || '');
  if (newName && newName.trim() && currentUser) {
    supabase.from('profiles')
      .update({ nickname: newName.trim() })
      .eq('id', currentUser.id)
      .then(() => {
        currentProfile.nickname = newName.trim();
        renderAuthUI();
      });
  }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initAuth);
