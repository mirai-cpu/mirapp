// app.js

document.addEventListener('DOMContentLoaded', async () => {

  // ── i18n init (fetch JSON before anything else) ────────────────
  try { await I18n.init(); } catch (e) { console.warn('i18n load failed:', e); }

  // ── Tab switching ──────────────────────────────────────────────
  const tabBtns   = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  function switchTab(tabId) {
    tabBtns.forEach(btn =>
      btn.classList.toggle('active', btn.dataset.tab === tabId)
    );
    tabPanels.forEach(panel =>
      panel.classList.toggle('active', panel.id === 'tab-' + tabId)
    );
    if (tabId === 'stats')   renderStats();
    if (tabId === 'history') renderHistory();
  }

  tabBtns.forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  );

  // ── Always dark mode ───────────────────────────────────────────
  document.documentElement.setAttribute('data-theme', 'dark');

  // ── Color theme ────────────────────────────────────────────────
  const COLOR_THEMES = {
    '#ffd700': { accentBg: 'rgba(255,215,0,0.1)',    glow: '0 0 24px rgba(255,215,0,0.2)' },
    '#64ffda': { accentBg: 'rgba(100,255,218,0.1)',  glow: '0 0 24px rgba(100,255,218,0.2)' },
    '#60a5fa': { accentBg: 'rgba(96,165,250,0.1)',   glow: '0 0 24px rgba(96,165,250,0.2)' },
    '#f472b6': { accentBg: 'rgba(244,114,182,0.1)',  glow: '0 0 24px rgba(244,114,182,0.2)' },
    '#a78bfa': { accentBg: 'rgba(167,139,250,0.1)',  glow: '0 0 24px rgba(167,139,250,0.2)' },
    '#34d399': { accentBg: 'rgba(52,211,153,0.1)',   glow: '0 0 24px rgba(52,211,153,0.2)' },
    '#fb923c': { accentBg: 'rgba(251,146,60,0.1)',   glow: '0 0 24px rgba(251,146,60,0.2)' },
    '#f87171': { accentBg: 'rgba(248,113,113,0.1)',  glow: '0 0 24px rgba(248,113,113,0.2)' },
  };

  const colorBtn     = document.getElementById('btn-color');
  const colorPalette = document.getElementById('color-palette');
  const colorDot     = document.getElementById('color-dot');
  const savedColor   = localStorage.getItem('accentColor') || '#ffd700';
  applyColor(savedColor);

  colorBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = colorBtn.getBoundingClientRect();
    colorPalette.style.top  = (rect.bottom + 6) + 'px';
    colorPalette.style.right = (window.innerWidth - rect.right) + 'px';
    colorPalette.classList.toggle('open');
  });

  document.addEventListener('click', () => colorPalette.classList.remove('open'));

  colorPalette.addEventListener('click', (e) => {
    const swatch = e.target.closest('.palette-swatch');
    if (!swatch) return;
    applyColor(swatch.dataset.color);
    localStorage.setItem('accentColor', swatch.dataset.color);
    colorPalette.classList.remove('open');
  });

  function applyColor(color) {
    const theme = COLOR_THEMES[color] || COLOR_THEMES['#ffd700'];
    const root = document.documentElement;
    root.style.setProperty('--accent',     color);
    root.style.setProperty('--accent-bg',  theme.accentBg);
    root.style.setProperty('--glow-gold',  theme.glow);
    if (colorDot) colorDot.style.background = color;
    document.querySelectorAll('.palette-swatch').forEach(s =>
      s.classList.toggle('active', s.dataset.color === color)
    );
  }

  // ── Language toggle ────────────────────────────────────────────
  const langBtn = document.getElementById('lang-toggle');
  updateLangBtn();

  langBtn.addEventListener('click', async () => {
    const next = I18n.getLang() === 'ja' ? 'en' : 'ja';
    await I18n.setLang(next);
    updateLangBtn();
    refreshAll();
  });

  function updateLangBtn() {
    langBtn.textContent = I18n.getLang() === 'ja' ? 'EN' : 'JA';
  }

  // ── Form state ─────────────────────────────────────────────────
  const POS_INFIELD = [1, 2, 3, 4, 5, 6];
  const POS_ALL     = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  // i18n が未ロードの場合のポジション名フォールバック
  const POS_FALLBACK = { 1:'投手', 2:'捕手', 3:'一塁', 4:'二塁', 5:'三塁', 6:'遊撃', 7:'左翼', 8:'中堅', 9:'右翼' };

  // 守備位置番号 → フィールドゾーンID
  const POS_TO_ZONE = { 1:'if2', 3:'if1', 4:'if2b', 5:'if3', 6:'ifss', 7:'lf', 8:'cf', 9:'rf' };

  const FIELDER_POS_MAP = {
    single: POS_ALL,
    go:     POS_ALL,
    fo:     POS_ALL,
    lo:     POS_ALL,
    e:      POS_ALL,
    sf:     POS_ALL,
    sb:     POS_INFIELD,
    dp:     POS_INFIELD,
  };

  const INFIELD_ONLY_RESULTS = new Set(['sb', 'dp']);

  let pitcherHand    = 'R';
  let selectedResult = null;
  let selectedKType  = null;
  let infieldHit     = false;
  let selectedPos    = null;
  let selectedDir    = null;
  let rbiValue       = 0;
  let editingId      = null;
  let selectedOrder  = null;

  // ── DOM refs ───────────────────────────────────────────────────
  const inputDate         = document.getElementById('input-date');
  const inputOpponent     = document.getElementById('input-opponent');
  const resultButtons     = document.getElementById('result-buttons');
  const kTypeGroup        = document.getElementById('k-type-group');
  const infieldHitGroup   = document.getElementById('infield-hit-group');
  const infieldHitBtn     = document.getElementById('infield-hit-btn');
  const fielderPosGroup   = document.getElementById('fielder-pos-group');
  const fielderPosButtons = document.getElementById('fielder-pos-buttons');
  const directionGroup    = document.getElementById('direction-group');
  const directionLabel    = document.getElementById('direction-label');
  const rbiDisplay        = document.getElementById('rbi-display');
  const inputMemo         = document.getElementById('input-memo');
  const formSubmit        = document.getElementById('form-submit');
  const formClear         = document.getElementById('form-clear');
  const atbatForm         = document.getElementById('atbat-form');

  // ── Init date & opponent ───────────────────────────────────────
  inputDate.value     = new Date().toISOString().slice(0, 10);
  inputOpponent.value = Storage.getLastOpponent();

  // ── 「今日」ボタン ────────────────────────────────────────────
  document.getElementById('btn-today').addEventListener('click', () => {
    inputDate.value = new Date().toISOString().slice(0, 10);
  });

  // ── Pitcher hand buttons ───────────────────────────────────────
  const pitcherHandButtons = document.getElementById('pitcher-hand-buttons');

  function updateHandButtons() {
    pitcherHandButtons.querySelectorAll('.hand-btn').forEach(b =>
      b.classList.toggle('selected', b.dataset.hand === pitcherHand)
    );
  }

  pitcherHandButtons.querySelectorAll('.hand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      pitcherHand = btn.dataset.hand;
      updateHandButtons();
    });
  });

  // ── Batting order buttons ───────────────────────────────────────
  const battingOrderButtons = document.getElementById('batting-order-buttons');
  battingOrderButtons.querySelectorAll('.hand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const order = parseInt(btn.dataset.order);
      selectedOrder = selectedOrder === order ? null : order;
      battingOrderButtons.querySelectorAll('.hand-btn').forEach(b =>
        b.classList.toggle('selected', parseInt(b.dataset.order) === selectedOrder)
      );
    });
  });

  // ── Result buttons ─────────────────────────────────────────────
  resultButtons.querySelectorAll('.result-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const result = btn.dataset.result;
      if (selectedResult === result) {
        selectedResult = null;
        btn.classList.remove('selected');
        selectedKType = null;
        infieldHit    = false;
        selectedPos   = null;
        selectedDir   = null;
      } else {
        resultButtons.querySelectorAll('.result-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedKType = null;
        infieldHit    = false;

        // ポジションが選択済みで、新しい結果でもそのポジションが有効かチェック
        const newPosSet = FIELDER_POS_MAP[result];
        if (selectedPos && newPosSet && newPosSet.includes(selectedPos)) {
          // ポジション維持・方向を再マッピング
          selectedDir = POS_TO_ZONE[selectedPos] || selectedDir;
        } else {
          // 新しい結果でポジション不適合 → リセット
          selectedPos = null;
          selectedDir = null;
        }

        selectedResult = result;
      }
      updateSubSections();
    });
  });

  function updateSubSections() {
    const rt = RESULT_TYPES[selectedResult];

    // k-type sub-section
    if (selectedResult === 'k') {
      kTypeGroup.style.display = '';
      kTypeGroup.querySelectorAll('.choice-btn').forEach(b =>
        b.classList.toggle('selected', b.dataset.ktype === selectedKType)
      );
    } else {
      kTypeGroup.style.display = 'none';
    }

    // infield-hit toggle (single only)
    if (selectedResult === 'single') {
      infieldHitGroup.style.display = '';
      infieldHitBtn.classList.toggle('active', infieldHit);
    } else {
      infieldHitGroup.style.display = 'none';
      infieldHit = false;
    }

    // fielder position
    const posSet = selectedResult ? FIELDER_POS_MAP[selectedResult] : null;
    if (posSet) {
      fielderPosGroup.style.display = '';
      const positions = (selectedResult === 'single' && infieldHit) ? POS_INFIELD : posSet;
      buildFielderPosButtons(positions);
    } else {
      fielderPosGroup.style.display = 'none';
      selectedPos = null;
    }

    // direction
    if (rt && rt.showDir) {
      directionGroup.style.display = '';
      const infieldOnly = INFIELD_ONLY_RESULTS.has(selectedResult) ||
                          (selectedResult === 'single' && infieldHit);
      const showBS = false;
      Field.render('field-diagram', selectedDir, zone => {
        selectedDir = zone;
        directionLabel.textContent = zone ? Field.getZoneName(zone) : '';
      }, infieldOnly, showBS);
      directionLabel.textContent = selectedDir ? Field.getZoneName(selectedDir) : '';
    } else {
      directionGroup.style.display = 'none';
      selectedDir = null;
    }
  }

  function buildFielderPosButtons(positions) {
    fielderPosButtons.innerHTML = positions.map(p => {
      const t = I18n.t('pos.' + p);
      const label = t.startsWith('pos.') ? (POS_FALLBACK[p] ?? t) : t;
      return `<button type="button" class="pos-btn${selectedPos === p ? ' selected' : ''}" data-pos="${p}">${label}</button>`;
    }).join('');
    fielderPosButtons.querySelectorAll('.pos-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pos = parseInt(btn.dataset.pos);
        selectedPos = selectedPos === pos ? null : pos;
        if (selectedPos) {
          // ポジションに対応するゾーンを常に更新
          const autoZone = POS_TO_ZONE[selectedPos] || null;
          if (autoZone) {
            selectedDir = autoZone;
            directionLabel.textContent = Field.getZoneName(autoZone);
          }
        } else {
          // ポジション解除時は方向もクリア
          selectedDir = null;
          directionLabel.textContent = '';
        }
        buildFielderPosButtons(positions);
        // フィールド図を更新
        const infieldOnly = INFIELD_ONLY_RESULTS.has(selectedResult) || (selectedResult === 'single' && infieldHit);
        Field.render('field-diagram', selectedDir, zone => {
          selectedDir = zone;
          directionLabel.textContent = zone ? Field.getZoneName(zone) : '';
        }, infieldOnly, false);
      });
    });
  }

  // ── K-type buttons ─────────────────────────────────────────────
  kTypeGroup.addEventListener('click', e => {
    const btn = e.target.closest('.choice-btn');
    if (!btn) return;
    selectedKType = selectedKType === btn.dataset.ktype ? null : btn.dataset.ktype;
    updateSubSections();
  });

  // ── Infield hit toggle ─────────────────────────────────────────
  infieldHitBtn.addEventListener('click', () => {
    infieldHit  = !infieldHit;
    selectedPos = null;
    selectedDir = null;
    updateSubSections();
  });

  // ── RBI counter ────────────────────────────────────────────────
  document.getElementById('rbi-minus').addEventListener('click', () => {
    if (rbiValue > 0) { rbiValue--; rbiDisplay.textContent = rbiValue; }
  });
  document.getElementById('rbi-plus').addEventListener('click', () => {
    if (rbiValue < 9) { rbiValue++; rbiDisplay.textContent = rbiValue; }
  });

  // ── Form submit ────────────────────────────────────────────────
  atbatForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!selectedResult) {
      showToast(I18n.t('msg.selectResult'));
      return;
    }

    const atBat = {
      date:         inputDate.value || new Date().toISOString().slice(0, 10),
      opponent:     inputOpponent.value.trim(),
      pitcherHand:  pitcherHand,
      result:       selectedResult,
      kType:        selectedKType  || null,
      infieldHit:   infieldHit     || false,
      fielderPos:   selectedPos    || null,
      direction:    selectedDir    || null,
      rbi:          rbiValue,
      memo:         inputMemo.value.trim(),
      battingOrder: selectedOrder  || null,
    };

    if (atBat.opponent) Storage.setLastOpponent(atBat.opponent);

    if (editingId !== null) {
      Storage.update(editingId, atBat);
      editingId = null;
      formSubmit.textContent = I18n.t('form.submit');
      showToast(I18n.t('msg.updated'));
    } else {
      Storage.add(atBat);
      if (typeof gtag === 'function') gtag('event', 'tool_used', { tool_name: 'batting-stats', action: 'record_atbat' });
      showToast(I18n.t('msg.saved'));
    }

    resetForm();
  });

  // ── Form clear ─────────────────────────────────────────────────
  formClear.addEventListener('click', () => {
    editingId = null;
    formSubmit.textContent = I18n.t('form.submit');
    resetForm();
  });

  function resetForm() {
    pitcherHand    = 'R';
    selectedResult = null;
    selectedOrder  = null;
    battingOrderButtons.querySelectorAll('.hand-btn').forEach(b => b.classList.remove('selected'));
    selectedKType  = null;
    infieldHit     = false;
    selectedPos    = null;
    selectedDir    = null;
    rbiValue       = 0;
    resultButtons.querySelectorAll('.result-btn').forEach(b => b.classList.remove('selected'));
    rbiDisplay.textContent = '0';
    inputMemo.value = '';
    updateHandButtons();
    updateSubSections();
  }

  // ── Footer lang toggle ───────────────────────────────────────────
  const footerLangBtn = document.getElementById('footer-lang-toggle');
  if (footerLangBtn) {
    _updateFooterLangBtn();
    footerLangBtn.addEventListener('click', async () => {
      const next = I18n.getLang() === 'ja' ? 'en' : 'ja';
      await I18n.setLang(next);
      updateLangBtn();
      _updateFooterLangBtn();
      refreshAll();
    });
  }
  function _updateFooterLangBtn() {
    if (footerLangBtn) footerLangBtn.textContent = I18n.getLang() === 'ja' ? 'EN' : 'JA';
  }

  // ── Stats tab ──────────────────────────────────────────────────
  const statsFilter         = document.getElementById('stats-filter');
  const opponentFilter      = document.getElementById('opponent-filter');
  const dateRangePicker     = document.getElementById('date-range-picker');
  const dateFrom            = document.getElementById('date-from');
  const dateTo              = document.getElementById('date-to');
  const statAvg             = document.getElementById('stat-avg');
  const statObp             = document.getElementById('stat-obp');
  const statSlg             = document.getElementById('stat-slg');
  const statOps             = document.getElementById('stat-ops');
  const statsTableContainer = document.getElementById('stats-table-container');

  statsFilter.addEventListener('change', () => {
    dateRangePicker.style.display = statsFilter.value === 'custom' ? '' : 'none';
    renderStats();
  });
  opponentFilter.addEventListener('change', renderStats);
  dateFrom.addEventListener('change', renderStats);
  dateTo.addEventListener('change', renderStats);

  function getFilteredAtBats() {
    let abs;
    if (statsFilter.value === 'custom') {
      abs = Storage.load().filter(ab => {
        const d = ab.date || '';
        if (dateFrom.value && d < dateFrom.value) return false;
        if (dateTo.value   && d > dateTo.value)   return false;
        return true;
      });
    } else {
      abs = Stats.filterAtBats(Storage.load(), statsFilter.value);
    }
    const opp = opponentFilter.value;
    if (opp !== 'all') abs = abs.filter(ab => ab.opponent === opp);
    return abs;
  }

  document.getElementById('trend-show-ops').addEventListener('change', () => {
    Charts.renderBattingTrendChart(getFilteredAtBats());
  });
  document.getElementById('trend-show-250').addEventListener('change', () => {
    Charts.renderBattingTrendChart(getFilteredAtBats());
  });
  document.getElementById('trend-show-movavg').addEventListener('change', () => {
    Charts.renderBattingTrendChart(getFilteredAtBats());
  });
  document.getElementById('trend-target-avg').addEventListener('input', () => {
    Charts.renderBattingTrendChart(getFilteredAtBats());
  });

  function renderStats() {
    const atBats = Storage.load();
    const years  = Stats.getYears(atBats);
    const prev   = statsFilter.value;

    statsFilter.innerHTML =
      `<option value="all">${I18n.t('filter.all')}</option>` +
      `<option value="last5">${I18n.t('filter.last5')}</option>` +
      `<option value="last10">${I18n.t('filter.last10')}</option>` +
      years.map(y =>
        `<option value="season:${y}">${y}${I18n.t('filter.seasonSuffix')}</option>`
      ).join('') +
      `<option value="custom">期間指定</option>`;

    const valid = ['all', 'last5', 'last10', 'custom', ...years.map(y => 'season:' + y)];
    if (valid.includes(prev)) statsFilter.value = prev;
    dateRangePicker.style.display = statsFilter.value === 'custom' ? '' : 'none';

    // 対戦相手フィルターを更新
    const opponents = Stats.getOpponents(atBats);
    const prevOpp   = opponentFilter.value;
    opponentFilter.innerHTML =
      `<option value="all">全チーム</option>` +
      opponents.map(opp => `<option value="${opp}">${opp}</option>`).join('');
    if (opponents.includes(prevOpp)) opponentFilter.value = prevOpp;

    const filtered = Stats.filterAtBats(atBats, statsFilter.value);

    const s = Stats.calculate(filtered);
    statAvg.textContent = Stats.fmtAvg(s.avg);
    statObp.textContent = Stats.fmtRate(s.obp);
    statSlg.textContent = Stats.fmtRate(s.slg);
    statOps.textContent = Stats.fmtOps(s.ops);

    Charts.renderAll(filtered);
    Charts.renderSprayDirSummary(filtered, _dirSummaryMode);
    renderVsHandSection(filtered);
    renderDiagnosis(filtered);
    renderAbilities(filtered);
    renderStreakRow(atBats);
    renderVsOpponentSection(filtered);
    renderBattingOrderSection(filtered);
    renderGoalSection(filtered);
    renderConditionSection(filtered);

    if (filtered.length === 0) {
      statsTableContainer.innerHTML = `<p class="empty-state">${I18n.t('stats.noData')}</p>`;
      return;
    }

    const tl = key => I18n.t('stat.' + key);
    statsTableContainer.innerHTML = `
      <table class="stats-table">
        <tbody>
          <tr><th>${tl('games')}</th><td>${s.games}</td><th>${tl('pa')}</th><td>${s.pa}</td></tr>
          <tr><th>${tl('ab')}</th><td>${s.ab}</td><th>${tl('h')}</th><td>${s.h}</td></tr>
          <tr><th>${tl('tb')}</th><td>${s.tb}</td><th>${tl('rbi')}</th><td>${s.rbi}</td></tr>
          <tr><th>${tl('double')}</th><td>${s.double}</td><th>${tl('triple')}</th><td>${s.triple}</td></tr>
          <tr><th>${tl('hr')}</th><td>${s.hr}</td><th>${tl('k')}</th><td>${s.k}</td></tr>
          <tr><th>${tl('bb')}</th><td>${s.bb}</td><th>${tl('hbp')}</th><td>${s.hbp}</td></tr>
          <tr><th>${tl('dp')}</th><td>${s.dp}</td><th>${tl('go')}</th><td>${s.go}</td></tr>
          <tr><th>${tl('fo')}</th><td>${s.fo}</td><th>${tl('lo')}</th><td>${s.lo}</td></tr>
          <tr><th>${tl('sb')}</th><td>${s.sb}</td><th>${tl('sf')}</th><td>${s.sf}</td></tr>
          <tr><th>${tl('e')}</th><td>${s.e}</td><td colspan="2"></td></tr>
          <tr class="stats-table-divider"><td colspan="4"></td></tr>
          <tr><th>${tl('vsR')}</th><td colspan="3">${Stats.fmtAvg(s.vsR.avg)} (${s.vsR.h}/${s.vsR.ab})</td></tr>
          <tr><th>${tl('vsL')}</th><td colspan="3">${Stats.fmtAvg(s.vsL.avg)} (${s.vsL.h}/${s.vsL.ab})</td></tr>
        </tbody>
      </table>`;
  }

  // ── ストリーク表示 ────────────────────────────────────────────
  function renderStreakRow(atBats) {
    const { current, max } = Stats.getHitStreak(atBats);
    const row = document.getElementById('streak-row');
    if (!row) return;
    if (max === 0) { row.style.display = 'none'; return; }
    row.style.display = 'flex';
    document.getElementById('streak-current-num').textContent = current + '試合';
    document.getElementById('streak-max-num').textContent     = max + '試合';
    document.getElementById('streak-current').style.borderColor = current >= 3 ? '#f59e0b' : '';
    document.getElementById('streak-current').style.color       = current >= 3 ? '#f59e0b' : '';
  }

  // ── 対チーム別成績テーブル ────────────────────────────────────
  function renderVsOpponentSection(atBats) {
    const section = document.getElementById('vs-opponent-section');
    const container = document.getElementById('vs-opponent-table');
    if (!section || !container) return;
    const rows = Stats.calcStatsByOpponent(atBats);
    if (rows.length === 0) { section.style.display = 'none'; return; }
    section.style.display = '';
    container.innerHTML = `
      <table class="stats-table vs-opp-table">
        <thead><tr>
          <th style="text-align:left">相手チーム</th>
          <th>試合</th><th>打席</th><th>安打</th><th>HR</th><th>打率</th><th>OPS</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td style="text-align:left;font-weight:600;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.team}</td>
            <td>${r.games}</td><td>${r.pa}</td><td>${r.h}</td><td>${r.hr}</td>
            <td style="font-weight:700;color:var(--accent)">${Stats.fmtAvg(r.avg)}</td>
            <td>${Stats.fmtOps(r.ops)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  // ── 打順別成績テーブル ────────────────────────────────────────
  function renderBattingOrderSection(atBats) {
    const section = document.getElementById('batting-order-section');
    const container = document.getElementById('batting-order-table');
    if (!section || !container) return;
    const rows = Stats.calcStatsByBattingOrder(atBats);
    if (rows.length === 0) { section.style.display = 'none'; return; }
    section.style.display = '';
    container.innerHTML = `
      <table class="stats-table">
        <thead><tr>
          <th>打順</th><th>打席</th><th>打数</th><th>安打</th><th>打率</th><th>OPS</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td style="font-weight:700">${r.order}番</td>
            <td>${r.pa}</td><td>${r.ab}</td><td>${r.h}</td>
            <td style="font-weight:700;color:var(--accent)">${Stats.fmtAvg(r.avg)}</td>
            <td>${Stats.fmtOps(r.ops)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  // ── Vs pitcher hand section ────────────────────────────────────
  function renderVsHandSection(filtered) {
    const sR = Stats.calcStatsByPitcherHand('R', filtered);
    const sL = Stats.calcStatsByPitcherHand('L', filtered);

    function barWidth(avg) {
      return avg !== null ? Math.min(100, (avg / 0.5) * 100).toFixed(1) + '%' : '0%';
    }

    document.getElementById('vs-r-avg').textContent = Stats.fmtAvg(sR.avg);
    document.getElementById('vs-r-bar').style.width  = barWidth(sR.avg);
    document.getElementById('vs-r-obp').textContent  = Stats.fmtRate(sR.obp);
    document.getElementById('vs-r-slg').textContent  = Stats.fmtRate(sR.slg);
    document.getElementById('vs-r-ops').textContent  = Stats.fmtOps(sR.ops);
    document.getElementById('vs-r-pa').textContent   = sR.pa;
    document.getElementById('vs-r-ab').textContent   = sR.ab;
    document.getElementById('vs-r-h').textContent    = sR.h;

    const dirR = Stats.directionsByResult(filtered.filter(ab => ab.pitcherHand === 'R'));
    Field.renderSpray('spray-vs-r', dirR);

    const lNodata  = document.getElementById('vs-l-nodata');
    const lContent = document.getElementById('vs-l-content');
    if (sL.pa === 0) {
      lNodata.style.display  = '';
      lContent.style.display = 'none';
    } else {
      lNodata.style.display  = 'none';
      lContent.style.display = '';
      document.getElementById('vs-l-avg').textContent = Stats.fmtAvg(sL.avg);
      document.getElementById('vs-l-bar').style.width  = barWidth(sL.avg);
      document.getElementById('vs-l-obp').textContent  = Stats.fmtRate(sL.obp);
      document.getElementById('vs-l-slg').textContent  = Stats.fmtRate(sL.slg);
      document.getElementById('vs-l-ops').textContent  = Stats.fmtOps(sL.ops);
      document.getElementById('vs-l-pa').textContent   = sL.pa;
      document.getElementById('vs-l-ab').textContent   = sL.ab;
      document.getElementById('vs-l-h').textContent    = sL.h;

      const dirL = Stats.directionsByResult(filtered.filter(ab => ab.pitcherHand === 'L'));
      Field.renderSpray('spray-vs-l', dirL);
    }
  }

  // ── 打者タイプ診断 ─────────────────────────────────────────────
  function renderDiagnosis(atBats) {
    const s    = Stats.calculate(atBats);
    const diag = Stats.getDiagnosis(s);
    const notEnoughEl = document.getElementById('diag-not-enough');
    const resultEl    = document.getElementById('diag-result');
    if (!notEnoughEl || !resultEl) return;

    if (!diag.typeKey) {
      notEnoughEl.textContent  = I18n.t('diag.notEnough').replace('{n}', diag.remaining);
      notEnoughEl.style.display = '';
      resultEl.style.display    = 'none';
      Charts.destroyDiagnosisChart();
      return;
    }
    notEnoughEl.style.display = 'none';
    resultEl.style.display    = '';
    document.getElementById('diag-type-name').textContent = I18n.t(diag.typeKey);
    document.getElementById('diag-desc').textContent      = I18n.t(diag.descKey);
    Charts.renderDiagnosisRadar(diag);
  }

  // ── 打球方向集計モード ─────────────────────────────────────────
  let _dirSummaryMode = 3;

  document.querySelectorAll('.dir-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dir-mode-btn').forEach(b =>
        b.classList.toggle('active', b === btn)
      );
      _dirSummaryMode = +btn.dataset.dirMode;
      Charts.renderSprayDirSummary(getFilteredAtBats(), _dirSummaryMode);
    });
  });



  // ── 特殊能力 ───────────────────────────────────────────────────
  function renderAbilities(atBats) {
    const grid      = document.getElementById('abilities-grid');
    const countEl   = document.getElementById('ability-count');
    if (!grid) return;

    const results   = Stats.getAbilityResults(atBats);
    const cats      = Stats.ABILITY_CATEGORIES;
    const unlocked  = results.filter(a => a.unlocked).length;
    countEl.textContent = `${unlocked} / ${results.length}`;

    const byCat = {};
    for (const r of results) {
      (byCat[r.cat] = byCat[r.cat] || []).push(r);
    }

    grid.innerHTML = Object.entries(byCat).map(([cat, items]) => {
      const { label, color } = cats[cat] || { label: cat, color: '#888' };
      const cards = items.map(item => {
        const cls = item.unlocked ? 'ability-card unlocked' : 'ability-card locked';
        const style = item.unlocked
          ? `--ab-color:${color}`
          : '';
        return `<div class="${cls}" style="${style}" title="${item.hint}">
          <span class="ab-icon">${item.icon}</span>
          <span class="ab-name">${item.unlocked ? item.name : '???'}</span>
        </div>`;
      }).join('');

      return `<div class="ability-cat-block">
        <div class="ability-cat-label" style="color:${color}">${label}</div>
        <div class="ability-cards-row">${cards}</div>
      </div>`;
    }).join('');
  }

  // ── シーズン目標 ───────────────────────────────────────────────
  const goalAvgInput  = document.getElementById('goal-avg-input');
  const goalHitsInput = document.getElementById('goal-hits-input');

  // 保存済みゴールをロード
  (() => {
    const g = Goal.load();
    if (g.targetAvg)  goalAvgInput.value  = g.targetAvg;
    if (g.targetHits) goalHitsInput.value = g.targetHits;
  })();

  function saveGoal() {
    const g = Goal.load();
    const avg  = parseFloat(goalAvgInput.value);
    const hits = parseInt(goalHitsInput.value);
    g.targetAvg  = !isNaN(avg)  && avg  > 0 ? avg  : null;
    g.targetHits = !isNaN(hits) && hits > 0 ? hits : null;
    Goal.save(g);
    renderStats();
  }

  goalAvgInput.addEventListener('change',  saveGoal);
  goalHitsInput.addEventListener('change', saveGoal);

  function renderGoalSection(atBats) {
    const panel = document.getElementById('goal-panel');
    if (!panel) return;

    const goal = Goal.load();
    if (!goal.targetAvg && !goal.targetHits) {
      panel.innerHTML = '<p class="empty-state-sm" style="margin-top:8px">目標を入力するとここに進捗が表示されます</p>';
      return;
    }

    const p = Goal.calcProgress(atBats, goal);
    let html = '';

    if (p.targetAvg) {
      const color    = p.onTrack ? '#16a34a' : '#dc2626';
      const pctWidth = p.pct + '%';
      const msgStyle = `color:${color};font-size:12px;font-weight:600;margin-top:6px`;
      let msg;
      if (p.onTrack) {
        msg = `🎉 目標打率 ${Stats.fmtAvg(p.targetAvg)} 達成中！`;
      } else if (p.hitsNeededStreak !== undefined) {
        msg = `あと連続 ${p.hitsNeededStreak} 安打で目標打率に到達`;
      } else {
        msg = `現在 ${Stats.fmtAvg(p.currentAvg)} ／ 目標 ${Stats.fmtAvg(p.targetAvg)}`;
      }

      html += `
        <div class="goal-card">
          <div class="goal-card-header">
            <span class="goal-card-label">打率目標</span>
            <span class="goal-card-value" style="color:${color}">${Stats.fmtAvg(p.currentAvg)}<span class="goal-card-target"> ／ ${Stats.fmtAvg(p.targetAvg)}</span></span>
          </div>
          <div class="goal-progress-bar-track">
            <div class="goal-progress-bar-fill" style="width:${pctWidth};background:${color}"></div>
          </div>
          <div style="${msgStyle}">${msg}</div>
          <div class="goal-card-sub">${p.h}安打 / ${p.ab}打数</div>
        </div>`;
    }

    if (p.targetHits) {
      const color    = p.hitsRemaining === 0 ? '#16a34a' : '#2563eb';
      const pctWidth = p.hitsPct + '%';
      const msg = p.hitsRemaining === 0
        ? `🎉 目標 ${p.targetHits} 安打達成！`
        : `あと <strong>${p.hitsRemaining}</strong> 安打で目標達成`;

      html += `
        <div class="goal-card">
          <div class="goal-card-header">
            <span class="goal-card-label">安打数目標</span>
            <span class="goal-card-value" style="color:${color}">${p.hitsProgress}<span class="goal-card-target"> ／ ${p.targetHits} 本</span></span>
          </div>
          <div class="goal-progress-bar-track">
            <div class="goal-progress-bar-fill" style="width:${pctWidth};background:${color}"></div>
          </div>
          <div style="color:${color};font-size:12px;font-weight:600;margin-top:6px">${msg}</div>
        </div>`;
    }

    panel.innerHTML = html;
  }

  // ── コンディション入力 ─────────────────────────────────────────
  const conditionDetails = document.getElementById('condition-details');

  // コンディション状態
  let _cond = {};

  function loadConditionForCurrentGame() {
    const date = inputDate.value;
    const opp  = inputOpponent.value.trim();
    _cond = Conditions.get(date, opp);
    updateCondButtons();
  }

  function updateCondButtons() {
    document.querySelectorAll('.cond-btn').forEach(btn => {
      const type = btn.dataset.condType;
      const val  = btn.dataset.condVal;
      btn.classList.toggle('selected', String(_cond[type]) === String(val));
    });
  }

  document.querySelectorAll('.cond-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.condType;
      const val  = btn.dataset.condVal;
      // トグル
      if (String(_cond[type]) === String(val)) {
        delete _cond[type];
      } else {
        _cond[type] = isNaN(val) ? val : Number(val);
      }
      const date = inputDate.value;
      const opp  = inputOpponent.value.trim();
      Conditions.set(date, opp, _cond);
      updateCondButtons();
    });
  });

  // 日付・相手チームが変わったらコンディションを再ロード
  inputDate.addEventListener('change',    loadConditionForCurrentGame);
  inputOpponent.addEventListener('change', loadConditionForCurrentGame);
  loadConditionForCurrentGame();

  // ── コンディション相関セクション ──────────────────────────────
  function renderConditionSection(atBats) {
    const section = document.getElementById('condition-section');
    const panel   = document.getElementById('condition-correlation-panel');
    if (!section || !panel) return;

    const corr = Conditions.calcCorrelation(atBats);
    if (!corr.hasAny) { section.style.display = 'none'; return; }
    section.style.display = '';

    function buildTable(rows, title) {
      if (rows.length === 0) return '';
      const best = rows.reduce((a, b) => ((a.avg ?? -1) > (b.avg ?? -1) ? a : b), rows[0]);
      return `
        <div class="cond-corr-block">
          <div class="cond-corr-title">${title}</div>
          <table class="cond-corr-table">
            <tbody>
              ${rows.map(r => {
                const isBest = r.avg !== null && r === best && rows.length > 1;
                return `<tr${isBest ? ' class="cond-corr-best"' : ''}>
                  <td class="cond-corr-label">${r.label}</td>
                  <td class="cond-corr-avg" style="color:${r.color}">${Stats.fmtAvg(r.avg)}</td>
                  <td class="cond-corr-detail">${r.h}/${r.ab}打数</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    }

    panel.innerHTML =
      buildTable(corr.condition, '体調別') +
      buildTable(corr.weather,   '天気別') +
      buildTable(corr.fatigue,   '疲れ別');
  }

  // ── 打席日誌（ストーリータブ） ────────────────────────────────
  function renderStoryTab() {
    const list = document.getElementById('story-list');
    if (!list) return;

    const atBats = Storage.load();
    const conditions = Conditions.load();

    if (atBats.length === 0) {
      list.innerHTML = '<p class="empty-state">打席データがありません</p>';
      return;
    }

    // ゲームごとにグループ化（日付+相手チーム）
    const gamesMap = new Map();
    for (const ab of atBats) {
      const key = `${ab.date}_${ab.opponent || ''}`;
      if (!gamesMap.has(key)) {
        gamesMap.set(key, {
          date: ab.date,
          opponent: ab.opponent || '',
          abs: [],
          cond: conditions[Conditions.gameKey(ab.date, ab.opponent)] || {},
        });
      }
      gamesMap.get(key).abs.push(ab);
    }

    // 新しい日付順
    const games = [...gamesMap.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const RESULT_LABEL = {
      single: '単打', double: '二塁打', triple: '三塁打', hr: '本塁打',
      bb: '四球', hbp: '死球', k: '三振', go: 'ゴロ', fo: 'フライ',
      lo: 'ライナー', sb: '犠打', sf: '犠飛', e: '失策', dp: '併殺',
    };
    const RESULT_COLOR = {
      single: '#16a34a', double: '#059669', triple: '#0d9488', hr: '#7c3aed',
      bb: '#2563eb', hbp: '#1d4ed8',
      k: '#dc2626', go: '#b91c1c', fo: '#9f1239', lo: '#be185d',
      sb: '#d97706', sf: '#b45309', e: '#92400e', dp: '#78350f',
    };

    const COND_ICONS = {
      condition: { 1: '😔', 2: '😐', 3: '😊' },
      weather:   { sunny: '☀️', cloudy: '☁️', rainy: '🌧️' },
      fatigue:   { 1: '💪', 2: '🙂', 3: '😴' },
    };

    list.innerHTML = games.map(game => {
      const s  = Stats.calculate(game.abs);
      const dateObj = new Date((game.date || '2000-01-01') + 'T00:00:00');
      const dateLabel = dateObj.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });

      const condIcons = [
        game.cond.condition ? COND_ICONS.condition[game.cond.condition] : null,
        game.cond.weather   ? COND_ICONS.weather[game.cond.weather]     : null,
        game.cond.fatigue   ? COND_ICONS.fatigue[game.cond.fatigue]     : null,
      ].filter(Boolean).join(' ');

      const abBadges = game.abs.map(ab => {
        const label = RESULT_LABEL[ab.result] || ab.result;
        const color = RESULT_COLOR[ab.result] || '#71717a';
        const memo  = ab.memo ? `<span class="story-ab-memo">"${ab.memo}"</span>` : '';
        return `<div class="story-ab-row">
          <span class="story-ab-badge" style="background:${color}20;color:${color};border:1px solid ${color}40">${label}</span>
          ${memo}
        </div>`;
      }).join('');

      return `
        <div class="story-game-card">
          <div class="story-game-header">
            <div class="story-game-meta">
              <span class="story-game-date">${dateLabel}</span>
              ${game.opponent ? `<span class="story-game-opp">vs ${game.opponent}</span>` : ''}
              ${condIcons ? `<span class="story-cond-icons">${condIcons}</span>` : ''}
            </div>
            <div class="story-game-stats">
              <span class="story-game-avg" style="color:var(--accent)">${Stats.fmtAvg(s.avg)}</span>
              <span class="story-game-detail">${s.h}/${s.ab}</span>
            </div>
          </div>
          <div class="story-abs">${abBadges}</div>
        </div>`;
    }).join('');
  }

  // ストーリータブの切替時にレンダリング
  tabBtns.forEach(btn => {
    if (btn.dataset.tab === 'story') {
      btn.addEventListener('click', renderStoryTab);
    }
  });

  // ── CSV エクスポート ───────────────────────────────────────────
  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    const atBats = Stats.filterAtBats(Storage.load(), statsFilter.value);
    Storage.exportToCSV(atBats, k => I18n.t(k));
  });

  // ── シェアカード ──────────────────────────────────────────────
  Share.init();

  // ── チュートリアル ────────────────────────────────────────────
  Tutorial.init();

  // ── PWAインストールバナー ─────────────────────────────────────
  const _isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const _isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  let _deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _deferredPrompt = e;
    if (!localStorage.getItem('pwa-banner-dismissed')) {
      document.getElementById('pwa-banner').style.display = '';
    }
  });

  // iOS Safari: 手動インストール案内
  if (_isIOS && !_isStandalone && !localStorage.getItem('pwa-banner-dismissed')) {
    const banner = document.getElementById('pwa-banner');
    const msgEl = banner?.querySelector('.pwa-banner-msg');
    const addBtn = banner?.querySelector('#pwa-banner-add');
    if (banner && msgEl) {
      msgEl.innerHTML = '📲 <strong>ホーム画面に追加できます</strong> &nbsp;<button id="pwa-ios-steps-btn" style="background:none;border:none;color:#fff;font-size:12px;cursor:pointer;text-decoration:underline;padding:0 2px">手順を見る</button>';
      if (addBtn) addBtn.style.display = 'none';
      setTimeout(() => {
        document.getElementById('pwa-ios-steps-btn')?.addEventListener('click', () => {
          if (msgEl) msgEl.innerHTML = '📲 <strong>ホーム画面に追加する方法</strong><ol style="font-size:12px;color:rgba(255,255,255,0.85);line-height:1.8;padding-left:18px;margin:4px 0 0">'+
            '<li>Safari の画面下の <strong>共有ボタン（↑）</strong> をタップ</li>'+
            '<li><strong>「ホーム画面に追加」</strong> をタップ</li>'+
            '<li>名前を確認して <strong>「追加」</strong> をタップ</li></ol>';
        });
      }, 100);
      banner.style.display = '';
    }
  }

  document.getElementById('pwa-banner-add')?.addEventListener('click', async () => {
    if (_deferredPrompt) {
      _deferredPrompt.prompt();
      const { outcome } = await _deferredPrompt.userChoice;
      if (outcome === 'accepted') _deferredPrompt = null;
    }
    document.getElementById('pwa-banner').style.display = 'none';
  });
  document.getElementById('pwa-banner-close')?.addEventListener('click', () => {
    localStorage.setItem('pwa-banner-dismissed', '1');
    document.getElementById('pwa-banner').style.display = 'none';
  });

  // ── History tab ────────────────────────────────────────────────
  const historyList = document.getElementById('history-list');

  // ── 一括削除 ──────────────────────────────────────────────────
  let isBulkMode = false;
  const bulkToolbar   = document.getElementById('bulk-toolbar');
  const bulkToggleBtn = document.getElementById('btn-bulk-toggle');
  const bulkCountText = document.getElementById('bulk-count-text');
  const bulkCheckAll  = document.getElementById('bulk-check-all');
  const bulkDeleteBtn = document.getElementById('btn-bulk-delete');
  const bulkCancelBtn = document.getElementById('btn-bulk-cancel');

  function updateBulkCount() {
    const all     = document.querySelectorAll('.ab-check');
    const checked = document.querySelectorAll('.ab-check:checked');
    const n       = checked.length;
    bulkCountText.textContent     = `${n}件選択中`;
    bulkDeleteBtn.disabled        = n === 0;
    bulkCheckAll.checked          = all.length > 0 && n === all.length;
    bulkCheckAll.indeterminate    = n > 0 && n < all.length;
  }

  function enterBulkMode() {
    isBulkMode = true;
    bulkToolbar.style.display   = '';
    bulkToggleBtn.style.display = 'none';
    renderHistory();
    updateBulkCount();
  }

  function exitBulkMode() {
    isBulkMode = false;
    bulkToolbar.style.display   = 'none';
    bulkToggleBtn.style.display = '';
    bulkCheckAll.checked        = false;
    renderHistory();
  }

  bulkToggleBtn.addEventListener('click', enterBulkMode);
  bulkCancelBtn.addEventListener('click', exitBulkMode);

  historyList.addEventListener('change', e => {
    if (e.target.classList.contains('ab-check')) updateBulkCount();
  });

  bulkCheckAll.addEventListener('change', () => {
    document.querySelectorAll('.ab-check').forEach(cb => cb.checked = bulkCheckAll.checked);
    updateBulkCount();
  });

  bulkDeleteBtn.addEventListener('click', () => {
    const checked = [...document.querySelectorAll('.ab-check:checked')];
    if (checked.length === 0) return;
    if (!confirm(`選択した${checked.length}件の打席データを削除しますか？`)) return;
    checked.forEach(cb => Storage.remove(parseInt(cb.dataset.id)));
    showToast(`${checked.length}件削除しました`);
    exitBulkMode();
    renderStats();
  });

  function buildGameSummary(s) {
    const avg = Stats.fmtAvg(s.avg);
    return I18n.getLang() === 'ja'
      ? `${s.ab}打数${s.h}安打 打率${avg}`
      : `${s.h} for ${s.ab}, AVG ${avg}`;
  }

  function fmtAtBatDesc(ab, n) {
    const hand    = I18n.t(ab.pitcherHand === 'L' ? 'form.pitcherL' : 'form.pitcherR');
    const result  = I18n.t('result.' + ab.result) || ab.result;
    const dir     = ab.direction  ? Field.getZoneName(ab.direction) + ' ' : '';
    const kKey    = ab.kType === 'called' ? 'form.ktypeCalled' : 'form.ktypeSwing';
    const kSufx   = ab.kType     ? `（${I18n.t(kKey)}）`            : '';
    const ifSufx  = ab.infieldHit ? `（${I18n.t('form.infieldHit')}）` : '';
    const rbiSufx = ab.rbi > 0   ? ` [${I18n.t('history.rbi')}${ab.rbi}]` : '';
    const prefix  = I18n.getLang() === 'ja' ? `第${n}打席` : `PA ${n}`;
    return `${prefix}: vs${hand}　→　${dir}${result}${kSufx}${ifSufx}${rbiSufx}`;
  }

  function renderHistory() {
    const allAtBats = Storage.load();
    if (allAtBats.length === 0) {
      historyList.innerHTML = `<p class="empty-state">${I18n.t('history.noData')}</p>`;
      return;
    }

    const byDate = {};
    for (const ab of allAtBats) {
      const key = ab.date || '----';
      (byDate[key] = byDate[key] || []).push(ab);
    }
    const dates = Object.keys(byDate).sort().reverse();

    historyList.innerHTML = dates.map(date => {
      const gameAbs  = byDate[date];
      const s        = Stats.calculate(gameAbs);
      const opponent = gameAbs[0]?.opponent || '';
      const season   = date.substring(0, 4);
      const summary  = buildGameSummary(s);
      const detailId = `game-detail-${CSS.escape(date)}`;

      const atBatRows = gameAbs.map((ab, i) => `
        <div class="atbat-item">
          ${isBulkMode
            ? `<input type="checkbox" class="ab-check" data-id="${ab.id}" aria-label="打席${i + 1}を選択">`
            : `<span class="atbat-num">${i + 1}</span>`
          }
          <span class="atbat-desc">${fmtAtBatDesc(ab, i + 1)}</span>
          ${isBulkMode ? '' : `
          <div class="atbat-actions">
            <button class="btn-edit-sm"   data-id="${ab.id}">${I18n.t('history.edit')}</button>
            <button class="btn-delete-sm" data-id="${ab.id}">${I18n.t('history.delete')}</button>
          </div>`}
        </div>`).join('');

      return `
        <div class="game-card" data-date="${date}">
          <div class="game-card-header">
            <div class="game-card-info">
              <div class="game-card-meta">
                <span class="game-date">${date}</span>
                ${opponent ? `<span class="game-opponent">${opponent}</span>` : ''}
                ${season   ? `<span class="game-season-tag">${season}</span>` : ''}
              </div>
              <div class="game-summary">${summary}</div>
            </div>
            <div class="game-card-right">
              <button class="btn-game-menu" data-date="${date}" title="${I18n.t('history.deleteGame')}">⋮</button>
              <span class="expand-icon">▼</span>
            </div>
          </div>
          <div class="game-detail" id="${detailId}" style="${isBulkMode ? '' : 'display:none'}">
            ${atBatRows}
          </div>
        </div>`;
    }).join('');

    // expand / collapse
    historyList.querySelectorAll('.game-card-header').forEach(header => {
      let _longPressTimer = null;
      let _touchMoved     = false;
      let _touchStartX    = 0;
      let _touchStartY    = 0;

      header.addEventListener('touchstart', e => {
        _touchMoved  = false;
        _touchStartX = e.touches[0].clientX;
        _touchStartY = e.touches[0].clientY;
        const d = header.closest('.game-card').dataset.date;
        _longPressTimer = setTimeout(() => {
          if (!_touchMoved) deleteGame(byDate[d]);
        }, 600);
      }, { passive: true });

      header.addEventListener('touchmove', e => {
        const dx = Math.abs(e.touches[0].clientX - _touchStartX);
        const dy = Math.abs(e.touches[0].clientY - _touchStartY);
        if (dx > 10 || dy > 10) { _touchMoved = true; clearTimeout(_longPressTimer); }
      }, { passive: true });

      header.addEventListener('touchend', () => clearTimeout(_longPressTimer), { passive: true });

      header.addEventListener('click', e => {
        if (e.target.closest('.btn-game-menu')) return;
        const card   = header.closest('.game-card');
        const d      = card.dataset.date;
        const detail = document.getElementById(`game-detail-${CSS.escape(d)}`);
        const icon   = header.querySelector('.expand-icon');
        const isOpen = detail.style.display !== 'none';
        detail.style.display = isOpen ? 'none' : '';
        icon.classList.toggle('open', !isOpen);
      });
    });

    // ⋮ delete game
    historyList.querySelectorAll('.btn-game-menu').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        deleteGame(byDate[btn.dataset.date]);
      });
    });

    // per at-bat: edit / delete
    historyList.querySelectorAll('.btn-edit-sm').forEach(btn => {
      btn.addEventListener('click', () => editAtBat(parseInt(btn.dataset.id)));
    });

    historyList.querySelectorAll('.btn-delete-sm').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm(I18n.t('history.confirmDelete'))) {
          Storage.remove(parseInt(btn.dataset.id));
          showToast(I18n.t('msg.deleted'));
          renderHistory();
          renderStats();
        }
      });
    });
  }

  function deleteGame(gameAbs) {
    if (!confirm(I18n.t('history.confirmDeleteGame'))) return;
    gameAbs.forEach(ab => Storage.remove(ab.id));
    showToast(I18n.t('msg.deleted'));
    renderHistory();
    renderStats();
  }

  function editAtBat(id) {
    const ab = Storage.load().find(x => x.id === id);
    if (!ab) return;

    switchTab('record');
    editingId = id;

    inputDate.value     = ab.date     || '';
    inputOpponent.value = ab.opponent || '';
    inputMemo.value     = ab.memo     || '';
    rbiValue = ab.rbi || 0;
    rbiDisplay.textContent = rbiValue;

    selectedResult = ab.result;
    resultButtons.querySelectorAll('.result-btn').forEach(b =>
      b.classList.toggle('selected', b.dataset.result === ab.result)
    );

    pitcherHand    = ab.pitcherHand || 'R';
    selectedKType  = ab.kType       || null;
    infieldHit     = ab.infieldHit  || false;
    selectedPos    = ab.fielderPos  || null;
    selectedDir    = ab.direction   || null;

    formSubmit.textContent = I18n.t('form.update');
    updateHandButtons();
    updateSubSections();
    window.scrollTo(0, 0);
  }

  // ── Toast ──────────────────────────────────────────────────────
  const toastEl = document.getElementById('toast');
  let _toastTimer = null;

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2000);
  }

  // ── Refresh all (after lang change) ───────────────────────────
  function refreshAll() {
    formSubmit.textContent = editingId !== null
      ? I18n.t('form.update')
      : I18n.t('form.submit');
    _updateFooterLangBtn();
    updateSubSections();
    renderStats();
    renderHistory();
  }

  // ── Initial render ─────────────────────────────────────────────
  renderStats();
  renderHistory();
});
