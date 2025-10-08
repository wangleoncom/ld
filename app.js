/* ===== Deer QA WebApp v1.8.7 (final) =====
 * 功能：AI麋鹿 / 頁面搜尋 / 導覽 / 公告
 * 重點：回答信心「只在使用者點 AI 泡泡時」以單一最上層 Modal 顯示
 * 清理：移除重複 onSubmit 與信心條程式、統一事件來源
 */

/* ---- 基本工具 ---- */
function norm(s){ return (s||'').toLowerCase().trim(); }
function clamp(min,max,x){ if(x<min)return min; if(x>max)return max; return x; }
function id(s){ return document.getElementById(s); }
function qs(s){ return document.querySelector(s); }

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

  // 建議快速鍵委派（避免重綁）
  const aiMsgs=id('ai-messages');
  if(aiMsgs)aiMsgs.addEventListener('click',e=>{
    const sug=e.target.closest('.s-btn');
    if(!sug) return;
    e.preventDefault(); e.stopPropagation();
    const box=id('ai-text'); if(!box) return;
    box.value=sug.dataset.sug||'';
    id('ai-form')?.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
  });

  // 單一路徑送出（無 onAsk）
  wireAIForm();

  initStats();
  render();
  firstTour();
  showChangelogIfNew("2.1");

  // iOS 100vh 修正
  const setVH=()=>document.documentElement.style.setProperty('--vh', window.innerHeight*0.01+'px');
  setVH(); window.addEventListener('resize',setVH); window.addEventListener('orientationchange',setVH);
}

/* ---- 安全綁定 ---- */
function safeOn(elId,evt,fn){const el=document.getElementById(elId); if(el) el.addEventListener(evt,fn);}

/* ---- 搜尋（傳統比對） ---- */
function initStats(){const t=qs('#stat-total'); if(t) t.textContent=String(window.DEER_QA.length);}
function applyFilter(keyword){
  const k=norm(keyword);
  STATE.filtered = k ? window.DEER_QA.filter(x=>norm(x.q).includes(k)||norm(x.a).includes(k)) : [...window.DEER_QA];
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

/* ---- 新手導覽 ---- */
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

/* ---- AI麋鹿面板 ---- */
function openAI(){
  const p=id('ai-panel'); if(!p) return;
  p.classList.remove('hidden'); requestAnimationFrame(()=>p.classList.add('show'));
  if(!p.dataset.boot){
    pushMsg('assistant','嗨～麋鹿你好，你可以告訴我你的問題，我會根據資料庫找出答案或提供你類似的問題。');
    p.dataset.boot='1';
  }
}
function closeAI(){ const p=id('ai-panel'); if(!p) return; p.classList.remove('show'); setTimeout(()=>p.classList.add('hidden'),180); }

/* ---- 常見問法展開 ---- */
const PHRASE_SYNS = new Map([
  ['主播多高','身高多高'],
  ['主播好高','身高多高'],
  ['身高多少','身高多高'],
  ['多高','身高'],
  ['主播幾公分','身高']
]);
function expandQuery(q){
  const nq=norm(q); let out=q;
  PHRASE_SYNS.forEach((canon,variant)=>{ if(nq.includes(norm(variant))) out+=' '+canon; });
  return out;
}

/* ---- AI 檢索核心 ---- */
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
  const qClean=removeAliases(expandQuery(query));
  const scored=rank(qClean);
  if(!scored.length || scored[0].score<0.18){
    return {rendered:"Q：查無符合題目<br>A：目前資料庫沒有這題。",sourceQ:"",confidence:0.2};
  }
  const top=scored[0];
  const second=scored[1]||{score:top.score};

  const topK=scored.slice(0,Math.min(10,scored.length));
  const maxS=Math.max(...topK.map(s=>s.score));
  const minS=Math.min(...topK.map(s=>s.score));
  const normS=(top.score-minS)/Math.max(1e-6,(maxS-minS));
  const margin=sigmoid((top.score-second.score)*6);
  const cov=coverage(norm(qClean), norm(removeAliases(top.item.q)));
  const conf=clamp(0.22,0.93, 0.6*normS + 0.25*margin + 0.15*cov);

  const suggestions=scored.slice(1,4)
    .map(s=>`<button type="button" class="btn s-btn" data-sug="${escapeHTML(s.item.q)}">${escapeHTML(s.item.q)}</button>`)
    .join(' ');

  const rendered =
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

    const sJ=jaccard(qn,doc);
    const vecQ=tfidfVector(tokenize(qn),idf);
    const vecD=tfidfVector(tokenize(doc),idf);
    const sC=cosine(vecQ,vecD);
    const cov=coverage(qn,q0);
    const pos=positionBoost(qn,q0);
    const exact=q0.includes(qn)?0.08:0;

    const score=0.50*sJ + 0.30*sC + 0.12*cov + 0.06*pos + exact;
    return {item,score};
  }).sort((a,b)=>b.score-a.score);
}

