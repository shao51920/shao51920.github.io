/* ==============================
   Comments Module
   ============================== */

let commentsLoaded = false;
let selectedImageFile = null;
let commentsFeatureAvailable = true;
let commentsProfileMap = {};
let commentRenderAuthHooked = false;

function getCommentsClient() {
  if (window.supabaseClient && typeof window.supabaseClient.from === 'function') return window.supabaseClient;
  if (window.db && typeof window.db.from === 'function') return window.db;
  if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') return supabase;
  return null;
}

function getAvatarNodeHtml(avatarValue, seed, className) {
  if (window.AvatarKit && typeof window.AvatarKit.normalizeAvatarValue === 'function') {
    const normalized = window.AvatarKit.normalizeAvatarValue(avatarValue, seed);
    if (typeof normalized === 'string' && normalized.startsWith('emoji:')) {
      const emoji = window.AvatarKit.getEmojiFromAvatarValue(normalized, seed);
      return `<span class="${className} ${className}-emoji">${emoji}</span>`;
    }
    return `<img class="${className}" src="${escapeAttr(normalized)}" alt="头像">`;
  }
  return `<img class="${className}" src="${escapeAttr(avatarValue || '')}" alt="头像">`;
}

function getProfileAvatarValue(profile) {
  if (!profile || typeof profile !== 'object') return '';
  if (typeof profile.avatar_url === 'string' && profile.avatar_url) return profile.avatar_url;
  if (typeof profile.avatar === 'string' && profile.avatar) return profile.avatar;
  if (typeof profile.avatar_emoji === 'string' && profile.avatar_emoji) return `emoji:${profile.avatar_emoji}`;
  return '';
}

function isCommentsTableMissing(error) {
  const msg = String(error?.message || '');
  return msg.includes("Could not find the table 'public.comments'") || msg.includes('PGRST205');
}

function getLiveCurrentProfile() {
  if (!currentUser) return null;
  return {
    id: currentUser.id,
    nickname: currentProfile?.nickname || currentUser.user_metadata?.nickname || currentUser.email || '用户',
    avatar_url: currentProfile?.avatar_url || currentUser.user_metadata?.avatar_url || (currentUser.user_metadata?.avatar_emoji ? `emoji:${currentUser.user_metadata.avatar_emoji}` : '')
  };
}

function getCommentDisplayProfile(userId) {
  if (currentUser?.id && userId === currentUser.id) {
    return { ...(commentsProfileMap[userId] || {}), ...(getLiveCurrentProfile() || {}) };
  }
  return commentsProfileMap[userId] || {};
}

async function loadCommentProfiles(client, comments) {
  const userIds = [...new Set((comments || []).map(comment => comment.user_id).filter(Boolean))];
  commentsProfileMap = {};

  if (userIds.length > 0) {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .in('id', userIds);

    if (error) throw error;
    commentsProfileMap = Object.fromEntries((data || []).map(profile => [profile.id, profile]));
  }

  const liveProfile = getLiveCurrentProfile();
  if (liveProfile?.id) {
    commentsProfileMap[liveProfile.id] = {
      ...(commentsProfileMap[liveProfile.id] || {}),
      ...liveProfile
    };
  }
}

function renderAvatarIntoElement(elementId, avatarValue, seed, className) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.outerHTML = getAvatarNodeHtml(avatarValue, seed, className).replace(`class="${className}"`, `id="${elementId}" class="${className}"`);
}

