/* ==============================
   Shared Test Framework Core
   ============================== */

let currentQuestion = 0;
let answers = {};  // { questionId: selectedOptionIndex }
let scores = {};   // { personalityKey: totalScore } OR 'total' for aggregate tests
const RESULT_VIEW_TABLE = 'result_views';

// 获取 Supabase 客户端
function getAppSupabaseClient() {
  if (window.supabaseClient && typeof window.supabaseClient.from === 'function') return window.supabaseClient;
  if (window.db && typeof window.db.from === 'function') return window.db;
  if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') return supabase;
  return null;
}

// 获取页面类型 (soullab / objtest)
function getPageType() {
  const container = document.getElementById('comments-section');
  return container?.getAttribute('data-page') || 'soullab';
}

// 获取显示昵称
function getDisplayNickname() {
  return (typeof currentProfile !== 'undefined' ? currentProfile?.nickname : '')
    || (typeof currentUser !== 'undefined' ? currentUser?.user_metadata?.nickname : '')
    || (typeof currentUser !== 'undefined' ? currentUser?.email : '')
    || '';
}

/* ==============================
   Participant Count Logic
   ============================== */
function renderParticipantCount(element, count) {
  if (!element) return;
  const safeCount = Number.isFinite(Number(count)) ? Math.max(0, Math.floor(Number(count))) : 0;
  element.innerHTML = `已有 <span class="participant-number">${safeCount}</span> 人参与测试`;
}

async function loadParticipantCount() {
  const client = getAppSupabaseClient();
  const pageType = getPageType();
  const countElId = `${pageType}-participant-count`;
  const countEl = document.getElementById(countElId);
  if (!client || !countEl) return;

  try {
    let count = 0;
    const resultViewRes = await client
      .from(RESULT_VIEW_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('page_type', pageType);

    if (resultViewRes.error) {
      const commentRes = await client
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('page_type', pageType);
      if (commentRes.error) throw commentRes.error;
      count = commentRes.count || 0;
    } else {
      count = resultViewRes.count || 0;
    }
    renderParticipantCount(countEl, count);
  } catch (err) {
    console.error('加载参与人数失败:', err);
  }
}

async function trackResultView() {
  const client = getAppSupabaseClient();
  const pageType = getPageType();
  if (!client) return;
  try {
    await client.from(RESULT_VIEW_TABLE).insert({ page_type: pageType });
    loadParticipantCount();
  } catch (err) {
    console.error('记录结果浏览失败:', err);
  }
}

/* ==============================
   Page Management
   ============================== */
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
    page.style.display = 'none';
  });
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.style.display = (pageId === 'quiz' || pageId === 'loading') ? 'flex' : 'block';
    // 强制重绘
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
   Quiz Core Logic
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
  if (!container) return;

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
  answers[q.id] = idx;

  const options = document.querySelectorAll('.option');
  options.forEach(opt => opt.classList.remove('selected'));
  options[idx].classList.add('selected');

  setTimeout(() => {
    if (currentQuestion < questions.length - 1) {
      currentQuestion++;
      renderQuestion();
    } else {
      calculateResult();
    }
  }, 400);
}

function prevQuestion() {
  if (currentQuestion > 0) {
    currentQuestion--;
    renderQuestion();
  }
}

function nextQuestion() {
  if (currentQuestion < questions.length - 1) {
    currentQuestion++;
    renderQuestion();
  } else if (answers[questions[currentQuestion].id] !== undefined) {
    calculateResult();
  }
}

function updateProgress() {
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const bar = document.getElementById('progress-bar');
  const currentQ = document.getElementById('current-q');
  const totalQ = document.getElementById('total-q');

  if (bar) bar.style.width = `${progress}%`;
  if (currentQ) currentQ.textContent = currentQuestion + 1;
  if (totalQ) totalQ.textContent = questions.length;
}

/* ==============================
   Result Calculation
   ============================== */
