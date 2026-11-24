# Changelog

All notable changes to **Markdown Draw Overlay** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-11-24

### Added
- **Select, Move, Resize & Restyle Tool (`V`)**:
  - Click or drag a marquee box to select single or multiple annotations (`Shift` to toggle/add, `Ctrl/Cmd + A` to select all).
  - Drag selected annotations to move, drag any of the 4 corner handles to resize (hold `Shift` for proportional scaling), nudge with arrow keys (`Shift` for 10px), and press `Delete`/`Backspace` to remove.
  - Click color swatches or `S / M / L` size buttons while items are selected to recolor or change stroke width in-place; press `Esc` once to clear selection and again to return to Browse Mode.
- **Markdown Block Anchoring**:
  - Automatically anchors annotations to underlying Markdown blocks (`h1`–`h6`, `p`, `pre`, `table`, `blockquote`, `li`, `img`, `figure`, `hr`) so strokes follow layout reflow, zoom, and preview resize.
  - Moving or resizing annotations re-anchors them to the new target block and persists anchor metadata in per-document storage and `.mdo.json`.
- **Unified Tool Cursors & Laser Pointer Colors**:
  - Added color- and size-matched live canvas cursors for Pen, Highlighter, Arrow/Rectangle (center dot + crosshair), Laser Pointer (glowing spot), and Eraser, plus independent color selection for Laser Pointer.
- **Open VSX Publishing Workflow**:
  - Updated `.github/workflows/publish.yml` to publish to both VS Code Marketplace and Open VSX Registry (Cursor / Antigravity IDE).

### Fixed
- Aligned exported and clipboard-copied PNG screenshots accurately at any scroll position.
- Inlined embedded Markdown images into PNG exports via canvas/CORS without requiring `connect-src` fetch under strict Webview CSP.

## [0.2.0] - 2026-11-21

### Added
- **Geometric Drawing Tools & `Shift` Snapping**:
  - Added dedicated **Arrow** and **Rectangle** tools to the floating toolbar.
  - Hold **`Shift`** while drawing with **Pen** or **Highlighter** for crisp straight lines with ±6° horizontal/vertical magnetic snapping (`Shift` with Arrow snaps to 15° angles; `Shift` with Rectangle locks 1:1 squares).
  - Vector Eraser supports whole-shape click and drag hit-testing for lines, arrows, and rectangles.
- **Per-Document Persistence & `.mdo.json` Export/Import**:
  - Automatically remembers strokes per document URI in preview storage across edits and preview switches (toggleable in the `⋯` menu).
  - Export and import portable `.mdo.json` annotation files via the `⋯` menu without modifying your Markdown source.
- **One-Click Annotated PNG Screenshot Export**:
  - Camera button on the toolbar composites the current viewport Markdown view and vector annotations into a timestamped PNG download, attempts to copy the PNG directly to the clipboard, and gracefully falls back to an annotation-layer PNG when strict Webview CSP blocks DOM capture.

## [0.1.1] - 2026-11-21

### Added
- Added Dark Mode and Light Mode live demo screenshots (`media/demo-dark.png`, `media/demo-light.png`) to `README.md` and `README.zh-TW.md`.
- Added passwordless GitHub Actions OIDC publishing workflow (`.github/workflows/publish.yml`).

## [0.1.0] - 2026-11-21

### Added
- **Native Markdown Preview Injection**: Zero-dependency injection via `contributes.markdown.previewScripts` and `contributes.markdown.previewStyles`.
- **High-DPI Smooth Annotation Canvas**: Dual-canvas architecture tracking `scrollWidth`, `scrollHeight`, `ResizeObserver`, `vscode.markdown.updateContent`, and `window.devicePixelRatio`, with Quadratic Bezier curve interpolation and EMA filtering.
- **Anti-Accidental-Touch Dual Mode**: Defaults to Browse Mode (`pointer-events: none`); toggle Draw Mode with `Alt + D` or the toolbar button, and return with `Esc`.
- **Annotation Tools**:
  - **Pen**: Solid crisp freehand ink.
  - **Highlighter**: Semi-transparent continuous marker (yellow default) without overlapping joint artifacts.
  - **Laser Pointer**: Glowing dual-pass red beam that fades smoothly over 1.5 seconds after release (excluded from Undo/Redo history).
  - **Eraser**: Click to delete an entire stroke or drag to erase segments cleanly with a live circular cursor ring.
- **VS Code Theme-Adaptive Floating Toolbar**: Frosted-glass UI using VS Code CSS variables, 5 high-contrast colors (including surface-luminance-adaptive Black/White ink), 3 brush sizes, Undo (`Ctrl/Cmd + Z`), Redo (`Ctrl/Cmd + Y` / `Ctrl/Cmd + Shift + Z`), Clear All, and collapse/expand toggle.
- **Markdown Preview Enhanced (MPE) Coexistence**: Editor title quick-open pen button for native preview alongside one-click `Enable MPE Preview Integration (head.html)` and `Remove MPE Preview Integration` commands, MPE Sidebar TOC avoidance, and print/HTML export guards.
- **Bilingual Localization**: Default English and Traditional Chinese (`package.nls*.json`, `l10n/`, `README.md`, `README.zh-TW.md`, and live `EN` / `中` toolbar switcher).
