/* AI 麋鹿邏輯：
 * 1) 預設：先做本地語義檢索（快速），再用規則生成答案。
 * 2) 若使用者在設定中提供 OpenAI API Key，則把檢索出的 top-K QA 當作 system/context，交由 OpenAI 生成更完整答案。
 * 3) 無 Key 時，回傳本地組合式回答 + 建議相近問題。
 */

const AI = (() => {
  const ctx = {
    useLocalFirst: true,
    openaiKey: localStorage.getItem('openai_key') || '',
  };

  const normalize = s =>
    (s || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g,' ')
      .trim();

  // 迷你 TF-IDF + 字元三元組近似比對
  function similarity(a, b){
    const sa = new Set(ngrams(normalize(a)));
    const sb = new Set(ngrams(normalize(b)));
    const inter = [...sa].filter(x => sb.has(x)).length;
    const uni = new Set([...sa, ...sb]).size || 1;
    return inter / uni;
  }
  function ngrams(s, n=3){
    const arr=[];
    const pad = ` ${s} `;
    for(let i=0;i<pad.length-n+1;i++) arr.push(pad.slice(i,i+n));
    return arr;
  }

  function retrieve(query, k=5){
    const scored = window.DEER_QA.map(item=>{
      const scoreQ = similarity(query, item.q);
      const scoreA = similarity(query, item.a);
      return {item,score: Math.max(scoreQ*0.7 + scoreA*0.3, scoreQ, scoreA)};
    }).sort((a,b)=>b.score-a.score);
    return scored.slice(0,k);
  }

  async function openaiAnswer(query, topK){
    const key = ctx.openaiKey || '';
    if(!key) return null;

    const top = topK.map((r,i)=>`${i+1}. Q: ${r.item.q}\nA: ${r.item.a}`).join('\n');
    const prompt = [
      {role:"system", content:"你是『AI麋鹿』，回答要簡潔、先根據提供的 QA 知識庫，若知識庫沒有再合理回答。若涉及個資或私密資料，拒絕並給出安全建議。輸出繁體中文。"},
      {role:"user", content:`使用者問題：${query}\n\n可用的知識庫片段：\n${top}\n\n請根據以上內容作答，若無相關資訊就說「目前資料庫沒有這題，請在主頁搜尋或回報」。`}
    ];

    try{
      const res = await fetch("https://api.openai.com/v1/chat/completions",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization":`Bearer ${key}`
        },
        body: JSON.stringify({
          model:"gpt-4o-mini",
          messages: prompt,
          temperature:0.2
        })
      });
      if(!res.ok) throw new Error("OpenAI API 錯誤");
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    }catch(e){
      console.warn(e);
      return null;
    }
  }

  async function ask(query){
    const retrieved = retrieve(query, 5);
    // 本地草擬
    let local = "";
    if(retrieved.length && retrieved[0].score > 0.2){
      const best = retrieved[0].item;
      local = `可能的答案：\n${best.a}`;
      if(retrieved[1]){
        const sug = retrieved.slice(0,3).map(r=>`• ${r.item.q}`).join("\n");
        local += `\n\n你也可以看看：\n${sug}`;
      }
    }else{
      local = "目前資料庫沒有這題，請在主頁搜尋或回報。";
    }

    // 若有 key，嘗試走 OpenAI
    if(localStorage.getItem('openai_key')){
      const ai = await openaiAnswer(query, retrieved);
      return ai || local;
    }
    return local;
  }

  function saveSettings({key, useLocalFirst}){
    if(typeof key === 'string'){
      if(key){ localStorage.setItem('openai_key', key); }
      else{ localStorage.removeItem('openai_key'); }
      ctx.openaiKey = key;
    }
    if(typeof useLocalFirst === 'boolean'){
      ctx.useLocalFirst = useLocalFirst;
      localStorage.setItem('ai_use_local', useLocalFirst ? '1':'0');
    }
  }

  function loadSettings(){
    const k = localStorage.getItem('openai_key') || '';
    const l = localStorage.getItem('ai_use_local');
    ctx.openaiKey = k;
    ctx.useLocalFirst = l ? l === '1' : true;
    return {openaiKey:k, useLocalFirst:ctx.useLocalFirst};
  }

  return { ask, saveSettings, loadSettings, retrieve };
})();