/* ==========================================================================
   chain.js — 药品制法「制造链路」视图
   参考终末地百科的物品制造链路：浅色点阵画布 + 物品图块 + 深色工序条。
   依赖：window.PREPARATIONS、window.CHEMLAB_ART、window.ChemLab
   ========================================================================== */
(function () {
  "use strict";

  var DATA = window.PREPARATIONS || [];
  var stage = document.getElementById("chain-viewport");
  if (!stage) return;

  var canvas = document.getElementById("chain-canvas");
  var svg = document.getElementById("chain-edges");
  var emptyEl = document.getElementById("chain-empty");
  var titleEl = document.getElementById("chain-title");
  var subEl = document.getElementById("chain-sub");
  var kickerEl = document.getElementById("chain-kicker");
  var metaEl = document.getElementById("chain-meta");
  var rolesEl = document.getElementById("chain-roles");
  var stepsEl = document.getElementById("chain-steps");
  var crumbEl = document.getElementById("crumb-name");
  var catsEl = document.getElementById("prep-cats");
  var zoomEl = document.getElementById("zoom-range");
  var zoomVal = document.getElementById("zoom-val");
  var searchEl = document.getElementById("prep-search");
  var suggestEl = document.getElementById("chain-suggest");
  var drawerEl = document.getElementById("chain-drawer");
  var drawerListEl = document.getElementById("prep-list");
  var drawerHzEl = document.getElementById("drawer-hz");
  var drawerCountEl = document.getElementById("drawer-count");
  var scrimEl = document.getElementById("chain-scrim");
  var folderBtn = document.getElementById("chain-folder");
  var drawerClose = document.getElementById("drawer-close");
  var emptyBtn = document.getElementById("chain-open");
  var stageSection = document.getElementById("chain-stage");
  var saltView = document.getElementById("salt-view");
  var saltTable = document.getElementById("salt-table");
  var saltResult = document.getElementById("salt-result");
  var saltToggle = document.getElementById("salt-toggle");
  var saltCount = document.getElementById("salt-count");
  var saltMainCount = document.getElementById("salt-main-count");
  var saltRareCount = document.getElementById("salt-rare-count");
  var saltRare = document.getElementById("salt-rare");
  var saltRareList = document.getElementById("salt-rare-list");

  var SVG_NS = "http://www.w3.org/2000/svg";
  var STORE_KEY = "chemlab-chain-zoom";
  var BASE_W = 1180;
  var CY = 250;
  var TILE = 92;
  var PILL_W = 214;
  var PILL_H = 48;
  var COL = 272;

  var state = { q: "", cat: "all", hz: "all", active: null, zoom: 75, view: "chain" };

  var WORD_RULES = [
    [/溶解/, "溶解"], [/过滤|抽滤/, "过滤"], [/蒸发|浓缩/, "蒸发浓缩"],
    [/冷却结晶|结晶|重结晶/, "结晶"], [/冷却/, "冷却"], [/洗涤/, "洗涤"], [/干燥/, "干燥"],
    [/灼烧|煅烧|高温/, "灼烧"], [/加热|水浴|微热/, "加热"], [/研磨|粉碎/, "研磨"],
    [/混合|混匀|搅拌/, "混合"], [/滴加|逐滴/, "滴加"], [/蒸馏/, "蒸馏"], [/分液/, "分液"],
    [/萃取/, "萃取"], [/升华/, "升华"], [/电解/, "电解"], [/还原/, "还原"], [/氧化/, "氧化"],
    [/沉淀/, "沉淀"], [/中和/, "中和"], [/酸化|加酸/, "酸化"], [/通入|通气/, "通气"],
    [/收集/, "收集"], [/检验|验纯|鉴别/, "检验"], [/称量|称取/, "称量"], [/配制/, "配制"],
    [/标定/, "标定"], [/回流/, "回流"], [/点燃/, "点燃"], [/静置/, "静置"]
  ];

  var ROLE_RULES = [
    [/催化剂|催化/, "催化剂"], [/指示剂|酚酞|石蕊|甲基橙/, "指示剂"],
    [/溶剂|蒸馏水|去离子水/, "溶剂"], [/氧化剂|双氧水|高锰酸钾|氯水|浓硫酸/, "氧化剂"],
    [/还原剂|锌粒|铁粉|铝粉|氢气/, "还原剂"], [/沉淀剂|碳酸钠|氯化钡/, "沉淀剂"],
    [/酸|盐酸|硫酸|硝酸/, "酸"], [/碱|氢氧化钠|氢氧化钾|石灰水/, "碱"],
    [/盐|氯化钠|硫酸铜/, "盐"]
  ];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function byId(id) {
    for (var i = 0; i < DATA.length; i++) if (DATA[i].id === id) return DATA[i];
    return null;
  }
  function fileCode(item) {
    var n = String(DATA.indexOf(item) + 1);
    while (n.length < 3) n = "0" + n;
    return "PRP-" + n;
  }
  function riskLabel(h) { return h >= 3 ? "高危" : h === 2 ? "中危" : "低危"; }
  function normFormula(f) {
    return String(f || "").replace(/\s+/g, "").replace(/[（(].*?[）)]/g, "").replace(/[·.]/g, "");
  }
  function coreName(n) {
    return String(n || "").replace(/（[^）]*）/g, "").replace(/\([^)]*\)/g, "").trim();
  }
  function stepWord(step) {
    for (var i = 0; i < WORD_RULES.length; i++) if (WORD_RULES[i][0].test(step)) return WORD_RULES[i][1];
    return "处理";
  }
  function roleOf(text) {
    for (var i = 0; i < ROLE_RULES.length; i++) if (ROLE_RULES[i][0].test(text)) return ROLE_RULES[i][1];
    return "原料";
  }
  var CAT_ORDER = ["气体", "单质", "氧化物", "酸与碱", "盐", "有机物", "试剂与溶液", "生活材料"];

  function categories() {
    var present = [];
    DATA.forEach(function (d) { if (present.indexOf(d.category) === -1) present.push(d.category); });
    var ordered = CAT_ORDER.filter(function (c) { return present.indexOf(c) !== -1; });
    present.forEach(function (c) { if (ordered.indexOf(c) === -1) ordered.push(c); });
    return ordered;
  }

  /* ---------------- 分类条 ---------------- */
  function renderCats() {
    var cats = categories();
    var html = ['<button class="chip" type="button" data-cat="all" aria-pressed="' + (state.cat === "all") + '">全部<b class="chip-n">' + DATA.length + "</b></button>"];
    cats.forEach(function (c) {
      var n = DATA.filter(function (d) { return d.category === c; }).length;
      html.push('<button class="chip" type="button" data-cat="' + esc(c) + '" aria-pressed="' + (state.cat === c) + '">' + esc(c) + '<b class="chip-n">' + n + "</b></button>");
    });
    catsEl.innerHTML = html.join("");
  }

  function matches(d) {
    if (state.cat !== "all" && d.category !== state.cat) return false;
    if (state.hz !== "all" && String(d.hazard) !== state.hz) return false;
    var q = state.q.trim().toLowerCase();
    if (!q) return true;
    return [d.name, d.formula, d.category, d.summary].concat(d.tags || []).join(" ").toLowerCase().indexOf(q) !== -1;
  }

  function filtered() { return DATA.filter(matches); }

  /* ---------------- 图鉴抽屉 ---------------- */
  function renderDrawer() {
    var rows = filtered();
    drawerCountEl.textContent = rows.length + " / " + DATA.length;
    drawerListEl.innerHTML = rows.map(function (d) {
      return '<button class="drawer-item" type="button" role="option" data-id="' + esc(d.id) + '" aria-selected="' + (state.active === d.id) + '">' +
        '<span class="di-art">' + (window.CHEMLAB_ART ? window.CHEMLAB_ART.icon(d, "p") : "") + "</span>" +
        '<span class="di-body"><b>' + esc(d.name) + "</b><small>" + esc(d.formula || "") + " · " + esc(d.category) + "</small></span>" +
        '<span class="di-risk hz-' + d.hazard + '">' + riskLabel(d.hazard) + "</span></button>";
    }).join("") || '<p class="drawer-empty">没有匹配的药品。</p>';
  }

  function renderHz() {
    var levels = [["all", "全部风险"], ["1", "低危"], ["2", "中危"], ["3", "高危"]];
    drawerHzEl.innerHTML = levels.map(function (l) {
      return '<button class="chip chip-sm" type="button" data-hz="' + l[0] + '" aria-pressed="' + (state.hz === l[0]) + '">' + l[1] + "</button>";
    }).join("");
  }

  function openDrawer() {
    drawerEl.classList.add("is-open");
    drawerEl.setAttribute("aria-hidden", "false");
    scrimEl.hidden = false;
    renderDrawer();
    setTimeout(function () { if (drawerClose) drawerClose.focus(); }, 0);
  }
  function closeDrawer() {
    drawerEl.classList.remove("is-open");
    drawerEl.setAttribute("aria-hidden", "true");
    scrimEl.hidden = true;
  }

  /* ---------------- 检索建议 ---------------- */
  function renderSuggest() {
    var q = state.q.trim();
    if (!q) { hideSuggest(); return; }
    var rows = filtered().slice(0, 8);
    if (!rows.length) { hideSuggest(); return; }
    suggestEl.innerHTML = rows.map(function (d) {
      return '<button type="button" role="option" class="suggest-item" data-id="' + esc(d.id) + '">' +
        '<span class="si-name">' + esc(d.name) + "</span>" +
        '<span class="si-meta">' + esc(d.formula || "") + " · " + esc(d.category) + "</span></button>";
    }).join("");
    suggestEl.hidden = false;
    searchEl.setAttribute("aria-expanded", "true");
  }
  function hideSuggest() {
    suggestEl.hidden = true;
    searchEl.setAttribute("aria-expanded", "false");
  }
  function pick(id) {
    var item = byId(id);
    if (!item) return;
    hideSuggest();
    closeDrawer();
    setView("chain");
    select(item);
  }

  /* ---------------- 链路模型 ---------------- */
  function altGroup(item) {
    var f = normFormula(item.formula);
    if (!f) return [];
    return DATA.filter(function (d) {
      return d.id !== item.id && normFormula(d.formula) === f;
    });
  }

  function altSiblings(item) {
    var f = normFormula(item.formula);
    if (!f) return [item];
    return DATA.filter(function (d) { return normFormula(d.formula) === f; });
  }

  function layout(item) {
    var reagents = (item.reagents || []).slice(0, 9);
    var steps = (item.steps || []).slice(0, 7);
    var models = [];
    var canvasW = Math.max(BASE_W, 320 + steps.length * COL + 190);

    var cols = reagents.length > 4 ? 2 : 1;
    var rows = cols === 2 ? Math.ceil(reagents.length / 2) : Math.max(1, reagents.length);
    var tileGap = 112;
    var refTop = CY - ((rows - 1) * tileGap) / 2 - TILE / 2;
    reagents.forEach(function (r, i) {
      var col = cols === 2 ? Math.floor(i / Math.ceil(reagents.length / 2)) : 0;
      var row = cols === 2 ? i % Math.ceil(reagents.length / 2) : i;
      models.push({ kind: "reagent", text: r, x: 26 + col * 118, y: refTop + row * tileGap });
    });

    var pillX = cols === 2 ? 278 : 210;
    steps.forEach(function (s, i) {
      models.push({ kind: "step", text: s, x: pillX + i * COL, y: CY - PILL_H / 2, i: i });
    });

    models.push({ kind: "product", item: item, x: pillX + steps.length * COL, y: CY - TILE / 2 });
    return { models: models, w: canvasW, h: 560, pillX: pillX };
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function stepIcon(word) {
    var icons = {
      "过滤": '<path d="M4 4h12l-4 6v4H8v-4Z"/><path d="M8 15h4"/>',
      "结晶": '<path d="M10 2 14 8l-4 6-4-6Z"/><path d="M4 15h12"/>',
      "蒸发浓缩": '<path d="M4 15V8l4-4h4l4 4v7Z"/><path d="M8 5v3"/>',
      "加热": '<path d="M7 13c-2-2-2-5 0-7 1 2 2 2 3 0 1 3 3 4 3 7a3 3 0 0 1-6 0Z"/>',
      "灼烧": '<path d="M4 16 10 3l6 13Z"/><path d="M8 12h4"/>',
      "电解": '<path d="M3 4h4v12H3zM13 4h4v12h-4z"/><path d="M7 10h6"/>',
      "蒸馏": '<path d="M4 15V8l4-4h4l4 4v7Z"/><path d="M8 4v4"/>',
      "萃取": '<path d="M4 4h5l7 12H9Z"/><path d="M9 4h7"/>',
      "混合": '<circle cx="7" cy="7" r="3"/><circle cx="13" cy="12" r="3"/>',
      "干燥": '<path d="M10 3v8M6 7l4 4 4-4"/><path d="M4 15h12"/>',
      "沉淀": '<path d="M5 4h10l-2 8H7Z"/><circle cx="6" cy="15" r="1.5"/><circle cx="12" cy="16" r="1"/>'
    };
    return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">' + (icons[word] || '<path d="M10 3v14M4 10h12"/>') + "</svg>";
  }

  function reagentGlyph(text) {
    var role = roleOf(text);
    var shapes = {
      "酸": '<path d="M52 24h36v14L74 60v30H66V60L52 38Z" fill="currentColor" opacity=".18"/><path d="M52 24h36v14L74 60v30H66V60L52 38Z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M58 70h24" stroke="currentColor" stroke-width="3"/>',
      "碱": '<rect x="48" y="28" width="44" height="58" rx="8" fill="currentColor" opacity=".18"/><rect x="48" y="28" width="44" height="58" rx="8" fill="none" stroke="currentColor" stroke-width="3"/><path d="M58 46h24M58 58h24" stroke="currentColor" stroke-width="3"/>',
      "氧化剂": '<circle cx="70" cy="56" r="24" fill="currentColor" opacity=".18"/><circle cx="70" cy="56" r="24" fill="none" stroke="currentColor" stroke-width="3"/><path d="M70 40v18M70 74h.01" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
      "还原剂": '<path d="M48 76 70 34l22 42Z" fill="currentColor" opacity=".18"/><path d="M48 76 70 34l22 42Z" fill="none" stroke="currentColor" stroke-width="3"/>',
      "催化剂": '<path d="M56 34h28M56 76h28M60 34v42M80 34v42" stroke="currentColor" stroke-width="3"/><circle cx="60" cy="56" r="4" fill="currentColor"/><circle cx="80" cy="56" r="4" fill="currentColor"/>',
      "指示剂": '<path d="M62 28h16v44l10 8v14H52V80l10-8Z" fill="currentColor" opacity=".18"/><path d="M62 28h16v44l10 8v14H52V80l10-8Z" fill="none" stroke="currentColor" stroke-width="3"/>',
      "沉淀剂": '<path d="M56 30h28l-6 40a8 8 0 0 1-8 7h-2a8 8 0 0 1-8-7Z" fill="currentColor" opacity=".18"/><path d="M56 30h28l-6 40a8 8 0 0 1-8 7h-2a8 8 0 0 1-8-7Z" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="66" cy="86" r="4" fill="currentColor"/><circle cx="78" cy="88" r="3" fill="currentColor"/>'
    };
    return '<svg viewBox="0 0 140 110" aria-hidden="true">' + (shapes[role] || '<path d="M52 44h36v30a10 10 0 0 1-10 10H62a10 10 0 0 1-10-10Z" fill="currentColor" opacity=".18"/><path d="M52 44h36v30a10 10 0 0 1-10 10H62a10 10 0 0 1-10-10Z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M60 26v18M80 26v18" stroke="currentColor" stroke-width="3"/>') + "</svg>";
  }

  function shortReagent(text) {
    return String(text).replace(/（[^）]*）/g, "").replace(/\([^)]*\)/g, "").split(/[，,]/)[0].slice(0, 10);
  }

  function nodeEl(m) {
    var n;
    if (m.kind === "step") {
      n = el("button", "chain-machine is-step");
      n.type = "button";
      n.innerHTML = '<span class="machine-ico">' + stepIcon(stepWord(m.text)) + "</span>" +
        '<span class="machine-body"><small>STEP ' + String(m.i + 1).padStart(2, "0") + "</small><b>" + esc(stepWord(m.text)) + "</b></span>" +
        '<span class="machine-mark">' + (m.i + 1) + "</span>";
      n.title = m.text;
      n.setAttribute("aria-label", "工序 " + (m.i + 1) + "：" + m.text);
      n.addEventListener("click", function () { if (window.ChemLab) window.ChemLab.openDetail("p", productOf(m).id); });
    } else if (m.kind === "product") {
      n = el("button", "chain-tile is-product");
      n.type = "button";
      var siblingAlts = altSiblings(m.item);
      n.innerHTML = '<span class="tile-frame">' + (window.CHEMLAB_ART ? window.CHEMLAB_ART.icon(m.item, "p") : "") + "</span>" +
        '<span class="tile-name">' + esc(coreName(m.item.name)) + "</span>" +
        (siblingAlts.length > 1 ? '<span class="tile-alt">其他配方 ' + (siblingAlts.length - 1) + " ↔</span>" : "");
      n.title = "查看 " + m.item.name + " 的完整制法" + (siblingAlts.length > 1 ? "（金色胶囊可切换其他配方）" : "");
      n.setAttribute("aria-label", m.item.name + "，产物，点击查看制法");
      n.addEventListener("click", function () { if (window.ChemLab) window.ChemLab.openDetail("p", m.item.id); });
      var altBadge = n.querySelector(".tile-alt");
      if (altBadge) {
        altBadge.addEventListener("click", function (e) {
          e.stopPropagation();
          var list = altSiblings(m.item);
          var idx = list.map(function (d) { return d.id; }).indexOf(m.item.id);
          select(list[(idx + 1) % list.length]);
        });
      }
    } else {
      n = el("div", "chain-tile is-reagent");
      n.innerHTML = '<span class="tile-frame is-plain">' + reagentGlyph(m.text) + "</span>" +
        '<span class="tile-name">' + esc(shortReagent(m.text)) + "</span>";
      n.title = m.text;
      n.setAttribute("aria-label", "原料：" + m.text);
    }
    n.style.left = m.x + "px";
    n.style.top = m.y + "px";
    return n;
  }

  var current = null;
  function productOf() { return current; }

  function curve(x1, y1, x2, y2) {
    if (Math.abs(y1 - y2) < 2) return "M" + x1 + " " + y1 + " H" + x2;
    var mid = x1 + (x2 - x1) / 2;
    return "M" + x1 + " " + y1 + " H" + mid + " V" + y2 + " H" + x2;
  }

  function render(item) {
    current = item;
    var L = layout(item);
    canvas.style.width = L.w + "px";
    canvas.style.height = L.h + "px";

    var old = canvas.querySelectorAll(".chain-node");
    for (var i = 0; i < old.length; i++) old[i].remove();
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var defs = document.createElementNS(SVG_NS, "defs");
    var marker = document.createElementNS(SVG_NS, "marker");
    marker.setAttribute("id", "chain-arrow");
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refX", "8");
    marker.setAttribute("refY", "5");
    marker.setAttribute("markerWidth", "6");
    marker.setAttribute("markerHeight", "6");
    marker.setAttribute("orient", "auto-start-reverse");
    var arrow = document.createElementNS(SVG_NS, "path");
    arrow.setAttribute("d", "M0 0 10 5 0 10z");
    arrow.setAttribute("fill", "#87938f");
    marker.appendChild(arrow);
    defs.appendChild(marker);
    svg.appendChild(defs);

    L.models.forEach(function (m) {
      var node = nodeEl(m);
      node.classList.add("chain-node");
      canvas.appendChild(node);
    });

    var reagents = L.models.filter(function (m) { return m.kind === "reagent"; });
    var steps = L.models.filter(function (m) { return m.kind === "step"; });
    var prod = L.models.filter(function (m) { return m.kind === "product"; })[0];
    var edges = [];

    reagents.forEach(function (m) { edges.push([m.x + TILE, m.y + TILE / 2, L.pillX, CY]); });
    steps.forEach(function (m, i) {
      var target = i < steps.length - 1 ? steps[i + 1].x : prod.x;
      edges.push([m.x + PILL_W, m.y + PILL_H / 2, target, CY]);
    });

    edges.forEach(function (e) {
      var p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("class", "chain-edge");
      p.setAttribute("d", curve(e[0], e[1], e[2], e[3]));
      p.setAttribute("marker-end", "url(#chain-arrow)");
      svg.appendChild(p);
    });
  }

  function renderInfo(item) {
    var alts = altGroup(item);
    titleEl.textContent = item.name;
    subEl.textContent = item.summary;
    kickerEl.textContent = fileCode(item) + " / " + item.category;
    crumbEl.textContent = item.name;
    document.title = item.name + " · 制造链路 | 化境 ChemLab";

    metaEl.innerHTML =
      '<span class="meta-pill">' + esc(item.formula || "—") + "</span>" +
      '<span class="meta-pill hz-' + item.hazard + '">' + riskLabel(item.hazard) + " · 风险 " + item.hazard + "</span>" +
      '<span class="meta-pill">' + (item.steps || []).length + " 道工序</span>" +
      (alts.length ? '<button class="alt-pill" type="button" id="chain-alt">其他配方 ' + alts.length + " ↔</button>" : "");

    var altBtn = document.getElementById("chain-alt");
    if (altBtn) {
      altBtn.addEventListener("click", function () {
        var list = altSiblings(item);
        if (list.length < 2) return;
        var idx = list.map(function (d) { return d.id; }).indexOf(item.id);
        select(list[(idx + 1) % list.length]);
      });
    }

    rolesEl.innerHTML = (item.reagents || []).map(function (r) {
      return '<span class="role-chip">' + esc(roleOf(r)) + "<b>" + esc(shortReagent(r)) + "</b></span>";
    }).join("");

    stepsEl.innerHTML = (item.steps || []).map(function (s, i) {
      return '<li><span class="step-n">' + String(i + 1).padStart(2, "0") + "</span><span>" + esc(s) + "</span></li>";
    }).join("") || '<li class="steps-empty">这条制法暂无步骤记录。</li>';

    emptyEl.hidden = true;
  }

  function select(item) {
    if (state.view === "salt") setView("chain");
    state.active = item.id;
    render(item);
    renderInfo(item);
    renderDrawer();
    try { history.replaceState(null, "", "#p/" + item.id); } catch (e) {}
  }

  function selectById(id) {
    var item = byId(id);
    if (item) { select(item); return true; }
    return false;
  }

  function applyZoom() {
    zoomEl.value = String(state.zoom);
    zoomVal.textContent = state.zoom + "%";
    canvas.style.zoom = state.zoom / 100;
    try { localStorage.setItem(STORE_KEY, String(state.zoom)); } catch (e) {}
  }

  /* ---------------- 盐类离子检索表 ---------------- */
  var CATION_ORDER = ["H⁺", "Li⁺", "Na⁺", "K⁺", "NH₄⁺", "Mg²⁺", "Ca²⁺", "Sr²⁺", "Ba²⁺", "Al³⁺", "Cr³⁺", "Mn²⁺", "Fe²⁺", "Fe³⁺", "Co²⁺", "Ni²⁺", "Cu⁺", "Cu²⁺", "Zn²⁺", "Ag⁺", "Pb²⁺", "Sn²⁺"];
  var ANION_ORDER = ["Cl⁻", "Br⁻", "I⁻", "NO₃⁻", "SO₄²⁻", "HSO₄⁻", "CO₃²⁻", "HCO₃⁻", "PO₄³⁻", "HPO₄²⁻", "H₂PO₄⁻", "SiO₃²⁻", "S₂O₃²⁻", "SO₃²⁻", "MnO₄⁻", "ClO₃⁻", "IO₃⁻", "Cr₂O₇²⁻", "S²⁻", "C₂O₄²⁻"];

  function saltData() {
    return DATA.filter(function (d) { return d.category === "盐" && d.ions && d.ions.length === 2; });
  }

  /*
   * 离子交叉表只给“常见离子”开行列：对应盐少于 RARE_MIN 种的离子
   * 不单独占行列，相关盐统一收进下方的“少量离子盐类”。
   */
  var RARE_MIN = 2;

  function ionCounts(list, index) {
    var counts = {};
    list.forEach(function (d) {
      var ion = d.ions[index];
      counts[ion] = (counts[ion] || 0) + 1;
    });
    return counts;
  }

  function mainAxis(counts, order) {
    var out = order.filter(function (x) { return (counts[x] || 0) >= RARE_MIN; });
    Object.keys(counts).sort().forEach(function (x) {
      if (counts[x] >= RARE_MIN && out.indexOf(x) === -1) out.push(x);
    });
    return out;
  }

  function splitSalts(list) {
    var rows = mainAxis(ionCounts(list, 0), CATION_ORDER);
    var cols = mainAxis(ionCounts(list, 1), ANION_ORDER);
    var main = [];
    var rare = [];
    list.forEach(function (d) {
      if (rows.indexOf(d.ions[0]) !== -1 && cols.indexOf(d.ions[1]) !== -1) main.push(d);
      else rare.push(d);
    });
    return { rows: rows, cols: cols, main: main, rare: rare };
  }

  function matchSalt(d, q) {
    if (!q) return true;
    return [d.name, d.formula, d.ions[0], d.ions[1]].join(" ").toLowerCase().indexOf(q) !== -1;
  }

  function renderSaltRare(list) {
    if (!saltRare || !saltRareList) return;
    saltRare.hidden = !list.length;
    saltRareList.innerHTML = list.map(function (d) {
      return '<button type="button" class="salt-chip" data-id="' + esc(d.id) + '">' +
        "<b>" + esc(d.formula || "—") + "</b><span>" + esc(d.name) + "</span></button>";
    }).join("");
  }

  function markSalt(cation, anion, id) {
    var cells = saltTable.querySelectorAll(".salt-cell.is-active");
    for (var i = 0; i < cells.length; i++) cells[i].classList.remove("is-active");
    var chips = saltRareList ? saltRareList.querySelectorAll(".salt-chip.is-active") : [];
    for (var j = 0; j < chips.length; j++) chips[j].classList.remove("is-active");
    var hit = null;
    var all = saltTable.querySelectorAll(".salt-cell");
    for (var k = 0; k < all.length; k++) {
      if (all[k].dataset.c === cation && all[k].dataset.a === anion) { hit = all[k]; break; }
    }
    if (hit) hit.classList.add("is-active");
    if (saltRareList && id) {
      var chip = saltRareList.querySelector('.salt-chip[data-id="' + id + '"]');
      if (chip) chip.classList.add("is-active");
    }
  }

  function renderSaltTable() {
    var salts = saltData();
    var q = state.q.trim().toLowerCase();
    var visible = salts.filter(function (d) { return matchSalt(d, q); });
    var split = splitSalts(salts);
    var rows = split.rows;
    var cols = split.cols;
    var rareVisible = split.rare.filter(function (d) { return matchSalt(d, q); });
    var cells = {};
    visible.forEach(function (d) {
      var key = d.ions[0] + "|" + d.ions[1];
      (cells[key] = cells[key] || []).push(d);
    });
    if (saltCount) saltCount.textContent = salts.length;
    if (saltMainCount) saltMainCount.textContent = split.main.length;
    if (saltRareCount) saltRareCount.textContent = split.rare.length;
    renderSaltRare(rareVisible);

    if (!visible.length) {
      saltTable.innerHTML = '<tbody><tr><td class="salt-none">没有匹配的盐，换个阳离子或阴离子试试。</td></tr></tbody>';
      return;
    }
    var html = '<thead><tr><th class="salt-corner" scope="col">阳离子 \\ 阴离子</th>';
    cols.forEach(function (a) { html += '<th scope="col">' + esc(a) + "</th>"; });
    html += "</tr></thead><tbody>";
    rows.forEach(function (c) {
      html += '<tr><th scope="row">' + esc(c) + "</th>";
      cols.forEach(function (a) {
        var list = cells[c + "|" + a];
        if (!list) { html += '<td class="salt-none">·</td>'; return; }
        var label = list.length > 1 ? list.length + " 法" : list[0].formula;
        var name = list.length > 1 ? list.map(function (d) { return d.name; }).join(" / ") : list[0].name;
        html += '<td><button type="button" class="salt-cell" data-c="' + esc(c) + '" data-a="' + esc(a) + '">' +
          "<b>" + esc(label) + "</b><small>" + esc(name) + "</small></button></td>";
      });
      html += "</tr>";
    });
    saltTable.innerHTML = html + "</tbody>";
  }

  function renderSaltChoices(list, cation, anion) {
    var options = list.map(function (d, i) {
      var stepCount = (d.steps || []).length;
      return '<button type="button" class="salt-choice" data-pick="' + esc(d.id) + '">' +
        '<span class="pick-no">' + String(i + 1).padStart(2, "0") + "</span>" +
        '<span class="pick-body">' +
          "<b>" + esc(d.name) + "</b>" +
          '<small>' + esc(d.formula || "—") + " · " + riskLabel(d.hazard) + " · " + stepCount + " 道工序</small>" +
          '<em>' + esc(d.summary || "") + "</em>" +
        "</span>" +
        '<span class="pick-go">看流程图 →</span>' +
      "</button>";
    }).join("");
    saltResult.innerHTML =
      '<div class="salt-result-head">' +
        '<span class="salt-kicker">' + esc(cation) + " × " + esc(anion) + "</span>" +
        "<h3>选择制法</h3>" +
        "<p>同一格有 " + list.length + " 条制法，选一条查看它的制造流程图。</p>" +
      "</div>" +
      '<div class="salt-choice-list">' + options + "</div>";
  }

  function openSalt(cation, anion) {
    var list = saltData().filter(function (d) { return d.ions[0] === cation && d.ions[1] === anion; });
    if (!list.length) return;
    markSalt(cation, anion, list.length === 1 ? list[0].id : null);
    if (list.length === 1) { select(list[0]); return; }
    renderSaltChoices(list, cation, anion);
    if (window.innerWidth < 920 && saltResult.scrollIntoView) {
      saltResult.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function openSaltById(id) {
    var item = byId(id);
    if (!item || !item.ions) return;
    markSalt(item.ions[0], item.ions[1], item.id);
    openSalt(item.ions[0], item.ions[1]);
  }

  function setView(mode) {
    state.view = mode;
    var salt = mode === "salt";
    if (saltView) saltView.hidden = !salt;
    if (stageSection) stageSection.hidden = salt;
    if (saltToggle) {
      saltToggle.setAttribute("aria-pressed", String(salt));
      saltToggle.classList.toggle("is-on", salt);
    }
    if (salt) renderSaltTable();
  }

  /*
   * 盐表事件：单元格 → 结果卡片 → 详情弹层
   */
  if (saltTable) {
    saltTable.addEventListener("click", function (e) {
      var cell = e.target.closest(".salt-cell");
      if (cell) openSalt(cell.dataset.c, cell.dataset.a);
    });
  }
  if (saltRareList) {
    saltRareList.addEventListener("click", function (e) {
      var chip = e.target.closest(".salt-chip");
      if (chip) openSaltById(chip.dataset.id);
    });
  }
  if (saltResult) {
    saltResult.addEventListener("click", function (e) {
      var pick = e.target.closest("[data-pick]");
      if (pick) { selectById(pick.dataset.pick); return; }
      var card = e.target.closest("[data-type][data-id]");
      if (card && window.ChemLab) window.ChemLab.openDetail(card.dataset.type, card.dataset.id);
    });
  }
  if (saltToggle) {
    saltToggle.addEventListener("click", function () {
      setView(state.view === "salt" ? "chain" : "salt");
    });
  }

  /* ---------------- 事件 ---------------- */
  catsEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".chip");
    if (!btn) return;
    state.cat = btn.dataset.cat;
    renderCats();
    renderDrawer();
    if (state.cat === "盐") {
      closeDrawer();
      setView("salt");
    } else {
      setView("chain");
      openDrawer();
    }
  });
  drawerHzEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".chip");
    if (!btn) return;
    state.hz = btn.dataset.hz;
    renderHz();
    renderDrawer();
  });
  searchEl.addEventListener("input", function () {
    state.q = searchEl.value;
    if (state.view === "salt") {
      hideSuggest();
      renderSaltTable();
      return;
    }
    renderDrawer();
    renderSuggest();
  });
  searchEl.addEventListener("focus", function () { if (state.q.trim()) renderSuggest(); });
  searchEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (state.view === "salt") {
        var q = state.q.trim().toLowerCase();
        var firstSalt = saltData().filter(function (d) { return matchSalt(d, q); })[0];
        if (firstSalt) openSaltById(firstSalt.id);
        return;
      }
      var first = filtered()[0];
      if (first) pick(first.id);
    } else if (e.key === "Escape") {
      hideSuggest();
    } else if (e.key === "ArrowDown" && !suggestEl.hidden) {
      e.preventDefault();
      var b = suggestEl.querySelector("button");
      if (b) b.focus();
    }
  });
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".chain-search") && !e.target.closest("#chain-suggest")) hideSuggest();
  });
  suggestEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-id]");
    if (b) pick(b.dataset.id);
  });
  drawerListEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-id]");
    if (b) pick(b.dataset.id);
  });
  folderBtn.addEventListener("click", openDrawer);
  if (emptyBtn) emptyBtn.addEventListener("click", openDrawer);
  drawerClose.addEventListener("click", closeDrawer);
  scrimEl.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && drawerEl.classList.contains("is-open")) closeDrawer();
    if (e.key === "/" && document.activeElement !== searchEl) { e.preventDefault(); searchEl.focus(); }
  });

  zoomEl.addEventListener("input", function () {
    state.zoom = parseInt(zoomEl.value, 10) || 50;
    applyZoom();
  });
  stage.addEventListener("wheel", function (e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    state.zoom = Math.min(100, Math.max(40, state.zoom + (e.deltaY < 0 ? 5 : -5)));
    applyZoom();
  }, { passive: false });

  var pan = null;
  stage.addEventListener("pointerdown", function (e) {
    if (e.target.closest(".chain-node") || e.target.closest("button")) return;
    pan = { x: e.clientX, y: e.clientY, left: stage.scrollLeft, top: stage.scrollTop };
    stage.classList.add("is-panning");
  });
  window.addEventListener("pointermove", function (e) {
    if (!pan) return;
    stage.scrollLeft = pan.left - (e.clientX - pan.x);
    stage.scrollTop = pan.top - (e.clientY - pan.y);
  });
  window.addEventListener("pointerup", function () {
    pan = null;
    stage.classList.remove("is-panning");
  });

  window.addEventListener("hashchange", function () {
    var m = /^#p\/(.+)$/.exec(location.hash);
    if (m) selectById(decodeURIComponent(m[1]));
  });

  /* ---------------- 启动 ---------------- */
  renderCats();
  renderHz();
  renderDrawer();
  try {
    var z = parseInt(localStorage.getItem(STORE_KEY), 10);
    if (z >= 40 && z <= 100) state.zoom = z;
  } catch (e) {}
  applyZoom();

  (function initItem() {
    var m = /^#p\/(.+)$/.exec(location.hash);
    if (m && selectById(decodeURIComponent(m[1]))) return;
    var pickDefault = DATA.filter(function (d) { return d.id === "copper-sulfate"; })[0] || DATA[0];
    if (pickDefault) select(pickDefault);
  })();
})();
