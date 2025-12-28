/* =====================================================
   Deer Videos Module
   Version: v1.2 (stabilized)
   -----------------------------------------------------
   職責：
   - 管理「影片清單 / 播放 / 標籤篩選」
   - 僅負責 Video 分頁相關 DOM
   - 不假設 Video tab 一定已顯示
   -----------------------------------------------------
   ⚠️ 重要原則：
   - 所有 DOM 操作前必須確認節點存在
   - GitHub Pages / CDN 環境下，初始化順序不可假設
   ===================================================== */
(function(){

  /* =========================
     DOM 工具（區域使用）
     ========================= */
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const on = (el,ev,fn) => el && el.addEventListener(ev,fn);

  /* =========================
     本機互動功能開關
     ========================= */
  const LOCAL_INTERACTIONS_ENABLED = false;

  /* =========================
     模組狀態（不與外界共享）
     ========================= */
  const STATE = {
    pageSize: 12,
    page: 1,
    pages: 1,
    videos: [],
    filtered: [],
    tagFilter: new Set(),
    showFavOnly: false,
    current: null
  };

  /* =========================
     Video 專用 DOM（可能為 null）
     ========================= */
  const el = {
    list:        $('#v-list'),
    tagsFilter:  $('#v-tags-filter'),
    search:      $('#v-search'),
    sort:        $('#v-sort'),
    prev:        $('#v-prev'),
    next:        $('#v-next'),
    page:        $('#v-page'),
    pages:       $('#v-pages'),
    latest:      $('#v-latest'),
    random:      $('#v-random'),
    title:       $('#v-title'),
    date:        $('#v-date'),
    frame:       $('#v-frame'),
    tags:        $('#v-tags')
  };

  /* =====================================================
     初始化入口
     - 若 DOM 尚未完成，延後再跑
     ===================================================== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }

  async function init(){
    STATE.videos = await loadVideos();
    buildTagChips();     // ⚠️ 內部已防呆
    route_latest();      // ⚠️ 內部已防呆
    bindEvents();        // ⚠️ 僅在 DOM 存在時綁定
  }

  /* =====================================================
     資料載入（TSV → JSON fallback）
     ===================================================== */
  async function loadVideos(){
    try{
      const r = await fetch('videos.tsv',{cache:'no-store'});
      if(r.ok){
        return parseTSV(await r.text());
      }
    }catch{}
    try{
      const r = await fetch('videos.json',{cache:'no-store'});
      if(r.ok){
        return (await r.json()).map(v=>({
          ...v,
          tags: limitTags(cleanTags(v.tags||[]))
        }));
      }
    }catch{}
    return [];
  }

  /* =====================================================
     標籤 Chips（⚠️ Video DOM 未存在時直接跳過）
     ===================================================== */
  function buildTagChips(){
    if(!el.tagsFilter) return;

    const all = [...new Set(STATE.videos.flatMap(v=>v.tags||[]))].slice(0,30);
    el.tagsFilter.innerHTML = all
      .map(t=>`<button class="tag" data-tag="${t}">#${t}</button>`)
      .join('');

    $$('#v-tags-filter .tag').forEach(btn=>{
      on(btn,'click',()=>{
        const tag = btn.dataset.tag;
        STATE.tagFilter.has(tag)
          ? STATE.tagFilter.delete(tag)
          : STATE.tagFilter.add(tag);
        btn.classList.toggle('active');
        applyFilter();
      });
    });
  }

  /* =====================================================
     清單渲染（⚠️ el.list 可能為 null）
     ===================================================== */
  function renderList(){
    if(!el.list) return;

    const start = (STATE.page-1)*STATE.pageSize;
    const items = STATE.filtered.slice(start,start+STATE.pageSize);

    el.list.innerHTML = items.length
      ? items.map(cardHTML).join('')
      : `<div class="muted">沒有影片</div>`;

    el.page && (el.page.value = STATE.page);
    el.pages && (el.pages.textContent = STATE.pages);

    $$('#v-list .card').forEach(c=>{
      on(c,'click',()=>{
        const v = STATE.filtered.find(x=>x.id===c.dataset.id);
        if(v) play(v);
      });
    });
  }

  /* =====================================================
     播放影片（⚠️ 全部防呆）
     ===================================================== */
  function play(v){
    STATE.current = v;

    el.title && (el.title.textContent = v.title);
    el.date  && (el.date.textContent  = v.date);

    if(el.tags){
      const chips = (v.tags||[]).map(t=>`<span class="tag">#${t}</span>`).join('');
      el.tags.innerHTML = chips;
    }

    if(el.frame){
      const id = v.url.match(/\/video\/(\d+)/)?.[1] || '';
      el.frame.innerHTML =
        `<iframe allowfullscreen loading="lazy"
          src="https://www.tiktok.com/embed/v2/${id}">
        </iframe>`;
    }
  }

  /* =====================================================
     篩選 / 排序 / 路由
     ===================================================== */
  function applyFilter(){
    if(!el.search || !el.sort) return;

    const q = (el.search.value||'').toLowerCase();
    let arr = STATE.videos.filter(v =>
      v.title.toLowerCase().includes(q) ||
      (v.tags||[]).some(t=>t.toLowerCase().includes(q))
    );

    if(STATE.tagFilter.size){
      arr = arr.filter(v =>
        (v.tags||[]).some(t=>STATE.tagFilter.has(t))
      );
    }

    const s = el.sort.value;
    if(s==='newest') arr.sort((a,b)=>new Date(b.date)-new Date(a.date));
    if(s==='oldest') arr.sort((a,b)=>new Date(a.date)-new Date(b.date));

    STATE.filtered = arr;
    STATE.pages = Math.max(1, Math.ceil(arr.length/STATE.pageSize));
    STATE.page = Math.min(STATE.page, STATE.pages);

    renderList();
  }

  function route_latest(){
    STATE.page = 1;
    applyFilter();
    if(STATE.filtered[0]) play(STATE.filtered[0]);
  }

  /* =====================================================
     事件綁定（僅在 DOM 存在時）
     ===================================================== */
  function bindEvents(){
    on(el.search,'input',()=>{STATE.page=1;applyFilter();});
    on(el.sort,'change',()=>{STATE.page=1;applyFilter();});
    on(el.prev,'click',()=>{STATE.page=Math.max(1,STATE.page-1);renderList();});
    on(el.next,'click',()=>{STATE.page=Math.min(STATE.pages,STATE.page+1);renderList();});
    on(el.latest,'click',route_latest);
    on(el.random,'click',()=>{STATE.filtered=STATE.videos.slice().sort(()=>Math.random()-.5);renderList();});
  }

  /* =========================
     小工具
     ========================= */
  function cleanTags(tags){
    return String(tags||'')
      .split(/[,，、]+/)
      .map(s=>s.trim().replace(/^#+/,''))
      .filter(s=>s && s.length<=24);
  }
  function limitTags(arr){ return [...new Set(arr)].slice(0,6); }
  function cardHTML(v){
    return `
      <article class="card" data-id="${v.id}">
        <div class="title">${v._pinned?'📌 ':''}${v.title}</div>
        <div class="sub">${v.date}</div>
      </article>`;
  }

})();
