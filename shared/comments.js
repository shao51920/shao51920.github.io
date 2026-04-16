/* ==============================
   Comments Module
   ============================== */

let commentsLoaded = false;
let selectedImageFile = null;
let commentsFeatureAvailable = true;
let commentsProfileMap = {};
let commentsState = [];
let commentLikesMap = {};
let activeReplyTargetId = null;
let activeCommentsPageType = '';
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

function isCommentLikesTableMissing(error) {
  const msg = String(error?.message || '');
  return msg.includes("Could not find the table 'public.comment_likes'") || msg.includes('PGRST205');
}

function isCommentLikesPermissionError(error) {
  const msg = String(error?.message || '');
  return error?.code === '42501' || msg.includes('permission denied') || msg.includes('new row violates row-level security policy');
}

function isCommentSchemaMissing(error) {
  const msg = String(error?.message || '');
  return msg.includes("column of 'comments' in the schema cache") || msg.includes('PGRST204');
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

function ensureLiveProfileMapped() {
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

function getCommentLikeCount(commentId) {
  return (commentLikesMap[commentId] || []).length;
}

function isCommentLikedByCurrentUser(commentId) {
  if (!currentUser) return false;
  return (commentLikesMap[commentId] || []).includes(currentUser.id);
}

function upsertLikeState(commentId, userId, liked) {
  const likes = new Set(commentLikesMap[commentId] || []);
  if (liked) {
    likes.add(userId);
  } else {
    likes.delete(userId);
  }
  commentLikesMap[commentId] = Array.from(likes);
}

function replaceCommentInState(tempId, nextComment) {
  commentsState = commentsState.map(comment => comment.id === tempId ? nextComment : comment);
}

function removeCommentFromState(commentId) {
  commentsState = commentsState.filter(comment => comment.id !== commentId);
}

function getSortedVisibleComments() {
  return commentsState
    .filter(comment => !comment.is_hidden)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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

  ensureLiveProfileMapped();
}

async function loadCommentLikes(client, comments) {
  const commentIds = [...new Set((comments || []).map(comment => comment.id).filter(Boolean))];
  commentLikesMap = {};
  if (commentIds.length === 0) return;

  const { data, error } = await client
    .from('comment_likes')
    .select('comment_id, user_id')
    .in('comment_id', commentIds);

  if (error) {
    if (isCommentLikesTableMissing(error) || isCommentLikesPermissionError(error)) {
      return;
    }
    throw error;
  }

  for (const row of data || []) {
    if (!commentLikesMap[row.comment_id]) {
      commentLikesMap[row.comment_id] = [];
    }
    commentLikesMap[row.comment_id].push(row.user_id);
  }
}

function initComments() {
  const container = document.getElementById('comments-section');
  if (!container) return;

  const pageType = container.dataset.page || 'unknown';
  activeCommentsPageType = pageType;

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
      if (commentsLoaded) {
        ensureLiveProfileMapped();
        renderCommentsList();
      }
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
    loginHint.innerHTML = '<p>评论功能尚未初始化，请先执行评论升级 SQL。</p>';
    inputBox.style.display = 'none';
    return;
  }

  if (currentUser) {
    const liveProfile = getLiveCurrentProfile();
    loginHint.style.display = 'none';
    inputBox.style.display = 'block';

    const username = document.getElementById('comment-username');
    if (username) username.textContent = liveProfile?.nickname || '用户';
    renderAvatarIntoElement('comment-avatar', liveProfile?.avatar_url, currentUser.id, 'comment-avatar');
  } else {
    loginHint.style.display = 'flex';
    inputBox.style.display = 'none';
  }
}

async function loadComments(pageType) {
  const client = getCommentsClient();
  const listEl = document.getElementById('comments-list');
  if (!client || !listEl) return;

  activeCommentsPageType = pageType;
  listEl.innerHTML = '<div class="comments-loading">加载评论中...</div>';

  try {
    const { data, error } = await client
      .from('comments')
      .select('*')
      .eq('page_type', pageType)
      .order('created_at', { ascending: false })
      .limit(120);

    if (error) throw error;

    commentsFeatureAvailable = true;
    commentsState = data || [];
    await loadCommentProfiles(client, commentsState);
    await loadCommentLikes(client, commentsState);
    commentsLoaded = true;
    renderCommentsList();
  } catch (err) {
    console.error('加载评论失败:', err);
    if (isCommentsTableMissing(err) || isCommentSchemaMissing(err)) {
      commentsFeatureAvailable = false;
      listEl.innerHTML = '<p class="comments-empty">评论功能未完成升级，请先执行 SQL 脚本。</p>';
      const countEl = document.getElementById('comments-count');
      if (countEl) countEl.textContent = '未启用';
      updateCommentInputState();
      return;
    }
    listEl.innerHTML = '<p class="comments-empty">评论加载失败，请刷新页面重试。</p>';
  }
}

function renderCommentsList() {
  const listEl = document.getElementById('comments-list');
  const countEl = document.getElementById('comments-count');
  if (!listEl) return;

  const visibleComments = getSortedVisibleComments();
  const rootComments = visibleComments.filter(comment => !comment.parent_comment_id);

  if (countEl) {
    countEl.textContent = `${visibleComments.length} 条留言`;
  }

  if (rootComments.length === 0) {
    listEl.innerHTML = '<p class="comments-empty">还没有评论，来做第一个留下想法的人。</p>';
    return;
  }

  listEl.innerHTML = rootComments.map(comment => renderCommentThread(comment)).join('');
}

function renderCommentThread(comment) {
  const replies = commentsState
    .filter(item => item.parent_comment_id === comment.id && !item.is_hidden)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return `
    <div class="comment-thread" id="comment-thread-${comment.id}">
      ${renderSingleComment(comment, false)}
      ${replies.length ? `<div class="comment-replies">${replies.map(reply => renderSingleComment(reply, true)).join('')}</div>` : ''}
      ${renderReplyComposer(comment.id, comment.page_type)}
    </div>
  `;
}

function renderReplyComposer(commentId, pageType) {
  if (activeReplyTargetId !== commentId) return '';

  if (!currentUser) {
    return `
      <div class="comment-reply-panel comment-reply-login">
        <button class="comment-inline-link" onclick="openAuthModal()">登录后回复</button>
      </div>
    `;
  }

  return `
    <div class="comment-reply-panel">
      <textarea class="comment-reply-text" id="reply-text-${commentId}" placeholder="回复这条留言..." maxlength="300" rows="2"></textarea>
      <div class="comment-reply-actions">
        <button class="comment-inline-link" onclick="toggleReplyComposer('${commentId}')">取消</button>
        <button class="comment-submit-btn comment-reply-submit" id="reply-submit-${commentId}" onclick="submitReply('${pageType}', '${commentId}')">回复</button>
      </div>
    </div>
  `;
}

function renderSingleComment(comment, isReply) {
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
  const likedByCurrentUser = isCommentLikedByCurrentUser(comment.id);
  const likeCount = getCommentLikeCount(comment.id);
  const imageHtml = comment.image_url
    ? `<div class="comment-img-wrap"><img src="${escapeAttr(comment.image_url)}" alt="评论图片" onclick="openCommentImage(this.src)" loading="lazy"></div>`
    : '';
  const deleteBtn = isOwner ? `<button class="comment-delete-btn" onclick="deleteComment('${comment.id}', '${comment.page_type}')">删除</button>` : '';
  const avatarHtml = getAvatarNodeHtml(avatarValue, comment.user_id || 'guest', 'comment-item-avatar');
  const optimisticBadge = comment.is_optimistic ? '<span class="comment-pending-badge">发送中</span>' : '';

  return `
    <div class="comment-item${isReply ? ' comment-item-reply' : ''}" id="comment-${comment.id}">
      ${avatarHtml}
      <div class="comment-item-body">
        <div class="comment-item-header">
          <span class="comment-item-name">${escapeHtml(name)}</span>
          <span class="comment-item-time">${time}</span>
          ${optimisticBadge}
          ${deleteBtn}
        </div>
        <p class="comment-item-text">${escapeHtml(comment.content || '')}</p>
        ${imageHtml}
        <div class="comment-item-actions">
          <button class="comment-action-btn${likedByCurrentUser ? ' active' : ''}" onclick="toggleCommentLike('${comment.id}')">
            <span>❤</span>
            <span>${likeCount}</span>
          </button>
          <button class="comment-action-btn" onclick="toggleReplyComposer('${comment.id}')">回复</button>
        </div>
      </div>
    </div>
  `;
}

function toggleReplyComposer(commentId) {
  activeReplyTargetId = activeReplyTargetId === commentId ? null : commentId;
  renderCommentsList();
}

async function submitComment(pageType) {
  const submitBtn = document.getElementById('comment-submit-btn');
  const textEl = document.getElementById('comment-text');
  await submitCommentInternal({
    pageType,
    parentCommentId: null,
    inputEl: textEl,
    submitBtn,
    allowImage: true,
    onSuccess() {
      selectedImageFile = null;
      removeImagePreview();
      const counter = document.getElementById('comment-char');
      if (counter) counter.textContent = '0';
    }
  });
}

async function submitReply(pageType, parentCommentId) {
  const inputEl = document.getElementById(`reply-text-${parentCommentId}`);
  const submitBtn = document.getElementById(`reply-submit-${parentCommentId}`);
  await submitCommentInternal({
    pageType,
    parentCommentId,
    inputEl,
    submitBtn,
    allowImage: false,
    onSuccess() {
      activeReplyTargetId = null;
    }
  });
}

async function submitCommentInternal({ pageType, parentCommentId, inputEl, submitBtn, allowImage, onSuccess }) {
  const client = getCommentsClient();
  if (!client || !inputEl || !submitBtn) return;

  if (!commentsFeatureAvailable) {
    alert('评论功能未完成升级，请先执行 SQL 脚本。');
    return;
  }

  if (!currentUser) {
    openAuthModal();
    return;
  }

  const content = inputEl.value.trim();
  const hasImage = Boolean(allowImage && selectedImageFile);
  if (!content && !hasImage) return;

  const originalText = inputEl.value;
  const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const optimisticComment = {
    id: tempId,
    user_id: currentUser.id,
    page_type: pageType,
    content,
    image_url: null,
    parent_comment_id: parentCommentId || null,
    is_hidden: false,
    created_at: new Date().toISOString(),
    is_optimistic: !hasImage
  };

  submitBtn.disabled = true;
  submitBtn.textContent = parentCommentId ? '回复中...' : '发布中...';

  if (!hasImage) {
    ensureLiveProfileMapped();
    commentsState = [optimisticComment, ...commentsState];
    renderCommentsList();
    inputEl.value = '';
  }

  try {
    let imageUrl = null;

    if (hasImage) {
      const fileExt = selectedImageFile.name.split('.').pop() || 'png';
      const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await client.storage
        .from('comment-images')
        .upload(fileName, selectedImageFile, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = client.storage.from('comment-images').getPublicUrl(fileName);
      imageUrl = urlData.publicUrl;
    }

    const payload = {
      user_id: currentUser.id,
      page_type: pageType,
      content: content || '',
      image_url: imageUrl,
      parent_comment_id: parentCommentId || null
    };

    const { data, error } = await client
      .from('comments')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;

    ensureLiveProfileMapped();
    if (hasImage) {
      commentsState = [data, ...commentsState];
      inputEl.value = '';
    } else {
      replaceCommentInState(tempId, data);
    }

    if (typeof onSuccess === 'function') onSuccess();
    renderCommentsList();
  } catch (err) {
    if (!hasImage) {
      removeCommentFromState(tempId);
      inputEl.value = originalText;
      renderCommentsList();
    }
    console.error('发布失败:', err);
    if (isCommentSchemaMissing(err)) {
      alert('评论功能未完成升级，请先执行 supabase-community-upgrade.sql。');
    } else {
      alert(`发布失败: ${err.message || '未知错误'}`);
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = parentCommentId ? '回复' : '发布';
  }
}

async function toggleCommentLike(commentId) {
  const client = getCommentsClient();
  if (!client) return;
  if (!currentUser) {
    openAuthModal();
    return;
  }

  const liked = isCommentLikedByCurrentUser(commentId);
  upsertLikeState(commentId, currentUser.id, !liked);
  renderCommentsList();

  try {
    if (liked) {
      const { error } = await client
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', currentUser.id);
      if (error) throw error;
    } else {
      const { error } = await client
        .from('comment_likes')
        .insert({ comment_id: commentId, user_id: currentUser.id });
      if (error) throw error;
    }
  } catch (err) {
    upsertLikeState(commentId, currentUser.id, liked);
    renderCommentsList();
    console.error('点赞失败:', err);
    if (isCommentLikesTableMissing(err)) {
      alert('点赞功能未完成升级，请先执行 supabase-community-upgrade.sql。');
    } else if (isCommentLikesPermissionError(err)) {
      alert('点赞功能数据库权限未完成升级，请重新执行 supabase-community-upgrade.sql。');
    } else {
      alert(`点赞失败: ${err.message || '未知错误'}`);
    }
  }
}

async function deleteComment(commentId, pageType) {
  const client = getCommentsClient();
  if (!client || !commentsFeatureAvailable) return;

  if (!confirm('确定删除这条评论？')) return;

  const snapshot = [...commentsState];
  commentsState = commentsState.filter(comment => comment.id !== commentId && comment.parent_comment_id !== commentId);
  renderCommentsList();

  try {
    const { error } = await client.from('comments').delete().eq('id', commentId);
    if (error) throw error;
  } catch (err) {
    commentsState = snapshot;
    renderCommentsList();
    alert(`删除失败: ${err.message || '未知错误'}`);
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
