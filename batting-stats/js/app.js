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

  const FIELDER_POS_MAP = {
    single: POS_ALL,
    go:     POS_INFIELD,
    fo:     POS_ALL,
    lo:     POS_ALL,
    e:      POS_ALL,
    sf:     POS_ALL,
    sb:     POS_INFIELD,
    dp:     POS_INFIELD,
  };

  const INFIELD_ONLY_RESULTS = new Set(['go', 'sb', 'dp']);

  let pitcherHand    = 'R';
  let selectedResult = null;
  let selectedKType  = null;
  let infieldHit     = false;
  let selectedPos    = null;
  let selectedDir    = null;
  let rbiValue       = 0;
  let editingId      = null;

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

  // ── Result buttons ─────────────────────────────────────────────
  resultButtons.querySelectorAll('.result-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const result = btn.dataset.result;
      if (selectedResult === result) {
        selectedResult = null;
        btn.classList.remove('selected');
      } else {
        resultButtons.querySelectorAll('.result-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedResult = result;
      }
      selectedKType = null;
      infieldHit    = false;
      selectedPos   = null;
      selectedDir   = null;
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
    fielderPosButtons.innerHTML = positions.map(p =>
      `<button type="button" class="pos-btn${selectedPos === p ? ' selected' : ''}" data-pos="${p}">${I18n.t('pos.' + p)}</button>`
    ).join('');
    fielderPosButtons.querySelectorAll('.pos-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pos = parseInt(btn.dataset.pos);
        selectedPos = selectedPos === pos ? null : pos;
        buildFielderPosButtons(positions);
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
      date:        inputDate.value || new Date().toISOString().slice(0, 10),
      opponent:    inputOpponent.value.trim(),
      pitcherHand: pitcherHand,
      result:      selectedResult,
      kType:       selectedKType  || null,
      infieldHit:  infieldHit     || false,
      fielderPos:  selectedPos    || null,
      direction:   selectedDir    || null,
      rbi:         rbiValue,
      memo:        inputMemo.value.trim(),
    };

    if (atBat.opponent) Storage.setLastOpponent(atBat.opponent);

    if (editingId !== null) {
      Storage.update(editingId, atBat);
      editingId = null;
      formSubmit.textContent = I18n.t('form.submit');
      showToast(I18n.t('msg.updated'));
    } else {
      Storage.add(atBat);
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
  const statAvg             = document.getElementById('stat-avg');
  const statObp             = document.getElementById('stat-obp');
  const statSlg             = document.getElementById('stat-slg');
  const statOps             = document.getElementById('stat-ops');
  const statsTableContainer = document.getElementById('stats-table-container');

  statsFilter.addEventListener('change', renderStats);

  function getFilteredAtBats() {
    return Stats.filterAtBats(Storage.load(), statsFilter.value);
  }

  document.getElementById('trend-show-ops').addEventListener('change', () => {
    Charts.renderBattingTrendChart(getFilteredAtBats());
  });
  document.getElementById('trend-show-250').addEventListener('change', () => {
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
      ).join('');

    const valid = ['all', 'last5', 'last10', ...years.map(y => 'season:' + y)];
    if (valid.includes(prev)) statsFilter.value = prev;

    const filtered = Stats.filterAtBats(atBats, statsFilter.value);

    const s = Stats.calculate(filtered);
    statAvg.textContent = Stats.fmtAvg(s.avg);
    statObp.textContent = Stats.fmtRate(s.obp);
    statSlg.textContent = Stats.fmtRate(s.slg);
    statOps.textContent = Stats.fmtOps(s.ops);

    Charts.renderAll(filtered);
    renderVsHandSection(filtered);
    renderDiagnosis(filtered);
    _initAnimData(filtered);

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

  // ── スプレーアニメーション制御 ─────────────────────────────────
  let _animInterval  = null;
  let _animIndex     = 0;
  let _animSeq       = [];
  let _animFilter    = 'all';
  let _animAtBats    = [];

  function _initAnimData(atBats) {
    _animAtBats = atBats;
    _resetAnim();
  }

  function _resetAnim() {
    clearInterval(_animInterval);
    _animInterval = null;
    _animIndex    = 0;
    _animSeq      = Charts.buildAnimField(_animAtBats, _animFilter);
  }

  function _playAnim() {
    if (_animIndex >= _animSeq.length) _resetAnim();
    _animInterval = setInterval(() => {
      if (_animIndex >= _animSeq.length) {
        clearInterval(_animInterval);
        _animInterval = null;
        return;
      }
      Charts.addAnimDot(_animSeq[_animIndex]);
      _animIndex++;
    }, 300);
  }

  // spray tab switching
  document.querySelectorAll('.spray-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.spray-tab-btn').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      const isAnim = btn.dataset.sprayTab === 'anim';
      document.getElementById('spray-heatmap-panel').style.display = isAnim ? 'none' : '';
      document.getElementById('spray-anim-panel').style.display    = isAnim ? ''     : 'none';
      if (isAnim) _resetAnim();
      else {
        clearInterval(_animInterval);
        _animInterval = null;
      }
    });
  });

  // anim filter buttons
  document.querySelectorAll('.anim-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.anim-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
      _animFilter = btn.dataset.animFilter;
      _resetAnim();
    });
  });

  document.getElementById('anim-play') ?.addEventListener('click', _playAnim);
  document.getElementById('anim-pause')?.addEventListener('click', () => { clearInterval(_animInterval); _animInterval = null; });
  document.getElementById('anim-reset')?.addEventListener('click', _resetAnim);

  // ── CSV エクスポート ───────────────────────────────────────────
  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    const atBats = Stats.filterAtBats(Storage.load(), statsFilter.value);
    Storage.exportToCSV(atBats, k => I18n.t(k));
  });

  // ── シェアカード ──────────────────────────────────────────────
  Share.init();

  // ── PWAインストールバナー ─────────────────────────────────────
  let _deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _deferredPrompt = e;
    if (!localStorage.getItem('pwa-banner-dismissed')) {
      document.getElementById('pwa-banner').style.display = '';
    }
  });
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
          <span class="atbat-num">${i + 1}</span>
          <span class="atbat-desc">${fmtAtBatDesc(ab, i + 1)}</span>
          <div class="atbat-actions">
            <button class="btn-edit-sm"   data-id="${ab.id}">${I18n.t('history.edit')}</button>
            <button class="btn-delete-sm" data-id="${ab.id}">${I18n.t('history.delete')}</button>
          </div>
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
          <div class="game-detail" id="${detailId}" style="display:none">
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