function initComments() {
  const container = document.getElementById('comments-section');
  if (!container) return;

  const pageType = container.dataset.page || 'unknown';

  container.innerHTML = `
    <div class="comments-wrapper">
      <div class="comments-header">
        <h3>留下你的想法</h3>
        <span class="comments-count" id="comments-count">加载中...</span>
      </div>

      <div class="comment-input-area" id="comment-input-area">
        <div class="comment-input-login-hint" id="comment-login-hint">
          <p>登录后即可留言</p>
          <button class="auth-login-btn" onclick="openAuthModal()">登录 / 注册</button>
        </div>
        <div class="comment-input-box" id="comment-input-box" style="display:none">
          <div class="comment-user-info">
            <span class="comment-avatar comment-avatar-emoji" id="comment-avatar">🙂</span>
            <span id="comment-username">用户</span>
          </div>
          <textarea id="comment-text" placeholder="写下你的想法..." maxlength="500" rows="3"></textarea>
          <div class="comment-input-actions">
            <label class="comment-upload-btn" title="上传图片">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <input type="file" id="comment-image-input" accept="image/*" style="display:none" onchange="handleImagePreview(this)">
            </label>
            <span class="comment-char-count"><span id="comment-char">0</span>/500</span>
            <button class="comment-submit-btn" id="comment-submit-btn" onclick="submitComment('${pageType}')">发布</button>
          </div>
          <div class="comment-image-preview" id="comment-image-preview" style="display:none">
            <img id="comment-preview-img" src="" alt="预览">
            <button class="comment-remove-img" onclick="removeImagePreview()">✕</button>
          </div>
        </div>
      </div>

      <div class="comments-list" id="comments-list">
        <div class="comments-loading">加载评论中...</div>
      </div>
    </div>
  `;

  const textarea = document.getElementById('comment-text');
  if (textarea) {
    textarea.addEventListener('input', () => {
      const counter = document.getElementById('comment-char');
      if (counter) counter.textContent = textarea.value.length;
    });
  }

  if (!commentRenderAuthHooked && typeof renderAuthUI === 'function') {
    const originalRenderAuthUI = renderAuthUI;
    renderAuthUI = function () {
      originalRenderAuthUI();
      updateCommentInputState();
    };
    commentRenderAuthHooked = true;
  }

  loadComments(pageType);
  updateCommentInputState();
}

function updateCommentInputState() {
  const loginHint = document.getElementById('comment-login-hint');
  const inputBox = document.getElementById('comment-input-box');
  if (!loginHint || !inputBox) return;

  if (!commentsFeatureAvailable) {
    loginHint.style.display = 'flex';
    loginHint.innerHTML = '<p>评论功能尚未初始化，请先创建 comments 表。</p>';
    inputBox.style.display = 'none';
    return;
  }

  if (currentUser) {
    const liveProfile = getLiveCurrentProfile();
    loginHint.style.display = 'none';
    inputBox.style.display = 'block';

    const username = document.getElementById('comment-username');
    if (username) {
      username.textContent = liveProfile?.nickname || '用户';
    }
    renderAvatarIntoElement('comment-avatar', liveProfile?.avatar_url, currentUser.id, 'comment-avatar');
  } else {
    loginHint.style.display = 'flex';
    inputBox.style.display = 'none';
  }
}

async function loadComments(pageType) {
  const client = getCommentsClient();
  const listEl = document.getElementById('comments-list');
  const countEl = document.getElementById('comments-count');
  if (!client || !listEl) return;

  try {
    const { data: comments, error } = await client
      .from('comments')
      .select('*')
      .eq('page_type', pageType)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    commentsFeatureAvailable = true;
    await loadCommentProfiles(client, comments || []);

    if (countEl) {
      countEl.textContent = `${(comments || []).length} 条评论`;
    }

    if (!comments || comments.length === 0) {
      listEl.innerHTML = '<p class="comments-empty">还没有评论，来做第一个留下想法的人。</p>';
      return;
    }

    listEl.innerHTML = comments.map(comment => renderComment(comment)).join('');
    commentsLoaded = true;
  } catch (err) {
    console.error('加载评论失败:', err);
    if (isCommentsTableMissing(err)) {
      commentsFeatureAvailable = false;
      if (countEl) countEl.textContent = '未启用';
      listEl.innerHTML = '<p class="comments-empty">评论表未创建，评论功能暂不可用。</p>';
      updateCommentInputState();
      return;
    }
    listEl.innerHTML = '<p class="comments-empty">评论加载失败，请刷新页面重试。</p>';
  }
}

