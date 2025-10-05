/* ===== Deer Video Minimal v2.0 (列表 + 隨機 + 資訊框 + 分頁切換) ===== */
(function(){
  const tabQA = document.getElementById('tab-qa');
  const tabVideo = document.getElementById('tab-video');
  const qaPanel = document.getElementById('qa-panel');
  const qaToolbar = document.getElementById('qa-toolbar');
  const qaStats = document.getElementById('qa-stats');
  const videoPanel = document.getElementById('video-panel');

  const frame = document.getElementById('v-frame');
  const list = document.getElementById('v-list');
  const title = document.getElementById('v-title');
  const infoBtn = document.getElementById('v-info-btn');
  const modal = document.getElementById('info-modal');
  const modalBody = document.getElementById('modal-body');
  const modalClose = document.getElementById('modal-close');
  const randomBtn = document.getElementById('v-random');

  let videos = [];
  let current = null;

  // 分頁切換
  tabQA?.addEventListener('click',()=>switchTab('qa'));
  tabVideo?.addEventListener('click',()=>switchTab('video'));
  function switchTab(which){
    if(which==='video'){
      tabVideo.classList.add('active'); tabVideo.setAttribute('aria-selected','true');
      tabQA.classList.remove('active'); tabQA.setAttribute('aria-selected','false');
      videoPanel.classList.remove('hidden'); qaPanel.classList.add('hidden');
      qaToolbar.style.display='none'; qaStats.style.display='none';
    }else{
      tabQA.classList.add('active'); tabQA.setAttribute('aria-selected','true');
      tabVideo.classList.remove('active'); tabVideo.setAttribute('aria-selected','false');
      qaPanel.classList.remove('hidden'); videoPanel.classList.add('hidden');
      qaToolbar.style.display='flex'; qaStats.style.display='grid';
    }
  }

  // 初始化
  init().catch(()=>{ frame.textContent='無法載入 videos.csv'; });

  async function init(){
    const csv = await fetch('videos.csv',{cache:'no-store'}).then(r=>r.text());
    const rows = parseCSV(csv);
    if(rows.length<=1){ frame.textContent='無影片資料'; return; }
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
    // 初始不自動播放，等使用者點清單；若要自動播放第一支，取消下一行註解
    // play(videos[0]);

    // 事件
    infoBtn.addEventListener('click',()=>{ if(current) showInfo(current); });
    modalClose.addEventListener('click',()=>modal.classList.add('hidden'));
    modal.addEventListener('click',e=>{ if(e.target===modal) modal.classList.add('hidden'); });
    randomBtn.addEventListener('click',()=>{ const v = videos[Math.floor(Math.random()*videos.length)]; play(v); });
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
        if(v) play(v);
        // 切到影片分頁
        switchTab('video');
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
    frame.innerHTML = `<iframe allowfullscreen loading="lazy"
      allow="clipboard-write; encrypted-media; picture-in-picture; fullscreen"
      referrerpolicy="strict-origin-when-cross-origin"
      sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
      src="https://www.tiktok.com/embed/v2/${v.id}"></iframe>`;
  }

  function showInfo(v){
    modalBody.innerHTML = `
      <p><b>影片連結：</b><a href="${v.link}" target="_blank" rel="noopener">${escapeHTML(v.link)}</a></p>
      <p><b>文字敘述：</b>${escapeHTML(v.desc||'（無）')}</p>
      <p><b>標籤：</b>${escapeHTML(v.tags||'（無）')}</p>
      <p><b>上傳日期：</b>${escapeHTML(v.date||'（未知）')}</p>
      <p><b>置頂：</b>${escapeHTML(v.pin||'否')}</p>
      <p><b>音檔：</b>${escapeHTML(v.audio||'（無）')}</p>
    `;
    modal.classList.remove('hidden');
  }

  function escapeHTML(s){return String(s).replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));}

  // CSV 解析（支援引號與逗號）
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