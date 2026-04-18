/**
 * report.js
 * GA4 + X データを統合して analyst エージェント向けレポートを生成する
 * 使用: node report.js [days=30]
 */

const { fetchGA4 } = require('./fetch-ga4');
const { fetchX }   = require('./fetch-x');
const config       = require('./config.json');

const days = parseInt(process.argv[2] || '30', 10);

async function generateReport() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Somira Lab 分析レポート — ${new Date().toLocaleDateString('ja-JP')}`);
  console.log(`${'='.repeat(60)}\n`);

  // ── GA4 ──────────────────────────────────────────────────
  console.log('📊 GA4 データを取得中...');
  let ga4Data;
  try {
    ga4Data = await fetchGA4(days);
    printGA4Report(ga4Data, config.tools);
  } catch (err) {
    console.error('  ⚠️  GA4 取得エラー:', err.message);
    if (err.message.includes('PERMISSION_DENIED')) {
      console.error('  → サービスアカウントへの GA4 アクセス権限を確認してください');
    }
    if (err.message.includes('invalid_argument') || err.message.includes('INVALID_ARGUMENT')) {
      console.error('  → config.json の propertyId が正しいか確認してください');
    }
  }

  // ── X ────────────────────────────────────────────────────
  console.log('\n🐦 X データを取得中...');
  let xData;
  try {
    xData = await fetchX();
    printXReport(xData);
  } catch (err) {
    console.error('  ⚠️  X 取得エラー:', err.message);
  }

  // ── 総合提言 ─────────────────────────────────────────────
  if (ga4Data && xData && !xData.error) {
    printRecommendations(ga4Data, xData, config.tools);
  }

  console.log(`\n${'='.repeat(60)}\n`);
}

function printGA4Report(data, tools) {
  console.log(`\n【サイト全体 — 直近${data.period}】`);

  // ツール別ページビュー
  console.log('\n  ■ ツール別 ページビュー（上位）');
  const toolPaths = tools.map(t => t.path);
  const toolRows = data.pages.filter(r =>
    toolPaths.some(p => r.pagePath && r.pagePath.startsWith(p))
  );
  if (toolRows.length === 0) {
    console.log('  （データなし — GA4 の Property ID を確認してください）');
  } else {
    toolRows.slice(0, 10).forEach(r => {
      const tool = tools.find(t => r.pagePath.startsWith(t.path));
      const name = tool ? tool.name : r.pagePath;
      console.log(
        `  ${name.padEnd(20)} PV: ${String(r.screenPageViews).padStart(6)}  ユーザー: ${String(r.activeUsers).padStart(5)}  直帰率: ${(r.bounceRate * 100).toFixed(1)}%`
      );
    });
  }

  // 流入元
  console.log('\n  ■ 流入元');
  data.sources.forEach(r => {
    console.log(`  ${(r.sessionDefaultChannelGroup || '不明').padEnd(25)} セッション: ${String(r.sessions).padStart(5)}  ユーザー: ${r.activeUsers}`);
  });

  // デバイス
  console.log('\n  ■ デバイス');
  data.devices.forEach(r => {
    console.log(`  ${(r.deviceCategory || '').padEnd(15)} セッション: ${r.sessions}  ユーザー: ${r.activeUsers}`);
  });

  // 直近7日のトレンド（最後7件）
  const recent7 = data.trend.slice(-7);
  if (recent7.length) {
    console.log('\n  ■ 直近7日間の推移');
    recent7.forEach(r => {
      const d = r.date || '';
      const bar = '█'.repeat(Math.min(20, Math.round(r.sessions / 5)));
      console.log(`  ${d}  ${bar} ${r.sessions}セッション / ${r.activeUsers}ユーザー`);
    });
  }
}

function printXReport(data) {
  if (data.error) {
    console.log(`  ⚠️  ${data.error}`);
    return;
  }

  const a = data.account;
  console.log(`\n【X アカウント: @${a.username}】`);
  console.log(`  フォロワー: ${a.followers}  フォロー中: ${a.following}  総ツイート数: ${a.tweetCount}`);
  console.log(`  直近20ツイート 平均インプレッション: ${data.avgImpressions}  平均エンゲージメント: ${data.avgEngagements}`);

  if (data.topTweets.length) {
    console.log('\n  ■ エンゲージメント上位ツイート');
    data.topTweets.forEach((t, i) => {
      console.log(`  ${i + 1}. [${t.created_at?.slice(0, 10)}] ${t.text}`);
      console.log(`     ❤️ ${t.likes}  🔁 ${t.retweets}  💬 ${t.replies}  impressions: ${t.impressions}`);
    });
  }
}

function printRecommendations(ga4, x, tools) {
  console.log('\n【💡 analyst 提言】');

  // 最も PV の多いツール
  const toolRows = ga4.pages.filter(r =>
    tools.some(t => r.pagePath && r.pagePath.startsWith(t.path))
  );
  if (toolRows[0]) {
    const topTool = tools.find(t => toolRows[0].pagePath.startsWith(t.path));
    console.log(`  ✅ 最も使われているツール: ${topTool?.name || toolRows[0].pagePath} (PV: ${toolRows[0].screenPageViews})`);
    console.log(`     → このツールの機能追加・プロモーションが最も効果的`);
  }

  // 流入元チェック
  const organic = ga4.sources.find(s => s.sessionDefaultChannelGroup === 'Organic Search');
  const social  = ga4.sources.find(s => s.sessionDefaultChannelGroup === 'Organic Social');
  if (organic) {
    console.log(`  📌 オーガニック検索: ${organic.sessions}セッション — SEO が機能しています`);
  }
  if (social && parseInt(social.sessions) < 10) {
    console.log(`  📌 SNS流入: ${social?.sessions || 0}セッション — X の投稿増加で伸びしろあり`);
  }

  // フォロワー数とツイート効果
  if (x.account.followers < 100) {
    console.log(`  📣 フォロワー ${x.account.followers}人 — 毎日投稿よりも「引用RT・スレッド形式」が拡散しやすい時期`);
  }
  if (x.avgEngagements === 0) {
    console.log(`  💬 エンゲージメント 0 が続いている場合 → ハッシュタグ・スクリーンショット付き投稿を試してください`);
  }
}

generateReport().catch(err => {
  console.error('レポート生成エラー:', err);
  process.exit(1);
});
