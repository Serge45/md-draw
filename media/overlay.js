(function () {
  'use strict';

  if (window.__mdoInitialized) {
    return;
  }
  window.__mdoInitialized = true;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var XHTML_NS = 'http://www.w3.org/1999/xhtml';
  var LASER_FADE_MS = 1500;
  var MAX_HISTORY = 100;
  var MAX_CANVAS_DIM = 16384;
  var MAX_CANVAS_AREA = 128 * 1024 * 1024;
  var ERASER_CLICK_THRESHOLD = 5;
  var MIN_POINT_DIST = 1.5;
  var EMA_CURRENT_WEIGHT = 0.68;
  var MAGNETIC_SNAP_RAD = (6 * Math.PI) / 180;
  var STORAGE_PREFIX = 'mdo.doc.v1.';
  var STORAGE_INDEX_KEY = 'mdo.doc.index.v1';
  var STORAGE_AUTOSAVE_KEY = 'mdo.autosave';
  var MAX_STORED_DOCS = 30;
  var SAVE_DEBOUNCE_MS = 280;

  var PALETTE = [
    { id: 'red', value: '#EF4444', className: 'mdo-color-red' },
    { id: 'blue', value: '#3B82F6', className: 'mdo-color-blue' },
    { id: 'green', value: '#22C55E', className: 'mdo-color-green' },
    { id: 'yellow', value: '#FACC15', className: 'mdo-color-yellow' },
    { id: 'adaptive', value: 'adaptive', className: 'mdo-color-adaptive' }
  ];

  var SIZE_MAP = {
    pen: [2.5, 4.5, 8],
    highlighter: [14, 22, 32],
    arrow: [2.5, 4.5, 8],
    rect: [2.5, 4.5, 8],
    laser: [3.5, 5, 7],
    eraser: [10, 18, 30]
  };

  var TOOL_IDS = ['pen', 'highlighter', 'arrow', 'rect', 'laser', 'eraser'];

  var I18N = {
    en: {
      modeBrowse: 'Browse',
      modeDraw: 'Draw',
      modeBrowseTitle: 'Browse Mode (click to enter Draw Mode, shortcut Alt+D)',
      modeDrawTitle: 'Draw Mode (click to return to Browse Mode, shortcut Alt+D / Esc)',
      toastDraw: 'Draw Mode (press Esc to return to Browse)',
      toastBrowse: 'Browse Mode (text selection & links enabled)',
      toastCleared: 'Cleared all strokes',
      toolbarAria: 'Markdown Draw Overlay Toolbar',
      collapseToolbar: 'Collapse toolbar',
      expandToolbar: 'Expand toolbar',
      tools: {
        pen: 'Pen (hold Shift for straight line)',
        highlighter: 'Highlighter (hold Shift for straight line)',
        arrow: 'Arrow (hold Shift for 15° snap)',
        rect: 'Rectangle (hold Shift for square)',
        laser: 'Laser Pointer (auto-fades in 1.5s)',
        eraser: 'Eraser (click stroke/shape to delete / drag to erase)'
      },
      colors: {
        red: 'Red',
        blue: 'Blue',
        green: 'Green',
        yellow: 'Yellow',
        adaptive: 'Adaptive Black/White'
      },
      sizePrefix: 'Stroke size: ',
      sizes: ['Small', 'Medium', 'Large'],
      undoTitle: 'Undo (Ctrl/Cmd+Z)',
      undoAria: 'Undo',
      redoTitle: 'Redo (Ctrl/Cmd+Y)',
      redoAria: 'Redo',
      clearTitle: 'Clear all strokes',
      clearAria: 'Clear all strokes',
      exportTitle: 'Export annotated PNG screenshot & copy to clipboard',
      exportAria: 'Export PNG screenshot',
      moreTitle: 'Storage & annotation file options',
      moreAria: 'More options',
      autoSaveLabel: 'Auto-save per file',
      onLabel: 'ON',
      offLabel: 'OFF',
      exportJsonLabel: 'Export annotations (.mdo.json)',
      importJsonLabel: 'Import annotations (.mdo.json)',
      toastAutoSaveOn: 'Per-file auto-save enabled',
      toastAutoSaveOff: 'Per-file auto-save disabled',
      toastJsonExported: 'Exported annotations (.mdo.json)',
      toastJsonImported: 'Imported {0} annotation(s)',
      toastJsonInvalid: 'Invalid .mdo.json annotation file',
      toastExportedBoth: 'PNG downloaded & copied to clipboard',
      toastExportedFileOnly: 'PNG downloaded',
      toastExportedFallbackBoth: 'Strict CSP: exported annotation layer PNG & copied',
      toastExportedFallbackFileOnly: 'Strict CSP: exported annotation layer PNG',
      toastExportFailed: 'Failed to export PNG screenshot',
      langBadge: 'EN',
      langSwitchTitle: 'Language: English (click to switch to 繁體中文)'
    },
    'zh-TW': {
      modeBrowse: '瀏覽',
      modeDraw: '繪圖',
      modeBrowseTitle: '目前為瀏覽模式（點擊進入繪圖，快捷鍵 Alt+D）',
      modeDrawTitle: '目前為繪圖模式（點擊切換回瀏覽，快捷鍵 Alt+D / Esc）',
      toastDraw: '繪圖模式 (按 Esc 退回瀏覽)',
      toastBrowse: '瀏覽模式 (可正常選取與點擊連結)',
      toastCleared: '已清空所有筆跡',
      toolbarAria: 'Markdown Draw Overlay 工具列',
      collapseToolbar: '收合標註工具列',
      expandToolbar: '展開標註工具列',
      tools: {
        pen: '畫筆 (Pen · 按住 Shift 可拉直線)',
        highlighter: '螢光筆 (Highlighter · 按住 Shift 可拉直線)',
        arrow: '箭頭 (Arrow · 按住 Shift 鎖定 15°)',
        rect: '矩形框 (Rectangle · 按住 Shift 鎖定正方形)',
        laser: '雷射筆 (Laser Pointer · 1.5秒自動漸隱)',
        eraser: '橡皮擦 (Eraser · 點擊刪整條 / 拖曳局部擦除)'
      },
      colors: {
        red: '紅色',
        blue: '藍色',
        green: '綠色',
        yellow: '黃色',
        adaptive: '自適應黑/白'
      },
      sizePrefix: '筆刷粗細：',
      sizes: ['細', '中', '粗'],
      undoTitle: '復原 (Ctrl/Cmd+Z)',
      undoAria: '復原',
      redoTitle: '重做 (Ctrl/Cmd+Y)',
      redoAria: '重做',
      clearTitle: '一鍵清空所有筆跡',
      clearAria: '清空所有筆跡',
      exportTitle: '匯出標註截圖 PNG（同時嘗試複製進剪貼簿）',
      exportAria: '匯出標註截圖',
      moreTitle: '筆跡記憶與 .mdo.json 匯出/匯入',
      moreAria: '更多選項',
      autoSaveLabel: '依文件自動記憶',
      onLabel: '開',
      offLabel: '關',
      exportJsonLabel: '匯出標註檔 (.mdo.json)',
      importJsonLabel: '匯入標註檔 (.mdo.json)',
      toastAutoSaveOn: '已開啟依文件自動記憶',
      toastAutoSaveOff: '已關閉依文件自動記憶',
      toastJsonExported: '已匯出標註檔 (.mdo.json)',
      toastJsonImported: '已匯入 {0} 筆標註',
      toastJsonInvalid: '無效的 .mdo.json 標註檔案',
      toastExportedBoth: '已下載 PNG 截圖並複製到剪貼簿',
      toastExportedFileOnly: '已下載 PNG 截圖',
      toastExportedFallbackBoth: '受 Webview CSP 限制：已改為匯出標註圖層 PNG 並複製',
      toastExportedFallbackFileOnly: '受 Webview CSP 限制：已改為匯出標註圖層 PNG',
      toastExportFailed: '匯出 PNG 截圖失敗',
      langBadge: '中',
      langSwitchTitle: '語言：繁體中文（點擊切換為 English）'
    }
  };

  function detectInitialLocale() {
    var attrLang = document.documentElement
      ? document.documentElement.getAttribute('data-mdo-lang')
      : '';
    var forced = attrLang || window.__mdoLang || '';
    if (forced === 'en' || forced === 'zh-TW') {
      return forced;
    }
    try {
      var saved = window.localStorage ? window.localStorage.getItem('mdo.lang') : '';
      if (saved === 'en' || saved === 'zh-TW') {
        return saved;
      }
    } catch (_err) {
      // Ignore storage access errors in sandboxed webviews
    }
    var navLang =
      (typeof navigator !== 'undefined' &&
        (navigator.language || (navigator.languages && navigator.languages[0]))) ||
      (document.documentElement ? document.documentElement.lang : '') ||
      'en';
    return String(navLang).toLowerCase().indexOf('zh') === 0 ? 'zh-TW' : 'en';
  }

  function loadAutoSavePref() {
    try {
      if (window.localStorage) {
        return window.localStorage.getItem(STORAGE_AUTOSAVE_KEY) !== '0';
      }
    } catch (_err) {
      // Ignore storage access errors in sandboxed webviews
    }
    return true;
  }

  var state = {
    lang: detectInitialLocale(),
    mode: 'browse', // 'browse' | 'draw'
    tool: 'pen', // 'pen' | 'highlighter' | 'arrow' | 'rect' | 'laser' | 'eraser'
    sizeIndex: 1, // 0 = S, 1 = M, 2 = L
    toolColors: {
      pen: '#EF4444',
      highlighter: '#FACC15'
    },
    strokes: [],
    undoStack: [],
    redoStack: [],
    laserStrokes: [],
    collapsed: false,
    autoSave: loadAutoSavePref(),
    popoverOpen: false,
    isExporting: false
  };

  function msg() {
    return I18N[state.lang] || I18N.en;
  }

  // Runtime interaction state
  var activeStroke = null;
  var activeLaserStroke = null;
  var activePointerId = null;

  var erasePreSnapshot = null;
  var eraseDidMutate = false;
  var eraseStartPt = null;
  var eraseLastPt = null;
  var eraseMaxDist = 0;
  var eraserHoverPt = null;

  var cssWidth = 0;
  var cssHeight = 0;
  var effectiveDpr = 1;
  var resizeRafId = 0;
  var laserRafId = 0;
  var toastTimerId = 0;
  var saveTimerId = 0;
  var isReattaching = false;
  var resizeObserver = null;
  var observedMpePreviewEl = null;
  var currentDocRawId = '';
  var currentDocKey = '';

  // DOM references
  var canvasLayer = null;
  var staticCanvas = null;
  var liveCanvas = null;
  var staticCtx = null;
  var liveCtx = null;

  var toolbar = null;
  var modeBtn = null;
  var modeLabel = null;
  var collapseBtn = null;
  var toastEl = null;
  var popoverEl = null;
  var fileInputEl = null;

  var toolButtons = {};
  var colorButtons = {};
  var sizeButtons = [];
  var undoBtn = null;
  var redoBtn = null;
  var clearBtn = null;
  var exportBtn = null;
  var langBtn = null;
  var moreBtn = null;
  var autoSaveItem = null;
  var autoSaveLabelEl = null;
  var autoSaveBadge = null;
  var exportJsonItem = null;
  var importJsonItem = null;

  function createSvgIcon(paths) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');

    for (var i = 0; i < paths.length; i++) {
      var spec = paths[i];
      var el = document.createElementNS(SVG_NS, spec.tag || 'path');
      for (var attr in spec) {
        if (attr !== 'tag' && Object.prototype.hasOwnProperty.call(spec, attr)) {
          el.setAttribute(attr, spec[attr]);
        }
      }
      svg.appendChild(el);
    }
    return svg;
  }

  function getToolIcon(toolId) {
    if (toolId === 'pen') {
      return createSvgIcon([
        { d: 'M12 20h9' },
        { d: 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z' }
      ]);
    }
    if (toolId === 'highlighter') {
      return createSvgIcon([
        { d: 'm9 11-6 6v3h9l3-3' },
        { d: 'm22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4' }
      ]);
    }
    if (toolId === 'arrow') {
      return createSvgIcon([
        { d: 'M5 19 19 5' },
        { d: 'M11 5h8v8' }
      ]);
    }
    if (toolId === 'rect') {
      return createSvgIcon([
        { tag: 'rect', x: '4', y: '5', width: '16', height: '14', rx: '2' }
      ]);
    }
    if (toolId === 'laser') {
      return createSvgIcon([
        { tag: 'circle', cx: '12', cy: '12', r: '3' },
        { d: 'M12 2v3' },
        { d: 'M12 19v3' },
        { d: 'M2 12h3' },
        { d: 'M19 12h3' },
        { d: 'm4.93 4.93 2.12 2.12' },
        { d: 'm16.95 16.95 2.12 2.12' },
        { d: 'm19.07 4.93-2.12 2.12' },
        { d: 'm7.05 16.95-2.12 2.12' }
      ]);
    }
    return createSvgIcon([
      { d: 'm7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21' },
      { d: 'M22 21H7' },
      { d: 'm5 11 9 9' }
    ]);
  }

  function getActionIcon(action) {
    if (action === 'undo') {
      return createSvgIcon([
        { d: 'M9 14 4 9l5-5' },
        { d: 'M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11' }
      ]);
    }
    if (action === 'redo') {
      return createSvgIcon([
        { d: 'm15 14 5-5-5-5' },
        { d: 'M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13' }
      ]);
    }
    if (action === 'clear') {
      return createSvgIcon([
        { d: 'M3 6h18' },
        { d: 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' },
        { d: 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' }
      ]);
    }
    if (action === 'export') {
      return createSvgIcon([
        { d: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z' },
        { tag: 'circle', cx: '12', cy: '13', r: '3' }
      ]);
    }
    if (action === 'more') {
      return createSvgIcon([
        { tag: 'circle', cx: '5', cy: '12', r: '1.5', fill: 'currentColor', stroke: 'none' },
        { tag: 'circle', cx: '12', cy: '12', r: '1.5', fill: 'currentColor', stroke: 'none' },
        { tag: 'circle', cx: '19', cy: '12', r: '1.5', fill: 'currentColor', stroke: 'none' }
      ]);
    }
    if (action === 'collapse') {
      return createSvgIcon([
        { d: 'm9 18 6-6-6-6' }
      ]);
    }
    return createSvgIcon([
      { d: 'M12 20h9' },
      { d: 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z' }
    ]);
  }

  function parseCssRgb(colorStr) {
    if (!colorStr) {
      return null;
    }
    var match = colorStr.match(
      /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i
    );
    if (!match) {
      return null;
    }
    return {
      r: Number(match[1]),
      g: Number(match[2]),
      b: Number(match[3]),
      a: match[4] !== undefined ? Number(match[4]) : 1
    };
  }

  function isLightSurface() {
    var candidates = [
      document.querySelector('.crossnote[data-for="preview"]'),
      document.body,
      document.documentElement
    ];
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (!el || typeof window.getComputedStyle !== 'function') {
        continue;
      }
      var parsed = parseCssRgb(window.getComputedStyle(el).backgroundColor);
      if (parsed && parsed.a > 0.1) {
        var luminance = 0.299 * parsed.r + 0.587 * parsed.g + 0.114 * parsed.b;
        return luminance > 150;
      }
    }

    var body = document.body;
    if (!body) {
      return false;
    }
    return (
      body.classList.contains('vscode-light') ||
      body.classList.contains('vscode-high-contrast-light')
    );
  }

  function resolveColor(colorValue) {
    if (colorValue === 'adaptive') {
      return isLightSurface() ? '#1E293B' : '#F8FAFC';
    }
    return colorValue;
  }

  function getActiveColor() {
    if (state.tool === 'highlighter') {
      return state.toolColors.highlighter;
    }
    return state.toolColors.pen;
  }

  function getActiveWidth() {
    var widths = SIZE_MAP[state.tool] || SIZE_MAP.pen;
    return widths[state.sizeIndex] !== undefined ? widths[state.sizeIndex] : widths[1];
  }

  function showToast(message) {
    if (!toastEl) {
      return;
    }
    toastEl.textContent = message;
    toastEl.classList.add('mdo-toast-visible');
    if (toastTimerId) {
      clearTimeout(toastTimerId);
    }
    toastTimerId = setTimeout(function () {
      if (toastEl) {
        toastEl.classList.remove('mdo-toast-visible');
      }
      toastTimerId = 0;
    }, 1300);
  }

  function pushUndoSnapshot(snapshot) {
    state.undoStack.push(snapshot);
    if (state.undoStack.length > MAX_HISTORY) {
      state.undoStack.shift();
    }
    state.redoStack = [];
  }

  function undo() {
    if (state.undoStack.length === 0) {
      return;
    }
    state.redoStack.push(state.strokes.slice());
    if (state.redoStack.length > MAX_HISTORY) {
      state.redoStack.shift();
    }
    state.strokes = state.undoStack.pop();
    renderStaticCanvas();
    updateUI();
    scheduleSaveStrokes();
  }

  function redo() {
    if (state.redoStack.length === 0) {
      return;
    }
    state.undoStack.push(state.strokes.slice());
    if (state.undoStack.length > MAX_HISTORY) {
      state.undoStack.shift();
    }
    state.strokes = state.redoStack.pop();
    renderStaticCanvas();
    updateUI();
    scheduleSaveStrokes();
  }

  function clearAll() {
    if (state.strokes.length === 0) {
      return;
    }
    pushUndoSnapshot(state.strokes.slice());
    state.strokes = [];
    renderStaticCanvas();
    updateUI();
    scheduleSaveStrokes();
    showToast(msg().toastCleared);
  }

  function setMode(nextMode, withToast) {
    if (state.mode === nextMode) {
      return;
    }
    if (nextMode === 'browse') {
      cancelOrCommitInFlightInteraction();
      eraserHoverPt = null;
      if (canvasLayer) {
        canvasLayer.classList.add('mdo-pointer-outside');
      }
      renderLiveCanvas();
    }
    state.mode = nextMode;
    updateUI();
    if (withToast) {
      showToast(nextMode === 'draw' ? msg().toastDraw : msg().toastBrowse);
    }
  }

  function toggleMode(withToast) {
    setMode(state.mode === 'draw' ? 'browse' : 'draw', withToast);
  }

  function setTool(nextTool) {
    state.tool = nextTool;
    if (nextTool !== 'eraser') {
      eraserHoverPt = null;
    }
    if (state.mode !== 'draw') {
      setMode('draw', false);
    } else {
      updateUI();
      renderLiveCanvas();
    }
  }

  function selectColor(colorValue) {
    if (state.tool === 'highlighter') {
      state.toolColors.highlighter = colorValue;
    } else {
      state.toolColors.pen = colorValue;
      if (state.tool === 'eraser' || state.tool === 'laser') {
        state.tool = 'pen';
      }
    }
    if (state.mode !== 'draw') {
      state.mode = 'draw';
    }
    updateUI();
    renderLiveCanvas();
  }

  function selectSize(index) {
    state.sizeIndex = index;
    updateUI();
    renderLiveCanvas();
  }

  function closePopover() {
    if (!state.popoverOpen) {
      return;
    }
    state.popoverOpen = false;
    updateUI();
  }

  function togglePopover() {
    state.popoverOpen = !state.popoverOpen;
    updateUI();
  }

  function toggleCollapsed() {
    state.collapsed = !state.collapsed;
    if (state.collapsed) {
      state.popoverOpen = false;
    }
    updateUI();
  }

  // Geometry & Smooth Curve Rendering
  function dist(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function distToSegmentSq(p, a, b) {
    var l2 = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
    if (l2 === 0) {
      return (p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y);
    }
    var t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    if (t < 0) {
      t = 0;
    } else if (t > 1) {
      t = 1;
    }
    var projX = a.x + t * (b.x - a.x);
    var projY = a.y + t * (b.y - a.y);
    return (p.x - projX) * (p.x - projX) + (p.y - projY) * (p.y - projY);
  }

  function distPointToPolyline(pt, points) {
    if (!points || points.length === 0) {
      return Infinity;
    }
    if (points.length === 1) {
      return dist(pt, points[0]);
    }
    var minSq = Infinity;
    for (var i = 0; i < points.length - 1; i++) {
      var sq = distToSegmentSq(pt, points[i], points[i + 1]);
      if (sq < minSq) {
        minSq = sq;
      }
    }
    return Math.sqrt(minSq);
  }

  function getStrokeBBox(points) {
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    for (var i = 0; i < points.length; i++) {
      var pt = points[i];
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function densifyPoints(points, maxStep) {
    if (points.length <= 1) {
      return points.slice();
    }
    var result = [points[0]];
    for (var i = 1; i < points.length; i++) {
      var prev = points[i - 1];
      var curr = points[i];
      var d = dist(prev, curr);
      if (d > maxStep) {
        var steps = Math.ceil(d / maxStep);
        for (var s = 1; s < steps; s++) {
          var t = s / steps;
          result.push({
            x: prev.x + (curr.x - prev.x) * t,
            y: prev.y + (curr.y - prev.y) * t
          });
        }
      }
      result.push(curr);
    }
    return result;
  }

  function drawSmoothPath(ctx, points, width) {
    if (!points || points.length === 0) {
      return;
    }
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();
      return;
    }
    var mid0X = (points[0].x + points[1].x) * 0.5;
    var mid0Y = (points[0].y + points[1].y) * 0.5;
    ctx.lineTo(mid0X, mid0Y);
    for (var i = 1; i < points.length - 1; i++) {
      var midX = (points[i].x + points[i + 1].x) * 0.5;
      var midY = (points[i].y + points[i + 1].y) * 0.5;
      ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    }
    var last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  function getArrowWingPoints(start, end, width) {
    var len = dist(start, end);
    if (len < 4) {
      return null;
    }
    var angle = Math.atan2(end.y - start.y, end.x - start.x);
    var headLen = Math.min(len * 0.45, Math.max(12, width * 3.4));
    var headAngle = Math.PI / 6;
    return [
      {
        x: end.x - headLen * Math.cos(angle - headAngle),
        y: end.y - headLen * Math.sin(angle - headAngle)
      },
      {
        x: end.x - headLen * Math.cos(angle + headAngle),
        y: end.y - headLen * Math.sin(angle + headAngle)
      }
    ];
  }

  function drawRoundedRectStroke(ctx, start, end) {
    var x = Math.min(start.x, end.x);
    var y = Math.min(start.y, end.y);
    var w = Math.abs(end.x - start.x);
    var h = Math.abs(end.y - start.y);
    if (w < 0.5 && h < 0.5) {
      return;
    }
    var r = Math.min(6, w * 0.15, h * 0.15);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.stroke();
  }

  function drawCommittedStroke(ctx, stroke) {
    if (!stroke) {
      return;
    }
    var kind = stroke.kind || 'freehand';
    var resolved = resolveColor(stroke.color);
    ctx.save();
    ctx.globalAlpha = stroke.opacity;
    ctx.strokeStyle = resolved;
    ctx.fillStyle = resolved;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (kind === 'line' && stroke.start && stroke.end) {
      ctx.beginPath();
      ctx.moveTo(stroke.start.x, stroke.start.y);
      ctx.lineTo(stroke.end.x, stroke.end.y);
      ctx.stroke();
    } else if (kind === 'arrow' && stroke.start && stroke.end) {
      ctx.beginPath();
      ctx.moveTo(stroke.start.x, stroke.start.y);
      ctx.lineTo(stroke.end.x, stroke.end.y);
      ctx.stroke();
      var wings = getArrowWingPoints(stroke.start, stroke.end, stroke.width);
      if (wings) {
        ctx.beginPath();
        ctx.moveTo(wings[0].x, wings[0].y);
        ctx.lineTo(stroke.end.x, stroke.end.y);
        ctx.lineTo(wings[1].x, wings[1].y);
        ctx.stroke();
      }
    } else if (kind === 'rect' && stroke.start && stroke.end) {
      drawRoundedRectStroke(ctx, stroke.start, stroke.end);
    } else if (stroke.points && stroke.points.length > 0) {
      drawSmoothPath(ctx, stroke.points, stroke.width);
    }

    ctx.restore();
  }

  function drawLaserStroke(ctx, laserStroke, alpha) {
    if (!laserStroke || !laserStroke.points || laserStroke.points.length === 0 || alpha <= 0) {
      return;
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Outer red glow pass
    ctx.globalAlpha = alpha * 0.92;
    ctx.strokeStyle = '#FF2A2A';
    ctx.fillStyle = '#FF2A2A';
    ctx.shadowColor = 'rgba(255, 42, 42, 0.92)';
    ctx.shadowBlur = 14;
    ctx.lineWidth = laserStroke.width * 1.45;
    drawSmoothPath(ctx, laserStroke.points, laserStroke.width * 1.45);

    // Inner bright core pass
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#FFF1F1';
    ctx.fillStyle = '#FFF1F1';
    ctx.shadowColor = 'rgba(255, 220, 220, 0.85)';
    ctx.shadowBlur = 4;
    ctx.lineWidth = laserStroke.width * 0.48;
    drawSmoothPath(ctx, laserStroke.points, laserStroke.width * 0.48);

    ctx.restore();
  }

  function drawEraserCursor(ctx, pt) {
    if (!pt || state.mode !== 'draw' || state.tool !== 'eraser') {
      return;
    }
    var radius = getActiveWidth();
    ctx.save();
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isLightSurface()
      ? 'rgba(0, 0, 0, 0.08)'
      : 'rgba(255, 255, 255, 0.10)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = isLightSurface()
      ? 'rgba(15, 23, 42, 0.72)'
      : 'rgba(248, 250, 252, 0.82)';
    ctx.stroke();
    ctx.restore();
  }

  function renderStaticCanvas() {
    if (!staticCtx || cssWidth <= 0 || cssHeight <= 0) {
      return;
    }
    staticCtx.save();
    staticCtx.setTransform(1, 0, 0, 1, 0, 0);
    staticCtx.clearRect(0, 0, staticCanvas.width, staticCanvas.height);
    staticCtx.restore();

    for (var i = 0; i < state.strokes.length; i++) {
      drawCommittedStroke(staticCtx, state.strokes[i]);
    }
  }

  function renderLiveCanvas(now) {
    if (!liveCtx || cssWidth <= 0 || cssHeight <= 0) {
      return;
    }
    var currentTime = typeof now === 'number' ? now : performance.now();

    liveCtx.save();
    liveCtx.setTransform(1, 0, 0, 1, 0, 0);
    liveCtx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
    liveCtx.restore();

    if (activeStroke) {
      drawCommittedStroke(liveCtx, activeStroke);
    }

    for (var i = 0; i < state.laserStrokes.length; i++) {
      var lStroke = state.laserStrokes[i];
      var alpha = 1;
      if (lStroke.endedAt !== null) {
        var elapsed = currentTime - lStroke.endedAt;
        var p = Math.min(1, Math.max(0, elapsed / LASER_FADE_MS));
        alpha = (1 - p) * (1 - p);
      }
      drawLaserStroke(liveCtx, lStroke, alpha);
    }

    if (eraserHoverPt) {
      drawEraserCursor(liveCtx, eraserHoverPt);
    }
  }

  function startLaserLoop() {
    if (laserRafId) {
      return;
    }
    var tick = function (now) {
      laserRafId = 0;
      var remaining = [];
      for (var i = 0; i < state.laserStrokes.length; i++) {
        var lStroke = state.laserStrokes[i];
        if (lStroke.endedAt === null || now - lStroke.endedAt < LASER_FADE_MS) {
          remaining.push(lStroke);
        }
      }
      state.laserStrokes = remaining;
      renderLiveCanvas(now);

      if (state.laserStrokes.length > 0) {
        laserRafId = requestAnimationFrame(tick);
      }
    };
    laserRafId = requestAnimationFrame(tick);
  }

  // Vector Eraser
  function getShapeSegments(stroke) {
    var kind = stroke.kind || 'freehand';
    if (!stroke.start || !stroke.end) {
      return [];
    }
    if (kind === 'line') {
      return [[stroke.start, stroke.end]];
    }
    if (kind === 'arrow') {
      var segs = [[stroke.start, stroke.end]];
      var wings = getArrowWingPoints(stroke.start, stroke.end, stroke.width);
      if (wings) {
        segs.push([wings[0], stroke.end], [wings[1], stroke.end]);
      }
      return segs;
    }
    if (kind === 'rect') {
      var minX = Math.min(stroke.start.x, stroke.end.x);
      var maxX = Math.max(stroke.start.x, stroke.end.x);
      var minY = Math.min(stroke.start.y, stroke.end.y);
      var maxY = Math.max(stroke.start.y, stroke.end.y);
      var tl = { x: minX, y: minY };
      var tr = { x: maxX, y: minY };
      var br = { x: maxX, y: maxY };
      var bl = { x: minX, y: maxY };
      return [
        [tl, tr],
        [tr, br],
        [br, bl],
        [bl, tl]
      ];
    }
    return [];
  }

  function orientationSign(a, b, c) {
    var v = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
    if (Math.abs(v) < 1e-6) {
      return 0;
    }
    return v > 0 ? 1 : 2;
  }

  function onSegmentBox(p, q, r) {
    return (
      q.x <= Math.max(p.x, r.x) &&
      q.x >= Math.min(p.x, r.x) &&
      q.y <= Math.max(p.y, r.y) &&
      q.y >= Math.min(p.y, r.y)
    );
  }

  function segmentsIntersect(a1, a2, b1, b2) {
    var o1 = orientationSign(a1, a2, b1);
    var o2 = orientationSign(a1, a2, b2);
    var o3 = orientationSign(b1, b2, a1);
    var o4 = orientationSign(b1, b2, a2);
    if (o1 !== o2 && o3 !== o4) {
      return true;
    }
    if (o1 === 0 && onSegmentBox(a1, b1, a2)) return true;
    if (o2 === 0 && onSegmentBox(a1, b2, a2)) return true;
    if (o3 === 0 && onSegmentBox(b1, a1, b2)) return true;
    if (o4 === 0 && onSegmentBox(b1, a2, b2)) return true;
    return false;
  }

  function distSegmentToSegment(a1, a2, b1, b2) {
    if (segmentsIntersect(a1, a2, b1, b2)) {
      return 0;
    }
    return Math.sqrt(
      Math.min(
        distToSegmentSq(a1, b1, b2),
        distToSegmentSq(a2, b1, b2),
        distToSegmentSq(b1, a1, a2),
        distToSegmentSq(b2, a1, a2)
      )
    );
  }

  function getAnyStrokeBBox(stroke) {
    var kind = stroke.kind || 'freehand';
    if (kind === 'freehand') {
      return getStrokeBBox(stroke.points || []);
    }
    var segs = getShapeSegments(stroke);
    var pts = [];
    for (var i = 0; i < segs.length; i++) {
      pts.push(segs[i][0], segs[i][1]);
    }
    return getStrokeBBox(pts);
  }

  function eraseAlongSegment(segStart, segEnd) {
    if (state.strokes.length === 0) {
      return false;
    }
    var eraserRadius = SIZE_MAP.eraser[state.sizeIndex] || SIZE_MAP.eraser[1];
    var segMinX = Math.min(segStart.x, segEnd.x);
    var segMaxX = Math.max(segStart.x, segEnd.x);
    var segMinY = Math.min(segStart.y, segEnd.y);
    var segMaxY = Math.max(segStart.y, segEnd.y);

    var nextStrokes = [];
    var changed = false;

    for (var i = 0; i < state.strokes.length; i++) {
      var stroke = state.strokes[i];
      var kind = stroke.kind || 'freehand';
      var effectiveRadius = eraserRadius + stroke.width * 0.35;
      var bbox = getAnyStrokeBBox(stroke);

      if (
        segMaxX + effectiveRadius < bbox.minX ||
        segMinX - effectiveRadius > bbox.maxX ||
        segMaxY + effectiveRadius < bbox.minY ||
        segMinY - effectiveRadius > bbox.maxY
      ) {
        nextStrokes.push(stroke);
        continue;
      }

      if (kind !== 'freehand') {
        var shapeSegs = getShapeSegments(stroke);
        var hitShape = false;
        for (var sIdx = 0; sIdx < shapeSegs.length; sIdx++) {
          if (
            distSegmentToSegment(segStart, segEnd, shapeSegs[sIdx][0], shapeSegs[sIdx][1]) <=
            effectiveRadius
          ) {
            hitShape = true;
            break;
          }
        }
        if (hitShape) {
          changed = true;
        } else {
          nextStrokes.push(stroke);
        }
        continue;
      }

      var effSq = effectiveRadius * effectiveRadius;

      if (stroke.points.length === 1) {
        if (distToSegmentSq(stroke.points[0], segStart, segEnd) <= effSq) {
          changed = true;
        } else {
          nextStrokes.push(stroke);
        }
        continue;
      }

      var dense = densifyPoints(stroke.points, 3.5);
      var currentRun = [];
      var runs = [];
      var hitAny = false;

      for (var j = 0; j < dense.length; j++) {
        var pt = dense[j];
        if (distToSegmentSq(pt, segStart, segEnd) <= effSq) {
          hitAny = true;
          if (currentRun.length >= 2) {
            runs.push(currentRun);
          }
          currentRun = [];
        } else {
          currentRun.push(pt);
        }
      }
      if (currentRun.length >= 2) {
        runs.push(currentRun);
      }

      if (!hitAny) {
        nextStrokes.push(stroke);
      } else {
        changed = true;
        for (var r = 0; r < runs.length; r++) {
          nextStrokes.push({
            kind: 'freehand',
            tool: stroke.tool,
            color: stroke.color,
            width: stroke.width,
            opacity: stroke.opacity,
            points: runs[r]
          });
        }
      }
    }

    if (changed) {
      state.strokes = nextStrokes;
    }
    return changed;
  }

  function eraseWholeStrokeAtPoint(pt) {
    if (state.strokes.length === 0) {
      return false;
    }
    var eraserRadius = SIZE_MAP.eraser[state.sizeIndex] || SIZE_MAP.eraser[1];
    for (var i = state.strokes.length - 1; i >= 0; i--) {
      var stroke = state.strokes[i];
      var kind = stroke.kind || 'freehand';
      var hitDist = eraserRadius + stroke.width * 0.5 + 3;

      if (kind !== 'freehand') {
        var shapeSegs = getShapeSegments(stroke);
        var hitShape = false;
        for (var s = 0; s < shapeSegs.length; s++) {
          if (Math.sqrt(distToSegmentSq(pt, shapeSegs[s][0], shapeSegs[s][1])) <= hitDist) {
            hitShape = true;
            break;
          }
        }
        if (hitShape) {
          var nextShapeList = state.strokes.slice();
          nextShapeList.splice(i, 1);
          state.strokes = nextShapeList;
          return true;
        }
        continue;
      }

      if (distPointToPolyline(pt, stroke.points) <= hitDist) {
        var next = state.strokes.slice();
        next.splice(i, 1);
        state.strokes = next;
        return true;
      }
    }
    return false;
  }

  // Pointer Input
  function getCanvasPoint(e) {
    var rect = liveCanvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function appendSmoothedPoint(points, rawPt) {
    var last = points[points.length - 1];
    if (dist(last, rawPt) < MIN_POINT_DIST) {
      return false;
    }
    var smoothed = {
      x: last.x + (rawPt.x - last.x) * EMA_CURRENT_WEIGHT,
      y: last.y + (rawPt.y - last.y) * EMA_CURRENT_WEIGHT
    };
    points.push(smoothed);
    return true;
  }

  function snapStraightLine(start, end, mode) {
    var dx = end.x - start.x;
    var dy = end.y - start.y;
    var r = Math.sqrt(dx * dx + dy * dy);
    if (r < 1) {
      return { x: end.x, y: end.y };
    }
    if (mode === 'square') {
      var side = Math.max(Math.abs(dx), Math.abs(dy));
      return {
        x: start.x + (dx < 0 ? -side : side),
        y: start.y + (dy < 0 ? -side : side)
      };
    }
    if (mode === 'angle15') {
      var step = Math.PI / 12;
      var snapped = Math.round(Math.atan2(dy, dx) / step) * step;
      return {
        x: start.x + Math.cos(snapped) * r,
        y: start.y + Math.sin(snapped) * r
      };
    }
    // Magnetic horizontal/vertical snap within ±6 degrees
    var angle = Math.atan2(dy, dx);
    var sinThreshold = Math.sin(MAGNETIC_SNAP_RAD);
    if (Math.abs(Math.sin(angle)) <= sinThreshold) {
      return { x: end.x, y: start.y };
    }
    if (Math.abs(Math.cos(angle)) <= sinThreshold) {
      return { x: start.x, y: end.y };
    }
    return { x: end.x, y: end.y };
  }

  function normalizeCommittedStroke(stroke) {
    if (!stroke) {
      return null;
    }
    var kind = stroke.kind || 'freehand';
    if (kind === 'line' || kind === 'arrow' || kind === 'rect') {
      if (!stroke.start || !stroke.end) {
        return null;
      }
      if ((kind === 'arrow' || kind === 'rect') && dist(stroke.start, stroke.end) < 3) {
        return null;
      }
      return {
        kind: kind,
        tool: stroke.tool,
        color: stroke.color,
        width: stroke.width,
        opacity: stroke.opacity,
        start: { x: stroke.start.x, y: stroke.start.y },
        end: { x: stroke.end.x, y: stroke.end.y }
      };
    }
    if (!stroke.points || stroke.points.length === 0) {
      return null;
    }
    return {
      kind: 'freehand',
      tool: stroke.tool,
      color: stroke.color,
      width: stroke.width,
      opacity: stroke.opacity,
      points: stroke.points
    };
  }

  function cancelOrCommitInFlightInteraction() {
    if (activeStroke) {
      var committed = normalizeCommittedStroke(activeStroke);
      if (committed) {
        pushUndoSnapshot(state.strokes.slice());
        state.strokes = state.strokes.concat([committed]);
        renderStaticCanvas();
        scheduleSaveStrokes();
      }
      activeStroke = null;
    }
    if (activeLaserStroke) {
      activeLaserStroke.endedAt = performance.now();
      activeLaserStroke = null;
      startLaserLoop();
    }
    if (erasePreSnapshot && eraseDidMutate) {
      pushUndoSnapshot(erasePreSnapshot);
      scheduleSaveStrokes();
    }
    erasePreSnapshot = null;
    eraseDidMutate = false;
    eraseStartPt = null;
    eraseLastPt = null;
    eraseMaxDist = 0;
    activePointerId = null;
  }

  function handlePointerDown(e) {
    if (state.mode !== 'draw') {
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) {
      return;
    }
    if (activePointerId !== null) {
      return;
    }

    closePopover();
    e.preventDefault();
    activePointerId = e.pointerId;
    if (liveCanvas.setPointerCapture) {
      try {
        liveCanvas.setPointerCapture(e.pointerId);
      } catch (_err) {
        // Ignore if element cannot capture pointer
      }
    }

    var pt = getCanvasPoint(e);

    if (state.tool === 'eraser') {
      eraserHoverPt = pt;
      if (canvasLayer) {
        canvasLayer.classList.remove('mdo-pointer-outside');
      }
      erasePreSnapshot = state.strokes.slice();
      eraseDidMutate = false;
      eraseStartPt = pt;
      eraseLastPt = pt;
      eraseMaxDist = 0;
      renderLiveCanvas();
      return;
    }

    if (state.tool === 'laser') {
      activeLaserStroke = {
        width: getActiveWidth(),
        points: [pt],
        endedAt: null
      };
      state.laserStrokes.push(activeLaserStroke);
      startLaserLoop();
      renderLiveCanvas();
      return;
    }

    if (state.tool === 'arrow' || state.tool === 'rect') {
      activeStroke = {
        kind: state.tool,
        tool: state.tool,
        color: getActiveColor(),
        width: getActiveWidth(),
        opacity: 1.0,
        start: pt,
        end: pt
      };
      renderLiveCanvas();
      return;
    }

    activeStroke = {
      kind: e.shiftKey ? 'line' : 'freehand',
      tool: state.tool,
      color: getActiveColor(),
      width: getActiveWidth(),
      opacity: state.tool === 'highlighter' ? 0.35 : 1.0,
      points: [pt],
      start: pt,
      end: pt
    };
    renderLiveCanvas();
  }

  function handlePointerMove(e) {
    if (state.mode !== 'draw') {
      return;
    }

    if (state.tool === 'eraser' && activePointerId === null) {
      eraserHoverPt = getCanvasPoint(e);
      if (canvasLayer) {
        canvasLayer.classList.remove('mdo-pointer-outside');
      }
      renderLiveCanvas();
      return;
    }

    if (e.pointerId !== activePointerId) {
      return;
    }

    var events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
    var list = events && events.length > 0 ? events : [e];

    if (state.tool === 'eraser' && eraseLastPt) {
      var anyErased = false;
      for (var i = 0; i < list.length; i++) {
        var pt = getCanvasPoint(list[i]);
        var movedFromStart = dist(eraseStartPt, pt);
        if (movedFromStart > eraseMaxDist) {
          eraseMaxDist = movedFromStart;
        }
        if (eraseMaxDist >= ERASER_CLICK_THRESHOLD) {
          if (eraseAlongSegment(eraseLastPt, pt)) {
            eraseDidMutate = true;
            anyErased = true;
          }
        }
        eraseLastPt = pt;
        eraserHoverPt = pt;
      }
      if (anyErased) {
        renderStaticCanvas();
      }
      renderLiveCanvas();
      return;
    }

    if (activeLaserStroke) {
      var laserAdded = false;
      for (var l = 0; l < list.length; l++) {
        var lPt = getCanvasPoint(list[l]);
        if (appendSmoothedPoint(activeLaserStroke.points, lPt)) {
          laserAdded = true;
        }
      }
      if (laserAdded) {
        renderLiveCanvas();
      }
      return;
    }

    if (!activeStroke) {
      return;
    }

    var latestPt = getCanvasPoint(list[list.length - 1]);

    if (activeStroke.kind === 'arrow') {
      activeStroke.end = e.shiftKey ? snapStraightLine(activeStroke.start, latestPt, 'angle15') : latestPt;
      renderLiveCanvas();
      return;
    }

    if (activeStroke.kind === 'rect') {
      activeStroke.end = e.shiftKey ? snapStraightLine(activeStroke.start, latestPt, 'square') : latestPt;
      renderLiveCanvas();
      return;
    }

    if (activeStroke.kind === 'line' || e.shiftKey) {
      activeStroke.kind = 'line';
      activeStroke.end = e.shiftKey
        ? snapStraightLine(activeStroke.start, latestPt, 'magnetic')
        : latestPt;
      renderLiveCanvas();
      return;
    }

    var added = false;
    for (var k = 0; k < list.length; k++) {
      var samplePt = getCanvasPoint(list[k]);
      if (appendSmoothedPoint(activeStroke.points, samplePt)) {
        added = true;
      }
    }
    if (added) {
      renderLiveCanvas();
    }
  }

  function finishPointerInteraction(e, isCancel) {
    if (e.pointerId !== activePointerId) {
      return;
    }

    if (liveCanvas.releasePointerCapture) {
      try {
        if (liveCanvas.hasPointerCapture && liveCanvas.hasPointerCapture(e.pointerId)) {
          liveCanvas.releasePointerCapture(e.pointerId);
        }
      } catch (_err) {
        // Ignore release errors
      }
    }

    if (state.tool === 'eraser') {
      var pt = getCanvasPoint(e);
      if (!isCancel && eraseMaxDist < ERASER_CLICK_THRESHOLD) {
        if (eraseWholeStrokeAtPoint(pt)) {
          eraseDidMutate = true;
          renderStaticCanvas();
        }
      }
      if (eraseDidMutate && erasePreSnapshot) {
        pushUndoSnapshot(erasePreSnapshot);
        scheduleSaveStrokes();
      }
      erasePreSnapshot = null;
      eraseDidMutate = false;
      eraseStartPt = null;
      eraseLastPt = null;
      eraseMaxDist = 0;
      activePointerId = null;
      updateUI();
      renderLiveCanvas();
      return;
    }

    if (activeLaserStroke) {
      activeLaserStroke.endedAt = performance.now();
      activeLaserStroke = null;
      activePointerId = null;
      startLaserLoop();
      renderLiveCanvas();
      return;
    }

    if (activeStroke) {
      if (!isCancel) {
        var committed = normalizeCommittedStroke(activeStroke);
        if (committed) {
          pushUndoSnapshot(state.strokes.slice());
          state.strokes = state.strokes.concat([committed]);
          renderStaticCanvas();
          scheduleSaveStrokes();
        }
      }
      activeStroke = null;
      activePointerId = null;
      updateUI();
      renderLiveCanvas();
      return;
    }

    activePointerId = null;
  }

  function handlePointerLeave() {
    if (eraserHoverPt && activePointerId === null) {
      eraserHoverPt = null;
      if (canvasLayer) {
        canvasLayer.classList.add('mdo-pointer-outside');
      }
      renderLiveCanvas();
    }
  }

  // Canvas Sizing, Scroll Tracking & DPR
  function computeEffectiveDpr(w, h) {
    var rawDpr = window.devicePixelRatio || 1;
    var dpr = Math.max(1, rawDpr);
    if (w <= 0 || h <= 0) {
      return dpr;
    }
    var maxByWidth = MAX_CANVAS_DIM / w;
    var maxByHeight = MAX_CANVAS_DIM / h;
    var maxByArea = Math.sqrt(MAX_CANVAS_AREA / (w * h));
    var capped = Math.min(dpr, maxByWidth, maxByHeight, maxByArea);
    return Math.max(0.5, capped);
  }

  function syncCanvasSize() {
    if (!canvasLayer || !staticCanvas || !liveCanvas) {
      return;
    }

    // Temporarily collapse overlay so shrinking document height is measured accurately
    canvasLayer.style.width = '0px';
    canvasLayer.style.height = '0px';

    var docEl = document.documentElement;
    var body = document.body;
    var nextW = Math.max(
      docEl ? docEl.scrollWidth : 0,
      body ? body.scrollWidth : 0,
      docEl ? docEl.clientWidth : 0
    );
    var nextH = Math.max(
      docEl ? docEl.scrollHeight : 0,
      body ? body.scrollHeight : 0,
      docEl ? docEl.clientHeight : 0
    );

    canvasLayer.style.width = nextW + 'px';
    canvasLayer.style.height = nextH + 'px';

    var nextDpr = computeEffectiveDpr(nextW, nextH);
    var changed =
      nextW !== cssWidth ||
      nextH !== cssHeight ||
      Math.abs(nextDpr - effectiveDpr) > 0.001;

    if (!changed) {
      return;
    }

    cssWidth = nextW;
    cssHeight = nextH;
    effectiveDpr = nextDpr;

    var bufW = Math.max(1, Math.round(cssWidth * effectiveDpr));
    var bufH = Math.max(1, Math.round(cssHeight * effectiveDpr));

    staticCanvas.width = bufW;
    staticCanvas.height = bufH;
    liveCanvas.width = bufW;
    liveCanvas.height = bufH;

    staticCtx.setTransform(effectiveDpr, 0, 0, effectiveDpr, 0, 0);
    liveCtx.setTransform(effectiveDpr, 0, 0, effectiveDpr, 0, 0);

    renderStaticCanvas();
    renderLiveCanvas();
  }

  function scheduleSyncSize() {
    if (resizeRafId) {
      return;
    }
    resizeRafId = requestAnimationFrame(function () {
      resizeRafId = 0;
      syncCanvasSize();
    });
  }

  // Per-Document Persistence & .mdo.json Export/Import
  function getRawDocumentId() {
    var meta = document.getElementById('vscode-markdown-preview-data');
    if (meta) {
      var rawSettings = meta.getAttribute('data-settings');
      if (rawSettings) {
        try {
          var parsed = JSON.parse(rawSettings);
          if (parsed && typeof parsed.source === 'string' && parsed.source) {
            return parsed.source;
          }
        } catch (_err) {
          // Ignore malformed data-settings JSON
        }
      }
    }
    if (document.body) {
      var sourceUri = document.body.getAttribute('data-source-uri');
      if (sourceUri) {
        return sourceUri;
      }
    }
    var firstHeading = document.querySelector('h1, h2');
    var headingText = firstHeading ? String(firstHeading.textContent || '').trim().slice(0, 60) : '';
    return [window.location.pathname || '', document.title || '', headingText].join('|');
  }

  function computeDocKey(rawId) {
    var hash = 0x811c9dc5;
    var str = String(rawId || 'default');
    for (var i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
    }
    return STORAGE_PREFIX + ('00000000' + hash.toString(16)).slice(-8);
  }

  function round1(num) {
    return Math.round(num * 10) / 10;
  }

  function compactStrokes(strokes) {
    var out = [];
    for (var i = 0; i < strokes.length; i++) {
      var s = strokes[i];
      if (!s) continue;
      var kind = s.kind || 'freehand';
      if (kind === 'line' || kind === 'arrow' || kind === 'rect') {
        if (!s.start || !s.end) continue;
        out.push({
          kind: kind,
          tool: s.tool,
          color: s.color,
          width: round1(s.width),
          opacity: round1(s.opacity * 100) / 100,
          start: { x: round1(s.start.x), y: round1(s.start.y) },
          end: { x: round1(s.end.x), y: round1(s.end.y) }
        });
      } else if (s.points && s.points.length > 0) {
        var pts = [];
        for (var j = 0; j < s.points.length; j++) {
          pts.push({ x: round1(s.points[j].x), y: round1(s.points[j].y) });
        }
        out.push({
          kind: 'freehand',
          tool: s.tool,
          color: s.color,
          width: round1(s.width),
          opacity: round1(s.opacity * 100) / 100,
          points: pts
        });
      }
    }
    return out;
  }

  function isValidPoint(pt) {
    return Boolean(pt && typeof pt.x === 'number' && typeof pt.y === 'number' && isFinite(pt.x) && isFinite(pt.y));
  }

  function sanitizeStrokes(list) {
    if (!Array.isArray(list)) {
      return [];
    }
    var valid = [];
    var limit = Math.min(list.length, 5000);
    for (var i = 0; i < limit; i++) {
      var s = list[i];
      if (!s || typeof s !== 'object') continue;
      var kind = s.kind || 'freehand';
      if (kind !== 'freehand' && kind !== 'line' && kind !== 'arrow' && kind !== 'rect') continue;
      var tool = s.tool;
      if (tool !== 'pen' && tool !== 'highlighter' && tool !== 'arrow' && tool !== 'rect') continue;
      var color = s.color;
      if (typeof color !== 'string' || (color !== 'adaptive' && !/^#[0-9a-f]{3,8}$/i.test(color))) continue;
      if (typeof s.width !== 'number' || !isFinite(s.width) || s.width <= 0 || s.width > 64) continue;
      var opacity = typeof s.opacity === 'number' && isFinite(s.opacity) ? Math.max(0.05, Math.min(1, s.opacity)) : 1;

      if (kind === 'freehand') {
        if (!Array.isArray(s.points) || s.points.length === 0) continue;
        var pts = [];
        var ptLimit = Math.min(s.points.length, 20000);
        for (var j = 0; j < ptLimit; j++) {
          if (isValidPoint(s.points[j])) {
            pts.push({ x: s.points[j].x, y: s.points[j].y });
          }
        }
        if (pts.length > 0) {
          valid.push({ kind: 'freehand', tool: tool, color: color, width: s.width, opacity: opacity, points: pts });
        }
      } else {
        if (!isValidPoint(s.start) || !isValidPoint(s.end)) continue;
        valid.push({
          kind: kind,
          tool: tool,
          color: color,
          width: s.width,
          opacity: opacity,
          start: { x: s.start.x, y: s.start.y },
          end: { x: s.end.x, y: s.end.y }
        });
      }
    }
    return valid;
  }

  function readStorageIndex() {
    try {
      var raw = window.localStorage ? window.localStorage.getItem(STORAGE_INDEX_KEY) : '';
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_err) {
      return [];
    }
  }

  function writeStorageIndex(indexList) {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(indexList));
      }
    } catch (_err) {
      // Ignore storage index errors
    }
  }

  function saveCurrentDocStrokes() {
    if (!state.autoSave || !currentDocKey || !window.localStorage) {
      return;
    }
    try {
      var indexList = readStorageIndex().filter(function (entry) {
        return entry && entry.key !== currentDocKey;
      });
      if (state.strokes.length === 0) {
        window.localStorage.removeItem(currentDocKey);
        writeStorageIndex(indexList);
        return;
      }
      var payload = JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        source: currentDocRawId,
        strokes: compactStrokes(state.strokes)
      });
      try {
        window.localStorage.setItem(currentDocKey, payload);
      } catch (_quotaErr) {
        while (indexList.length > 0) {
          var oldest = indexList.shift();
          if (oldest && oldest.key) {
            window.localStorage.removeItem(oldest.key);
          }
          try {
            window.localStorage.setItem(currentDocKey, payload);
            break;
          } catch (_retryErr) {
            // Continue evicting
          }
        }
      }
      indexList.push({ key: currentDocKey, savedAt: Date.now() });
      while (indexList.length > MAX_STORED_DOCS) {
        var evicted = indexList.shift();
        if (evicted && evicted.key) {
          window.localStorage.removeItem(evicted.key);
        }
      }
      writeStorageIndex(indexList);
    } catch (_err) {
      // Ignore storage failures in sandboxed environments
    }
  }

  function scheduleSaveStrokes() {
    if (!state.autoSave) {
      return;
    }
    if (saveTimerId) {
      clearTimeout(saveTimerId);
    }
    saveTimerId = setTimeout(function () {
      saveTimerId = 0;
      saveCurrentDocStrokes();
    }, SAVE_DEBOUNCE_MS);
  }

  function flushSaveStrokes() {
    if (saveTimerId) {
      clearTimeout(saveTimerId);
      saveTimerId = 0;
      saveCurrentDocStrokes();
    }
  }

  function loadDocStrokesForKey(docKey) {
    if (!state.autoSave || !docKey || !window.localStorage) {
      return [];
    }
    try {
      var raw = window.localStorage.getItem(docKey);
      if (!raw) {
        return [];
      }
      var parsed = JSON.parse(raw);
      return parsed && Array.isArray(parsed.strokes) ? sanitizeStrokes(parsed.strokes) : [];
    } catch (_err) {
      return [];
    }
  }

  function checkDocumentChanged() {
    var nextRawId = getRawDocumentId();
    if (!nextRawId || nextRawId === currentDocRawId) {
      return;
    }
    flushSaveStrokes();
    currentDocRawId = nextRawId;
    currentDocKey = computeDocKey(nextRawId);
    state.undoStack = [];
    state.redoStack = [];
    state.strokes = state.autoSave ? loadDocStrokesForKey(currentDocKey) : [];
    renderStaticCanvas();
    updateUI();
  }

  function toggleAutoSave() {
    state.autoSave = !state.autoSave;
    try {
      if (window.localStorage) {
        window.localStorage.setItem(STORAGE_AUTOSAVE_KEY, state.autoSave ? '1' : '0');
      }
    } catch (_err) {
      // Ignore storage access errors
    }
    if (state.autoSave && state.strokes.length > 0) {
      saveCurrentDocStrokes();
    }
    updateUI();
    showToast(state.autoSave ? msg().toastAutoSaveOn : msg().toastAutoSaveOff);
  }

  function getDocBaseFilename() {
    var src = String(currentDocRawId || document.title || 'markdown-draw');
    var tail = src.split(/[\\/]/).pop() || 'markdown-draw';
    tail = tail.split('|')[0].replace(/\.md$/i, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    return tail || 'markdown-draw';
  }

  function triggerBlobDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      if (a.parentNode) {
        a.parentNode.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function exportStrokesJson() {
    closePopover();
    var payload = {
      format: 'markdown-draw-overlay',
      version: 1,
      exportedAt: new Date().toISOString(),
      source: currentDocRawId,
      strokes: compactStrokes(state.strokes)
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    triggerBlobDownload(blob, getDocBaseFilename() + '.mdo.json');
    showToast(msg().toastJsonExported);
  }

  function importStrokesJson() {
    closePopover();
    if (!fileInputEl) {
      return;
    }
    fileInputEl.value = '';
    fileInputEl.click();
  }

  function handleImportFileSelected() {
    if (!fileInputEl || !fileInputEl.files || fileInputEl.files.length === 0) {
      return;
    }
    var file = fileInputEl.files[0];
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result || ''));
        var imported = parsed && Array.isArray(parsed.strokes) ? sanitizeStrokes(parsed.strokes) : null;
        if (!imported) {
          showToast(msg().toastJsonInvalid);
          return;
        }
        pushUndoSnapshot(state.strokes.slice());
        state.strokes = imported;
        renderStaticCanvas();
        updateUI();
        scheduleSaveStrokes();
        showToast(msg().toastJsonImported.replace('{0}', String(imported.length)));
      } catch (_err) {
        showToast(msg().toastJsonInvalid);
      }
    };
    reader.readAsText(file);
  }

  // Annotated PNG Screenshot Export
  function resolveSurfaceBgColor() {
    var candidates = [
      document.querySelector('.crossnote[data-for="preview"]'),
      document.body,
      document.documentElement
    ];
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (!el || typeof window.getComputedStyle !== 'function') continue;
      var bg = window.getComputedStyle(el).backgroundColor;
      var parsed = parseCssRgb(bg);
      if (parsed && parsed.a > 0.1) {
        return bg;
      }
    }
    return isLightSurface() ? '#ffffff' : '#1e1e1e';
  }

  function collectAccessibleCssText() {
    var parts = [];
    try {
      var sheets = document.styleSheets;
      for (var i = 0; i < sheets.length; i++) {
        var sheet = sheets[i];
        try {
          var rules = sheet.cssRules;
          if (!rules) continue;
          for (var j = 0; j < rules.length; j++) {
            var cssText = rules[j].cssText;
            if (cssText && cssText.indexOf('#mdo-') === -1) {
              parts.push(cssText);
            }
          }
        } catch (_secErr) {
          // Skip cross-origin restricted stylesheets
        }
      }
    } catch (_err) {
      // Ignore stylesheet iteration errors
    }

    var varDecls = [];
    if (typeof window.getComputedStyle === 'function') {
      var targets = [document.documentElement, document.body];
      for (var t = 0; t < targets.length; t++) {
        var target = targets[t];
        if (!target) continue;
        var cs = window.getComputedStyle(target);
        var decls = [];
        for (var k = 0; k < cs.length; k++) {
          var prop = cs[k];
          if (prop && prop.indexOf('--') === 0) {
            decls.push(prop + ':' + cs.getPropertyValue(prop) + ';');
          }
        }
        if (decls.length > 0) {
          varDecls.push((t === 0 ? ':root{' : 'body{') + decls.join('') + '}');
        }
      }
    }
    return varDecls.join('\n') + '\n' + parts.join('\n');
  }

  function inlineImagesForClone(cloneRoot) {
    var imgs = cloneRoot.querySelectorAll('img');
    var tasks = [];
    for (var i = 0; i < imgs.length; i++) {
      (function (imgEl) {
        var src = imgEl.getAttribute('src');
        if (!src || src.indexOf('data:') === 0) {
          return;
        }
        var p = new Promise(function (resolve) {
          var timer = setTimeout(function () {
            imgEl.removeAttribute('src');
            imgEl.style.visibility = 'hidden';
            resolve();
          }, 1200);
          fetch(src)
            .then(function (resp) {
              if (!resp.ok) throw new Error('HTTP ' + resp.status);
              return resp.blob();
            })
            .then(function (blob) {
              var reader = new FileReader();
              reader.onloadend = function () {
                clearTimeout(timer);
                if (typeof reader.result === 'string') {
                  imgEl.setAttribute('src', reader.result);
                } else {
                  imgEl.removeAttribute('src');
                  imgEl.style.visibility = 'hidden';
                }
                resolve();
              };
              reader.readAsDataURL(blob);
            })
            .catch(function () {
              clearTimeout(timer);
              imgEl.removeAttribute('src');
              imgEl.style.visibility = 'hidden';
              resolve();
            });
        });
        tasks.push(p);
      })(imgs[i]);
    }
    return Promise.all(tasks);
  }

  function canvasToPngBlob(canvas) {
    return new Promise(function (resolve, reject) {
      try {
        canvas.toBlob(function (blob) {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Empty PNG blob'));
          }
        }, 'image/png');
      } catch (err) {
        reject(err);
      }
    });
  }

  function drawAnnotationsOnExportContext(ctx, scrollX, scrollY) {
    ctx.save();
    ctx.translate(-scrollX, -scrollY);
    for (var i = 0; i < state.strokes.length; i++) {
      drawCommittedStroke(ctx, state.strokes[i]);
    }
    var now = performance.now();
    for (var j = 0; j < state.laserStrokes.length; j++) {
      var lStroke = state.laserStrokes[j];
      var alpha = 1;
      if (lStroke.endedAt !== null) {
        var elapsed = now - lStroke.endedAt;
        var p = Math.min(1, Math.max(0, elapsed / LASER_FADE_MS));
        alpha = (1 - p) * (1 - p);
      }
      drawLaserStroke(ctx, lStroke, alpha);
    }
    ctx.restore();
  }

  function renderFullViewportCanvas(vpW, vpH, scrollX, scrollY, exportDpr, surfaceBg) {
    var cloneBody = document.body.cloneNode(true);
    var stripIds = ['mdo-canvas-layer', 'mdo-toolbar', 'mdo-toast', 'mdo-popover', 'mdo-import-input'];
    for (var i = 0; i < stripIds.length; i++) {
      var node = cloneBody.querySelector('#' + stripIds[i]);
      if (node && node.parentNode) {
        node.parentNode.removeChild(node);
      }
    }
    var forbidden = cloneBody.querySelectorAll('script, iframe, noscript');
    for (var f = 0; f < forbidden.length; f++) {
      if (forbidden[f].parentNode) {
        forbidden[f].parentNode.removeChild(forbidden[f]);
      }
    }

    return inlineImagesForClone(cloneBody).then(function () {
      var docW = Math.max(document.documentElement.scrollWidth || 0, vpW);
      var svgEl = document.createElementNS(SVG_NS, 'svg');
      svgEl.setAttribute('xmlns', SVG_NS);
      svgEl.setAttribute('width', String(vpW));
      svgEl.setAttribute('height', String(vpH));
      svgEl.setAttribute('viewBox', '0 0 ' + vpW + ' ' + vpH);

      var fo = document.createElementNS(SVG_NS, 'foreignObject');
      fo.setAttribute('width', '100%');
      fo.setAttribute('height', '100%');

      var htmlWrap = document.createElementNS(XHTML_NS, 'html');
      htmlWrap.setAttribute('xmlns', XHTML_NS);
      if (document.documentElement && document.documentElement.className) {
        htmlWrap.className = document.documentElement.className;
      }
      htmlWrap.style.width = vpW + 'px';
      htmlWrap.style.height = vpH + 'px';
      htmlWrap.style.overflow = 'hidden';

      var headEl = document.createElementNS(XHTML_NS, 'head');
      var styleEl = document.createElementNS(XHTML_NS, 'style');
      styleEl.textContent = collectAccessibleCssText();
      headEl.appendChild(styleEl);

      cloneBody.style.width = docW + 'px';
      cloneBody.style.transformOrigin = 'top left';
      cloneBody.style.transform = 'translate(' + -scrollX + 'px, ' + -scrollY + 'px)';
      cloneBody.style.overflow = 'visible';

      htmlWrap.appendChild(headEl);
      htmlWrap.appendChild(cloneBody);
      fo.appendChild(htmlWrap);
      svgEl.appendChild(fo);

      var svgXml = new XMLSerializer().serializeToString(svgEl);
      var svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgXml);

      return new Promise(function (resolve, reject) {
        var img = new Image();
        var done = false;
        var timeoutId = setTimeout(function () {
          if (!done) {
            done = true;
            reject(new Error('SVG render timeout'));
          }
        }, 2000);
        img.onload = function () {
          if (done) return;
          done = true;
          clearTimeout(timeoutId);
          try {
            var outCanvas = document.createElement('canvas');
            outCanvas.width = Math.max(1, Math.round(vpW * exportDpr));
            outCanvas.height = Math.max(1, Math.round(vpH * exportDpr));
            var outCtx = outCanvas.getContext('2d');
            outCtx.setTransform(exportDpr, 0, 0, exportDpr, 0, 0);
            outCtx.fillStyle = surfaceBg;
            outCtx.fillRect(0, 0, vpW, vpH);
            outCtx.drawImage(img, 0, 0, vpW, vpH);
            drawAnnotationsOnExportContext(outCtx, scrollX, scrollY);
            canvasToPngBlob(outCanvas).then(resolve, reject);
          } catch (drawErr) {
            reject(drawErr);
          }
        };
        img.onerror = function () {
          if (done) return;
          done = true;
          clearTimeout(timeoutId);
          reject(new Error('SVG image load blocked'));
        };
        img.src = svgUrl;
      });
    });
  }

  function renderFallbackOverlayCanvas(vpW, vpH, scrollX, scrollY, exportDpr, surfaceBg) {
    var outCanvas = document.createElement('canvas');
    outCanvas.width = Math.max(1, Math.round(vpW * exportDpr));
    outCanvas.height = Math.max(1, Math.round(vpH * exportDpr));
    var outCtx = outCanvas.getContext('2d');
    outCtx.setTransform(exportDpr, 0, 0, exportDpr, 0, 0);
    outCtx.fillStyle = surfaceBg;
    outCtx.fillRect(0, 0, vpW, vpH);
    drawAnnotationsOnExportContext(outCtx, scrollX, scrollY);
    return canvasToPngBlob(outCanvas);
  }

  function formatTimestamp() {
    var d = new Date();
    function pad2(n) {
      return (n < 10 ? '0' : '') + n;
    }
    return (
      d.getFullYear() +
      pad2(d.getMonth() + 1) +
      pad2(d.getDate()) +
      '-' +
      pad2(d.getHours()) +
      pad2(d.getMinutes()) +
      pad2(d.getSeconds())
    );
  }

  function tryCopyPngToClipboard(blob) {
    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard ||
      typeof navigator.clipboard.write !== 'function' ||
      typeof ClipboardItem === 'undefined'
    ) {
      return Promise.resolve(false);
    }
    try {
      var writePromise = navigator.clipboard
        .write([new ClipboardItem({ 'image/png': blob })])
        .then(function () {
          return true;
        })
        .catch(function () {
          return false;
        });
      var timeoutPromise = new Promise(function (resolve) {
        setTimeout(function () {
          resolve(false);
        }, 600);
      });
      return Promise.race([writePromise, timeoutPromise]);
    } catch (_err) {
      return Promise.resolve(false);
    }
  }

  function exportScreenshotPng() {
    if (state.isExporting) {
      return Promise.resolve();
    }
    closePopover();
    state.isExporting = true;
    updateUI();

    var vpW = Math.max(1, document.documentElement.clientWidth || window.innerWidth || 800);
    var vpH = Math.max(1, document.documentElement.clientHeight || window.innerHeight || 600);
    var scrollX = window.scrollX || window.pageXOffset || document.documentElement.scrollLeft || 0;
    var scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    var exportDpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    var surfaceBg = resolveSurfaceBgColor();
    var usedFallback = false;

    return renderFullViewportCanvas(vpW, vpH, scrollX, scrollY, exportDpr, surfaceBg)
      .catch(function () {
        usedFallback = true;
        return renderFallbackOverlayCanvas(vpW, vpH, scrollX, scrollY, exportDpr, surfaceBg);
      })
      .then(function (blob) {
        triggerBlobDownload(blob, getDocBaseFilename() + '-' + formatTimestamp() + '.png');
        var t = msg();
        showToast(usedFallback ? t.toastExportedFallbackFileOnly : t.toastExportedFileOnly);
        return tryCopyPngToClipboard(blob).then(function (copied) {
          if (copied) {
            var tNow = msg();
            showToast(usedFallback ? tNow.toastExportedFallbackBoth : tNow.toastExportedBoth);
          }
        });
      })
      .catch(function () {
        showToast(msg().toastExportFailed);
      })
      .finally(function () {
        state.isExporting = false;
        updateUI();
      });
  }

  function toggleLanguage() {
    state.lang = state.lang === 'en' ? 'zh-TW' : 'en';
    try {
      if (window.localStorage) {
        window.localStorage.setItem('mdo.lang', state.lang);
      }
    } catch (_err) {
      // Ignore storage access errors in sandboxed webviews
    }
    applyLocale();
    updateUI();
  }

  function applyLocale() {
    var t = msg();
    if (toolbar) {
      toolbar.setAttribute('aria-label', t.toolbarAria);
    }
    for (var i = 0; i < TOOL_IDS.length; i++) {
      var tId = TOOL_IDS[i];
      var tBtn = toolButtons[tId];
      if (tBtn) {
        var toolLabel = t.tools[tId] || tId;
        tBtn.title = toolLabel;
        tBtn.setAttribute('aria-label', toolLabel);
      }
    }
    for (var c = 0; c < PALETTE.length; c++) {
      var swatch = PALETTE[c];
      var cBtn = colorButtons[swatch.value];
      if (cBtn) {
        var colorLabel = t.colors[swatch.id] || swatch.id;
        cBtn.title = colorLabel;
        cBtn.setAttribute('aria-label', colorLabel);
      }
    }
    for (var s = 0; s < sizeButtons.length; s++) {
      var sBtn = sizeButtons[s];
      if (sBtn) {
        var sizeLabel = t.sizePrefix + (t.sizes[s] || String(s + 1));
        sBtn.title = sizeLabel;
        sBtn.setAttribute('aria-label', sizeLabel);
      }
    }
    if (undoBtn) {
      undoBtn.title = t.undoTitle;
      undoBtn.setAttribute('aria-label', t.undoAria);
    }
    if (redoBtn) {
      redoBtn.title = t.redoTitle;
      redoBtn.setAttribute('aria-label', t.redoAria);
    }
    if (clearBtn) {
      clearBtn.title = t.clearTitle;
      clearBtn.setAttribute('aria-label', t.clearAria);
    }
    if (exportBtn) {
      exportBtn.title = t.exportTitle;
      exportBtn.setAttribute('aria-label', t.exportAria);
    }
    if (moreBtn) {
      moreBtn.title = t.moreTitle;
      moreBtn.setAttribute('aria-label', t.moreAria);
    }
    if (langBtn) {
      langBtn.textContent = t.langBadge;
      langBtn.title = t.langSwitchTitle;
      langBtn.setAttribute('aria-label', t.langSwitchTitle);
    }
    if (autoSaveLabelEl) {
      autoSaveLabelEl.textContent = t.autoSaveLabel;
    }
    if (exportJsonItem) {
      exportJsonItem.textContent = t.exportJsonLabel;
    }
    if (importJsonItem) {
      importJsonItem.textContent = t.importJsonLabel;
    }
  }

  // UI Construction & Synchronization
  function updateUI() {
    if (!canvasLayer || !toolbar) {
      return;
    }

    var t = msg();
    var isDraw = state.mode === 'draw';
    canvasLayer.classList.toggle('mdo-draw-mode', isDraw);
    canvasLayer.classList.toggle('mdo-tool-eraser', isDraw && state.tool === 'eraser');

    toolbar.classList.toggle('mdo-collapsed', state.collapsed);
    toolbar.classList.toggle('mdo-draw-active', isDraw);

    if (modeBtn && modeLabel) {
      modeBtn.classList.toggle('mdo-active', isDraw);
      modeBtn.setAttribute('aria-pressed', String(isDraw));
      modeLabel.textContent = isDraw ? t.modeDraw : t.modeBrowse;
      modeBtn.title = isDraw ? t.modeDrawTitle : t.modeBrowseTitle;
    }

    if (collapseBtn) {
      collapseBtn.title = state.collapsed ? t.expandToolbar : t.collapseToolbar;
      collapseBtn.setAttribute('aria-expanded', String(!state.collapsed));
      while (collapseBtn.firstChild) {
        collapseBtn.removeChild(collapseBtn.firstChild);
      }
      collapseBtn.appendChild(getActionIcon(state.collapsed ? 'expand' : 'collapse'));
      var dot = document.createElement('span');
      dot.className = 'mdo-collapse-dot';
      collapseBtn.appendChild(dot);
    }

    for (var tId in toolButtons) {
      if (Object.prototype.hasOwnProperty.call(toolButtons, tId)) {
        var tBtn = toolButtons[tId];
        var tActive = state.tool === tId;
        tBtn.classList.toggle('mdo-active', tActive);
        tBtn.setAttribute('aria-pressed', String(tActive));
      }
    }

    var activeColor = getActiveColor();
    for (var cVal in colorButtons) {
      if (Object.prototype.hasOwnProperty.call(colorButtons, cVal)) {
        var cBtn = colorButtons[cVal];
        var cActive = cVal === activeColor && state.tool !== 'laser' && state.tool !== 'eraser';
        cBtn.classList.toggle('mdo-active', cActive);
        cBtn.setAttribute('aria-pressed', String(cActive));
      }
    }

    for (var i = 0; i < sizeButtons.length; i++) {
      var sBtn = sizeButtons[i];
      var sActive = i === state.sizeIndex;
      sBtn.classList.toggle('mdo-active', sActive);
      sBtn.setAttribute('aria-pressed', String(sActive));
    }

    if (undoBtn) {
      undoBtn.disabled = state.undoStack.length === 0;
    }
    if (redoBtn) {
      redoBtn.disabled = state.redoStack.length === 0;
    }
    if (clearBtn) {
      clearBtn.disabled = state.strokes.length === 0;
    }
    if (exportBtn) {
      exportBtn.disabled = state.isExporting;
    }
    if (moreBtn) {
      moreBtn.classList.toggle('mdo-active', state.popoverOpen);
      moreBtn.setAttribute('aria-expanded', String(state.popoverOpen));
    }
    if (popoverEl) {
      popoverEl.classList.toggle('mdo-popover-open', state.popoverOpen && !state.collapsed);
    }
    if (autoSaveBadge) {
      autoSaveBadge.textContent = state.autoSave ? t.onLabel : t.offLabel;
      autoSaveBadge.classList.toggle('mdo-on', state.autoSave);
    }
    if (autoSaveItem) {
      autoSaveItem.setAttribute('aria-checked', String(state.autoSave));
    }
  }

  function buildUI() {
    // 1. Canvas Overlay Layer
    canvasLayer = document.createElement('div');
    canvasLayer.id = 'mdo-canvas-layer';
    canvasLayer.classList.add('mdo-pointer-outside');

    staticCanvas = document.createElement('canvas');
    staticCanvas.id = 'mdo-static-canvas';
    staticCtx = staticCanvas.getContext('2d');

    liveCanvas = document.createElement('canvas');
    liveCanvas.id = 'mdo-live-canvas';
    liveCtx = liveCanvas.getContext('2d');

    canvasLayer.appendChild(staticCanvas);
    canvasLayer.appendChild(liveCanvas);

    liveCanvas.addEventListener('pointerdown', handlePointerDown);
    liveCanvas.addEventListener('pointermove', handlePointerMove);
    liveCanvas.addEventListener('pointerup', function (e) {
      finishPointerInteraction(e, false);
    });
    liveCanvas.addEventListener('pointercancel', function (e) {
      finishPointerInteraction(e, true);
    });
    liveCanvas.addEventListener('pointerleave', handlePointerLeave);
    liveCanvas.addEventListener('contextmenu', function (e) {
      if (state.mode === 'draw') {
        e.preventDefault();
      }
    });

    // 2. Floating Toolbar
    toolbar = document.createElement('div');
    toolbar.id = 'mdo-toolbar';
    toolbar.setAttribute('role', 'toolbar');

    var bodyWrap = document.createElement('div');
    bodyWrap.className = 'mdo-toolbar-body';

    // Mode Toggle Pill
    modeBtn = document.createElement('button');
    modeBtn.type = 'button';
    modeBtn.className = 'mdo-mode-btn';
    var modeDot = document.createElement('span');
    modeDot.className = 'mdo-mode-dot';
    modeLabel = document.createElement('span');
    modeLabel.className = 'mdo-mode-label';
    var kbd = document.createElement('span');
    kbd.className = 'mdo-kbd';
    kbd.textContent = 'Alt+D';
    modeBtn.appendChild(modeDot);
    modeBtn.appendChild(modeLabel);
    modeBtn.appendChild(kbd);
    modeBtn.addEventListener('click', function () {
      toggleMode(false);
    });
    bodyWrap.appendChild(modeBtn);

    bodyWrap.appendChild(createDivider());

    // Tool Buttons
    var toolGroup = document.createElement('div');
    toolGroup.className = 'mdo-group';
    for (var t = 0; t < TOOL_IDS.length; t++) {
      (function (toolId) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mdo-icon-btn';
        btn.appendChild(getToolIcon(toolId));
        btn.addEventListener('click', function () {
          setTool(toolId);
        });
        toolButtons[toolId] = btn;
        toolGroup.appendChild(btn);
      })(TOOL_IDS[t]);
    }
    bodyWrap.appendChild(toolGroup);

    bodyWrap.appendChild(createDivider());

    // Color Palette
    var colorGroup = document.createElement('div');
    colorGroup.className = 'mdo-group';
    for (var c = 0; c < PALETTE.length; c++) {
      (function (swatch) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mdo-color-btn ' + swatch.className;
        btn.addEventListener('click', function () {
          selectColor(swatch.value);
        });
        colorButtons[swatch.value] = btn;
        colorGroup.appendChild(btn);
      })(PALETTE[c]);
    }
    bodyWrap.appendChild(colorGroup);

    bodyWrap.appendChild(createDivider());

    // Size Controls (S / M / L)
    var sizeGroup = document.createElement('div');
    sizeGroup.className = 'mdo-group';
    var sizeDotClasses = ['mdo-size-dot-s', 'mdo-size-dot-m', 'mdo-size-dot-l'];
    for (var s = 0; s < 3; s++) {
      (function (idx) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mdo-size-btn';
        var dot = document.createElement('span');
        dot.className = 'mdo-size-dot ' + sizeDotClasses[idx];
        btn.appendChild(dot);
        btn.addEventListener('click', function () {
          selectSize(idx);
        });
        sizeButtons.push(btn);
        sizeGroup.appendChild(btn);
      })(s);
    }
    bodyWrap.appendChild(sizeGroup);

    bodyWrap.appendChild(createDivider());

    // Undo / Redo / Clear All / Language Toggle
    var actionGroup = document.createElement('div');
    actionGroup.className = 'mdo-group';

    undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.className = 'mdo-icon-btn';
    undoBtn.appendChild(getActionIcon('undo'));
    undoBtn.addEventListener('click', undo);

    redoBtn = document.createElement('button');
    redoBtn.type = 'button';
    redoBtn.className = 'mdo-icon-btn';
    redoBtn.appendChild(getActionIcon('redo'));
    redoBtn.addEventListener('click', redo);

    clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'mdo-icon-btn mdo-clear-btn';
    clearBtn.appendChild(getActionIcon('clear'));
    clearBtn.addEventListener('click', clearAll);

    exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'mdo-icon-btn';
    exportBtn.appendChild(getActionIcon('export'));
    exportBtn.addEventListener('click', exportScreenshotPng);

    langBtn = document.createElement('button');
    langBtn.type = 'button';
    langBtn.className = 'mdo-icon-btn mdo-lang-btn';
    langBtn.addEventListener('click', toggleLanguage);

    moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'mdo-icon-btn mdo-more-btn';
    moreBtn.setAttribute('aria-haspopup', 'menu');
    moreBtn.appendChild(getActionIcon('more'));
    moreBtn.addEventListener('click', togglePopover);

    actionGroup.appendChild(undoBtn);
    actionGroup.appendChild(redoBtn);
    actionGroup.appendChild(clearBtn);
    actionGroup.appendChild(exportBtn);
    actionGroup.appendChild(langBtn);
    actionGroup.appendChild(moreBtn);
    bodyWrap.appendChild(actionGroup);

    bodyWrap.appendChild(createDivider());

    toolbar.appendChild(bodyWrap);

    // Collapse / Expand Button (always visible)
    collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'mdo-icon-btn mdo-collapse-btn';
    collapseBtn.addEventListener('click', toggleCollapsed);
    toolbar.appendChild(collapseBtn);

    // 3. Mode Toast
    toastEl = document.createElement('div');
    toastEl.id = 'mdo-toast';
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');

    // 4. More Popover Menu & Hidden File Input
    popoverEl = document.createElement('div');
    popoverEl.id = 'mdo-popover';
    popoverEl.setAttribute('role', 'menu');

    autoSaveItem = document.createElement('button');
    autoSaveItem.type = 'button';
    autoSaveItem.className = 'mdo-popover-item';
    autoSaveItem.setAttribute('role', 'menuitemcheckbox');
    autoSaveLabelEl = document.createElement('span');
    autoSaveBadge = document.createElement('span');
    autoSaveBadge.className = 'mdo-popover-check';
    autoSaveItem.appendChild(autoSaveLabelEl);
    autoSaveItem.appendChild(autoSaveBadge);
    autoSaveItem.addEventListener('click', toggleAutoSave);

    var popSep = document.createElement('div');
    popSep.className = 'mdo-popover-sep';
    popSep.setAttribute('aria-hidden', 'true');

    exportJsonItem = document.createElement('button');
    exportJsonItem.type = 'button';
    exportJsonItem.className = 'mdo-popover-item';
    exportJsonItem.setAttribute('role', 'menuitem');
    exportJsonItem.addEventListener('click', exportStrokesJson);

    importJsonItem = document.createElement('button');
    importJsonItem.type = 'button';
    importJsonItem.className = 'mdo-popover-item';
    importJsonItem.setAttribute('role', 'menuitem');
    importJsonItem.addEventListener('click', importStrokesJson);

    popoverEl.appendChild(autoSaveItem);
    popoverEl.appendChild(popSep);
    popoverEl.appendChild(exportJsonItem);
    popoverEl.appendChild(importJsonItem);

    fileInputEl = document.createElement('input');
    fileInputEl.id = 'mdo-import-input';
    fileInputEl.type = 'file';
    fileInputEl.accept = '.json,.mdo.json,application/json';
    fileInputEl.style.display = 'none';
    fileInputEl.addEventListener('change', handleImportFileSelected);

    ensureMounted();
    applyLocale();
    updateUI();
  }

  function createDivider() {
    var div = document.createElement('span');
    div.className = 'mdo-divider';
    div.setAttribute('aria-hidden', 'true');
    return div;
  }

  function ensureMounted() {
    if (!document.body || isReattaching) {
      return;
    }
    isReattaching = true;
    try {
      var mounted = false;
      if (canvasLayer && canvasLayer.parentNode !== document.body) {
        document.body.appendChild(canvasLayer);
        mounted = true;
      }
      if (toolbar && toolbar.parentNode !== document.body) {
        document.body.appendChild(toolbar);
      }
      if (toastEl && toastEl.parentNode !== document.body) {
        document.body.appendChild(toastEl);
      }
      if (popoverEl && popoverEl.parentNode !== document.body) {
        document.body.appendChild(popoverEl);
      }
      if (fileInputEl && fileInputEl.parentNode !== document.body) {
        document.body.appendChild(fileInputEl);
      }
      if (mounted) {
        syncCanvasSize();
      }
    } finally {
      isReattaching = false;
    }
  }

  // Keyboard Shortcuts
  function isEditableTarget(target) {
    if (!target || !target.tagName) {
      return false;
    }
    var tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || Boolean(target.isContentEditable);
  }

  function handleKeyDown(e) {
    // Alt + D: Toggle Browse / Draw Mode
    if (
      e.altKey &&
      !e.ctrlKey &&
      !e.metaKey &&
      (e.code === 'KeyD' || (e.key && e.key.toLowerCase() === 'd'))
    ) {
      e.preventDefault();
      e.stopPropagation();
      toggleMode(true);
      return;
    }

    // Escape: Close Popover or Return to Browse Mode
    if (e.key === 'Escape') {
      if (state.popoverOpen) {
        e.preventDefault();
        e.stopPropagation();
        closePopover();
        return;
      }
      if (state.mode === 'draw') {
        e.preventDefault();
        e.stopPropagation();
        setMode('browse', true);
        return;
      }
    }

    // Undo / Redo (Ctrl/Cmd + Z, Ctrl/Cmd + Y, Ctrl/Cmd + Shift + Z)
    var mod = e.ctrlKey || e.metaKey;
    if (!mod || e.altKey || isEditableTarget(e.target)) {
      return;
    }

    var keyLower = e.key ? e.key.toLowerCase() : '';
    if (keyLower === 'z' && !e.shiftKey) {
      if (state.undoStack.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        undo();
      }
    } else if (keyLower === 'y' || (keyLower === 'z' && e.shiftKey)) {
      if (state.redoStack.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        redo();
      }
    }
  }

  function observeMpePreviewIfPresent() {
    if (!resizeObserver) {
      return;
    }
    var mpeEl = document.querySelector('.crossnote[data-for="preview"]');
    if (mpeEl && mpeEl !== observedMpePreviewEl) {
      if (observedMpePreviewEl && resizeObserver.unobserve) {
        try {
          resizeObserver.unobserve(observedMpePreviewEl);
        } catch (_err) {
          // Ignore unobserve errors on detached elements
        }
      }
      observedMpePreviewEl = mpeEl;
      resizeObserver.observe(mpeEl);
      scheduleSyncSize();
      renderStaticCanvas();
      renderLiveCanvas();
    }
  }

  function setupObserversAndListeners() {
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(function () {
        scheduleSyncSize();
      });
      if (document.documentElement) {
        resizeObserver.observe(document.documentElement);
      }
      if (document.body) {
        resizeObserver.observe(document.body);
      }
      observeMpePreviewIfPresent();
    }

    if (typeof MutationObserver !== 'undefined' && document.body) {
      var mo = new MutationObserver(function (mutations) {
        var needsRemount = false;
        var hasChildChanges = false;
        var themeChanged = false;
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          if (m.type === 'childList') {
            hasChildChanges = true;
            if (
              (canvasLayer && !canvasLayer.isConnected) ||
              (toolbar && !toolbar.isConnected) ||
              (toastEl && !toastEl.isConnected) ||
              (popoverEl && !popoverEl.isConnected)
            ) {
              needsRemount = true;
            }
          } else if (m.type === 'attributes') {
            themeChanged = true;
          }
        }
        if (needsRemount) {
          ensureMounted();
          scheduleSyncSize();
        }
        if (hasChildChanges) {
          observeMpePreviewIfPresent();
        }
        if (themeChanged) {
          renderStaticCanvas();
          renderLiveCanvas();
        }
      });
      mo.observe(document.body, {
        childList: true,
        attributes: true,
        attributeFilter: ['class', 'data-preview-theme', 'style']
      });
    }

    document.addEventListener(
      'pointerdown',
      function (e) {
        if (!state.popoverOpen) {
          return;
        }
        var target = e.target;
        if (
          (popoverEl && popoverEl.contains(target)) ||
          (moreBtn && moreBtn.contains(target))
        ) {
          return;
        }
        closePopover();
      },
      true
    );

    window.addEventListener('resize', scheduleSyncSize);
    window.addEventListener('load', scheduleSyncSize, true);
    window.addEventListener('vscode.markdown.updateContent', function () {
      ensureMounted();
      checkDocumentChanged();
      scheduleSyncSize();
    });
    window.addEventListener('pagehide', flushSaveStrokes);
    window.addEventListener('keydown', handleKeyDown, true);
  }

  function init() {
    if (!document.body || document.body.getAttribute('for') === 'html-export') {
      return;
    }
    currentDocRawId = getRawDocumentId();
    currentDocKey = computeDocKey(currentDocRawId);
    if (state.autoSave) {
      state.strokes = loadDocStrokesForKey(currentDocKey);
    }
    buildUI();
    setupObserversAndListeners();
    syncCanvasSize();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
