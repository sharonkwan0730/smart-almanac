# 智選良辰 - 現代化農民曆

太乙神數 · 漢藏智慧對照

## 🚀 快速部署到 GitHub + Vercel

### 步驟 1：上傳到 GitHub

```bash
# 1. 在 GitHub 創建新 repository（例如：smart-almanac）

# 2. 在專案目錄執行：
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用戶名/smart-almanac.git
git push -u origin main
```

### 步驟 2：部署到 Vercel

1. 前往 [vercel.com](https://vercel.com)
2. 點擊「New Project」
3. 選擇你的 GitHub repository
4. 點擊「Deploy」
5. 等待部署完成（1-2 分鐘）
6. 完成！🎉

## 📝 功能特色

- ✅ 每日農民曆查詢
- ✅ 藏曆對照與修行指引
- ✅ AI 深度解讀
- ✅ 生肖運勢分析
- ✅ 吉日查詢
- ✅ 大事記事功能

## 🔧 本地開發

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 建置生產版本
npm run build
```

## 🔑 API Key 說明

API Key 已內建在 `services/geminiService.ts` 中。

如需更換：
1. 前往 [Google AI Studio](https://aistudio.google.com/apikey)
2. 創建新的 API Key
3. 編輯 `services/geminiService.ts` 第 4 行
4. 替換成你的 Key

## 📱 技術棧

- React 19
- TypeScript
- Vite
- Tailwind CSS (via CDN)
- Gemini AI API

## 📄 License

MIT
