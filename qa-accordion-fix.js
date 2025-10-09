// QA 開闔（單開）+ 柔光停留 + 漣漪 + 無障礙 + 高度自動（可靠版）
// 特色：
// 1) 使用 max-height 過渡，但在展開結束後改回 auto，避免截斷。
// 2) 動態內容（圖片/字形載入、內文變動）會自動重算高度。
// 3) 單一開啟：點新的會關掉其他；再點同一個會關閉。
// 4) Ripple 與 Glow 效果防抖，不會殘留偽元素。
// 5) ARIA 與鍵盤可達性：Enter / Space 觸發、aria-expanded 同步。
(function () {
  const list = document.getElementById('qa-list');
  if (!list) return;

  // ===== 一次性樣式 =====
  if (!document.getElementById('qa-item-glow-style')) {
    const st = document.createElement('style');
    st.id = 'qa-item-glow-style';
    st.textContent = `
      #qa-list .item{ position:relative; border-radius:var(--r); }
      #qa-list .item.qa-glow{ overflow:visible; }
      #qa-list .item.qa-glow::before{
        content:""; position:absolute; inset:-6px; padding:6px;
        border-radius:calc(var(--r) + 6px); pointer-events:none;
        background:conic-gradient(#9ae6ff,#b388ff,#ff9ad1,#ffd37a,#9affc7,#9ae6ff);
        -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
        -webkit-mask-composite:xor; mask-composite:exclude;
        filter:blur(14px); opacity:.85; animation:qaItemHold 1.1s ease-out forwards;
      }
      @keyframes qaItemHold{0%{opacity:.8; transform:scale(.997)}60%{opacity:.45}100%{opacity:0}}

      #qa-list .q{ position:relative; overflow:hidden; cursor:pointer; }
      #qa-list .q.rippling::after{
        content:""; position:absolute; left:var(--rip-x,50%); top:var(--rip-y,50%);
        width:14px; height:14px; border-radius:999px; transform:translate(-50%,-50%);
        background:radial-gradient(circle at center,
          rgba(255,255,255,.95) 0%, rgba(255,255,255,.6) 18%,
          rgba(186,227,255,.5) 28%, rgba(179,136,255,.45) 40%,
          rgba(255,154,209,.4) 55%, rgba(255,211,122,.35) 70%,
          rgba(154,255,199,.3) 85%, transparent 100%);
        animation:rippleBurst .7s ease-out forwards; mix-blend-mode:screen; pointer-events:none;
      }
      @keyframes rippleBurst{
        0%{opacity:.95; filter:blur(0); transform:translate(-50%,-50%) scale(1)}
        60%{opacity:.45; filter:blur(2px); transform:translate(-50%,-50%) scale(26)}
        100%{opacity:0;   filter:blur(3px); transform:translate(-50%,-50%) scale(32)}
      }

      #qa-list .a{ overflow:hidden; max-height:0; transition:max-height .28s var(--ease); }
      #qa-list .item.open .a{ /* 展開時於 JS 內動態設定 max-height */ }
    `;
    document.head.appendChild(st);
  }

  // ===== 工具 =====
  const raf = (fn)=>window.requestAnimationFrame(fn);
  function setAria(q, on){ q.setAttribute('aria-expanded', String(!!on)); }
  function measure(el){ return el.scrollHeight; }
  function collapse(item){
    const a = item.querySelector('.a');
    const q = item.querySelector('.q');
    if (!a) return;
    // 從 auto 回到具體高度，才能有關閉動畫
    a.style.maxHeight = a.getBoundingClientRect().height + 'px';
    raf(()=>{ a.style.maxHeight = '0px'; });
    item.classList.remove('open','qa-glow');
    if (q) setAria(q,false);
  }
  function expand(item){
    const a = item.querySelector('.a');
    const q = item.querySelector('.q');
    if (!a) return;
    const target = measure(a);
    a.style.maxHeight = target + 'px';
    item.classList.add('open');
    if (q) setAria(q,true);
    // 柔光一次
    item.classList.remove('qa-glow'); void item.offsetWidth; item.classList.add('qa-glow');
    setTimeout(()=>item.classList.remove('qa-glow'), 1100);
    // 動畫完後設為 auto，避免內容再長出被截斷
    const done = ()=>{
      if (!item.classList.contains('open')) return; // 已被關
      a.style.maxHeight = 'none';
      a.removeEventListener('transitionend', done);
    };
    a.addEventListener('transitionend', done);
  }
  function toggle(item){
    if (item.classList.contains('open')){ collapse(item); }
    else {
      // 關其他
      list.querySelectorAll('.item.open').forEach(it=>{ if(it!==item) collapse(it); });
      // 展開自己
      expand(item);
    }
  }

  // ===== 事件：點擊 + Ripple =====
  list.addEventListener('click', (e)=>{
    const q = e.target.closest('.q');
    if (!q || !list.contains(q)) return;
    e.preventDefault(); e.stopPropagation();

    const item = q.closest('.item');
    const a = item && item.querySelector('.a');
    if (!item || !a) return;

    // Ripple 座標（容錯：keyboard 觸發時取中點）
    const r = q.getBoundingClientRect();
    const cx = (e.clientX|| (r.left + r.width/2)) - r.left;
    const cy = (e.clientY|| (r.top + r.height/2)) - r.top;
    q.style.setProperty('--rip-x', cx + 'px');
    q.style.setProperty('--rip-y', cy + 'px');
    q.classList.remove('rippling'); void q.offsetWidth; q.classList.add('rippling');
    setTimeout(()=>q.classList.remove('rippling'), 750);

    toggle(item);
  }, true);

  // ===== 鍵盤可達性 =====
  list.addEventListener('keydown',(e)=>{
    const isActionKey = (e.key==='Enter' || e.key===' ');
    if (!isActionKey) return;
    const tgt = e.target.closest('.q');
    if (!tgt) return;
    e.preventDefault();
    tgt.click();
  }, true);

  // ===== 動態注入可達性屬性 =====
  function ensureA11y(){
    list.querySelectorAll('.q').forEach(q=>{
      q.role || q.setAttribute('role','button');
      if (!q.hasAttribute('tabindex')) q.setAttribute('tabindex','0');
      if (!q.hasAttribute('aria-expanded')) q.setAttribute('aria-expanded','false');
    });
  }
  ensureA11y();
  const mo = new MutationObserver(()=>{ ensureA11y(); autoResizeOpen(); });
  mo.observe(list,{childList:true,subtree:true});

  // ===== 內容變動/圖片載入時自動撐高 =====
  function autoResizeOpen(){
    list.querySelectorAll('.item.open .a').forEach(a=>{
      if (getComputedStyle(a).maxHeight !== 'none') {
        a.style.maxHeight = a.scrollHeight + 'px';
      }
      // 監聽內部圖片載入
      a.querySelectorAll('img').forEach(img=>{
        if (img._qaBound) return; img._qaBound = true;
        img.addEventListener('load', ()=>{
          if (a.closest('.item')?.classList.contains('open')){
            a.style.maxHeight = a.scrollHeight + 'px';
          }
        });
      });
    });
  }
  window.addEventListener('resize', autoResizeOpen);
  // 字型可能延後載入導致尺寸變動
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(autoResizeOpen).catch(()=>{});
  }

  // 對外鉤子：動態更新列表後可呼叫 window.QAAccordion.refresh()
  window.QAAccordion = window.QAAccordion || {};
  window.QAAccordion.refresh = function(){ ensureA11y(); autoResizeOpen(); };
})();