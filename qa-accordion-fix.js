// QA 開闔 + 單筆外框霓虹停留 + 點擊漣漪（無旋轉）
(function () {
  const list = document.getElementById('qa-list');
  if (!list) return;

  if (!document.getElementById('qa-item-glow-style')) {
    const st = document.createElement('style');
    st.id = 'qa-item-glow-style';
    st.textContent = `
      #qa-list .item{ position:relative; border-radius:var(--r); }
      #qa-list .item.qa-glow{ overflow:visible; }
      /* 只有柔光「停留」效果，無旋轉掃描層 */
      #qa-list .item.qa-glow::before{
        content:""; position:absolute; inset:-6px; padding:6px;
        border-radius:calc(var(--r) + 6px); pointer-events:none;
        background:conic-gradient(#9ae6ff,#b388ff,#ff9ad1,#ffd37a,#9affc7,#9ae6ff);
        -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
        -webkit-mask-composite:xor; mask-composite:exclude;
        filter:blur(14px); opacity:.85; animation:qaItemHold 1.2s ease-out forwards;
      }
      @keyframes qaItemHold{
        0%{opacity:.8; transform:scale(.997)}
        60%{opacity:.45}
        100%{opacity:0}
      }

      /* 問題列彩色漣漪 */
      #qa-list .q{ position:relative; overflow:hidden; }
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

      /* 答案過渡 */
      #qa-list .a{ overflow:hidden; max-height:0; transition:max-height .3s var(--ease); }
      #qa-list .item.open .a{ max-height:1200px; }
    `;
    document.head.appendChild(st);
  }

  list.addEventListener('click', (e)=>{
    const q = e.target.closest('.q');
    if (!q) return;
    e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    const item = q.closest('.item');
    const a = item && item.querySelector('.a');
    if (!item || !a) return;

    // 關閉其他
    list.querySelectorAll('.item.open').forEach(it=>{
      if (it!==item){ it.classList.remove('open','qa-glow'); const aa=it.querySelector('.a'); if(aa){aa.style.maxHeight='0px'} }
    });

    // 漣漪座標
    const r = q.getBoundingClientRect();
    q.style.setProperty('--rip-x', (e.clientX - r.left) + 'px');
    q.style.setProperty('--rip-y', (e.clientY - r.top) + 'px');
    q.classList.remove('rippling'); void q.offsetWidth; q.classList.add('rippling');
    setTimeout(()=>q.classList.remove('rippling'), 750);

    // 開闔 + 外框柔光
    if (item.classList.contains('open')) {
      item.classList.remove('open','qa-glow');
      a.style.maxHeight = '0px';
      q.setAttribute('aria-expanded','false');
    } else {
      item.classList.add('open');
      a.style.maxHeight = a.scrollHeight + 'px';
      q.setAttribute('aria-expanded','true');
      item.classList.remove('qa-glow'); void item.offsetWidth; item.classList.add('qa-glow');
      setTimeout(()=>item.classList.remove('qa-glow'), 1200);
    }
  }, true);

  // 鍵盤支援與可達性
  list.addEventListener('keydown',(e)=>{
    if ((e.key==='Enter'||e.key===' ') && e.target.closest('.q')) {
      e.preventDefault();
      e.target.click();
    }
  }, true);

  const mo = new MutationObserver(()=>{
    list.querySelectorAll('.q').forEach(q=>{
      q.role || q.setAttribute('role','button');
      if (!q.hasAttribute('tabindex')) q.setAttribute('tabindex','0');
      if (!q.hasAttribute('aria-expanded')) q.setAttribute('aria-expanded','false');
    });
  });
  mo.observe(list,{childList:true,subtree:true});
})();