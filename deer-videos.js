/* ===== Deer Videos v1.2 =====
 * 變更：
 * - 只解析「標籤欄」，音檔改顯示文字，不再變成大量 tag
 * - 標籤最多顯示 6 個，剩餘以 +N 顯示
 * - 可關閉 本機收藏/留言/讚（避免被誤解為雲端同步）
 */
(function(){
  const $=s=>document.querySelector(s);
  const $$=s=>Array.from(document.querySelectorAll(s));
  const on=(el,ev,fn)=>el&&el.addEventListener(ev,fn);

  // 切換本機互動功能（收藏/留言/讚）。GitHub Pages 預設關閉。
  const LOCAL_INTERACTIONS_ENABLED = false;

  const STATE={pageSize:12,page:1,filtered:[],videos:[],tagFilter:new Set(),showFavOnly:false,current:null,autoplay:false,queue:[]};

  const el={
    list:$('#v-list'),page:$('#v-page'),pages:$('#v-pages'),prev:$('#v-prev'),next:$('#v-next'),
    search:$('#v-search'),sort:$('#v-sort'),latest:$('#v-latest'),random:$('#v-random'),showFav:$('#v-show-fav'),
    tagsFilter:$('#v-tags-filter'),title:$('#v-title'),frame:$('#v-frame'),
    likeBtn:$('#v-like'),likeCount:$('#v-like-count'),favBtn:$('#v-fav'),copyBtn:$('#v-copy'),
    theaterBtn:$('#v-theater'),pipBtn:$('#v-pip'),date:$('#v-date'),tags:$('#v-tags'),
    autoplay:$('#v-autoplay'),cList:$('#c-list'),cForm:$('#c-form'),cName:$('#c-name'),cText:$('#c-text')
  };

  // 如果關閉互動，隱藏相關 UI
  if(!LOCAL_INTERACTIONS_ENABLED){
    [el.likeBtn, el.favBtn].forEach(b=>b && (b.style.display='none'));
    el.showFav && (el.showFav.style.display='none');
    const commentsSection = document.querySelector('.comments');
    commentsSection && (commentsSection.style.display='none');
  }

  const ls={
    fav:()=>JSON.parse(localStorage.getItem('v:fav')||'[]'),
    setFav:v=>localStorage.setItem('v:fav',JSON.stringify(v)),
    like:id=>Number(localStorage.getItem('v:like:'+id)||0),
    setLike:(id,n)=>localStorage.setItem('v:like:'+id,String(n)),
    comments:id=>JSON.parse(localStorage.getItem('v:c:'+id)||'[]'),
    setComments:(id,arr)=>localStorage.setItem('v:c:'+id,JSON.stringify(arr))
  };

  const tabQA=$('#tab-qa'),tabVideo=$('#tab-video'),qaPanel=$('#qa-panel'),videoPanel=$('#video-panel'),
        qaToolbar=$('#qa-toolbar'),qaStats=$('#qa-stats');
  on(tabQA,'click',()=>switchTab('qa'));on(tabVideo,'click',()=>switchTab('video'));
  function switchTab(n){
    if(n==='qa'){tabQA.classList.add('active');tabVideo.classList.remove('active');
      qaPanel.classList.remove('hidden');videoPanel.classList.add('hidden');
      qaToolbar.style.display='flex';qaStats.style.display='grid';
    }else{tabVideo.classList.add('active');tabQA.classList.remove('active');
      videoPanel.classList.remove('hidden');qaPanel.classList.add('hidden');
      qaToolbar.style.display='none';qaStats.style.display='none';}
  }

  init();
  async function init(){
    STATE.videos=await loadVideos();
    buildTagChips();
    route_latest();
    bindEvents();
  }

  async function loadVideos(){
    // 先 TSV，再 JSON
    try{
      const r=await fetch('videos.tsv',{cache:'no-store'});
      if(r.ok){
        const t=await r.text();
        const rows=parseTSV(t);
        const arr=rows.map((cells,i)=>rowToVideo(cells,i));
        arr.sort(sortPinnedNewest);
        return arr;
      }
    }catch{}
    try{
      const r=await fetch('videos.json',{cache:'no-store'});
      if(r.ok){
        const arr=await r.json();
        return arr.map(v=>({...v,_pinned:Boolean(v._pinned),tags:limitTags(cleanTags(v.tags||[]))})).sort(sortPinnedNewest);
      }
    }catch{}
    return [];
  }

  // 解析 TSV
  function parseTSV(text){
    const lines=text.split(/\r?\n/).filter(x=>x.trim());
    const body = lines[0].includes('影片連結') ? lines.slice(1) : lines;
    return body.map(line=>line.split('\t'));
  }

  // 單列轉物件：A連結 B描述 C標籤 D日期 E置頂 F音檔
  function rowToVideo([link,desc,tags,date,pin,audio],i){
    const id=(String(link).match(/\/video\/(\d{5,})/)||[])[1]||`tt-${i+1}`;
    const d=new Date(date);
    const dateStr=isNaN(d)?new Date().toISOString().slice(0,10):new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
    const tgs = limitTags(cleanTags(tags));
    const audioText = String(audio||'').trim(); // 只當說明，不做標籤
    return {
      id,
      title:(desc||`TikTok ${id}`).trim(),
      desc:(audioText ? `音檔：${audioText}` : ''), // 額外說明行
      platform:'tiktok',
      url:link,
      thumb:'',
      date:dateStr,
      tags:tgs,
      _pinned:isTrue(pin)
    };
  }

  const isTrue=v=>/^(true|1|是|y|yes)$/i.test(String(v||'').trim());
  const sortPinnedNewest=(a,b)=>(Number(b._pinned)-Number(a._pinned))||(new Date(b.date)-new Date(a.date));
  const uniq=a=>Array.from(new Set(a));

  // 清洗與限制標籤
  function cleanTags(tags){
    if(!tags) return [];
    // 支援逗號、全形逗點、頓號；移除開頭的 #；過長的字串會被丟棄
    return String(tags)
      .split(/[,，、]+/)
      .map(s=>s.trim().replace(/^#+/,''))
      .filter(s=>s && s.length<=24);
  }
  function limitTags(arr){
    const u=uniq(arr);
    return u.slice(0,6); // 最多 6 個
  }

  function buildTagChips(){
    const all=uniq(STATE.videos.flatMap(v=>v.tags||[]));
    const take = all.slice(0,30); // 過多時只做 30 個篩選籤
    el.tagsFilter.innerHTML=take.map(t=>`<button class="tag" data-tag="${t}">#${t}</button>`).join('');
    $$('#v-tags-filter .tag').forEach(b=>on(b,'click',()=>{
      const tag=b.dataset.tag;
      if(STATE.tagFilter.has(tag))STATE.tagFilter.delete(tag);else STATE.tagFilter.add(tag);
      b.classList.toggle('active');applyFilter();
    }));
  }

  function applyFilter(){
    const q=(el.search.value||'').toLowerCase();
    const fav=new Set(ls.fav());
    let arr=STATE.videos.filter(v=>{
      const txt=v.title.toLowerCase().includes(q)||(v.tags||[]).some(t=>t.toLowerCase().includes(q));
      const tag=STATE.tagFilter.size===0||(v.tags||[]).some(t=>STATE.tagFilter.has(t));
      const favok=!LOCAL_INTERACTIONS_ENABLED || !STATE.showFavOnly || fav.has(v.id);
      return txt&&tag&&favok;
    });
    const s=el.sort.value;
    if(s==='newest')arr.sort(sortPinnedNewest);
    if(s==='oldest')arr.sort((a,b)=>new Date(a.date)-new Date(b.date));
    if(s==='title')arr.sort((a,b)=>a.title.localeCompare(b.title,'zh-Hant'));

    STATE.filtered=arr;
    STATE.pages=Math.max(1,Math.ceil(arr.length/STATE.pageSize));
    STATE.page=Math.min(STATE.page,STATE.pages)||1;
    renderList();
  }

  function renderList(){
    const s=(STATE.page-1)*STATE.pageSize;
    const items=STATE.filtered.slice(s,s+STATE.pageSize);
    el.list.innerHTML=items.map(v=>cardHTML(v)).join('')||`<div class="muted">沒有影片</div>`;
    el.page.value=STATE.page;el.pages.textContent=STATE.pages;
    $$('#v-list .card').forEach(c=>on(c,'click',()=>{
      const v=STATE.filtered.find(x=>x.id===c.dataset.id);
      if(v)play(v);
    }));
  }

  function cardHTML(v){
    const chips = (v.tags||[]).map(t=>`<span class="tag">#${t}</span>`).join('');
    const extra = (v.tags||[]).length>6 ? `<span class="tag">+${(v.tags||[]).length-6}</span>` : '';
    return `
      <article class="card" data-id="${v.id}" tabindex="0" aria-label="${v.title}">
        <div class="meta">
          <div class="title">${v._pinned?'📌 ':''}${v.title}</div>
          <div class="sub"><span>${v.date}</span></div>
          <div class="chips">${chips}${extra}</div>
        </div>
      </article>`;
  }

  function play(v){
    STATE.current=v;
    el.title.textContent=v.title;
    el.date.textContent=v.date;
    // 標籤顯示（最多 6 個，餘數以 +N）
    const chips=(v.tags||[]).map(t=>`<span class="tag">#${t}</span>`).join('');
    const extra=(v.tags||[]).length>6?`<span class="tag">+${(v.tags||[]).length-6}</span>`:'';
    const desc=v.desc?`<div class="muted" style="margin-left:8px">${v.desc}</div>`:'';
    el.tags.innerHTML = chips + extra + desc;

    // 產生 TikTok 嵌入
    const id=v.url.match(/\/video\/(\d+)/)?.[1]||'';
    el.frame.innerHTML=`<iframe allowfullscreen loading="lazy" src="https://www.tiktok.com/embed/v2/${id}"></iframe>`;

    // 互動按鈕在關閉時不綁事件
    if(!LOCAL_INTERACTIONS_ENABLED) return;

    el.likeCount.textContent = ls.like(v.id);
    on(el.likeBtn,'click',()=>{ const n=ls.like(v.id)+1; ls.setLike(v.id,n); el.likeCount.textContent=n; });
    on(el.favBtn,'click',()=>{ const fav=new Set(ls.fav()); fav.has(v.id)?fav.delete(v.id):fav.add(v.id); ls.setFav(Array.from(fav)); });

    // 留言渲染與送出
    renderComments();
    el.cForm && on(el.cForm,'submit',e=>{
      e.preventDefault();
      const arr=ls.comments(v.id);
      const name=(el.cName.value||'訪客').slice(0,20);
      const text=(el.cText.value||'').trim();
      if(!text) return;
      arr.push({name,text,ts:Date.now()});
      ls.setComments(v.id,arr); el.cText.value=''; renderComments();
    });
  }

  function renderComments(){
    if(!STATE.current || !LOCAL_INTERACTIONS_ENABLED || !el.cList) return;
    const arr=ls.comments(STATE.current.id);
    el.cList.innerHTML = arr.slice().reverse().map(c=>`
      <div class="c-item">
        <div class="who">${c.name} ・ ${new Date(c.ts).toLocaleString()}</div>
        <div class="text">${escapeHTML(c.text)}</div>
      </div>`).join('') || `<div class="muted">還沒有留言</div>`;
  }

  function escapeHTML(s){return String(s).replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));}

  // 路由
  function route_latest(){el.sort.value='newest';STATE.page=1;applyFilter();if(STATE.filtered[0])play(STATE.filtered[0]);}
  function route_random(){STATE.page=1;STATE.filtered=STATE.videos.slice().sort(()=>Math.random()-.5);STATE.pages=Math.ceil(STATE.filtered.length/STATE.pageSize);renderList();if(STATE.filtered[0])play(STATE.filtered[0]);}

  function bindEvents(){
    on(el.search,'input',()=>{STATE.page=1;applyFilter();});
    on(el.sort,'change',()=>{STATE.page=1;applyFilter();});
    on(el.prev,'click',()=>{STATE.page=Math.max(1,STATE.page-1);renderList();});
    on(el.next,'click',()=>{STATE.page=Math.min(STATE.pages,STATE.page+1);renderList();});
    on(el.page,'change',()=>{STATE.page=Math.min(Math.max(1,Number(el.page.value||1)),STATE.pages);renderList();});
    on(el.latest,'click',route_latest);
    on(el.random,'click',route_random);
    if(!LOCAL_INTERACTIONS_ENABLED && el.showFav) el.showFav.disabled=true;
  }
})();