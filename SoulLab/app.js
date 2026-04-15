/* ==============================
   App State
   ============================== */
let currentQuestion = 0;
let answers = {};  // { questionId: selectedOptionIndex }
let scores = {};   // { personalityKey: totalScore }

/* ==============================
   Load Participant Count
   ============================== */
async function loadParticipantCount() {
  try {
    const { count, error } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('page_type', 'soullab');

    if (error) throw error;

    const countEl = document.getElementById('soullab-participant-count');
    if (countEl) {
      countEl.textContent = `已有 ${count || 0} 人参与测试`;
    }
  } catch (err) {
    console.error('加载参与人数失败:', err);
    const countEl = document.getElementById('soullab-participant-count');
    if (countEl) {
      countEl.textContent = '参与人数统计暂不可用';
    }
  }
}

// 页面加载时获取参与人数
if (typeof supabase !== 'undefined') {
  document.addEventListener('DOMContentLoaded', loadParticipantCount);
}

/* ==============================
   Particles Background
   ============================== */
(function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  const PARTICLE_COUNT = 60;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  class Particle {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 2 + 0.5;
      this.speedX = (Math.random() - 0.5) * 0.3;
      this.speedY = (Math.random() - 0.5) * 0.3;
      this.opacity = Math.random() * 0.5 + 0.1;
      this.hue = 250 + Math.random() * 60; // Purple to pink range
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
        this.reset();
      }
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${this.hue}, 70%, 70%, ${this.opacity})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(new Particle());
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `hsla(260, 60%, 65%, ${0.08 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(animate);
  }
  animate();
})();

/* ==============================
   Navigation
   ============================== */
function showPage(pageId) {
  const pages = document.querySelectorAll('.page');
  pages.forEach(page => page.classList.remove('active'));

  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.add('active');
  }

  // 更新 body class 用于 CSS 控制按钮显隐
  document.body.classList.remove('landing-active', 'result-active');
  if (pageId === 'landing') document.body.classList.add('landing-active');
  if (pageId === 'result') document.body.classList.add('result-active');

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (pageId === 'quiz') {
    if (typeof startTimer === 'function') startTimer();
  }
}

/* ==============================
   Start Test
   ============================== */
function startTest() {
  currentQuestion = 0;
  answers = {};
  scores = {};
  showPage('quiz');
  renderQuestion();
}

/* ==============================
   Render Question
   ============================== */
function renderQuestion() {
  const q = questions[currentQuestion];
  const container = document.getElementById('question-container');

  // 第一题无需淡出动画（容器为空），直接渲染以避免闪烁
  const isEmpty = !container.querySelector('.option');
  if (!isEmpty) {
    container.style.animation = 'fadeSlideOut 0.2s ease forwards';
  }

  setTimeout(() => {
    document.getElementById('q-number').textContent = `Q${q.id}`;
    document.getElementById('q-text').textContent = q.text;
    document.getElementById('current-q').textContent = q.id;
    document.getElementById('total-q').textContent = questions.length;

    // Progress bar
    const progress = ((currentQuestion) / questions.length) * 100;
    document.getElementById('progress-bar').style.width = progress + '%';

    // Options
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';

    q.options.forEach((opt, idx) => {
      const optEl = document.createElement('div');
      optEl.className = 'option' + (answers[q.id] === idx ? ' selected' : '');
      optEl.onclick = () => selectOption(q.id, idx);
      optEl.innerHTML = `
        <div class="option-indicator"></div>
        <span class="option-label">${opt.label}.</span>
        <span class="option-text">${opt.text}</span>
      `;
      optionsContainer.appendChild(optEl);
    });

    // Buttons
    document.getElementById('prev-btn').disabled = currentQuestion === 0;
    updateNextButton();

    container.style.animation = 'fadeSlideIn 0.4s ease forwards';
  }, 200);
}

/* ==============================
   Select Option
   ============================== */
function selectOption(questionId, optionIndex) {
  answers[questionId] = optionIndex;

  // Update visual
  const options = document.querySelectorAll('.option');
  options.forEach((opt, idx) => {
    opt.classList.toggle('selected', idx === optionIndex);
  });

  updateNextButton();

  // Auto advance after short delay (only if not the last question)
  setTimeout(() => {
    if (currentQuestion < questions.length - 1) {
      nextQuestion();
    }
  }, 400);
}

function updateNextButton() {
  const q = questions[currentQuestion];
  const nextBtn = document.getElementById('next-btn');
  const hasAnswer = answers[q.id] !== undefined;
  nextBtn.disabled = !hasAnswer;

  if (currentQuestion === questions.length - 1 && hasAnswer) {
    nextBtn.innerHTML = `
      查看结果
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14M12 5l7 7-7 7"/>
      </svg>
    `;
  }
}

/* ==============================
   Navigation Controls
   ============================== */
function nextQuestion() {
  const q = questions[currentQuestion];
  if (answers[q.id] === undefined) return;

  // 防止按钮点击触发默认行为
  if (event) event.preventDefault();

  if (currentQuestion < questions.length - 1) {
    currentQuestion++;
    renderQuestion();
  } else {
    // Last question -> calculate result
    showLoading();
  }
}

function prevQuestion() {
  if (currentQuestion > 0) {
    currentQuestion--;
    renderQuestion();
  }
}

/* ==============================
   Loading & Results
   ============================== */
function showLoading() {
  showPage('loading');

  const loadingTexts = [
    "正在剥离你的社会面具...",
    "扫描你的灵魂防御机制...",
    "分析你的内心戏密度...",
    "量化你的摆烂指数...",
    "匹配你的人间角色...",
    "解码完成！"
  ];

  let idx = 0;
  const loadingSub = document.getElementById('loading-sub');
  const interval = setInterval(() => {
    idx++;
    if (idx < loadingTexts.length) {
      loadingSub.textContent = loadingTexts[idx];
    }
    if (idx >= loadingTexts.length - 1) {
      clearInterval(interval);
    }
  }, 600);

  setTimeout(() => {
    calculateResult();
    showResult();
  }, 3600);
}

function calculateResult() {
  // Initialize scores
  scores = {};
  Object.keys(personalities).forEach(key => {
    scores[key] = 0;
  });

  // Tally scores from answers
  questions.forEach(q => {
    const answerIdx = answers[q.id];
    if (answerIdx !== undefined) {
      const selectedOption = q.options[answerIdx];
      Object.entries(selectedOption.scores).forEach(([key, value]) => {
        scores[key] = (scores[key] || 0) + value;
      });
    }
  });
}

function showResult() {
  // Find personality with highest score
  let maxKey = 'chill';
  let maxScore = 0;
  Object.entries(scores).forEach(([key, score]) => {
    if (score > maxScore) {
      maxScore = score;
      maxKey = key;
    }
  });

  const p = personalities[maxKey];

  // Populate result page
  document.getElementById('result-badge').textContent = p.emoji;
  document.getElementById('result-title').textContent = p.name;
  document.getElementById('result-subtitle').textContent = p.subtitle;
  document.getElementById('result-description').innerHTML = p.description;
  document.getElementById('result-quote').textContent = p.quote;
  document.getElementById('result-mbti').innerHTML = p.mbti;

  // Character image (with cache buster)
  const charImg = document.getElementById('character-img');
  charImg.src = p.image + "?t=" + new Date().getTime();
  charImg.alt = p.name + ' — 人格角色形象';
  charImg.onclick = () => openImageModal(charImg.src);

  // Tags
  const tagsContainer = document.getElementById('result-tags');
  tagsContainer.innerHTML = p.tags.map(t => `<span class="result-tag">#${t}</span>`).join('');

  // Show result page
  showPage('result');

  // Animate meters with delay
  setTimeout(() => {
    animateMeter('meter-mask', p.meters.mask);
    animateMeter('meter-awake', p.meters.awake);
    animateMeter('meter-chill', p.meters.chill);
    animateMeter('meter-drama', p.meters.drama);
  }, 300);

  // 初始化评论区
  setTimeout(() => {
    if (typeof initComments === 'function') initComments();
  }, 500);
}

