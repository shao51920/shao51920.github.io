let currentQuestion = 0;
let answers = {};
let totalScore = 0;

/* ==============================
   Load Participant Count
   ============================== */
function getAppSupabaseClient() {
  if (window.supabaseClient && typeof window.supabaseClient.from === 'function') return window.supabaseClient;
  if (window.db && typeof window.db.from === 'function') return window.db;
  if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') return supabase;
  return null;
}

async function loadParticipantCount() {
  const client = getAppSupabaseClient();
  if (!client) return;

  try {
    const { count, error } = await client
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('page_type', 'objtest');
    
    if (error) throw error;
    
    const countEl = document.getElementById('objtest-participant-count');
    if (countEl) {
      countEl.textContent = `已有 ${count || 0} 人参与测试`;
    }
  } catch (err) {
    console.error('加载参与人数失败:', err);
    const countEl = document.getElementById('objtest-participant-count');
    if (countEl) {
      countEl.textContent = '参与人数统计暂不可用';
    }
  }
}

// 页面加载时获取参与人数
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadParticipantCount);
} else {
  loadParticipantCount();
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.add('active');
  }
  
  // 更新 body class 用于 CSS 控制按钮显隐
  document.body.classList.remove('landing-active', 'result-active');
  if (pageId === 'landing') document.body.classList.add('landing-active');
  if (pageId === 'result') document.body.classList.add('result-active');
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function startTest() {
  currentQuestion = 0;
  answers = {};
  totalScore = 0;
  showPage('quiz');
  renderQuestion();
}

function renderQuestion() {
  const q = questions[currentQuestion];
  
  const container = document.getElementById('question-container');
  container.style.opacity = 0;
  
  setTimeout(() => {
    document.getElementById('q-number').textContent = `第 ${q.id} 题`;
    document.getElementById('q-text').textContent = q.text;
    document.getElementById('current-q').textContent = q.id;
    
    const progress = (currentQuestion / questions.length) * 100;
    document.getElementById('progress-bar').style.width = progress + '%';

    const optsContainer = document.getElementById('options-container');
    optsContainer.innerHTML = '';

    q.options.forEach((opt, idx) => {
      const isSelected = answers[q.id] === idx;
      const el = document.createElement('div');
      el.className = 'option' + (isSelected ? ' selected' : '');
      el.onclick = () => selectOption(q.id, idx);
      
      el.innerHTML = `
        <div class="option-indicator"></div>
        <div class="option-text">${opt.text}</div>
      `;
      optsContainer.appendChild(el);
    });

    document.getElementById('prev-btn').disabled = currentQuestion === 0;
    
    const nextBtn = document.getElementById('next-btn');
    const hasAnswer = answers[q.id] !== undefined;
    nextBtn.disabled = !hasAnswer;
    
    if (currentQuestion === questions.length - 1 && hasAnswer) {
      nextBtn.innerHTML = `查看结果
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>`;
    } else {
      nextBtn.innerHTML = `下一题
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>`;
    }

    container.style.transition = 'opacity 0.3s ease';
    container.style.opacity = 1;
  }, 200);
}

function selectOption(qId, idx) {
  answers[qId] = idx;
  const opts = document.querySelectorAll('.option');
  opts.forEach((opt, i) => {
    if(i === idx) opt.classList.add('selected');
    else opt.classList.remove('selected');
  });
  
  const nextBtn = document.getElementById('next-btn');
  nextBtn.disabled = false;
  if(currentQuestion === questions.length - 1) {
    nextBtn.innerHTML = `查看结果
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>`;
  }
  
  setTimeout(() => {
    if(currentQuestion < questions.length - 1) {
      nextQuestion();
    }
  }, 350);
}

function nextQuestion() {
  if (answers[questions[currentQuestion].id] === undefined) return;
  
  if (currentQuestion < questions.length - 1) {
    currentQuestion++;
    renderQuestion();
  } else {
    showLoading();
  }
}

function prevQuestion() {
  if (currentQuestion > 0) {
    currentQuestion--;
    renderQuestion();
  }
}

function showLoading() {
  showPage('loading');
  
  const subs = ["分析内在边界...", "计算自我价值依赖度...", "生成综合评估结果..."];
  let sidx = 0;
  const subEl = document.getElementById('loading-sub');
  
  const itv = setInterval(() => {
    sidx++;
    if(sidx < subs.length) subEl.textContent = subs[sidx];
    else clearInterval(itv);
  }, 800);
  
  setTimeout(() => {
    calculateScore();
  }, 2500);
}

function calculateScore() {
  totalScore = 0;
  questions.forEach(q => {
    const aidx = answers[q.id];
    if (aidx !== undefined) {
      totalScore += q.options[aidx].score;
    }
  });
  
  showResult();
}

function showResult() {
  let tier = resultTiers[0];
  for(let i=0; i<resultTiers.length; i++) {
    if (totalScore >= resultTiers[i].minScore && totalScore <= resultTiers[i].maxScore) {
      tier = resultTiers[i];
      break;
    }
  }
  
  document.getElementById('score-value').textContent = totalScore;
  document.getElementById('result-title').textContent = tier.title;
  document.getElementById('result-title').style.color = tier.color;
  document.getElementById('result-description').innerHTML = tier.description;
  document.getElementById('result-psych').innerHTML = tier.psychState;
  document.getElementById('result-advice').innerHTML = tier.advice;
  
  showPage('result');

  // 初始化评论区
  setTimeout(() => {
    if (typeof initComments === 'function') initComments();
  }, 500);
}

function restartTest() {
  showPage('landing');
}

function saveResult() {
  if (typeof html2canvas === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => performCapture();
    document.head.appendChild(script);
  } else {
    performCapture();
  }
}

function performCapture() {
  const target = document.getElementById('capture-area');
  if (!target) return;

  // 临时隐藏操作按钮
  const actions = target.querySelector('.result-actions');
  if (!actions) return;
  const originalDisplay = actions.style.display;
  actions.style.display = 'none';

  const attemptCapture = (scale) => {
    html2canvas(target, {
      useCORS: true,
      allowTaint: false,
      scale,
      backgroundColor: '#fdfbf7',
      logging: false
    }).then(canvas => {
      actions.style.display = originalDisplay;

      const link = document.createElement('a');
      const now = new Date();
      const timestamp = now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') + '_' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');

      link.download = `测评结果_${timestamp}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }).catch(err => {
      if (scale > 1.2) {
        attemptCapture(1.2);
        return;
      }
      console.error('保存失败:', err);
      actions.style.display = originalDisplay;
      alert('生成海报失败，请重试一次或直接截图保存。');
    });
  };

  attemptCapture(2);
}

// Keyboard nav
document.addEventListener('keydown', (e) => {
  const quizPage = document.getElementById('quiz');
  if(!quizPage.classList.contains('active')) return;
  
  if(e.key === 'ArrowRight' || e.key === 'Enter') {
    const q = questions[currentQuestion];
    if (answers[q.id] !== undefined) nextQuestion();
  } else if (e.key === 'ArrowLeft') {
    prevQuestion();
  } else {
    // try option 1 to 4 keys
    const num = parseInt(e.key);
    if (!isNaN(num) && num >= 1 && num <= 4) {
      const q = questions[currentQuestion];
      if (num - 1 < q.options.length) {
        selectOption(q.id, num - 1);
      }
    }
  }
});
