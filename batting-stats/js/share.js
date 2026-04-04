// share.js - SNS Share Card generation

const Share = (() => {

  // ── モーダル制御 ─────────────────────────────────────────────
  function init() {
    document.getElementById('btn-share').addEventListener('click', openModal);
    document.getElementById('share-close').addEventListener('click', closeModal);
    document.getElementById('share-modal-overlay').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal();
    });
    document.getElementById('share-generate').addEventListener('click', onGenerate);
    document.getElementById('share-download').addEventListener('click', onDownload);
    document.getElementById('share-native').addEventListener('click', onNativeShare);

    document.getElementById('share-scope').addEventListener('change', () => {
      const isCustom = document.getElementById('share-scope').value === 'custom';
      document.getElementById('share-date-range').style.display = isCustom ? '' : 'none';
      _refreshAbilityPicker();
    });
    document.getElementById('share-date-from').addEventListener('change', _refreshAbilityPicker);
    document.getElementById('share-date-to').addEventListener('change',   _refreshAbilityPicker);
    document.getElementById('share-opponent').addEventListener('change',  _refreshAbilityPicker);
    document.getElementById('share-ability-clear').addEventListener('click', () => {
      document.querySelectorAll('.share-ability-chip').forEach(chip => {
        chip.classList.remove('selected');
      });
      _updateAbilityCount();
    });
  }

  function openModal() {
    const overlay = document.getElementById('share-modal-overlay');
    overlay.style.display = '';
    document.getElementById('share-actions').style.display = 'none';
    document.getElementById('share-preview').innerHTML = '';

    const allAtBats = Storage.load();
    const years     = Stats.getYears(allAtBats);

    // 期間セレクトを同期
    const filterVal = document.getElementById('stats-filter')?.value || 'all';
    const scopeSel  = document.getElementById('share-scope');
    scopeSel.innerHTML =
      `<option value="all">${I18n.t('share.scopeAll')}</option>` +
      `<option value="last5">${I18n.t('share.scopeLast5')}</option>` +
      `<option value="last10">${I18n.t('share.scopeLast10')}</option>` +
      years.map(y =>
        `<option value="season:${y}">${y}${I18n.t('filter.seasonSuffix')}</option>`
      ).join('') +
      `<option value="custom">期間指定</option>`;
    if ([...scopeSel.options].some(o => o.value === filterVal)) scopeSel.value = filterVal;
    document.getElementById('share-date-range').style.display =
      scopeSel.value === 'custom' ? '' : 'none';

    // 対戦相手セレクトを同期
    const opponents  = Stats.getOpponents(allAtBats);
    const oppSel     = document.getElementById('share-opponent');
    const currentOpp = document.getElementById('opponent-filter')?.value || 'all';
    oppSel.innerHTML =
      `<option value="all">全チーム</option>` +
      opponents.map(o => `<option value="${o}">${o}</option>`).join('');
    if (opponents.includes(currentOpp)) oppSel.value = currentOpp;

    _refreshAbilityPicker();
  }

  // 能力ピッカーをフィルター条件に合わせて再構築
  function _refreshAbilityPicker() {
    const filtered  = _getFilteredForModal();
    const results   = Stats.getAbilityResults(filtered).filter(a => a.unlocked);
    const picker    = document.getElementById('share-abilities-picker');
    const catColors = Stats.ABILITY_CATEGORIES;

    // 現在の選択状態を保持
    const prevSelected = new Set(
      [...document.querySelectorAll('.share-ability-chip.selected')]
        .map(el => el.dataset.id)
    );

    if (results.length === 0) {
      picker.innerHTML = '<p class="share-abilities-empty">この期間で解放された能力はありません</p>';
      _updateAbilityCount();
      return;
    }

    picker.innerHTML = results.map(ab => {
      const color   = (catColors[ab.cat] || { color: '#60a5fa' }).color;
      const checked = prevSelected.has(ab.id) ? 'selected' : '';
      return `<label class="share-ability-chip ${checked}" data-id="${ab.id}" style="--chip-color:${color}">
        <input type="checkbox" value="${ab.id}" ${checked ? 'checked' : ''}>
        <span>${ab.icon}</span>
        <span>${ab.name}</span>
        <span class="chip-check">✓</span>
      </label>`;
    }).join('');

    picker.querySelectorAll('.share-ability-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const selected = document.querySelectorAll('.share-ability-chip.selected').length;
        const isNowSelected = chip.classList.contains('selected');
        if (!isNowSelected && selected >= 10) return; // 10個上限
        chip.classList.toggle('selected');
        chip.querySelector('input').checked = chip.classList.contains('selected');
        _updateAbilityCount();
      });
    });

    _updateAbilityCount();
  }

  function _updateAbilityCount() {
    const n = document.querySelectorAll('.share-ability-chip.selected').length;
    const el = document.getElementById('share-ability-count');
    if (el) el.textContent = `${n} / 10`;
  }

  // モーダルの現在の条件でフィルタ済みデータを返す
  function _getFilteredForModal() {
    const scopeVal = document.getElementById('share-scope').value;
    const oppVal   = document.getElementById('share-opponent').value;
    const dateFrom = document.getElementById('share-date-from').value;
    const dateTo   = document.getElementById('share-date-to').value;
    let filtered;
    if (scopeVal === 'custom') {
      filtered = Storage.load().filter(ab => {
        const d = ab.date || '';
        if (dateFrom && d < dateFrom) return false;
        if (dateTo   && d > dateTo)   return false;
        return true;
      });
    } else {
      filtered = Stats.filterAtBats(Storage.load(), scopeVal);
    }
    if (oppVal !== 'all') filtered = filtered.filter(ab => ab.opponent === oppVal);
    return filtered;
  }

  function closeModal() {
    document.getElementById('share-modal-overlay').style.display = 'none';
  }

  function onGenerate() {
    const canvas = _generate();
    canvas.style.cssText = 'width:100%;height:auto;border-radius:8px;';
    const preview = document.getElementById('share-preview');
    preview.innerHTML = '';
    preview.appendChild(canvas);
    document.getElementById('share-actions').style.display = '';
  }

  function onDownload() {
    const canvas = _generate();
    const a = document.createElement('a');
    a.download = `batting-stats-${new Date().toISOString().slice(0, 10)}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  function onNativeShare() {
    const canvas = _generate();
    canvas.toBlob(async blob => {
      if (!blob) { onDownload(); return; }
      const file = new File([blob], 'batting-stats.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'My Batting Stats' }); }
        catch (_) { /* user cancelled */ }
      } else {
        onDownload();
      }
    }, 'image/png');
  }

  // ── カード生成 ──────────────────────────────────────────────
  function _generate() {
    const playerName = document.getElementById('share-player-name').value.trim() || 'My Stats';
    const scopeVal   = document.getElementById('share-scope').value;
    const oppVal     = document.getElementById('share-opponent').value;
    const dateFrom   = document.getElementById('share-date-from').value;
    const dateTo     = document.getElementById('share-date-to').value;

    const filtered = _getFilteredForModal();
    const s        = Stats.calculate(filtered);
    const diag     = Stats.getDiagnosis(s);

    const labelParts = [_filterLabel(scopeVal, dateFrom, dateTo)];
    if (oppVal !== 'all') labelParts.push(`vs ${oppVal}`);
    const label = labelParts.filter(Boolean).join(' / ');

    // 選択された能力のみ取得（選択なしなら解放済み全て最大10個）
    const selectedIds = [...document.querySelectorAll('.share-ability-chip.selected')]
      .map(el => el.dataset.id);
    const allUnlocked = Stats.getAbilityResults(filtered).filter(a => a.unlocked);
    const abilities   = selectedIds.length > 0
      ? allUnlocked.filter(a => selectedIds.includes(a.id))
      : allUnlocked.slice(0, 10);

    return generateShareCard(playerName, label, s, diag, filtered, abilities);
  }

  function generateShareCard(playerName, filterType, s, diag, filteredAtBats, abilities) {
    const W = 1200, H = 760;
    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#1a472a');
    grad.addColorStop(1, '#0a2540');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle grid overlay
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    const font = (size, weight) => `${weight || 400} ${size}px system-ui,-apple-system,sans-serif`;

    // ── Filter label (top right)
    ctx.fillStyle  = 'rgba(255,255,255,0.45)';
    ctx.font       = font(22);
    ctx.textAlign  = 'right';
    ctx.fillText(filterType, W - 60, 80);

    // ── Player name
    ctx.fillStyle = 'rgba(255,255,255,0.90)';
    ctx.font      = font(40, 700);
    ctx.textAlign = 'left';
    ctx.fillText(playerName, 60, 80);

    // ── Type badge
    if (diag && diag.typeKey) {
      ctx.fillStyle = '#EF9F27';
      ctx.font      = font(22, 600);
      ctx.fillText(I18n.t(diag.typeKey), 60, 120);
    }

    // ── Main stats: AVG / H（大きく2列）
    const statsStartX = 60, statsY = 200;

    // AVG（左・大）
    ctx.fillStyle = '#ffffff';
    ctx.font      = font(72, 800);
    ctx.textAlign = 'left';
    ctx.fillText(Stats.fmtAvg(s.avg), statsStartX, statsY);
    ctx.fillStyle = 'rgba(255,255,255,0.50)';
    ctx.font      = font(16, 600);
    ctx.fillText(I18n.t('stat.avg'), statsStartX, statsY + 26);

    // H・安打数（右・大）
    ctx.fillStyle = '#3ecf8e';
    ctx.font      = font(72, 800);
    ctx.textAlign = 'left';
    ctx.fillText(`${s.h}`, statsStartX + 220, statsY);
    ctx.fillStyle = 'rgba(255,255,255,0.50)';
    ctx.font      = font(16, 600);
    ctx.fillText(I18n.t('stat.h'), statsStartX + 220, statsY + 26);

    // OBP / SLG / OPS（中段・3列）
    const midStats = [
      { label: I18n.t('stat.obp'), value: Stats.fmtRate(s.obp) },
      { label: I18n.t('stat.slg'), value: Stats.fmtRate(s.slg) },
      { label: I18n.t('stat.ops'), value: Stats.fmtOps(s.ops)  },
    ];
    const midY = statsY + 100, midColW = 150;
    midStats.forEach((st, i) => {
      const x = statsStartX + i * midColW;
      ctx.fillStyle = '#ffffff';
      ctx.font      = font(40, 700);
      ctx.textAlign = 'left';
      ctx.fillText(st.value, x, midY);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font      = font(14, 600);
      ctx.fillText(st.label, x, midY + 22);
    });

    // ── Sub stats（下段: G / PA / HR / RBI / 三振 / 二塁打）
    const subStats = [
      { label: I18n.t('stat.games'),  value: s.games  },
      { label: 'PA',                  value: s.pa     },
      { label: I18n.t('stat.hr'),     value: s.hr     },
      { label: I18n.t('stat.rbi'),    value: s.rbi    },
      { label: '三振',                value: s.k      },
      { label: I18n.t('stat.double'), value: s.double },
    ];
    const subColW = 90, subY = 420;
    subStats.forEach((st, i) => {
      const x = statsStartX + i * subColW;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font      = font(32, 700);
      ctx.textAlign = 'left';
      ctx.fillText(st.value, x, subY);
      ctx.fillStyle = 'rgba(255,255,255,0.40)';
      ctx.font      = font(13);
      ctx.fillText(st.label, x, subY + 19);
    });

    // ── Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, 470); ctx.lineTo(700, 470); ctx.stroke();

    // ── Mini field (right panel)
    _drawMiniField(ctx, Stats.directionsByResult(filteredAtBats || []), 730, 50, 420, 390);

    // ── 特殊能力バッジ
    const abs = abilities || [];
    if (abs.length > 0) {
      const abY      = 490;
      const badgeH   = 46;
      const badgeGap = 10;
      const catColors = Stats.ABILITY_CATEGORIES;

      // セクションラベル
      ctx.fillStyle = 'rgba(255,255,255,0.40)';
      ctx.font      = font(17, 700);
      ctx.textAlign = 'left';
      ctx.fillText('SPECIAL ABILITIES', 60, abY);

      // バッジを2行×最大10個で描画
      abs.forEach((ab, i) => {
        const col     = i % 5;
        const row     = Math.floor(i / 5);
        const color   = (catColors[ab.cat] || { color: '#60a5fa' }).color;


        // 1行目はx=60から順に並べるため累積位置を計算
        // シンプルに等間隔グリッドで配置
        const cellW  = (W - 120) / 5;
        const bx     = 60 + col * cellW;
        const by     = abY + 18 + row * (badgeH + badgeGap);

        // バッジ背景
        const bgAlpha = 0.22;
        ctx.fillStyle = color + Math.round(bgAlpha * 255).toString(16).padStart(2, '0');
        _roundRect(ctx, bx, by, cellW - badgeGap, badgeH, 10);
        ctx.fill();

        // バッジ枠
        ctx.strokeStyle = color + '66';
        ctx.lineWidth   = 1.5;
        _roundRect(ctx, bx, by, cellW - badgeGap, badgeH, 10);
        ctx.stroke();

        // アイコン
        ctx.font      = font(22);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(ab.icon, bx + 10, by + badgeH * 0.66);

        // 能力名
        ctx.font      = font(18, 700);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(ab.name, bx + 36, by + badgeH * 0.66);
      });
    }

    // ── 区切り線（能力エリア下）
    const footerDivY = abs.length > 5 ? 700 : abs.length > 0 ? 630 : 490;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(60, footerDivY); ctx.lineTo(W - 60, footerDivY); ctx.stroke();

    // ── Footer
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font      = font(20, 700);
    ctx.textAlign = 'left';
    ctx.fillText('My Batting Stats', 60, footerDivY + 36);

    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font      = font(17);
    ctx.textAlign = 'right';
    ctx.fillText('somirai.jp', W - 60, footerDivY + 36);

    return canvas;
  }

  function _roundRect(ctx, x, y, w, h, r) {
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
  }

  function _filterLabel(ft, dateFrom, dateTo) {
    if (ft === 'all')             return I18n.t('filter.all');
    if (ft === 'last5')           return I18n.t('filter.last5');
    if (ft === 'last10')          return I18n.t('filter.last10');
    if (ft.startsWith('season:')) return ft.slice(7) + I18n.t('filter.seasonSuffix');
    if (ft === 'custom') {
      if (dateFrom && dateTo)  return `${dateFrom} 〜 ${dateTo}`;
      if (dateFrom)            return `${dateFrom} 〜`;
      if (dateTo)              return `〜 ${dateTo}`;
      return '期間指定';
    }
    return '';
  }

  function _drawMiniField(ctx, dirData, x, y, w, h) {
    const sx = w / 300, sy = h / 270;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.55;

    // outfield fan
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.moveTo(150 * sx, 255 * sy);
    ctx.lineTo(5 * sx, 92 * sy);
    ctx.arc(150 * sx, 255 * sy, 230 * sx, -Math.PI * 0.75, -Math.PI * 0.25);
    ctx.closePath();
    ctx.fill();

    // infield diamond
    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    [[80,185],[150,115],[220,185],[150,255]].forEach(([px,py], i) =>
      i === 0 ? ctx.moveTo(px*sx, py*sy) : ctx.lineTo(px*sx, py*sy)
    );
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 1;

    // spray dots — field.js の全ゾーンに対応
    const hitCounts = dirData.hit || {};
    const outCounts = dirData.out || {};
    const CENTERS = {
      if3:  {cx:113,cy:204}, ifss:{cx:131,cy:195}, if2:{cx:150,cy:192},
      if2b: {cx:169,cy:195}, if1: {cx:187,cy:204},
      lfl:  {cx:22, cy:135}, lf:  {cx:55, cy:108}, lc: {cx:108,cy:88},
      cf:   {cx:150,cy:72},  rc:  {cx:192,cy:88},  rf: {cx:245,cy:108},
      rfl:  {cx:278,cy:135}, bs:  {cx:150,cy:18},
    };

    const allZones = Object.keys(CENTERS);
    const maxH = Math.max(1, ...allZones.map(z => hitCounts[z] || 0));
    const maxO = Math.max(1, ...allZones.map(z => outCounts[z] || 0));

    for (const [zid, zc] of Object.entries(CENTERS)) {
      const hc = hitCounts[zid] || 0;
      const oc = outCounts[zid] || 0;

      // アウト（グレー・後ろに描画）
      if (oc > 0) {
        const r = Math.round((8 + (oc / maxO) * 14) * sx);
        ctx.fillStyle = 'rgba(156,163,175,0.65)';
        ctx.beginPath();
        ctx.arc((zc.cx + 5) * sx, (zc.cy + 5) * sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // ヒット（緑・前に描画）
      if (hc > 0) {
        const r = Math.round((9 + (hc / maxH) * 16) * sx);
        ctx.fillStyle = 'rgba(62,207,142,0.92)';
        ctx.beginPath();
        ctx.arc(zc.cx * sx, zc.cy * sy, r, 0, Math.PI * 2);
        ctx.fill();
        // 数字ラベル
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(13 * sx)}px system-ui,sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hc, zc.cx * sx, zc.cy * sy);
        ctx.textBaseline = 'alphabetic';
      }
    }

    ctx.restore();
  }

  return { init, generateShareCard };
})();
