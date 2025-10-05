/* ===== Deer QA WebApp v1.8.6 =====
 * 全功能：AI麋鹿 / 頁面搜尋 / 導覽 / 更新提示
 * 安全事件綁定，避免 null.addEventListener
 * 建議按鈕不再觸發「來源與信心」
 * 圖片設定集中：IMAGES.網站圖、IMAGES.AI圖
 */

/* ---- 基本工具 ---- */
function norm(s){return (s||'').toLowerCase().trim();}
function clamp(min,max,x){if(x<min)return min;if(x>max)return max;return x;}

/* ---- 常數 ---- */
const STATE={pageSize:30,page:1,filtered:[...window.DEER_QA],highlight:''};
const ALIASES=['鹿比醬','鹿比酱','鹿🦌','鹿鹿','鹿','小鹿','麋鹿','deer','ld','ld.1003_','xxx103__'];
const IMAGES={'網站圖':'Logo.png','AI圖':'AI.png'};

/* ---- 啟動 ---- */
document.addEventListener('DOMContentLoaded',init);
function init(){
  safeOn('search','input',e=>{STATE.highlight=e.target.value.trim();applyFilter(STATE.highlight);});
  safeOn('clear','click',()=>{const s=id('search');if(s){s.value='';STATE.highlight='';applyFilter('');}});
  safeOn('prev','click',()=>gotoPage(STATE.page-1));
  safeOn('next','click',()=>gotoPage(STATE.page+1));
  safeOn('page','change',e=>gotoPage(parseInt(e.target.value||'1',10)));

  safeOn('cg-close','click',closeChangelog);
  safeOn('ft-share','click',shareSite);
  safeOn('ft-install','click',openInstallTip);
  safeOn('ins-close','click',closeInstallTip);

  safeOn('ai-fab','click',openAI);
  safeOn('ai-close','click',closeAI);
  safeOn('ai-form','submit',onAsk);

  const aiMsgs=id('ai-messages');
  if(aiMsgs)aiMsgs.addEventListener('click',e=>{
    const btn=e.target.closest('.s-btn');
    if(btn){
      e.preventDefault();e.stopPropagation();
      const box=id('ai-text'); if(!box) return;
      box.value=btn.dataset.sug;
      id('ai-form')?.dispatchEvent(new Event('submit',{cancelable:true}));
    }
  });

  initStats();
  render();
  firstTour();
  showChangelogIfNew("2.1");
}

/* ---- 安全綁定 ---- */
function safeOn(elId,evt,fn){const el=document.getElementById(elId);if(el)el.addEventListener(evt,fn);}

/* ---- 搜尋系統（傳統比對） ---- */
function initStats(){const t=qs('#stat-total');if(t)t.textContent=String(window.DEER_QA.length);}
function applyFilter(keyword){
  const k=norm(keyword);
  STATE.filtered = k ? window.DEER_QA.filter(x=>norm(x.q).includes(k)||norm(x.a).includes(k))
                     : [...window.DEER_QA];
  STATE.page=1; render();
}
function render(){
  const total=STATE.filtered.length;
  const pages=Math.max(1,Math.ceil(total/STATE.pageSize));
  STATE.page=Math.min(Math.max(1,STATE.page),pages);

  qs('#stat-filtered')&&(qs('#stat-filtered').textContent=total);
  qs('#stat-page')&&(qs('#stat-page').textContent=STATE.page);
  qs('#stat-pages')&&(qs('#stat-pages').textContent=pages);
  id('page')&&(id('page').value=STATE.page);
  id('pages')&&(id('pages').textContent=pages);

  const start=(STATE.page-1)*STATE.pageSize;
  const items=STATE.filtered.slice(start,start+STATE.pageSize);

  const $list=id('qa-list'); if(!$list) return;
  $list.innerHTML=items.map(renderItem).join('');

  $list.querySelectorAll('.q').forEach(btn=>{
    btn.addEventListener('click',()=>toggleItem(btn.closest('.item')));
    btn.addEventListener('keydown',e=>{
      if(['Enter',' '].includes(e.key)){e.preventDefault();toggleItem(btn.closest('.item'));}
    });
  });
  $list.querySelectorAll('[data-copy]').forEach(el=>{
    el.addEventListener('click',()=>{
      const qa=getItem(el);
      navigator.clipboard.writeText(`Q: ${qa.q}\nA: ${qa.a}`);
      toast('已複製 Q&A');
    });
  });
}
function renderItem(it){
  const hi=STATE.highlight?highlight(idPrefix(it),STATE.highlight):idPrefix(it);
  const idAttr=`q-${it.id}`;
  return `
  <article class="item" data-id="${it.id}" id="${idAttr}">
    <div class="q" role="button" tabindex="0" aria-expanded="false" aria-controls="${idAttr}-a">
      <span>${hi}</span>
      <svg class="chev" width="18" height="18" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2"/></svg>
    </div>
    <div class="a" id="${idAttr}-a">
      <div class="a-inner">
        <div>${linkify(it.a)}</div>
        <div class="tools"><span class="tool" data-copy>複製</span></div>
      </div>
    </div>
  </article>`;
}
function idPrefix(it){return `<span class="qid">#${it.id}</span>${escapeHTML(it.q)}`;}
function toggleItem($item){
  const $ans=$item.querySelector('.a');
  const open=$item.classList.toggle('open');
  $item.querySelector('.q').setAttribute('aria-expanded',open?'true':'false');
  if(open){
    $ans.style.height='auto'; const h=$ans.clientHeight+'px';
    $ans.style.height='0px'; requestAnimationFrame(()=>{$ans.style.height=h;});
  }else{
    $ans.style.height=$ans.clientHeight+'px';
    requestAnimationFrame(()=>{$ans.style.height='0px';});
  }
}
function gotoPage(p){STATE.page=p;render();window.scrollTo({top:0,behavior:'smooth'});}
function getItem(el){const idv=el.closest('.item').dataset.id;return window.DEER_QA.find(x=>String(x.id)===String(idv));}