async function calculateResult() {
  const pageType = getPageType();
  showPage('loading');

  // 模拟计算进度
  const progressTitle = document.querySelector('.loading-title');
  const messages = pageType === 'soullab'
    ? ["分析潜意识流...", "解构现实编码...", "生成觉醒画像..."]
    : ["正在收集数据...", "分析认知偏差...", "评估主体状态...", "生成系统结论..."];

  let i = 0;
  const interval = setInterval(() => {
    if (progressTitle && messages[i]) progressTitle.textContent = messages[i];
    i++;
    if (i >= messages.length) clearInterval(interval);
  }, 800);

  // 计算分数
  if (pageType === 'soullab') {
    // 维度计算逻辑
    scores = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
    questions.forEach(q => {
      const selectedIdx = answers[q.id];
      if (selectedIdx !== undefined) {
        const optionScores = q.options[selectedIdx].scores;
        for (let key in optionScores) {
          scores[key] = (scores[key] || 0) + optionScores[key];
        }
      }
    });

    // 映射逻辑：将维度组合映射到 12 种预定义人格
    const personalityMapping = {
      'mask': (s) => s.E >= s.I && s.J >= s.P,
      'hoard': (s) => s.I >= s.E && s.T >= s.F && s.J >= s.P,
      'escape': (s) => s.I >= s.E && s.F >= s.T && s.P >= s.J,
      'rebel': (s) => s.E >= s.I && s.P >= s.J && s.T >= s.F,
      'edge': (s) => s.I >= s.E && s.F >= s.T && s.J >= s.P,
      'crash': (s) => s.N >= s.S && s.P >= s.J && s.F >= s.T,
      'chill': (s) => s.I >= s.E && s.S >= s.N && s.P >= s.J,
      'clown': (s) => s.E >= s.I && s.S >= s.N && s.P >= s.J,
      'mama': (s) => s.E >= s.I && s.F >= s.T && s.J >= s.P,
      'hustle': (s) => s.S >= s.N && s.T >= s.F && s.J >= s.P,
      'chaos': (s) => s.E >= s.I && s.P >= s.J && s.S >= s.N,
      'awake': (s) => s.N >= s.S && s.P >= s.J && s.T >= s.F
    };

    let resultKey = 'edge'; // 默认值
    for (const [key, check] of Object.entries(personalityMapping)) {
      if (check(scores)) {
        resultKey = key;
        break;
      }
    }

    setTimeout(() => finalizeResult(resultKey), 3500);
  } else {
    // 总分累计逻辑 (ObjTest)
    let totalScore = 0;
    questions.forEach(q => {
      const selectedIdx = answers[q.id];
      if (selectedIdx !== undefined) {
        totalScore += (q.options[selectedIdx].score || 0);
      }
    });
    setTimeout(() => finalizeResult(totalScore), 3500);
  }
}

function finalizeResult(resultValue) {
  const pageType = getPageType();
  showPage('result');
  trackResultView();

  if (pageType === 'soullab') {
    displaySoulLabResult(resultValue);
  } else {
    displayObjTestResult(resultValue);
  }

  // 初始化评论区
  if (window.initComments) {
    window.initComments();
  }
}

/* ==============================
   UI Helpers
   ============================== */
// 人格测试详情展示
function displaySoulLabResult(type) {
  const dataStore = (typeof personalities !== 'undefined') ? personalities : (typeof personalityTypes !== 'undefined' ? personalityTypes : {});
  const p = dataStore[type];
  
  if (!p) {
    console.error('未找到人格数据:', type);
    return;
  }

  const titleEl = document.getElementById('result-title');
  if (!titleEl) {
    renderDynamicSoulLab(p, type);
    return;
  }

  const nickname = getDisplayNickname();
  const typeLabel = document.getElementById('result-type-label');
  if (typeLabel) {
    typeLabel.textContent = nickname ? `${nickname}的人格` : '你的人格类型是';
  }

  document.getElementById('result-badge').textContent = p.emoji || '🎭';
  document.getElementById('result-title').textContent = p.name;
  document.getElementById('result-subtitle').textContent = p.subtitle || p.tagline || '';
  document.getElementById('result-description').innerHTML = p.description;
  document.getElementById('result-quote').textContent = p.quote || '';
  document.getElementById('result-mbti').innerHTML = p.mbti || '';

  const charImg = document.getElementById('character-img');
  if (charImg && p.image) {
    charImg.src = p.image + "?t=" + new Date().getTime();
    charImg.alt = p.name;
    // 增加大图点击事件
    charImg.style.cursor = 'zoom-in';
    charImg.onclick = () => openImageModal(charImg.src);
  }

  const tagsContainer = document.getElementById('result-tags');
  if (tagsContainer) {
    const tags = p.tags || (p.traits ? [...p.traits, ...(p.weaknesses || [])] : []);
    tagsContainer.innerHTML = tags.map(t => `<span class="result-tag">#${t}</span>`).join('');
  }

  setTimeout(() => {
    if (p.meters) {
       animateMeter('meter-mask', p.meters.mask || 50);
       animateMeter('meter-awake', p.meters.awake || 50);
       animateMeter('meter-chill', p.meters.chill || 50);
       animateMeter('meter-drama', p.meters.drama || 50);
    }
  }, 300);
}