function animateMeter(fillId, value) {
  const fill = document.getElementById(fillId);
  const valEl = document.getElementById(fillId + '-val');
  if (!fill || !valEl) return;
  fill.style.width = value + '%';

  // Animate number count up
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

/* ==============================
   Restart & Share
   ============================== */
function restartTest() {
  showPage('landing');
}

function shareResult() {
  showToast('正在生成专属海报，请稍候...');

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
    showToast('结果页未找到，请稍后再试');
    return;
  }

  // 克隆到离屏容器
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:680px;background:#0a0a1a;padding:0;margin:0;z-index:-1;';

  const clone = originalResult.cloneNode(true);

  // 移除评论区、操作按钮
  ['#comments-section', '.result-actions'].forEach(sel => {
    const el = clone.querySelector(sel);
    if (el) el.remove();
  });

  // 固定克隆体宽度
  clone.style.cssText = 'width:680px;max-width:680px;padding:40px 30px;margin:0;box-sizing:border-box;';

  // 解决 result-title（-webkit-text-fill-color 透明导致截图白字不显示）问题
  const titleEl = clone.querySelector('.result-title');
  if (titleEl) {
    titleEl.style.cssText = 'color:#fff;-webkit-text-fill-color:#fff;background:none;-webkit-background-clip:unset;background-clip:unset;';
  }

  // 将 character-img 的 src 替换为 crossOrigin 加载的 dataURL 以避免污染
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

      // 蒙层展示
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
      showToast('海报生成完毕！');

    }).catch(err => {
      if (scale > 1.2) {
        doCapture(1.2);
        return;
      }
      if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
      console.error('海报生成失败:', err);
      showToast('生成失败，请重试或直接截图保存 📸');
    });
  };

  // 如果角色图片存在，预加载后再截图
  if (imgEl && imgEl.src && !imgEl.src.startsWith('data:')) {
    const preload = new Image();
    preload.crossOrigin = 'anonymous';
    preload.onload = () => {
      // 把图片转为 dataURL 写回克隆体，避免 taint
      const c = document.createElement('canvas');
      c.width = preload.naturalWidth; c.height = preload.naturalHeight;
      c.getContext('2d').drawImage(preload, 0, 0);
      try { imgEl.src = c.toDataURL('image/png'); } catch (e) { /* 跨域时跳过 */ }
      doCapture();
    };
    preload.onerror = doCapture; // 加载失败也继续截图
    preload.src = imgEl.src.split('?')[0] + '?t=' + Date.now();
  } else {
    doCapture();
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ==============================
   Keyboard Navigation
   ============================== */
document.addEventListener('keydown', (e) => {
  const quizPage = document.getElementById('quiz');
  if (!quizPage || !quizPage.classList.contains('active')) return;

  const q = questions[currentQuestion];
  if (!q) return;
  const key = e.key.toUpperCase();
  const optionLabels = q.options.map(o => o.label);
  const idx = optionLabels.indexOf(key);

  if (idx !== -1) {
    selectOption(q.id, idx);
  } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
    if (answers[q.id] !== undefined) nextQuestion();
  } else if (e.key === 'ArrowLeft') {
    prevQuestion();
  }
});

/* ==============================
   Image Modal Lightbox
   ============================== */
function openImageModal(src) {
  const modal = document.getElementById('image-modal');
  const modalImg = document.getElementById('modal-img');
  if (!modal || !modalImg) return;
  modalImg.src = src;
  modal.classList.add('active');
  // Trigger animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      modal.style.opacity = '1';
      modal.classList.add('show-img');
    });
  });
}

function closeImageModal() {
  const modal = document.getElementById('image-modal');
  if (!modal) return;
  modal.style.opacity = '0';
  modal.classList.remove('show-img');
  setTimeout(() => {
    modal.classList.remove('active');
  }, 300);
}
// 监听 URL 参数判断是否直接开始
window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('start') === 'true') {
    startTest();
  }
});