/* ---- 新手導覽（頁面無 #tour 自動跳過） ---- */
let TOUR_IDX=0;
function firstTour(){ if(!id('tour')) return; if(localStorage.getItem('tour_done_v2')) return; openTour(); }
function openTour(){ const el=id('tour'); if(!el) return; el.classList.remove('hidden'); TOUR_IDX=0; showStep(0); }
function tourStep(d){ showStep(TOUR_IDX+d); }
function endTour(){ const el=id('tour'); if(!el) return; el.classList.add('hidden'); localStorage.setItem('tour_done_v2','1'); }
function showStep(i){ const box=id('tour'); if(!box) return; const steps=[...box.querySelectorAll('.tour-step')]; if(i<0||i>=steps.length) return; steps.forEach(s=>s.classList.add('hidden')); steps[i].classList.remove('hidden'); TOUR_IDX=i; }

/* ---- 更新公告 ---- */
function showChangelogIfNew(ver){
  id('ver')&&(id('ver').textContent=ver);
  id('cg-date')&&(id('cg-date').textContent=new Date().toISOString().slice(0,10));
  const key='changelog_'+ver;
  if(id('changelog') && !localStorage.getItem(key)){ openChangelog(); localStorage.setItem(key,'1'); }
}
function openChangelog(){ id('changelog')?.classList.remove('hidden'); }
function closeChangelog(){ id('changelog')?.classList.add('hidden'); }

/* ---- 頁尾功能 ---- */
async function shareSite(){
  const url=location.href.split('#')[0];
  if(navigator.share){ try{ await navigator.share({title:document.title,url}); }catch{} }
  else{ await navigator.clipboard.writeText(url); toast('已複製網址'); }
}
function openInstallTip(){ id('install-tip')?.classList.remove('hidden'); }
function closeInstallTip(){ id('install-tip')?.classList.add('hidden'); }

/* ---- AI麋鹿 ---- */
function openAI(){
  const p=id('ai-panel'); if(!p) return;
  p.classList.remove('hidden'); requestAnimationFrame(()=>p.classList.add('show'));
  if(!p.dataset.boot){
    pushMsg('assistant','嗨～麋鹿你好，你可以告訴我你的問題，我會根據資料庫找出答案或提供你類似的問題。我不是鹿🦌本人，我只是工程師開發出來的AI機器人。祝你有個美好的一天😊');
    pushMsg('assistant','小提醒：在這個網站都叫做鹿🦌所以在問問題時綽號請使用「鹿🦌」。例如：❌主播多高？ ❌鹿比醬多高？  ✅鹿🦌多高？  ✅️鹿鹿多高？');
    p.dataset.boot='1';
  }
}
function closeAI(){ const p=id('ai-panel'); if(!p) return; p.classList.remove('show'); setTimeout(()=>p.classList.add('hidden'),180); }

