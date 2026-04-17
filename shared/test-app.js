/* ==============================
   Shared Test Framework Core
   ============================== */

let currentQuestion = 0;
let answers = {};
let scores = {};
let toastHideTimer = null;

const RESULT_VIEW_TABLE = 'result_views';
const SOULLAB_BASE_OFFSET = 153;
const OBJTEST_BASE_OFFSET = 118;

function getAppSupabaseClient() {
  if (window.supabaseClient && typeof window.supabaseClient.from === 'function') return window.supabaseClient;
  if (window.db && typeof window.db.from === 'function') return window.db;
  if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') return supabase;
  return null;
}

function getPageType() {
  const container = document.getElementById('comments-section');
  return container?.getAttribute('data-page') || 'soullab';
}

function getDisplayNickname() {
  return (typeof currentProfile !== 'undefined' ? currentProfile?.nickname : '')
    || (typeof currentUser !== 'undefined' ? currentUser?.user_metadata?.nickname : '')
    || (typeof currentUser !== 'undefined' ? currentUser?.email : '')
    || '';
}

function ensureToastNode() {
  let toast = document.getElementById('app-toast');
  if (toast) return toast;

  toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.className = 'toast';
  document.body.appendChild(toast);
  return toast;
}

function showToast(message, duration = 2600) {
  const toast = ensureToastNode();
  toast.textContent = message;
  toast.classList.remove('show');
  void toast.offsetWidth;
  toast.classList.add('show');

  if (toastHideTimer) clearTimeout(toastHideTimer);
  toastHideTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

/* ==============================
   Participant Count
   ============================== */
function renderParticipantCount(element, count) {
  if (!element) return;

  const safeCount = Number.isFinite(Number(count)) ? Math.max(0, Math.floor(Number(count))) : 0;
  const baseOffset = getPageType() === 'soullab' ? SOULLAB_BASE_OFFSET : OBJTEST_BASE_OFFSET;
  const displayCount = safeCount + baseOffset;
  element.innerHTML = `已有 <span class="participant-number">${displayCount}</span> 人参与测试`;
}

async function loadParticipantCount() {
  const client = getAppSupabaseClient();
  const pageType = getPageType();
  const countEl = document.getElementById(`${pageType}-participant-count`);
  if (!client || !countEl) return;

  try {
    const { count, error } = await client
      .from(RESULT_VIEW_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('page_type', pageType);

    if (error) throw error;
    renderParticipantCount(countEl, count || 0);
  } catch (err) {
    console.error('Count load failed:', err);
  }
}

async function trackResultView() {
  const client = getAppSupabaseClient();
  if (!client) return;

  try {
    await client.from(RESULT_VIEW_TABLE).insert({ page_type: getPageType() });
    loadParticipantCount();
  } catch (err) {
    console.error('Track failed:', err);
  }
}

/* ==============================
   Page Management
   ============================== */
function showPage(pageId) {
  document.querySelectorAll('.page').forEach((page) => {
    page.classList.remove('active');
    page.style.display = 'none';
  });

  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.style.display = (pageId === 'quiz' || pageId === 'loading') ? 'flex' : 'block';
    targetPage.offsetHeight;
    targetPage.classList.add('active');
  }

  document.body.classList.remove('landing-active', 'result-active', 'quiz-active');
  if (pageId === 'landing') document.body.classList.add('landing-active');
  if (pageId === 'quiz') document.body.classList.add('quiz-active');
  if (pageId === 'result') document.body.classList.add('result-active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ==============================
   Quiz Flow
   ============================== */
function startTest() {
  currentQuestion = 0;
  answers = {};
  scores = {};
  showPage('quiz');
  renderQuestion();
}

function renderQuestion() {
  const q = questions[currentQuestion];
  const container = document.getElementById('question-container');
  if (!q || !container) return;

  container.style.opacity = '0';
  container.style.transform = 'translateY(10px)';

  setTimeout(() => {
    container.innerHTML = `
      <h2 class="question-number">Question ${currentQuestion + 1}</h2>
      <p class="question-text">${q.text}</p>
      <div class="options">
        ${q.options.map((opt, idx) => `
          <div class="option ${answers[q.id] === idx ? 'selected' : ''}" onclick="selectOption(${idx})">
            <div class="option-indicator"></div>
            <span class="option-label">${String.fromCharCode(65 + idx)}</span>
            <span class="option-text">${opt.text}</span>
          </div>
        `).join('')}
      </div>
    `;
    container.style.opacity = '1';
    container.style.transform = 'translateY(0)';
    updateProgress();
  }, 300);
}

function selectOption(idx) {
  const q = questions[currentQuestion];
  if (!q || idx < 0 || idx >= q.options.length) return;

  answers[q.id] = idx;
  const options = document.querySelectorAll('.option');
  options.forEach((option) => option.classList.remove('selected'));
  options[idx]?.classList.add('selected');

  setTimeout(() => {
    if (currentQuestion < questions.length - 1) {
      currentQuestion += 1;
      renderQuestion();
    } else {
      calculateResult();
    }
  }, 400);
}

function prevQuestion() {
  if (currentQuestion <= 0) return;
  currentQuestion -= 1;
  renderQuestion();
}

function nextQuestion() {
  const q = questions[currentQuestion];
  if (!q || answers[q.id] === undefined) return;

  if (currentQuestion < questions.length - 1) {
    currentQuestion += 1;
    renderQuestion();
    return;
  }

  calculateResult();
}

function updateProgress() {
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const bar = document.getElementById('progress-bar');
  const currentQ = document.getElementById('current-q');
  const totalQ = document.getElementById('total-q');

  if (bar) bar.style.width = `${progress}%`;
  if (currentQ) currentQ.textContent = String(currentQuestion + 1);
  if (totalQ) totalQ.textContent = String(questions.length);
}

/* ==============================
   Result Calculation
   ============================== */
async function calculateResult() {
  const pageType = getPageType();
  showPage('loading');

  const progressTitle = document.querySelector('.loading-title');
  const messages = pageType === 'soullab'
    ? ['正在解析灵魂画像...', '正在拆解人格防御...', '正在生成你的角色结论...']
    : ['正在收集答题轨迹...', '正在分析主体感状态...', '正在生成你的测试结果...'];

  let index = 0;
  const interval = setInterval(() => {
    if (progressTitle && messages[index]) progressTitle.textContent = messages[index];
    index += 1;
    if (index >= messages.length) clearInterval(interval);
  }, 800);

  if (pageType === 'soullab') {
    scores = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };

    questions.forEach((q) => {
      const selectedIdx = answers[q.id];
      if (selectedIdx === undefined) return;

      const optionScores = q.options[selectedIdx].scores || {};
      Object.entries(optionScores).forEach(([key, value]) => {
        scores[key] = (scores[key] || 0) + value;
      });
    });

    const personalityMapping = {
      mask: (s) => s.E >= s.I && s.J >= s.P,
      hoard: (s) => s.I >= s.E && s.T >= s.F && s.J >= s.P,
      escape: (s) => s.I >= s.E && s.F >= s.T && s.P >= s.J,
      rebel: (s) => s.E >= s.I && s.P >= s.J && s.T >= s.F,
      edge: (s) => s.I >= s.E && s.F >= s.T && s.J >= s.P,
      crash: (s) => s.N >= s.S && s.P >= s.J && s.F >= s.T,
      chill: (s) => s.I >= s.E && s.S >= s.N && s.P >= s.J,
      clown: (s) => s.E >= s.I && s.S >= s.N && s.P >= s.J,
      mama: (s) => s.E >= s.I && s.F >= s.T && s.J >= s.P,
      hustle: (s) => s.S >= s.N && s.T >= s.F && s.J >= s.P,
      chaos: (s) => s.E >= s.I && s.P >= s.J && s.S >= s.N,
      awake: (s) => s.N >= s.S && s.P >= s.J && s.T >= s.F
    };

    let resultKey = 'edge';
    Object.entries(personalityMapping).some(([key, check]) => {
      if (!check(scores)) return false;
      resultKey = key;
      return true;
    });

    setTimeout(() => finalizeResult(resultKey), 3200);
    return;
  }

  let totalScore = 0;
  questions.forEach((q) => {
    const selectedIdx = answers[q.id];
    if (selectedIdx === undefined) return;
    totalScore += q.options[selectedIdx].score || 0;
  });

  setTimeout(() => finalizeResult(totalScore), 3200);
}

function finalizeResult(resultValue) {
  showPage('result');
  trackResultView();

  if (getPageType() === 'soullab') {
    displaySoulLabResult(resultValue);
  } else {
    displayObjTestResult(resultValue);
  }

  if (typeof initComments === 'function') initComments();
}

/* ==============================
   Result Rendering
   ============================== */
function displaySoulLabResult(type) {
  const dataStore = (typeof personalities !== 'undefined')
    ? personalities
    : (typeof personalityTypes !== 'undefined' ? personalityTypes : {});
  const profile = dataStore[type];
  if (!profile) return;

  const nickname = getDisplayNickname();
  const typeLabel = document.getElementById('result-type-label');
  if (typeLabel) {
    typeLabel.textContent = nickname ? `${nickname}的人格类型是` : '你的人格类型是';
  }

  document.getElementById('result-badge').textContent = profile.emoji || '🎭';
  document.getElementById('result-title').textContent = profile.name;
  document.getElementById('result-subtitle').textContent = profile.subtitle || profile.tagline || '';
  document.getElementById('result-description').innerHTML = profile.description || '';
  document.getElementById('result-quote').textContent = profile.quote || '';
  document.getElementById('result-mbti').innerHTML = profile.mbti || '';

  const characterImage = document.getElementById('character-img');
  if (characterImage && profile.image) {
    characterImage.src = `${profile.image}?t=${Date.now()}`;
    characterImage.style.cursor = 'zoom-in';
    characterImage.onclick = () => openImageModal(characterImage.src);
  }

  const tagsContainer = document.getElementById('result-tags');
  if (tagsContainer) {
    const tags = profile.tags || (profile.traits ? [...profile.traits, ...(profile.weaknesses || [])] : []);
    tagsContainer.innerHTML = tags.map((tag) => `<span class="result-tag">#${tag}</span>`).join('');
  }

  setTimeout(() => {
    if (!profile.meters) return;
    animateMeter('meter-mask', profile.meters.mask || 0);
    animateMeter('meter-awake', profile.meters.awake || 0);
    animateMeter('meter-chill', profile.meters.chill || 0);
    animateMeter('meter-drama', profile.meters.drama || 0);
  }, 300);
}

function renderAlignedCopyBlock(html) {
  const lines = String(html || '')
    .split(/<br\s*\/?>/i)
    .map((line) => line.trim())
    .filter(Boolean);

  return `
    <div class="result-copy-block">
      ${lines.map((line) => `<span>${line}</span>`).join('')}
    </div>
  `;
}

function displayObjTestResult(score) {
  const tier = resultTiers.find((item) => score >= item.minScore && score <= item.maxScore) || resultTiers[0];
  const resultContainer = document.getElementById('result-display');
  if (!resultContainer) return;

  resultContainer.innerHTML = `
    <div class="result-content result-content--objtest">
      <div class="obj-result-header">
        <div class="obj-result-score-circle" style="--obj-score-color:${tier.color};">${score}</div>
        <div class="result-title-group result-title-group--plain">
          <h2 class="result-title result-title--objtest" id="result-title">${tier.title}</h2>
        </div>
      </div>
      <section class="result-description result-description--objtest">
        <h3 class="section-label section-label--objtest">评估深度结论</h3>
        ${renderAlignedCopyBlock(tier.description)}
      </section>
      <section class="result-section result-section--objtest">
        <h3 class="section-label section-label--objtest">心理状态解析</h3>
        ${renderAlignedCopyBlock(tier.psychState)}
      </section>
      <section class="result-section result-section--objtest result-section--divided">
        <h3 class="section-label section-label--objtest">觉醒建议</h3>
        ${renderAlignedCopyBlock(tier.advice)}
      </section>
    </div>
  `;
}

/* ==============================
   Shared Utilities
   ============================== */
function openImageModal(src) {
  let modal = document.getElementById('image-modal');
  let modalImg = document.getElementById('modal-img');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'image-modal';
    modal.className = 'image-modal';
    modal.innerHTML = '<img id="modal-img" src="" alt="Preview image"><div class="modal-close">Close</div>';
    modal.onclick = closeImageModal;
    document.body.appendChild(modal);
    modalImg = document.getElementById('modal-img');
  }

  modalImg.src = src;
  modal.style.display = 'flex';
  setTimeout(() => {
    modal.style.opacity = '1';
    modal.classList.add('show-img');
  }, 10);
}

function closeImageModal() {
  const modal = document.getElementById('image-modal');
  if (!modal) return;

  modal.style.opacity = '0';
  modal.classList.remove('show-img');
  setTimeout(() => {
    modal.style.display = 'none';
  }, 300);
}

function animateMeter(fillId, value) {
  const fill = document.getElementById(fillId);
  const valueEl = document.getElementById(`${fillId}-val`);
  if (!fill || !valueEl) return;

  fill.style.width = `${value}%`;

  let current = 0;
  const step = value / 30;
  const timer = setInterval(() => {
    current += step;
    if (current >= value) {
      current = value;
      clearInterval(timer);
    }
    valueEl.textContent = `${Math.round(current)}%`;
  }, 30);
}

function restartTest() {
  window.location.reload();
}

/* ==============================
   Poster
   ============================== */
function shareResult() {
  showToast('正在生成分享海报，请稍候...');

  if (typeof html2canvas === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.crossOrigin = 'anonymous';
    script.onload = () => generatePoster();
    document.head.appendChild(script);
    return;
  }

  generatePoster();
}

function generatePoster() {
  const originalResult = document.querySelector('.result-content');
  if (!originalResult) {
    showToast('结果页尚未准备完成');
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:680px;background:#0a0a1a;padding:0;margin:0;z-index:-1;';

  const clone = originalResult.cloneNode(true);
  ['#comments-section', '.result-actions', '.result-comments-shell', '.modal-close'].forEach((selector) => {
    clone.querySelectorAll(selector).forEach((node) => node.remove());
  });

  clone.style.cssText = 'width:680px !important;max-width:680px !important;padding:50px 40px !important;margin:0 !important;box-sizing:border-box !important;background:#0a0a1a !important;display:block !important;';

  clone.querySelectorAll('.result-title').forEach((title) => {
    title.style.cssText = 'color:#ffffff !important;-webkit-text-fill-color:#ffffff !important;background:none !important;text-shadow:none !important;display:block !important;text-align:center !important;';
  });

  const wrapperInner = document.createElement('div');
  wrapperInner.style.cssText = 'background:#0a0a1a;padding:10px;';
  wrapperInner.appendChild(clone);
  wrapper.appendChild(wrapperInner);
  document.body.appendChild(wrapper);

  const showPosterOverlay = (imgData) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);backdrop-filter:blur(10px);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity 0.3s;';

    const img = document.createElement('img');
    img.src = imgData;
    img.style.cssText = 'max-width:90%;max-height:75vh;border-radius:12px;box-shadow:0 0 40px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);';

    const hint = document.createElement('p');
    hint.textContent = '长按图片保存或转发';
    hint.style.cssText = 'color:rgba(255,255,255,0.72);margin-top:14px;font-size:13px;letter-spacing:0.08em;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '关闭海报';
    closeBtn.style.cssText = 'margin-top:18px;padding:10px 30px;background:white;color:black;border:none;border-radius:25px;font-weight:700;';
    closeBtn.onclick = () => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    };

    overlay.append(img, hint, closeBtn);
    document.body.appendChild(overlay);
    setTimeout(() => {
      overlay.style.opacity = '1';
    }, 50);
    showToast('海报已生成，长按图片保存');
  };

  const cleanUpWrapper = () => {
    if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
  };

  const doCapture = () => {
    html2canvas(wrapperInner, {
      backgroundColor: '#0a0a1a',
      scale: 2,
      useCORS: true,
      allowTaint: false,
      width: 680,
      windowWidth: 680
    }).then((canvas) => {
      cleanUpWrapper();
      showPosterOverlay(canvas.toDataURL('image/png'));
    }).catch((err) => {
      cleanUpWrapper();
      console.error('Poster capture failed:', err);
      showToast('海报生成失败，请重试');
    });
  };

  const image = clone.querySelector('#character-img');
  if (image && image.src && !image.src.startsWith('data:')) {
    const preloadImage = new Image();
    preloadImage.crossOrigin = 'anonymous';
    preloadImage.src = `${image.src.split('?')[0]}?t=${Date.now()}`;
    preloadImage.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = preloadImage.naturalWidth;
      canvas.height = preloadImage.naturalHeight;
      canvas.getContext('2d').drawImage(preloadImage, 0, 0);
      try {
        image.src = canvas.toDataURL('image/png');
      } catch (err) {
        console.warn('Image serialization skipped:', err);
      }
      setTimeout(doCapture, 180);
    };
    preloadImage.onerror = () => doCapture();
    return;
  }

  setTimeout(doCapture, 180);
}

/* ==============================
   Keyboard Shortcuts
   ============================== */
document.addEventListener('keydown', (event) => {
  const quizPage = document.getElementById('quiz');
  if (!quizPage || !quizPage.classList.contains('active')) return;

  const question = questions[currentQuestion];
  if (!question) return;

  const key = event.key.toUpperCase();
  let optionIndex = -1;

  if (/^[1-4]$/.test(event.key)) {
    optionIndex = Number(event.key) - 1;
  } else if (/^[A-D]$/.test(key)) {
    optionIndex = key.charCodeAt(0) - 65;
  }

  if (optionIndex >= 0 && optionIndex < question.options.length) {
    event.preventDefault();
    selectOption(optionIndex);
    return;
  }

  if (event.key === 'ArrowRight' || event.key === 'Enter') {
    event.preventDefault();
    nextQuestion();
    return;
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    prevQuestion();
  }
});

/* ==============================
   Boot
   ============================== */
document.addEventListener('DOMContentLoaded', () => {
  loadParticipantCount();

  if (new URLSearchParams(window.location.search).get('start') === 'true') {
    setTimeout(startTest, 500);
  }
});
