/* ==========================================================================
   forge.js — 合成工坊：自动配方树 / 拖拽编排多步合成路线
   依赖：window.PREPARATIONS、window.CHEMLAB_ART（可选）
   模式：auto  —— 拖入药品，自动展开全套原料与前置制法（默认）
         manual—— 自由拖拽卡片、手动连线
   ========================================================================== */
(function () {
  "use strict";

  var DATA = window.PREPARATIONS || [];
  var ID_INDEX = {};
  DATA.forEach(function (d) { if (d && d.id) ID_INDEX[d.id] = d; });
  var board = document.getElementById("forge-board");
  if (!board) return;

  var nodesLayer = document.getElementById("forge-nodes");
  var svg = document.getElementById("forge-edges");
  var listEl = document.getElementById("forge-list");
  var catsEl = document.getElementById("forge-cats");
  var searchEl = document.getElementById("forge-search");
  var countEl = document.getElementById("forge-count");
  var statusEl = document.getElementById("forge-status");
  var modeHintEl = document.getElementById("forge-mode-hint");
  var routeListEl = document.getElementById("forge-route-list");
  var routeNoteEl = document.getElementById("forge-route-note");
  var riskEl = document.getElementById("forge-risk");
  var depsListEl = document.getElementById("forge-deps-list");
  var depsCountEl = document.getElementById("forge-dep-count");
  var autoEl = document.getElementById("forge-auto");
  var reflowEl = document.getElementById("forge-reflow");
  var emptyEl = document.getElementById("forge-empty");
  var zoomOutEl = document.getElementById("forge-zoom-out");
  var zoomInEl = document.getElementById("forge-zoom-in");
  var zoomValEl = document.getElementById("forge-zoom-val");
  var zoomFitEl = document.getElementById("forge-zoom-fit");
  var paletteEl = document.querySelector(".forge-palette");
  var paletteToggleEl = document.getElementById("forge-palette-toggle");

  var NODE_W = 212;
  var NODE_H = 92;
  var BOARD_W = 1700;
  var BOARD_H = 980;
  var COL_GAP = 66;
  var ROW_GAP = 20;
  var MAX_DEPTH = 5;
  var MAX_NODES = 64;
  var STORE_KEY = "chemlab-forge-v1";
  var ZOOM_KEY = "chemlab-forge-zoom";
  var PALETTE_KEY = "chemlab-forge-palette";
  var ZOOM_MIN = 0.25;
  var ZOOM_MAX = 1.6;
  var SVG_NS = "http://www.w3.org/2000/svg";
  var zoom = 1;
  var pinch = null;
  var touchPts = {};
  var suppressClickTimer = null;

  var state = {
    q: "", cat: "all", auto: true, nodes: [], edges: [], seq: 1, example: 0,
    supplies: {}, editing: null, root: null, overrides: {}, missing: {},
    boardW: BOARD_W, boardH: BOARD_H
  };
  var drag = null;
  var linking = null;
  var tempPath = null;
  var suppressClick = false;
  var saveTimer = null;
  var buildCtx = null;

  /* ---------------- 基础工具 ---------------- */
  function byId(id) {
    return ID_INDEX[id] || null;
  }
  function nodeByKey(key) {
    for (var i = 0; i < state.nodes.length; i++) if (state.nodes[i].key === key) return state.nodes[i];
    return null;
  }
  function itemOf(node) { return node && node.id ? byId(node.id) : null; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
  function fileCode(item) {
    var idx = DATA.indexOf(item) + 1;
    var n = String(idx);
    while (n.length < 3) n = "0" + n;
    return "PRP-" + n;
  }
  function alertSafe(msg) {
    try { window.alert(msg); } catch (e) { setStatus(msg); }
  }

  /* ---------------- 原料 → 制法 匹配 ---------------- */
  function coreName(name) {
    return String(name || "")
      .replace(/（[^）]*）/g, "")
      .replace(/\([^)]*\)/g, "")
      .replace(/(溶液|晶体|粉末|固体|单质|稀|浓|饱和|少量|适量)$/g, "")
      .trim();
  }
  function baseFormula(f) {
    return String(f || "").split("·")[0].replace(/（.*$/g, "").replace(/\s+/g, "");
  }
  function hasFormula(text, f) {
    if (!f) return false;
    var i = text.indexOf(f);
    while (i !== -1) {
      var next = text.charAt(i + f.length);
      if (!/[A-Za-z0-9₀-₉]/.test(next)) return true;
      i = text.indexOf(f, i + 1);
    }
    return false;
  }
  function nameHits(text, item) {
    var core = coreName(item.name);
    return core.length >= 2 && text.indexOf(core) !== -1;
  }
  function rank(list, text) {
    var seen = {};
    return list.filter(function (d) {
      if (seen[d.id]) return false;
      seen[d.id] = true;
      return true;
    }).sort(function (a, b) {
      var an = nameHits(text, a) ? 0 : 1;
      var bn = nameHits(text, b) ? 0 : 1;
      if (an !== bn) return an - bn;
      var af = baseFormula(a.formula).length;
      var bf = baseFormula(b.formula).length;
      if (af !== bf) return bf - af;
      var ar = (a.reagents || []).length;
      var br = (b.reagents || []).length;
      if (ar !== br) return ar - br;
      return a.id < b.id ? -1 : 1;
    });
  }

  /* ---- 预建索引：避免每次扩展都遍历全部 280 条数据 ---- */
  var FORMULA_INDEX = {};
  var CORE_INDEX = {};
  DATA.forEach(function (d) {
    if (!d) return;
    var bf = baseFormula(d.formula);
    if (bf.length >= 2) (FORMULA_INDEX[bf] = FORMULA_INDEX[bf] || []).push(d);
    var core = coreName(d.name);
    if (core.length >= 2) (CORE_INDEX[core] = CORE_INDEX[core] || []).push(d);
  });
  var FORMULA_KEYS = Object.keys(FORMULA_INDEX);
  var CORE_KEYS = Object.keys(CORE_INDEX);

  function subKey(item) {
    var bf = baseFormula(item.formula);
    return bf.length >= 2 ? "f:" + bf : "n:" + coreName(item.name);
  }

  function findProducers(text, consumer) {
    var t = String(text || "");
    if (!t.trim()) return [];
    var exact = [];
    for (var i = 0; i < FORMULA_KEYS.length; i++) {
      var key = FORMULA_KEYS[i];
      if (!hasFormula(t, key)) continue;
      var list = FORMULA_INDEX[key];
      for (var j = 0; j < list.length; j++) if (list[j] !== consumer) exact.push(list[j]);
    }
    if (exact.length) return rank(exact, t);
    var strip = t.replace(/（[^）]*）/g, "").replace(/\([^)]*\)/g, "");
    var byName = [];
    for (var c = 0; c < CORE_KEYS.length; c++) {
      var ck = CORE_KEYS[c];
      if (strip.indexOf(ck) === -1) continue;
      var arr = CORE_INDEX[ck];
      for (var n = 0; n < arr.length; n++) if (arr[n] !== consumer) byName.push(arr[n]);
    }
    return rank(byName, t);
  }

  /* ---- 路线代价：优先选择能更快落到基础原料的制法，避免又深又绕 ---- */
  var routeCostMemo = {};
  function routeCost(id, stack) {
    if (routeCostMemo[id] != null) return routeCostMemo[id];
    var item = byId(id);
    if (!item) return 0;
    stack = stack || {};
    if (stack[id]) return 99;
    stack[id] = true;
    var reagents = (item.reagents || []).slice(0, 5);
    var cost = 0;
    var found = false;
    for (var i = 0; i < reagents.length; i++) {
      var cands = findProducers(reagents[i], item);
      var best = 99;
      for (var j = 0; j < cands.length; j++) {
        if (cands[j].id === id) continue;
        var rc = routeCost(cands[j].id, stack);
        if (rc < best) best = rc;
      }
      if (best < 99) {
        found = true;
        cost = Math.max(cost, best + 1);
      }
    }
    delete stack[id];
    if (!found) cost = 0;
    cost = Math.min(cost, 9);
    routeCostMemo[id] = cost;
    return cost;
  }

  function pickProducer(cands, text) {
    if (!cands.length) return null;
    return cands.slice().sort(function (a, b) {
      var ca = routeCost(a.id);
      var cb = routeCost(b.id);
      if (ca !== cb) return ca - cb;
      var an = nameHits(text, a) ? 0 : 1;
      var bn = nameHits(text, b) ? 0 : 1;
      if (an !== bn) return an - bn;
      var ar = (a.reagents || []).length;
      var br = (b.reagents || []).length;
      if (ar !== br) return ar - br;
      return a.id < b.id ? -1 : 1;
    })[0];
  }

  function altMethodsFor(item) {
    if (!item) return [];
    var bf = baseFormula(item.formula);
    var core = coreName(item.name);
    var list = [item];
    var seen = {};
    seen[item.id] = true;
    [FORMULA_INDEX[bf], CORE_INDEX[core]].forEach(function (arr) {
      (arr || []).forEach(function (d) {
        if (seen[d.id]) return;
        seen[d.id] = true;
        list.push(d);
      });
    });
    return list;
  }
  function depKey(node) { return node.id || "raw:" + node.raw; }

  /* ---------------- 左侧卡片库 ---------------- */
  function renderPalette() {
    var cats = ["all"];
    DATA.forEach(function (d) { if (cats.indexOf(d.category) === -1) cats.push(d.category); });
    var ordered = ["all"];
    ["气体", "单质", "氧化物", "酸与碱", "盐", "有机物", "试剂与溶液", "生活材料"].forEach(function (c) {
      if (cats.indexOf(c) !== -1) ordered.push(c);
    });
    cats.forEach(function (c) { if (ordered.indexOf(c) === -1) ordered.push(c); });
    cats = ordered;

    catsEl.innerHTML = cats.map(function (c) {
      var n = c === "all" ? DATA.length : DATA.filter(function (d) { return d.category === c; }).length;
      return '<button class="chip" type="button" data-cat="' + esc(c) + '" aria-pressed="' + (c === state.cat) + '">' +
        (c === "all" ? "全部" : esc(c)) + '<b class="chip-n">' + n + "</b></button>";
    }).join("");

    var q = state.q.trim().toLowerCase();
    var rows = DATA.filter(function (d) {
      if (state.cat !== "all" && d.category !== state.cat) return false;
      if (!q) return true;
      return [d.name, d.formula, d.category, d.summary].join(" ").toLowerCase().indexOf(q) !== -1;
    });

    countEl.textContent = DATA.length + " 张";
    listEl.innerHTML = rows.map(function (d) {
      return '<button class="palette-item" type="button" draggable="true" data-id="' + esc(d.id) + '" title="拖到画布：自动展开它的全套原料">' +
        '<span class="pi-mark">' + esc(fileCode(d)) + "</span>" +
        '<span class="pi-body"><b>' + esc(d.name) + "</b><small>" + esc(d.formula || "") + " · " + esc(d.category) + "</small></span>" +
        '<span class="pi-add" aria-hidden="true">＋</span>' +
      "</button>";
    }).join("") || '<p class="palette-empty">没有匹配的制法卡片。</p>';
  }

  catsEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".chip");
    if (!btn) return;
    state.cat = btn.dataset.cat;
    renderPalette();
  });
  searchEl.addEventListener("input", function () {
    state.q = searchEl.value;
    renderPalette();
  });

  function addFromPalette(id, x, y) {
    if (!byId(id)) return;
    if (state.auto) {
      buildTree(id);
      setStatus("已展开「" + byId(id).name + "」的全套原料与制法");
    } else {
      addNode(id, x, y);
    }
  }

  listEl.addEventListener("click", function (e) {
    var item = e.target.closest(".palette-item");
    if (!item) return;
    if (state.auto) addFromPalette(item.dataset.id);
    else addNode(item.dataset.id, 60 + (state.nodes.length % 4) * 40, 80 + (state.nodes.length % 5) * 110);
  });
  listEl.addEventListener("dragstart", function (e) {
    var item = e.target.closest(".palette-item");
    if (!item) return;
    e.dataTransfer.setData("text/plain", item.dataset.id);
    e.dataTransfer.effectAllowed = "copy";
    item.classList.add("is-dragging");
  });
  listEl.addEventListener("dragend", function (e) {
    var item = e.target.closest(".palette-item");
    if (item) item.classList.remove("is-dragging");
  });

  board.addEventListener("dragover", function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
  board.addEventListener("drop", function (e) {
    e.preventDefault();
    var id = e.dataTransfer.getData("text/plain");
    if (!id || !byId(id)) return;
    var rect = board.getBoundingClientRect();
    if (state.auto) buildTree(id);
    else addNode(id, e.clientX - rect.left - NODE_W / 2, e.clientY - rect.top - NODE_H / 2);
  });

  /* ---------------- 节点渲染 ---------------- */
  function nodeClass(node) {
    var c = "fg-node";
    if (!node.id) c += " is-raw";
    if (node.depth === 0) c += " is-target";
    if (state.missing[depKey(node)]) c += " is-missing";
    return c;
  }

  function nodeInner(node) {
    var item = itemOf(node);
    var missing = !!state.missing[depKey(node)];
    var badge = "";
    if (node.cycle) badge += '<span class="fg-badge is-warn">循环原料</span>';
    if (missing) badge += '<span class="fg-badge is-missing">缺失</span>';
    if (node.altList && node.altList.length > 1) badge += '<span class="fg-badge is-alt">' + node.altList.length + " 种制法</span>";

    if (item) {
      return '<div class="fg-node-head"><span class="fg-code">' + esc(fileCode(item)) + "</span>" +
        '<span class="fg-risk hz-' + item.hazard + '">风险 ' + item.hazard + "</span>" +
        '<button class="fg-del" type="button" aria-label="移除 ' + esc(item.name) + '">×</button></div>' +
        '<div class="fg-node-main"><span class="fg-icon">' + (window.CHEMLAB_ART ? window.CHEMLAB_ART.icon(item, "p") : "") + "</span>" +
        '<span class="fg-name"><b>' + esc(item.name) + "</b><small>" + esc(item.formula || "") + "</small></span></div>" +
        (badge ? '<span class="fg-badges">' + badge + "</span>" : "") +
        '<span class="fg-port fg-in" data-role="in" title="原料接口"></span>' +
        '<span class="fg-port fg-out" data-role="out" title="拖此圆点到另一张卡，建立衔接"></span>';
    }
    return '<div class="fg-node-head"><span class="fg-code">RAW</span>' +
      '<span class="fg-risk is-raw">基础原料</span>' +
      '<button class="fg-del" type="button" aria-label="移除 ' + esc(node.raw) + '">×</button></div>' +
      '<div class="fg-node-main"><span class="fg-icon is-raw">' +
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 3h6l-1 6 4 8a3 3 0 0 1-2.7 4H8.7A3 3 0 0 1 6 17l4-8-1-6Z"/><path d="M8 14h8"/></svg>' +
      "</span>" +
        '<span class="fg-name"><b>' + esc(node.raw) + "</b><small>站内未收录制法</small></span></div>" +
      (badge ? '<span class="fg-badges">' + badge + "</span>" : "") +
      '<span class="fg-port fg-in" data-role="in" title="原料接口"></span>' +
      '<span class="fg-port fg-out" data-role="out" title="拖此圆点到另一张卡，建立衔接"></span>';
  }

  function mountNode(node) {
    var el = document.createElement("article");
    el.className = nodeClass(node);
    el.dataset.key = node.key;
    el.tabIndex = 0;
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", (itemOf(node) ? itemOf(node).name : node.raw) + "，配方节点");
    el.style.left = node.x + "px";
    el.style.top = node.y + "px";
    el.innerHTML = nodeInner(node);
    node.el = el;
    var host = (buildCtx && buildCtx.frag) ? buildCtx.frag : nodesLayer;
    host.appendChild(el);

    var del = el.querySelector(".fg-del");
    if (del) del.addEventListener("click", function (e) { e.stopPropagation(); removeNode(node.key); });

    el.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".fg-port") || e.target.closest(".fg-del")) return;
      e.preventDefault();
      var p = point(e);
      drag = { key: node.key, dx: p.x - node.x, dy: p.y - node.y, el: el, moved: false };
      el.classList.add("is-moving");
      if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (err) {} }
    });

    el.addEventListener("click", function (e) {
      if (suppressClick) { suppressClick = false; return; }
      if (e.target.closest(".fg-del") || e.target.closest(".fg-port")) return;
      var item = itemOf(node);
      if (!item) {
        if (node.altList && node.altList.length) openRecipe(node.altList[0]);
        else setStatus("「" + node.raw + "」是基础原料，站内没有它的制法。");
        return;
      }
      highlightNode(node.key);
      openRecipe(node.id);
    });

    el.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    el.addEventListener("dblclick", function (e) {
      if (e.target.closest(".fg-del")) return;
      var item = itemOf(node);
      if (item) openRecipe(item.id);
    });

    var outPort = el.querySelector(".fg-out");
    outPort.addEventListener("pointerdown", function (e) {
      if (state.auto) return;
      e.preventDefault();
      e.stopPropagation();
      startLink(node.key, e);
    });

    el.addEventListener("keydown", function (e) {
      if ((e.key === "Delete" || e.key === "Backspace")) { e.preventDefault(); removeNode(node.key); }
      if (e.key === "Enter") {
        var item = itemOf(node);
        if (item) { e.preventDefault(); openRecipe(item.id); }
      }
    });

    board.classList.add("has-nodes");
    if (emptyEl) emptyEl.hidden = true;
  }

  function refreshNode(node) {
    if (!node.el) return;
    node.el.className = nodeClass(node);
    node.el.innerHTML = nodeInner(node);
    var del = node.el.querySelector(".fg-del");
    if (del) del.addEventListener("click", function (e) { e.stopPropagation(); removeNode(node.key); });
    var outPort = node.el.querySelector(".fg-out");
    if (outPort) outPort.addEventListener("pointerdown", function (e) {
      if (state.auto) return;
      e.preventDefault();
      e.stopPropagation();
      startLink(node.key, e);
    });
  }

  function highlightNode(key) {
    state.nodes.forEach(function (n) { if (n.el) n.el.classList.toggle("is-active", n.key === key); });
    var row = depsListEl.querySelector('[data-key="' + key + '"]');
    if (row && row.scrollIntoView) { try { row.scrollIntoView({ block: "nearest" }); } catch (e) {} }
  }

  function openRecipe(id) {
    if (window.ChemLab && window.ChemLab.openDetail) window.ChemLab.openDetail("p", id);
    else setStatus("找不到制法查看器");
  }

  /* ---------------- 自动配方树 ---------------- */
  function makeNode(opts) {
    var node = {
      key: opts.key || "n" + state.seq++,
      id: opts.id || null,
      raw: opts.raw || null,
      depth: opts.depth || 0,
      origin: opts.origin || null,
      originIndex: typeof opts.originIndex === "number" ? opts.originIndex : -1,
      altList: opts.altList || [],
      x: opts.x || 0,
      y: opts.y || 0
    };
    state.nodes.push(node);
    mountNode(node);
    return node;
  }

  function addEdgeSilent(fromKey, toKey, reuse) {
    if (!fromKey || !toKey || fromKey === toKey) return;
    var dup = state.edges.some(function (ed) { return ed.from === fromKey && ed.to === toKey; });
    if (dup) return;
    state.edges.push({ from: fromKey, to: toKey, reuse: !!reuse });
  }

  function buildTree(rootId) {
    var rootItem = byId(rootId);
    if (!rootItem) return;
    state.nodes = [];
    state.edges = [];
    state.root = rootId;
    state.supplies = {};
    state.editing = null;
    nodesLayer.innerHTML = "";
    state.seq = 1;
    buildCtx = {
      seen: {}, ancestor: {}, rawSeen: {}, reuse: 0, cycle: 0, truncated: false,
      producerCache: {}, frag: document.createDocumentFragment()
    };

    var rootAlts = altMethodsFor(rootItem).map(function (d) { return d.id; });
    var rootKey = makeNode({ id: rootId, depth: 0, altList: rootAlts });
    var rootSub = subKey(rootItem);
    buildCtx.seen[rootSub] = rootKey.key;
    buildCtx.ancestor[rootSub] = true;
    expandNode(rootKey, rootItem, 1, rootId + "|-1");
    delete buildCtx.ancestor[rootSub];

    nodesLayer.appendChild(buildCtx.frag);
    buildCtx.frag = null;
    dedupeNodes();
    layoutTree();
    state.nodes.forEach(function (n) { if (n.cycle) refreshNode(n); });
    renderAll();
    scrollToRoot();
    scheduleSave();
    updateEmpty();
  }

  function scrollToRoot() {
    var scroller = board.parentNode;
    if (!scroller || !state.root) return;
    var root = null;
    state.nodes.some(function (n) { if (n.depth === 0) { root = n; return true; } return false; });
    if (!root) return;
    try {
      scroller.scrollLeft = Math.max(0, root.x * zoom + (NODE_W * zoom) / 2 - scroller.clientWidth / 2);
      scroller.scrollTop = Math.max(0, root.y * zoom + (NODE_H * zoom) / 2 - scroller.clientHeight / 2);
    } catch (e) {}
  }

  function candidatesFor(text, item) {
    if (!buildCtx || !buildCtx.producerCache) return findProducers(text, item);
    var key = item.id + "|" + text;
    if (Object.prototype.hasOwnProperty.call(buildCtx.producerCache, key)) return buildCtx.producerCache[key];
    var list = findProducers(text, item);
    buildCtx.producerCache[key] = list;
    return list;
  }

  function refersToItem(text, item) {
    if (!item) return false;
    var bf = baseFormula(item.formula);
    if (bf.length >= 2 && hasFormula(text, bf)) return true;
    var core = coreName(item.name);
    return core.length >= 2 && String(text).indexOf(core) !== -1;
  }

  function expandNode(node, item, depth, originKey) {
    if (!buildCtx) return;
    if (depth > MAX_DEPTH) return;
    var reagents = (item.reagents || []).slice(0, 5);
    for (var i = 0; i < reagents.length; i++) {
      if (state.nodes.length >= MAX_NODES) { buildCtx.truncated = true; break; }
      var text = reagents[i];
      if (refersToItem(text, item)) {
        node.cycle = true;
        buildCtx.cycle += 1;
        continue;
      }
      var cands = candidatesFor(text, item);
      var overrideKey = item.id + "|" + i;
      var chosen = state.overrides[overrideKey] ? byId(state.overrides[overrideKey]) : null;
      if (!chosen) chosen = pickProducer(cands, text);

      if (!chosen) {
        if (buildCtx.rawSeen[text]) { addEdgeSilent(buildCtx.rawSeen[text], node.key); continue; }
        if (state.nodes.length >= MAX_NODES) { buildCtx.truncated = true; break; }
        var rawNode = makeNode({ raw: text, depth: depth, origin: item.id, originIndex: i });
        buildCtx.rawSeen[text] = rawNode.key;
        addEdgeSilent(rawNode.key, node.key);
        continue;
      }

      var sub = subKey(chosen);
      if (buildCtx.seen[sub]) {
        if (buildCtx.ancestor[sub]) {
          node.cycle = true;
          buildCtx.cycle += 1;
          continue;
        }
        addEdgeSilent(buildCtx.seen[sub], node.key, true);
        buildCtx.reuse += 1;
        continue;
      }

      var altList = cands.map(function (d) { return d.id; });
      var child = makeNode({
        id: chosen.id, depth: depth, origin: item.id, originIndex: i, altList: altList
      });
      buildCtx.seen[sub] = child.key;
      buildCtx.ancestor[sub] = true;
      addEdgeSilent(child.key, node.key);
      expandNode(child, chosen, depth + 1, originKey);
      delete buildCtx.ancestor[sub];
    }
  }

  function dedupeNodes() {
    var seen = {};
    var removed = {};
    state.nodes = state.nodes.filter(function (n) {
      var key;
      if (n.id) {
        var item = byId(n.id);
        key = item ? subKey(item) : "id:" + n.id;
      } else {
        key = "raw:" + n.raw;
      }
      if (seen[key]) {
        removed[n.key] = true;
        if (n.el && n.el.parentNode) n.el.parentNode.removeChild(n.el);
        return false;
      }
      seen[key] = true;
      return true;
    });
    if (Object.keys(removed).length) {
      state.edges = state.edges.filter(function (e) { return !removed[e.from] && !removed[e.to]; });
    }
  }

  function layoutTree() {
    var maxDepth = 0;
    state.nodes.forEach(function (n) { if (n.depth > maxDepth) maxDepth = n.depth; });
    var columns = {};
    state.nodes.forEach(function (n) {
      if (!columns[n.depth]) columns[n.depth] = [];
      columns[n.depth].push(n);
    });
    var byKey = {};
    state.nodes.forEach(function (n) { byKey[n.key] = n; });

    /* 以子节点的平均行号（重心）排序，减少连线交叉 */
    var childrenOf = {};
    state.edges.forEach(function (e) {
      var child = byKey[e.from];
      var parent = byKey[e.to];
      if (!child || !parent) return;
      (childrenOf[parent.key] = childrenOf[parent.key] || []).push(child);
    });
    var rowOf = {};
    var deepest = columns[maxDepth] || [];
    deepest.forEach(function (n, i) { rowOf[n.key] = i; });
    for (var d = maxDepth - 1; d >= 0; d--) {
      var col = columns[d] || [];
      function bary(n) {
        var kids = childrenOf[n.key] || [];
        var sum = 0, cnt = 0;
        kids.forEach(function (k) {
          if (rowOf[k.key] != null) { sum += rowOf[k.key]; cnt += 1; }
        });
        return cnt ? sum / cnt : null;
      }
      col.sort(function (a, b) {
        var ba = bary(a);
        var bb = bary(b);
        if (ba == null && bb == null) return (rowOf[a.key] || 0) - (rowOf[b.key] || 0);
        if (ba == null) return 1;
        if (bb == null) return -1;
        if (ba !== bb) return ba - bb;
        return (rowOf[a.key] || 0) - (rowOf[b.key] || 0);
      });
      col.forEach(function (n, i) { rowOf[n.key] = i; });
    }

    var totalW = (maxDepth + 1) * (NODE_W + COL_GAP) - COL_GAP;
    var needW = Math.max(BOARD_W, totalW + 120);
    var maxRows = 0;
    Object.keys(columns).forEach(function (d) { maxRows = Math.max(maxRows, columns[d].length); });
    var needH = Math.max(BOARD_H, maxRows * (NODE_H + ROW_GAP) + 130);
    board.style.width = needW + "px";
    board.style.height = needH + "px";
    state.boardW = needW;
    state.boardH = needH;
    svg.setAttribute("width", needW);
    svg.setAttribute("height", needH);
    var startX = Math.max(46, Math.round((needW - totalW) / 2));
    Object.keys(columns).forEach(function (d) {
      var col = columns[d];
      var depth = parseInt(d, 10);
      var totalH = col.length * NODE_H + (col.length - 1) * ROW_GAP;
      var startY = Math.max(44, Math.round((needH - totalH) / 2));
      col.forEach(function (n, i) {
        n.x = startX + (maxDepth - depth) * (NODE_W + COL_GAP);
        n.y = startY + i * (NODE_H + ROW_GAP);
        if (n.el) {
          n.el.style.left = n.x + "px";
          n.el.style.top = n.y + "px";
        }
      });
    });
  }

  /* ---------------- 手动模式节点 ---------------- */
  function addNode(id, x, y, forcedKey) {
    var item = byId(id);
    if (!item) return;
    if (!forcedKey) {
      var existing = null;
      state.nodes.some(function (n) { if (n.id === id) { existing = n; return true; } return false; });
      if (existing) {
        highlightNode(existing.key);
        setStatus("「" + item.name + "」已经在画布上，已定位到原卡片；同一药品只保留一个节点");
        return existing;
      }
    }
    var node = makeNode({
      key: forcedKey || null,
      id: id,
      x: clamp(Math.round(x), 0, BOARD_W - NODE_W),
      y: clamp(Math.round(y), 0, BOARD_H - NODE_H),
      depth: 0
    });
    afterChange();
    return node;
  }

  function removeNode(key) {
    var node = nodeByKey(key);
    if (!node) return;
    var wasRoot = state.auto && (node.depth === 0 || (node.id && node.id === state.root));
    state.nodes = state.nodes.filter(function (n) { return n.key !== key; });
    state.edges = state.edges.filter(function (ed) { return ed.from !== key && ed.to !== key; });
    Object.keys(state.supplies).forEach(function (k) {
      var pair = k.split(">");
      if (pair[0] === key || pair[1] === key || (node.raw && k === "raw>" + node.raw)) delete state.supplies[k];
    });
    if (state.editing && state.editing.split(">").indexOf(key) !== -1) state.editing = null;
    var el = node.el || nodesLayer.querySelector('[data-key="' + key + '"]');
    if (el && el.parentNode) el.parentNode.removeChild(el); else if (el) el.remove();

    if (wasRoot) {
      state.nodes = [];
      state.edges = [];
      state.root = null;
      state.supplies = {};
      state.editing = null;
      nodesLayer.innerHTML = "";
      updateEmpty();
      afterChange();
      setStatus("已移除目标药品，配方树已清空；可从左侧重新拖入一个药品。");
      return;
    }
    updateEmpty();
    if (state.auto) layoutTree();
    afterChange();
    setStatus(state.auto ? "已从配方树移除该节点及其连线；可继续拖入药品重新展开。" : "已移除节点及其连线。");
  }

  function updateEmpty() {
    if (!emptyEl) return;
    emptyEl.hidden = state.nodes.length > 0;
    board.classList.toggle("has-nodes", state.nodes.length > 0);
  }

  /* ---------------- 缩放（按钮 / 双指 / Ctrl+滚轮） ---------------- */
  function zoomLabel() {
    if (zoomValEl) zoomValEl.textContent = Math.round(zoom * 100) + "%";
  }
  function scrollerEl() { return board.parentNode; }
  function setZoom(next, anchorX, anchorY) {
    next = clamp(Math.round(next * 100) / 100, ZOOM_MIN, ZOOM_MAX);
    if (Math.abs(next - zoom) < 0.005) return;
    var scroller = scrollerEl();
    if (!scroller) return;
    var sr = scroller.getBoundingClientRect();
    var ax = anchorX == null ? sr.left + scroller.clientWidth / 2 : anchorX;
    var ay = anchorY == null ? sr.top + scroller.clientHeight / 2 : anchorY;
    var rect = board.getBoundingClientRect();
    var cx = (ax - rect.left) / zoom;
    var cy = (ay - rect.top) / zoom;
    zoom = next;
    board.style.zoom = zoom;
    zoomLabel();
    var nr = board.getBoundingClientRect();
    scroller.scrollLeft += (nr.left + cx * zoom) - ax;
    scroller.scrollTop += (nr.top + cy * zoom) - ay;
    try { localStorage.setItem(ZOOM_KEY, String(zoom)); } catch (e) {}
  }
  function resetZoom() { setZoom(1); }
  function fitZoom() {
    var scroller = scrollerEl();
    if (!scroller) return;
    var w = state.boardW || BOARD_W;
    setZoom((scroller.clientWidth - 18) / w);
    setTimeout(scrollToRoot, 80);
    setStatus("画布已缩放到适合宽度");
  }
  function suppressNextClick() {
    suppressClick = true;
    if (suppressClickTimer) clearTimeout(suppressClickTimer);
    suppressClickTimer = setTimeout(function () { suppressClick = false; }, 450);
  }

  function setPaletteOpen(open, remember) {
    if (!paletteEl) return;
    paletteEl.classList.toggle("is-collapsed", !open);
    if (paletteToggleEl) {
      paletteToggleEl.setAttribute("aria-expanded", open ? "true" : "false");
      paletteToggleEl.textContent = open ? "收起" : "展开药品库";
    }
    if (remember !== false) {
      try { localStorage.setItem(PALETTE_KEY, open ? "1" : "0"); } catch (e) {}
    }
  }

  /* 双指缩放：在 document 捕获阶段记录触点，第二条手指落下时取消拖动/平移 */
  function touchDistance(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy) || 1;
  }
  function touchInsideBoard(p) {
    var r = board.getBoundingClientRect();
    return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
  }
  function onTouchStart(e) {
    if (e.pointerType !== "touch") return;
    if (!touchInsideBoard({ x: e.clientX, y: e.clientY })) return;
    touchPts[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(touchPts);
    if (ids.length === 2) {
      if (drag) { try { drag.el.classList.remove("is-moving"); } catch (x) {} drag = null; }
      pan = null;
      board.classList.remove("is-panning");
      var a = touchPts[ids[0]];
      var b = touchPts[ids[1]];
      pinch = {
        dist: touchDistance(a, b),
        zoom: zoom,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2
      };
      suppressNextClick();
    }
  }
  function onTouchMove(e) {
    if (e.pointerType !== "touch" || !touchPts[e.pointerId]) return;
    touchPts[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (!pinch) return;
    var ids = Object.keys(touchPts);
    if (ids.length !== 2) return;
    if (e.cancelable) e.preventDefault();
    var a = touchPts[ids[0]];
    var b = touchPts[ids[1]];
    var next = pinch.zoom * (touchDistance(a, b) / pinch.dist);
    setZoom(next, (a.x + b.x) / 2, (a.y + b.y) / 2);
    pinch.cx = (a.x + b.x) / 2;
    pinch.cy = (a.y + b.y) / 2;
  }
  function onTouchEnd(e) {
    if (e.pointerType !== "touch") return;
    delete touchPts[e.pointerId];
    if (Object.keys(touchPts).length < 2 && pinch) {
      pinch = null;
      suppressNextClick();
    }
  }
  document.addEventListener("pointerdown", onTouchStart, true);
  document.addEventListener("pointermove", onTouchMove, { capture: true, passive: false });
  document.addEventListener("pointerup", onTouchEnd, true);
  document.addEventListener("pointercancel", onTouchEnd, true);

  board.addEventListener("wheel", function (e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(zoom * (e.deltaY < 0 ? 1.12 : 0.89), e.clientX, e.clientY);
  }, { passive: false });

  /* ---------------- 拖动 / 连线（手动模式） ---------------- */
  var pan = null;
  board.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    if (pinch) return;
    if (e.target.closest(".fg-node") || e.target.closest("button") || e.target.closest("input") || e.target.closest(".fg-port")) return;
    var scroller = board.parentNode;
    if (!scroller) return;
    pan = { x: e.clientX, y: e.clientY, left: scroller.scrollLeft, top: scroller.scrollTop };
    board.classList.add("is-panning");
    if (e.pointerType === "mouse") e.preventDefault();
  });
  board.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var node = nodeByKey(drag.key);
    if (!node) return;
    var p = point(e);
    var nx = Math.round(p.x - drag.dx);
    var ny = Math.round(p.y - drag.dy);
    if (!drag.moved && (Math.abs(nx - node.x) > 3 || Math.abs(ny - node.y) > 3)) drag.moved = true;
    var bw = state.boardW || BOARD_W;
    var bh = state.boardH || BOARD_H;
    node.x = clamp(nx, 0, bw - NODE_W);
    node.y = clamp(ny, 0, bh - NODE_H);
    drag.el.style.left = node.x + "px";
    drag.el.style.top = node.y + "px";
    renderEdges();
  });

  window.addEventListener("pointermove", function (e) {
    if (pan) {
      var scroller = board.parentNode;
      if (scroller) {
        scroller.scrollLeft = pan.left - (e.clientX - pan.x);
        scroller.scrollTop = pan.top - (e.clientY - pan.y);
      }
      return;
    }
    if (!linking) return;
    var p = point(e);
    if (tempPath) tempPath.setAttribute("d", curve(linking.x, linking.y, p.x, p.y));
  });

  window.addEventListener("pointerup", function (e) {
    if (pan) {
      pan = null;
      board.classList.remove("is-panning");
    }
    if (drag) {
      var moved = drag.moved;
      drag.el.classList.remove("is-moving");
      drag = null;
      scheduleSave();
      if (moved) {
        suppressClick = true;
        setTimeout(function () { suppressClick = false; }, 400);
        if (state.auto) setStatus("已移动卡片；点「重排图层」可以恢复自动布局。拖动不会打开制法页。");
      }
    }
    if (!linking) return;
    var target = document.elementFromPoint(e.clientX, e.clientY);
    var nodeEl = target && target.closest ? target.closest(".fg-node") : null;
    if (nodeEl) {
      var toKey = nodeEl.dataset.key;
      if (toKey !== linking.from) addEdge(linking.from, toKey);
    }
    endLink();
  });

  function point(e) {
    var rect = board.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
  }
  function curve(x1, y1, x2, y2) {
    var dx = Math.max(46, Math.abs(x2 - x1) * 0.42);
    return "M" + x1 + " " + y1 + " C" + (x1 + dx) + " " + y1 + ", " + (x2 - dx) + " " + y2 + ", " + x2 + " " + y2;
  }
  function ports(node) {
    return {
      out: { x: node.x + NODE_W, y: node.y + NODE_H / 2 },
      in: { x: node.x, y: node.y + NODE_H / 2 }
    };
  }

  function startLink(fromKey, e) {
    var node = nodeByKey(fromKey);
    if (!node) return;
    linking = { from: fromKey, x: node.x + NODE_W, y: node.y + NODE_H / 2 };
    tempPath = document.createElementNS(SVG_NS, "path");
    tempPath.setAttribute("class", "fg-edge is-temp");
    tempPath.setAttribute("d", curve(linking.x, linking.y, linking.x, linking.y));
    svg.appendChild(tempPath);
    var p = point(e);
    tempPath.setAttribute("d", curve(linking.x, linking.y, p.x, p.y));
  }
  function endLink() {
    if (tempPath && tempPath.parentNode) tempPath.parentNode.removeChild(tempPath);
    tempPath = null;
    linking = null;
  }

  function addEdge(fromKey, toKey) {
    if (!fromKey || !toKey || fromKey === toKey) return;
    if (state.edges.some(function (ed) { return ed.from === fromKey && ed.to === toKey; })) return;
    state.edges.push({ from: fromKey, to: toKey });
    afterChange();
  }

  function renderEdges() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var defs = document.createElementNS(SVG_NS, "defs");
    defs.innerHTML = '<marker id="fg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="currentColor"/></marker>';
    svg.appendChild(defs);

    state.edges.forEach(function (ed) {
      var a = nodeByKey(ed.from);
      var b = nodeByKey(ed.to);
      if (!a || !b) return;
      var pa = ports(a).out;
      var pb = ports(b).in;
      var path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("class", "fg-edge" + (ed.reuse ? " is-reuse" : "") + (b.depth === 0 ? " is-final" : ""));
      path.setAttribute("d", curve(pa.x, pa.y, pb.x, pb.y));
      path.setAttribute("marker-end", "url(#fg-arrow)");
      path.setAttribute("data-from", ed.from);
      path.setAttribute("data-to", ed.to);
      if (!state.auto) {
        path.addEventListener("click", function () {
          state.edges = state.edges.filter(function (x) { return !(x.from === ed.from && x.to === ed.to); });
          afterChange();
          setStatus("已移除一条连线");
        });
      }
      var title = document.createElementNS(SVG_NS, "title");
      title.textContent = ed.reuse ? "复用已展开的节点（避免循环套娃）" : "物料衔接";
      path.appendChild(title);
      svg.appendChild(path);
    });

    if (linking) {
      tempPath = document.createElementNS(SVG_NS, "path");
      tempPath.setAttribute("class", "fg-edge is-temp");
      tempPath.setAttribute("d", curve(linking.x, linking.y, linking.x, linking.y));
      svg.appendChild(tempPath);
    }
  }

  /* ---------------- 路线解读 ---------------- */
  function computeRoute() {
    var indeg = {};
    var adj = {};
    state.nodes.forEach(function (n) { indeg[n.key] = 0; adj[n.key] = []; });
    state.edges.forEach(function (ed) {
      if (!(ed.from in indeg) || !(ed.to in indeg)) return;
      adj[ed.from].push(ed.to);
      indeg[ed.to] += 1;
    });
    var queue = state.nodes.filter(function (n) { return indeg[n.key] === 0; }).map(function (n) { return n.key; });
    var order = [];
    while (queue.length) {
      var k = queue.shift();
      order.push(k);
      adj[k].forEach(function (to) {
        indeg[to] -= 1;
        if (indeg[to] === 0) queue.push(to);
      });
    }
    return { order: order, cyclic: order.length !== state.nodes.length };
  }

  function supplyCount() { return Object.keys(state.supplies).length; }

  function restoreSupplies(src) {
    state.supplies = {};
    if (!src || typeof src !== "object") return;
    Object.keys(src).forEach(function (k) {
      if (k.indexOf("raw>") === 0) {
        if (typeof src[k] === "string") state.supplies[k] = src[k].slice(0, 60);
        return;
      }
      var pair = k.split(">");
      if (pair.length === 2 && nodeByKey(pair[0]) && nodeByKey(pair[1]) && typeof src[k] === "string") {
        state.supplies[k] = src[k].slice(0, 60);
      }
    });
  }

  function renderRoute() {
    var r = computeRoute();
    var entries = r.order.map(function (k) { return nodeByKey(k); }).filter(Boolean);

    if (!state.nodes.length) {
      routeListEl.innerHTML = '<li class="route-idle">还没有节点，先拖一个药品进来。</li>';
      riskEl.textContent = "风险 —";
      riskEl.className = "route-risk";
      routeNoteEl.textContent = "";
      setStatus("节点 0 · 连线 0 · 尚未成链");
      return;
    }

    routeListEl.innerHTML = entries.map(function (node, i) {
      var item = itemOf(node);
      var missing = !!state.missing[depKey(node)];
      var extra = "";
      if (!item) {
        var rawKey = "raw>" + node.raw;
        var rawSupply = state.supplies[rawKey];
        extra = '<span class="route-link' + (missing ? " warn" : " neutral") + '">' + (missing ? "缺失" : "基础原料 · 自备") + "</span>";
        if (rawSupply) extra += '<button class="route-link ok route-supply" type="button" data-fix="' + esc(rawKey) + '">已补足 · ' + esc(rawSupply) + "</button>";
        else extra += '<button class="route-fix" type="button" data-fix="' + esc(rawKey) + '">补足药品</button>';
        if (state.editing === rawKey) {
          extra += '<span class="route-fix-form"><input type="text" data-fix-input value="' + esc(rawSupply || node.raw) +
            '" placeholder="输入实际补入的药品" aria-label="补入的药品名称"><button type="button" data-fix-ok="' + esc(rawKey) + '">确认</button><button type="button" data-fix-cancel>取消</button></span>';
        }
      } else if (state.auto) {
        var acts = "";
        if (node.altList && node.altList.length > 1) acts += '<button class="route-mini" type="button" data-dep-swap="' + node.key + '">换源</button>';
        extra = '<button class="route-mini" type="button" data-dep-recipe="' + node.key + '">制法</button>' +
          '<button class="route-mini" type="button" data-dep-missing="' + node.key + '">' + (missing ? "恢复" : "缺失") + "</button>" + acts;
        if (missing) extra += '<span class="route-link warn">缺失</span>';
      } else if (i > 0) {
        var prev = entries[i - 1];
        var prevItem = itemOf(prev);
        var hay = (item.reagents || []).join(" ");
        var core = prevItem ? prevItem.name.replace(/（[^）]*）/g, "").replace(/单质|溶液|晶体|粉末/g, "") : (prev.raw || "");
        var formulas = prevItem ? String(prevItem.formula || "").split(/[·.]/).filter(Boolean) : [];
        var names = [core].concat(formulas);
        var hit = names.some(function (t) { return t && t.length > 1 && hay.indexOf(t) !== -1; });
        var key = r.order[i - 1] + ">" + r.order[i];
        var supply = state.supplies[key];
        if (hit) extra = '<span class="route-link ok">物料衔接</span>';
        else if (supply && state.editing !== key) {
          extra = '<button class="route-link ok route-supply" type="button" data-fix="' + esc(key) + '">已补足 · ' + esc(supply) + "</button>";
        } else {
          extra = '<span class="route-link warn">需补试剂</span><button class="route-fix" type="button" data-fix="' + esc(key) + '">补足药品</button>';
        }
        if (state.editing === key) {
          extra += '<span class="route-fix-form"><input type="text" data-fix-input value="' + esc(supply || (prevItem ? prevItem.name : prev.raw)) +
            '" placeholder="输入补入的药品名称" aria-label="补入的药品名称"><button type="button" data-fix-ok="' + esc(key) + '">确认</button><button type="button" data-fix-cancel>取消</button></span>';
        }
      }

      var name = item ? item.name : node.raw;
      var sub = item ? (item.formula || "") + " · " + item.category : "基础原料 · 站内无制法";
      return "<li" + (missing ? ' class="is-missing"' : "") + '><span class="route-step">' + (i + 1) + "</span>" +
        '<span class="route-text"><b>' + esc(name) + "</b><small>" + esc(sub) + "</small></span>" + extra + "</li>";
    }).join("");

    if (r.cyclic) {
      routeListEl.insertAdjacentHTML("beforeend", '<li class="route-cycle">检测到循环衔接：请断开其中一条连线，反应不能自我循环。</li>');
      riskEl.textContent = "风险 环";
      riskEl.className = "route-risk is-high";
      setStatus("节点 " + state.nodes.length + " · 连线 " + state.edges.length + " · 存在循环");
      return;
    }

    var items = entries.map(itemOf).filter(Boolean);
    var risk = items.length ? Math.max.apply(null, items.map(function (d) { return d.hazard || 1; })) : 1;
    var raws = entries.filter(function (n) { return !n.id; }).length;
    var missing = Object.keys(state.missing).length;
    var links = Math.max(0, entries.length - 1);
    riskEl.textContent = "风险 " + risk + " 级";
    riskEl.className = "route-risk" + (risk >= 3 ? " is-high" : risk === 2 ? " is-mid" : "");
    if (state.auto) {
      routeNoteEl.textContent = "自动配方树：" + state.nodes.length + " 个节点、" + links + " 处衔接，其中 " + raws +
        " 种基础原料需要自备；最高风险 " + risk + " 级。同一种药品只展开一次，循环依赖以复用连线表示。基础原料可点「补足药品」记录实际补入的试剂，随路线保存和导出。" +
        (buildCtx && buildCtx.truncated ? "已达节点上限，部分深层依赖未继续展开。" : "");
    } else {
      routeNoteEl.textContent = "共 " + entries.length + " 步、" + links + " 处衔接。风险取各步最高值；「需补试剂」表示上一步产物未出现在下一步原料表里，可点「补足药品」手动补入。";
    }
    setStatus("节点 " + state.nodes.length + " · 连线 " + state.edges.length + " · " +
      (state.auto ? "自动配方树" : entries.length + " 步路线") + (missing ? " · 缺失 " + missing : ""));
  }

  /* ---------------- 依赖清单 ---------------- */
  function renderDeps() {
    if (!state.nodes.length) {
      depsListEl.innerHTML = '<p class="deps-idle">还没有依赖。拖一个药品进来，这里会列出每一层原料、缺少的药品和可替换的制法。</p>';
      depsCountEl.textContent = "0 项";
      return;
    }
    var rows = state.nodes.slice().sort(function (a, b) { return a.depth - b.depth; });
    var raws = 0;
    var missing = 0;
    depsListEl.innerHTML = rows.map(function (node) {
      var item = itemOf(node);
      var kind = node.depth === 0 ? "目标" : item ? "中间体" : "基础原料";
      var miss = !!state.missing[depKey(node)];
      if (!item) raws += 1;
      if (miss) missing += 1;
      var name = item ? item.name : node.raw;
      var sub = item ? (item.formula || "") : "需要自备";
      var acts = "";
      if (item) {
        acts += '<button class="dep-btn" type="button" data-dep-recipe="' + node.key + '">制法</button>';
        if (node.altList && node.altList.length > 1) acts += '<button class="dep-btn" type="button" data-dep-swap="' + node.key + '">换源</button>';
      }
      acts += '<button class="dep-btn' + (miss ? " is-on" : "") + '" type="button" data-dep-missing="' + node.key + '">' + (miss ? "恢复" : "缺失") + "</button>";
      return '<div class="dep-row' + (miss ? " is-missing" : "") + '" data-key="' + node.key + '">' +
        '<span class="dep-kind' + (item ? "" : " is-raw") + '">' + (item ? esc(item.category) : "原料") + "</span>" +
        '<span class="dep-main"><b>' + esc(name) + '</b><small>' + esc(sub) + "</small></span>" +
        (node.altList && node.altList.length > 1 ? '<span class="dep-alt">' + node.altList.length + " 法</span>" : "") +
        '<span class="dep-actions">' + acts + "</span></div>";
    }).join("");
    depsCountEl.textContent = state.nodes.length + " 项 · 基础原料 " + raws + " · 缺失 " + missing;
  }

  depsListEl.addEventListener("click", function (e) {
    var recipe = e.target.closest("[data-dep-recipe]");
    if (recipe) {
      var rn = nodeByKey(recipe.getAttribute("data-dep-recipe"));
      if (rn && rn.id) openRecipe(rn.id);
      return;
    }
    var missing = e.target.closest("[data-dep-missing]");
    if (missing) {
      toggleMissing(missing.getAttribute("data-dep-missing"));
      return;
    }
    var swap = e.target.closest("[data-dep-swap]");
    if (swap) {
      swapMethod(swap.getAttribute("data-dep-swap"));
      return;
    }
    var row = e.target.closest(".dep-row");
    if (row) highlightNode(row.getAttribute("data-key"));
  });

  function toggleMissing(key) {
    var node = nodeByKey(key);
    if (!node) return;
    var k = depKey(node);
    if (state.missing[k]) {
      delete state.missing[k];
      refreshNode(node);
      renderAll();
      scheduleSave();
      setStatus("已恢复「" + (node.id ? byId(node.id).name : node.raw) + "」");
      return;
    }
    state.missing[k] = true;
    if (node.altList && node.altList.length > 1) {
      var next = nextAlt(node);
      if (next) {
        setOverride(node, next.id);
        delete state.missing[k];
        rebuild();
        setStatus("「" + displayName(node) + "」原制法不可用，已自动切换到：" + next.name);
        return;
      }
    }
    refreshNode(node);
    renderAll();
    scheduleSave();
    setStatus(node.id ? "已标记「" + displayName(node) + "」缺失" : "「" + node.raw + "」没有替代制法，保留缺失标记");
  }

  function displayName(node) { return node.id ? byId(node.id).name : node.raw; }

  function nextAlt(node) {
    if (!node.altList || node.altList.length < 2) return null;
    var idx = node.altList.indexOf(node.id);
    for (var step = 1; step <= node.altList.length; step++) {
      var cand = node.altList[(idx + step) % node.altList.length];
      if (cand !== node.id) return byId(cand);
    }
    return null;
  }

  function setOverride(node, producerId) {
    if (!node) return;
    if (node.depth === 0) {
      state.root = producerId;
      return;
    }
    if (node.origin && node.originIndex >= 0) {
      state.overrides[node.origin + "|" + node.originIndex] = producerId;
    }
  }

  function swapMethod(key) {
    var node = nodeByKey(key);
    if (!node) return;
    if (node.depth === 0) {
      var alts = altMethodsFor(byId(node.id));
      if (alts.length < 2) { setStatus("「" + displayName(node) + "」没有其他制法"); return; }
      var idx = 0;
      alts.forEach(function (d, i) { if (d.id === node.id) idx = i; });
      var nextRoot = alts[(idx + 1) % alts.length];
      buildTree(nextRoot.id);
      setStatus("目标制法已切换为：" + nextRoot.name);
      return;
    }
    var next = nextAlt(node);
    if (!next) { setStatus("「" + displayName(node) + "」没有替代制法"); return; }
    setOverride(node, next.id);
    rebuild();
    setStatus("「" + displayName(node) + "」已切换到替代制法：" + next.name);
  }

  function rebuild() {
    if (!state.root) { renderAll(); scheduleSave(); return; }
    var root = state.root;
    var overrides = state.overrides;
    var missing = state.missing;
    var supplies = state.supplies;
    buildTree(root);
    state.overrides = overrides;
    state.missing = missing;
    state.supplies = supplies;
    refreshMissing();
    renderAll();
    scheduleSave();
  }

  function refreshMissing() {
    state.nodes.forEach(function (n) {
      if (state.missing[depKey(n)]) {
        n.el && n.el.classList.add("is-missing");
      }
    });
  }

  function afterChange() {
    renderEdges();
    renderRoute();
    renderDeps();
    scheduleSave();
  }
  function renderAll() {
    renderEdges();
    renderRoute();
    renderDeps();
  }
  function setStatus(text) { statusEl.textContent = text; }

  /* ---------------- 补入原料（手动模式） ---------------- */
  function focusFixInput() {
    setTimeout(function () {
      var input = routeListEl.querySelector("[data-fix-input]");
      if (input) { input.focus(); if (input.select) input.select(); }
    }, 0);
  }
  function commitFix(key) {
    var input = routeListEl.querySelector("[data-fix-input]");
    var val = input ? input.value.trim() : "";
    if (!val) delete state.supplies[key];
    else state.supplies[key] = val;
    state.editing = null;
    renderRoute();
    scheduleSave();
    setStatus(val ? "已补入药品：" + val : "已清除补入的药品");
  }
  routeListEl.addEventListener("click", function (e) {
    var okBtn = e.target.closest("[data-fix-ok]");
    if (okBtn) { commitFix(okBtn.getAttribute("data-fix-ok")); return; }
    if (e.target.closest("[data-fix-cancel]")) { state.editing = null; renderRoute(); return; }
    var recipe = e.target.closest("[data-dep-recipe]");
    if (recipe) {
      var rn = nodeByKey(recipe.getAttribute("data-dep-recipe"));
      if (rn && rn.id) openRecipe(rn.id);
      return;
    }
    var miss = e.target.closest("[data-dep-missing]");
    if (miss) { toggleMissing(miss.getAttribute("data-dep-missing")); return; }
    var sw = e.target.closest("[data-dep-swap]");
    if (sw) { swapMethod(sw.getAttribute("data-dep-swap")); return; }
    var fix = e.target.closest("[data-fix]");
    if (fix) {
      var k = fix.getAttribute("data-fix");
      state.editing = state.editing === k ? null : k;
      renderRoute();
      focusFixInput();
    }
  });
  routeListEl.addEventListener("keydown", function (e) {
    var input = e.target.closest("[data-fix-input]");
    if (!input) return;
    if (e.key === "Enter") {
      e.preventDefault();
      var ok = input.parentNode.querySelector("[data-fix-ok]");
      if (ok) commitFix(ok.getAttribute("data-fix-ok"));
    } else if (e.key === "Escape") {
      e.preventDefault();
      state.editing = null;
      renderRoute();
    }
  });

  /* ---------------- 持久化 ---------------- */
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 300);
  }
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        v: 2, auto: state.auto, root: state.root,
        nodes: state.nodes.map(function (n) {
          return { key: n.key, id: n.id, raw: n.raw, x: n.x, y: n.y, depth: n.depth, origin: n.origin, originIndex: n.originIndex, altList: n.altList };
        }),
        edges: state.edges, seq: state.seq, supplies: state.supplies,
        overrides: state.overrides, missing: state.missing
      }));
    } catch (e) {}
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      var obj = JSON.parse(raw);
      if (!obj || !Array.isArray(obj.nodes)) return false;

      state.auto = obj.auto !== false;
      state.overrides = obj.overrides && typeof obj.overrides === "object" ? obj.overrides : {};
      state.missing = obj.missing && typeof obj.missing === "object" ? obj.missing : {};

      if (state.auto && obj.root && byId(obj.root)) {
        buildTree(obj.root);
        restoreSupplies(obj.supplies);
        refreshMissing();
        renderAll();
        scheduleSave();
        return true;
      }

      state.auto = false;
      var savedNodes = obj.nodes.filter(function (n) { return n && byId(n.id); });
      state.nodes = [];
      state.edges = Array.isArray(obj.edges) ? obj.edges : [];
      var maxKey = 0;
      savedNodes.forEach(function (n) {
        var m = /^n(\d+)$/.exec(n.key || "");
        if (m) maxKey = Math.max(maxKey, parseInt(m[1], 10));
      });
      state.seq = Math.max(obj.seq || 1, maxKey + 1);
      savedNodes.forEach(function (n) {
        addNode(n.id, n.x, n.y, n.key);
      });
      dedupeNodes();
      restoreSupplies(obj.supplies);
      updateEmpty();
      renderAll();
      return true;
    } catch (e) { return false; }
  }

  function clearAll() {
    state.nodes = [];
    state.edges = [];
    state.seq = 1;
    state.supplies = {};
    state.editing = null;
    state.root = null;
    state.overrides = {};
    state.missing = {};
    nodesLayer.innerHTML = "";
    updateEmpty();
    renderAll();
    scheduleSave();
    setStatus("画布已清空");
  }

  /* ---------------- 示例 / 工具 ---------------- */
  var EXAMPLES = [
    { name: "氢氧化铜（自动展开）", root: "copper-hydroxide" },
    { name: "阿司匹林（自动展开）", root: "aspirin" },
    { name: "肥皂（自动展开）", root: "soap" }
  ];

  function loadExample() {
    var ex = EXAMPLES[state.example % EXAMPLES.length];
    state.example += 1;
    if (state.auto && ex.root && byId(ex.root)) {
      buildTree(ex.root);
      setStatus("已载入示例配方树：" + ex.name);
      return;
    }
    clearAll();
    var chain = ["copper-oxide", "copper-sulfate", "copper-hydroxide"];
    chain.forEach(function (id, i) {
      if (byId(id)) addNode(id, 60 + i * 300, 140);
    });
    for (var i = 1; i < state.nodes.length; i++) addEdge(state.nodes[i - 1].key, state.nodes[i].key);
    renderAll();
    scheduleSave();
    setStatus("已载入示例路线：铜的三步转化");
  }

  function routeText() {
    var r = computeRoute();
    var lines = ["化境 ChemLab · 合成路线", ""];
    var seen = {};
    var raws = [];
    var n = 0;
    r.order.forEach(function (k) {
      var node = nodeByKey(k);
      if (!node) return;
      var item = itemOf(node);
      if (!item) { raws.push(node); return; }
      if (seen[item.id]) return;
      seen[item.id] = true;
      n += 1;
      lines.push(n + ". " + item.name + "（" + (item.formula || "") + "）");
      (item.steps || []).forEach(function (s, j) { lines.push("   " + (j + 1) + ") " + s); });
      if (state.missing[item.id]) lines.push("   [缺失] 该药品当前标记为缺失");
      lines.push("");
    });
    if (raws.length) {
      lines.push("基础原料（站内未收录制法，需要自备）：");
      raws.forEach(function (node, i) {
        var supply = state.supplies["raw>" + node.raw];
        lines.push("  " + (i + 1) + ". " + node.raw + (supply ? "（补足为：" + supply + "）" : ""));
      });
      lines.push("");
    }
    var fixed = Object.keys(state.supplies).filter(function (k) {
      if (k.indexOf("raw>") === 0) return false;
      var p = k.split(">");
      return p.length === 2 && p[0] !== p[1];
    });
    if (fixed.length) {
      lines.push("手动补入的衔接：");
      fixed.forEach(function (k) {
        var p = k.split(">");
        var a = nodeByKey(p[0]);
        var b = nodeByKey(p[1]);
        if (a && b) lines.push("  " + displayName(a) + " → " + displayName(b) + "：补入 " + state.supplies[k]);
      });
      lines.push("");
    }
    if (r.cyclic) lines.push("警告：路线存在循环衔接。");
    lines.push("注意：本路线仅为教学推演，高危步骤必须在专业实验室由教师操作。");
    return lines.join("\n");
  }

  function exportRoute() {
    var text = routeText();
    var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chemlab-route.txt";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    setStatus("路线已导出为文本");
  }

  document.getElementById("forge-example").addEventListener("click", loadExample);
  document.getElementById("forge-clear").addEventListener("click", clearAll);
  document.getElementById("forge-export").addEventListener("click", exportRoute);
  reflowEl.addEventListener("click", function () {
    if (!state.auto) { setStatus("手动模式下可以自由拖动卡片"); return; }
    if (state.root) { layoutTree(); renderEdges(); save(); setStatus("图层已重排"); }
  });

  autoEl.addEventListener("change", function () {
    state.auto = !!autoEl.checked;
    document.body.classList.toggle("mode-auto", state.auto);
    if (modeHintEl) modeHintEl.textContent = isSmall
      ? "双指缩放 · 单指平移 · 点卡片看制法"
      : (state.auto ? "自动展开 · 空白处拖动平移 · 拖动卡片移动 · × 删除" : "手动编排 · 空白处拖动平移 · 拖动卡片 · 从右侧圆点拉线");
    if (state.auto && state.root) rebuild();
    else { renderAll(); scheduleSave(); }
    setStatus(state.auto ? "已开启自动展开" : "已切换到手动编排");
  });

  if (zoomOutEl) zoomOutEl.addEventListener("click", function () { setZoom(zoom - 0.12); });
  if (zoomInEl) zoomInEl.addEventListener("click", function () { setZoom(zoom + 0.12); });
  if (zoomValEl) zoomValEl.addEventListener("click", resetZoom);
  if (zoomFitEl) zoomFitEl.addEventListener("click", fitZoom);
  if (paletteToggleEl) paletteToggleEl.addEventListener("click", function () {
    setPaletteOpen(paletteEl.classList.contains("is-collapsed"));
  });

  /* ---------------- 启动 ---------------- */
  var savedRaw = null;
  try { savedRaw = localStorage.getItem(ZOOM_KEY); } catch (e) {}
  var isSmall = window.matchMedia("(max-width: 640px)").matches;
  if (isSmall && modeHintEl) modeHintEl.textContent = "双指缩放 · 单指平移 · 点卡片看制法";
  var savedZoom = savedRaw ? parseFloat(savedRaw) : (isSmall ? 0.7 : 1);
  zoom = clamp(isNaN(savedZoom) ? 1 : savedZoom, ZOOM_MIN, ZOOM_MAX);
  board.style.zoom = zoom;
  zoomLabel();
  var palettePref = null;
  try { palettePref = localStorage.getItem(PALETTE_KEY); } catch (e) {}
  if (palettePref === "0") setPaletteOpen(false, false);
  else if (palettePref === "1") setPaletteOpen(true, false);
  else setPaletteOpen(!window.matchMedia("(max-width: 640px)").matches, false);
  if (autoEl) autoEl.checked = state.auto;
  document.body.classList.toggle("mode-auto", state.auto);
  renderPalette();
  renderEdges();
  renderRoute();
  renderDeps();
  if (!load()) {
    renderAll();
    setStatus("节点 0 · 连线 0 · 尚未成链");
  }
  if (autoEl) autoEl.checked = state.auto;
  document.body.classList.toggle("mode-auto", state.auto);
  if (modeHintEl) modeHintEl.textContent = isSmall
    ? "双指缩放 · 单指平移 · 点卡片看制法"
    : (state.auto ? "自动展开 · 空白处拖动平移 · 拖动卡片移动 · × 删除" : "手动编排 · 空白处拖动平移 · 拖动卡片 · 从右侧圆点拉线");

  window.ChemForge = {
    state: state,
    add: addFromPalette,
    connect: addEdge,
    build: buildTree,
    example: loadExample,
    clear: clearAll,
    exportRoute: exportRoute,
    render: renderAll,
    toggleMissing: toggleMissing,
    swapMethod: swapMethod,
    remove: removeNode,
    supply: function (key, val) {
      if (val) state.supplies[key] = String(val).slice(0, 60);
      else delete state.supplies[key];
      renderRoute();
      scheduleSave();
    },
    routeText: routeText,
    expandReagents: findProducers
  };
})();
