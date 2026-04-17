/**
 * Layout Module - 网站公共 UI 组件化引擎
 * 负责动态注入 Auth 状态栏、页脚、返回按钮及跨页面状态同步
 */
(function() {
    const initLayout = () => {
        // 1. 智能路径解析
        const path = window.location.pathname;
        // 判断是否在子目录（除根目录外的文件夹）
        const pathSegments = path.split('/').filter(s => s.length > 0 && !s.includes('.html'));
        const isSubDir = pathSegments.length > 0;
        const rootPath = isSubDir ? '../'.repeat(pathSegments.length) : './';
        const isHomePage = !isSubDir && (path === '/' || path.endsWith('index.html') || path === '');

        // 2. 动态 DOM 注入
        const injectGlobalUI = () => {
            // 注入 Auth Status 容器 (右上角)
            if (!document.getElementById('auth-status')) {
                const statusDiv = document.createElement('div');
                statusDiv.id = 'auth-status';
                // 由各页面 CSS 控制位置，或在 index.html 默认 fixed
                document.body.appendChild(statusDiv);
            }

            // 注入通用页脚
            if (!document.querySelector('footer')) {
                const footer = document.createElement('footer');
                footer.className = 'global-footer';
                footer.innerHTML = '青野';
                // 注入核心内联样式，确保基础表现一致
                footer.style.cssText = 'position: fixed; bottom: 1rem; width: 100%; text-align: center; font-size: 0.7rem; color: rgba(255,255,255,0.2); z-index: 5; font-family: "Noto Serif SC", serif; letter-spacing: 0.3em; pointer-events: none;';
                document.body.appendChild(footer);
            }

            // 子目录注入“返回首页”按钮
            if (isSubDir && !document.getElementById('globalHomeBtn')) {
                const homeBtn = document.createElement('a');
                homeBtn.href = rootPath + 'index.html';
                homeBtn.className = 'nav-home-btn';
                homeBtn.id = 'globalHomeBtn';
                homeBtn.title = '返回主页';
                homeBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                `;
                document.body.prepend(homeBtn);
            }
        };

        // 3. 统一全局 renderAuthUI 函数
        window.renderAuthUI = function() {
            const statusEl = document.getElementById('auth-status');
            const greetingEl = document.getElementById('home-greeting');

            if (statusEl) {
                if (window.currentUser) {
                    const profile = window.currentProfile || {};
                    const displayName = profile.nickname || window.currentUser.user_metadata?.nickname || window.currentUser.email || '觉者';
                    const avatarUrl = profile.avatar_url || window.currentUser.user_metadata?.avatar_url;
                    const avatarHtml = window.AvatarKit ? window.AvatarKit.avatarToBadgeHtml(avatarUrl, window.currentUser.id, 'auth-avatar') : '';

                    if (isHomePage) {
                        // 首页定制样式
                        statusEl.innerHTML = `
                            <button class="home-profile-btn" onclick="openEditProfile()">
                                ${avatarHtml}
                                <span>${displayName}</span>
                            </button>
                        `;
                    } else {
                        // 子页面/标准样式
                        statusEl.innerHTML = `
                            <div class="auth-user" onclick="openEditProfile()">
                                ${avatarHtml}
                                <span class="auth-name">${displayName}</span>
                            </div>
                        `;
                    }
                    statusEl.style.opacity = '1';
                } else {
                    if (isHomePage) {
                        statusEl.innerHTML = ''; // 首页未登录不显示右上角
                    } else {
                        statusEl.innerHTML = `
                            <button class="auth-login-btn" onclick="openAuthModal()">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                                </svg>
                                登录
                            </button>
                        `;
                    }
                    statusEl.style.opacity = '1';
                }
            }

            // 处理首页特有的欢迎语
            if (greetingEl) {
                if (window.currentUser) {
                    const profile = window.currentProfile || {};
                    const displayName = profile.nickname || window.currentUser.user_metadata?.nickname || '觉者';
                    greetingEl.innerHTML = `你好，<span style="color:var(--gold-light)">${displayName}</span>`;
                } else {
                    greetingEl.innerHTML = `你好，欢迎<span class="home-auth-login-trigger" onclick="openAuthModal()">登录</span>`;
                }
                greetingEl.classList.add('show');
            }

            // 联动处理新用户欢迎 Toast
            if (window._showWelcomeToastPending && typeof showWelcomeToast === 'function') {
                setTimeout(() => showWelcomeToast(), 500);
                window._showWelcomeToastPending = false;
            }
        };

        injectGlobalUI();
        // 初始同步一次状态 (如果 auth.js 已经初始化过)
        if (typeof window.currentUser !== 'undefined') {
            window.renderAuthUI();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLayout);
    } else {
        initLayout();
    }
})();
