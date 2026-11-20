# Changelog

All notable changes to **Markdown Draw Overlay** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
