/* ========= 名稱別名與同義詞 ========= */
const nameAliases = {
  "主播": "鹿🦌",
  "鹿": "鹿🦌",
  "鹿鹿": "鹿🦌",
  "豬播": "鹿🦌",
  "豆哥": "鹿🦌",
  "豆個": "鹿🦌",
  "鹿比醬": "鹿🦌"
};

/* ========= QA & Bot 狀態 ========= */
const PAGE_SIZE = window.PAGE_SIZE || 30;
const state = {
  all: window.DEER_QA || [],
  bot: window.BOT_KNOWLEDGE || [],
  filtered: [],
  page: 1,
  query: ""
};

/* ========= DOM ========= */
const els = {
  list: document.getElementById('qaList'),
  pagination: document.getElementById('pagination'),
  search: document.getElementById('searchInput'),
  clearSearch: document.getElementById('clearSearch'),
  count: document.getElementById('resultCount'),
  fab: document.getElementById('deerFab'),
  chat: document.getElementById('deerChat'),
  closeChat: document.getElementById('closeChat'),
  chatLog: document.getElementById('chatLog'),
  chatForm: document.getElementById('chatForm'),
  chatText: document.getElementById('chatText'),
};

/* ========= 工具函式 ========= */
const norm = s => (s||"").toString().toLowerCase().trim();
function escapeHTML(str){
  return (str??'').toString()
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}
function linkify(text){
  return text.replace(/(https?:\/\/[^\s]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');
}
function levenshtein(a,b){
  const al=a.length,bl=b.length;
  if(!al) return bl; if(!bl) return al;
  const dp=Array.from({length:al+1},()=>Array(bl+1).fill(0));
  for(let i=0;i<=al;i++) dp[i][0]=i;
  for(let j=0;j<=bl;j++) dp[0][j]=j;
  for(let i=1;i<=al;i++){
    for(let j=1;j<=bl;j++){
      const cost=a[i-1]===b[j-1]?0:1;
      dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+cost);
    }
  }
  return dp[al][bl];
}

/* ========= QA 過濾與渲染 ========= */
function matchQuestion(item, query){
  if(!query) return true;
  const nq = norm(item.q);
  let uq = norm(query);
  Object.keys(nameAliases).forEach(alias => {
    if(uq.includes(norm(alias))) uq = uq.replace(new RegExp(norm(alias), 'g'), norm(nameAliases[alias]));
  });
  return nq.includes(uq);
}

function getPage(items, page, size = PAGE_SIZE) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * size;
  const slice = items.slice(start, start + size);
  return { slice, total, pages, page: p };
}

function render() {
  state.filtered = state.all.filter(item => matchQuestion(item, state.query));
  const { slice, total, pages, page } = getPage(state.filtered, state.page);
  state.page = page;

  els.list.setAttribute('aria-busy','true');
  els.list.innerHTML = slice.map(item => `
    <details class="qa-item" data-id="${item.id}">
      <summary class="qa-q">
        <div class="q-text">${escapeHTML(item.q)}</div>
        <div class="chev" aria-hidden="true"></div>
      </summary>
      <div class="content-wrap" style="display:none;">
        <div class="content">
          <div class="qa-a">${escapeHTML(item.a)}</div>
        </div>
      </div>
    </details>
  `).join('');
  els.list.setAttribute('aria-busy','false');

  els.count.textContent = `共 ${total} 筆結果，頁 ${page}/${pages}`;

  Array.from(els.list.querySelectorAll('details')).forEach(detail=>{
    const content = detail.querySelector('.content-wrap');
    detail.querySelector('summary').addEventListener('click', () => {
      content.style.display = content.style.display === 'none' ? 'block' : 'none';
    });
  });

  renderPagination(pages, page);
}

