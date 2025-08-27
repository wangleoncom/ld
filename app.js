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

/* =========
   工具函式
   ========= */
const norm = s => (s || "").toString().toLowerCase().trim();

// 嚴格字串包含，只在「問題 Q」內比對
function matchQuestion(item, query){
  if(!query) return true;
  return norm(item.q).includes(norm(query));
}

// 將關鍵字高亮（只標記問題文字）
function highlight(text, query){
  if(!query) return text;
  const q = norm(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${q})`, 'gi');
  return text.replace(re, '<mark class="hl">$1</mark>');
}

// 分頁切片
function getPage(items, page, size=PAGE_SIZE){
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * size;
  return { slice: items.slice(start, start + size), total, pages, page: p };
}

/* =========
   介面渲染
   ========= */
function render(){
  // 篩選
  state.filtered = state.all.filter(item => matchQuestion(item, state.query));

  // 分頁
  const { slice, total, pages, page } = getPage(state.filtered, state.page);
  state.page = page;

  // 清單
  els.list.setAttribute('aria-busy', 'true');
  els.list.innerHTML = slice.map(item => {
    return `
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
    `;
  }).join('');
  els.list.setAttribute('aria-busy', 'false');

  // 統計
  els.count.textContent = `共 ${total} 筆結果，頁 ${page}/${pages}`;

  // 分頁按鈕
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
    // 中間頁碼（窗口 5）
    const start = Math.max(1, p - 2);
    const end = Math.min(pages, p + 2);
    for(let i = start; i <= end; i++){
      html += btn(i, i, {'aria-current': i===p ? 'page' : null});
    }
    html += btn('›', Math.min(pages, p+1), {title:'下一頁', 'aria-label': '下一頁'});
    html += btn('»', pages, {title:'最後一頁', 'aria-label': '最後一頁'});
  }
  els.pagination.innerHTML = html;
}

/* =========
   事件繫結
   ========= */
function bindEvents(){
  // 搜尋輸入（即時）
  els.search.addEventListener('input', (e)=>{
    state.query = e.target.value;
    state.page = 1; // 重置到第一頁
    render();
  });

  // 清除搜尋
  els.clearSearch.addEventListener('click', ()=>{
    els.search.value = '';
    state.query = '';
    state.page = 1;
    render();
    els.search.focus();
  });

  // 分頁點擊（事件委派）
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

  // 智能麋鹿 FAB
  els.fab.addEventListener('click', openChat);
  els.closeChat.addEventListener('click', closeChat);

  // 聊天送出
  els.chatForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const text = els.chatText.value.trim();
    if(!text) return;
    addMsg('user', text);
    els.chatText.value = '';
    deerReply(text);
  });
}

/* =========
   智能麋鹿（Beta）邏輯
   - 僅使用本地資料（data.js）
   - 比對策略：字面關鍵字包含（Q）為主 + 標籤/詞交集加權（仍屬「字面」，非模糊）
   ========= */

// 初次開啟時的自我介紹
let greeted = false;
function openChat(){
  els.chat.classList.add('open');
  els.chat.setAttribute('aria-hidden', 'false');
  if(!greeted){
    setTimeout(()=>{
      addMsg('bot',
        "哈囉，我是「智能麋鹿」（Beta）🦌。我只根據本頁的 QA 內容，用『字面關鍵字』幫你定位最符合的答案。你可以問我：例如「如何使用搜尋？」或直接貼上關鍵字。"
      );
      greeted = true;
    }, 120);
  }
  // 聚焦輸入
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

// 依「問題文字包含」與「tags 交集」計分（仍為字面匹配）
function scoreItem(item, query){
  const q = norm(query);
  let score = 0;

  // 1) 問題字串包含（主要來源）
  if(norm(item.q).includes(q)) score += 10;

  // 2) 逐詞交集（以空白與標點切詞，純交集，不做相似度）
  const words = q.split(/[\s,;，。！？、]+/).filter(Boolean);
  const iq = norm(item.q);
  words.forEach(w => {
    if(iq.includes(w)) score += 2; // 字面包含即加分
  });

  // 3) tags 加權（若設定）
  if(Array.isArray(item.tags)){
    item.tags.forEach(t=>{
      if(norm(t).includes(q) || words.some(w=>norm(t).includes(w))){
        score += 1;
      }
    });
  }

  return score;
}

function deerReply(text){
  // 在目前的「篩選後集合」中尋找最佳答案（優先與視圖一致）
  const base = state.all; // 讓助理可全庫搜尋（不要只限制於當前頁的 30 筆）
  const ranked = base
    .map(item => ({ item, score: scoreItem(item, text) }))
    .filter(x => x.score > 0)
    .sort((a,b)=> b.score - a.score)
    .slice(0, 3); // 取前 3 作為候補

  if(ranked.length === 0){
    addMsg('bot',
      "我沒有在現有的 QA 中找到與你輸入的字面關鍵字相符的問題。你可以嘗試：\n• 改用更短或更明確的關鍵字\n• 到上方搜尋列直接輸入字串進行篩選"
    );
    return;
  }

  // 以最相關的為答覆，其餘列為建議
  const best = ranked[0].item;
  const suggestions = ranked.slice(1).map(r => `「${bestShort(r.item.q)}」`).join("、");

  const reply = suggestions
    ? `${best.a}\n\n（此外，你也可以參考：${suggestions}）`
    : best.a;

  addMsg('bot', reply, `Q：${best.q}`);
}

/* =========
   啟動
   ========= */
function init(){
  bindEvents();
  render();
}
document.addEventListener('DOMContentLoaded', init);

/* =========
   小工具（安全處理/美化）
   ========= */
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
  // 簡單網址偵測（純本地處理）
  return text.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener">$1</a>'
  );
}
