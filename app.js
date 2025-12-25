{
type: uploaded file
fileName: app.js
fullContent:
/* ===== Deer QA App - Apple Design Controller ===== */

// 1. Silence Console (Privacy/Cleaner UX)
console.log = function(){};
console.warn = function(){};
console.error = function(){};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

const App = {
    data: {
        qa: [],
        videos: [],
        effect: {
            title: '鹿🦌超好笑特效',
            url: 'https://vm.tiktok.com/ZMAXNfQ4v/',
            qr: 'QR Code.png',
            img: '鹿🦌超好笑特效.png'
        }
    },
    state: {
        qaPage: 1,
        qaLimit: 20,
        qaFilter: '',
        activeTab: 'tab-qa'
    },

    init() {
        this.loadData();
        this.setupUI();
        this.setupRouter();
        this.setupAI();
        this.setupAnimations();
        
        // Remove loader after a slight delay for smooth entry
        setTimeout(() => {
            const loader = document.getElementById('app-loader');
            loader.classList.add('fade-out');
            setTimeout(() => loader.remove(), 550);
        }, 1200);
    },

    loadData() {
        // Load QA from window.DEER_QA (provided by data.js)
        if (window.DEER_QA) {
            this.data.qa = window.DEER_QA;
        }
        
        // Render Initial QA
        this.renderQA();
        
        // Setup Effect Data
        document.getElementById('effect-link').href = this.data.effect.url;
        const qrImg = document.getElementById('effect-qr');
        qrImg.src = this.data.effect.qr;
        qrImg.onerror = () => qrImg.style.display = 'none';
        
        const efImg = document.getElementById('effect-img');
        efImg.src = this.data.effect.img;
        efImg.onerror = () => efImg.src = 'Logo.png'; // Fallback
    },

    setupUI() {
        // Tab Switching (Segmented Control)
        const tabs = document.querySelectorAll('.segment');
        const indicator = document.querySelector('.segment-indicator');
        
        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => {
                // Update Visuals
                document.querySelector('.segment.active').classList.remove('active');
                tab.classList.add('active');
                
                // Move Indicator
                indicator.style.transform = `translateX(${index * 100}%)`;
                
                // Change View
                this.switchView(tab.id.replace('tab-', 'view-'));
            });
        });

        // Search Bar
        const searchInput = document.getElementById('qa-search');
        const clearBtn = document.getElementById('qa-clear');
        
        searchInput.addEventListener('input', (e) => {
            this.state.qaFilter = e.target.value.trim();
            this.state.qaPage = 1;
            this.renderQA();
            clearBtn.classList.toggle('hidden', e.target.value === '');
        });
        
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            this.state.qaFilter = '';
            this.renderQA();
            clearBtn.classList.add('hidden');
        });

        // Pagination
        document.getElementById('page-prev').addEventListener('click', () => {
            if (this.state.qaPage > 1) {
                this.state.qaPage--;
                this.renderQA();
                window.scrollTo({top:0, behavior:'smooth'});
            }
        });
        document.getElementById('page-next').addEventListener('click', () => {
            const max = Math.ceil(this.getFilteredQA().length / this.state.qaLimit);
            if (this.state.qaPage < max) {
                this.state.qaPage++;
                this.renderQA();
                window.scrollTo({top:0, behavior:'smooth'});
            }
        });
        
        // Global Modal Listeners
        document.getElementById('g-modal-close').addEventListener('click', () => {
            document.getElementById('global-modal').classList.add('hidden');
        });
        
        // Share Button
        document.getElementById('btn-share').addEventListener('click', () => {
            if(navigator.share) {
                navigator.share({title: document.title, url: window.location.href});
            } else {
                this.showToast('連結已複製');
                navigator.clipboard.writeText(window.location.href);
            }
        });

        // Announce Button
        document.getElementById('btn-announce').addEventListener('click', () => {
            this.showModal('最新公告', '<p>歡迎來到 V3.4 版本！<br>新增了 TikTok 特效頁面與優化了 AI 助理。</p>');
        });
    },

    switchView(viewId) {
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
            v.classList.add('hidden');
        });
        const target = document.getElementById(viewId);
        target.classList.remove('hidden');
        // Force reflow for animation
        void target.offsetWidth;
        target.classList.add('active');
    },

    getFilteredQA() {
        if (!this.state.qaFilter) return this.data.qa;
        const q = this.state.qaFilter.toLowerCase();
        return this.data.qa.filter(item => 
            (item.q && item.q.toLowerCase().includes(q)) || 
            (item.a && item.a.toLowerCase().includes(q))
        );
    },

    renderQA() {
        const list = document.getElementById('qa-list');
        const items = this.getFilteredQA();
        const total = items.length;
        const totalPages = Math.ceil(total / this.state.qaLimit) || 1;
        
        // Update Stats
        document.getElementById('stat-total').innerText = total;
        document.getElementById('page-current').innerText = this.state.qaPage;
        document.getElementById('page-total').innerText = totalPages;
        
        document.getElementById('page-prev').disabled = this.state.qaPage === 1;
        document.getElementById('page-next').disabled = this.state.qaPage === totalPages;

        // Slice Data
        const start = (this.state.qaPage - 1) * this.state.qaLimit;
        const pageItems = items.slice(start, start + this.state.qaLimit);

        list.innerHTML = pageItems.map(item => `
            <div class="qa-item" onclick="App.toggleQA(this)">
                <div class="qa-head">
                    <div><span class="qa-id">#${item.id}</span>${this.highlight(item.q)}</div>
                    <svg class="qa-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6"/></svg>
                </div>
                <div class="qa-body">
                    <div class="qa-content">
                        ${this.linkify(this.highlight(item.a))}
                        <div style="text-align:right">
                            <button class="copy-btn" onclick="event.stopPropagation(); App.copyQA('${item.q}', '${item.a}')">複製回答</button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('') || '<div style="text-align:center;padding:20px;color:gray">沒有找到結果</div>';
    },

    toggleQA(el) {
        const isOpen = el.classList.contains('open');
        // Close others (Accordion style - optional, removed for now to allow multiple open)
        // document.querySelectorAll('.qa-item.open').forEach(i => { i.classList.remove('open'); i.querySelector('.qa-body').style.height = '0'; });
        
        const body = el.querySelector('.qa-body');
        if (isOpen) {
            el.classList.remove('open');
            body.style.height = '0';
        } else {
            el.classList.add('open');
            body.style.height = body.scrollHeight + 'px';
        }
    },

    highlight(text) {
        if(!this.state.qaFilter) return text || '';
        const regex = new RegExp(`(${this.state.qaFilter})`, 'gi');
        return (text || '').replace(regex, '<span style="color:#FFD60A;background:rgba(255,214,10,0.2)">$1</span>');
    },

    linkify(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, '<a href="$1" target="_blank" style="color:#0A84FF;text-decoration:underline">$1</a>');
    },

    copyQA(q, a) {
        navigator.clipboard.writeText(`Q: ${q}\nA: ${a}`);
        this.showToast('已複製 Q&A');
    },

    showToast(msg) {
        const island = document.getElementById('dynamic-island');
        document.getElementById('island-text').innerText = msg;
        island.classList.remove('hidden');
        setTimeout(() => island.classList.add('hidden'), 2000);
    },
    
    showModal(title, html) {
        document.getElementById('g-modal-title').innerText = title;
        document.getElementById('g-modal-body').innerHTML = html;
        document.getElementById('global-modal').classList.remove('hidden');
    },

    // --- AI Logic Integration ---
    setupAI() {
        const trigger = document.getElementById('ai-trigger');
        const modal = document.getElementById('ai-modal');
        const close = document.getElementById('ai-close');
        const overlay = document.getElementById('ai-overlay');
        const form = document.getElementById('ai-form');
        const input = document.getElementById('ai-input');
        const msgList = document.getElementById('ai-messages');

        const open = () => {
            modal.classList.remove('hidden');
            // Allow display:flex to apply before adding active class for transition
            setTimeout(() => modal.classList.add('active'), 10);
            if(msgList.children.length === 0) {
                 this.addAIMessage('ai', '嗨！我是 AI 麋鹿，關於鹿🦌的問題都可以問我喔！');
            }
        };
        const shut = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.classList.add('hidden'), 400);
        };

        trigger.addEventListener('click', open);
        close.addEventListener('click', shut);
        overlay.addEventListener('click', shut);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const q = input.value.trim();
            if(!q) return;
            
            this.addAIMessage('user', q);
            input.value = '';
            
            // Show typing...
            const typing = this.addAIMessage('sys', 'AI 正在思考...');
            
            try {
                // Call local AI logic
                const ans = await window.AI.ask(q); 
                typing.remove();
                this.addAIMessage('ai', ans);
            } catch(err) {
                typing.remove();
                this.addAIMessage('ai', '抱歉，我現在有點暈，請稍後再試。');
            }
        });
    },

    addAIMessage(role, text) {
        const list = document.getElementById('ai-messages');
        const div = document.createElement('div');
        div.className = `msg ${role}`;
        div.innerHTML = text.replace(/\n/g, '<br>');
        list.appendChild(div);
        list.scrollTop = list.scrollHeight;
        return div;
    },

    setupRouter() {
        // Simple hash routing fallback
        window.addEventListener('hashchange', () => {
            const hash = location.hash.replace('#', '');
            if(['qa', 'video', 'effect'].includes(hash)) {
                document.getElementById('tab-' + hash).click();
            }
        });
    },

    setupAnimations() {
        // Intersection Observer for scroll animations
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if(entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, { threshold: 0.1 });
        
        // Apply to cards (initially hidden by CSS if we wanted, 
        // but here we just keep it simple for stability)
    }
};

// Export for other scripts if needed
window.App = App;
}
