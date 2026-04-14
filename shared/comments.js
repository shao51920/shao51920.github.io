/*  ==============================
    Comments Module — 评论区
    ==============================
    使用方法：在结果页 DOM 中放一个 <div id="comments-section" data-page="soullab"></div>
    然后本模块会自动渲染评论区。
*/

let commentsLoaded = false;

/* ── 初始化评论区 ── */
function initComments() {
  const container = document.getElementById('comments-section');
  if (!container) return;

  const pageType = container.dataset.page || 'unknown';

  container.innerHTML = `
    <div class="comments-wrapper">
      <div class="comments-header">
        <h3>💬 灵魂碎片交流区</h3>
        <span class="comments-count" id="comments-count">加载中...</span>
      </div>

      <div class="comment-input-area" id="comment-input-area">
        <div class="comment-input-login-hint" id="comment-login-hint">
          <p>登录后即可发表评论</p>
          <button class="auth-login-btn" onclick="openAuthModal()">登录 / 注册</button>
        </div>
        <div class="comment-input-box" id="comment-input-box" style="display:none">
          <div class="comment-user-info">
            <img class="comment-avatar" id="comment-avatar" src="" alt="">
            <span id="comment-username">用户</span>
          </div>
          <textarea id="comment-text" placeholder="写下你的想法…" maxlength="500" rows="3"></textarea>
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

  // 字数计数
  const textarea = document.getElementById('comment-text');
  if (textarea) {
    textarea.addEventListener('input', () => {
      document.getElementById('comment-char').textContent = textarea.value.length;
    });
  }

  loadComments(pageType);
  updateCommentInputState();
}

/* ── 根据登录状态切换评论输入区 ── */
function updateCommentInputState() {
  const loginHint = document.getElementById('comment-login-hint');
  const inputBox = document.getElementById('comment-input-box');
  if (!loginHint || !inputBox) return;

  if (currentUser && currentProfile) {
    loginHint.style.display = 'none';
    inputBox.style.display = 'block';
    const avatar = document.getElementById('comment-avatar');
    const username = document.getElementById('comment-username');
    if (avatar) avatar.src = currentProfile.avatar_url || 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=' + currentUser.id;
    if (username) username.textContent = currentProfile.nickname || '用户';
  } else {
    loginHint.style.display = 'flex';
    inputBox.style.display = 'none';
  }
}

// 监听登录状态变化时刷新评论输入区
const origRenderAuthUI = typeof renderAuthUI === 'function' ? renderAuthUI : null;
if (origRenderAuthUI) {
  const _origRender = renderAuthUI;
  renderAuthUI = function () {
    _origRender();
    updateCommentInputState();
  };
}

/* ── 加载评论 ── */
async function loadComments(pageType) {
  const listEl = document.getElementById('comments-list');
  const countEl = document.getElementById('comments-count');

  try {
    const { data: comments, error } = await supabase
      .from('comments')
      .select('*, profiles(nickname, avatar_url)')
      .eq('page_type', pageType)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    if (countEl) countEl.textContent = `${comments.length} 条`;

    if (!comments || comments.length === 0) {
      listEl.innerHTML = '<p class="comments-empty">还没有评论，来做第一个分享灵魂的人 ✨</p>';
      return;
    }

    listEl.innerHTML = comments.map(c => renderComment(c)).join('');
    commentsLoaded = true;
  } catch (err) {
    console.error('加载评论失败:', err);
    listEl.innerHTML = '<p class="comments-empty">评论加载失败，请刷新页面</p>';
  }
}

/* ── 渲染单条评论 ── */
function renderComment(c) {
  const profile = c.profiles || {};
  const avatar = profile.avatar_url || 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=default';
  const name = profile.nickname || '匿名';
  const time = new Date(c.created_at).toLocaleString('zh-CN', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  const isOwner = currentUser && c.user_id === currentUser.id;
  const imageHtml = c.image_url ? `<div class="comment-img-wrap"><img src="${c.image_url}" alt="评论图片" onclick="openCommentImage(this.src)" loading="lazy"></div>` : '';
  const deleteBtn = isOwner ? `<button class="comment-delete-btn" onclick="deleteComment('${c.id}', '${c.page_type}')">删除</button>` : '';

  return `
    <div class="comment-item" id="comment-${c.id}">
      <img class="comment-item-avatar" src="${avatar}" alt="">
      <div class="comment-item-body">
        <div class="comment-item-header">
          <span class="comment-item-name">${escapeHtml(name)}</span>
          <span class="comment-item-time">${time}</span>
          ${deleteBtn}
        </div>
        <p class="comment-item-text">${escapeHtml(c.content)}</p>
        ${imageHtml}
      </div>
    </div>
  `;
}

/* ── 提交评论 ── */
async function submitComment(pageType) {
  if (!currentUser) {
    openAuthModal();
    return;
  }

  const textEl = document.getElementById('comment-text');
  const content = textEl.value.trim();
  const submitBtn = document.getElementById('comment-submit-btn');

  if (!content && !selectedImageFile) {
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '发布中...';

  try {
    let imageUrl = null;

    // 上传图片
    if (selectedImageFile) {
      const fileExt = selectedImageFile.name.split('.').pop();
      const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('comment-images')
        .upload(fileName, selectedImageFile, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('comment-images')
        .getPublicUrl(fileName);
      imageUrl = urlData.publicUrl;
    }

    // 插入评论
    const { error } = await supabase.from('comments').insert({
      user_id: currentUser.id,
      page_type: pageType,
      content: content || '',
      image_url: imageUrl
    });

    if (error) throw error;

    // 清空输入
    textEl.value = '';
    document.getElementById('comment-char').textContent = '0';
    removeImagePreview();

    // 重新加载评论
    await loadComments(pageType);
  } catch (err) {
    console.error('发布失败:', err);
    alert('发布失败：' + (err.message || '未知错误'));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '发布';
  }
}

/* ── 删除评论 ── */
async function deleteComment(commentId, pageType) {
  if (!confirm('确定删除这条评论？')) return;
  try {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) throw error;
    await loadComments(pageType);
  } catch (err) {
    alert('删除失败');
  }
}

/* ── 图片预览 ── */
let selectedImageFile = null;

function handleImagePreview(input) {
  const file = input.files[0];
  if (!file) return;

  // 限制 5MB
  if (file.size > 5 * 1024 * 1024) {
    alert('图片大小不能超过 5MB');
    input.value = '';
    return;
  }

  selectedImageFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('comment-preview-img').src = e.target.result;
    document.getElementById('comment-image-preview').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function removeImagePreview() {
  selectedImageFile = null;
  document.getElementById('comment-image-preview').style.display = 'none';
  document.getElementById('comment-preview-img').src = '';
  document.getElementById('comment-image-input').value = '';
}

/* ── 查看评论大图 ── */
function openCommentImage(src) {
  const overlay = document.createElement('div');
  overlay.className = 'comment-img-modal';
  overlay.onclick = () => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
  };
  overlay.innerHTML = `<img src="${src}" alt="大图">`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.style.opacity = '1');
}

/* ── 工具函数 ── */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
