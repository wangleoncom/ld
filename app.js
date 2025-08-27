const PAGE_SIZE = 30;
const state = {
  all: window.DEER_QA || [],
  filtered: [],
  page: 1,
  query: ""
};

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
const norm = s => (s || "").toString().toLowerCase().trim();
function matchQuestion(item, query){ return !query || norm(item.q).includes(norm(query)); }
function highlight(text, query){
  if(!query) return text;
  const q = norm(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${q})`, 'gi');
  return text.replace(re, '<mark class="hl">$1</mark>');
}
function getPage(items, page, size=PAGE_SIZE){
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * size;
  return { slice: items.slice(start, start + size), total, pages, page: p };
}
function escapeHTML(str){
  return (str ?? '').toString()
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}
function bestShort(text, max=18){
  const s = text.trim();
  return s.length <= max ? s : s.slice(0, max-1) + '…';
}
function linkify(text){
  return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

/* ========= 同義詞 ========= */
const synonyms = {
  "主播": ["鹿🦌","主包","豆哥","豆個","鹿鹿"],
  "鹿🦌": ["主播","主包","豆哥","豆個","鹿鹿"],
  "主包": ["主播","鹿🦌","豆哥","豆個","鹿鹿"],
  "豆哥": ["主播","鹿🦌","主包","豆個","鹿鹿"],
  "豆個": ["主播","鹿🦌","主包","豆哥","鹿鹿"],
  "鹿鹿": ["主播","鹿🦌","主包","豆哥","豆個"]
};
function expandQueryWords(query){
  const words = query.split(/[\s,;，。！？、]+/).filter(Boolean);
  let expanded = new Set(words);
  words.forEach(w=>{
    if(synonyms[w]){
      synonyms[w].forEach(s => expanded.add(s));
    }
  });
  return [...expanded];
}

/* ========= 渲染 ========= */
function render(){
  state.filtered = state.all.filter(item => matchQuestion(item, state.query));
  const { slice, total, pages, page } = getPage(state.filtered, state.page);
  state.page = page;

  els.list.setAttribute('aria-busy', 'true');
  els.list.innerHTML = slice.map(item => `
      <details class="qa-item" data-id="${item.id}">
        <summary class="qa-q">
          <div class="q-text">${highlight(escapeHTML(item.q), state.query)}</div>
          <div class="chev" aria-hidden="true"></div>
        </summary>
        <div class="content-wrap">
          <div class="content">
            <div class="qa-a">${escapeHTML(item.a)}</div>
          </div>
        </div>
      </details>
    `).join('');
  els.list.setAttribute('aria-busy', 'false');
  els.count.textContent = `共 ${total} 筆結果，頁 ${page}/${pages}`;
  renderPagination(pages);
}
function renderPagination(pages){
  const p = state.page;
  const btn = (label, page, attrs={})=>{
    const at = Object.entries(attrs).map(([k,v])=>`${k}="${v}"`).join(' ');
    return `<button class="page-btn" data-page="${page}" ${at}>${label}</button>`;
  };
  let html = '';
  if(pages > 1){
    html += btn('«', 1, {title:'第一頁', 'aria-label': '第一頁'});
    html += btn('‹', Math.max(1, p-1), {title:'上一頁', 'aria-label': '上一頁'});
    const start = Math.max(1, p-2);
    const end = Math.min(pages, p+2);
    for(let i = start; i <= end; i++){
      html += btn(i, i, {'aria-current': i===p ? 'page' : null});
    }
    html += btn('›', Math.min(pages, p+1), {title:'下一頁', 'aria-label': '下一頁'});
    html += btn('»', pages, {title:'最後一頁', 'aria-label': '最後一頁'});
  }
  els.pagination.innerHTML = html;
}

/* ========= 事件 ========= */
function bindEvents(){
  els.search.addEventListener('input', (e)=>{
    state.query = e.target.value;
    state.page = 1;
    render();
  });
  els.clearSearch.addEventListener('click', ()=>{
    els.search.value = '';
    state.query = '';
    state.page = 1;
    render();
    els.search.focus();
  });
  els.pagination.addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-page]');
    if(!btn) return;
    const page = parseInt(btn.dataset.page, 10);
    if(!Number.isNaN(page) && page !== state.page){
      state.page = page;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
  els.fab.addEventListener('click', openChat);
  els.closeChat.addEventListener('click', closeChat);
  els.chatForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const text = els.chatText.value.trim();
    if(!text) return;
    addMsg('user', text);
    els.chatText.value = '';
    deerReply(text);
  });
}

/* ========= 聊天 ========= */
let greeted = false;
function openChat(){
  els.chat.classList.add('open');
  els.chat.setAttribute('aria-hidden', 'false');
  if(!greeted){
    setTimeout(()=>{
      addMsg('bot',
        "哈囉，我是「智能麋鹿」🦌。我會根據關鍵字、同義詞和強制定義幫你找答案！"
      );
      greeted = true;
    }, 120);
  }
  setTimeout(()=>els.chatText.focus(), 150);
}
function closeChat(){
  els.chat.classList.remove('open');
  els.chat.setAttribute('aria-hidden', 'true');
}
function addMsg(who, text, src){
  const wrap = document.createElement('div');
  wrap.className = `msg ${who}`;
  const from = document.createElement('div');
  from.className = 'from';
  from.textContent = who === 'user' ? '你' : '智能麋鹿';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = linkify(escapeHTML(text));
  wrap.appendChild(from);
  wrap.appendChild(bubble);
  if(src){
    const hint = document.createElement('div');
    hint.className = 'src-hint';
    hint.textContent = `出處：${src}`;
    wrap.appendChild(hint);
  }
  els.chatLog.appendChild(wrap);
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
}

/* ========= 打分與匹配 ========= */
function scoreItem(item, query){
  const q = norm(query);
  const words = expandQueryWords(query);
  let score = 0;

  // 強制定義最高優先
  if(Array.isArray(item.forced)){
    for(const f of item.forced){
      if(norm(f) === q) score += 100; // 強制命中
    }
  }

  const text = norm(item.q + " " + item.a);
  // 1) 問題字匹配
  if(norm(item.q).includes(q)) score += 12;
  // 2) 答案字匹配
  if(norm(item.a).includes(q)) score += 8;
  // 3) 多詞 + 同義詞
  words.forEach(w=>{
    if(text.includes(norm(w))) score += 3;
  });
  // 4) tags
  if(Array.isArray(item.tags)){
    item.tags.forEach(t=>{
      words.forEach(w=>{
        if(norm(t).includes(norm(w))) score += 2;
      });
    });
  }
  return score;
}

function deerReply(text){
  // 打字動畫
  const typing = document.createElement('div');
  typing.className = 'msg bot';
  typing.innerHTML = `<div class="from">智能麋鹿</div>
                      <div class="bubble"><div class="typing">
                        <span></span><span></span><span></span>
                      </div></div>`;
  els.chatLog.appendChild(typing);
  els.chatLog.scrollTop = els.chatLog.scrollHeight;

  setTimeout(()=>{
    typing.remove();
    const ranked = state.all
      .map(item => ({ item, score: scoreItem(item, text) }))
      .filter(x => x.score > 0)
      .sort((a,b)=> b.score - a.score)
      .slice(0, 3);

    let reply, best;
    if(ranked.length === 0){
      // 若完全沒匹配，也挑最相關的前 1 筆（模糊匹配）
      best = state.all[Math.floor(Math.random()*state.all.length)];
      reply = best.a + "\n\n（可能不是正確答案）";
    } else {
      best = ranked[0].item;
      const suggestions = ranked.slice(1).map(r => `「${bestShort(r.item.q)}」`).join("、");
      reply = suggestions ? `${best.a}\n\n（此外，你也可以參考：${suggestions}）` : best.a;
    }
    addMsg('bot', reply, `Q：${best.q}`);
  }, 1000);
}

/* ========= 啟動 ========= */
function init(){
  bindEvents();
  render();
}
document.addEventListener('DOMContentLoaded', init);