function renderPagination(totalPages, currentPage) {
  if (!els.pagination) return;
  els.pagination.innerHTML = '';

  const prev = document.createElement('button');
  prev.textContent = '上一頁';
  prev.disabled = currentPage <= 1;
  prev.className='page-btn';
  prev.addEventListener('click', () => { state.page = Math.max(1, state.page - 1); render(); });
  els.pagination.appendChild(prev);

  const pageInput = document.createElement('input');
  pageInput.type = 'number';
  pageInput.min = 1;
  pageInput.max = totalPages;
  pageInput.value = currentPage;
  pageInput.addEventListener('change', () => {
    let val = parseInt(pageInput.value);
    if (!val || val < 1) val = 1;
    if (val > totalPages) val = totalPages;
    state.page = val;
    render();
  });
  els.pagination.appendChild(pageInput);

  const pageInfo = document.createElement('span');
  pageInfo.textContent = ` / ${totalPages}`;
  els.pagination.appendChild(pageInfo);

  const next = document.createElement('button');
  next.textContent = '下一頁';
  next.disabled = currentPage >= totalPages;
  next.className='page-btn';
  next.addEventListener('click', () => { state.page = Math.min(totalPages, state.page + 1); render(); });
  els.pagination.appendChild(next);
}

/* ========= 事件綁定 ========= */
function bindEvents(){
  els.search.addEventListener('input',e=>{ state.query=e.target.value; state.page=1; render(); });
  els.clearSearch.addEventListener('click',()=>{ state.query=''; state.page=1; els.search.value=''; render(); els.search.focus(); });
  els.fab.addEventListener('click',openChat);
  els.closeChat.addEventListener('click',closeChat);
  els.chatForm.addEventListener('submit',e=>{
    e.preventDefault();
    const text=els.chatText.value.trim();
    if(!text) return;
    addMsg('user',text);
    els.chatText.value='';
    deerReply(text);
  });
}

/* ========= 聊天框 & Modal ========= */
let greeted=false;

function openChat(){
  els.chat.classList.add('open'); 
  els.chat.setAttribute('aria-hidden','false');

  if(!greeted){ 
  setTimeout(()=>{
    addMsg(
      'bot',
      "你好，我是AI麋鹿，你可以問我跟鹿🦌有關的問題🙋，如果我知道我會告訴你答案，當然，你也可以在資料庫中自己搜尋或查看。",
      "隱藏知識庫", // src
      [],             // 建議問題
      100,            // 準確率
      "你好"          // 原本問題
    );
    greeted=true; 
  },120);
}

  setTimeout(()=>els.chatText.focus(),150);
}

function closeChat(){ els.chat.classList.remove('open'); els.chat.setAttribute('aria-hidden','true'); }

/* ========= 自訂訊息 Modal ========= */
const cardModalBg = document.createElement('div');
cardModalBg.className = 'card-modal-bg';
const cardModal = document.createElement('div');
cardModal.className = 'card-modal';
const closeBtn = document.createElement('button');
closeBtn.className = 'close-modal';
closeBtn.textContent = '關閉';
closeBtn.addEventListener('click',()=>{ cardModalBg.classList.remove('open'); });
cardModalBg.appendChild(cardModal);
cardModalBg.appendChild(closeBtn);
document.body.appendChild(cardModalBg);
function showCardModal(html, suggestions = []){
  cardModal.innerHTML = html;

  if(suggestions.length){
    const sugWrap = document.createElement('div');
    sugWrap.className = 'suggestions';
    suggestions.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'sug-btn button';
      btn.textContent = s.q;
      btn.addEventListener('click', () => {
        addMsg('user', s.q);
        deerReply(s.q);
        cardModalBg.classList.remove('open');
      });
      sugWrap.appendChild(btn);
    });
    cardModal.appendChild(sugWrap);
  }

  cardModal.appendChild(closeBtn); 
  cardModalBg.classList.add('open');
}


