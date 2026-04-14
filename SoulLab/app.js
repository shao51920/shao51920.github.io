/* ==============================
   App State
   ============================== */
let currentQuestion = 0;
let answers = {};  // { questionId: selectedOptionIndex }
let scores = {};   // { personalityKey: totalScore }

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
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.style.animation = '';
  });
  const page = document.getElementById(pageId);
  page.classList.add('active');
  page.style.animation = 'fadeSlideIn 0.6s ease forwards';
  window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Animate out
  container.style.animation = 'fadeSlideOut 0.2s ease forwards';

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

  // Auto advance after short delay
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
}

function animateMeter(fillId, value) {
  const fill = document.getElementById(fillId);
  const valEl = document.getElementById(fillId + '-val');
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
  
  // 终极杀招：通过离屏克隆节点彻底剥离手机端的屏幕宽度限制
  const wrapper = document.createElement('div');
  wrapper.style.position = 'absolute';
  wrapper.style.left = '-9999px';
  wrapper.style.top = '0';
  wrapper.style.width = '680px';
  wrapper.style.background = '#0a0a1a'; // 完全匹配主背景色
  
  const clone = originalResult.cloneNode(true);
  
  // 移除海报里的操作按钮
  const actionsClone = clone.querySelector('.result-actions');
  if (actionsClone) {
    actionsClone.parentNode.removeChild(actionsClone);
  }
  
  // 覆盖克隆体的样式以确保排版绝对宽敞
  clone.style.width = '680px';
  clone.style.maxWidth = '680px';
  clone.style.padding = '40px 30px';
  clone.style.margin = '0';
  
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  html2canvas(wrapper, {
    backgroundColor: '#0a0a1a',
    scale: 2,
    useCORS: true,
    width: 680,
    windowWidth: 680
  }).then(canvas => {
    // 渲染完毕后立即销毁克隆体
    document.body.removeChild(wrapper);
    
    const imgData = canvas.toDataURL('image/png');
    
    // 创建全屏蒙层显示生成的图片（为了兼容手机长按保存）
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);backdrop-filter:blur(5px);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity 0.3s;';
    
    const hint = document.createElement('div');
    hint.textContent = '长按图片保存或发送给朋友';
    hint.style.cssText = 'color:rgba(255,255,255,0.9);margin-bottom:15px;font-size:15px;letter-spacing:1px;font-weight:300;';
    
    const img = document.createElement('img');
    img.src = imgData;
    img.style.cssText = 'max-width:90%;max-height:75vh;border-radius:12px;box-shadow:0 0 40px rgba(138, 43, 226, 0.3); border: 1px solid rgba(255,255,255,0.1); object-fit:contain;';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ 关闭海报';
    closeBtn.style.cssText = 'margin-top:20px;padding:10px 24px;background:rgba(255,255,255,0.1);color:white;border:1px solid rgba(255,255,255,0.2);border-radius:20px;cursor:pointer;font-size:14px;transition:all 0.2s;';
    closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255,255,255,0.2)';
    closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(255,255,255,0.1)';
    closeBtn.onclick = () => {
      overlay.style.opacity = '0';
      setTimeout(() => document.body.removeChild(overlay), 300);
    };
    
    overlay.appendChild(hint);
    overlay.appendChild(img);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
    
    // 淡入效果
    requestAnimationFrame(() => overlay.style.opacity = '1');
    showToast('海报生成完毕！');
    
  }).catch(err => {
    console.error(err);
    actions.style.display = 'flex';
    showToast('海报生成失败，请尝试直接手机截图');
  });
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ==============================
   Keyboard Navigation
   ============================== */
document.addEventListener('keydown', (e) => {
  const quizPage = document.getElementById('quiz');
  if (!quizPage.classList.contains('active')) return;

  const q = questions[currentQuestion];
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
