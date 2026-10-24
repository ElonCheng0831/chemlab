/* ============================================================
   化境 ChemLab · 操作图解插画库（全部为本站自绘 SVG 线稿）
   用法：<script src="assets/art.js"></script> 之后可调用
     window.CHEMLAB_ART.figure("distill", "蒸馏")  → HTML 字符串
   数据条目可用 art 字段指定；未指定时按 id / 分类自动匹配。
   ============================================================ */
(function () {
  "use strict";

  var S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  var AC = 'fill="var(--accent)" opacity=".18"';
  var AC2 = 'fill="var(--accent)" opacity=".35"';

  function svg(inner, label) {
    return '<svg class="art-svg" viewBox="0 0 160 110" role="img" aria-label="' + label + '">' + inner + "</svg>";
  }

  /* 每幅图都画成“操作现场”：器皿 + 关键动作 + 现象 */
  var ART = {
    "heat-tube": {
      label: "加热试管",
      cap: "试管口略向下倾斜，先均匀预热再集中加热，管口不要对着人。",
      svg: svg(
        '<path d="M52 18 L86 46" ' + S + '/>' +
        '<path d="M54 16 L88 44" ' + S + '/>' +
        '<path d="M86 46 q10 8 6 20" ' + S + '/>' +
        '<path d="M92 66 q-2 14 -14 16" ' + S + '/>' +
        '<path d="M78 82 q-16 2 -20 -12" ' + S + '/>' +
        '<path d="M58 70 q-4 -12 6 -20" ' + S + '/>' +
        '<rect x="70" y="0" width="8" height="16" rx="3" ' + S + '/>' +
        '<path d="M64 86 h44" ' + S + '/>' +
        '<path d="M74 92 q6 -12 12 0 q6 12 12 0" stroke="var(--warn)" stroke-width="2" fill="none"/>' +
        '<path d="M80 96 q4 -8 8 0" stroke="var(--amber)" stroke-width="2" fill="none"/>' +
        '<circle cx="66" cy="34" r="3" ' + AC2 + '/>' +
        '<circle cx="74" cy="24" r="2" ' + AC2 + '/>' +
        '<path d="M40 40 h12 M40 48 h8" ' + S + '/>',
        "加热试管"
      )
    },
    "filter": {
      label: "过滤",
      cap: "一贴二低三靠：滤纸紧贴漏斗，液面低于滤纸边缘，玻璃棒引流。",
      svg: svg(
        '<path d="M46 18 h60" ' + S + '/>' +
        '<path d="M76 18 v34" ' + S + '/>' +
        '<path d="M56 52 h40 l-16 26 h-8 z" ' + S + '/>' +
        '<path d="M60 58 h32 l-12 18 h-8 z" ' + AC + '/>' +
        '<path d="M76 78 v14" ' + S + '/>' +
        '<path d="M60 92 h32 l-4 12 h-24 z" ' + S + '/>' +
        '<path d="M64 98 h24" ' + AC2 + '/>' +
        '<path d="M92 40 l14 20" ' + S + '/>' +
        '<circle cx="110" cy="66" r="3" ' + AC2 + '/>' +
        '<circle cx="110" cy="76" r="2" ' + AC2 + '/>' +
        '<path d="M62 30 h28" stroke-dasharray="4 4" ' + S + '/>',
        "过滤操作"
      )
    },
    "crystallize": {
      label: "蒸发结晶",
      cap: "蒸发皿放在泥三角上小火加热，出现较多晶体时停止加热，余热蒸干。",
      svg: svg(
        '<path d="M40 46 q40 26 80 0" ' + S + '/>' +
        '<path d="M40 46 q0 -8 8 -8 h64 q8 0 8 8" ' + S + '/>' +
        '<path d="M52 52 q28 16 56 0" ' + AC + '/>' +
        '<path d="M48 60 l8 12 M70 64 l6 12 M92 62 l8 10 M112 56 l6 12" ' + S + '/>' +
        '<path d="M70 60 l4 -4 4 4 -4 5 z" ' + AC2 + '/>' +
        '<path d="M96 58 l4 -4 4 4 -4 5 z" ' + AC2 + '/>' +
        '<path d="M60 84 h40" ' + S + '/>' +
        '<path d="M68 90 q6 -10 12 0 q6 10 12 0" stroke="var(--warn)" stroke-width="2" fill="none"/>' +
        '<path d="M60 104 h40" ' + S + '/>',
        "蒸发结晶"
      )
    },
    "distill": {
      label: "蒸馏",
      cap: "温度计水银球位于支管口，冷凝水从下口进、上口出，弃去开始馏出的液体。",
      svg: svg(
        '<path d="M24 60 a16 16 0 0 1 16 -16 h10 v-8" ' + S + '/>' +
        '<path d="M50 36 v8 a16 16 0 0 1 16 16 v6 h-42 z" ' + S + '/>' +
        '<path d="M28 52 h24" ' + AC2 + '/>' +
        '<path d="M72 66 h34 l14 20" ' + S + '/>' +
        '<path d="M78 72 h26" ' + AC + '/>' +
        '<path d="M120 86 l14 18" ' + S + '/>' +
        '<path d="M112 86 l14 18" ' + S + '/>' +
        '<path d="M134 104 v8 h-16 v-8" ' + AC2 + '/>' +
        '<path d="M28 86 q6 -12 12 0 q6 12 12 0" stroke="var(--warn)" stroke-width="2" fill="none"/>' +
        '<path d="M40 100 h24" ' + S + '/>' +
        '<circle cx="58" cy="48" r="2" ' + AC2 + '/>' +
        '<circle cx="64" cy="42" r="2" ' + AC2 + '/>',
        "蒸馏装置"
      )
    },
    "reflux": {
      label: "回流",
      cap: "冷凝管夹在铁架台上，通水后加热，蒸气在冷凝管中液化回流，可减少溶剂损失。",
      svg: svg(
        '<path d="M54 92 a18 18 0 0 1 18 -18 h8 a18 18 0 0 1 18 18 z" ' + S + '/>' +
        '<path d="M60 74 h28" ' + AC + '/>' +
        '<path d="M80 74 v-42" ' + S + '/>' +
        '<path d="M72 32 v40 M88 32 v40" ' + S + '/>' +
        '<path d="M70 24 h20 l-4 8 h-12 z" ' + S + '/>' +
        '<path d="M96 40 l10 10 M96 52 l10 10 M96 64 l10 10" ' + AC2 + '/>' +
        '<path d="M40 96 q6 -12 12 0 q6 12 12 0" stroke="var(--warn)" stroke-width="2" fill="none"/>' +
        '<path d="M64 100 h40" ' + S + '/>' +
        '<circle cx="80" cy="52" r="2" ' + AC2 + '/>',
        "回流装置"
      )
    },
    "water-bath": {
      label: "水浴加热",
      cap: "把容器浸在 60–80℃ 的水浴中，受热均匀，适合低沸点、易燃液体的加热。",
      svg: svg(
        '<rect x="36" y="30" width="88" height="48" rx="6" ' + S + '/>' +
        '<path d="M44 62 q40 -6 72 0" ' + AC + '/>' +
        '<rect x="62" y="24" width="36" height="34" rx="4" ' + S + '/>' +
        '<path d="M70 34 h20 M70 42 h20" ' + AC2 + '/>' +
        '<path d="M112 34 v-10 M112 24 h4" ' + S + '/>' +
        '<circle cx="114" cy="20" r="3" ' + S + '/>' +
        '<path d="M56 88 q6 -12 12 0 q6 12 12 0" stroke="var(--warn)" stroke-width="2" fill="none"/>' +
        '<path d="M72 102 h32" ' + S + '/>' +
        '<path d="M44 40 q4 6 8 0 M52 52 q4 6 8 0" ' + AC2 + '/>',
        "水浴加热"
      )
    },
    "gas-jar": {
      label: "气体收集",
      cap: "根据气体密度选择向上或向下排空气，排水法 collection 时导管插入瓶口，集满后先移导管再停止加热。",
      svg: svg(
        '<path d="M22 74 a22 18 0 0 1 44 0 v10 h-44 z" ' + S + '/>' +
        '<path d="M26 70 h36" ' + AC + '/>' +
        '<path d="M44 74 v-24 h44" ' + S + '/>' +
        '<path d="M88 50 v-18 h34 v44 h-34 z" ' + S + '/>' +
        '<path d="M92 36 h26" ' + AC2 + '/>' +
        '<path d="M96 28 q4 -8 8 0 M110 26 q4 -8 8 0" ' + AC2 + '/>' +
        '<circle cx="92" cy="60" r="2" ' + AC2 + '/>' +
        '<circle cx="98" cy="66" r="2" ' + AC2 + '/>' +
        '<path d="M40 96 h68" ' + S + '/>' +
        '<path d="M54 104 q6 -10 12 0" stroke="var(--warn)" stroke-width="2" fill="none"/>',
        "气体收集"
      )
    },
    "precipitate": {
      label: "沉淀反应",
      cap: "滴管垂直悬空滴加，边加边振荡试管；沉淀下沉后观察颜色与状态。",
      svg: svg(
        '<path d="M46 26 h20 v50 a10 10 0 0 1 -20 0 z" ' + S + '/>' +
        '<path d="M50 70 h12" ' + AC + '/>' +
        '<circle cx="52" cy="80" r="2" ' + AC2 + '/>' +
        '<circle cx="58" cy="84" r="2" ' + AC2 + '/>' +
        '<path d="M100 26 h20 v42 a10 10 0 0 1 -20 0 z" ' + S + '/>' +
        '<path d="M104 58 q6 8 12 0" ' + AC2 + '/>' +
        '<path d="M78 18 l10 10 M84 20 l4 4" ' + S + '/>' +
        '<path d="M80 30 v8" ' + AC2 + '/>' +
        '<circle cx="80" cy="44" r="2" ' + AC2 + '/>' +
        '<path d="M78 14 h10" ' + S + '/>' +
        '<path d="M40 100 h80" ' + S + '/>' +
        '<path d="M110 76 l6 -6 6 6 -6 6 z" ' + AC2 + '/>',
        "沉淀反应"
      )
    },
    "color-tubes": {
      label: "显色与比色",
      cap: "同规格试管、等量试液、同时加入相同滴数试剂，在白纸前比较颜色深浅。",
      svg: svg(
        '<path d="M28 96 h104" ' + S + '/>' +
        '<path d="M34 96 v-46 q0 -6 6 -6 t6 6 v46" ' + S + '/>' +
        '<path d="M36 78 h12 v14 h-12 z" ' + AC2 + '/>' +
        '<path d="M56 96 v-52 q0 -6 6 -6 t6 6 v52" ' + S + '/>' +
        '<path d="M58 74 h12 v18 h-12 z" ' + AC + '/>' +
        '<path d="M78 96 v-44 q0 -6 6 -6 t6 6 v44" ' + S + '/>' +
        '<path d="M80 80 h12 v12 h-12 z" fill="var(--amber)" opacity=".35"/>' +
        '<path d="M100 96 v-56 q0 -6 6 -6 t6 6 v56" ' + S + '/>' +
        '<path d="M102 70 h12 v22 h-12 z" fill="var(--accent)" opacity=".28"/>' +
        '<path d="M124 96 v-48" ' + S + '/>' +
        '<path d="M120 52 h24" ' + S + '/>' +
        '<path d="M34 40 h96" stroke-dasharray="3 5" ' + S + '/>',
        "显色与比色"
      )
    },
    "titrate": {
      label: "滴定",
      cap: "滴定管排气泡后调零，左手控制活塞，右手摇瓶，眼睛注视锥形瓶内颜色变化。",
      svg: svg(
        '<path d="M76 10 v44" ' + S + '/>' +
        '<path d="M70 12 h12 M70 64 h12" ' + S + '/>' +
        '<path d="M76 54 v10" ' + S + '/>' +
        '<circle cx="76" cy="58" r="3" ' + AC2 + '/>' +
        '<path d="M72 70 h8 l-4 8 z" ' + S + '/>' +
        '<path d="M62 92 q0 -10 14 -10 t14 10" ' + S + '/>' +
        '<path d="M58 92 h36 l-4 12 h-28 z" ' + S + '/>' +
        '<path d="M62 98 q14 4 28 0" ' + AC + '/>' +
        '<path d="M52 104 h48" ' + S + '/>' +
        '<circle cx="76" cy="74" r="2" ' + AC2 + '/>' +
        '<circle cx="76" cy="80" r="1.5" ' + AC2 + '/>' +
        '<path d="M112 40 q8 10 0 20" ' + S + '/>' +
        '<path d="M120 40 q8 10 0 20" ' + S + '/>',
        "酸碱滴定"
      )
    },
    "electrolysis": {
      label: "电解",
      cap: "石墨电极插入电解液，接通直流电源，正极析出氧气、负极析出氢气，注意气密与通风。",
      svg: svg(
        '<rect x="30" y="42" width="100" height="44" rx="6" ' + S + '/>' +
        '<path d="M36 70 q44 -8 88 0" ' + AC + '/>' +
        '<path d="M56 42 v-14 h-8" ' + S + '/>' +
        '<path d="M104 42 v-14 h8" ' + S + '/>' +
        '<path d="M48 28 h16 M96 28 h16" ' + S + '/>' +
        '<rect x="66" y="14" width="28" height="12" rx="3" ' + S + '/>' +
        '<path d="M70 20 h4 M80 20 h4 M90 20 h2" ' + AC2 + '/>' +
        '<circle cx="56" cy="58" r="2" ' + AC2 + '/>' +
        '<circle cx="56" cy="50" r="2" ' + AC2 + '/>' +
        '<circle cx="104" cy="58" r="2" ' + AC2 + '/>' +
        '<circle cx="104" cy="50" r="2" ' + AC2 + '/>' +
        '<path d="M28 96 h104" ' + S + '/>',
        "电解装置"
      )
    },
    "separate-funnel": {
      label: "分液",
      cap: "分液漏斗静置分层，下层从下口放出，上层从上口倒出，放气时倒置漏斗打开活塞。",
      svg: svg(
        '<path d="M80 14 v14" ' + S + '/>' +
        '<path d="M64 28 h32 l-8 26 h-16 z" ' + S + '/>' +
        '<path d="M68 40 h24 l-4 10 h-16 z" ' + AC + '/>' +
        '<path d="M80 54 v10" ' + S + '/>' +
        '<circle cx="80" cy="66" r="4" ' + S + '/>' +
        '<path d="M80 70 v16" ' + S + '/>' +
        '<path d="M64 92 h32 l-6 10 h-20 z" ' + S + '/>' +
        '<path d="M66 96 h28" ' + AC2 + '/>' +
        '<path d="M40 54 h22 M40 54 v-16 h22" ' + S + '/>' +
        '<path d="M120 44 q8 10 0 20" ' + S + '/>',
        "分液操作"
      )
    },
    "chromatography": {
      label: "纸层析",
      cap: "滤纸点样端浸入展开剂，斑点随溶剂上行，不同组分因吸附与溶解能力差异而分开。",
      svg: svg(
        '<path d="M44 34 h64 v58 h-64 z" ' + S + '/>' +
        '<path d="M48 82 h56" ' + AC + '/>' +
        '<rect x="70" y="24" width="12" height="62" rx="2" ' + S + '/>' +
        '<circle cx="76" cy="78" r="2.5" fill="var(--warn)" opacity=".7"/>' +
        '<circle cx="76" cy="64" r="2.5" fill="var(--accent)" opacity=".7"/>' +
        '<circle cx="76" cy="50" r="2.5" fill="var(--amber)" opacity=".8"/>' +
        '<circle cx="76" cy="38" r="2" fill="var(--warn)" opacity=".4"/>' +
        '<path d="M56 40 h10 M56 52 h6" ' + AC2 + '/>' +
        '<path d="M118 34 v26" ' + S + '/>' +
        '<path d="M114 60 h8 l-4 8 z" ' + S + '/>',
        "纸层析"
      )
    },
    "flame": {
      label: "焰色试验",
      cap: "铂丝蘸取样品在无色火焰外焰灼烧，观察火焰颜色；每次试验前用稀盐酸洗净铂丝。",
      svg: svg(
        '<path d="M36 88 h40" ' + S + '/>' +
        '<path d="M56 88 v-16" ' + S + '/>' +
        '<path d="M48 84 q8 -30 8 0" ' + S + '/>' +
        '<path d="M56 72 q6 -26 14 -30" ' + S + '/>' +
        '<path d="M70 42 q8 14 4 26" ' + S + '/>' +
        '<path d="M96 40 q20 6 22 22 q2 16 -14 20" ' + S + '/>' +
        '<path d="M104 46 q14 6 14 18 q0 12 -12 14" ' + AC + '/>' +
        '<path d="M118 30 l6 -6 M128 40 l8 -2 M124 52 l8 4" stroke="var(--amber)" stroke-width="2" fill="none"/>' +
        '<path d="M56 72 q10 -6 18 0" stroke="var(--warn)" stroke-width="2" fill="none"/>' +
        '<circle cx="64" cy="64" r="2" fill="var(--warn)" opacity=".6"/>',
        "焰色试验"
      )
    },
    "polymer": {
      label: "高分子",
      cap: "单体在引发剂作用下连接成长链，链与链缠结形成材料；固化过程常伴随放热与体积变化。",
      svg: svg(
        '<path d="M24 56 l12 -10 12 10 -12 10 z" ' + S + '/>' +
        '<path d="M48 56 l12 -10 12 10 -12 10 z" ' + S + '/>' +
        '<path d="M72 56 l12 -10 12 10 -12 10 z" ' + S + '/>' +
        '<path d="M96 56 l12 -10 12 10 -12 10 z" ' + S + '/>' +
        '<path d="M60 46 q0 -18 16 -18 t16 18" ' + AC2 + '/>' +
        '<path d="M40 66 q0 18 16 18 t16 -18" ' + AC2 + '/>' +
        '<circle cx="36" cy="56" r="2" ' + AC2 + '/>' +
        '<circle cx="108" cy="56" r="2" ' + AC2 + '/>' +
        '<path d="M20 84 h120" ' + S + '/>',
        "高分子链"
      )
    },
    "electroplate": {
      label: "电镀",
      cap: "待镀件接负极、镀层金属接正极，电镀液含镀层金属离子，通电后金属在工件表面析出。",
      svg: svg(
        '<rect x="34" y="40" width="92" height="48" rx="6" ' + S + '/>' +
        '<path d="M40 72 q40 -10 80 0" ' + AC + '/>' +
        '<path d="M64 40 v-12 h-8" ' + S + '/>' +
        '<path d="M96 40 v-12 h8" ' + S + '/>' +
        '<path d="M56 24 h16 M88 24 h16" ' + S + '/>' +
        '<rect x="72" y="10" width="16" height="12" rx="3" ' + S + '/>' +
        '<path d="M64 44 v40" stroke="var(--accent)" stroke-width="4"/>' +
        '<path d="M96 44 v40" ' + S + '/>' +
        '<path d="M92 52 h8 v10 h-8 z" fill="var(--accent)" opacity=".5"/>' +
        '<circle cx="96" cy="72" r="2" ' + AC2 + '/>' +
        '<path d="M28 96 h104" ' + S + '/>',
        "电镀装置"
      )
    }
  };

  /* 按 id 关键字匹配实验/制法，未命中时按分类兜底 */
  var RULES = [
    [/titrat/, "titrate"],
    [/flame|焰色|burn|combust/, "flame"],
    [/electrolys|electroplate|electro|电解|电镀|cell|corrosion|rust|anode/, "electrolysis"],
    [/chromatograph|层析/, "chromatography"],
    [/distill|蒸馏|fraction/, "distill"],
    [/extract|分液|separat/, "separate-funnel"],
    [/recrystall|crystal|结晶|purif/, "crystallize"],
    [/filter|filtration|过滤|purif/, "filter"],
    [/precip|沉淀|hydroxide|chloride|sulfate|carbonate|insoluble/, "precipitate"],
    [/reflux|回流|esterif|hydrolysis|saponif/, "reflux"],
    [/water-bath|水浴|fehling|biuret|denatur|enzyme|ferment/, "water-bath"],
    [/gas|oxygen|hydrogen|chlorine|ammonia|carbon-dioxide|combust|burn|prepar/, "gas-jar"],
    [/polymer|resin|nylon|bakelite|plastic|slime/, "polymer"],
    [/color|indicat|iodine|starch|ph|buffer|spectro|colorimetr/, "color-tubes"],
    [/heat|加热|thermit|magnesium|sodium/, "heat-tube"]
  ];

  var CAT_FALLBACK = {
    "气体": "gas-jar",
    "单质": "heat-tube",
    "氧化物": "heat-tube",
    "酸与碱": "color-tubes",
    "盐": "crystallize",
    "有机物": "reflux",
    "试剂与溶液": "color-tubes",
    "生活材料": "filter",
    "基础操作": "filter",
    "物质性质": "color-tubes",
    "电化学": "electrolysis",
    "趣味演示": "flame",
    "分离提纯": "filter",
    "定量测量": "titrate",
    "气体与燃烧": "gas-jar",
    "沉淀溶解平衡": "precipitate",
    "配位化学": "color-tubes"
  };

  function artId(item, type) {
    if (!item) return "heat-tube";
    if (item.art && ART[item.art]) return item.art;
    var key = (item.id || "") + " " + (item.name || "");
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i][0].test(key)) {
        /* 过滤优先于结晶：id 含 filter 时走过滤 */
        return RULES[i][1];
      }
    }
    return CAT_FALLBACK[item.category] || (type === "p" ? "crystallize" : "heat-tube");
  }

  function figure(item, type, captionOverride) {
    var id = artId(item, type);
    var art = ART[id] || ART["heat-tube"];
    var caption = captionOverride || art.cap;
    return (
      '<figure class="art-figure">' +
        '<div class="art-frame">' + art.svg + "</div>" +
        '<figcaption class="art-cap"><b>' + art.label + "</b>" + (caption ? " · " + caption : "") + "</figcaption>" +
      "</figure>"
    );
  }

  function icon(item, type) {
    var id = artId(item, type);
    var art = ART[id] || ART["heat-tube"];
    return art.svg;
  }

  function list() {
    return Object.keys(ART).map(function (k) {
      return { id: k, label: ART[k].label, svg: ART[k].svg };
    });
  }

  window.CHEMLAB_ART = {
    figure: figure,
    icon: icon,
    artId: artId,
    list: list,
    art: ART
  };
})();
