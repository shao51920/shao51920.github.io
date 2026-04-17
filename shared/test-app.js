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
    ? ["正在连接星界...", "分析潜意识流...", "解构现实编码...", "生成觉醒画像..."]
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
    scores = { E:0, I:0, S:0, N:0, T:0, F:0, J:0, P:0 };
    questions.forEach(q => {
      const selectedIdx = answers[q.id];
      if (selectedIdx !== undefined) {
        const optionScores = q.options[selectedIdx].scores;
        for (let key in optionScores) {
          scores[key] = (scores[key] || 0) + optionScores[key];
        }
      }
    });
    const type = (scores.E >= scores.I ? 'E' : 'I') +
                 (scores.N >= scores.S ? 'N' : 'S') +
                 (scores.F >= scores.T ? 'F' : 'T') +
                 (scores.P >= scores.J ? 'P' : 'J');
    setTimeout(() => finalizeResult(type), 3500);
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
  // 兼容不同的变量命名
  const dataStore = (typeof personalities !== 'undefined') ? personalities : (typeof personalityTypes !== 'undefined' ? personalityTypes : {});
  const personality = dataStore[type];
  
  if (!personality) {
    console.error('未找到人格数据:', type);
    return;
  }

  const resContainer = document.getElementById('result-display');
  if (!resContainer) return;

  const tagline = personality.subtitle || personality.tagline || '';
  const tags = personality.tags || (personality.traits ? [...personality.traits, ...(personality.weaknesses || [])] : []);

  resContainer.innerHTML = `
    <div class="result-card">
      <div class="result-header">
        <div class="result-type-code">${type}</div>
        <h2 class="result-title">${personality.name}</h2>
        <div class="result-tagline">${tagline}</div>
      </div>
      
      <div class="result-section">
        <h3 class="section-label">深度侧写</h3>
        <p class="section-content">${personality.description}</p>
      </div>

      <div class="result-section">
        <h3 class="section-label">特质标签</h3>
        <div class="result-tags">
          ${tags.map(t => `<span class="result-tag">${t}</span>`).join('')}
        </div>
      </div>

      <div class="result-section quote-section">
        <p class="spiritual-quote">“ ${personality.quote} ”</p>
      </div>
      
      <div class="result-mbti">
         <span class="mbti-label">参考维度：</span>${personality.mbti || ''}
      </div>
    </div>
  `;
}

// 客体化测试详情展示
function displayObjTestResult(score) {
  const tier = resultTiers.find(t => score >= t.minScore && score <= t.maxScore) || resultTiers[0];
  const resContainer = document.getElementById('result-display');
  if (!resContainer) return;

  resContainer.innerHTML = `
    <div class="result-card">
      <div class="result-header">
        <div class="result-score-circle" style="border-color: ${tier.color}; color: ${tier.color}">${score}</div>
        <h2 class="result-title" style="color: ${tier.color}">${tier.title}</h2>
      </div>

      <div class="result-section">
        <h3 class="section-label">评估深度结论</h3>
        <div class="tier-desc">${tier.description}</div>
      </div>

      <div class="result-grid">
        <div class="result-section">
          <h3 class="section-label">心理状态解析</h3>
          <p class="section-content">${tier.psychState}</p>
        </div>
        <div class="result-section">
          <h3 class="section-label">觉醒建议</h3>
          <div class="tier-advice">${tier.advice}</div>
        </div>
      </div>
    </div>
  `;
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

    // 新增：键盘快捷键支持 (A, B, C, D / 1, 2, 3, 4)
    window.addEventListener('keydown', (e) => {
        // 仅在答题页生效
        const quizPage = document.getElementById('quiz');
        if (!quizPage || !quizPage.classList.contains('active')) return;

        const key = e.key.toUpperCase();
        
        // ABCD 映射
        if (['A', 'B', 'C', 'D'].includes(key)) {
            const index = key.charCodeAt(0) - 65;
            if (questions[currentQuestion].options[index]) {
                selectOption(index);
            }
        }
        
        // 数字键映射 (1, 2, 3, 4)
        if (['1', '2', '3', '4'].includes(key)) {
            const index = parseInt(key) - 1;
            if (questions[currentQuestion].options[index]) {
                selectOption(index);
            }
        }

        // 左右键/退格键返回
        if (key === 'ARROWLEFT' || key === 'BACKSPACE') {
            prevQuestion();
        }
        
        // 如果已经选了，按回车进下一题
        if (key === 'ENTER' && answers[questions[currentQuestion].id] !== undefined) {
          nextQuestion();
        }
    });
});
