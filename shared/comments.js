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

// 全局函数：更新指定用户的评论区资料（用于资料修改后同步）
window.updateCommentsProfile = function(userId, profileData) {
  if (!userId || !profileData) return;
  
  // 更新 profile map
  commentsProfileMap[userId] = {
    ...(commentsProfileMap[userId] || {}),
    ...profileData,
    id: userId
  };
  
  // 如果是当前用户，同时更新 currentProfile
  if (currentUser?.id === userId && typeof currentProfile !== 'undefined') {
    currentProfile = { ...(currentProfile || {}), ...profileData };
  }
  
  // 重新渲染评论区
  if (commentsLoaded) {
    renderCommentsList();
  }
  
  // 更新输入框状态
  updateCommentInputState();
};

// 设置 auth UI hook，确保在登录状态变化时更新评论区
function setupCommentAuthHook() {
  if (commentRenderAuthHooked) return;

  // 如果 renderAuthUI 还未定义，延迟设置
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

  // 立即执行一次，确保当前状态正确
  updateCommentInputState();
  if (commentsLoaded) {
    ensureLiveProfileMapped();
    renderCommentsList();
  }
}

// 确保用户 profile 已同步到数据库（用于外键约束）
async function ensureProfileSynced(client) {
  if (!currentUser?.id) return;

  try {
    // 先检查 profile 是否已存在
    const { data: existingProfile } = await client
      .from('profiles')
      .select('id')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (existingProfile) return; // 已存在，无需创建

    // 创建 profile
    const nickname = currentUser.user_metadata?.nickname ||
                    currentUser.email?.split('@')[0] ||
                    '匿名用户';

    await client.from('profiles').upsert({
      id: currentUser.id,
      email: currentUser.email || '',
      nickname: nickname,
      created_at: new Date().toISOString()
    }, { onConflict: 'id' });

  } catch (err) {
    console.warn('确保 profile 同步失败:', err);
    // 不阻止评论提交，让外键约束错误自然暴露
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

// 计算评论的嵌套层级
function getCommentLevel(comment) {
  let level = 0;
  let current = comment;
  while (current.parent_comment_id) {
    level++;
    current = commentsState.find(c => c.id === current.parent_comment_id);
    if (!current) break;
  }
  return level;
}

// 获取评论的所有回复（包括嵌套回复，限制3层）
function getCommentReplies(parentId, maxLevel = 3) {
  const result = [];
  const directReplies = commentsState
    .filter(item => item.parent_comment_id === parentId && !item.is_hidden)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  
  for (const reply of directReplies) {
    const level = getCommentLevel(reply);
    if (level < maxLevel) {
      result.push({ ...reply, _level: level });
      // 递归获取子回复
      const subReplies = getCommentReplies(reply.id, maxLevel);
      result.push(...subReplies);
    } else {
      // 超过3层，归入最近一层展示
      result.push({ ...reply, _level: maxLevel - 1, _flattened: true });
    }
  }
  return result;
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

  // 设置 auth UI hook，确保在登录状态变化时更新评论区
  setupCommentAuthHook();

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
  commentsTotalCount = rootComments.length;

  if (countEl) {
    countEl.textContent = `${visibleComments.length} 条留言`;
  }

  if (rootComments.length === 0) {
    listEl.innerHTML = '<p class="comments-empty">还没有评论，来做第一个留下想法的人。</p>';
    return;
  }

  // 分页：只显示当前页的评论
  const startIndex = 0;
  const endIndex = commentsCurrentPage * COMMENTS_PAGE_SIZE;
  const paginatedComments = rootComments.slice(startIndex, endIndex);
  const hasMore = endIndex < rootComments.length;

  const commentsHtml = paginatedComments.map(comment => renderCommentThread(comment)).join('');
  const loadMoreHtml = hasMore ? `
    <div class="comments-load-more">
      <button class="comment-load-more-btn" onclick="loadMoreComments()">
        加载更多 (${rootComments.length - endIndex} 条)
      </button>
    </div>
  ` : '';

  listEl.innerHTML = commentsHtml + loadMoreHtml;
}

function loadMoreComments() {
  commentsCurrentPage++;
  renderCommentsList();
}

// 获取评论的直接回复（仅下一级）
function getDirectReplies(parentId) {
  return commentsState
    .filter(item => item.parent_comment_id === parentId && !item.is_hidden)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

// 递归渲染评论树（支持3层嵌套）
function renderCommentTree(comment, level = 0, maxLevel = 3) {
  // 获取直接回复
  const directReplies = getDirectReplies(comment.id);
  const hasReplies = directReplies.length > 0;
  
  // 计算当前层级
  const currentLevel = level;
  
  // 如果是顶级评论（level=0），需要显示回复折叠/展开
  if (level === 0) {
    const allNestedReplies = getCommentReplies(comment.id, maxLevel);
    const totalReplyCount = allNestedReplies.length;
    const isExpanded = activeReplyTargetId === comment.id || comment._repliesExpanded;
    
    return `
      <div class="comment-thread" id="comment-thread-${comment.id}">
        ${renderSingleComment(comment, 0, totalReplyCount)}
        ${hasReplies ? `
          <div class="comment-replies-toggle" onclick="toggleReplies('${comment.id}')">
            <span class="replies-toggle-icon ${isExpanded ? 'expanded' : ''}">▼</span>
            <span>${totalReplyCount} 条回复</span>
          </div>
          <div class="comment-replies ${isExpanded ? 'expanded' : 'collapsed'}">
            ${directReplies.map(reply => renderCommentTree(reply, 1, maxLevel)).join('')}
          </div>
        ` : ''}
        ${renderReplyComposer(comment.id, comment.page_type)}
      </div>
    `;
  }
  
  // 嵌套回复（level >= 1）
  // 如果超过最大层级，归入最近一层
  if (currentLevel >= maxLevel) {
    // 三级回复（level=3）不显示回复按钮
    return renderSingleComment({ ...comment, _flattened: true }, maxLevel - 1, 0, true, false);
  }
  
  // 二级回复（level=1）：显示回复按钮，三级回复可折叠展开
  if (currentLevel === 1) {
    const isExpanded = comment._repliesExpanded !== false; // 默认展开
    
    return `
      <div class="comment-nested-wrapper">
        ${renderSingleComment(comment, currentLevel, hasReplies ? directReplies.length : 0, false, true)}
        ${hasReplies ? `
          <div class="comment-nested-replies-toggle level-1-toggle" onclick="toggleNestedReplies('${comment.id}')">
            <span class="replies-toggle-icon ${isExpanded ? 'expanded' : ''}">▼</span>
            <span>${directReplies.length} 条回复</span>
          </div>
          <div class="comment-nested-replies level-${currentLevel} ${isExpanded ? 'expanded' : 'collapsed'}">
            ${directReplies.map(reply => renderCommentTree(reply, currentLevel + 1, maxLevel)).join('')}
          </div>
        ` : ''}
        ${renderReplyComposer(comment.id, comment.page_type)}
      </div>
    `;
  }
  
  // 三级回复（level=2）：不显示回复按钮，不显示折叠（因为已经在父级折叠）
  return `
    <div class="comment-nested-wrapper">
      ${renderSingleComment(comment, currentLevel, 0, false, false)}
    </div>
  `;
}

// 切换二级回复下的三级回复展开/折叠
function toggleNestedReplies(commentId) {
  const comment = commentsState.find(c => c.id === commentId);
  if (comment) {
    comment._repliesExpanded = !comment._repliesExpanded;
    renderCommentsList();
  }
}

function renderCommentThread(comment) {
  return renderCommentTree(comment, 0, 3);
}

function toggleReplies(commentId) {
  const comment = commentsState.find(c => c.id === commentId);
  if (comment) {
    comment._repliesExpanded = !comment._repliesExpanded;
    renderCommentsList();
  }
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

  // 如果没有传入 pageType，尝试从评论数据中查找
  let targetPageType = pageType;
  if (!targetPageType) {
    const comment = commentsState.find(c => c.id === commentId);
    targetPageType = comment?.page_type || window.currentPageType || 'unknown';
  }

  return `
    <div class="comment-reply-panel">
      <textarea class="comment-reply-text" id="reply-text-${commentId}" placeholder="回复这条留言..." maxlength="300" rows="2"></textarea>
      <div class="comment-reply-actions">
        <button class="comment-inline-link" onclick="toggleReplyComposer('${commentId}')">取消</button>
        <button class="comment-submit-btn comment-reply-submit" id="reply-submit-${commentId}" onclick="submitReply('${targetPageType}', '${commentId}')">回复</button>
      </div>
    </div>
  `;
}

function renderSingleComment(comment, level = 0, replyCount = 0, isFlattened = false, showReplyBtn = true) {
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
  
  // 处理 @提及高亮
  const contentHtml = highlightMentions(escapeHtml(comment.content || ''));
  
  // 根据层级设置类名
  const levelClass = level > 0 ? ` comment-item-level-${Math.min(level, 3)}` : '';
  const flattenedClass = isFlattened ? ' comment-item-flattened' : '';
  
  // 回复按钮（三级回复不显示）
  const replyBtn = showReplyBtn ? `
    <button class="comment-action-btn comment-reply-action-btn" onclick="toggleReplyComposer('${comment.id}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
      </svg>
      <span>回复</span>
    </button>
  ` : '';

  return `
    <div class="comment-item${levelClass}${flattenedClass}" id="comment-${comment.id}" data-level="${level}">
      ${avatarHtml}
      <div class="comment-item-body">
        <div class="comment-item-header">
          <span class="comment-item-name" onclick="showUserProfilePopup('${comment.user_id}')" title="点击查看签名">${escapeHtml(name)}</span>
          <span class="comment-item-time">${time}</span>
          ${optimisticBadge}
          ${deleteBtn}
        </div>
        <p class="comment-item-text">${contentHtml}</p>
        ${imageHtml}
        <div class="comment-item-actions">
          <button class="comment-action-btn comment-like-btn${likedByCurrentUser ? ' active' : ''}" onclick="toggleCommentLike('${comment.id}')" title="${likeCount > 0 ? likeCount + ' 人点赞' : '点赞'}">
            <svg class="heart-icon" viewBox="0 0 24 24" fill="${likedByCurrentUser ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            ${likeCount > 0 ? `<span class="like-count">${likeCount}</span>` : ''}
          </button>
          ${replyBtn}
        </div>
        ${showReplyBtn ? renderReplyComposer(comment.id, comment.page_type) : ''}
      </div>
    </div>
  `;
}

// @提及高亮处理
function highlightMentions(text) {
  if (!text) return '';
  // 匹配 @用户名 格式（支持中文、英文、数字、下划线）
  return text.replace(/@([\u4e00-\u9fa5a-zA-Z0-9_]+)/g, '<span class="comment-mention">@$1</span>');
}

// 显示用户简介弹窗
function showUserProfilePopup(userId) {
  if (!userId) return;
  
  const profile = commentsProfileMap[userId] || {};
  const isCurrentUser = currentUser?.id === userId;
  
  // 如果点击的是当前用户，使用最新的 currentProfile
  const liveProfile = isCurrentUser && currentProfile ? currentProfile : profile;
  
  const name = liveProfile.nickname || '匿名用户';
  const avatarValue = liveProfile.avatar_url || '';
  const bio = liveProfile.bio || '这个人很懒，还没有写签名~';
  
  // 创建弹窗
  const popupId = 'user-profile-popup-' + Date.now();
  const popupHtml = `
    <div class="user-profile-popup-backdrop" onclick="closeUserProfilePopup('${popupId}')"></div>
    <div class="user-profile-popup" id="${popupId}">
      <button class="user-profile-popup-close" onclick="closeUserProfilePopup('${popupId}')">✕</button>
      <div class="user-profile-popup-content">
        <div class="user-profile-popup-avatar">${getAvatarNodeHtml(avatarValue, userId, 'popup-avatar')}</div>
        <div class="user-profile-popup-name">${escapeHtml(name)}</div>
        <div class="user-profile-popup-bio">${escapeHtml(bio)}</div>
      </div>
    </div>
  `;
  
  // 添加到页面
  const wrapper = document.createElement('div');
  wrapper.className = 'user-profile-popup-wrapper';
  wrapper.id = popupId + '-wrapper';
  wrapper.innerHTML = popupHtml;
  document.body.appendChild(wrapper);
  
  // 点击背景关闭
  setTimeout(() => {
    const backdrop = wrapper.querySelector('.user-profile-popup-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => closeUserProfilePopup(popupId));
    }
  }, 0);
}

// 关闭用户简介弹窗
function closeUserProfilePopup(popupId) {
  const wrapper = document.getElementById(popupId + '-wrapper');
  if (wrapper) {
    wrapper.remove();
  }
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
    // 确保用户 profile 已同步到数据库（外键约束要求）
    await ensureProfileSynced(client);

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

  // 跳过临时评论的点赞（临时ID不是有效的UUID）
  if (commentId.startsWith('temp-')) {
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
