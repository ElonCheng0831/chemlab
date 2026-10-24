/* ============================================================
   化境 ChemLab — 交互脚本
   纯原生 JS，无依赖
   ============================================================ */
(function () {
  "use strict";

  /* ============================================================
     快捷录入：把 add-content.js 里的条目合并进站点数据
     ============================================================ */
  var ADDON_ERRORS = [];
  var ADDON_SOURCE = window.CHEMLAB_ADDONS;

  function hashId(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return Math.abs(h).toString(36);
  }

  function asList(value) {
    if (value == null || value === "") return [];
    if (Array.isArray(value)) {
      return value.map(function (v) { return String(v).trim(); }).filter(Boolean);
    }
    return String(value).split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function normalizeAddon(raw, kind, pos) {
    var label = kind === "p" ? "制法" : "实验";
    if (!raw || typeof raw !== "object") {
      ADDON_ERRORS.push("第 " + pos + " 条" + label + "不是对象，已跳过。");
      return null;
    }
    var name = String(raw.name || "").trim();
    if (!name) {
      ADDON_ERRORS.push("第 " + pos + " 条" + label + "缺少 name 字段，已跳过。");
      return null;
    }

    var id = String(raw.id || "").trim();
    if (!id) {
      id = "custom-" + (kind === "p" ? "p" : "e") + "-" + hashId(name);
    } else if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(id)) {
      var safeId = "custom-" + (kind === "p" ? "p" : "e") + "-" + hashId(name);
      ADDON_ERRORS.push("「" + name + "」的 id 只能用小写字母、数字和短横线，已自动改为 " + safeId + "。");
      id = safeId;
    }

    var hazard = parseInt(raw.hazard, 10);
    if (!(hazard >= 1 && hazard <= 3)) hazard = 1;

    var item = {
      id: id,
      name: name,
      category: String(raw.category || (kind === "p" ? "自定义制法" : "自定义实验")).trim(),
      hazard: hazard,
      duration: String(raw.duration || "").trim(),
      summary: String(raw.summary || raw.desc || "").trim(),
      principle: asList(raw.principle || raw.equations || raw.eq),
      reagents: asList(raw.reagents || raw.materials),
      apparatus: asList(raw.apparatus || raw.equipment || raw.tools),
      steps: asList(raw.steps || raw.procedure),
      observation: String(raw.observation || raw.phenomenon || "").trim(),
      conclusion: String(raw.conclusion || raw.note || "").trim(),
      cautions: asList(raw.cautions || raw.safety),
      tags: asList(raw.tags),
      custom: true
    };
    if (kind === "p") item.formula = String(raw.formula || "").trim();

    if (!item.steps.length) {
      ADDON_ERRORS.push("「" + name + "」没有 steps，条目仍会显示，但工单里没有操作步骤。");
    }
    if (!item.summary) {
      ADDON_ERRORS.push("「" + name + "」没有 summary，卡片摘要会留空。");
    }
    return item;
  }

  // 浏览器内的临时库：localStorage 中 chemlab-addons 键下的条目会在启动时合并，
  // 这样不用改磁盘文件也能在列表页看到（同样适用于 add-content.js 的本地手写条目）。
  function storedAddons() {
    try {
      var raw = localStorage.getItem("chemlab-addons");
      if (!raw) return null;
      var obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : null;
    } catch (e) {
      return null;
    }
  }

  function mergeAddons() {
    var stored = storedAddons();
    var sources = [];
    if (ADDON_SOURCE && typeof ADDON_SOURCE === "object") sources.push(ADDON_SOURCE);
    if (stored) sources.push(stored);
    if (!sources.length) return;

    var jobs = [
      ["preparations", "p", window.PREPARATIONS],
      ["experiments", "e", window.EXPERIMENTS]
    ];

    jobs.forEach(function (job) {
      var key = job[0];
      var kind = job[1];
      var target = job[2];
      if (!Array.isArray(target)) return;

      sources.forEach(function (source) {
        var incoming = source[key];
        if (!incoming || !incoming.length) return;

        incoming.forEach(function (raw, i) {
          var item = normalizeAddon(raw, kind, i + 1);
          if (!item) return;

          var duplicate = target.some(function (x) { return x.id === item.id; });
          if (duplicate) {
            var base = item.id;
            var n = 2;
            while (target.some(function (x) { return x.id === base + "-" + n; })) n++;
            item.id = base + "-" + n;
            ADDON_ERRORS.push("「" + item.name + "」的 id 与已有条目重复，已改用 " + item.id + "。");
          }
          target.push(item);
        });
      });
    });
  }

  mergeAddons();

  var PREP = window.PREPARATIONS || [];
  var EXP = window.EXPERIMENTS || [];
  var factoryMode = document.body.classList.contains("factory");
  var chainMode = document.body.classList.contains("chain-page");

  var HAZARD = {
    1: { label: "低危", cls: "hz-1" },
    2: { label: "中危", cls: "hz-2" },
    3: { label: "高危", cls: "hz-3" }
  };

  var DIFFICULTY = { 1: "基础", 2: "进阶", 3: "挑战" };

  function diffPill(item, type) {
    if (type !== "e") return "";
    var level = item.difficulty;
    if (!DIFFICULTY[level]) return "";
    return '<span class="diff diff-' + level + '">难度 ' + level + " · " + DIFFICULTY[level] + "</span>";
  }

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------------- 主题 ---------------- */
  var root = document.documentElement;

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    $$(".theme-toggle").forEach(function (btn) {
      btn.setAttribute("aria-label", theme === "dark" ? "切换到浅色模式" : "切换到深色模式");
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    });
  }

  function initTheme() {
    if (factoryMode || chainMode) return; // 工厂页与链路页固定主题，不提供明暗切换
    var stored = null;
    try { stored = localStorage.getItem("chemlab-theme"); } catch (e) { /* 隐私模式 */ }
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(stored || (prefersDark ? "dark" : "light"));

    $$(".theme-toggle").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
        applyTheme(next);
        try { localStorage.setItem("chemlab-theme", next); } catch (e) { /* ignore */ }
      });
    });
  }

  /* ---------------- 导航 ---------------- */
  function initNav() {
    var nav = $(".nav");
    var toggle = $(".nav-toggle");
    var links = $(".nav-links");

    var onScroll = function () {
      if (!nav) return;
      nav.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    if (toggle && links) {
      toggle.addEventListener("click", function () {
        var open = links.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
      $$("a", links).forEach(function (a) {
        a.addEventListener("click", function () {
          links.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
        });
      });
    }
  }

  /* ---------------- 入场动画 ---------------- */
  var io = null;

  function observeReveals() {
    var els = $$(".reveal:not(.is-in)");
    if (!els.length) return;

    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }

    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
    }

    els.forEach(function (el) {
      var box = el.getBoundingClientRect();
      if (box.top < window.innerHeight * 0.96) {
        el.classList.add("is-in");
      } else {
        io.observe(el);
      }
    });
  }

  /* ---------------- 卡片 ---------------- */
  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';

  function cardHTML(item, type) {
    if (factoryMode) return factoryCardHTML(item, type);
    var hz = HAZARD[item.hazard] || HAZARD[1];
    var tags = (item.tags || []).map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("");
    var diff = diffPill(item, type);
    var firstEq = (item.principle && item.principle[0]) || "";
    var artIcon = window.CHEMLAB_ART ? '<div class="card-figure" aria-hidden="true">' + window.CHEMLAB_ART.icon(item, type) + "</div>" : "";

    return (
      '<article class="card reveal" role="button" tabindex="0" data-type="' + type + '" data-id="' + esc(item.id) + '">' +
        '<div class="card-top">' +
          '<span class="cat">' + esc(item.category) + "</span>" +
          '<span class="hz ' + hz.cls + '">' + hz.label + "</span>" +
        "</div>" +
        artIcon +
        "<h3>" + esc(item.name) + "</h3>" +
        (firstEq ? '<div class="eq">' + esc(firstEq) + "</div>" : "") +
        '<p class="desc">' + esc(item.summary) + "</p>" +
        '<div class="tags">' + diff + tags + "</div>" +
        '<div class="foot"><span>查看详情</span>' + ARROW + "</div>" +
      "</article>"
    );
  }

  /* ---------------- 工厂皮肤（仅 preparations.html） ---------------- */
  var CAT_CODE = {
    "气体": "GAS",
    "无机盐": "SALT",
    "无机物": "INORG",
    "有机物": "ORG",
    "试剂配制": "SOLN",
    "基础操作": "OPS",
    "物质性质": "PROP",
    "电化学": "ELEC",
    "趣味演示": "DEMO",
    "有机": "ORG",
    "分离提纯": "SEP",
    "定量测量": "QUANT",
    "自定义制法": "CUSTOM",
    "自定义实验": "CUSTOM"
  };

  function pad(n, len) {
    var s = String(n);
    while (s.length < len) s = "0" + s;
    return s;
  }

  function fileCode(item, type) {
    var list = type === "p" ? PREP : EXP;
    var i = list.indexOf(item);
    return (type === "p" ? "PRP-" : "EXP-") + pad(i < 0 ? 0 : i + 1, 3);
  }

  function shortDuration(value) {
    var s = String(value || "").trim();
    if (!s) return "";
    return s.replace(/\s*分钟\s*$/, " MIN")
      .replace(/\s*小时\s*$/, " HR")
      .replace(/\s*天\s*$/, " DAY")
      .replace(/\s*秒\s*$/, " SEC")
      .toUpperCase();
  }

  function factoryCardHTML(item, type) {
    var hz = HAZARD[item.hazard] || HAZARD[1];
    var blocks = "";
    for (var i = 1; i <= 3; i++) blocks += '<i class="' + (i <= item.hazard ? "on" : "") + '"></i>';
    var third = item.duration
      ? { k: "TIME", v: shortDuration(item.duration) }
      : { k: "TAGS", v: pad((item.tags || []).length, 2) };

    return (
      '<article class="fx-card reveal" role="button" tabindex="0" data-type="' + type + '" data-id="' + esc(item.id) + '">' +
        '<div class="fx-card-head">' +
          '<span class="fx-code">' + fileCode(item, type) + "</span>" +
          '<span class="fx-cat">' + esc(CAT_CODE[item.category] || "PROC") + "</span>" +
          '<span class="fx-blocks ' + hz.cls + '" title="危害等级 ' + item.hazard + ' / 3">' + blocks + "</span>" +
        "</div>" +
        '<div class="fx-card-title">' +
          "<h3>" + esc(item.name) + "</h3>" +
          (item.formula ? "<small>" + esc(item.formula) + "</small>" : "") +
        "</div>" +
        '<p class="fx-card-desc">' + esc(item.summary || "尚未填写摘要。") + "</p>" +
        '<dl class="fx-specs">' +
          "<div><dt>STEPS</dt><dd>" + pad((item.steps || []).length, 2) + "</dd></div>" +
          "<div><dt>RISK</dt><dd>" + pad(item.hazard, 2) + "</dd></div>" +
          "<div><dt>" + third.k + "</dt><dd>" + third.v + "</dd></div>" +
        "</dl>" +
        '<div class="fx-card-foot"><span>OPEN WORK ORDER</span>' + ARROW + "</div>" +
      "</article>"
    );
  }

  function bindCards(scope) {
    $$("[data-type][data-id]", scope).forEach(function (card) {
      if (card.dataset.bound === "1") return;
      card.dataset.bound = "1";
      card.addEventListener("click", function () {
        openDetail(card.dataset.type, card.dataset.id);
      });
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          openDetail(card.dataset.type, card.dataset.id);
        }
      });
    });
  }

  /* ---------------- 详情弹层 ---------------- */
  var dialog = null;

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.className = "sheet";
    dialog.setAttribute("aria-labelledby", "sheet-title");
    dialog.innerHTML =
      '<div class="sheet-shell">' +
        '<div class="sheet-head"><div class="sheet-title-wrap"></div>' +
          '<button class="sheet-close" type="button" aria-label="关闭">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
          "</button>" +
        "</div>" +
        '<div class="sheet-body"></div>' +
      "</div>";

    dialog.addEventListener("click", function (e) {
      if (e.target === dialog || e.target.closest(".sheet-close")) closeDetail();
    });

    dialog.addEventListener("close", function () {
      document.body.style.overflow = "";
      if (location.hash.indexOf("#p/") === 0 || location.hash.indexOf("#e/") === 0) {
        try {
          history.replaceState(null, "", location.pathname + location.search);
        } catch (e) { /* file:// 下部分浏览器禁止改写历史 */ }
      }
    });

    document.body.appendChild(dialog);
    return dialog;
  }

  /* ------------------------------------------------------------------
     原料用途标注：把“这个药品在制法里干什么”说清楚。
     优先读取条目自带的 reagentRoles（键名可用原料名的片段），
     没有时按名称关键词推断，最后回退为“反应原料”。
     ------------------------------------------------------------------ */
  var ROLE_RULES = [
    [/催化剂|催化|酶|五氧化二钒/, "催化剂", "降低反应活化能、加快反应速率，本身的质量和化学性质在反应前后基本不变"],
    [/浓硫酸|五氧化二磷|无水氯化钙|无水硫酸铜/, "脱水剂/干燥剂", "吸收体系中的水或夺取有机物中的水，促使反应向生成物方向进行"],
    [/高锰酸钾|重铬酸钾|双氧水|过氧化氢|次氯酸钠|漂白粉|氯气|溴水|溴单质|硝酸|氧气|空气|臭氧/, "氧化剂", "得到电子，把另一种物质氧化，自身被还原"],
    [/氢气|一氧化碳|碳粉|木炭|活性炭|锌|铁粉|铝粉|镁|金属钠|金属钾|亚硫酸钠|硫代硫酸钠|草酸|葡萄糖|维生素C|锡/, "还原剂", "失去电子，把另一种物质还原，自身被氧化"],
    [/盐酸|硫酸|硝酸|磷酸|硼酸|醋酸|乙酸|柠檬酸|酒石酸|甲酸|氢溴酸|氢碘酸/, "酸/酸化剂", "提供 H⁺，调节体系酸度或参与复分解、置换反应"],
    [/氢氧化钠|氢氧化钾|氢氧化钙|氨水|碳酸钠|碳酸氢钠|熟石灰|石灰水|氧化钙/, "碱/沉淀剂", "提供 OH⁻ 或 CO₃²⁻，中和酸、沉淀金属离子"],
    [/硝酸银|氯化钡|硫酸铜|硫化钠|草酸铵|磷酸氢二钠|碳酸铵/, "沉淀剂", "与目标离子生成难溶物，用于分离、提纯或检验"],
    [/蒸馏水|去离子水|乙醇|乙醚|丙酮|甲苯|四氯化碳|石油醚|乙酸乙酯|正己烷|甘油/, "溶剂", "溶解反应物，使反应物充分接触并控制反应速率"],
    [/酚酞|石蕊|甲基橙|淀粉|碘液|指示剂|品红/, "指示剂", "通过颜色变化指示酸碱性或滴定终点"],
    [/EDTA|硫氰化钾|柠檬酸|氨水/, "络合剂", "与金属离子形成配合物，用于掩蔽、显色或滴定"],
    [/氮气|氩气|氦气/, "保护气", "隔绝空气和水汽，防止产物被氧化或水解"],
    [/石墨|铂|铜片|铁片|锌片|电极/, "电极", "导电并作为电化学反应的界面"],
    [/冰晶石|助熔剂/, "助熔剂", "降低熔融温度、提高熔体导电性"]
  ];

  function reagentRole(name, item) {
    var text = String(name || "");
    if (item && item.reagentRoles) {
      for (var key in item.reagentRoles) {
        if (Object.prototype.hasOwnProperty.call(item.reagentRoles, key) && text.indexOf(key) !== -1) {
          return { tag: item.reagentRoles[key], why: "在本条制法中：" + item.reagentRoles[key] };
        }
      }
    }
    for (var i = 0; i < ROLE_RULES.length; i++) {
      if (ROLE_RULES[i][0].test(text)) {
        return { tag: ROLE_RULES[i][1], why: ROLE_RULES[i][2] };
      }
    }
    return { tag: "反应原料", why: "提供目标产物所需的元素或基团，是构成产物的主体" };
  }

  function detailHTML(item, type) {
    var hz = HAZARD[item.hazard] || HAZARD[1];
    var out = [];

    if (factoryMode) {
      out.push(
        '<div class="fx-dossier">' +
          "<div><span>FILE</span><b>" + fileCode(item, type) + "</b></div>" +
          "<div><span>CLASS</span><b>" + esc(CAT_CODE[item.category] || "PROC") + "</b></div>" +
          '<div><span>RISK</span><b class="' + hz.cls + '">' + pad(item.hazard, 2) + " / 03 · " + hz.label + "</b></div>" +
          "<div><span>STEPS</span><b>" + pad((item.steps || []).length, 2) + "</b></div>" +
        "</div>"
      );
    }

    if (item.hazard === 3) {
      out.push(
        '<div class="callout callout-warn">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>' +
          '<div class="callout-text"><strong>高危实验。</strong> 以下内容仅用于教学认知与安全培训，必须在具备资质的实验室由专业人员操作。严禁在家中、宿舍或任何非专业场所尝试，严禁用于制造爆炸物、毒品或其他违法用途。</div>' +
        "</div>"
      );
    } else if (item.hazard === 2) {
      out.push(
        '<div class="callout callout-ok">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>' +
          '<div class="callout-text"><strong>需在教师或实验员指导下完成。</strong> 请佩戴护目镜，必要时使用通风橱，并提前阅读安全数据表（SDS）。</div>' +
        "</div>"
      );
    }

    out.push(
      '<div class="block"><h4>实验原理</h4><div class="eqs">' +
        (item.principle || []).map(function (eq) { return '<div class="eqline">' + esc(eq) + "</div>"; }).join("") +
      "</div></div>"
    );

    out.push(
      '<div class="block"><h4>试剂与仪器</h4><div class="two-col">' +
        '<div><ul class="list-plain reagent-list">' + (item.reagents || []).map(function (r) {
          var role = reagentRole(r, item);
          return '<li class="reagent-item"><span class="reagent-name">' + esc(r) +
            '</span><span class="role-tag" title="' + esc(role.why) + '">' +
            esc(role.tag) + "</span></li>";
        }).join("") + "</ul></div>" +
        '<div><ul class="list-plain">' + (item.apparatus || []).map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul></div>" +
      "</div></div>"
    );

    if (window.CHEMLAB_ART) {
      out.push(
        '<div class="block art-block"><h4>操作图解</h4>' +
          window.CHEMLAB_ART.figure(item, type) +
        "</div>"
      );
    }

    out.push(
      '<div class="block"><h4>操作步骤</h4><ol class="steps">' +
        (item.steps || []).map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") +
      "</ol></div>"
    );

    if (item.observation) {
      out.push('<div class="block"><h4>实验现象</h4><p class="body-text">' + esc(item.observation) + "</p></div>");
    }

    var conclude = item.conclusion || "";
    if (conclude) {
      out.push('<div class="block"><h4>结论与说明</h4><p class="body-text">' + esc(conclude) + "</p></div>");
    }

    if (item.uses && item.uses.length) {
      out.push(
        '<div class="block"><h4>主要用途</h4><ul class="list-plain uses-list">' +
          item.uses.map(function (u) { return "<li>" + esc(u) + "</li>"; }).join("") +
        "</ul></div>"
      );
    }

    if (item.cautions && item.cautions.length) {
      out.push(
        '<div class="block"><h4>注意事项</h4><ul class="list-plain">' +
          item.cautions.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") +
        "</ul></div>"
      );
    }

    return out.join("");
  }

  function openDetail(type, id) {
    var list = type === "p" ? PREP : EXP;
    var item = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { item = list[i]; break; }
    }
    if (!item) return;

    var d = ensureDialog();
    var hz = HAZARD[item.hazard] || HAZARD[1];
    d.classList.toggle("is-factory", factoryMode);

    var titleLead = "";
    if (factoryMode) {
      titleLead =
        '<div class="fx-file"><span>' + fileCode(item, type) + "</span>" +
          "<em>" + esc(CAT_CODE[item.category] || "PROC") + "</em>" +
          (item.hazard === 3 ? "<i>CAUTION // HIGH RISK</i>" : "") +
        "</div>";
    }

    $(".sheet-title-wrap", d).innerHTML = titleLead +
      '<h3 id="sheet-title">' + esc(item.name) + "</h3>" +
      (item.formula ? '<div class="sub">' + esc(item.formula) + "</div>" : "") +
      '<div class="meta">' +
        '<span class="cat">' + esc(item.category) + "</span>" +
        '<span class="hz ' + hz.cls + '">' + hz.label + "</span>" +
        (item.duration ? '<span class="cat">' + esc(item.duration) + "</span>" : "") +
        diffPill(item, type) +
      "</div>";

    $(".sheet-body", d).innerHTML = detailHTML(item, type);

    document.body.style.overflow = "hidden";
    if (typeof d.showModal === "function") {
      if (!d.open) d.showModal();
    } else {
      d.setAttribute("open", "");
    }

    var newHash = "#" + type + "/" + item.id;
    if (location.hash !== newHash) {
      try {
        history.replaceState(null, "", newHash);
      } catch (e) { /* ignore */ }
    }
    $(".sheet-body", d).scrollTop = 0;
  }

  function closeDetail() {
    if (!dialog || !dialog.open) return;
    if (typeof dialog.close === "function") dialog.close();
    else {
      dialog.removeAttribute("open");
      document.body.style.overflow = "";
    }
  }

  function initDeepLink() {
    if (chainMode) return; // 链路页由 chain.js 负责 #p/ 定位，避免自动弹出工单
    var hash = location.hash || "";
    var match = hash.match(/^#([pe])\/([a-z0-9-]+)$/i);
    if (match) openDetail(match[1].toLowerCase(), match[2]);
  }

  /* ---------------- 列表页 ---------------- */
  function initListPage(config) {
    var grid = $(config.grid);
    if (!grid) return;

    var data = config.data;
    var state = { q: "", cat: "all", hazard: "all" };

    var chipsCat = $(config.catChips);
    var chipsHz = $(config.hazardChips);
    var search = $(config.search);
    var note = $(config.note);

    function uniq(arr) {
      var seen = {};
      return arr.filter(function (v) {
        if (!v || seen[v]) return false;
        seen[v] = true;
        return true;
      });
    }

    function buildCatChips() {
      if (!chipsCat) return;
      var cats = ["all"].concat(uniq(data.map(function (d) { return d.category; })));
      var counts = {};
      data.forEach(function (d) { counts[d.category] = (counts[d.category] || 0) + 1; });

      chipsCat.innerHTML = cats.map(function (c) {
        return '<button class="chip" type="button" data-cat="' + esc(c) + '" aria-pressed="' + (c === "all") + '">' +
          (c === "all" ? "全部" : esc(c)) +
          (config.counts ? '<b class="chip-n">' + (c === "all" ? data.length : counts[c] || 0) + "</b>" : "") +
        "</button>";
      }).join("");

      chipsCat.addEventListener("click", function (e) {
        var btn = e.target.closest(".chip");
        if (!btn) return;
        state.cat = btn.dataset.cat;
        $$(".chip", chipsCat).forEach(function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        render();
      });
    }

    function buildHzChips() {
      if (!chipsHz) return;
      var opts = [["all", "全部风险"], ["1", "低危"], ["2", "中危"], ["3", "高危"]];
      chipsHz.innerHTML = opts.map(function (o) {
        return '<button class="chip" type="button" data-hz="' + o[0] + '" aria-pressed="' + (o[0] === "all") + '">' + o[1] + "</button>";
      }).join("");

      chipsHz.addEventListener("click", function (e) {
        var btn = e.target.closest(".chip");
        if (!btn) return;
        state.hazard = btn.dataset.hz;
        $$(".chip", chipsHz).forEach(function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        render();
      });
    }

    function haystack(item) {
      return [
        item.name, item.formula, item.category, item.summary,
        (item.tags || []).join(" "),
        (item.reagents || []).join(" "),
        (item.principle || []).join(" ")
      ].join(" ").toLowerCase();
    }

    function matches(item) {
      if (state.cat !== "all" && item.category !== state.cat) return false;
      if (state.hazard !== "all" && String(item.hazard) !== state.hazard) return false;
      if (state.q && haystack(item).indexOf(state.q) === -1) return false;
      return true;
    }

    function render() {
      var list = data.filter(matches);
      if (!list.length) {
        grid.innerHTML =
          '<div class="empty"><b>没有找到匹配的内容</b>换个关键词，或把筛选条件改成“全部”试试。</div>';
      } else {
        grid.innerHTML = list.map(function (item) { return cardHTML(item, config.type); }).join("");
      }
      if (note) {
        note.textContent = config.noteText
          ? config.noteText(list.length, data.length)
          : "共 " + list.length + " 条" + (list.length === data.length ? "" : " / 全部 " + data.length + " 条");
      }
      bindCards(grid);
      observeReveals();
    }

    if (search) {
      var timer = null;
      search.addEventListener("input", function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          state.q = search.value.trim().toLowerCase();
          render();
        }, 120);
      });
    }

    buildCatChips();
    buildHzChips();
    render();
  }

  /* ---------------- 首页 ---------------- */
  var ELEMENTS = [
    ["H", "1", "氢"], ["He", "2", "氦"], ["C", "6", "碳"], ["N", "7", "氮"],
    ["O", "8", "氧"], ["Na", "11", "钠"], ["Mg", "12", "镁"], ["Al", "13", "铝"],
    ["Si", "14", "硅"], ["P", "15", "磷"], ["S", "16", "硫"], ["Cl", "17", "氯"],
    ["K", "19", "钾"], ["Ca", "20", "钙"], ["Fe", "26", "铁"], ["Cu", "29", "铜"],
    ["Zn", "30", "锌"], ["Br", "35", "溴"], ["Ag", "47", "银"], ["I", "53", "碘"],
    ["Ba", "56", "钡"], ["Au", "79", "金"]
  ];

  function initElementStrip() {
    var track = $(".element-track");
    if (!track) return;
    var html = ELEMENTS.map(function (el) {
      return '<div class="el"><b>' + el[0] + "</b><i>" + el[1] + "</i><span>" + el[2] + "</span></div>";
    }).join("");
    track.innerHTML = html + html; /* 复制一份实现无缝滚动 */
  }

  function initFeatured() {
    var prepBox = $("#featured-prep");
    if (prepBox) {
      var picks = ["oxygen", "carbon-dioxide", "copper-sulfate", "ethyl-acetate"];
      var items = picks.map(function (id) {
        return PREP.filter(function (p) { return p.id === id; })[0];
      }).filter(Boolean);
      prepBox.innerHTML = items.map(function (p) { return cardHTML(p, "p"); }).join("");
      bindCards(prepBox);
    }

    var expBox = $("#featured-exp");
    if (expBox) {
      var picks2 = ["titration", "flame-test", "iodine-clock", "silver-mirror"];
      var items2 = picks2.map(function (id) {
        return EXP.filter(function (p) { return p.id === id; })[0];
      }).filter(Boolean);
      expBox.innerHTML = items2.map(function (p) { return cardHTML(p, "e"); }).join("");
      bindCards(expBox);
    }
  }

  function initArtStrip() {
    var box = $("#art-strip");
    if (!box || !window.CHEMLAB_ART) return;
    var picks = ["titrate", "distill", "filter", "flame", "electrolysis", "chromatography", "separate-funnel", "gas-jar"];
    var html = picks.map(function (id) {
      var art = window.CHEMLAB_ART.art[id];
      if (!art) return "";
      return "<figure>" + art.svg + "<figcaption>" + art.label + "</figcaption></figure>";
    }).join("");
    box.innerHTML = html;
  }

  /* ---------------- 启动 ---------------- */
  function initCounts() {
    $$("[data-count]").forEach(function (el) {
      var key = el.getAttribute("data-count");
      var n = key === "prep" ? PREP.length
        : key === "exp" ? EXP.length
        : key === "all" ? PREP.length + EXP.length
        : null;
      if (n !== null) el.textContent = String(n);
    });
  }

  function initAddonNotice() {
    if (!ADDON_ERRORS.length) return;
    try { console.warn("[add-content.js] " + ADDON_ERRORS.join(" ")); } catch (e) { /* ignore */ }

    var box = document.createElement("div");
    box.className = "addon-notice";
    box.innerHTML =
      "<b>add-content.js 提示</b>" +
      "<ul>" + ADDON_ERRORS.slice(0, 6).map(function (msg) { return "<li>" + esc(msg) + "</li>"; }).join("") + "</ul>" +
      (ADDON_ERRORS.length > 6 ? "<p>还有 " + (ADDON_ERRORS.length - 6) + " 条提示，已输出到控制台。</p>" : "") +
      '<button type="button">知道了</button>';

    var closeBtn = box.querySelector("button");
    if (closeBtn) closeBtn.addEventListener("click", function () { box.remove(); });
    document.body.appendChild(box);
  }

  function init() {
    initTheme();
    initNav();
    initElementStrip();
    initFeatured();
    initListPage({
      data: PREP,
      type: "p",
      grid: "#prep-grid",
      catChips: "#prep-cats",
      hazardChips: "#prep-hz",
      search: "#prep-search",
      note: "#prep-note",
      counts: factoryMode,
      noteText: factoryMode ? function (n, total) {
        return "QUERY // " + pad(n, 2) + " / " + pad(total, 2) + " RECORDS";
      } : null
    });
    initListPage({
      data: EXP,
      type: "e",
      grid: "#exp-grid",
      catChips: "#exp-cats",
      hazardChips: "#exp-hz",
      search: "#exp-search",
      note: "#exp-note"
    });
    initCounts();
    initAddonNotice();
    initArtStrip();
    observeReveals();
    initDeepLink();

    $$("[data-year]").forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  /* 对外暴露最小 API：便于其他页面或脚本直接打开某条目的详情 */
  window.ChemLab = {
    openDetail: openDetail,
    closeDetail: closeDetail,
    renderCard: cardHTML,
    renderDetail: detailHTML,
    reagentRole: reagentRole,
    factoryMode: factoryMode
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
