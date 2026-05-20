/**
 * yoroshiku.js
 * 「よろしく」コマンド — GA4 + X + Search Console + AdSense を統合分析
 * ロードマップ対比・PDCA・施策効果トラッキング・今週のTODOを出力する
 * 使用: node yoroshiku.js [days=30]
 */

const { fetchGA4 } = require('./fetch-ga4');
const { fetchSearchConsole } = require('./fetch-searchconsole');
const { fetchAdSense } = require('./fetch-adsense');
const config = require('./config.json');
const goals = require('./goals.json');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const OAuth = require('oauth-1.0a');
const ExcelJS = require('exceljs');
const PptxGenJS = require('pptxgenjs');

// ── スナップショット ──────────────────────────────────────────
const SNAPSHOTS_FILE = path.join(__dirname, 'snapshots.json');
const INTERVENTIONS_FILE = path.join(__dirname, 'interventions.json');

function loadSnapshots() {
  try { return JSON.parse(fs.readFileSync(SNAPSHOTS_FILE, 'utf8')); } catch { return []; }
}

function saveSnapshot(snapshot) {
  const snaps = loadSnapshots();
  const today = new Date().toISOString().split('T')[0];
  // 同日のスナップショットは上書き
  const idx = snaps.findIndex(s => s.date === today);
  if (idx >= 0) snaps[idx] = snapshot; else snaps.push(snapshot);
  // 最新90件のみ保持
  const sorted = snaps.sort((a, b) => a.date.localeCompare(b.date)).slice(-90);
  fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(sorted, null, 2));
}

function loadInterventions() {
  try { return JSON.parse(fs.readFileSync(INTERVENTIONS_FILE, 'utf8')); } catch { return []; }
}

function daysBetween(dateStr1, dateStr2) {
  return Math.round((new Date(dateStr2) - new Date(dateStr1)) / 86400000);
}

const days = parseInt(process.argv[2] || '30', 10);
const forcePpt = process.argv.includes('--ppt');
const LINE = '='.repeat(64);
const SEP = '-'.repeat(64);

// ── X 取得 ───────────────────────────────────────────────────
const { apiKey, apiKeySecret, accessToken, accessTokenSecret } = config.x;
const oauth = OAuth({
  consumer: { key: apiKey, secret: apiKeySecret },
  signature_method: 'HMAC-SHA1',
  hash_function(base, key) { return crypto.createHmac('sha1', key).update(base).digest('base64'); },
});

