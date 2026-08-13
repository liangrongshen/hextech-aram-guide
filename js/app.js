/* ============================================================
   海克斯出装助手 · 应用逻辑（原生 JS，无依赖）
   路由：hash-based（#/ 首页，#/champion/:id 详情）
   ============================================================ */
(function () {
  'use strict';

  var view = document.getElementById('view');
  var versionChip = document.getElementById('versionChip');

  /* ---------- 工具函数 ---------- */
  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function roleClass(role) {
    var map = { '战士': 'r-fighter', '坦克': 'r-tank', '法师': 'r-mage', '刺客': 'r-assassin', '射手': 'r-marksman', '辅助': 'r-support' };
    return map[role] || '';
  }

  function tierClass(tier) {
    return 't-' + String(tier).replace('+', 'plus');
  }

  function wrClass(wr) {
    if (wr >= 54) return 'good';
    if (wr >= 50) return 'mid';
    return 'bad';
  }

  function imgWithFallback(url, alt, cls) {
    return '<img src="' + esc(url) + '" alt="' + esc(alt) + '" class="' + (cls || '') + '" loading="lazy" ' +
      'onerror="this.onerror=null;this.parentNode.classList.add(\'img-fallback\');this.parentNode.innerHTML=\'' +
      esc(alt.charAt(0) || '?') + '\';">';
  }

  function skillKey(k) {
    var map = { 'Q': 'sk-Q', 'W': 'sk-W', 'E': 'sk-E', 'R': 'sk-R' };
    return map[k] || 'sk-Q';
  }

  function skillOrderHtml(order) {
    return order.map(function (k) {
      return '<span class="sk ' + skillKey(k) + '">' + k + '</span>';
    }).join('');
  }

  /* ---------- 首页渲染 ---------- */
  var state = { q: '', role: '全部', tier: '全部' };

  function renderHome() {
    var list = HEROES.filter(function (h) {
      var kw = state.q.trim().toLowerCase();
      if (kw && h.name.toLowerCase().indexOf(kw) === -1 &&
          h.alias.toLowerCase().indexOf(kw) === -1 &&
          h.id.toLowerCase().indexOf(kw) === -1) return false;
      if (state.role !== '全部' && h.roles.indexOf(state.role) === -1) return false;
      if (state.tier !== '全部' && h.tier !== state.tier) return false;
      return true;
    });

    var chipsRole = ROLES.map(function (r) {
      return '<button class="chip' + (state.role === r ? ' active' : '') + '" data-role="' + esc(r) + '">' + esc(r) + '</button>';
    }).join('');

    var chipsTier = TIERS.map(function (t) {
      return '<button class="chip' + (state.tier === t ? ' active' : '') + '" data-tier="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');

    var grid = list.map(function (h) {
      var role = h.roles[0];
      return (
        '<a class="champ-card' + (h.hasBuild ? ' has-build' : '') + '" href="#/champion/' + esc(h.id) + '" data-nav role="button" aria-label="' + esc(h.name) + ' ' + esc(h.alias) + '">' +
          '<div class="thumb">' +
            imgWithFallback(IMG.champion(h.id), h.name, 'champ-img') +
            '<span class="tier-badge">' + esc(h.tier) + '</span>' +
            '<span class="role-badge ' + roleClass(role) + '">' + esc(role) + '</span>' +
          '</div>' +
          '<div class="champ-info">' +
            '<div class="champ-name">' + esc(h.alias) + '</div>' +
            '<div class="champ-title">' + esc(h.name) + '</div>' +
            '<div class="champ-wr">' +
              '<span class="wr-value ' + wrClass(h.wr) + '">' + h.wr.toFixed(2) + '%</span>' +
              '<span class="wr-label">胜率</span>' +
            '</div>' +
          '</div>' +
          (h.hasBuild ? '<span class="build-hint">查看出装攻略 →</span>' : '') +
        '</a>'
      );
    }).join('');

    var gridHtml = grid ||
      '<div class="empty-state"><div class="empty-icon">🔍</div><p>没有找到匹配的英雄<br><small>换个关键词或筛选条件试试</small></p></div>';

    view.innerHTML =
      '<section class="hero fade-in">' +
        '<h1>海克斯大乱斗出装助手</h1>' +
        '<p>全英雄 <em>出装 / 强化符文 / 胜率</em> 一站式查询 · 版本 ' + esc(APP.patch) + '</p>' +
        '<div class="stats-row">' +
          '<span class="stat-pill">英雄总数<b>' + APP.total + '</b></span>' +
          '<span class="stat-pill">覆盖位置<b>6</b></span>' +
          '<span class="stat-pill">攻略英雄<b>' + Object.keys(BUILDS).length + '</b></span>' +
          '<span class="stat-pill">数据更新<b>' + esc(APP.updated) + '</b></span>' +
        '</div>' +
        '<a class="match-cta" href="#/match" data-nav role="button">' +
          '<span class="mc-ico">🎮</span>' +
          '<span class="mc-txt"><b>对局模式</b><small>选英雄看推荐 · 符文三选一推荐</small></span>' +
          '<span class="mc-arrow">→</span>' +
        '</a>' +
      '</section>' +

      '<div class="search-wrap">' +
        '<div class="search-box">' +
          '<input type="search" id="searchInput" placeholder="搜索英雄，如：薇恩 / Vayne" value="' + esc(state.q) + '" aria-label="搜索英雄">' +
          '<span class="search-icon">🔍</span>' +
        '</div>' +
        '<div class="filter-label">位置</div>' +
        '<div class="filters" id="roleFilters">' + chipsRole + '</div>' +
        '<div class="filter-label">强度等级</div>' +
        '<div class="filters" id="tierFilters">' + chipsTier + '</div>' +
      '</div>' +

      '<div class="result-count">找到 <b>' + list.length + '</b> 位英雄' + (state.q ? '（关键词：' + esc(state.q) + '）' : '') + '</div>' +
      '<div class="champ-grid" id="champGrid">' + gridHtml + '</div>';

    bindHomeEvents();
  }

  function bindHomeEvents() {
    var input = document.getElementById('searchInput');
    if (input) {
      input.addEventListener('input', function (e) {
        state.q = e.target.value;
        renderHome();
      });
    }

    var roleFilters = document.getElementById('roleFilters');
    if (roleFilters) {
      roleFilters.addEventListener('click', function (e) {
        var chip = e.target.closest('.chip');
        if (!chip) return;
        state.role = chip.getAttribute('data-role');
        renderHome();
      });
    }

    var tierFilters = document.getElementById('tierFilters');
    if (tierFilters) {
      tierFilters.addEventListener('click', function (e) {
        var chip = e.target.closest('.chip');
        if (!chip) return;
        state.tier = chip.getAttribute('data-tier');
        renderHome();
      });
    }
  }

  /* ---------- 详情页渲染 ---------- */
  function renderDetail(id) {
    var hero = HEROES.find(function (h) { return h.id === id; });
    if (!hero) {
      view.innerHTML =
        '<div class="empty-state fade-in"><div class="empty-icon">⚠️</div>' +
        '<p>未找到该英雄<br><small><a href="#/" style="color:var(--hextech)">返回首页</a></small></p></div>';
      return;
    }

    var build = BUILDS[hero.id];
    if (!build) {
      view.innerHTML = renderDetailEmpty(hero);
      return;
    }

    var rolesHtml = hero.roles.map(function (r) {
      return '<span class="role-tag ' + roleClass(r) + '">' + esc(r) + '</span>';
    }).join('');

    var statsHtml =
      '<div class="stats">' +
        '<div class="stat-box"><div class="num ' + wrClass(hero.wr) + '">' + hero.wr.toFixed(2) + '%</div><div class="lbl">胜率 WR</div></div>' +
        '<div class="stat-box"><div class="num">' + hero.pr.toFixed(2) + '%</div><div class="lbl">登场率 PR</div></div>' +
        (hero.rank ? '<div class="stat-box"><div class="num" style="color:var(--gold)">#' + hero.rank + '</div><div class="lbl">全英雄排名</div></div>' : '<div class="stat-box"><div class="num">' + esc(hero.tier) + '</div><div class="lbl">强度等级</div></div>') +
      '</div>';

    /* 技能加点 */
    var skill = build.skill;
    var skillAlts = skill.alternates.map(function (alt) {
      return (
        '<div class="alt-item">' +
          '<span class="order">' + skillOrderHtml(alt.order) + '</span>' +
          '<span class="meta">登场率 ' + alt.pr.toFixed(2) + '% · 胜率 <b>' + alt.wr.toFixed(2) + '%</b></span>' +
        '</div>'
      );
    }).join('');

    /* 出装块 */
    function itemBlock(title, tag, items, isCore) {
      var slots = items.map(function (it, i) {
        var meta = (isCore && i === 0) ? '' : '';
        return (
          '<div class="item-slot">' +
            '<div class="item-icon">' + imgWithFallback(IMG.item(it.id), it.name || '', '') + '</div>' +
            '<div class="item-name">' + esc(it.name || '') + '</div>' +
            (it.pr != null ? '<div class="item-pr">' + it.pr.toFixed(2) + '%</div>' : '') +
          '</div>'
        );
      }).join('');

      return (
        '<div class="build-block">' +
          '<div class="bb-head">' +
            '<div class="bb-title">' + esc(title) + (tag ? '<span class="tag">' + esc(tag) + '</span>' : '') + '</div>' +
            (items[0] && items[0].wr != null ?
              '<div class="bb-wr">胜率 <b>' + items[0].wr.toFixed(2) + '%</b> · 登场率 ' + items[0].pr.toFixed(2) + '%</div>' : '') +
          '</div>' +
          '<div class="item-row">' + slots + '</div>' +
        '</div>'
      );
    }

    var startingHtml = itemBlock('出门装', '开局优先', build.starting, false);
    var bootsHtml = itemBlock('鞋子', '选择', build.boots, false);
    var coreHtml = build.core.map(function (combo, ci) {
      var slots = combo.items.map(function (it) {
        var name = resolveItemName(hero.id, it.id);
        return (
          '<div class="item-slot">' +
            '<div class="item-icon">' + imgWithFallback(IMG.item(it.id), name, '') + '</div>' +
            '<div class="item-name">' + esc(name) + '</div>' +
          '</div>'
        );
      }).join('');
      return (
        '<div class="build-block">' +
          '<div class="bb-head">' +
            '<div class="bb-title">核心组合 ' + (ci + 1) + (ci === 0 ? '<span class="tag">最主流</span>' : '') + '</div>' +
            '<div class="bb-wr">胜率 <b>' + combo.wr.toFixed(2) + '%</b> · 登场率 ' + combo.pr.toFixed(2) + '%</div>' +
          '</div>' +
          '<div class="item-row">' + slots + '</div>' +
        '</div>'
      );
    }).join('');

    /* 强化符文 */
    var runeGroups = [
      { key: 'prismatic', label: '棱彩', cls: 'rr-prismatic', dot: 'd-prismatic' },
      { key: 'gold', label: '金色', cls: 'rr-gold', dot: 'd-gold' },
      { key: 'silver', label: '银色', cls: 'rr-silver', dot: 'd-silver' },
    ];

    var runesHtml = runeGroups.map(function (g) {
      var runes = build.runes[g.key] || [];
      if (!runes.length) return '';
      var items = runes.map(function (r) {
        var rankCls = r.wr >= 58 ? 'rk-good' : (r.wr >= 52 ? 'rk-mid' : 'rk-low');
        return (
          '<div class="rune-item">' +
            '<div class="rune-rank ' + rankCls + '">' + r.wr.toFixed(1) + '</div>' +
            '<div class="rune-body">' +
              '<div class="rune-name"><span class="rr-dot ' + g.dot + '"></span>' + esc(r.name) + '</div>' +
              '<div class="rune-desc">' + esc(r.desc) + '</div>' +
            '</div>' +
            '<div class="rune-wr">' +
              '<div class="wr">' + r.wr.toFixed(2) + '%</div>' +
              '<div class="pr">胜率</div>' +
            '</div>' +
          '</div>'
        );
      }).join('');
      return (
        '<div class="rune-group">' +
          '<div class="rune-group-head"><span class="rune-rarity ' + g.cls + '">' + g.label + '</span> 推荐强化符文 <span class="cnt">· ' + runes.length + ' 个</span></div>' +
          '<div class="rune-list">' + items + '</div>' +
        '</div>'
      );
    }).join('');

    view.innerHTML =
      '<div class="fade-in">' +
        '<div class="back-bar">' +
          '<a class="back-btn" href="#/" data-nav>← 返回英雄列表</a>' +
          '<span class="crumb">' + esc(hero.name) + ' · ' + esc(APP.patch) + ' 版本攻略</span>' +
        '</div>' +

        '<div class="hero-card">' +
          '<div class="hero-avatar">' + imgWithFallback(IMG.champion(hero.id), hero.name, '') + '</div>' +
          '<div class="hero-meta">' +
            '<span class="tier-tag ' + tierClass(hero.tier) + '">' + esc(hero.tier) + ' 级</span>' +
            '<h2>' + esc(hero.alias) + '<span>' + esc(hero.name) + '</span></h2>' +
            '<div class="hero-tags">' + rolesHtml + '</div>' +
            statsHtml +
          '</div>' +
        '</div>' +

        '<div class="section">' +
          '<div class="section-title">技能主升顺序<span class="note">' + esc(skill.main.label || '') + '</span></div>' +
          '<div class="skill-block">' +
            '<div class="skill-main">' +
              '<div class="skill-order">' + skillOrderHtml(skill.main.order) + '</div>' +
              '<div class="skill-wr">登场率 ' + skill.main.pr.toFixed(2) + '% · 胜率 <b>' + skill.main.wr.toFixed(2) + '%</b></div>' +
            '</div>' +
            '<div class="skill-alts">' +
              '<div class="alt-label">其他加点方案</div>' +
              '<div class="alts">' + skillAlts + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="section">' +
          '<div class="section-title">出装推荐<span class="note">基于登场率与胜率排序</span></div>' +
          coreHtml +
          startingHtml +
          bootsHtml +
        '</div>' +

        '<div class="section">' +
          '<div class="section-title">最佳强化符文<span class="note">白银 / 金色 / 棱彩</span></div>' +
          runesHtml +
        '</div>' +

        '<div class="data-note">' +
          '<b>数据说明：</b>胜率（WR）与登场率（PR）来自 arammayhem.com，统计范围为海克斯大乱斗 26.15 版本对局（数据日期 2026-07-30）。' +
          '强化符文按稀有度分为白银 / 金色 / 棱彩三档，数值为携带该符文时的对局胜率。' +
          '出装组合按登场率排序，胜率仅供参考，请结合对局阵容灵活调整。' +
        '</div>' +
      '</div>';
  }

  function resolveItemName(heroId, itemId) {
    /* 核心组合中的装备名从该英雄的出门装列表按 id 匹配，保证图标与名称一致 */
    var build = BUILDS[heroId];
    if (!build) return '';
    var found = (build.starting || []).filter(function (it) { return it.id === itemId; })[0];
    return found ? found.name : '';
  }

  function renderDetailEmpty(hero) {
    var rolesHtml = hero.roles.map(function (r) {
      return '<span class="role-tag ' + roleClass(r) + '">' + esc(r) + '</span>';
    }).join('');
    return (
      '<div class="fade-in">' +
        '<div class="back-bar">' +
          '<a class="back-btn" href="#/" data-nav>← 返回英雄列表</a>' +
          '<span class="crumb">' + esc(hero.name) + '</span>' +
        '</div>' +
        '<div class="hero-card">' +
          '<div class="hero-avatar">' + imgWithFallback(IMG.champion(hero.id), hero.name, '') + '</div>' +
          '<div class="hero-meta">' +
            '<span class="tier-tag ' + tierClass(hero.tier) + '">' + esc(hero.tier) + ' 级</span>' +
            '<h2>' + esc(hero.alias) + '<span>' + esc(hero.name) + '</span></h2>' +
            '<div class="hero-tags">' + rolesHtml + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="empty-state" style="padding:44px 20px">' +
          '<div class="empty-icon">🚧</div>' +
          '<p>' + esc(hero.alias) + ' 的完整出装攻略整理中<br><small>MVP 阶段先内置 4 位代表英雄，数据管线接入后全量覆盖</small></p>' +
        '</div>' +
      '</div>'
    );
  }

  /* ---------- 对局模式 ---------- */
  var matchState = {
    hero: null,          // 当前英雄 id
    q: '',               // 符文搜索词（对局页）
    heroQ: '',           // 选英雄页搜索词
    rarity: '全部',      // 稀有度筛选
    selected: [],        // 当前候选（对局中看到的符文）
    picked: [],          // 本局已确定（最多 4 个）
  };
  var PICK_KEY = 'ha_match_picked_v1';

  function loadPicked() {
    try {
      var d = JSON.parse(localStorage.getItem(PICK_KEY) || 'null');
      if (d && d.hero && d.picked) { matchState.picked = d.picked; return d.hero; }
    } catch (e) {}
    return null;
  }

  function savePicked() {
    try {
      localStorage.setItem(PICK_KEY, JSON.stringify({ hero: matchState.hero, picked: matchState.picked }));
    } catch (e) {}
  }

  /* 该英雄详情页符文热榜：name -> 名次(1-6) */
  function heroHotMap(heroId) {
    var hot = {};
    var build = BUILDS[heroId];
    if (build) {
      ['prismatic', 'gold', 'silver'].forEach(function (k) {
        (build.runes[k] || []).forEach(function (r, i) {
          if (!(r.name in hot)) hot[r.name] = i + 1;
        });
      });
    }
    return hot;
  }

  function getRecommendation() {
    var pool = matchState.selected.map(function (name) {
      return AUGMENTS.find(function (a) { return a.name === name; });
    }).filter(Boolean);
    pool.sort(function (a, b) { return b.wr - a.wr; });
    return pool;
  }

  /* ① 选英雄页 */
  function renderMatchPicker() {
    var kw = matchState.heroQ.trim().toLowerCase();
    var list = HEROES.filter(function (h) {
      if (!kw) return true;
      return h.name.toLowerCase().indexOf(kw) !== -1 ||
             h.alias.toLowerCase().indexOf(kw) !== -1 ||
             h.id.toLowerCase().indexOf(kw) !== -1;
    });

    var grid = list.map(function (h) {
      return (
        '<a class="champ-card has-build" href="#/match/' + esc(h.id) + '" data-nav role="button" aria-label="' + esc(h.name) + '">' +
          '<div class="thumb">' +
            imgWithFallback(IMG.champion(h.id), h.name, 'champ-img') +
            '<span class="tier-badge">' + esc(h.tier) + '</span>' +
          '</div>' +
          '<div class="champ-info">' +
            '<div class="champ-name">' + esc(h.alias) + '</div>' +
            '<div class="champ-title">' + esc(h.name) + '</div>' +
            '<div class="champ-wr"><span class="wr-value ' + wrClass(h.wr) + '">' + h.wr.toFixed(2) + '%</span><span class="wr-label">胜率</span></div>' +
          '</div>' +
        '</a>'
      );
    }).join('');

    view.innerHTML =
      '<div class="fade-in">' +
        '<div class="match-hero-head">' +
          '<span class="mhh-step">①</span>' +
          '<div><h2>选择你的英雄</h2><p>对局开始后，先选出你使用的英雄，查看推荐出装</p></div>' +
        '</div>' +
        '<div class="search-wrap">' +
          '<div class="search-box">' +
            '<input type="search" id="matchSearch" placeholder="搜索英雄，如：薇恩 / Vayne" value="' + esc(matchState.heroQ) + '" aria-label="搜索英雄">' +
            '<span class="search-icon">🔍</span>' +
          '</div>' +
        '</div>' +
        '<div class="result-count">找到 <b>' + list.length + '</b> 位英雄</div>' +
        '<div class="champ-grid">' + grid + '</div>' +
      '</div>';

    var input = document.getElementById('matchSearch');
    if (input) {
      input.addEventListener('input', function (e) {
        matchState.heroQ = e.target.value;
        renderMatchPicker();
      });
    }
  }

  /* ② 对局页 */
  function renderMatch(heroId) {
    var hero = HEROES.find(function (h) { return h.id === heroId; });
    if (!hero) { renderMatchPicker(); return; }

    matchState.hero = heroId;
    matchState.selected = [];
    matchState.q = '';
    matchState.rarity = '全部';
    if (loadPicked() !== heroId) matchState.picked = [];

    var build = BUILDS[heroId];
    var hot = heroHotMap(heroId);
    var recPool = getRecommendation();

    /* 出装速览 */
    var quickHtml = '';
    if (build) {
      var skillMain = build.skill.main;
      var core0 = build.core[0];
      quickHtml =
        '<div class="match-quick">' +
          '<div class="mq-card"><div class="mq-title">技能加点</div>' +
            '<div class="mq-body">' + skillOrderHtml(skillMain.order) +
            '<div class="mq-sub">' + skillMain.wr.toFixed(2) + '% 胜率</div></div></div>' +
          (core0 ?
            '<div class="mq-card"><div class="mq-title">核心出装</div>' +
            '<div class="mq-body mq-items">' + core0.items.map(function (it) {
              var nm = resolveItemName(heroId, it.id) || it.name || '';
              return '<div class="mq-item">' + imgWithFallback(IMG.item(it.id), nm, '') + '<i>' + esc(nm) + '</i></div>';
            }).join('') +
            '<div class="mq-sub">' + core0.wr.toFixed(2) + '% 胜率</div></div></div>' : '') +
          '<div class="mq-card"><div class="mq-title">出门装</div>' +
            '<div class="mq-body mq-items">' + build.starting.slice(0, 3).map(function (it) {
              return '<div class="mq-item">' + imgWithFallback(IMG.item(it.id), it.name || '', '') + '<i>' + esc(it.name || '') + '</i></div>';
            }).join('') + '</div></div>' +
          '<div class="mq-card"><div class="mq-title">鞋子</div>' +
            '<div class="mq-body mq-items">' + build.boots.slice(0, 2).map(function (it) {
              return '<div class="mq-item">' + imgWithFallback(IMG.item(it.id), it.name || '', '') + '<i>' + esc(it.name || '') + '</i></div>';
            }).join('') + '</div></div>' +
        '</div>';
    }

    /* 符文列表（按稀有度分组，组内按胜率降序） */
    var rarityGroups = [
      { key: 'prismatic', label: '棱彩', cls: 'rr-prismatic' },
      { key: 'gold', label: '金色', cls: 'rr-gold' },
      { key: 'silver', label: '银色', cls: 'rr-silver' },
    ];
    var rarityFilterHtml = [
      { key: '全部', cls: '' },
      { key: 'prismatic', label: '棱彩', cls: 'rr-prismatic' },
      { key: 'gold', label: '金色', cls: 'rr-gold' },
      { key: 'silver', label: '银色', cls: 'rr-silver' },
    ].map(function (r) {
      var lbl = r.label || r.key;
      var act = matchState.rarity === r.key ? ' active' : '';
      return '<button class="chip aug-chip' + act + '" data-rarity="' + r.key + '">' +
        (r.cls ? '<span class="rdot ' + r.cls + '"></span>' : '') + esc(lbl) + '</button>';
    }).join('');

    view.innerHTML =
      '<div class="fade-in">' +
        '<div class="back-bar">' +
          '<a class="back-btn" href="#/match" data-nav>← 重新选英雄</a>' +
          '<span class="crumb">对局模式 · 出装与符文推荐</span>' +
        '</div>' +

        '<div class="hero-card match-hero">' +
          '<div class="hero-avatar">' + imgWithFallback(IMG.champion(hero.id), hero.name, '') + '</div>' +
          '<div class="hero-meta">' +
            '<span class="tier-tag ' + tierClass(hero.tier) + '">' + esc(hero.tier) + ' 级</span>' +
            '<h2>' + esc(hero.alias) + '<span>' + esc(hero.name) + '</span></h2>' +
            '<div class="stats">' +
              '<div class="stat-box"><div class="num ' + wrClass(hero.wr) + '">' + hero.wr.toFixed(2) + '%</div><div class="lbl">胜率 WR</div></div>' +
              '<div class="stat-box"><div class="num">' + hero.pr.toFixed(2) + '%</div><div class="lbl">登场率 PR</div></div>' +
              (hero.rank ? '<div class="stat-box"><div class="num" style="color:var(--gold)">#' + hero.rank + '</div><div class="lbl">全英雄排名</div></div>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +

        quickHtml +

        '<div class="section match-rune-sec">' +
          '<div class="section-title">强化符文推荐<span class="note">② 点选你看到的候选 → ③ 推荐最优</span></div>' +

          /* 推荐卡（动态更新） */
          '<div id="recCard" class="rec-card"></div>' +

          /* 已选 */
          '<div id="pickedChips" class="picked-area"></div>' +

          /* 搜索 + 稀有度筛选 */
          '<div class="search-wrap">' +
            '<div class="search-box">' +
              '<input type="search" id="augSearch" placeholder="搜索符文，如：坦克引擎" aria-label="搜索符文">' +
              '<span class="search-icon">🔍</span>' +
            '</div>' +
            '<div class="filters" id="rarityFilters">' + rarityFilterHtml + '</div>' +
          '</div>' +

          /* 符文列表 */
          '<div id="augList" class="aug-list">' + renderAugList(hot) + '</div>' +

          /* 本局记录 */
          '<div class="match-pick-log">' +
            '<div class="mpl-head"><span>本局已选符文</span><span class="mpl-count" id="pickCount">0 / 4</span></div>' +
            '<div id="pickLog" class="pick-log"></div>' +
            '<div class="mpl-actions">' +
              '<button class="mini-btn" id="undoPick" type="button">撤销上一个</button>' +
              '<button class="mini-btn danger" id="resetPicks" type="button">清空本局</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    bindMatchEvents();
    updateMatchUI();
  }

  function renderAugList(hot) {
    var kw = matchState.q.trim().toLowerCase();
    var groups = [
      { key: 'prismatic', label: '棱彩', cls: 'rr-prismatic' },
      { key: 'gold', label: '金色', cls: 'rr-gold' },
      { key: 'silver', label: '银色', cls: 'rr-silver' },
    ];
    var html = groups.map(function (g) {
      var items = AUGMENTS.filter(function (a) {
        if (a.rarity !== g.key) return false;
        if (matchState.rarity !== '全部' && matchState.rarity !== g.key) return false;
        if (kw && a.name.toLowerCase().indexOf(kw) === -1) return false;
        return true;
      });
      if (!items.length) return '';
      var rows = items.map(function (a) {
        var sel = matchState.selected.indexOf(a.name) !== -1;
        var hotRank = hot[a.name];
        return (
          '<button type="button" class="aug-row' + (sel ? ' selected' : '') + '" data-name="' + esc(a.name) + '">' +
            '<span class="aug-dot ' + a.rarity + '"></span>' +
            '<span class="aug-name">' + esc(a.name) +
              (hotRank ? '<em class="hot-badge">本英雄热榜 #' + hotRank + '</em>' : '') +
            '</span>' +
            '<span class="aug-nums">' +
              '<span class="aug-wr">' + a.wr.toFixed(2) + '%</span>' +
              '<span class="aug-pr">登场 ' + a.pr.toFixed(2) + '%</span>' +
            '</span>' +
            '<span class="aug-check">' + (sel ? '✓' : '+') + '</span>' +
          '</button>'
        );
      }).join('');
      return (
        '<div class="aug-group">' +
          '<div class="aug-group-head"><span class="rdot ' + g.cls + '"></span>' + g.label + '<em>' + items.length + '</em></div>' +
          rows +
        '</div>'
      );
    }).join('');
    return html || '<div class="empty-state"><div class="empty-icon">🔍</div><p>没有匹配的符文</p></div>';
  }

  function updateMatchUI() {
    var hot = heroHotMap(matchState.hero);
    var pool = getRecommendation();
    var recCard = document.getElementById('recCard');
    var pickedChips = document.getElementById('pickedChips');

    /* 推荐卡 */
    if (recCard) {
      if (!pool.length) {
        recCard.className = 'rec-card idle';
        recCard.innerHTML = '<div class="rec-idle">对局中出现候选符文时，<b>点选你看到的符文</b>，工具自动推荐最适合 ' +
          esc((HEROES.find(function (h) { return h.id === matchState.hero; }) || {}).alias || '') + ' 的选择</div>';
      } else {
        var best = pool[0];
        var reason;
        if (pool.length === 1) {
          reason = '当前唯一候选';
        } else {
          var diff = best.wr - pool[1].wr;
          reason = '胜率 <b>' + best.wr.toFixed(2) + '%</b>，比第二名高 ' + diff.toFixed(2) + ' 个百分点';
        }
        recCard.className = 'rec-card active';
        recCard.innerHTML =
          '<div class="rec-label">🏆 推荐选择</div>' +
          '<div class="rec-main">' +
            '<span class="aug-dot ' + best.rarity + '"></span>' +
            '<span class="rec-name">' + esc(best.name) + '</span>' +
            '<span class="rec-wr">' + best.wr.toFixed(2) + '%</span>' +
          '</div>' +
          '<div class="rec-reason">' + reason +
            (hot[best.name] ? ' · <b class="hot-text">本英雄热榜 #' + hot[best.name] + '</b>' : '') + '</div>' +
          '<button type="button" class="rec-confirm" id="confirmPick">确定选择（加入本局）</button>';
      }
    }

    /* 已选 chips */
    if (pickedChips) {
      if (!pool.length) {
        pickedChips.innerHTML = '';
      } else {
        pickedChips.innerHTML =
          '<div class="picked-label">当前候选（按胜率排序）：</div>' +
          pool.map(function (a, i) {
            return (
              '<span class="picked-chip' + (i === 0 ? ' top' : '') + '" data-name="' + esc(a.name) + '">' +
                (i === 0 ? '<i class="pc-crown">★</i>' : '') +
                esc(a.name) + ' <b>' + a.wr.toFixed(2) + '%</b><i class="pc-x">✕</i>' +
              '</span>'
            );
          }).join('');
      }
    }

    /* 列表选中态 */
    var rows = document.querySelectorAll('.aug-row');
    Array.prototype.forEach.call(rows, function (row) {
      var on = matchState.selected.indexOf(row.getAttribute('data-name')) !== -1;
      row.classList.toggle('selected', on);
      row.querySelector('.aug-check').textContent = on ? '✓' : '+';
    });

    /* 本局记录 */
    var pickLog = document.getElementById('pickLog');
    var pickCount = document.getElementById('pickCount');
    if (pickLog) {
      pickCount.textContent = matchState.picked.length + ' / 4';
      pickLog.innerHTML = matchState.picked.length
        ? matchState.picked.map(function (name) {
            var a = AUGMENTS.find(function (x) { return x.name === name; });
            return '<span class="pick-log-item"><i class="aug-dot ' + (a ? a.rarity : '') + '"></i>' +
              esc(name) + (a ? ' <b>' + a.wr.toFixed(2) + '%</b>' : '') + '</span>';
          }).join('')
        : '<span class="pick-log-empty">还没有确定选择 · 共 4 次强化机会</span>';
    }
  }

  function bindMatchEvents() {
    /* 符文行 toggle */
    var augList = document.getElementById('augList');
    if (augList) {
      augList.addEventListener('click', function (e) {
        var row = e.target.closest('.aug-row');
        if (!row) return;
        var name = row.getAttribute('data-name');
        var idx = matchState.selected.indexOf(name);
        if (idx === -1) {
          if (matchState.selected.length >= 6) return;
          matchState.selected.push(name);
        } else {
          matchState.selected.splice(idx, 1);
        }
        updateMatchUI();
      });
    }

    /* 搜索 */
    var augSearch = document.getElementById('augSearch');
    if (augSearch) {
      augSearch.addEventListener('input', function (e) {
        matchState.q = e.target.value;
        var list = document.getElementById('augList');
        if (list) list.innerHTML = renderAugList(heroHotMap(matchState.hero));
      });
    }

    /* 稀有度筛选 */
    var rarityFilters = document.getElementById('rarityFilters');
    if (rarityFilters) {
      rarityFilters.addEventListener('click', function (e) {
        var chip = e.target.closest('.aug-chip');
        if (!chip) return;
        matchState.rarity = chip.getAttribute('data-rarity');
        Array.prototype.forEach.call(rarityFilters.querySelectorAll('.aug-chip'), function (c) {
          c.classList.toggle('active', c === chip);
        });
        var list = document.getElementById('augList');
        if (list) list.innerHTML = renderAugList(heroHotMap(matchState.hero));
      });
    }

    /* 已选 chips 移除 */
    var pickedChips = document.getElementById('pickedChips');
    if (pickedChips) {
      pickedChips.addEventListener('click', function (e) {
        var chip = e.target.closest('.picked-chip');
        if (!chip) return;
        var name = chip.getAttribute('data-name');
        var idx = matchState.selected.indexOf(name);
        if (idx !== -1) matchState.selected.splice(idx, 1);
        updateMatchUI();
      });
    }

    /* 确定选择 */
    document.addEventListener('click', function confirmOnce(e) {
      if (e.target && e.target.id === 'confirmPick') {
        var pool = getRecommendation();
        if (!pool.length) return;
        var best = pool[0];
        if (matchState.picked.length < 4) {
          matchState.picked.push(best.name);
          savePicked();
        }
        matchState.selected = [];
        updateMatchUI();
      }
    });

    /* 撤销 / 清空 */
    var undoPick = document.getElementById('undoPick');
    if (undoPick) {
      undoPick.addEventListener('click', function () {
        matchState.picked.pop();
        savePicked();
        updateMatchUI();
      });
    }
    var resetPicks = document.getElementById('resetPicks');
    if (resetPicks) {
      resetPicks.addEventListener('click', function () {
        matchState.picked = [];
        savePicked();
        updateMatchUI();
      });
    }
  }

  /* ---------- 路由 ---------- */
  function router() {
    var hash = location.hash || '#/';
    if (hash.indexOf('#/champion/') === 0) {
      var id = decodeURIComponent(hash.slice('#/champion/'.length));
      renderDetail(id);
    } else if (hash.indexOf('#/match/') === 0) {
      var mid = decodeURIComponent(hash.slice('#/match/'.length));
      renderMatch(mid);
    } else if (hash === '#/match') {
      renderMatchPicker();
    } else {
      renderHome();
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', router);
  versionChip.textContent = APP.patch;

  /* 首次渲染 */
  router();
})();
