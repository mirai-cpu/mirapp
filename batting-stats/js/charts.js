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
    const outfieldZones = ['lfl', 'lf', 'lc', 'cf', 'rc', 'rf', 'rfl'];
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
      lfl: { cx: 18,  cy: 80  },
      lf:  { cx: 42,  cy: 60  },
      lc:  { cx: 100, cy: 38  },
      cf:  { cx: 150, cy: 24  },
      rc:  { cx: 200, cy: 38  },
      rf:  { cx: 258, cy: 60  },
      rfl: { cx: 282, cy: 80  },
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

    const showOps     = document.getElementById('trend-show-ops')?.checked ?? true;
    const show250     = document.getElementById('trend-show-250')?.checked ?? true;
    const showMovAvg  = document.getElementById('trend-show-movavg')?.checked ?? false;
    const targetVal   = parseFloat(document.getElementById('trend-target-avg')?.value || '0');
    const showTarget  = !isNaN(targetVal) && targetVal > 0;
    const movAvgData  = showMovAvg ? Stats.movingAvgByGame(atBats, 5) : [];

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
          {
            label: '移動平均(5)',
            data: movAvgData,
            borderColor: '#16a34a',
            backgroundColor: 'rgba(22,163,74,0.08)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4,
            yAxisID: 'yAvg',
            hidden: !showMovAvg,
            spanGaps: false,
          },
          {
            label: '目標',
            data: showTarget ? Array(games.length).fill(targetVal) : [],
            borderColor: '#ef4444',
            borderDash: [6, 3],
            borderWidth: 1.5,
            pointRadius: 0,
            yAxisID: 'yAvg',
            hidden: !showTarget,
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
  // ── 打球方向集計（3方向 / 6方向） ────────────────────────────
  const _DIR_GROUPS = {
    3: [
      { labelKey: 'spray.dir3Left',   zones: ['lfl', 'lf', 'lc', 'if3', 'ifss'] },
      { labelKey: 'spray.dir3Center', zones: ['cf', 'if2'] },
      { labelKey: 'spray.dir3Right',  zones: ['rc', 'rf', 'rfl', 'if2b', 'if1'] },
    ],
    6: [
      { labelKey: 'spray.dir6Lf',   zones: ['lfl', 'lf', 'lc'] },
      { labelKey: 'spray.dir63bss', zones: ['if3', 'ifss'] },
      { labelKey: 'spray.dir6Cf',   zones: ['cf'] },
      { labelKey: 'spray.dir62b',   zones: ['if2'] },
      { labelKey: 'spray.dir61b',   zones: ['if2b', 'if1'] },
      { labelKey: 'spray.dir6Rf',   zones: ['rc', 'rf', 'rfl'] },
    ],
  };

  function renderSprayDirSummary(atBats, mode) {
    const el = document.getElementById('dir-summary-table');
    if (!el) return;

    const dirData = Stats.directionsByResult(atBats);
    const groups  = _DIR_GROUPS[+mode] || _DIR_GROUPS[3];

    const rows = groups.map(g => {
      let hit = 0, out = 0;
      for (const z of g.zones) {
        hit += dirData.hit[z] || 0;
        out += dirData.out[z] || 0;
      }
      return { label: I18n.t(g.labelKey), hit, total: hit + out };
    });

    if (!rows.some(r => r.total > 0)) { el.innerHTML = ''; return; }

    const maxTotal = Math.max(...rows.map(r => r.total), 1);

    el.innerHTML = `<table class="dir-summary-table">
      <thead><tr>
        <th class="dir-col-name">${I18n.t('spray.summaryDir')}</th>
        <th class="dir-col-num">${I18n.t('spray.summaryTotal')}</th>
        <th class="dir-col-num">${I18n.t('spray.summaryHit')}</th>
        <th class="dir-col-avg">${I18n.t('spray.summaryAvg')}</th>
        <th class="dir-col-bar"></th>
      </tr></thead>
      <tbody>${rows.filter(r => r.total > 0).map(r => {
        const avg  = Stats.fmtAvg(r.hit / r.total);
        const barW = (r.total / maxTotal * 100).toFixed(1);
        const hitW = (r.hit   / r.total * 100).toFixed(1);
        return `<tr>
          <td class="dir-col-name">${r.label}</td>
          <td class="dir-col-num">${r.total}</td>
          <td class="dir-col-num">${r.hit}</td>
          <td class="dir-col-avg">${avg}</td>
          <td class="dir-col-bar">
            <div class="dir-bar-track" style="width:${barW}%">
              <div class="dir-bar-hit" style="width:${hitW}%"></div>
            </div>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  }

  // ── 一括描画 ──────────────────────────────────────────────────
  function renderAll(atBats) {
    try { renderResultBar(atBats);        } catch (e) { console.warn('renderResultBar:', e); }
    try { renderSprayHeatmap(atBats);     } catch (e) { console.warn('renderSprayHeatmap:', e); }
    try { renderHrChart(atBats);          } catch (e) { console.warn('renderHrChart:', e); }
    try { renderBattingTrendChart(atBats); } catch (e) { console.warn('renderBattingTrendChart:', e); }
  }

  return {
    renderAll, renderResultBar, renderSprayHeatmap, renderHrChart,
    renderBattingTrendChart, destroyCharts,
    renderDiagnosisRadar, destroyDiagnosisChart,
    renderSprayDirSummary,
  };
})();
