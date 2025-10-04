# 鹿🦌的QA網站

靜態前端專案。直接丟到 GitHub Pages 即可運行。  
特色：  
- 更新公告彈窗與本地版本追蹤  
- 新手導覽（Intro.js）  
- 即時搜尋（模糊比對 + 高亮）  
- QA 手風琴展開、複製、分享錨點  
- 分頁（預設每頁 30 筆）  
- 右下角「AI麋鹿」聊天：  
  - 預設用本地語義檢索（不出網）  
  - 亦可在設定面板填入 OpenAI API Key，使用 `gpt-4o-mini` 生成更完整回答  
- GSAP 進場與滾動動畫

## 使用
1. 開發：
   ```bash
   # 任一靜態伺服器皆可，例如：
   npx serve .    # 或 VSCode Live Server