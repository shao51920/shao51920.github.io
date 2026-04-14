/**
 * 人格类型预览页 - 交互逻辑
 */

// ==============================
// 粒子背景 (复用主页逻辑)
// ==============================
(function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  const PARTICLE_COUNT = 60;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createParticle() {
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.4 + 0.1,
      hue: Math.random() * 60 + 240
    };
  }

  function init() {
    resize();
    particles = Array.from({ length: PARTICLE_COUNT }, createParticle);
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 70%, 75%, ${p.opacity})`;
      ctx.fill();
    });
    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', resize);
  init();
  animate();
})();

// ==============================
// 导航栏滚动效果
// ==============================
(function initNavScroll() {
  const nav = document.getElementById('types-nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  });
})();

// ==============================
// 渲染网格 + 详情
// ==============================
(function renderTypes() {
  if (typeof personalities === 'undefined') return;

  const grid = document.getElementById('types-grid');
  const detailSection = document.getElementById('types-detail');
  if (!grid || !detailSection) return;

  const keys = Object.keys(personalities);

    // 渲染网格卡片
    const t = new Date().getTime();
    keys.forEach((key, i) => {
      const p = personalities[key];
      const card = document.createElement('a');
      card.className = 'type-card';
      card.href = `#type-${key}`;
      card.style.animationDelay = `${i * 0.06}s`;
      card.innerHTML = `
        <img class="card-img" src="${p.image}?t=${t}" alt="${p.name}" loading="lazy" />
        <div class="card-info">
          <div class="card-name">
            <span class="card-emoji">${p.emoji}</span>
            <span>${p.name}</span>
          </div>
          <div class="card-subtitle">${p.subtitle}</div>
        </div>
        <div class="card-arrow">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      `;
      grid.appendChild(card);
    });
  
    // 渲染详情卡片
    keys.forEach((key) => {
      const p = personalities[key];
      const detail = document.createElement('div');
      detail.className = 'type-detail';
      detail.id = `type-${key}`;
  
      const tagsHTML = p.tags.map(t => `<span class="detail-tag">${t}</span>`).join('');
  
      const meterLabels = ['面具厚度', '灵魂清醒度', '摆烂指数', '内心戏浓度'];
      const meterKeys = ['mask', 'awake', 'chill', 'drama'];
      const metersHTML = meterKeys.map((mk, idx) => `
        <div class="detail-meter-row">
          <span class="detail-meter-label">${meterLabels[idx]}</span>
          <div class="detail-meter-bar">
            <div class="detail-meter-fill" data-width="${p.meters[mk]}"></div>
          </div>
          <span class="detail-meter-val">${p.meters[mk]}%</span>
        </div>
      `).join('');
  
      detail.innerHTML = `
        <div class="detail-left">
          <div class="detail-img-wrap">
            <img class="detail-img" src="${p.image}?t=${t}" alt="${p.name}" loading="lazy" onclick="openImageModal(this.src)" />
          </div>
          <div class="detail-emoji">${p.emoji}</div>
        </div>
        <div class="detail-right">
          <div class="detail-header">
            <h2 class="detail-name">${p.name}</h2>
            <div class="detail-subtitle">${p.subtitle}</div>
          </div>
          <div class="detail-tags">${tagsHTML}</div>
          <div class="detail-meters">${metersHTML}</div>
          <div class="detail-description">${p.description}</div>
          <div class="detail-quote">${p.quote.replace(/\n/g, '<br>')}</div>
          <div class="detail-mbti">${p.mbti}</div>
        </div>
      `;

    detailSection.appendChild(detail);
  });

  // ==============================
  // Intersection Observer - 滚动动画
  // ==============================
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');

        // 动画化 meter fills
        const fills = entry.target.querySelectorAll('.detail-meter-fill');
        fills.forEach(fill => {
          const width = fill.dataset.width;
          setTimeout(() => {
            fill.style.width = width + '%';
          }, 300);
        });

        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  document.querySelectorAll('.type-detail').forEach(el => observer.observe(el));

  // ==============================
  // Hash 导航 - 高亮对应卡片
  // ==============================
  function handleHash() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#type-')) {
      const target = document.querySelector(hash);
      if (target) {
        // 移除之前的高亮
        document.querySelectorAll('.type-detail.highlight').forEach(el => {
          el.classList.remove('highlight');
        });
        // 添加高亮
        target.classList.add('highlight');
        target.classList.add('visible');

        // 动画化 meter fills
        const fills = target.querySelectorAll('.detail-meter-fill');
        fills.forEach(fill => {
          const width = fill.dataset.width;
          setTimeout(() => {
            fill.style.width = width + '%';
          }, 500);
        });

        // 延迟滚动以确保布局完成
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }

  // 初次加载和hash变化
  window.addEventListener('hashchange', handleHash);
  setTimeout(handleHash, 300);

  // 卡片点击时添加高亮
  grid.querySelectorAll('.type-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.type-detail.highlight').forEach(el => {
        el.classList.remove('highlight');
      });
      const targetId = card.getAttribute('href').substring(1);
      const target = document.getElementById(targetId);
      if (target) {
        target.classList.add('highlight');
        // 3秒后移除高亮
        setTimeout(() => target.classList.remove('highlight'), 3000);
      }
    });
  });
})();

// 跳转到测试
function goToTest() {
  // 跳转到首页并自动开始测试
  window.location.href = 'index.html';
}

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