// 客体化测试详情展示
function displayObjTestResult(score) {
  const tier = resultTiers.find(t => score >= t.minScore && score <= t.maxScore) || resultTiers[0];
  const resContainer = document.getElementById('result-display');
  if (!resContainer) return;

  resContainer.innerHTML = `
    <div class="result-content">
      <div class="result-header" style="text-align: center; margin-bottom: 40px;">
        <div class="result-score-circle" style="width:110px; height:110px; border-radius:50%; border:3px solid ${tier.color}; display:inline-flex; align-items:center; justify-content:center; font-size:3rem; font-weight:800; color:${tier.color}; margin:0 auto 20px; font-family:var(--font-display); box-shadow: 0 0 30px ${tier.color}33;">${score}</div>
        <div class="result-type-label" style="opacity: 0.6;">ASSESSMENT CONCLUSION</div>
        <div class="result-title-group">
           <h2 class="result-title" style="color: #ffffff; -webkit-text-fill-color: #ffffff; text-shadow: 0 4px 15px rgba(0,0,0,0.5);">${tier.title}</h2>
        </div>
      </div>

      <div class="result-description" style="text-align: center; line-height: 2; margin-bottom: 35px; background: rgba(255,255,255,0.02); padding: 25px; border-radius: var(--radius-lg); border: 1px solid rgba(255,255,255,0.08); box-shadow: inset 0 0 20px rgba(255,255,255,0.02);">
        <div style="font-size: 0.75rem; color: var(--accent-1); text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 12px; opacity: 0.8;">评估深度结论</div>
        <p style="margin:0; font-size: 1rem; color: var(--text-secondary);">${tier.description}</p>
      </div>

      <div class="result-section" style="margin-bottom: 30px;">
        <h3 class="section-label" style="text-align: center; margin-bottom: 15px;">心理状态解析</h3>
        <p style="text-align: center; font-size: 0.95rem; line-height: 1.8; color: var(--text-secondary);">${tier.psychState}</p>
      </div>

      <div class="result-section" style="margin-bottom: 30px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 30px;">
        <h3 class="section-label" style="text-align: center; margin-bottom: 15px;">觉醒建议</h3>
        <div style="text-align: center; font-size: 0.95rem; line-height: 1.8; color: var(--text-secondary); max-width: 90%; margin: 0 auto;">${tier.advice}</div>
      </div>
    </div>
  `;
}