function xRequest(url) {
  return new Promise((resolve, reject) => {
    const reqData = { url, method: 'GET' };
    const token = { key: accessToken, secret: accessTokenSecret };
    const authHeader = oauth.toHeader(oauth.authorize(reqData, token));
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
      headers: { ...authHeader, 'User-Agent': 'somirai-analytics/1.0' },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(body);
          if (p.errors || p.error || p.title) reject(new Error(p.title || JSON.stringify(p.errors || p.error)));
          else resolve(p);
        } catch (e) { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchX() {
  const me = await xRequest('https://api.twitter.com/2/users/me?user.fields=public_metrics,username');
  return {
    username: me.data.username,
    followers: me.data.public_metrics.followers_count,
    following: me.data.public_metrics.following_count,
    tweetCount: me.data.public_metrics.tweet_count,
  };
}

// ── ユーティリティ ───────────────────────────────────────────
function pct(actual, target) {
  if (target === null || target === undefined || target === 0) return null;
  return Math.round((actual / target) * 100);
}

function bar(p) {
  const n = Math.min(20, Math.round((p || 0) / 5));
  return `${'█'.repeat(n)}${'░'.repeat(20 - n)} ${p ?? '?'}%`;
}

function status(p) {
  if (p === null) return '？';
  if (p >= 100) return '達成';
  if (p >= 80)  return '順調';
  if (p >= 50)  return '要注意';
  return '遅れ';
}

const PHASE_ORDER = ['Q1', 'Q2', 'Q3', 'Q4'];

function getNextPhase(current) {
  const i = PHASE_ORDER.indexOf(current);
  return i >= 0 && i < PHASE_ORDER.length - 1 ? PHASE_ORDER[i + 1] : null;
}

// ── メイン ───────────────────────────────────────────────────
async function main() {
  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  const phase = goals.currentPhase;
  const phaseData = goals.roadmap[phase];
  const monthly = phaseData.monthly;
  const nextPhase = getNextPhase(phase);
  const nextPhaseData = nextPhase ? goals.roadmap[nextPhase] : null;

  console.log(`\n${LINE}`);
  console.log(`  Somirai Lab 総合レポート【よろしく】— ${today}`);
  console.log(`  ビジョン: ${goals.vision}`);
  console.log(LINE);

  // ── フェーズ情報 ──────────────────────────────────────────
  console.log(`\n  現在のフェーズ: ${phase}（${phaseData.label}）`);
  console.log(`  テーマ: ${phaseData.theme}`);
  console.log('\n  このフェーズのマイルストーン:');
  phaseData.milestones.forEach((m, i) => console.log(`    ${i + 1}. ${m}`));

  // データ取得
  console.log('\nデータ取得中...');
  const [ga4, sc, adsense, x] = await Promise.allSettled([
    fetchGA4(days),
    fetchSearchConsole(days),
    fetchAdSense(),
    fetchX(),
  ]);

  const ga  = ga4.status === 'fulfilled'     ? ga4.value     : null;
  const gsc = sc.status === 'fulfilled'      ? sc.value      : null;
  const ads = adsense.status === 'fulfilled' ? adsense.value : null;
  const xd  = x.status === 'fulfilled'       ? x.value       : null;

  if (ga4.status === 'rejected')     console.warn(`  ⚠️  GA4: ${ga4.reason?.message}`);
  if (sc.status === 'rejected')      console.warn(`  ⚠️  Search Console: ${sc.reason?.message}`);
  if (adsense.status === 'rejected') console.warn(`  ⚠️  AdSense: ${adsense.reason?.message}`);
  if (x.status === 'rejected')       console.warn(`  ⚠️  X: ${x.reason?.message}`);

  // ── 1. KPI 目標対比 ──────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log(`  1. KPI 目標対比（${phase} 月次目標）`);
  console.log(SEP);

  const totalPV       = ga ? ga.pages.reduce((s, r) => s + (r.screenPageViews || 0), 0) : null;
  const totalSessions = ga ? ga.sources.reduce((s, r) => s + (r.sessions || 0), 0) : null;
  const scClicks      = gsc ? gsc.totalClicks : null;
  const adRevenue     = ads ? (ads.last30days.revenue || 0) : null;
  const noteRevenue   = 0; // 手動更新予定
  const followers     = xd ? xd.followers : null;

  const rows = [
    { label: 'ページビュー',     actual: totalPV,       target: monthly.pv,             unit: 'PV' },
    { label: 'セッション数',     actual: totalSessions,  target: monthly.sessions,       unit: 'sessions' },
    { label: 'SC クリック',      actual: scClicks,       target: monthly.organicClicks,  unit: 'clicks' },
    { label: 'アドセンス収益',   actual: adRevenue,      target: monthly.adsenseRevenue, unit: '円' },
    { label: 'note収益',         actual: noteRevenue,    target: monthly.noteRevenue,    unit: '円' },
    { label: 'Xフォロワー',      actual: followers,      target: monthly.xFollowers,     unit: '人' },
  ];

  rows.forEach(r => {
    const p = pct(r.actual, r.target);
    const st = status(p);
    const val = r.actual !== null && r.actual !== undefined ? `${r.actual.toLocaleString()}${r.unit}` : '取得不可';
    const tgt = `/ 目標 ${(r.target || 0).toLocaleString()}${r.unit}`;
    console.log(`  ${r.label.padEnd(14)} ${val.padEnd(14)} ${tgt.padEnd(22)} [${st}] ${bar(p)}`);
  });

  if (gsc) {
    console.log(`\n  Search Console（${gsc.period}）`);
    console.log(`    表示回数: ${gsc.totalImpressions}  CTR: ${gsc.avgCTR}%  平均順位: ${gsc.avgPosition}位`);
    if (gsc.topQueries?.length) {
      console.log('    上位クエリ:');
      gsc.topQueries.slice(0, 5).forEach(q =>
        console.log(`      「${q.query}」 クリック:${q.clicks}  順位:${q.position}位`));
    }
  }

  // ── 2. 今月のマイルストーン ──────────────────────────────
  const nowYM = new Date().toISOString().slice(0, 7);
  const monthMS = phaseData.monthlyMilestones?.[nowYM];

  const findBounceRate = (tool) => {
    if (!ga) return null;
    const toolKey = tool.replace(/-/g, '_');
    const page = ga.pages.find(p => {
      const k = (p.pagePath || '').replace(/\//g, '').replace(/-/g, '_') || 'top';
      return k === toolKey || k.startsWith(toolKey);
    });
    return page ? page.bounceRate : null;
  };

  if (monthMS) {
    const monthLabel = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
    console.log(`\n${SEP}`);
    console.log(`  2. 今月のマイルストーン進捗（${monthLabel}）  ※直近${days}日間データ`);
    console.log(SEP);

    if (monthMS.pv !== undefined && totalPV !== null) {
      const p = pct(totalPV, monthMS.pv);
      console.log(`  PV          ${totalPV.toLocaleString()}PV / 今月目標 ${monthMS.pv.toLocaleString()}PV  [${status(p)}] ${bar(p)}`);
      if (ga?.trend?.length > 0) {
        const dailyAvg = totalPV / ga.trend.length;
        const projectedPV = Math.round(dailyAvg * 30);
        const paceRate = Math.round((projectedPV / monthMS.pv) * 100);
        const paceSt = paceRate >= 100 ? '達成見込み' : paceRate >= 80 ? '惜しい' : '要加速';
        console.log(`  └ ペース予測  1日平均${Math.round(dailyAvg)}PV → 月末予測 ${projectedPV.toLocaleString()}PV（目標比${paceRate}%）[${paceSt}]`);
      }
    }
    if (monthMS.xFollowers !== undefined && followers !== null) {
      const p = pct(followers, monthMS.xFollowers);
      console.log(`  Xフォロワー  ${followers.toLocaleString()}人 / 今月目標 ${monthMS.xFollowers.toLocaleString()}人 [${status(p)}] ${bar(p)}`);
      const now2 = new Date();
      const endOfMonth = new Date(now2.getFullYear(), now2.getMonth() + 1, 0);
      const remainingDays = Math.ceil((endOfMonth - now2) / 86400000);
      const needed = monthMS.xFollowers - followers;
      if (needed > 0 && remainingDays > 0) {
        console.log(`  └ 残り${remainingDays}日、目標まであと${needed}人（1日${(needed / remainingDays).toFixed(1)}人ペースで達成）`);
      }
    }
    if (monthMS.bounceRateMax) {
      Object.entries(monthMS.bounceRateMax).forEach(([tool, maxRate]) => {
        const br = findBounceRate(tool);
        if (br !== null) {
          const actual = Math.round(br * 100);
          const target = Math.round(maxRate * 100);
          const ok = br <= maxRate;
          console.log(`  直帰率(${tool.padEnd(6)}) ${actual}% / 目標 ${target}%以下  [${ok ? '達成' : '遅れ'}]`);
        }
      });
    }
    if (monthMS.qualitative?.length) {
      console.log('  定性マイルストーン:');
      monthMS.qualitative.forEach(q => console.log(`    ・${q}`));
    }

    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + 1);
    const nextYM = nextDate.toISOString().slice(0, 7);
    const nextMonthMS = phaseData.monthlyMilestones?.[nextYM];
    if (nextMonthMS) {
      const nextLabel = nextDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
      const items = [];
      if (nextMonthMS.pv) items.push(`PV ${nextMonthMS.pv.toLocaleString()}`);
      if (nextMonthMS.xFollowers) items.push(`Xフォロワー ${nextMonthMS.xFollowers.toLocaleString()}人`);
      console.log(`\n  来月（${nextLabel}）の目標: ${items.join(' / ')}`);
      nextMonthMS.qualitative?.forEach(q => console.log(`    ・${q}`));
    }
  }

  // ── 3. PDCA 分析 ────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log('  3. PDCA 分析');
  console.log(SEP);

  // Check
  console.log('\n  【Check — 現状評価】');
  const issues = [];
  const wins = [];

  if (totalPV !== null) {
    const p = pct(totalPV, monthly.pv);
    if (p >= 100) wins.push(`PV ${totalPV}件 — フェーズ目標を達成！`);
    else if (p >= 70) wins.push(`PV ${totalPV}件 — 目標の${p}%、ペース良好`);
    else issues.push(`PV ${totalPV}件 — 目標比${p}%。コンテンツ・SNS強化が必要`);
  }

  if (ga) {
    const organic = ga.sources.find(s => s.sessionDefaultChannelGroup === 'Organic Search');
    const social  = ga.sources.find(s => s.sessionDefaultChannelGroup === 'Organic Social');
    if (organic && organic.sessions > 50) wins.push(`オーガニック検索流入 ${organic.sessions}件 — SEO効果あり`);
    if (!social || parseInt(social.sessions) < 20)
      issues.push(`SNS流入 ${social?.sessions || 0}件 — X投稿の強化でソーシャル流入を増やせる`);
  }

  if (gsc) {
    if (gsc.totalImpressions < 100)
      issues.push(`SC表示回数 ${gsc.totalImpressions}回 — サイト名以外のキーワードで記事を書く必要あり`);
    else if (gsc.avgPosition <= 10)
      wins.push(`平均順位 ${gsc.avgPosition}位 — 検索上位を維持できている`);
  }

  // Q1フェーズ固有チェック
  if (phase === 'Q1') {
    if (!ads || ads.last30days.revenue === 0)
      issues.push('アドセンス審査中 — 承認通知を待ちながら、記事追加・SNS強化で流入を伸ばしておく');
  }

  if (xd) {
    const p = pct(xd.followers, monthly.xFollowers);
    if (p >= 80) wins.push(`Xフォロワー ${xd.followers}人 — 目標ペース`);
    else issues.push(`Xフォロワー ${xd.followers}人 — 目標比${p}%、発信頻度を上げる`);
  }

  wins.forEach(w   => console.log(`  ✅ ${w}`));
  issues.forEach(i => console.log(`  ⚠️  ${i}`));

  // 不達成・遅れの要因分析
  const analysisData = goals.analysis || {};
  const underperforming = [];
  if (totalPV !== null && pct(totalPV, monthMS?.pv || monthly.pv) < 80) underperforming.push('pv');
  if (followers !== null && pct(followers, monthMS?.xFollowers || monthly.xFollowers) < 90) underperforming.push('xFollowers');
  const hasBounceIssue = monthMS?.bounceRateMax && Object.entries(monthMS.bounceRateMax).some(([tool, maxRate]) => {
    const br = findBounceRate(tool);
    return br !== null && br > maxRate;
  });
  if (hasBounceIssue) underperforming.push('bounceRate');

  if (underperforming.length > 0) {
    console.log('\n  【不達成・遅れの要因分析】');
    underperforming.forEach(kpi => {
      const a = analysisData[kpi];
      if (!a) return;
      console.log(`\n  ◆ ${a.label}の遅れ要因:`);
      a.negativeFactors.slice(0, 3).forEach(f => console.log(`    × ${f}`));
      if (a.paceNote) console.log(`    → ${a.paceNote}`);
      console.log(`  ◆ 改善のカギ:`);
      a.positiveFactors.slice(0, 2).forEach(f => console.log(`    ✓ ${f}`));
    });
  }

  // Act
  console.log('\n  【Act — 改善アクション & TODO】');
  const todos = generateTodos({ ga, gsc, ads, xd, totalPV, scClicks, followers, phase, monthly });
  todos.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));

  // Plan
  console.log('\n  【Plan — 次フェーズへの道筋】');
  if (nextPhaseData) {
    console.log(`  次フェーズ ${nextPhase}（${nextPhaseData.label}）のテーマ: ${nextPhaseData.theme}`);
    console.log('  次フェーズ移行条件:');
    nextPhaseData.milestones.forEach(m => console.log(`    ・${m}`));
  } else {
    console.log('  最終フェーズです。安定収益の継続と収益源の多様化を進めてください。');
  }

  // ── 3. 今週のTODO ──────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log('  4. 今週のTODO（優先順）');
  console.log(SEP);
  todos.slice(0, 5).forEach((t, i) => console.log(`  □ ${i + 1}. ${t}`));

  // ── 収益ロードマップ ────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log('  5. 収益ロードマップ進捗');
  console.log(SEP);
  PHASE_ORDER.forEach(q => {
    const qd = goals.roadmap[q];
    const isCurrent = q === phase;
    const marker = isCurrent ? '▶' : ' ';
    const totalTarget = (qd.monthly.adsenseRevenue || 0) + (qd.monthly.noteRevenue || 0) + (qd.monthly.affiliateRevenue || 0);
    console.log(`  ${marker} ${q}（${qd.label}）: 月収目標 ${totalTarget.toLocaleString()}円 — ${qd.theme}`);
  });

  // ── スナップショット保存 ─────────────────────────────────
  const todayISO = new Date().toISOString().split('T')[0];
  const bounceRates = {};
  const avgDurations = {};
  if (ga) {
    ga.pages.forEach(p => {
      const key = p.pagePath.replace(/\//g, '').replace(/-/g, '_') || 'top';
      bounceRates[key] = p.bounceRate;
      avgDurations[key] = p.averageSessionDuration;
    });
  }
  const organicSessions = ga ? (ga.sources.find(s => s.sessionDefaultChannelGroup === 'Organic Search')?.sessions || 0) : null;
  saveSnapshot({
    date: todayISO,
    days,
    pv: totalPV,
    sessions: totalSessions,
    organicSessions,
    followers,
    impressions: gsc?.totalImpressions || null,
    clicks: scClicks,
    avgPosition: gsc?.avgPosition || null,
    bounceRates,
    avgDurations,
  });

  // ── 5. 施策効果トラッキング ──────────────────────────────
  console.log(`\n${SEP}`);
  console.log('  6. 施策効果トラッキング');
  console.log(SEP);

  const interventions = loadInterventions();
  const snapshots = loadSnapshots();

  if (interventions.length === 0) {
    console.log('  施策ログなし（interventions.json に記録してください）');
  } else {
    // 直近90日以内の施策を表示
    const recent = interventions
      .filter(iv => daysBetween(iv.date, todayISO) <= 90)
      .sort((a, b) => b.date.localeCompare(a.date));

    recent.forEach(iv => {
      const elapsed = daysBetween(iv.date, todayISO);
      const elapsedStr = elapsed === 0 ? '今日' : `${elapsed}日前`;
      console.log(`\n  [${ iv.id }] ${ iv.type } — ${ iv.title }`);
      console.log(`  実施: ${ iv.date }（${ elapsedStr }） 対象: ${ iv.tools.join(', ') }`);
      console.log(`  仮説: ${ iv.hypothesis }`);

      // 施策前後のスナップショットを探す
      const beforeSnaps = snapshots.filter(s => s.date <= iv.date);
      const afterSnaps  = snapshots.filter(s => s.date > iv.date);
      const before = beforeSnaps[beforeSnaps.length - 1]; // 直前
      const after  = afterSnaps[afterSnaps.length - 1];   // 直後（最新）

      if (!before) {
        console.log('  効果: ベースライン未計測（施策前のスナップショットなし）');
        return;
      }
      if (!after) {
        console.log('  効果: 計測中（施策後データ蓄積待ち）');
        return;
      }

      const daysAfter = daysBetween(iv.date, after.date);
      console.log(`  効果（施策から${ daysAfter }日後）:`);

      // 直帰率の変化
      iv.tools.forEach(tool => {
        const pathKey = tool.replace(/-/g, '_');
        // pathKeyのマッチングを柔軟に
        const findRate = (snap) => {
          const keys = Object.keys(snap.bounceRates || {});
          const matched = keys.find(k => k.includes(pathKey) || pathKey.includes(k));
          return matched ? snap.bounceRates[matched] : null;
        };
        const bBefore = findRate(before);
        const bAfter  = findRate(after);
        if (bBefore !== null && bAfter !== null) {
          const delta = Math.round((bAfter - bBefore) * 100);
          const sign  = delta < 0 ? '▼' : delta > 0 ? '▲' : '━';
          const eval_ = delta < -5 ? '✅ 改善' : delta > 5 ? '❌ 悪化' : '━ 変化なし';
          console.log(`    直帰率（${ tool }）: ${ Math.round(bBefore * 100) }% → ${ Math.round(bAfter * 100) }%  ${ sign }${ Math.abs(delta) }pt  ${ eval_ }`);
        }
      });

      // オーガニック流入の変化（SEO記事施策）
      if (iv.type === 'SEO記事' && before.organicSessions !== null && after.organicSessions !== null) {
        const delta = after.organicSessions - before.organicSessions;
        const sign  = delta > 0 ? '▲' : delta < 0 ? '▼' : '━';
        const eval_ = delta > 10 ? '✅ 流入増加' : delta > 0 ? '━ 微増' : delta < 0 ? '❌ 減少' : '━ 変化なし';
        console.log(`    オーガニック流入: ${ before.organicSessions } → ${ after.organicSessions }  ${ sign }${ Math.abs(delta) }  ${ eval_ }`);
      }

      // 検索表示回数の変化
      if (before.impressions !== null && after.impressions !== null) {
        const delta = after.impressions - before.impressions;
        const sign  = delta > 0 ? '▲' : delta < 0 ? '▼' : '━';
        console.log(`    検索表示回数: ${ before.impressions } → ${ after.impressions }  ${ sign }${ Math.abs(delta) }`);
      }
    });
  }

  // ── ルーティンチェック ──────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log('  7. ルーティンチェック（定期タスク）');
  console.log(SEP);

  const routineTasks = checkRoutine();
  if (routineTasks.length === 0) {
    console.log('  routine.json が見つかりません');
  } else {
    const weekly    = routineTasks.filter(r => r.cadence === 'weekly');
    const monthly   = routineTasks.filter(r => r.cadence === 'monthly');
    const quarterly = routineTasks.filter(r => r.cadence === 'quarterly');

    if (weekly.length > 0) {
      console.log('\n  【毎週やること】');
      weekly.forEach(r => {
        console.log(`  □ ${r.title}`);
        console.log(`    └ ${r.detail}`);
      });
    }

    if (monthly.length > 0) {
      console.log(`\n  【${monthly[0].urgency}にやること】`);
      monthly.forEach(r => {
        console.log(`  □ [${r.urgency}] ${r.title}`);
        console.log(`    └ ${r.detail}`);
      });
    }

    if (quarterly.length > 0) {
      console.log(`\n  【${quarterly[0].urgency}にやること】`);
      quarterly.forEach(r => {
        console.log(`  □ [${r.urgency}] ${r.title}`);
        console.log(`    └ ${r.detail}`);
      });
    }
  }

  console.log(`\n${LINE}\n`);

  // ── Excel エクスポート ──────────────────────────────────────
  await exportToExcel({
    today,
    phase,
    phaseData,
    nextPhaseData,
    nextPhase,
    rows,
    ga,
    gsc,
    wins,
    issues,
    todos,
    snapshots: loadSnapshots(),
    interventions: loadInterventions(),
    adsData: ads,
    monthlyPvTarget: monthMS?.pv || phaseData.monthly.pv,
  });

  // ── PPT エクスポート（土曜日 or 月初のみ） ──────────────────
  const nowDate = new Date();
  const isSaturday = nowDate.getDay() === 6;
  const isMonthStart = nowDate.getDate() === 1;
  if (isSaturday || isMonthStart || forcePpt) {
    const reason = isSaturday ? '土曜日' : isMonthStart ? '月初' : '手動';
    await exportToPptx({
      today,
      phase,
      phaseData,
      nextPhaseData,
      nextPhase,
      rows,
      gsc,
      wins,
      issues,
      todos,
      totalPV,
      totalSessions,
      followers,
      adRevenue,
      monthly,
    });
    console.log(`  ※ ${reason}のため PPT も出力しました`);
  }
}

// ── ルーティンチェック ────────────────────────────────────────
function checkRoutine() {
  const routineFile = path.join(__dirname, 'routine.json');
  let routines;
  try { routines = JSON.parse(fs.readFileSync(routineFile, 'utf8')).routines; }
  catch { return []; }

  const now = new Date();
  const dayOfMonth = now.getDate();
  const month = now.getMonth() + 1;
  const quarterStartMonths = [1, 4, 7, 10];

  return routines
    .filter(r => {
      if (r.cadence === 'weekly')    return true;
      if (r.cadence === 'monthly')   return dayOfMonth <= 10;
      if (r.cadence === 'quarterly') return quarterStartMonths.includes(month) && dayOfMonth <= 21;
      return false;
    })
    .map(r => {
      let urgency = '毎週';
      if (r.cadence === 'monthly')   urgency = `${month}月中`;
      if (r.cadence === 'quarterly') urgency = `Q${Math.ceil(month / 3)}中`;
      return { ...r, urgency };
    })
    .sort((a, b) => a.priority - b.priority);
}

function generateTodos({ ga, gsc, ads, xd, totalPV, scClicks, followers, phase, monthly }) {
  const todos = [];

  // Q1固有: アドセンス審査中
  if (phase === 'Q1') {
    if (!ads || ads.last30days.revenue === 0) {
      todos.push('【審査中】アドセンス承認待ち → 承認後すぐ広告が出るよう設置済みのまま維持。その間に記事追加・SNS流入強化で承認後の収益を最大化する');
    }
  }

  // SEO系
  if (gsc) {
    if (gsc.totalImpressions < 100)
      todos.push('「習慣化 アプリ 無料」「節約 ツール」などロングテールキーワードで記事を1本書く');
    if (gsc.avgCTR < 3)
      todos.push(`CTR ${gsc.avgCTR}% → タイトルに「無料」「5分でわかる」など具体的な言葉を追加`);
    if (gsc.topQueries?.length && gsc.topQueries[0].query !== 'somirai' && gsc.topQueries[0].query !== 'somira')
      todos.push(`上位クエリ「${gsc.topQueries[0].query}」の記事を補強して1位獲得を狙う`);
  }

  // X・SNS系
  if (ga) {
    const social = ga.sources.find(s => s.sessionDefaultChannelGroup === 'Organic Social');
    if (!social || parseInt(social.sessions) < 30)
      todos.push('Xでツール使い方スクリーンショット付き投稿を週3本 → TEMPERを実際に使っている様子を見せる');
  }

  if (xd && xd.followers < monthly.xFollowers)
    todos.push('AIツール・便利技ジャンルで「バズりやすいTips投稿」を週2本作成してフォロワー増加を狙う');

  // TEMPER告知
  if (ga) {
    const toolRows = ga.pages.filter(r => config.tools.some(t => r.pagePath?.startsWith(t.path)));
    if (toolRows[0]) {
      const topTool = config.tools.find(t => toolRows[0].pagePath.startsWith(t.path));
      todos.push(`最人気ツール「${topTool?.name}」をnoteの無料記事で紹介 → SEO流入＋フォロワー獲得の一石二鳥`);
    }
  }

  // Q2以降: note有料記事
  if (phase !== 'Q1') {
    todos.push('note有料記事の企画を1本立てる（ツール作成ノウハウ・AI活用術など得意分野で）');
  }

  // アドセンスデータ入力
  if (ads && ads.last30days.revenue === 0 && phase !== 'Q1')
    todos.push('adsense-data.json にアドセンス管理画面の直近収益データを入力する');

  return todos;
}

// ── Excel エクスポート ────────────────────────────────────────
async function exportToExcel({ today, phase, phaseData, nextPhaseData, nextPhase, rows, ga, gsc, wins, issues, todos, snapshots, interventions, adsData, monthlyPvTarget }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Somirai Lab';
  wb.created = new Date();

  const COLOR = {
    header:   { argb: 'FF1A1A2E' },
    subHeader:{ argb: 'FF16213E' },
    achieved: { argb: 'FF22C55E' },
    steady:   { argb: 'FF3B82F6' },
    caution:  { argb: 'FFFBBF24' },
    behind:   { argb: 'FFEF4444' },
    white:    { argb: 'FFFFFFFF' },
    lightGray:{ argb: 'FFF3F4F6' },
    darkText: { argb: 'FF111827' },
  };

  function headerStyle(color = COLOR.header) {
    return {
      font: { bold: true, color: COLOR.white, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: color },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: { bottom: { style: 'thin', color: { argb: 'FF6B7280' } } },
    };
  }

  function statusColor(st) {
    if (st === '達成') return COLOR.achieved;
    if (st === '順調') return COLOR.steady;
    if (st === '要注意') return COLOR.caution;
    return COLOR.behind;
  }

  function statusStyle(st) {
    return {
      font: { bold: true, color: COLOR.white, size: 10 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: statusColor(st) },
      alignment: { horizontal: 'center', vertical: 'middle' },
    };
  }

  function cellStyle(bg = null) {
    const s = { alignment: { vertical: 'middle', wrapText: true }, font: { color: COLOR.darkText } };
    if (bg) s.fill = { type: 'pattern', pattern: 'solid', fgColor: bg };
    return s;
  }

  // ─── シート1: KPIサマリー ───────────────────────────────────
  const ws1 = wb.addWorksheet('KPIサマリー');
  ws1.columns = [
    { key: 'label',   width: 18 },
    { key: 'actual',  width: 18 },
    { key: 'target',  width: 18 },
    { key: 'rate',    width: 12 },
    { key: 'status',  width: 10 },
    { key: 'bar',     width: 30 },
  ];

  // タイトル行
  ws1.mergeCells('A1:F1');
  const titleCell = ws1.getCell('A1');
  titleCell.value = `Somirai Lab 総合レポート — ${today}（${phase}: ${phaseData.label}）`;
  titleCell.style = { font: { bold: true, size: 14, color: COLOR.white }, fill: { type: 'pattern', pattern: 'solid', fgColor: COLOR.header }, alignment: { horizontal: 'center', vertical: 'middle' } };
  ws1.getRow(1).height = 30;

  // サブタイトル
  ws1.mergeCells('A2:F2');
  const themeCell = ws1.getCell('A2');
  themeCell.value = `テーマ: ${phaseData.theme}`;
  themeCell.style = { font: { italic: true, size: 11, color: COLOR.white }, fill: { type: 'pattern', pattern: 'solid', fgColor: COLOR.subHeader }, alignment: { horizontal: 'center', vertical: 'middle' } };
  ws1.getRow(2).height = 22;

  // ヘッダー
  const h1 = ws1.addRow(['指標', '実績', '目標', '達成率', '判定', '進捗バー']);
  ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
    ws1.getCell(`${col}3`).style = headerStyle();
  });
  ws1.getRow(3).height = 22;

  // データ行
  rows.forEach((r, i) => {
    const p = r.actual !== null && r.actual !== undefined ? Math.round((r.actual / r.target) * 100) : null;
    const st = p !== null ? status(p) : '取得不可';
    const barWidth = p !== null ? Math.min(20, Math.round(p / 5)) : 0;
    const barStr = '■'.repeat(barWidth) + '□'.repeat(20 - barWidth);
    const actualStr = r.actual !== null ? `${r.actual.toLocaleString()} ${r.unit}` : '取得不可';
    const targetStr = `${(r.target || 0).toLocaleString()} ${r.unit}`;
    const rateStr = p !== null ? `${p}%` : '-';

    const row = ws1.addRow([r.label, actualStr, targetStr, rateStr, st, barStr]);
    const bg = i % 2 === 0 ? COLOR.lightGray : null;
    ['A', 'B', 'C', 'D', 'F'].forEach(col => {
      ws1.getCell(`${col}${row.number}`).style = cellStyle(bg);
    });
    ws1.getCell(`E${row.number}`).style = p !== null ? statusStyle(st) : cellStyle(bg);
    row.height = 20;
  });

  // Search Console補足
  if (gsc) {
    ws1.addRow([]);
    const scHeader = ws1.addRow(['Search Console サマリー', '', '', '', '', '']);
    ws1.mergeCells(`A${scHeader.number}:F${scHeader.number}`);
    ws1.getCell(`A${scHeader.number}`).style = headerStyle(COLOR.subHeader);

    ws1.addRow(['期間', gsc.period, '', '表示回数', gsc.totalImpressions, '']);
    ws1.addRow(['CTR', `${gsc.avgCTR}%`, '', '平均順位', `${gsc.avgPosition}位`, '']);

    if (gsc.topQueries?.length) {
      ws1.addRow(['上位クエリ', 'クリック数', '表示回数', 'CTR', '平均順位', '']);
      gsc.topQueries.slice(0, 5).forEach(q => {
        ws1.addRow([q.query, q.clicks, q.impressions, `${q.ctr}%`, `${q.position}位`, '']);
      });
    }
  }

  // ─── シート2: PDCA分析 ─────────────────────────────────────
  const ws2 = wb.addWorksheet('PDCA分析');
  ws2.columns = [{ width: 6 }, { width: 60 }];

  ws2.mergeCells('A1:B1');
  ws2.getCell('A1').value = `PDCA分析 — ${today}`;
  ws2.getCell('A1').style = { font: { bold: true, size: 14, color: COLOR.white }, fill: { type: 'pattern', pattern: 'solid', fgColor: COLOR.header }, alignment: { horizontal: 'center', vertical: 'middle' } };
  ws2.getRow(1).height = 28;

  const addSection = (label, color, items, prefix = '') => {
    const hRow = ws2.addRow([label, '']);
    ws2.mergeCells(`A${hRow.number}:B${hRow.number}`);
    ws2.getCell(`A${hRow.number}`).style = headerStyle(color);
    hRow.height = 22;
    items.forEach(item => {
      const r = ws2.addRow([prefix, item]);
      ws2.getCell(`A${r.number}`).style = { alignment: { horizontal: 'center' }, font: { size: 13 } };
      ws2.getCell(`B${r.number}`).style = { alignment: { vertical: 'middle', wrapText: true }, font: { size: 10 } };
      r.height = 18;
    });
    ws2.addRow([]);
  };

  addSection('✅ Check — 良かった点', { argb: 'FF166534' }, wins, '✅');
  addSection('⚠️  Check — 課題点',   { argb: 'FF92400E' }, issues, '⚠️');
  addSection('📋 Act — 今週のTODO（優先順）', { argb: 'FF1E40AF' }, todos.slice(0, 5).map((t, i) => `${i + 1}. ${t}`));
  addSection('🗺️  Plan — 次フェーズへの道筋', { argb: 'FF4C1D95' }, nextPhaseData ? [
    `次フェーズ ${nextPhase}（${nextPhaseData.label}）`,
    `テーマ: ${nextPhaseData.theme}`,
    ...nextPhaseData.milestones.map(m => `・${m}`),
  ] : ['最終フェーズです。安定収益の継続と収益源の多様化を進めてください。']);

  // ─── シート3: 収益ロードマップ ──────────────────────────────
  const ws3 = wb.addWorksheet('収益ロードマップ');
  ws3.columns = [
    { key: 'phase',  width: 8  },
    { key: 'label',  width: 20 },
    { key: 'target', width: 18 },
    { key: 'theme',  width: 50 },
    { key: 'status', width: 10 },
  ];

  ws3.mergeCells('A1:E1');
  ws3.getCell('A1').value = '収益ロードマップ進捗';
  ws3.getCell('A1').style = { font: { bold: true, size: 14, color: COLOR.white }, fill: { type: 'pattern', pattern: 'solid', fgColor: COLOR.header }, alignment: { horizontal: 'center', vertical: 'middle' } };
  ws3.getRow(1).height = 28;

  const rmHeader = ws3.addRow(['フェーズ', 'ラベル', '月収目標', 'テーマ', '状態']);
  ['A', 'B', 'C', 'D', 'E'].forEach(col => ws3.getCell(`${col}2`).style = headerStyle());
  rmHeader.height = 22;

  PHASE_ORDER.forEach((q, i) => {
    const qd = goals.roadmap[q];
    const isCurrent = q === phase;
    const totalTarget = (qd.monthly.adsenseRevenue || 0) + (qd.monthly.noteRevenue || 0) + (qd.monthly.affiliateRevenue || 0);
    const stStr = isCurrent ? '▶ 現在' : (PHASE_ORDER.indexOf(q) < PHASE_ORDER.indexOf(phase) ? '完了' : '未来');
    const row = ws3.addRow([q, qd.label, `${totalTarget.toLocaleString()}円`, qd.theme, stStr]);
    const bg = isCurrent ? { argb: 'FFDBEAFE' } : (i % 2 === 0 ? COLOR.lightGray : null);
    ['A', 'B', 'C', 'D', 'E'].forEach(col => {
      ws3.getCell(`${col}${row.number}`).style = cellStyle(bg);
      if (isCurrent) ws3.getCell(`${col}${row.number}`).font = { bold: true };
    });
    row.height = 20;
  });

  // ─── シート4: 日別データ（GA4 + Search Console） ───────────
  {
    const ws4 = wb.addWorksheet('日別データ');
    const cols = [
      { key: 'date',     width: 13, header: '日付' },
      { key: 'pv',       width: 9,  header: 'PV' },
      { key: 'sessions', width: 10, header: 'セッション' },
      { key: 'users',    width: 9,  header: 'ユーザー' },
      { key: 'bounce',   width: 10, header: '直帰率(%)' },
      { key: 'duration', width: 12, header: '滞在時間(秒)' },
      { key: 'clicks',   width: 10, header: 'SCクリック' },
      { key: 'impress',  width: 12, header: 'SC表示回数' },
      { key: 'ctr',      width: 9,  header: 'CTR(%)' },
      { key: 'position', width: 9,  header: '平均順位' },
      { key: 'cumPV',    width: 11, header: '累積PV' },
      { key: 'pacePV',   width: 15, header: '目標ペース(累積)' },
      { key: 'paceDiff', width: 11, header: 'ペース差' },
    ];
    ws4.columns = cols;

    // 2行目（ヘッダー行）でウィンドウ枠を固定
    ws4.views = [{ state: 'frozen', xSplit: 0, ySplit: 2, topLeftCell: 'A3' }];

    ws4.mergeCells('A1:M1');
    ws4.getCell('A1').value = `日別データ（GA4 + Search Console）— 直近${days}日`;
    ws4.getCell('A1').style = { font: { bold: true, size: 14, color: COLOR.white }, fill: { type: 'pattern', pattern: 'solid', fgColor: COLOR.header }, alignment: { horizontal: 'center', vertical: 'middle' } };
    ws4.getRow(1).height = 28;

    const d4Header = ws4.addRow(cols.map(c => c.header));
    'ABCDEFGHIJKLM'.split('').forEach(col => ws4.getCell(`${col}2`).style = headerStyle());
    d4Header.height = 22;

    // SC日別をdateキーのMapに変換
    const scMap = {};
    (gsc?.dailyTrend || []).forEach(r => { scMap[r.date] = r; });

    // GA4日別データを正規化（date を YYYY-MM-DD 形式に統一）
    const gaDaily = (ga?.trend || []).map(g => {
      const raw = g.date || '';
      const dateStr = raw.length === 8
        ? `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`
        : raw;
      return { ...g, dateStr };
    });

    // SCのみにある日付を追加してから日付昇順でソート
    const ga4DateSet = new Set(gaDaily.map(g => g.dateStr));
    const scOnlyDates = (gsc?.dailyTrend || [])
      .filter(r => !ga4DateSet.has(r.date))
      .map(r => ({ dateStr: r.date, _scOnly: true, ...r }));

    const allDays = [...gaDaily, ...scOnlyDates]
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    let cumPV = 0;
    const totalDays = allDays.length;
    allDays.forEach((g, i) => {
      const sc = scMap[g.dateStr] || {};
      const bounceVal = !g._scOnly && g.bounceRate != null ? Math.round(g.bounceRate * 100) : '-';
      const durationVal = !g._scOnly && g.averageSessionDuration != null ? Math.round(g.averageSessionDuration) : '-';
      const pvVal = g._scOnly ? 0 : (typeof g.screenPageViews === 'number' ? g.screenPageViews : 0);
      cumPV += pvVal;

      // 目標ペース: 月次目標を全期間日数で按分した累積値
      const pacePV = monthlyPvTarget ? Math.round((monthlyPvTarget / 30) * (i + 1)) : null;
      const paceDiff = pacePV !== null ? cumPV - pacePV : null;

      const row = ws4.addRow([
        g.dateStr,
        g._scOnly ? '-' : (g.screenPageViews ?? '-'),
        g._scOnly ? '-' : (g.sessions ?? '-'),
        g._scOnly ? '-' : (g.activeUsers ?? '-'),
        bounceVal,
        durationVal,
        sc.clicks ?? '-',
        sc.impressions ?? '-',
        sc.ctr != null ? sc.ctr : '-',
        sc.position != null ? sc.position : '-',
        cumPV,
        pacePV ?? '-',
        paceDiff ?? '-',
      ]);

      const bg = i % 2 === 0 ? COLOR.lightGray : null;
      'ABCDEFGHIJKLM'.split('').forEach(col => {
        ws4.getCell(`${col}${row.number}`).style = cellStyle(bg);
        ws4.getCell(`${col}${row.number}`).alignment = { horizontal: 'right', vertical: 'middle' };
      });
      ws4.getCell(`A${row.number}`).alignment = { horizontal: 'left', vertical: 'middle' };

      // ペース差（M列）を色付け
      if (paceDiff !== null) {
        const diffCell = ws4.getCell(`M${row.number}`);
        diffCell.font = { bold: true, color: { argb: paceDiff >= 0 ? 'FF166534' : 'FF991B1B' } };
        diffCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: paceDiff >= 0 ? 'FFD1FAE5' : 'FFFEE2E2' } };
      }

      row.height = 18;
    });
  }

  // 保存
  const downloadsDir = path.join(process.env.HOME, 'Downloads');
  const dateStr = new Date().toISOString().split('T')[0];
  const outPath = path.join(downloadsDir, `somirai_report_${dateStr}.xlsx`);
  await wb.xlsx.writeFile(outPath);
  console.log(`\n  📊 Excelレポート出力: ${outPath}`);
  return outPath;
}

