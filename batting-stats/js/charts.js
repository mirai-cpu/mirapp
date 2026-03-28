// charts.js - Dashboard chart rendering

const Charts = (() => {
  let _barChart   = null;
  let _trendChart = null;
  let _radarChart = null;

  function destroyCharts() {
    if (_barChart)   { _barChart.destroy();   _barChart   = null; }
    if (_trendChart) { _trendChart.destroy(); _trendChart = null; }
  }

  function destroyDiagnosisChart() {
    if (_radarChart) { _radarChart.destroy(); _radarChart = null; }
  }

  // ── 打席結果の内訳バー（Chart.js 横積み棒グラフ）──────────────
  function renderResultBar(atBats) {
    const canvas  = document.getElementById('chart-result-bar');
    const nodata  = document.getElementById('result-bar-nodata');
    if (!canvas) return;

    if (_barChart) { _barChart.destroy(); _barChart = null; }

    if (atBats.length === 0) {
      canvas.style.display = 'none';
      if (nodata) nodata.style.display = '';
      return;
    }
    canvas.style.display = '';
    if (nodata) nodata.style.display = 'none';

    const pa      = atBats.length;
    const counts  = Stats.resultCounts(atBats);
    const kCount  = atBats.filter(ab => ab.result === 'k').length;
    const hrCount = atBats.filter(ab => ab.result === 'hr').length;
    const outNoK  = counts.out - kCount;

    const segments = [
      { label: I18n.t('chart.segHit'),     value: counts.hit - hrCount, color: '#16a34a' },
      { label: I18n.t('chart.segHr'),      value: hrCount,              color: '#f59e0b' },
      { label: I18n.t('chart.segOut'),     value: outNoK,               color: '#9ca3af' },
      { label: I18n.t('chart.segWalk'),    value: counts.walk,          color: '#2563eb' },
      { label: I18n.t('chart.segK'),       value: kCount,               color: '#f87171' },
      { label: I18n.t('chart.segSpecial'), value: counts.special,       color: '#d97706' },
    ].filter(s => s.value > 0);

    _barChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: [''],
        datasets: segments.map(s => ({
          label: s.label,
          data:  [s.value],
          backgroundColor: s.color,
          borderWidth: 0,
          borderRadius: 0,
        })),
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { size: 11 }, padding: 12, boxWidth: 10, boxHeight: 10 },
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const pct = (ctx.raw / pa * 100).toFixed(0);
                return ` ${ctx.dataset.label}: ${ctx.raw} (${pct}%)`;
              },
            },
          },
        },
        scales: {
          x: { stacked: true, display: false, max: pa },
          y: { stacked: true, display: false },
        },
        layout: { padding: { top: 4, bottom: 0 } },
      },
    });
  }

  // ── 打球方向ヒートマップ（SVG スプレーチャート）────────────────
  function renderSprayHeatmap(atBats) {
    const sprayEl  = document.getElementById('spray-chart');
    const legendEl = document.getElementById('spray-legend');
    if (!sprayEl) return;

    const dirData = Stats.directionsByResult(atBats);
    const hasAny  = Object.keys(dirData.hit).length + Object.keys(dirData.out).length > 0;

    if (!hasAny) {
      sprayEl.innerHTML  = `<p class="empty-state-sm">${I18n.t('chart.sprayNoData')}</p>`;
      if (legendEl) legendEl.innerHTML = '';
      return;
    }

    Field.renderSpray('spray-chart', dirData);

    if (legendEl) {
      legendEl.innerHTML = `
        <span class="spray-legend-item">
          <span class="spray-legend-dot hit"></span>${I18n.t('chart.sprayHit')}
        </span>
        <span class="spray-legend-item">
          <span class="spray-legend-dot out"></span>${I18n.t('chart.sprayOut')}
        </span>`;
    }
  }

  // ── ホームラン方向チャート ────────────────────────────────────
  function renderHrChart(atBats) {
    const hrEl   = document.getElementById('hr-chart');
    const nodata = document.getElementById('hr-chart-nodata');
    if (!hrEl) return;

    const hrs           = atBats.filter(ab => ab.result === 'hr');
    const outfieldZones = ['lf', 'cf', 'rf'];
    const counts        = {};
    let total           = 0;

    for (const ab of hrs) {
      if (ab.direction && outfieldZones.includes(ab.direction)) {
        counts[ab.direction] = (counts[ab.direction] || 0) + 1;
        total++;
      }
    }

    if (hrs.length === 0) {
      hrEl.style.display = 'none';
      if (nodata) nodata.style.display = '';
      return;
    }

    // HRはあるが打球方向が未記録の場合
    if (total === 0) {
      hrEl.style.display = '';
      hrEl.innerHTML = `<p class="empty-state-sm">${I18n.t('hr.noDirection').replace('{n}', hrs.length)}</p>`;
      if (nodata) nodata.style.display = 'none';
      return;
    }

    hrEl.style.display = '';
    if (nodata) nodata.style.display = 'none';

    const maxCount = Math.max(...Object.values(counts));

    // フェンスを少し超えた位置（ホームから r≈238）にドットを配置
    const HR_FENCE = {
      lf: { cx: 30,  cy: 62 },
      cf: { cx: 150, cy: 28 },
      rf: { cx: 270, cy: 62 },
    };

    const dots = Field.ZONES
      .filter(z => outfieldZones.includes(z.id))
      .map(z => {
        const count = counts[z.id] || 0;
        if (count === 0) return '';
        const r   = Math.max(12, Math.min(26, 12 + (count / maxCount) * 14));
        const pct = Math.round(count / total * 100);
        const pos = HR_FENCE[z.id] || { cx: z.cx, cy: z.cy };
        return `<circle class="hr-dot" cx="${pos.cx}" cy="${pos.cy}" r="${r}" opacity="0.85"/>` +
               `<text class="spray-count" x="${pos.cx}" y="${pos.cy}">${pct}%</text>`;
      }).join('');

    const base = Field.buildSVG(false, null, false, false);
    hrEl.innerHTML = base.replace('</svg>', dots + '</svg>');
  }

  // ── 打率推移グラフ（Chart.js 折れ線グラフ）──────────────────
  function renderBattingTrendChart(atBats) {
    const canvas  = document.getElementById('chart-batting-trend');
    const nodata  = document.getElementById('trend-nodata');
    if (!canvas) return;

    if (_trendChart) { _trendChart.destroy(); _trendChart = null; }

    const games = Stats.gameTrend(atBats);

    if (games.length <= 1) {
      canvas.style.display = 'none';
      if (nodata) nodata.style.display = '';
      return;
    }
    canvas.style.display = '';
    if (nodata) nodata.style.display = 'none';

    const showOps = document.getElementById('trend-show-ops')?.checked ?? true;
    const show250 = document.getElementById('trend-show-250')?.checked ?? true;

    _trendChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: games.map(g => g.gameNum),
        datasets: [
          {
            label: 'AVG',
            data: games.map(g => g.avg),
            borderColor: '#2563eb',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.3,
            yAxisID: 'yAvg',
            spanGaps: false,
          },
          {
            label: 'OPS',
            data: games.map(g => g.ops),
            borderColor: '#d97706',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.3,
            yAxisID: 'yOps',
            hidden: !showOps,
            spanGaps: false,
          },
          {
            label: '.250',
            data: Array(games.length).fill(0.250),
            borderColor: '#9ca3af',
            borderDash: [4, 4],
            borderWidth: 1,
            pointRadius: 0,
            yAxisID: 'yAvg',
            hidden: !show250,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            filter: item => item.dataset.label !== '.250',
            callbacks: {
              title: items => {
                const g = games[items[0].dataIndex];
                return g.date + (g.opponent ? `  vs ${g.opponent}` : '');
              },
              label: ctx => {
                if (ctx.dataset.label === 'AVG') return ` AVG: ${Stats.fmtAvg(ctx.raw)}`;
                if (ctx.dataset.label === 'OPS') return ` OPS: ${Stats.fmtOps(ctx.raw)}`;
                return '';
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { font: { size: 11 } },
            title: { display: true, text: I18n.t('trend.xAxis'), font: { size: 11 }, color: '#71717a' },
          },
          yAvg: {
            type: 'linear',
            position: 'left',
            min: 0,
            max: 0.5,
            ticks: {
              stepSize: 0.1,
              font: { size: 11 },
              callback: val => Stats.fmtAvg(val),
            },
          },
          yOps: {
            type: 'linear',
            position: 'right',
            min: 0,
            max: 1.5,
            display: showOps,
            grid: { drawOnChartArea: false },
            ticks: {
              stepSize: 0.5,
              font: { size: 11 },
              callback: val => val.toFixed(1),
            },
          },
        },
      },
    });
  }

  // ── 打者タイプ診断レーダーチャート ─────────────────────────────
  function renderDiagnosisRadar(diag) {
    const canvas = document.getElementById('chart-diagnosis-radar');
    if (!canvas) return;

    if (_radarChart) { _radarChart.destroy(); _radarChart = null; }

    _radarChart = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: [I18n.t('diag.axisPower'), I18n.t('diag.axisMeet'), I18n.t('diag.axisEye')],
        datasets: [{
          data: [diag.power, diag.meet, diag.eye],
          backgroundColor: 'rgba(37,99,235,0.15)',
          borderColor: '#2563eb',
          borderWidth: 2,
          pointRadius: 5,
          pointBackgroundColor: '#2563eb',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: { legend: { display: false } },
        scales: {
          r: {
            min: 0, max: 1,
            ticks: { display: false, stepSize: 0.25 },
            pointLabels: { font: { size: 13, weight: '600' }, color: '#3f3f46' },
            grid:      { color: 'rgba(0,0,0,0.08)' },
            angleLines: { color: 'rgba(0,0,0,0.08)' },
          },
        },
      },
    });
  }

  // ── スプレーアニメーション（SVG + CSS @keyframes）──────────────
  // fieldContainerId: SVGを描画するコンテナのID
  // atBats: フィルター済みの打席データ
  // Returns the dot sequence for play control
  function buildAnimField(atBats, animFilter) {
    const containerId = 'spray-anim-field';
    const container = document.getElementById(containerId);
    if (!container) return [];

    let seq = atBats.filter(ab => ab.direction);
    if      (animFilter === 'hit') seq = seq.filter(ab => RESULT_TYPES[ab.result]?.hit);
    else if (animFilter === 'out') seq = seq.filter(ab => { const rt = RESULT_TYPES[ab.result]; return rt && rt.atBat && !rt.hit; });
    else if (animFilter === 'hr')  seq = seq.filter(ab => ab.result === 'hr');

    const hasBS = seq.some(ab => ab.direction === 'bs');
    container.innerHTML = Field.buildSVG(false, null, false, hasBS);
    return seq;
  }

  function addAnimDot(ab) {
    const container = document.getElementById('spray-anim-field');
    const svg = container?.querySelector('svg');
    if (!svg) return;

    const zone = Field.ZONES.find(z => z.id === ab.direction);
    if (!zone) return;

    const rt    = RESULT_TYPES[ab.result];
    const isHr  = ab.result === 'hr';
    const isHit = rt?.hit;

    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', zone.cx);
    dot.setAttribute('cy', zone.cy);
    dot.setAttribute('r', isHr ? 14 : 9);

    const cls = isHr ? 'spray-anim-dot-hr' : (isHit ? 'spray-anim-dot-hit' : 'spray-anim-dot-out');
    dot.classList.add(cls, 'spray-flying');
    dot.style.setProperty('--from-dx', `${150 - zone.cx}px`);
    dot.style.setProperty('--from-dy', `${255 - zone.cy}px`);
    svg.appendChild(dot);
  }

  // ── 一括描画 ──────────────────────────────────────────────────
  function renderAll(atBats) {
    try { renderResultBar(atBats);        } catch (e) { console.warn('renderResultBar:', e); }
    renderSprayHeatmap(atBats);
    renderHrChart(atBats);
    try { renderBattingTrendChart(atBats); } catch (e) { console.warn('renderBattingTrendChart:', e); }
  }

  return {
    renderAll, renderResultBar, renderSprayHeatmap, renderHrChart,
    renderBattingTrendChart, destroyCharts,
    renderDiagnosisRadar, destroyDiagnosisChart,
    buildAnimField, addAnimDot,
  };
})();
