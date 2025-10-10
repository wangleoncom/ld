/* ===== Deer Video Minimal v3.3 =====
 * - 遮罩推薦、底部防滑
 * - Tabs 樣式與切換
 * - 隨機影片在標題上方
 * - 右上角全站分享
 * - 影片資訊：長連結換行、音檔超連結
 * - AI麋鹿：回答目前影片基本問題
 */
(function(){
  const tabQA = document.getElementById('tab-qa');
  const tabVideo = document.getElementById('tab-video');
  const qaPanel = document.getElementById('qa-panel');
  const qaToolbar = document.getElementById('qa-toolbar');
  const qaStats = document.getElementById('qa-stats');
  const videoPanel = document.getElementById('video-panel');

  const frameWrap = document.getElementById('v-frame');
  const list = document.getElementById('v-list');
  const title = document.getElementById('v-title');
  const infoBtn = document.getElementById('v-info-btn');
  const modal = document.getElementById('info-modal');
  const modalBody = document.getElementById('modal-body');
  const modalClose = document.getElementById('modal-close');
  const randomBtn = document.getElementById('v-random');
  const shareBtn = document.getElementById('site-share');

  const aiForm = document.getElementById('ai-form');
  const aiInput = document.getElementById('ai-text');
  const aiMsgs = document.getElementById('ai-messages');

  let videos = [];
  let current = null;

  // Tabs
  tabQA?.addEventListener('click',()=>switchTab('qa'));
  tabVideo?.addEventListener('click',()=>switchTab('video'));
  function switchTab(which){
    if(which==='video'){
      tabVideo.classList.add('active'); tabVideo.setAttribute('aria-selected','true');
      tabQA.classList.remove('active'); tabQA.setAttribute('aria-selected','false');
      videoPanel.classList.remove('hidden'); qaPanel.classList.add('hidden');
      qaToolbar.style.display='none'; qaStats.style.display='none';
      if(current) aiHintForCurrent();
    }else{
      tabQA.classList.add('active'); tabQA.setAttribute('aria-selected','true');
      tabVideo.classList.remove('active'); tabVideo.setAttribute('aria-selected','false');
      qaPanel.classList.remove('hidden'); videoPanel.classList.add('hidden');
      qaToolbar.style.display='flex'; qaStats.style.display='grid';
    }
  }

  // 全站分享
  shareBtn?.addEventListener('click', async ()=>{
    const url = 'https://wangleoncom.github.io/ld/';
    try{
      if(navigator.share){
        await navigator.share({ title:'鹿🦌的QA網站', text:'一起看鹿🦌影片與QA', url });
      }else{
        await navigator.clipboard.writeText(url);
        alert('連結已複製：' + url);
      }
    }catch{}
  });

  // 初始化
  init().catch(()=>{ frameWrap.textContent='無法載入 videos.csv'; });

  async function init(){
    const csv = await fetch('videos.csv',{cache:'no-store'}).then(r=>r.text());
    const rows = parseCSV(csv);
    if(rows.length<=1){ frameWrap.textContent='無影片資料'; return; }
    const header = rows[0];
    const idx = k => header.indexOf(k);
    const iLink=idx('影片連結'), iDesc=idx('文字敘述'), iTags=idx('標籤'),
          iDate=idx('上傳日期'), iPin=idx('置頂'), iAudio=idx('音檔');

    videos = rows.slice(1).map((r,i)=>{
      const link = (r[iLink]  || '').trim();
      const id   = (link.match(/\/video\/(\d+)/)||[])[1];
      if(!id) return null;
      return {
        id, link,
        desc : (r[iDesc]  || '').trim(),
        tags : (r[iTags]  || '').trim(),
        date : (r[iDate]  || '').trim(),
        pin  : (r[iPin]   || '').trim(),
        audio: (r[iAudio] || '').trim(),
        title: (r[iDesc]  || '').trim() || `影片 ${i+1}`
      };
    }).filter(Boolean);

    renderList(videos);
    ensureMobileCatalog();

    // 事件
    infoBtn.addEventListener('click',()=>{ if(current) showInfo(current); });
    modalClose.addEventListener('click',()=>modal.classList.add('hidden'));
    modal.addEventListener('click',e=>{ if(e.target===modal) modal.classList.add('hidden'); });
    randomBtn.addEventListener('click',()=>{ const v=videos[Math.floor(Math.random()*videos.length)]; play(v); });

    // 禁止影片區滑動：擋底部 220px（iframe 內事件無法攔截，只能遮擋）
    ['wheel','touchmove'].forEach(ev=>{
      document.querySelector('.iframe-shield')?.addEventListener(ev, e=>{ e.preventDefault(); }, {passive:false});
    });
    window.addEventListener('resize', ensureMobileCatalog);
  }

  function ensureMobileCatalog(){
    // Create "目錄" button in the video controls (desktop shows list at right; mobile uses overlay)
    const ctrlTop = document.querySelector('.video-controls.top');
    if (ctrlTop && !document.getElementById('v-dir')) {
      const btn = document.createElement('button');
      btn.id = 'v-dir';
      btn.className = 'btn ghost';
      btn.textContent = '目錄';
      btn.addEventListener('click', openCatalog);
      ctrlTop.appendChild(btn);
    }

    // Build overlay container if missing
    let catalog = document.getElementById('v-catalog');
    if (!catalog) {
      catalog = document.createElement('div');
      catalog.id = 'v-catalog';
      catalog.setAttribute('role','dialog');
      catalog.setAttribute('aria-modal','true');
      catalog.innerHTML = `
        <div id="v-cat-head" style="
          display:flex;align-items:center;gap:10px;height:56px;padding:0 12px;
          border-bottom:1px solid rgba(255,255,255,.12);
          background:linear-gradient(180deg,rgba(22,26,48,.72),rgba(28,33,62,.72));
          -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);">
          <div id="v-cat-title" style="font-weight:800">影片目錄</div>
          <button id="v-cat-close" class="btn ghost" style="margin-left:auto">❌關閉影片目錄</button>
        </div>
        <div id="v-cat-body" style="overflow:auto;padding:10px 12px 20px;"></div>
      `;
      Object.assign(catalog.style, {
        position:'fixed', inset:'0', zIndex:'10000',
        display:'none', gridTemplateRows:'56px 1fr',
        background:'rgba(5,8,16,.86)',
        WebkitBackdropFilter:'blur(8px)',
        backdropFilter:'blur(8px)'
      });
      document.body.appendChild(catalog);
      catalog.querySelector('#v-cat-close').addEventListener('click', closeCatalog);
      catalog.addEventListener('click', (e)=>{
        const body = document.getElementById('v-cat-body');
        const head = document.getElementById('v-cat-head');
        if (!body.contains(e.target) && !head.contains(e.target)) closeCatalog();
      });
      window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeCatalog(); }, true);
    }

    // Move #v-list into overlay body on mobile (<= 768px); otherwise move it back to original right side
    const body = document.getElementById('v-cat-body');
    const rightCol = document.querySelector('.video-right');
    if (!body || !rightCol || !list) return;

    if (window.matchMedia('(max-width: 768px)').matches) {
      if (list.parentElement !== body) body.appendChild(list);
      // Ensure items are visible on iPhone even if site CSS fails to load
      list.style.display = 'flex';
      list.style.flexDirection = 'column';
      list.style.gap = '10px';
      list.style.padding = '10px 2px 22px';
      list.style.overflow = 'auto';
      // Each item fallback style
      list.querySelectorAll('.video-item').forEach(it=>{
        it.style.background = 'linear-gradient(180deg,rgba(22,26,48,.72),rgba(28,33,62,.72))';
        it.style.border = '1px solid rgba(255,255,255,.12)';
        it.style.borderRadius = '12px';
        it.style.padding = '10px 12px';
        it.style.display = 'flex';
        it.style.alignItems = 'center';
        it.style.justifyContent = 'space-between';
        it.style.color = '#f6f8ff';
      });
    } else {
      if (list.parentElement !== rightCol) rightCol.appendChild(list);
      // reset overlay if open on desktop
      closeCatalog();
    }

    function openCatalog(){
      catalog.style.display = 'grid';
      document.body.classList.add('catalog-open');
    }
    function closeCatalog(){
      catalog.style.display = 'none';
      document.body.classList.remove('catalog-open');
    }
  }

  function renderList(arr){
    list.innerHTML = arr.map(v=>`
      <div class="video-item" data-id="${v.id}">
        <span class="video-label">${escapeHTML(v.title)}</span>
        <button class="info-btn small" data-id="${v.id}" title="影片資訊">ℹ️</button>
      </div>
    `).join('');
    list.querySelectorAll('.video-item').forEach(item=>{
      item.addEventListener('click',e=>{
        if(e.target.classList.contains('info-btn')) return;
        const id=item.dataset.id;
        const v=videos.find(x=>x.id===id);
        if(v){
          tryUnlockAudio();               // 先解鎖 iOS 音訊
          play(v, true);                  // 嘗試有聲播放（失敗則靜音）
          switchTab('video');
          // 自動關閉任何目錄/抽屜樣式（兩種舊/新 class 皆處理）
          document.body.classList.remove('catalog-open');
          document.body.classList.remove('vlist-open');
          const vc = document.getElementById('v-catalog');
          if (vc) vc.style.display = 'none';
        }
      });
    });
    list.querySelectorAll('.info-btn.small').forEach(btn=>{
      btn.addEventListener('click',e=>{
        e.stopPropagation();
        const id=btn.dataset.id;
        const v=videos.find(x=>x.id===id);
        if(v) showInfo(v);
      });
    });
    // refresh mobile overlay styles when list re-rendered
    ensureMobileCatalog();
  }

  function play(v, preferUnmute){
    current = v;
    title.textContent = v.title;
    frameWrap.querySelector('iframe')?.remove();

    const iframe = document.createElement('iframe');
    // iOS/Safari 策略：預設靜音自動播放；之後再嘗試解除靜音
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('loading', 'lazy');
    // 不把 fullscreen 放 allow 內，避免 console 警告
    iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; clipboard-write');
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-presentation');

    // 來源網址（TikTok 以 v2 embed）
    const base = v.link || '';
    const isYT = /youtube\.com|youtu\.be/i.test(base);
    const src = isYT
      ? addParams(base, { autoplay: 1, playsinline: 1, enablejsapi: 1, mute: 1 })
      : `https://www.tiktok.com/embed/v2/${v.id}?autoplay=1&amp;muted=1&amp;playsinline=1&amp;enablejsapi=1`;

    iframe.src = src;
    frameWrap.insertBefore(iframe, frameWrap.firstChild); // 保留遮罩在最上層

    // 若為 iOS + TikTok，無法跨 iframe 自動開聲音；提供點一下開聲音的提示層
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
    let tapSound;
    if (!isYT) {
      tapSound = document.createElement('button');
      tapSound.className = 'tap-sound-tip';
      tapSound.type = 'button';
      tapSound.textContent = '🔊 點一下開聲音';
      tapSound.addEventListener('click', ()=>{
        tryUnlockAudio();
        tryUnmuteIframe(iframe, false); // 嘗試向 TikTok 傳送 unmute/play
        tapSound.remove();
      }, { once:true });
      frameWrap.appendChild(tapSound);
    }

    // 載入後把焦點給播放器（配合使用者點擊，提高播放成功率）並嘗試解除靜音
    iframe.addEventListener('load', ()=>{
      try { iframe.contentWindow?.focus?.(); } catch {}
      if (preferUnmute) tryUnmuteIframe(iframe, isYT);
    }, { once: true });

    aiHintForCurrent();
  }

  function addParams(u, obj){
    try{
      const url = new URL(u, location.href);
      Object.entries(obj || {}).forEach(([k, v]) => url.searchParams.set(k, String(v)));
      return url.toString();
    }catch{return u;}
  }

  // 嘗試解鎖 iOS 音訊（需在使用者手勢事件鏈內呼叫）
  function tryUnlockAudio(){
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      // 有些瀏覽器需多次 resume；這裡以微延遲再呼叫一次
      ctx.resume?.();
      setTimeout(()=>ctx.resume?.(), 50);
    }catch{}
  }

  // 嘗試解除靜音並播放（YouTube 與 TikTok）
  function tryUnmuteIframe(iframe, isYT){
    let tries = 0;
    const postYT = () => {
      try{
        iframe.contentWindow?.postMessage(JSON.stringify({ event:'command', func:'unMute' }), '*');
        iframe.contentWindow?.postMessage(JSON.stringify({ event:'command', func:'setVolume', args:[100] }), '*');
        iframe.contentWindow?.postMessage(JSON.stringify({ event:'command', func:'playVideo' }), '*');
      }catch{}
    };
    const postTT = () => {
      try{
        // TikTok 沒正式 API；傳常見訊息名稱，若平台忽略則不影響
        iframe.contentWindow?.postMessage({ type:'tiktok:player:unmute' }, '*');
        iframe.contentWindow?.postMessage({ type:'tiktok:player:play' }, '*');
        // 某些版本接受這些別名
        iframe.contentWindow?.postMessage({ type:'player:unmute' }, '*');
        iframe.contentWindow?.postMessage({ type:'player:play' }, '*');
        iframe.contentWindow?.postMessage({ action:'play' }, '*');
        iframe.contentWindow?.postMessage({ action:'unmute' }, '*');
      }catch{}
    };

    const timer = setInterval(()=>{
      tries++;
      if (isYT) postYT(); else postTT();
      if (tries > 15) clearInterval(timer); // 最多嘗試 ~4.5s
    }, 300);
  }

  function showInfo(v){
    const audioHTML = linkifyIfURL(v.audio||'（無）');
    modalBody.innerHTML = `
      <p class="break"><b>影片連結：</b><a href="${v.link}" target="_blank" rel="noopener">${escapeHTML(v.link)}</a></p>
      <p><b>文字敘述：</b>${escapeHTML(v.desc||'（無）')}</p>
      <p><b>標籤：</b>${escapeHTML(v.tags||'（無）')}</p>
      <p><b>上傳日期：</b>${escapeHTML(v.date||'（未知）')}</p>
      <p><b>置頂：</b>${escapeHTML(v.pin||'否')}</p>
      <p class="break"><b>音檔：</b>${audioHTML}</p>
    `;
    modal.classList.remove('hidden');
  }

  /* AI：影片資訊提示與問答（基礎） */
  function aiHintForCurrent(){
    if(!aiMsgs || !current) return;
    appendMsg('assistant',
      `目前影片\n標題：${current.title}\n上傳日期：${current.date||'未知'}\n連結：${current.link}`);
  }
  if(aiForm && aiInput && aiMsgs){
    aiForm.addEventListener('submit', e=>{
      const q = String(aiInput.value||'').trim();
      if(!current || !q) return;
      if(/(標題|片名|叫什麼)/i.test(q) || /(何時|什麼時候|上傳|日期)/i.test(q) ||
         /(連結|網址)/i.test(q) || /(音檔|配樂)/i.test(q) || /(標籤|tag)/i.test(q) || /(置頂)/i.test(q)){
        e.preventDefault(); e.stopImmediatePropagation();
        appendMsg('user', q);
        appendMsg('assistant', answerFor(q,current));
        aiInput.value='';
      }
    }, true);
  }
  function answerFor(q,v){
    if(/標題|片名|叫什麼/i.test(q)) return `標題：${v.title}`;
    if(/何時|什麼時候|上傳|日期/i.test(q)) return `上傳日期：${v.date||'未知'}`;
    if(/連結|網址/i.test(q)) return `連結：${v.link}`;
    if(/音檔|配樂/i.test(q)) return `音檔：${v.audio||'（無）'}`;
    if(/標籤|tag/i.test(q)) return `標籤：${v.tags||'（無）'}`;
    if(/置頂/i.test(q)) return `置頂：${v.pin||'否'}`;
    return `目前影片：${v.title}（${v.date||'未知'}）`;
  }

  /* 工具 */
  function escapeHTML(s){return String(s).replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));}
  function linkifyIfURL(text){
    const m = String(text).match(/https?:\/\/[^\s]+/i);
    if(!m) return escapeHTML(text);
    const url=m[0]; const i=m.index||0;
    const before=String(text).slice(0,i); const after=String(text).slice(i+url.length);
    return `${escapeHTML(before)}<a href="${url}" target="_blank" rel="noopener">${escapeHTML(url)}</a>${escapeHTML(after)}`;
  }
  function appendMsg(role, text){
    const div=document.createElement('div');
    div.className='msg '+(role==='user'?'user':'assistant');
    div.innerHTML = `
      <div class="avatar ${role==='assistant'?'assistant':''}"></div>
      <div class="body">
        <div class="role">${role==='user'?'你':'AI麋鹿'}</div>
        <div class="bubble">${escapeHTML(text).replace(/\n/g,'<br>')}</div>
      </div>`;
    aiMsgs.appendChild(div);
    aiMsgs.scrollTop = aiMsgs.scrollHeight;
  }

  /* CSV 解析（含引號） */
  function parseCSV(text){
    const out=[], row=[], N=text.length; let i=0, field='', quoted=false;
    text = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    while(i<N){
      const c=text[i];
      if(quoted){
        if(c==='"' && text[i+1]==='"'){ field+='"'; i+=2; continue; }
        if(c==='"'){ quoted=false; i++; continue; }
        field+=c; i++; continue;
      }else{
        if(c===','){ row.push(field); field=''; i++; continue; }
        if(c==='\n'){ row.push(field); out.push(row.slice()); row.length=0; field=''; i++; continue; }
        if(c==='"'){ quoted=true; i++; continue; }
        field+=c; i++; continue;
      }
    }
    row.push(field); out.push(row);
    return out.filter(r=>r.some(x=>String(x).trim().length));
  }
})();