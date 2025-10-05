/* ===== Deer Videos v1.1 ===== */
(function(){
  const $=s=>document.querySelector(s);
  const $$=s=>Array.from(document.querySelectorAll(s));
  const on=(el,ev,fn)=>el&&el.addEventListener(ev,fn);

  const STATE={pageSize:12,page:1,filtered:[],videos:[],tagFilter:new Set(),showFavOnly:false,current:null,autoplay:false,queue:[]};

  const el={
    list:$('#v-list'),page:$('#v-page'),pages:$('#v-pages'),prev:$('#v-prev'),next:$('#v-next'),
    search:$('#v-search'),sort:$('#v-sort'),latest:$('#v-latest'),random:$('#v-random'),showFav:$('#v-show-fav'),
    tagsFilter:$('#v-tags-filter'),title:$('#v-title'),frame:$('#v-frame'),
    likeBtn:$('#v-like'),likeCount:$('#v-like-count'),favBtn:$('#v-fav'),copyBtn:$('#v-copy'),
    theaterBtn:$('#v-theater'),pipBtn:$('#v-pip'),date:$('#v-date'),tags:$('#v-tags'),
    autoplay:$('#v-autoplay'),cList:$('#c-list'),cForm:$('#c-form'),cName:$('#c-name'),cText:$('#c-text')
  };

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
    try{
      const r=await fetch('videos.tsv',{cache:'no-store'});
      if(r.ok){
        const t=await r.text();
        const lines=t.split(/\r?\n/).filter(x=>x.trim());
        const rows=lines[0].includes('影片連結')?lines.slice(1):lines;
        const arr=rows.map((l,i)=>{
          const [link,desc,tags,date,pin,audio]=l.split('\t');
          const id=(link.match(/\/video\/(\d{5,})/)||[])[1]||`tt-${i}`;
          const d=new Date(date);
          const dateStr=isNaN(d)?new Date().toISOString().slice(0,10):new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
          const tg=[...(tags?tags.split(/[,，\s]+/):[]),audio||'',isTrue(pin)?'置頂':''].filter(Boolean);
          return {id,title:desc||`TikTok ${id}`,platform:'tiktok',url:link,thumb:'',date:dateStr,tags:tg,_pinned:isTrue(pin)};
        });
        arr.sort((a,b)=>(Number(b._pinned)-Number(a._pinned))||(new Date(b.date)-new Date(a.date)));
        return arr;
      }
    }catch{}
    try{
      const r=await fetch('videos.json',{cache:'no-store'});if(r.ok)return await r.json();
    }catch{}
    return [];
  }
  const isTrue=v=>/^(true|1|是|y|yes)$/i.test(String(v||'').trim());
  const uniq=a=>Array.from(new Set(a));

  function buildTagChips(){
    const all=uniq(STATE.videos.flatMap(v=>v.tags||[]));
    el.tagsFilter.innerHTML=all.map(t=>`<button class="tag" data-tag="${t}">#${t}</button>`).join('');
    $$('.tags .tag').forEach(b=>on(b,'click',()=>{
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
      const favok=!STATE.showFavOnly||fav.has(v.id);
      return txt&&tag&&favok;
    });
    const s=el.sort.value;
    if(s==='newest')arr.sort((a,b)=>(Number(b._pinned)-Number(a._pinned))||(new Date(b.date)-new Date(a.date)));
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
    el.list.innerHTML=items.map(v=>`
      <article class="card" data-id="${v.id}">
        <div class="meta"><div class="title">${v._pinned?'📌 ':''}${v.title}</div>
        <div class="sub"><span>${v.date}</span></div></div></article>`).join('')||`<div class="muted">沒有影片</div>`;
    el.page.value=STATE.page;el.pages.textContent=STATE.pages;
    $$('#v-list .card').forEach(c=>on(c,'click',()=>{
      const v=STATE.filtered.find(x=>x.id===c.dataset.id);
      if(v)play(v);
    }));
  }

  function play(v){
    STATE.current=v;el.title.textContent=v.title;el.date.textContent=v.date;
    el.tags.innerHTML=(v.tags||[]).map(t=>`<span class="tag">#${t}</span>`).join('');
    const id=v.url.match(/\/video\/(\d+)/)?.[1]||'';
    el.frame.innerHTML=`<iframe allowfullscreen loading="lazy" src="https://www.tiktok.com/embed/v2/${id}"></iframe>`;
  }

  function route_latest(){el.sort.value='newest';STATE.page=1;applyFilter();if(STATE.filtered[0])play(STATE.filtered[0]);}
  function route_random(){STATE.page=1;STATE.filtered=STATE.videos.slice().sort(()=>Math.random()-.5);STATE.pages=Math.ceil(STATE.filtered.length/STATE.pageSize);renderList();if(STATE.filtered[0])play(STATE.filtered[0]);}

  function bindEvents(){
    on(el.search,'input',()=>{STATE.page=1;applyFilter();});
    on(el.sort,'change',()=>{STATE.page=1;applyFilter();});
    on(el.prev,'click',()=>{STATE.page=Math.max(1,STATE.page-1);renderList();});
    on(el.next,'click',()=>{STATE.page=Math.min(STATE.pages,STATE.page+1);renderList();});
    on(el.page,'change',()=>{STATE.page=Math.min(Math.max(1,Number(el.page.value||1)),STATE.pages);renderList();});
    on(el.latest,'click',route_latest);on(el.random,'click',route_random);
  }
})();