/* ---- 相似度工具 ---- */
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
function jaccard(a,b){ const A=new Set(ngrams(a,3)), B=new Set(ngrams(b,3)); const inter=[...A].filter(x=>B.has(x)).length; return inter/(new Set([...A,...B]).size||1); }
function coverage(q,text){ if(!q) return 0; const parts=q.split(/\s+/).filter(Boolean); const hit=parts.filter(p=>text.includes(p)).length; return hit/parts.length; }
function positionBoost(q,text){ return text.startsWith(q.slice(0,4))?0.05:0; }
function ngrams(s,n=3){const arr=[];const pad=` ${s} `;for(let i=0;i<pad.length-n+1;i++)arr.push(pad.slice(i,i+n));return arr;}
function removeAliases(s){
  let out=s;
  ALIASES.forEach(a=>{
    const re=new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');
    out=out.replace(re,'');
  });
  return out.replace(/[🦌🐭🐱]/g,'');
}
function sigmoid(x){ return 1/(1+Math.exp(-x)); }

/* ---- 視覺與互動（聊天） ---- */
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
function scrollBottom(){const m=id('ai-messages'); if(m) m.scrollTop=m.scrollHeight;}

/* ---- Linkify（避免連結把版面撐爆） ---- */
function linkify(a){
  return a.replace(
    /(https?:\/\/[^\s)]+)(?![^<]*>)/g,
    '<a class="link" target="_blank" rel="noopener" href="$1">$1</a>'
  );
}

/* ---- 雜項 ---- */
function highlight(text,key){const k=key.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return text.replace(new RegExp(`(${k})`,'ig'),'<mark>$1</mark>');}
function toast(msg){
  const el=document.createElement('div');
  Object.assign(el.style,{position:'fixed',left:'50%',bottom:'24px',transform:'translateX(-50%)',background:'#141a34',color:'#fff',padding:'10px 14px',borderRadius:'12px',border:'1px solid rgba(255,255,255,.12)',boxShadow:'0 10px 30px rgba(0,0,0,.4)',zIndex:2147483646});
  el.textContent=msg; document.body.appendChild(el);
  setTimeout(()=>{el.style.transition='opacity .3s'; el.style.opacity='0';},1400);
  setTimeout(()=>el.remove(),1750);
}
function escapeHTML(s){return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
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

/* =========================
   單一路徑：AI 表單送出
   - 不自動顯示信心
   - 點 AI 回覆泡泡才開單一最上層 Modal
========================= */
let aiBusy=false;
function wireAIForm(){
  const form=id('ai-form'), ipt=id('ai-text'), list=id('ai-messages');
  if(!form||!ipt||!list) return;

  // 送出
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if(aiBusy) return;
    const q=(ipt.value||'').trim(); if(!q) return;

    aiBusy=true; ipt.value='';
    pushMsg('user',q);
    const typing=pushTyping();
    try{
      const ans=await localAnswer(q);
      typing.remove();
      const msg=pushMsg('assistant',ans.rendered);
      msg.dataset.sourceQ=ans.sourceQ||'';
      msg.dataset.conf=String(ans.confidence);
      // 點泡泡 → 顯示信心 Modal（且確保唯一）
      const bubble=msg.querySelector('.bubble');
      if(bubble){
        bubble.addEventListener('click',(ev)=>{
          if(ev.target.closest('.s-btn')) return; // 點建議按鈕不開
          openConfidenceModal(Number(msg.dataset.conf||0), msg.dataset.sourceQ||'');
        },{once:false});
      }
      scrollBottom();
    } finally { aiBusy=false; }
  });

  // 委派：歷史訊息點擊也能看
  list.addEventListener('click',(e)=>{
    const b=e.target.closest('.msg.assistant .bubble');
    if(!b) return;
    if(e.target.closest('.s-btn')) return;
    const msg=b.closest('.msg.assistant');
    openConfidenceModal(Number(msg?.dataset?.conf||0), msg?.dataset?.sourceQ||'');
  });
}

/* ---- 單一最上層：信心/來源 Modal ---- */
function closeTopModalIfAny(){
  // 僅關閉使用者點開的這種 Modal（避免關掉公告等系統彈窗）
  document.querySelectorAll('.modal.user-open').forEach(m=>m.remove());
}
function openConfidenceModal(conf, qText){
  closeTopModalIfAny();
  const box=document.createElement('div');
  box.className='modal user-open';
  box.style.zIndex='2147483647'; // 高於任何提示/公告
  const pct=(conf*100).toFixed(0);
  const level=conf>=0.85?'極高':conf>=0.7?'高':conf>=0.5?'中':conf>=0.35?'偏低':'低';
  box.innerHTML=`
    <div class="modal-card small">
      <div class="modal-header">
        <h2 class="title">來源與信心</h2>
        <button class="btn ghost" id="exp-close">關閉</button>
      </div>
      <div class="modal-body">
        <p><strong>原本的Q：</strong>${escapeHTML(qText||'（無）')}</p>
        <p><strong>信心程度：</strong>${pct}%（${level}）</p>
        <p class="muted" style="margin-top:.5rem">此分數由多種相似度與覆蓋率綜合計算，僅供參考。</p>
      </div>
    </div>`;
  document.body.appendChild(box);
  box.querySelector('#exp-close').addEventListener('click',()=>box.remove());
  box.addEventListener('click',(e)=>{ if(e.target===box) box.remove(); });
}

/* ---- 影片或其他外掛可用工具（保留） ---- */
function shareTop(){} // 佔位，若有需要再實作
function openInstallTip(){} function closeInstallTip(){}
function openChangelog(){} function closeChangelog(){}

/* ===== end ===== */