function openImageModal(src) {
  let modal = document.getElementById('image-modal');
  let modalImg = document.getElementById('modal-img');
  
  if (!modal) {
    // 动态创建蒙层
    modal = document.createElement('div');
    modal.id = 'image-modal';
    modal.className = 'image-modal';
    modal.innerHTML = '<img id="modal-img" src="" alt="大图" /><div class="modal-close">✕ 关闭</div>';
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
  const valEl = document.getElementById(fillId + '-val');
  if (!fill || !valEl) return;
  fill.style.width = value + '%';

  let current = 0;
  const step = value / 30;
  const timer = setInterval(() => {
    current += step;
    if (current >= value) {
      current = value;
      clearInterval(timer);
    }
    valEl.textContent = Math.round(current) + '%';
  }, 30);
}

function restartTest() {
  window.location.reload();
}

function shareResult() {
  if (typeof showToast === 'function') showToast('正在生成专属海报，请稍候...');

  if (typeof html2canvas === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => generatePoster();
    document.head.appendChild(script);
  } else {
    generatePoster();
  }
}

function generatePoster() {
  const originalResult = document.querySelector('.result-content');
  if (!originalResult) {
    if (typeof showToast === 'function') showToast('未找到结果内容，请稍后再试');
    return;
  }

  // 创建离屏包装器
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:680px;background:#0a0a1a;padding:0;margin:0;z-index:-1;';

  const clone = originalResult.cloneNode(true);

  // 移除按钮和评论区
  ['#comments-section', '.result-actions', '.result-comments-shell'].forEach(sel => {
    const el = clone.querySelector(sel);
    if (el) el.remove();
  });

  // 固定宽度
  clone.style.cssText = 'width:680px;max-width:680px;padding:40px 30px;margin:0;box-sizing:border-box;background:#0a0a1a;';

  // 确保标题颜色在截图中可见（针对 -webkit-text-fill-color 的兼容）
  const titleEl = clone.querySelector('.result-title');
  if (titleEl) {
    titleEl.style.cssText = 'color:#ffffff;-webkit-text-fill-color:#ffffff;background:none;text-shadow:none;';
  }

  const imgEl = clone.querySelector('#character-img');

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  const doCapture = (scale = 2) => {
    html2canvas(wrapper, {
      backgroundColor: '#0a0a1a',
      scale,
      useCORS: true,
      allowTaint: false,
      imageTimeout: 15000,
      width: 680,
      windowWidth: 680,
      logging: false
    }).then(canvas => {
      document.body.removeChild(wrapper);
      const imgData = canvas.toDataURL('image/png');

      // 创建展示蒙层
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.88);backdrop-filter:blur(6px);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity 0.3s;';

      const hint = document.createElement('p');
      hint.textContent = '长按图片保存，分享给朋友 ✨';
      hint.style.cssText = 'color:rgba(255,255,255,0.85);margin-bottom:14px;font-size:14px;letter-spacing:1px;';

      const img = document.createElement('img');
      img.src = imgData;
      img.style.cssText = 'max-width:90%;max-height:72vh;border-radius:14px;box-shadow:0 0 50px rgba(138,43,226,0.35);border:1px solid rgba(255,255,255,0.08);object-fit:contain;';

      const closeBtn = document.createElement('button');
      closeBtn.textContent = '✕ 关闭';
      closeBtn.style.cssText = 'margin-top:18px;padding:9px 26px;background:rgba(255,255,255,0.08);color:white;border:1px solid rgba(255,255,255,0.18);border-radius:20px;cursor:pointer;font-size:14px;transition:background 0.2s;';
      closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255,255,255,0.18)';
      closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(255,255,255,0.08)';
      closeBtn.onclick = () => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 300); };

      overlay.append(hint, img, closeBtn);
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.style.opacity = '1');
      if (typeof showToast === 'function') showToast('海报生成完毕！');

    }).catch(err => {
      if (scale > 1.2) {
        doCapture(1.2);
        return;
      }
      if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
      console.error('海报生成失败:', err);
      if (typeof showToast === 'function') showToast('生成失败，请重试或直接截图 📸');
    });
  };

  // 预加载角色图以防跨域污染
  if (imgEl && imgEl.src && !imgEl.src.startsWith('data:')) {
    const preload = new Image();
    preload.crossOrigin = 'anonymous';
    preload.onload = () => {
      const c = document.createElement('canvas');
      c.width = preload.naturalWidth; c.height = preload.naturalHeight;
      c.getContext('2d').drawImage(preload, 0, 0);
      try { imgEl.src = c.toDataURL('image/png'); } catch (e) {}
      doCapture();
    };
    preload.onerror = doCapture;
    preload.src = imgEl.src.split('?')[0] + '?t=' + Date.now();
  } else {
    doCapture();
  }
}

function getDisplayNickname() {
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.user_metadata) {
        return currentUser.user_metadata.nickname || '你';
    }
    return '';
}

// 通用初始化
document.addEventListener('DOMContentLoaded', () => {
    // 背景粒子
    const canvas = document.getElementById('particles-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let particles = [];
        function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        resize();
        window.addEventListener('resize', resize);
        class Particle {
            constructor() { this.reset(); }
            reset() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 2 + 0.5;
                this.speedX = (Math.random() - 0.5) * 0.3;
                this.speedY = (Math.random() - 0.5) * 0.3;
                this.opacity = Math.random() * 0.5 + 0.1;
                this.hue = 250 + Math.random() * 60;
            }
            update() {
                this.x += this.speedX; this.y += this.speedY;
                if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
            }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${this.hue}, 70%, 70%, ${this.opacity})`;
                ctx.fill();
            }
        }
        for (let i = 0; i < 60; i++) particles.push(new Particle());
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => { p.update(); p.draw(); });
            requestAnimationFrame(animate);
        }
        animate();
    }
    
    // 初始加载参与人数
    loadParticipantCount();

    // 检查是否自动开始
    if (new URLSearchParams(window.location.search).get('start') === 'true') {
        setTimeout(startTest, 500);
    }

    // 键盘支持
    window.addEventListener('keydown', (e) => {
        const quizPage = document.getElementById('quiz');
        if (!quizPage || !quizPage.classList.contains('active')) return;
        const key = e.key.toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(key)) {
            const index = key.charCodeAt(0) - 65;
            if (questions[currentQuestion].options[index]) selectOption(index);
        }
        if (['1', '2', '3', '4'].includes(key)) {
            const index = parseInt(key) - 1;
            if (questions[currentQuestion].options[index]) selectOption(index);
        }
        if (key === 'ARROWLEFT' || key === 'BACKSPACE') prevQuestion();
        if (key === 'ENTER' && answers[questions[currentQuestion].id] !== undefined) nextQuestion();
    });
});
