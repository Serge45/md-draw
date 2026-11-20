# Markdown Draw Overlay

**語言：** [English](README.md) | 繁體中文

在 VS Code 原生的 **Markdown Preview**（並支援選配整合 **Markdown Preview Enhanced**）畫面上直接手繪標註、螢光筆劃重點、與使用 1.5 秒自動漸隱雷射筆解說，完全不影響原本閱讀、選取複製文字與點擊超連結的體驗。

## 核心特色

- **零依賴原生注入**：透過 VS Code 官方 `contributes.markdown.previewScripts` 與 `contributes.markdown.previewStyles` 注入原生預覽，不建立自訂 Webview，並於 `.md` 編輯器右上角提供一鍵開啟畫筆預覽按鈕。
- **支援與 Markdown Preview Enhanced (MPE) 共存**：
  - 可隨時透過編輯器右上角按鈕開啟原生預覽進行標註，與 MPE 預覽並存互不干擾。
  - 若想直接在 **MPE 預覽視窗** 內手繪，也提供一鍵命令自動將資源同步寫入 MPE 全域 `head.html`（含實際預覽底色亮度偵測、MPE Sidebar TOC 自動避讓與列印/匯出防護）。
- **捲動同步與高 DPI 支援**：畫布動態追蹤文件 `scrollWidth` / `scrollHeight` 與 `ResizeObserver` 尺寸變化，並在視窗或 Markdown 內容更新重設尺寸時保留現有筆跡；自動處理 `window.devicePixelRatio` 讓高解析螢幕筆跡依然銳利。
- **二次貝茲曲線平滑插值**：結合 Pointer Coalesced Events 與 Quadratic Bezier 平滑演算法，快速畫線也不會出現折角鋸齒。
- **防誤觸雙模式**：預設為 **瀏覽模式**（`pointer-events: none`），可自由捲動、選取複製文字、點擊連結；切換至 **繪圖模式** 後才攔截指標事件。
- **完整繪圖工具**：
  1. **畫筆 (Pen)**：一般實線繪圖。
  2. **螢光筆 (Highlighter)**：半透明粗線條（預設黃色），整筆路徑一致不疊加色塊。
  3. **雷射筆 (Laser Pointer)**：紅色發光筆跡，放開後 **1.5 秒內平滑漸隱消失**，不進入 Undo/Redo 歷史紀錄。
  4. **橡皮擦 (Eraser)**：點擊可直接刪除整條筆跡；按住拖曳可局部精準擦除線段。
- **雙語 UI 與 VS Code 主題自適應**：工具列支援 **English / 繁體中文** 自動偵測與一鍵即時切換（`EN` / `中`），並依實際預覽背景亮度自動切換黑/白自適應墨水色票。

---

## 快捷鍵一覽

| 快捷鍵 | 功能 |
| --- | --- |
| `Alt + D` | 切換 **瀏覽模式** / **繪圖模式** |
| `Esc` | 快速退回 **瀏覽模式**（保留畫面上所有筆跡） |
| `Ctrl + Z` / `Cmd + Z` | 復原 (Undo) |
| `Ctrl + Y` / `Ctrl + Shift + Z` / `Cmd + Shift + Z` | 重做 (Redo) |

---

## 與 Markdown Preview Enhanced (MPE) 共存說明

### 方式一：雙預覽並存（預設，零設定）
在開啟 `.md` 檔案時，點擊編輯器右上角的 **畫筆圖示按鈕**（`Markdown Draw Overlay: Open Markdown Preview`），即可直接於側邊開啟 VS Code 原生預覽並載入 `md-draw`，與 MPE 各自獨立使用。

### 方式二：在 MPE 預覽中直接使用（透過 `head.html` 一鍵整合）
1. 按 `Ctrl + Shift + P` 開啟命令選擇區，執行：
   **`Markdown Draw Overlay: Enable MPE Preview Integration (head.html)`**（繁中介面為 **`Markdown Draw Overlay：啟用 MPE 預覽整合 (head.html)`**）
2. 套件會自動將 `markdown-draw-overlay.js` 與樣式管理區塊寫入 MPE 全域設定目錄（Windows 預設為 `%USERPROFILE%\.crossnote\`，或依照 `markdown-preview-enhanced.configPath`）。
3. 確認兩項 MPE 安全條件（執行上述命令時也會自動提示一鍵開啟）：
   - VS Code 使用者設定 `"markdown-preview-enhanced.enablePreviewScripts": true`
   - 目前開啟的資料夾處於 **Trusted Workspace（信任的工作區）** 狀態
4. 重新開啟或重新整理 MPE 預覽分頁，即可在 MPE 畫面右上角看到 `md-draw` 工具列。
5. 若未來想移除 MPE 整合，可執行 **`Markdown Draw Overlay: Remove MPE Preview Integration`** 乾淨移除管理區塊與腳本檔。

---

## 安裝、編譯與按 F5 測試步驟

### 1. 安裝依賴與編譯
在專案根目錄執行：

```bash
npm install
npm run compile
```

### 2. 啟動 Extension Development Host 測試
1. 使用 VS Code 開啟此專案資料夾。
2. 在 Run and Debug 面板選擇並按 **`F5`**：
   - **`Run Markdown Draw Overlay`**：載入本機已安裝套件（可同時測試原生預覽與 MPE 整合）。
   - **`Run Markdown Draw Overlay (Isolated / No Other Extensions)`**：停用其他已裝套件，純淨測試原生預覽。
3. 在新開啟的 **Extension Development Host** 視窗打開任意 `.md` 檔案（例如本專案的 `README.zh-TW.md` 或 `README.md`）。
4. 點擊編輯器右上角畫筆圖示（或按 `Ctrl+Shift+V` / `Ctrl+K V` 開啟原生預覽），即可看到右上角浮動工具列：
   - **瀏覽模式**：反白複製文字、點擊連結皆不受阻擋。
   - 按 **`Alt + D`** 進入 **繪圖模式**：測試畫筆、螢光筆、雷射筆（1.5 秒自動消失）、橡皮擦（點擊刪除與拖曳局部擦除）、調色盤、3 段粗細、Undo/Redo、清空、`EN` / `中` 語言切換與工具列收合/展開。
   - 按 **`Esc`** 退回瀏覽模式。

---

## 專案結構

```text
md-draw/
├── .vscode/
│   ├── launch.json             # F5 Extension Development Host 設定（含一般與隔離模式）
│   └── tasks.json              # 預設 npm compile 建置任務
├── l10n/
│   ├── bundle.l10n.json        # Extension Host 英文語系資源
│   └── bundle.l10n.zh-tw.json  # Extension Host 繁體中文語系資源
├── media/
│   ├── overlay.css             # 畫布層與毛玻璃浮動工具列樣式（VS Code 主題變數 & MPE 相容）
│   └── overlay.js              # 注入 Markdown Preview 的繪圖、互動與多語系核心
├── src/
│   └── extension.ts            # Extension 進入點、原生預覽快捷指令與 MPE head.html 整合管理
├── package.json                # Extension manifest、標題列按鈕與 previewScripts/Styles 設定
├── package.nls.json            # Manifest 英文語系
├── package.nls.zh-tw.json      # Manifest 繁體中文語系
├── tsconfig.json               # TypeScript 編譯設定
├── README.md                   # 英文說明文件
└── README.zh-TW.md             # 繁體中文說明文件
```