/* ========= 顯示訊息 ========= */
function addMsg(who, text, src, suggestions = [], accuracy, originalQ) {
  const wrap = document.createElement('div');
  wrap.className = `msg ${who}`;

  const from = document.createElement('div');
  from.className = 'from';
  from.textContent = who==='user'?'你':'AI麋鹿';

  
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = linkify(escapeHTML(text));

  if(who==='bot'){
    bubble.style.cursor='pointer';
    bubble.addEventListener('click', ()=>{
      const html = `
        <strong>內容：</strong> ${escapeHTML(text)}<br>
        <strong>準確率：</strong> ${accuracy!=null ? accuracy : 'N/A'}<br>
        <strong>來源：</strong> ${src||'未知'}<br>
        <strong>原本問題：</strong> ${originalQ||'N/A'}
      `;
      showCardModal(html, suggestions);
    });
  }

  wrap.appendChild(from);
  wrap.appendChild(bubble);

  if(suggestions.length){
    const sugWrap=document.createElement('div');
    sugWrap.className='suggestions';
    suggestions.forEach(s=>{
      const btn=document.createElement('button');
      btn.className='sug-btn button';
      btn.textContent=s.q;
      btn.addEventListener('click',()=>{
        addMsg('user',s.q);
        deerReply(s.q);
      });
      sugWrap.appendChild(btn);
    });
    wrap.appendChild(sugWrap);
  }

  els.chatLog.appendChild(wrap);
  els.chatLog.scrollTop=els.chatLog.scrollHeight;
}

/* ========= 打分系統 ========= */
function scoreItem(item, query){
  const uqOriginal = norm(query);
  let uq = uqOriginal;
  Object.keys(nameAliases).forEach(alias => {
    if(uq.includes(norm(alias))) uq = uq.replace(new RegExp(norm(alias), 'g'), norm(nameAliases[alias]));
  });
  const nq = norm(item.q);
  let score = 0;
  if(nq.includes(uq)) score += 20;
  if(item.a && norm(item.a).includes(uq)) score += 5;
  const dist = levenshtein(nq, uq);
  if(dist>0 && dist<=3) score += (4-dist)*2;
  return score;
}

/* ========= 聊天邏輯 ========= */
function deerReply(text){
  const typing = document.createElement('div');
  typing.className = 'msg bot';
  typing.innerHTML = `<div class="from">AI麋鹿</div>
                      <div class="bubble">
                        <div class="typing"><span></span><span></span><span></span></div>
                      </div>`;
  els.chatLog.appendChild(typing);
  els.chatLog.scrollTop = els.chatLog.scrollHeight;

  setTimeout(()=>{
    typing.remove();

    const allSources = [
      ...state.all.map(i => ({...i, src:"公開QA"})),
      ...state.bot.map(i => ({...i, src:"隱藏知識庫"}))
    ];

    // 1️⃣ Forced Hit
    const forcedHit = allSources.find(item => 
      (item.forced || []).some(fq => {
        const fqNorm = norm(fq), textNorm = norm(text);
        return fqNorm === textNorm || Object.entries(nameAliases).some(([alias,target]) => fq.includes(target) && text.includes(target));
      })
    );
    if(forcedHit){
      addMsg('bot', forcedHit.a, `來源：${forcedHit.src}`, [], 100, forcedHit.q);
      return;
    }

    // 2️⃣ 一般匹配
    const ranked = allSources.map(i => ({item: i, score: scoreItem(i, text)}))
                             .filter(x => x.score > 0)
                             .sort((a,b) => b.score - a.score)
                             .slice(0,3);

    if(ranked.length === 0){
      // 3️⃣ 找不到答案
      addMsg('bot', "抱歉☹️，我暫時找不到相關答案 😢，要不要問「鹿🦌本人」或是詢問管理員？", undefined, [], 0);
      return;
    }

    // 4️⃣ 找到最佳答案
    const best = ranked[0].item;
    const suggestions = ranked.slice(1).map(r => r.item);

    addMsg('bot', best.a, `來源：${best.src}`, suggestions, best.score, best.q);

  }, 600);
}


/* ========= 初始化 ========= */
function init(){ bindEvents(); render(); }
document.addEventListener('DOMContentLoaded',init);
function showUpdateModal(){
  const modalBg = document.getElementById('updateModalBg');
  const closeBtn = document.getElementById('closeUpdateModal');

  modalBg.classList.add('open');
  modalBg.setAttribute('aria-hidden', 'false');

  closeBtn.addEventListener('click', () => {
    modalBg.classList.remove('open');
    modalBg.setAttribute('aria-hidden', 'true');
  });
}

// 初始化時顯示
document.addEventListener('DOMContentLoaded', () => {
  init();            // 原本初始化函式
  showUpdateModal(); // 顯示更新訊息
});