function renderComment(comment) {
  const profile = getCommentDisplayProfile(comment.user_id);
  const name = profile.nickname || '匿名用户';
  const avatarValue = profile.avatar_url || getProfileAvatarValue(profile);
  const time = new Date(comment.created_at).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  const isOwner = Boolean(currentUser && comment.user_id === currentUser.id);
  const imageHtml = comment.image_url
    ? `<div class="comment-img-wrap"><img src="${escapeAttr(comment.image_url)}" alt="评论图片" onclick="openCommentImage(this.src)" loading="lazy"></div>`
    : '';
  const deleteBtn = isOwner ? `<button class="comment-delete-btn" onclick="deleteComment('${comment.id}', '${comment.page_type}')">删除</button>` : '';
  const avatarHtml = getAvatarNodeHtml(avatarValue, comment.user_id || 'guest', 'comment-item-avatar');

  return `
    <div class="comment-item" id="comment-${comment.id}">
      ${avatarHtml}
      <div class="comment-item-body">
        <div class="comment-item-header">
          <span class="comment-item-name">${escapeHtml(name)}</span>
          <span class="comment-item-time">${time}</span>
          ${deleteBtn}
        </div>
        <p class="comment-item-text">${escapeHtml(comment.content || '')}</p>
        ${imageHtml}
      </div>
    </div>
  `;
}

async function submitComment(pageType) {
  const client = getCommentsClient();
  if (!client) return;
  if (!commentsFeatureAvailable) {
    alert('评论表尚未创建，当前无法发布评论。');
    return;
  }

  if (!currentUser) {
    openAuthModal();
    return;
  }

  const textEl = document.getElementById('comment-text');
  const submitBtn = document.getElementById('comment-submit-btn');
  if (!textEl || !submitBtn) return;

  const content = textEl.value.trim();
  if (!content && !selectedImageFile) return;

  submitBtn.disabled = true;
  submitBtn.textContent = '发布中...';

  try {
    let imageUrl = null;

    if (selectedImageFile) {
      const fileExt = selectedImageFile.name.split('.').pop() || 'png';
      const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await client.storage
        .from('comment-images')
        .upload(fileName, selectedImageFile, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = client.storage.from('comment-images').getPublicUrl(fileName);
      imageUrl = urlData.publicUrl;
    }

    const { error } = await client.from('comments').insert({
      user_id: currentUser.id,
      page_type: pageType,
      content: content || '',
      image_url: imageUrl
    });
    if (error) throw error;

    const liveProfile = getLiveCurrentProfile();
    if (liveProfile?.id) {
      commentsProfileMap[liveProfile.id] = {
        ...(commentsProfileMap[liveProfile.id] || {}),
        ...liveProfile
      };
    }

    textEl.value = '';
    const counter = document.getElementById('comment-char');
    if (counter) counter.textContent = '0';
    removeImagePreview();

    await loadComments(pageType);
  } catch (err) {
    console.error('发布失败:', err);
    alert(`发布失败: ${err.message || '未知错误'}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '发布';
  }
}

async function deleteComment(commentId, pageType) {
  const client = getCommentsClient();
  if (!client || !commentsFeatureAvailable) return;

  if (!confirm('确定删除这条评论？')) return;
  try {
    const { error } = await client.from('comments').delete().eq('id', commentId);
    if (error) throw error;
    await loadComments(pageType);
  } catch (_error) {
    alert('删除失败');
  }
}

function handleImagePreview(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert('图片大小不能超过 5MB');
    input.value = '';
    return;
  }

  selectedImageFile = file;
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = document.getElementById('comment-preview-img');
    const preview = document.getElementById('comment-image-preview');
    if (!img || !preview) return;
    img.src = event.target.result;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function removeImagePreview() {
  selectedImageFile = null;
  const preview = document.getElementById('comment-image-preview');
  const previewImg = document.getElementById('comment-preview-img');
  const input = document.getElementById('comment-image-input');
  if (preview) preview.style.display = 'none';
  if (previewImg) previewImg.src = '';
  if (input) input.value = '';
}

function openCommentImage(src) {
  const overlay = document.createElement('div');
  overlay.className = 'comment-img-modal';
  overlay.onclick = () => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
  };
  overlay.innerHTML = `<img src="${escapeAttr(src)}" alt="大图">`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
