/* AI 麋鹿（純本地強化版 + 信心分數重設）
 * 多信號評分 + 信心分數（best/gap/coverage/trigram）→ 盡量回答
 */

const AI = (() => {
  const ctx = {
    useLocalFirst: true,
    idxBuilt: false,
    docs: [],
    df: new Map(),
    idf: new Map(),
    inv: new Map(),
    seg: null
  };
  // 簡單同義/別稱展開：variant -> canonical 追加到查詢
// 針對常見問法做短語展開（先正規化再比對）

  // —— 常用映射 / 同義詞 —— //
  const zhMap = new Map(Object.entries({
    '后':'後','裏':'裡','復':'複','台':'臺','裡':'裡','里':'里','佔':'占','麵':'面','隻':'只','鐘':'鍾','為':'為',
  }));

  const synonyms = new Map([
    ['社群',['社團','群組','line 社群','line 群','社群平台']],
    ['帳號',['id','帳戶','使用者名稱','handle','小號','分身']],
    ['tiktok',['抖音','tik tok','tt']],
    ['ig',['instagram','insta','限動','精選','精選動態']],
    ['快手',['kuaishou']],
    ['影片',['video','影片連結','影片網址','影片片段','影片資訊']],
    ['名字',['姓名','稱呼','名子','本名','name']],
    ['男朋友',['男友','bf','另一半']],
    ['同擔',['拒同擔','cp 同擔','共同擔當']],
    ['年齡',['幾歲','歲數','年紀','age']],
    ['身高',['多高','身高幾公分','height','好高']],
    ['體重',['多重','weight']],
    ['生日',['生辰','幾月幾號','birth','birthday']],
    ['星座',['十二星座','horoscope','天秤座']],
    ['左撇子',['慣用左手','左手','左利手']],
    ['右撇子',['慣用右手','右手','右利手']],
    ['台南人',['臺南人','南部人','台南','臺南']],
    ['高中',['高級中學','高中部','高一高二','台南女中','臺南女中']],
    ['大學',['學校','嘉義大學','ncyu','校院']],
    ['直播',['開台','開直播','開播','直播間','直播主']],
    ['管理員',['管理','版主','mod','主持','巡管']],
    ['禁言',['mute','ban','封鎖','封禁','禁評','停權']],
    ['傳說對決',['aov','王者榮耀(國際)','傳說','傳對']],
    ['段位',['牌位','階級','rank','ranking','星數','顆星']],
    ['自訂場',['自訂房','客製房','自訂房間','自定房']],
    ['排位賽',['排位','rank 戰','積分賽']],
    ['手機',['phone','智慧型手機','iPhone 13 Pro','iphone13pro']],
    ['平板',['ipad','iPad mini 7','ipad mini7','平板電腦','裝置','設備']],
    ['貓',['貓咪','喵喵','貓貓','英國短毛貓','英短','哺嚕']],
    ['寵物',['養寵物','動物','毛孩']],
    ['頭髮',['髮型','髮質','發質','頭毛']],
    ['護髮',['保養頭髮','護髮素','潤髮','髮膜']],
    ['吹頭髮',['吹髮','烘頭髮','烘髮','吹乾']],
    ['染頭髮',['染髮','染色','染黑','黑髮']],
    ['追星',['偶像','idol','粉絲','飯']],
    ['男團',['男子團體','boy group','男偶像團體']],
    ['電影',['影劇','電影片','看電影','戲院','電影院']],
    ['表情符號',['emoji','貼圖','符號','顏文字']],
    ['簽名',['親筆簽名','簽字','簽 autography','簽']],
    ['駕照',['駕駛執照','開車執照','license','考照']],
    ['間諜家家酒',['spy x family','spyxfamily','spy family','spyxfamily 劇場版']],
    ['魷魚遊戲',['squid game','魷魚']],
    ['鏈鋸人',['chainsaw man','鏈鋸']],
    ['社群帳號',['社群 id','平台帳號','各平台帳號','官方帳號','正版帳號']],
    ['在哪裡',['在哪','哪裡','位置','地點','where']],
    ['會回關',['互關','回粉','互粉','follow back']],
    ['會讀私訊',['看私訊','讀訊息','回私訊','私訊回覆']],
    ['合作',['聯名','合拍','合作影片','collab']],
    ['粉絲名',['粉絲稱號','粉絲名稱','後援名','應援名']],
    ['儲值',['課金','充值','top up','氪金']],
    ['小號',['分身帳號','副帳','side account','171']],
    ['甜食',['甜點','dessert','點心']],
  ]);

  const numSyn = new Map([
    ['零',['0','〇']],['一',['1','壹']],['二',['2','兩','貳']],['三',['3','叁']],['四',['4','肆']],
    ['五',['5','伍']],['六',['6','陸']],['七',['7','柒']],['八',['8','捌']],['九',['9','玖']],['十',['10','拾']]
  ]);

  // —— 正規化 / 分詞 —— //
  function toHalfWidth(str){
    return str.replace(/[\uFF01-\uFF5E]/g,ch=>String.fromCharCode(ch.charCodeAt(0)-0xFEE0)).replace(/\u3000/g,' ');
  }
  function stripDiacritics(str){ return str.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function normalize(s){
    if(!s) return '';
    let t = toHalfWidth(String(s));
    t = stripDiacritics(t);
    t = t.replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim().toLowerCase();
    t = [...t].map(ch=>zhMap.get(ch)||ch).join('');
    return t;
  }
  function ngrams(s,n=3){ const p=` ${s} `,a=[]; for(let i=0;i<=p.length-n;i++) a.push(p.slice(i,i+n)); return a; }
  function toSet(a){ return new Set(a); }
  function editDistance(a,b,limit=64){
    if(a===b) return 0; if(a.length>limit||b.length>limit) return Math.abs(a.length-b.length)+1;
    const da={},len1=a.length,len2=b.length,inf=len1+len2,d=Array(len1+2).fill(null).map(()=>Array(len2+2).fill(0));
    d[0][0]=inf; for(let i=0;i<=len1;i++){d[i+1][0]=inf; d[i+1][1]=i;} for(let j=0;j<=len2;j++){d[0][j+1]=inf; d[1][j+1]=j;}
    for(let i=1;i<=len1;i++){ let db=0; for(let j=1;j<=len2;j++){ const i1=da[b[j-1]]||0, j1=db, cost=a[i-1]===b[j-1]?(db=j,0):1;
      d[i+1][j+1]=Math.min(d[i][j]+cost,d[i+1][j]+1,d[i][j+1]+1,d[i1][j1]+(i-i1-1)+1+(j-j1-1)); } da[a[i-1]]=i; }
    return d[len1+1][len2+1];
  }
  function getSegmenter(){ try{ return new Intl.Segmenter('zh',{granularity:'word'});}catch{return null;} }
  function segment(text){
    const t=normalize(text); if(!t) return [];
    if(!ctx.seg) ctx.seg=getSegmenter();
    if(ctx.seg){ return Array.from(ctx.seg.segment(t)).map(x=>x.segment.trim()).filter(Boolean); }
    return t.split(/(?=[a-z0-9]+)|\s+/i).filter(Boolean);
  }
  function expandTokens(tokens){
    const out=new Set(tokens);
    tokens.forEach(tok=>{ const cand=synonyms.get(tok); if(cand) cand.forEach(w=>out.add(normalize(w))); });
    const numPairs=[...numSyn.entries()];
    tokens.forEach(tok=>{ numPairs.forEach(([han,arr])=>{ if(tok===han||arr.includes(tok)){ out.add(han); arr.forEach(x=>out.add(x)); } }); });
    return [...out];
  }

  // —— 索引 —— //
  function buildIndex(){
    if(ctx.idxBuilt) return;
    const qa=Array.isArray(window.DEER_QA)?window.DEER_QA:[];
    ctx.docs = qa.map((r,i)=>{
      const text=`${r.q} ${r.a}`;
      const tokens=segment(text);
      const trigrams=toSet(ngrams(normalize(text)));
      const tf=new Map(); tokens.forEach(t=>tf.set(t,(tf.get(t)||0)+1));
      return {id:i,q:r.q,a:r.a,text,tokens,trigrams,tf};
    });

    ctx.df.clear(); ctx.inv.clear();
    ctx.docs.forEach(d=>{
      const seen=new Set();
      d.tokens.forEach(t=>{ if(seen.has(t)) return; seen.add(t);
        ctx.df.set(t,(ctx.df.get(t)||0)+1);
        if(!ctx.inv.has(t)) ctx.inv.set(t,new Set());
        ctx.inv.get(t).add(d.id);
      });
    });
    const N=Math.max(ctx.docs.length,1);
    ctx.idf.clear();
    ctx.df.forEach((df,t)=>{ const idf=Math.log(1+(N-df+0.5)/(df+0.5)); ctx.idf.set(t,idf); });
    ctx.idxBuilt=true;
  }

  // —— 打分（細項） —— //
  function jaccard(aSet,bSet){ let inter=0; aSet.forEach(x=>{ if(bSet.has(x)) inter++; }); const uni=new Set([...aSet,...bSet]).size||1; return inter/uni; }
  function bm25lite(qtoks,doc){
    const k1=1.2,b=0.75; const avgdl=ctx.docs.reduce((s,d)=>s+d.tokens.length,0)/Math.max(ctx.docs.length,1);
    const dl=doc.tokens.length||1; const K=k1*((1-b)+b*(dl/avgdl));
    let score=0; const uniq=new Set(qtoks);
    uniq.forEach(t=>{ const f=doc.tf.get(t)||0; if(!f) return; const idf=ctx.idf.get(t)||0; score += idf*((f*(k1+1))/(f+K)); });
    return score;
  }
  function prefixBoost(nq,doc){ const nd=normalize(doc.text); let s=0; if(nd.includes(nq)) s+=0.8; if(nd.startsWith(nq)) s+=0.5; return s; }
  function fuzzyBoost(qTokens,doc){
    let s=0, cand=doc.tokens;
    for(let i=0;i<Math.min(qTokens.length,6);i++){
      const qt=qTokens[i]; if(!qt||qt.length<2) continue;
      let best=Infinity; for(let j=0;j<Math.min(cand.length,60);j++){ const dist=editDistance(qt,cand[j],48); if(dist<best) best=dist; if(best===0) break; }
      if(best===1) s+=0.15; else if(best===2) s+=0.07;
    }
    return s;
  }

  function scoreDoc(rawQuery, qTokens, qTris, doc){
    const tri = jaccard(qTris, doc.trigrams);
    const set = jaccard(toSet(qTokens), toSet(doc.tokens));
    const bm  = bm25lite(qTokens, doc);
    const pre = prefixBoost(normalize(rawQuery), doc);
    const fz  = fuzzyBoost(qTokens, doc);
    const total = tri*0.25 + set*0.20 + bm*0.45 + pre*0.07 + fz*0.03;
    return { total, tri, set, bm, pre, fz };
  }

  // —— 檢索 —— //
  function candidateDocs(expandedTokens){
    const sets=expandedTokens.map(t=>ctx.inv.get(t)||new Set());
    const union=new Set(); sets.forEach(s=>s.forEach(id=>union.add(id)));
    return [...union].map(id=>ctx.docs[id]);
  }

  function retrieve(query, k=5){
  buildIndex();
  const q0 = expandQuery(query);            // 先做短語展開
  const baseTokens = segment(q0);           // 再分詞
  const qTokens = expandTokens(baseTokens); // 同義擴展
  const qTris = toSet(ngrams(normalize(q0)));

    const pool = candidateDocs(qTokens);
    const docs = pool.length ? pool : ctx.docs;

    const scored = docs.map(d => {
      const sc = scoreDoc(query, qTokens, qTris, d);
      // 計算 query 覆蓋率：doc 中真正命中的查詢詞比例
      const uniqQ = new Set(qTokens);
      let hit = 0; uniqQ.forEach(t => { if(d.tf.has(t)) hit++; });
      const coverage = uniqQ.size ? hit/uniqQ.size : 0;
      return { doc:d, score:sc.total, detail:{...sc, coverage} };
    }).sort((a,b)=>b.score-a.score).slice(0,k);

    return scored.map((s,i)=>({
      rank: i+1,
      item: { q:s.doc.q, a:s.doc.a },
      raw:  s,
      score: s.score,
      detail: s.detail
    }));
  }

  // —— 信心分數 —— //
  function computeConfidence(results){
    if(!results.length) return 0;
    const best = results[0];
    const second = results[1];

    // 分數強度：把 total 轉為 0-1（logistic）
    const strength = 1 - Math.exp(-Math.max(best.score,0)); // ↑單調，分數越大越靠近 1

    // 與第二名差距
    const gap = second ? Math.max(best.score - second.score, 0) / (Math.abs(second.score) + 1e-6) : 1;

    // 查詢詞覆蓋率
    const coverage = best.detail.coverage; // 0..1

    // 三元組重疊（字符級對齊度）
    const tri = best.detail.tri; // 0..1

    // 綜合（可視站點再調）：強調 strength 與 coverage，其次 gap 與 tri
    const conf = (strength*0.45) + (coverage*0.30) + (gap*0.15) + (tri*0.10);

    // 夾取
    return Math.max(0, Math.min(1, conf));
  }

  // —— 對外 API —— //
  async function ask(query){
    const top = retrieve(query, 5);
    if(!top.length) return '目前資料庫沒有這題，請在主頁搜尋或回報。';

    const conf = computeConfidence(top);
    const best = top[0].item;

    // 盡量回答：不同信心層級給不同提示
    let answer = `可能的答案：\n${best.a}`;

    if(conf >= 0.60){
      // 高信心：正常回答 + 建議
      const others = top.slice(1,3).map(r=>`• ${r.item.q}`);
      if(others.length) answer += `\n\n你也可以看看：\n${others.join('\n')}`;
    } else if(conf >= 0.35){
      // 中信心：給輕度提醒
      answer = `可能的答案（信心較低，僅供參考）：\n${best.a}`;
      const others = top.slice(1,3).map(r=>`• ${r.item.q}`);
      if(others.length) answer += `\n\n相關題目：\n${others.join('\n')}`;
    } else {
      // 低信心：仍回最接近答案，但明確標記
      answer = `推測的相關答案（信心低）：\n${best.a}`;
      const others = top.slice(0,3).map(r=>`• ${r.item.q}`);
      answer += `\n\n建議改用其他關鍵字再試：\n${others.join('\n')}`;
    }

    // 可選：附帶數值信心（0–1，保留兩位）
    // answer += `\n\n[信心分數 ${conf.toFixed(2)}]`;

    return answer;
  }

  function saveSettings({useLocalFirst}){
    if(typeof useLocalFirst === 'boolean'){
      ctx.useLocalFirst = useLocalFirst;
      localStorage.setItem('ai_use_local', useLocalFirst ? '1':'0');
    }
  }

  function loadSettings(){
    const l = localStorage.getItem('ai_use_local');
    ctx.useLocalFirst = l ? l === '1' : true;
    return { useLocalFirst: ctx.useLocalFirst };
  }
  function explain(query){
    const top = retrieve(query, 5);
    const conf = (typeof computeConfidence === 'function') ? computeConfidence(top) : (top[0]?.score || 0);
    const best = top[0]?.item;
    const others = top.slice(1,3).map(r=>`• ${r.item.q}`);
    let text = best ? `可能的答案：\n${best.a}` : '目前資料庫沒有這題，請在主頁搜尋或回報。';
    return { text, conf, top };
  }

    function explain(query){
    const top = retrieve(query, 5);
    const conf = (typeof computeConfidence === 'function') ? computeConfidence(top) : (top[0]?.score || 0);
    const best = top[0]?.item;
    const others = top.slice(1,3).map(r=>`• ${r.item.q}`);
    let text = best ? `可能的答案：\n${best.a}` : '目前資料庫沒有這題，請在主頁搜尋或回報。';
    return { text, conf, top };
  }

  return { ask, saveSettings, loadSettings, retrieve, explain };
})();
window.AI = AI;