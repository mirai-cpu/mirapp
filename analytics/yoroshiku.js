/**
 * yoroshiku.js
 * 「よろしく」コマンド — GA4 + X + Search Console + AdSense を統合分析
 * ロードマップ対比・PDCA・今週のTODOを出力する
 * 使用: node yoroshiku.js [days=30]
 */

const { fetchGA4 } = require('./fetch-ga4');
const { fetchSearchConsole } = require('./fetch-searchconsole');
const { fetchAdSense } = require('./fetch-adsense');
const config = require('./config.json');
const goals = require('./goals.json');
const https = require('https');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');

const days = parseInt(process.argv[2] || '30', 10);
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

  // ── 2. PDCA 分析 ────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log('  2. PDCA 分析');
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
      issues.push('アドセンス未審査 — Q1最優先ミッション。審査通過に向けてコンテンツを増やす');
  }

  if (xd) {
    const p = pct(xd.followers, monthly.xFollowers);
    if (p >= 80) wins.push(`Xフォロワー ${xd.followers}人 — 目標ペース`);
    else issues.push(`Xフォロワー ${xd.followers}人 — 目標比${p}%、発信頻度を上げる`);
  }

  wins.forEach(w   => console.log(`  ✅ ${w}`));
  issues.forEach(i => console.log(`  ⚠️  ${i}`));

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
  console.log('  3. 今週のTODO（優先順）');
  console.log(SEP);
  todos.slice(0, 5).forEach((t, i) => console.log(`  □ ${i + 1}. ${t}`));

  // ── 収益ロードマップ ────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log('  4. 収益ロードマップ進捗');
  console.log(SEP);
  PHASE_ORDER.forEach(q => {
    const qd = goals.roadmap[q];
    const isCurrent = q === phase;
    const marker = isCurrent ? '▶' : ' ';
    const totalTarget = (qd.monthly.adsenseRevenue || 0) + (qd.monthly.noteRevenue || 0) + (qd.monthly.affiliateRevenue || 0);
    console.log(`  ${marker} ${q}（${qd.label}）: 月収目標 ${totalTarget.toLocaleString()}円 — ${qd.theme}`);
  });

  console.log(`\n${LINE}\n`);
}

function generateTodos({ ga, gsc, ads, xd, totalPV, scClicks, followers, phase, monthly }) {
  const todos = [];

  // Q1固有: アドセンス審査通過が最優先
  if (phase === 'Q1') {
    if (!ads || ads.last30days.revenue === 0) {
      todos.push('【最優先】アドセンス審査通過 → プライバシーポリシー・お問い合わせページを設置＆記事を5本以上に増やす');
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

main().catch(err => {
  console.error('yoroshiku エラー:', err.message);
  process.exit(1);
});
