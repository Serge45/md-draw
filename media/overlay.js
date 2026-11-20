(function () {
  'use strict';

  if (window.__mdoInitialized) {
    return;
  }
  window.__mdoInitialized = true;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var LASER_FADE_MS = 1500;
  var MAX_HISTORY = 100;
  var MAX_CANVAS_DIM = 16384;
  var MAX_CANVAS_AREA = 128 * 1024 * 1024;
  var ERASER_CLICK_THRESHOLD = 5;
  var MIN_POINT_DIST = 1.5;
  var EMA_CURRENT_WEIGHT = 0.68;

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
    laser: [3.5, 5, 7],
    eraser: [10, 18, 30]
  };

  var TOOL_IDS = ['pen', 'highlighter', 'laser', 'eraser'];

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
        pen: 'Pen',
        highlighter: 'Highlighter',
        laser: 'Laser Pointer (auto-fades in 1.5s)',
        eraser: 'Eraser (click stroke to delete / drag to erase)'
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
        pen: '畫筆 (Pen)',
        highlighter: '螢光筆 (Highlighter)',
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

  var state = {
    lang: detectInitialLocale(),
    mode: 'browse', // 'browse' | 'draw'
    tool: 'pen', // 'pen' | 'highlighter' | 'laser' | 'eraser'
    sizeIndex: 1, // 0 = S, 1 = M, 2 = L
    toolColors: {
      pen: '#EF4444',
      highlighter: '#FACC15'
    },
    strokes: [],
    undoStack: [],
    redoStack: [],
    laserStrokes: [],
    collapsed: false
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
  var isReattaching = false;
  var resizeObserver = null;
  var observedMpePreviewEl = null;

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

  var toolButtons = {};
  var colorButtons = {};
  var sizeButtons = [];
  var undoBtn = null;
  var redoBtn = null;
  var clearBtn = null;
  var langBtn = null;

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
  }

  function clearAll() {
    if (state.strokes.length === 0) {
      return;
    }
    pushUndoSnapshot(state.strokes.slice());
    state.strokes = [];
    renderStaticCanvas();
    updateUI();
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

  function toggleCollapsed() {
    state.collapsed = !state.collapsed;
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

  function drawCommittedStroke(ctx, stroke) {
    if (!stroke || !stroke.points || stroke.points.length === 0) {
      return;
    }
    var resolved = resolveColor(stroke.color);
    ctx.save();
    ctx.globalAlpha = stroke.opacity;
    ctx.strokeStyle = resolved;
    ctx.fillStyle = resolved;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawSmoothPath(ctx, stroke.points, stroke.width);
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
      var effectiveRadius = eraserRadius + stroke.width * 0.35;
      var bbox = getStrokeBBox(stroke.points);

      if (
        segMaxX + effectiveRadius < bbox.minX ||
        segMinX - effectiveRadius > bbox.maxX ||
        segMaxY + effectiveRadius < bbox.minY ||
        segMinY - effectiveRadius > bbox.maxY
      ) {
        nextStrokes.push(stroke);
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
      var hitDist = eraserRadius + stroke.width * 0.5 + 3;
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

  function cancelOrCommitInFlightInteraction() {
    if (activeStroke) {
      if (activeStroke.points.length > 0) {
        pushUndoSnapshot(state.strokes.slice());
        state.strokes = state.strokes.concat([activeStroke]);
        renderStaticCanvas();
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

    activeStroke = {
      tool: state.tool,
      color: getActiveColor(),
      width: getActiveWidth(),
      opacity: state.tool === 'highlighter' ? 0.35 : 1.0,
      points: [pt]
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

    var targetStroke = activeStroke || activeLaserStroke;
    if (!targetStroke) {
      return;
    }

    var added = false;
    for (var k = 0; k < list.length; k++) {
      var samplePt = getCanvasPoint(list[k]);
      if (appendSmoothedPoint(targetStroke.points, samplePt)) {
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
      if (!isCancel && activeStroke.points.length > 0) {
        pushUndoSnapshot(state.strokes.slice());
        state.strokes = state.strokes.concat([activeStroke]);
        renderStaticCanvas();
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
    if (langBtn) {
      langBtn.textContent = t.langBadge;
      langBtn.title = t.langSwitchTitle;
      langBtn.setAttribute('aria-label', t.langSwitchTitle);
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

    langBtn = document.createElement('button');
    langBtn.type = 'button';
    langBtn.className = 'mdo-icon-btn mdo-lang-btn';
    langBtn.addEventListener('click', toggleLanguage);

    actionGroup.appendChild(undoBtn);
    actionGroup.appendChild(redoBtn);
    actionGroup.appendChild(clearBtn);
    actionGroup.appendChild(langBtn);
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

    // Escape: Return to Browse Mode
    if (e.key === 'Escape' && state.mode === 'draw') {
      e.preventDefault();
      e.stopPropagation();
      setMode('browse', true);
      return;
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
              (toastEl && !toastEl.isConnected)
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

    window.addEventListener('resize', scheduleSyncSize);
    window.addEventListener('load', scheduleSyncSize, true);
    window.addEventListener('vscode.markdown.updateContent', function () {
      ensureMounted();
      scheduleSyncSize();
    });
    window.addEventListener('keydown', handleKeyDown, true);
  }

  function init() {
    if (!document.body || document.body.getAttribute('for') === 'html-export') {
      return;
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