async function onAsk(e){
  e.preventDefault();
  const input=id('ai-text'); if(!input) return;
  const text=(input.value||'').trim(); if(!text) return;
  input.value='';
  pushMsg('user',text);

  const typing=pushTyping();
  const ans=await localAnswer(text);
  typing.remove();

  const msg=pushMsg('assistant',ans.rendered);
  msg.dataset.sourceQ=ans.sourceQ||'';
  msg.dataset.conf=ans.confidence.toString();

  // 只在非點擊建議按鈕時才開來源與信心
  msg.querySelector('.bubble').addEventListener('click',(ev)=>{
    if(ev.target.closest('.s-btn')) return;
    showExplain(msg.dataset.sourceQ, Number(msg.dataset.conf));
  });

  scrollBottom();
}

/* ---- AI說明 ---- */
function showExplain(q,conf){
  if(!q){ toast('此回覆沒有可顯示的來源'); return; }
  const box=document.createElement('div');
  box.className='modal';
  box.innerHTML=`
    <div class="modal-card small">
      <div class="modal-header"><h2 class="title">來源與信心</h2><button class="btn ghost" id="exp-close">關閉</button></div>
      <div class="modal-body">
        <p><strong>原本的Q：</strong>${escapeHTML(q)}</p>
        <p><strong>信心程度：</strong>${formatConfidence(conf)}</p>
      </div>
    </div>`;
  document.body.appendChild(box);
  box.querySelector('#exp-close').addEventListener('click',()=>box.remove());
}

/* ---- AI檢索核心 ---- */
let IDF=null;
function buildIDF(){
  if(IDF) return IDF;
  const docs=window.DEER_QA.map(x=>norm(removeAliases(x.q+' '+x.a)));
  const df=new Map();
  docs.forEach(d=>{
    const terms=new Set(tokenize(d));
    terms.forEach(t=>df.set(t,(df.get(t)||0)+1));
  });
  const N=docs.length;
  IDF=(term)=>Math.log(1 + N/((df.get(term)||0)+0.5));
  return IDF;
}
async function localAnswer(query){
  const qClean=removeAliases(query);
  const scored=rank(qClean);
  if(!scored.length || scored[0].score<0.18){
    return {rendered:"Q：查無符合題目<br>A：目前資料庫沒有這題。",sourceQ:"",confidence:0.2};
  }
  const top=scored[0];
  const second=scored[1]||{score:top.score};

  // 動態信心
  const topK=scored.slice(0,Math.min(10,scored.length));
  const maxS=Math.max(...topK.map(s=>s.score));
  const minS=Math.min(...topK.map(s=>s.score));
  const normS=(top.score-minS)/Math.max(1e-6,(maxS-minS));
  const margin=sigmoid((top.score-second.score)*6);
  const cov=coverage(norm(qClean), norm(removeAliases(top.item.q)));
  const conf=clamp(0.22,0.93, 0.6*normS + 0.25*margin + 0.15*cov);

  // 建議按鈕（button 型，避免 submit；並由委派處理點擊）
  const suggestions=scored.slice(1,4)
    .map(s=>`<button type="button" class="btn s-btn" data-sug="${escapeHTML(s.item.q)}">${escapeHTML(s.item.q)}</button>`)
    .join(' ');

  const rendered=
    `Q：${escapeHTML(top.item.q)}<br>`+
    `A：${escapeHTML(top.item.a).replace(/\n/g,'<br>')}`+
    (suggestions?`<div class="s-wrap" style="margin-top:8px">${suggestions}</div>`:'');
  return {rendered, sourceQ:top.item.q, confidence:conf};
}
function rank(q){
  const qn=norm(q);
  const idf=buildIDF();
  return window.DEER_QA.map(item=>{
    const q0=norm(removeAliases(item.q));
    const a0=norm(removeAliases(item.a));
    const doc=q0+' '+a0;

    const sJ=jaccard(qn,doc);                          // 3-gram Jaccard
    const vecQ=tfidfVector(tokenize(qn),idf);
    const vecD=tfidfVector(tokenize(doc),idf);
    const sC=cosine(vecQ,vecD);                         // TF-IDF 餘弦
    const cov=coverage(qn,q0);                          // 覆蓋率
    const pos=positionBoost(qn,q0);                     // 位置加分
    const exact=q0.includes(qn)?0.08:0;                 // 精確包含

    const score=0.50*sJ + 0.30*sC + 0.12*cov + 0.06*pos + exact;
    return {item,score};
  }).sort((a,b)=>b.score-a.score);
}

