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

// 分页配置
const COMMENTS_PAGE_SIZE = 10;
let commentsCurrentPage = 1;
let commentsTotalCount = 0;

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

function getLiveCurrentProfile() {
  if (!currentUser) return null;
  return {
    id: currentUser.id,
    nickname: currentProfile?.nickname || currentUser.user_metadata?.nickname || currentUser.email || '用户',
    avatar_url: currentProfile?.avatar_url || currentUser.user_metadata?.avatar_url || (currentUser.user_metadata?.avatar_emoji ? `emoji:${currentUser.user_metadata.avatar_emoji}` : ''),
    bio: currentProfile?.bio || currentUser.user_metadata?.bio || ''
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

// 全局函数：更新指定用户的评论区资料（用于资料修改后同步）
window.updateCommentsProfile = function(userId, profileData) {
  if (!userId || !profileData) return;
  
  commentsProfileMap[userId] = {
    ...(commentsProfileMap[userId] || {}),
    ...profileData,
    id: userId
  };
  
  if (currentUser?.id === userId) {
    if (typeof currentProfile !== 'undefined') {
       currentProfile = { ...(currentProfile || {}), ...profileData };
    }
  }
  
  if (commentsLoaded && document.getElementById('comments-list')) {
    renderCommentsList();
  }
  updateCommentInputState();
};

function setupCommentAuthHook() {
  if (commentRenderAuthHooked) return;
  if (typeof renderAuthUI !== 'function') {
    setTimeout(setupCommentAuthHook, 100);
    return;
  }

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
  updateCommentInputState();
}

async function ensureProfileSynced(client) {
  if (!currentUser?.id) return;
  try {
    const { data: existingProfile } = await client
      .from('profiles')
      .select('id')
      .eq('id', currentUser.id)
      .maybeSingle();
    if (existingProfile) return;
    const nickname = currentUser.user_metadata?.nickname || currentUser.email?.split('@')[0] || '匿名用户';
    await client.from('profiles').upsert({
      id: currentUser.id,
      email: currentUser.email || '',
      nickname: nickname,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('确保 profile 同步失败:', err);
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

function getSortedVisibleComments() {
  return commentsState
    .filter(comment => !comment.is_hidden)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function initComments() {
  const container = document.getElementById('comments-section');
  if (!container) return;
  const pageType = container.dataset.page || 'unknown';
  activeCommentsPageType = pageType;
  commentsCurrentPage = 1;
  activeReplyTargetId = null;

  container.innerHTML = `
    <div class="comments-wrapper">
      <div class="comments-header">
        <span class="comments-count" id="comments-count">加载中...</span>
      </div>

      <div class="comment-input-area" id="comment-input-area">
        <div class="comment-input-login-hint" id="comment-login-hint">
          <p>登录后即可留言</p>
          <button class="auth-login-btn" onclick="openAuthModal()">登录 / 注册</button>
        </div>
        <div class="comment-input-box" id="comment-input-box" style="display:none">
          <div class="comment-user-info">
            <span class="comment-avatar" id="comment-avatar"></span>
            <span id="comment-username">用户</span>
          </div>
          <textarea id="comment-text" placeholder="写下你的想法..." maxlength="500" rows="3"></textarea>
          <div class="comment-input-actions">
            <label class="comment-upload-btn" title="上传图片">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
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
      document.getElementById('comment-char').textContent = textarea.value.length;
    });
  }
  setupCommentAuthHook();
  loadComments(pageType);
  updateCommentInputState();
}

function updateCommentInputState() {
  const loginHint = document.getElementById('comment-login-hint');
  const inputBox = document.getElementById('comment-input-box');
  if (!loginHint || !inputBox) return;

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

  try {
    const { data, error } = await client
      .from('comments')
      .select('*')
      .eq('page_type', pageType)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    commentsState = data || [];
    await loadCommentProfiles(client, commentsState);
    await loadCommentLikes(client, commentsState);
    commentsLoaded = true;
    renderCommentsList();
  } catch (err) {
    console.error('加载评论失败:', err);
    listEl.innerHTML = '<p class="comments-empty">评论加载失败，请刷新重试。</p>';
  }
}

async function loadCommentProfiles(client, comments) {
  const userIds = [...new Set((comments || []).map(c => c.user_id).filter(Boolean))];
  if (userIds.length > 0) {
    const { data } = await client.from('profiles').select('*').in('id', userIds);
    commentsProfileMap = Object.fromEntries((data || []).map(p => [p.id, p]));
  }
  ensureLiveProfileMapped();
}

async function loadCommentLikes(client, comments) {
  const commentIds = [...new Set((comments || []).map(c => c.id))];
  if (commentIds.length === 0) return;
  const { data } = await client.from('comment_likes').select('comment_id, user_id').in('comment_id', commentIds);
  commentLikesMap = {};
  (data || []).forEach(row => {
    if (!commentLikesMap[row.comment_id]) commentLikesMap[row.comment_id] = [];
    commentLikesMap[row.comment_id].push(row.user_id);
  });
}

function renderCommentsList() {
  const listEl = document.getElementById('comments-list');
  const countEl = document.getElementById('comments-count');
  if (!listEl) return;

  const visibleComments = getSortedVisibleComments();
  const rootComments = visibleComments.filter(c => !c.parent_comment_id);
  if (countEl) countEl.textContent = `${visibleComments.length} 条留言`;

  if (rootComments.length === 0) {
    listEl.innerHTML = '<p class="comments-empty">还没有评论，来做第一个留言的人吧。</p>';
    return;
  }

  const paginated = rootComments.slice(0, commentsCurrentPage * COMMENTS_PAGE_SIZE);
  listEl.innerHTML = paginated.map(c => renderCommentThread(c)).join('') + (paginated.length < rootComments.length ? `
    <div class="comments-load-more">
      <button class="comment-load-more-btn" onclick="loadMoreComments()">加载更多</button>
    </div>
  ` : '');
}

function loadMoreComments() {
  commentsCurrentPage++;
  renderCommentsList();
}

function getDirectReplies(parentId) {
  return commentsState
    .filter(c => c.parent_comment_id === parentId && !c.is_hidden)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function isRepliesExpanded(comment) {
  return comment?._repliesExpanded === true;
}

function renderRepliesBlock(comment, replies, level) {
  if (!replies.length) return '';

  const isExpanded = isRepliesExpanded(comment);
  const toggleClassName = `comment-replies-toggle ${level > 0 ? 'is-nested' : ''} ${isExpanded ? 'is-expanded' : ''}`.trim();

  return `
    <div class="${toggleClassName}" onclick="toggleReplies('${comment.id}')">
      <span class="toggle-icon">▼</span>
      <span>${isExpanded ? '收起' : '展开'} ${replies.length} 条回复</span>
    </div>
    <div class="comment-replies ${level > 0 ? 'is-nested' : ''} ${isExpanded ? 'is-visible' : 'is-hidden'}">
      ${replies.map(reply => renderCommentThreadRecursive(reply, level + 1)).join('')}
    </div>
  `;
}

function legacyRenderCommentThread(comment) {
  const replies = getDirectReplies(comment.id);
  const isExpanded = comment._repliesExpanded !== false;
  return `
    <div class="comment-thread" id="comment-thread-${comment.id}">
      ${renderSingleComment(comment, 0)}
      ${replies.length > 0 ? `
        <div class="comment-replies-toggle ${isExpanded ? 'is-expanded' : ''}" onclick="toggleReplies('${comment.id}')">
          <span class="toggle-icon">▼</span>
          <span>${replies.length} 条回复</span>
        </div>
        <div class="comment-replies ${isExpanded ? 'is-visible' : 'is-hidden'}">
          ${replies.map(r => renderCommentThreadRecursive(r, 1)).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function legacyRenderCommentThreadRecursive(comment, level = 1) {
  const replies = getDirectReplies(comment.id);
  // 对于深层回复，如果嵌套过深（目前>3层），减少缩进或改变布局，防止移动端溢出
  const nextLevel = level + 1;
  const showRepliesInline = level >= 3; 

  return `
    <div class="comment-nested-thread level-${level}">
      ${renderSingleComment(comment, level)}
      ${replies.length > 0 ? `
        <div class="comment-replies ${showRepliesInline ? 'deep-level' : ''}">
          ${replies.map(r => renderCommentThreadRecursive(r, nextLevel)).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function toggleReplies(commentId) {
  const comment = commentsState.find(c => c.id === commentId);
  if (comment) {
    comment._repliesExpanded = (comment._repliesExpanded === false);
    renderCommentsList();
  }
}

function renderCommentThread(comment) {
  const replies = getDirectReplies(comment.id);
  return `
    <div class="comment-thread" id="comment-thread-${comment.id}">
      ${renderSingleComment(comment, 0)}
      ${renderRepliesBlock(comment, replies, 0)}
    </div>
  `;
}

function renderCommentThreadRecursive(comment, level = 1) {
  const replies = getDirectReplies(comment.id);
  const normalizedLevel = Math.min(level, 4);

  return `
    <div class="comment-nested-thread level-${normalizedLevel}">
      ${renderSingleComment(comment, normalizedLevel)}
      ${renderRepliesBlock(comment, replies, normalizedLevel)}
    </div>
  `;
}

function toggleReplyComposer(commentId) {
  activeReplyTargetId = activeReplyTargetId === commentId ? null : commentId;
  renderCommentsList();
}

function renderReplyComposer(commentId, pageType, targetName) {
  if (activeReplyTargetId !== commentId) return '';
  if (!currentUser) return '<div class="comment-reply-panel is-login-hint">登录后即可回复</div>';
  
  const defaultText = targetName ? `@${targetName} ` : '';

  // 延迟一帧滚动到回复框并设置焦点到末尾
  setTimeout(() => {
    const el = document.getElementById(`reply-text-${commentId}`);
    if (el) {
      if (!el.value) el.value = defaultText;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 100);

  return `
    <div class="comment-reply-panel">
      <textarea class="comment-reply-text" id="reply-text-${commentId}" placeholder="回复这条留言..." maxlength="300" rows="2">${defaultText}</textarea>
      <div class="comment-reply-actions">
        <button class="action-btn is-cancel" onclick="toggleReplyComposer('${commentId}')">取消</button>
        <button class="comment-submit-btn is-small" id="reply-btn-${commentId}" onclick="submitReply('${pageType}', '${commentId}')">回复</button>
      </div>
    </div>
  `;
}

function renderSingleComment(comment, level = 0) {
  const profile = getCommentDisplayProfile(comment.user_id);
  const name = profile.nickname || '匿名用户';
  const avatarValue = profile.avatar_url || getProfileAvatarValue(profile);
  const time = new Date(comment.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const isOwner = currentUser && comment.user_id === currentUser.id;
  const liked = isCommentLikedByCurrentUser(comment.id);
  const likeCount = getCommentLikeCount(comment.id);
  const avatarHtml = getAvatarNodeHtml(avatarValue, comment.user_id || 'guest', 'comment-item__avatar');
  
  // 如果是回复，查找父评论作者名
  let replyHint = '';
  let targetNickname = '';
  if (comment.parent_comment_id) {
    const parent = commentsState.find(c => c.id === comment.parent_comment_id);
    if (parent) {
      const parentProfile = getCommentDisplayProfile(parent.user_id);
      targetNickname = parentProfile.nickname || '用户';
      // 如果内容本身没有以 @昵称 开头，则增加样式化的回复提示（兼容旧数据）
      if (!comment.content || !comment.content.trim().startsWith(`@${targetNickname}`)) {
        replyHint = `<span class="comment-reply-to">回复 <span class="mention-name">@${escapeHtml(targetNickname)}</span> : </span>`;
      }
    }
  }

  return `
    <div class="comment-item ${level > 0 ? 'is-reply' : ''}" id="comment-${comment.id}" data-level="${level}">
      <div class="comment-item__avatar-box">${avatarHtml}</div>
      <div class="comment-item__main">
        <div class="comment-item__header">
          <span class="comment-item__name" onclick="showUserProfilePopup('${comment.user_id}')">${escapeHtml(name)}</span>
          <span class="comment-item__time">${time}</span>
          ${comment.is_optimistic ? '<span class="comment-item__pending">发送中</span>' : ''}
        </div>
        <div class="comment-item__content">
          ${replyHint}${highlightMentions(escapeHtml(comment.content || ''))}
        </div>
        ${comment.image_url ? `<div class="comment-item__image"><img src="${escapeAttr(comment.image_url)}" onclick="openCommentImage(this.src)" loading="lazy"></div>` : ''}
        <div class="comment-item__footer">
          <div class="comment-item__actions">
            <button class="action-btn is-like ${liked ? 'is-active' : ''}" onclick="toggleCommentLike('${comment.id}')">
              <svg viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              ${likeCount > 0 ? `<span>${likeCount}</span>` : ''}
            </button>
            <button class="action-btn is-reply" onclick="toggleReplyComposer('${comment.id}')">回复</button>
          </div>
          ${isOwner ? `<button class="action-btn is-delete" onclick="deleteComment('${comment.id}', '${comment.page_type}')">删除</button>` : ''}
        </div>
        ${renderReplyComposer(comment.id, comment.page_type, name)}
      </div>
    </div>
  `;
}

function highlightMentions(text) {
  return text.replace(/@([\u4e00-\u9fa5a-zA-Z0-9_]+)/g, '<span class="comment-mention">@$1</span>');
}

function showUserProfilePopup(userId) {
  const profile = commentsProfileMap[userId] || {};
  const isCurrentUser = currentUser?.id === userId;
  const liveProfile = isCurrentUser && currentProfile ? currentProfile : profile;
  const bio = liveProfile.bio?.trim() || '这个人很懒，还没有写签名~';
  const popupId = 'user-profile-popup-' + Date.now();
  
  const div = document.createElement('div');
  div.id = popupId + '-wrapper';
  div.innerHTML = `
    <div class="user-profile-popup-backdrop" onclick="closeUserProfilePopup('${popupId}')"></div>
    <div class="user-profile-popup">
      <button class="user-profile-popup-close" onclick="closeUserProfilePopup('${popupId}')">✕</button>
      <div class="user-profile-popup-avatar">${getAvatarNodeHtml(liveProfile.avatar_url, userId, 'popup-avatar')}</div>
      <div class="user-profile-popup-name">${escapeHtml(liveProfile.nickname || '匿名用户')}</div>
      <div class="user-profile-popup-bio">${escapeHtml(bio)}</div>
    </div>
  `;
  document.body.appendChild(div);
}

function closeUserProfilePopup(popupId) {
  document.getElementById(popupId + '-wrapper')?.remove();
}

async function submitComment(pageType) {
  const input = document.getElementById('comment-text');
  const btn = document.getElementById('comment-submit-btn');
  await submitCommentInternal({ pageType, inputEl: input, submitBtn: btn, allowImage: true });
}

async function submitReply(pageType, parentId) {
  const input = document.getElementById(`reply-text-${parentId}`);
  const btn = document.querySelector(`button[onclick="submitReply('${pageType}', '${parentId}')"]`);
  await submitCommentInternal({ pageType, parentCommentId: parentId, inputEl: input, submitBtn: btn, allowImage: false });
}

async function submitCommentInternal({ pageType, parentCommentId = null, inputEl, submitBtn, allowImage }) {
  if (!currentUser || !inputEl.value.trim()) return;
  const client = getCommentsClient();
  const content = inputEl.value.trim();
  
  submitBtn.disabled = true;
  try {
    const payload = { user_id: currentUser.id, page_type: pageType, content, parent_comment_id: parentCommentId };
    const { data, error } = await client.from('comments').insert(payload).select().single();
    if (error) throw error;
    commentsState.unshift(data);
    inputEl.value = '';
    activeReplyTargetId = null;
    renderCommentsList();
  } catch (err) {
    alert('发布失败: ' + err.message);
  } finally {
    submitBtn.disabled = false;
  }
}

async function deleteComment(id, pageType) {
  if (!confirm('确定删除这条留言吗？')) return;
  const client = getCommentsClient();
  try {
    const { error } = await client.from('comments').delete().eq('id', id);
    if (error) throw error;
    commentsState = commentsState.filter(c => c.id !== id);
    renderCommentsList();
  } catch (err) {
    alert('删除失败');
  }
}

async function toggleCommentLike(commentId) {
  if (!currentUser) { openAuthModal(); return; }
  const client = getCommentsClient();
  const liked = isCommentLikedByCurrentUser(commentId);
  try {
    if (liked) {
      await client.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', currentUser.id);
    } else {
      await client.from('comment_likes').insert({ comment_id: commentId, user_id: currentUser.id });
    }
    await loadCommentLikes(client, commentsState);
    renderCommentsList();
  } catch (err) {
    console.warn('点赞失败');
  }
}

function handleImagePreview(input) {
  const file = input.files[0];
  if (file) {
    selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('comment-preview-img').src = e.target.result;
      document.getElementById('comment-image-preview').style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
}

function removeImagePreview() {
  selectedImageFile = null;
  document.getElementById('comment-image-preview').style.display = 'none';
}

function openCommentImage(src) {
  const win = window.open('', '_blank');
  win.document.write(`<img src="${src}" style="max-width:100%; height:auto;">`);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;');
}

window.initComments = initComments;
window.submitComment = submitComment;
window.submitReply = submitReply;
window.deleteComment = deleteComment;
window.toggleCommentLike = toggleCommentLike;
window.toggleReplies = toggleReplies;
window.toggleReplyComposer = toggleReplyComposer;
window.handleImagePreview = handleImagePreview;
window.removeImagePreview = removeImagePreview;
window.openCommentImage = openCommentImage;
window.showUserProfilePopup = showUserProfilePopup;
window.closeUserProfilePopup = closeUserProfilePopup;
window.loadMoreComments = loadMoreComments;
