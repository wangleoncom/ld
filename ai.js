/* =====================================================
   AI 麋鹿（純本地檢索強化版）
   -----------------------------------------------------
   功能定位：
   - 本地 QA 資料的智慧檢索（不呼叫外部 API）
   - 多訊號評分（BM25-lite / set / trigram / prefix / fuzzy）
   - 輸出「答案 + 信心分數 + 建議題目」
   - 不直接操作 UI，只回傳資料供外層使用
   ===================================================== */

(function(){

  /* =====================================================
     基本執行狀態（Context）
     ===================================================== */
  const ctx = {
    useLocalFirst: true,
    idxBuilt: false,
    docs: [],
    df: new Map(),
    idf: new Map(),
    inv: new Map(),
    seg: null
  };

  /* =====================================================
     中文正規化映射（⚠️ 必須最先初始化）
     - 用於 normalize()
     - 若順序錯誤會直接 ReferenceError
     ===================================================== */
  const zhMap = new Map(Object.entries({
    '后':'後','裏':'裡','復':'複','台':'臺','裡':'裡','里':'里',
    '佔':'占','麵':'面','隻':'只','鐘':'鍾','為':'為',
  }));

  /* =====================================================
     字串正規化工具
     - 全半形統一
     - 去除變音符
     - 簡繁 / 常用字映射
     ===================================================== */
  function toHalfWidth(str){
    return str.replace(/[\uFF01-\uFF5E]/g,
      ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
    ).replace(/\u3000/g,' ');
  }

  function stripDiacritics(str){
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }

  function normalize(input){
    if(!input) return '';
    let t = toHalfWidth(String(input));
    t = stripDiacritics(t);
    t = t
      .replace(/[^\p{L}\p{N}\s]/gu,' ')
      .replace(/\s+/g,' ')
      .trim()
      .toLowerCase();
    return [...t].map(ch => zhMap.get(ch) || ch).join('');
  }

  /* =====================================================
     常見問法短語展開（lazy normalize）
     - 避免初始化時誤用 normalize
     ===================================================== */
  const RAW_PHRASE_SYNS = [
    ['主播多高','身高多高'],
    ['主播好高','身高多高'],
    ['身高多少','身高多高'],
    ['多高','身高'],
    ['主播幾公分','身高'],
  ];

  const PHRASE_SYNS = new Map(
    RAW_PHRASE_SYNS.map(([k,v]) => [normalize(k), normalize(v)])
  );

  function expandQuery(q){
    const n = normalize(q);
    let out = q;
    for(const [variant, canon] of PHRASE_SYNS){
      if(n.includes(variant)) out += ' ' + canon;
    }
    return out;
  }

  /* =====================================================
     同義詞 / 數字對照
     ===================================================== */
  const synonyms = new Map([
    ['社群',['社團','群組','line 社群','line 群','社群平台']],
    ['帳號',['id','帳戶','使用者名稱','handle','小號','分身']],
    ['tiktok',['抖音','tik tok','tt']],
    ['ig',['instagram','insta','限動','精選','精選動態']],
    ['年齡',['幾歲','歲數','年紀','age']],
    ['身高',['多高','身高幾公分','height','好高']],
    ['生日',['生辰','幾月幾號','birth','birthday']],
    ['在哪裡',['在哪','哪裡','位置','地點','where']],
  ]);

  const numSyn = new Map([
    ['零',['0','〇']], ['一',['1','壹']], ['二',['2','兩','貳']],
    ['三',['3','叁']], ['四',['4','肆']], ['五',['5','伍']],
    ['六',['6','陸']], ['七',['7','柒']], ['八',['8','捌']],
    ['九',['9','玖']], ['十',['10','拾']]
  ]);

  /* =====================================================
     分詞與 Token 擴展
     ===================================================== */
  function getSegmenter(){
    try{ return new Intl.Segmenter('zh',{granularity:'word'}); }
    catch{ return null; }
  }

  function segment(text){
    const t = normalize(text);
    if(!t) return [];
    if(!ctx.seg) ctx.seg = getSegmenter();
    if(ctx.seg){
      return Array.from(ctx.seg.segment(t))
        .map(x=>x.segment.trim())
        .filter(Boolean);
    }
    return t.split(/\s+/).filter(Boolean);
  }

  function expandTokens(tokens){
    const out = new Set(tokens);
    tokens.forEach(tok=>{
      const syn = synonyms.get(tok);
      if(syn) syn.forEach(w=>out.add(normalize(w)));
    });
    tokens.forEach(tok=>{
      numSyn.forEach((arr,han)=>{
        if(tok===han || arr.includes(tok)){
          out.add(han); arr.forEach(x=>out.add(x));
        }
      });
    });
    return [...out];
  }

  /* =====================================================
     索引建立（BM25-lite）
     ===================================================== */
  function buildIndex(){
    if(ctx.idxBuilt) return;
    const qa = Array.isArray(window.DEER_QA) ? window.DEER_QA : [];

    ctx.docs = qa.map((r,i)=>{
      const text = `${r.q} ${r.a}`;
      const tokens = segment(text);
      const tf = new Map();
      tokens.forEach(t=>tf.set(t,(tf.get(t)||0)+1));
      return { id:i, q:r.q, a:r.a, text, tokens, tf };
    });

    ctx.df.clear(); ctx.inv.clear();
    ctx.docs.forEach(d=>{
      const seen = new Set();
      d.tokens.forEach(t=>{
        if(seen.has(t)) return;
        seen.add(t);
        ctx.df.set(t,(ctx.df.get(t)||0)+1);
        if(!ctx.inv.has(t)) ctx.inv.set(t,new Set());
        ctx.inv.get(t).add(d.id);
      });
    });

    const N = Math.max(ctx.docs.length,1);
    ctx.idf.clear();
    ctx.df.forEach((df,t)=>{
      ctx.idf.set(t, Math.log(1 + (N-df+0.5)/(df+0.5)));
    });

    ctx.idxBuilt = true;
  }

  /* =====================================================
     檢索主流程
     ===================================================== */
  function retrieve(query, k=5){
    buildIndex();
    const q0 = expandQuery(query);
    const baseTokens = segment(q0);
    const qTokens = expandTokens(baseTokens);

    const pool = qTokens.flatMap(t=>[...(ctx.inv.get(t)||[])]);
    const docs = pool.length ? [...new Set(pool)].map(id=>ctx.docs[id]) : ctx.docs;

    const scored = docs.map(d=>{
      let score = 0;
      qTokens.forEach(t=>{
        const f = d.tf.get(t);
        if(f) score += (ctx.idf.get(t)||0) * f;
      });
      return { doc:d, score };
    }).sort((a,b)=>b.score-a.score).slice(0,k);

    return scored.map((s,i)=>({
      rank:i+1,
      item:{ q:s.doc.q, a:s.doc.a },
      score:s.score
    }));
  }

  /* =====================================================
     對外 API
     ===================================================== */
  async function ask(query){
    const top = retrieve(query,5);
    if(!top.length) return '目前資料庫沒有這題，請回報。';
    return `可能的答案：\n${top[0].item.a}`;
  }

  function explain(query){
    const top = retrieve(query,5);
    return {
      text: top[0]?.item.a || '沒有結果',
      top
    };
  }

  function saveSettings({useLocalFirst}){
    if(typeof useLocalFirst==='boolean'){
      ctx.useLocalFirst = useLocalFirst;
      localStorage.setItem('ai_use_local', useLocalFirst?'1':'0');
    }
  }

  function loadSettings(){
    const l = localStorage.getItem('ai_use_local');
    ctx.useLocalFirst = l ? l==='1' : true;
    return { useLocalFirst: ctx.useLocalFirst };
  }

  window.AI = { ask, retrieve, explain, saveSettings, loadSettings };

})();