/* ---- 相似度與工具 ---- */
function tokenize(s){return[...s.matchAll(/[\p{Script=Han}]|[a-zA-Z0-9_]+/gu)].map(m=>m[0]);}
function tfidfVector(tokens,idf){
  const tf=new Map(); tokens.forEach(t=>tf.set(t,(tf.get(t)||0)+1));
  const vec=new Map(); for(const [t,f] of tf){ vec.set(t,(1+Math.log(f))*idf(t)); }
  return vec;
}
function cosine(a,b){
  let dot=0,na=0,nb=0;
  for(const [t,wa] of a){ const wb=b.get(t)||0; dot+=wa*wb; na+=wa*wa; }
  for(const [,wb] of b){ nb+=wb*wb; }
  return na&&nb? dot/Math.sqrt(na*nb) : 0;
}
function jaccard(a,b){
  const A=new Set(ngrams(a,3)), B=new Set(ngrams(b,3));
  const inter=[...A].filter(x=>B.has(x)).length;
  return inter/(new Set([...A,...B]).size||1);
}
function coverage(q,text){
  if(!q) return 0;
  const parts=q.split(/\s+/).filter(Boolean);
  const hit=parts.filter(p=>text.includes(p)).length;
  return hit/parts.length;
}
function positionBoost(q,text){ return text.startsWith(q.slice(0,4))?0.05:0; }
function removeAliases(s){
  let out=s;
  ALIASES.forEach(a=>{
    const re=new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');
    out=out.replace(re,'');
  });
  return out.replace(/[🦌🐭🐱]/g,'');
}
function sigmoid(x){ return 1/(1+Math.exp(-x)); }

/* ---- 視覺與互動 ---- */
function pushMsg(role,content){
  const wrap=document.createElement('div'); wrap.className=`msg ${role}`;
  const av=document.createElement('div'); av.className=`avatar ${role==='assistant'?'assistant':''}`;
  av.innerHTML = role==='assistant'
    ? `<img alt="AI圖" src="${IMAGES['AI圖']}">`
    : `<svg viewBox="0 0 24 24"><path fill="#aab0d6" d="M12 12a5 5 0 1 0 0-10a5 5 0 0 0 0 10Zm-7 9c0-3.3 2.7-6 6-6h2c3.3 0 6 2.7 6 6H5Z"/></svg>`;
  const body=document.createElement('div'); body.className='body';
  body.innerHTML = `<div class="role">${role==='user'?'你':'AI麋鹿'}</div><div class="bubble">${content}</div>`;
  wrap.appendChild(av); wrap.appendChild(body);
  id('ai-messages')?.appendChild(wrap);
  return wrap;
}
function pushTyping(){
  const wrap=document.createElement('div'); wrap.className='msg typing assistant';
  wrap.innerHTML = `
    <div class="avatar assistant"><img alt="AI圖" src="${IMAGES['AI圖']}"></div>
    <div class="body"><div class="role">AI麋鹿</div><div class="bubble">
      <span class="dot"></span><span class="dot"></span><span class="dot"></span>
    </div></div>`;
  id('ai-messages')?.appendChild(wrap);
  scrollBottom();
  return wrap;
}

/* ---- 通用 ---- */
function id(s){return document.getElementById(s);}
function qs(s){return document.querySelector(s);}
function ngrams(s,n=3){const arr=[];const pad=` ${s} `;for(let i=0;i<pad.length-n+1;i++)arr.push(pad.slice(i,i+n));return arr;}
function highlight(text,key){const k=key.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return text.replace(new RegExp(`(${k})`,'ig'),'<mark>$1</mark>');}
function linkify(a){return a.replace(/(https?:\/\/[^\s)]+)(?![^<]*>)/g,'<a class="link" target="_blank" rel="noopener">$1</a>');}
function toast(msg){
  const el=document.createElement('div');
  Object.assign(el.style,{position:'fixed',left:'50%',bottom:'24px',transform:'translateX(-50%)',background:'#141a34',color:'#fff',padding:'10px 14px',borderRadius:'12px',border:'1px solid rgba(255,255,255,.12)',boxShadow:'0 10px 30px rgba(0,0,0,.4)',zIndex:1000});
  el.textContent=msg; document.body.appendChild(el);
  setTimeout(()=>{el.style.transition='opacity .3s'; el.style.opacity='0';},1400);
  setTimeout(()=>el.remove(),1750);
}
function escapeHTML(s){return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function scrollBottom(){const m=id('ai-messages'); if(m) m.scrollTop=m.scrollHeight;}
function formatConfidence(c){
  const pct=Math.round(c*100);
  let level='中等';
  if(c>=0.85) level='極高';
  else if(c>=0.7) level='高';
  else if(c>=0.5) level='中';
  else if(c>=0.35) level='偏低';
  else level='低';
  return `${pct}%（${level}）`;
}