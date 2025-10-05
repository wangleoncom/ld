/* ===== Deer Video Minimal v3.0 =====
 * 修正：長連結換行、禁止影片區滑動、隨機鈕在標題上方、AI麋鹿答目前影片、網站分享鈕
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

  // Tab 切換
  tabQA?.addEventListener('click',()=>switchTab('qa'));
  tabVideo?.addEventListener('click',()=>switchTab('video'));
  function switchTab(which){
    if(which==='video'){
      tabVideo.classList.add('active'); tabVideo.setAttribute('aria-selected','true');
      tabQA.classList.remove('active'); tabQA.setAttribute('aria-selected','false');
      videoPanel.classList.remove('hidden'); qaPanel.classList.add('hidden');
      qaToolbar.style.display='none'; qaStats.style.display='none';
      // 顯示目前影片簡述到 AI
      if(current) aiHintForCurrent();
    }else{
      tabQA.classList.add('active'); tabQA.setAttribute('aria-selected','true');
      tabVideo.classList.remove('active'); tabVideo.setAttribute('aria-selected','false');
      qaPanel.classList.remove('hidden'); videoPanel.classList.add('hidden');
      qaToolbar.style.display='flex'; qaStats.style.display='grid';
    }
  }

  // 網站分享
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

  // 載入 CSV
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
        id,
        link,
        desc : (r[iDesc]  || '').trim(),
        tags : (r[iTags]  || '').trim(),
        date : (r[iDate]  || '').trim(),
        pin  : (r[iPin]   || '').trim(),
        audio: (r[iAudio] || '').trim(),
        title: (r[iDesc]  || '').trim() || `影片 ${i+1}`
      };
    }).filter(Boolean);

    renderList(videos);

    // 事件
    infoBtn.addEventListener('click',()=>{ if(current) showInfo(current); });
    modalClose.addEventListener('click',()=>modal.classList.add('hidden'));
    modal.addEventListener('click',e=>{ if(e.target===modal) modal.classList.add('hidden'); });
    randomBtn.addEventListener('click',()=>{ const v = videos[Math.floor(Math.random()*videos.length)]; play(v); });

    // 禁止影片區滑動
    ['wheel','touchmove'].forEach(ev=>{
      frameWrap.addEventListener(ev, e=>{ e.preventDefault(); }, {passive:false});
    });

    // AI麋鹿：攔截影片相關問句
    if(aiForm && aiInput && aiMsgs){
      aiForm.addEventListener('submit', e=>{
        const q = String(aiInput.value||'').trim();
        if(!current || !q) return; // 無影片或空問題 → 交給原邏輯
        if(isVideoQuestion(q)){
          e.preventDefault(); e.stopImmediatePropagation();
          appendMsg('user', q);
          appendMsg('assistant', answerFor(q, current));
          aiInput.value='';
        }
      }, true); // capture=true 以阻止其他處理
    }
  }

  function renderList(arr){
    list.innerHTML = arr.map(v=>`
      <div class="video-item" data-id="${v.id}">
        <span class="video-label">${escapeHTML(v.title)}</span>
        <button class="info-btn small" data-id="${v.id}" title="影片資訊">ℹ️</button>
      </div>
    `).join('');
    // 點整條播放
    list.querySelectorAll('.video-item').forEach(item=>{
      item.addEventListener('click',e=>{
        if(e.target.classList.contains('info-btn')) return;
        const id=item.dataset.id;
        const v=videos.find(x=>x.id===id);
        if(v){ play(v); switchTab('video'); }
      });
    });
    // 尾端 ℹ️
    list.querySelectorAll('.info-btn.small').forEach(btn=>{
      btn.addEventListener('click',e=>{
        e.stopPropagation();
        const id=btn.dataset.id;
        const v=videos.find(x=>x.id===id);
        if(v) showInfo(v);
      });
    });
  }

  function play(v){
    current=v;
    title.textContent = v.title;
    frameWrap.innerHTML = `<iframe allowfullscreen loading="lazy"
      allow="clipboard-write; encrypted-media; picture-in-picture; fullscreen"
      referrerpolicy="strict-origin-when-cross-origin"
      sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
      src="https://www.tiktok.com/embed/v2/${v.id}"></iframe>`;
    aiHintForCurrent();
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

  // AI：把當前影片摘要丟進對話視窗（被動提示）
  function aiHintForCurrent(){
    if(!aiMsgs || !current) return;
    appendMsg('assistant',
      `目前影片\n標題：${current.title}\n上傳日期：${current.date||'未知'}\n連結：${current.link}`);
  }

  // AI：是否屬於影片簡問
  function isVideoQuestion(q){
    return /(標題|叫什麼|片名|什麼時候|何時|上傳|日期|連結|網址|音檔|配樂|標籤|tag|置頂)/i.test(q);
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

  // ---- 小工具 ----
  function escapeHTML(s){return String(s).replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));}
  function linkifyIfURL(text){
    const urlMatch = String(text).match(/https?:\/\/[^\s]+/i);
    if(!urlMatch) return escapeHTML(text);
    const url = urlMatch[0];
    const before = String(text).slice(0, urlMatch.index);
    const after  = String(text).slice(urlMatch.index + url.length);
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

  // CSV 解析（含引號）
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