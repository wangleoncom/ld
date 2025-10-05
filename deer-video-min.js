/* ===== Deer Video Minimal v1.0 ===== */
(async function(){
  const frame = document.getElementById('video-frame');
  const infoBox = document.getElementById('video-info');
  const infoBtn = document.getElementById('info-btn');

  infoBtn.addEventListener('click', ()=> infoBox.classList.toggle('hidden'));

  // 讀取 CSV
  const csv = await fetch('videos.csv',{cache:'no-store'}).then(r=>r.text());
  const rows = csv.split(/\r?\n/).filter(x=>x.trim()).slice(1)
    .map(line=>line.split(',').map(x=>x.trim()));

  if(rows.length===0){ frame.textContent='無影片資料'; return; }

  // 隨機或第一支影片
  const [link,desc,tags,date,pin,audio] = rows[0];
  const id = (link.match(/\/video\/(\d{5,})/)||[])[1];
  const embed = `<iframe allowfullscreen loading="lazy"
    allow="clipboard-write; encrypted-media; picture-in-picture; fullscreen"
    referrerpolicy="strict-origin-when-cross-origin"
    src="https://www.tiktok.com/embed/v2/${id}"></iframe>`;
  frame.innerHTML = embed;

  // 組影片資訊
  infoBox.innerHTML = `
    <h3>影片資訊</h3>
    <p><b>影片連結：</b><a href="${link}" target="_blank">${link}</a></p>
    <p><b>文字敘述：</b>${desc||'（無）'}</p>
    <p><b>標籤：</b>${tags||'（無）'}</p>
    <p><b>上傳日期：</b>${date||'（未知）'}</p>
    <p><b>置頂：</b>${pin||'否'}</p>
    <p><b>音檔：</b>${audio||'（無）'}</p>`;
})();