// ── PPT エクスポート ──────────────────────────────────────────
async function exportToPptx({ today, phase, phaseData, nextPhaseData, nextPhase, rows, gsc, wins, issues, todos, totalPV, totalSessions, followers, adRevenue, monthly }) {
  const prs = new PptxGenJS();
  prs.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 inch (16:9)
  prs.author  = 'Somirai Lab';
  prs.subject = `Somirai Lab レポート ${today}`;

  // ── カラー定数 ──────────────────────────────────────────────
  const C = {
    bg:      '1A1A2E',
    accent:  '4F87FF',
    green:   '22C55E',
    yellow:  'FBBF24',
    red:     'EF4444',
    blue:    '3B82F6',
    white:   'FFFFFF',
    gray:    'CBD5E1',
    darkgray:'334155',
  };

  function statusColor(p) {
    if (p === null) return C.gray;
    if (p >= 100) return C.green;
    if (p >= 80)  return C.blue;
    if (p >= 50)  return C.yellow;
    return C.red;
  }

  function addSlide(titleText, subtitleText) {
    const slide = prs.addSlide();
    // 背景
    slide.background = { color: C.bg };
    // タイトルバー（左端の縦ライン）
    slide.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: 7.5, fill: { color: C.accent } });
    // タイトル
    slide.addText(titleText, {
      x: 0.25, y: 0.15, w: 12, h: 0.6,
      fontSize: 24, bold: true, color: C.white, fontFace: 'Hiragino Sans',
    });
    if (subtitleText) {
      slide.addText(subtitleText, {
        x: 0.25, y: 0.75, w: 12, h: 0.35,
        fontSize: 13, color: C.gray, fontFace: 'Hiragino Sans',
      });
    }
    // 区切り線
    slide.addShape(prs.ShapeType.line, {
      x: 0.25, y: 1.1, w: 12.8, h: 0,
      line: { color: C.accent, width: 1 },
    });
    return slide;
  }

  // ─── スライド1: タイトル ───────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: C.bg };
    slide.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: 7.5, fill: { color: C.accent } });
    slide.addText('Somirai Lab', {
      x: 0.4, y: 1.8, w: 12, h: 0.8,
      fontSize: 40, bold: true, color: C.white, fontFace: 'Hiragino Sans',
    });
    slide.addText('総合レポート', {
      x: 0.4, y: 2.6, w: 12, h: 0.7,
      fontSize: 30, color: C.accent, fontFace: 'Hiragino Sans',
    });
    slide.addText(today, {
      x: 0.4, y: 3.4, w: 12, h: 0.5,
      fontSize: 18, color: C.gray, fontFace: 'Hiragino Sans',
    });
    slide.addText(`フェーズ ${phase}（${phaseData.label}）— ${phaseData.theme}`, {
      x: 0.4, y: 4.0, w: 12, h: 0.45,
      fontSize: 15, color: C.gray, fontFace: 'Hiragino Sans',
    });
  }

  // ─── スライド2: KPIサマリー ────────────────────────────────
  {
    const slide = addSlide('KPI 目標対比', `${phase} 月次目標 — 直近30日`);

    rows.forEach((r, i) => {
      const p = r.actual !== null && r.actual !== undefined
        ? Math.round((r.actual / (r.target || 1)) * 100) : null;
      const barW = Math.min(7.5, ((p || 0) / 100) * 7.5);
      const col = statusColor(p);
      const yBase = 1.35 + i * 0.95;

      // ラベル
      slide.addText(r.label, {
        x: 0.25, y: yBase, w: 2.2, h: 0.4,
        fontSize: 12, color: C.white, fontFace: 'Hiragino Sans',
      });
      // 実績 / 目標
      const actualStr = r.actual !== null ? `${r.actual.toLocaleString()} ${r.unit}` : '取得不可';
      const targetStr = `/ 目標 ${(r.target || 0).toLocaleString()} ${r.unit}`;
      slide.addText(`${actualStr}  ${targetStr}`, {
        x: 2.5, y: yBase, w: 5, h: 0.4,
        fontSize: 11, color: C.gray, fontFace: 'Hiragino Sans',
      });
      // 達成率バッジ
      const badge = p !== null ? `${p}%` : '-';
      const badgeColor = col;
      slide.addShape(prs.ShapeType.roundRect, {
        x: 11.5, y: yBase + 0.02, w: 1.0, h: 0.35,
        fill: { color: badgeColor }, line: { color: badgeColor },
        rectRadius: 0.05,
      });
      slide.addText(badge, {
        x: 11.5, y: yBase + 0.02, w: 1.0, h: 0.35,
        fontSize: 11, bold: true, color: C.white, align: 'center', fontFace: 'Hiragino Sans',
      });
      // プログレスバー背景
      slide.addShape(prs.ShapeType.rect, {
        x: 2.5, y: yBase + 0.45, w: 7.5, h: 0.22,
        fill: { color: C.darkgray }, line: { color: C.darkgray },
      });
      // プログレスバー本体
      if (barW > 0) {
        slide.addShape(prs.ShapeType.rect, {
          x: 2.5, y: yBase + 0.45, w: barW, h: 0.22,
          fill: { color: col }, line: { color: col },
        });
      }
    });
  }

  // ─── スライド3: PDCA Check ────────────────────────────────
  {
    const slide = addSlide('Check — 現状評価', '良かった点 / 課題点');

    // 良かった点
    slide.addText('✅  良かった点', {
      x: 0.25, y: 1.2, w: 6, h: 0.4,
      fontSize: 14, bold: true, color: C.green, fontFace: 'Hiragino Sans',
    });
    wins.forEach((w, i) => {
      slide.addText(`・${w}`, {
        x: 0.4, y: 1.65 + i * 0.55, w: 5.8, h: 0.5,
        fontSize: 11, color: C.white, fontFace: 'Hiragino Sans', wrap: true,
      });
    });

    // 区切り縦線
    slide.addShape(prs.ShapeType.line, {
      x: 6.7, y: 1.2, w: 0, h: 5.8,
      line: { color: C.darkgray, width: 1 },
    });

    // 課題点
    slide.addText('⚠️  課題点', {
      x: 6.9, y: 1.2, w: 6, h: 0.4,
      fontSize: 14, bold: true, color: C.yellow, fontFace: 'Hiragino Sans',
    });
    issues.forEach((iss, i) => {
      slide.addText(`・${iss}`, {
        x: 7.0, y: 1.65 + i * 0.65, w: 5.8, h: 0.6,
        fontSize: 11, color: C.white, fontFace: 'Hiragino Sans', wrap: true,
      });
    });
  }

  // ─── スライド4: Act（TODO）────────────────────────────────
  {
    const slide = addSlide('Act — 今週のTODO', '優先度順 Top5');

    todos.slice(0, 5).forEach((t, i) => {
      const y = 1.3 + i * 1.0;
      // 番号バッジ
      slide.addShape(prs.ShapeType.ellipse, {
        x: 0.25, y: y, w: 0.45, h: 0.45,
        fill: { color: C.accent }, line: { color: C.accent },
      });
      slide.addText(`${i + 1}`, {
        x: 0.25, y: y, w: 0.45, h: 0.45,
        fontSize: 14, bold: true, color: C.white, align: 'center', fontFace: 'Hiragino Sans',
      });
      // TODO テキスト
      slide.addText(t, {
        x: 0.85, y: y, w: 12.2, h: 0.5,
        fontSize: 12, color: C.white, fontFace: 'Hiragino Sans', wrap: true,
      });
      // 下線
      slide.addShape(prs.ShapeType.line, {
        x: 0.85, y: y + 0.55, w: 12.2, h: 0,
        line: { color: C.darkgray, width: 0.5 },
      });
    });
  }

  // ─── スライド5: Plan（次フェーズ） ───────────────────────
  {
    const slide = addSlide('Plan — 次フェーズへの道筋', nextPhaseData ? `次フェーズ: ${nextPhase}（${nextPhaseData.label}）` : '最終フェーズ');

    if (nextPhaseData) {
      slide.addText(`テーマ: ${nextPhaseData.theme}`, {
        x: 0.25, y: 1.3, w: 12.8, h: 0.45,
        fontSize: 15, color: C.accent, fontFace: 'Hiragino Sans',
      });
      slide.addText('移行条件', {
        x: 0.25, y: 1.85, w: 12.8, h: 0.4,
        fontSize: 13, bold: true, color: C.gray, fontFace: 'Hiragino Sans',
      });
      nextPhaseData.milestones.forEach((m, i) => {
        slide.addShape(prs.ShapeType.rect, {
          x: 0.25, y: 2.35 + i * 0.85, w: 12.5, h: 0.65,
          fill: { color: C.darkgray }, line: { color: C.darkgray },
          rectRadius: 0.06,
        });
        slide.addText(`✓  ${m}`, {
          x: 0.4, y: 2.35 + i * 0.85, w: 12.2, h: 0.65,
          fontSize: 13, color: C.white, fontFace: 'Hiragino Sans',
        });
      });
    } else {
      slide.addText('最終フェーズです。安定収益の継続と収益源の多様化を進めてください。', {
        x: 0.25, y: 2.0, w: 12.8, h: 0.5,
        fontSize: 14, color: C.white, fontFace: 'Hiragino Sans',
      });
    }
  }

  // 保存
  const downloadsDir = path.join(process.env.HOME, 'Downloads');
  const dateStr = new Date().toISOString().split('T')[0];
  const outPath = path.join(downloadsDir, `somirai_report_${dateStr}.pptx`);
  await prs.writeFile({ fileName: outPath });
  console.log(`  📊 PPTレポート出力:  ${outPath}`);
  return outPath;
}

main().catch(err => {
  console.error('yoroshiku エラー:', err.message);
  process.exit(1);
});
