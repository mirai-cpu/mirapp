/**
 * fetch-searchconsole.js
 * Google Search Console API からサイトのSEOデータを取得する
 * サービスアカウント: analytics-reader@somirai-analytics.iam.gserviceaccount.com
 * ※ Search Console の「設定 > ユーザーと権限」でこのメールを制限付きユーザーとして追加要
 * 使用: node fetch-searchconsole.js [days=28]
 */

const { google } = require('googleapis');
const path = require('path');
const config = require('./config.json');

const SITE_URL = 'https://somirai.jp/';
const days = parseInt(process.argv[2] || '28', 10);

function getDateRange(days) {
  const end = new Date();
  end.setDate(end.getDate() - 3); // Search Console は3日遅延
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

async function fetchSearchConsole(daysArg) {
  const d = daysArg || days;
  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve(__dirname, config.ga4.keyFilePath),
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });

  const sc = google.searchconsole({ version: 'v1', auth });
  const { startDate, endDate } = getDateRange(d);

  // ① サマリー（全体クリック・表示・CTR・平均順位）
  const [summary, byQuery, byPage, byDevice] = await Promise.all([
    sc.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate, endDate,
        dimensions: [],
        rowLimit: 1,
      },
    }),
    // ② 検索クエリ上位20
    sc.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate, endDate,
        dimensions: ['query'],
        rowLimit: 20,
        orderBy: [{ fieldName: 'clicks', sortOrder: 'descending' }],
      },
    }),
    // ③ ページ別
    sc.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate, endDate,
        dimensions: ['page'],
        rowLimit: 10,
        orderBy: [{ fieldName: 'clicks', sortOrder: 'descending' }],
      },
    }),
    // ④ デバイス別
    sc.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate, endDate,
        dimensions: ['device'],
        rowLimit: 5,
      },
    }),
  ]);

  const fmt = (rows) =>
    (rows?.data?.rows || []).map((r) => ({
      keys: r.keys,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: parseFloat((r.ctr * 100).toFixed(2)),
      position: parseFloat(r.position.toFixed(1)),
    }));

  const s = summary.data.rows?.[0] || {};
  return {
    period: `${startDate} 〜 ${endDate}`,
    totalClicks: s.clicks || 0,
    totalImpressions: s.impressions || 0,
    avgCTR: s.ctr ? parseFloat((s.ctr * 100).toFixed(2)) : 0,
    avgPosition: s.position ? parseFloat(s.position.toFixed(1)) : 0,
    topQueries: fmt(byQuery).map((r) => ({ query: r.keys[0], ...r, keys: undefined })),
    topPages: fmt(byPage).map((r) => ({ page: r.keys[0], ...r, keys: undefined })),
    devices: fmt(byDevice).map((r) => ({ device: r.keys[0], ...r, keys: undefined })),
  };
}

module.exports = { fetchSearchConsole };

if (require.main === module) {
  fetchSearchConsole().then((data) => {
    console.log(JSON.stringify(data, null, 2));
  }).catch((err) => {
    if (err.message?.includes('403') || err.message?.includes('Permission')) {
      console.error('Search Console 権限エラー: Search Console の設定でサービスアカウント');
      console.error('  analytics-reader@somirai-analytics.iam.gserviceaccount.com');
      console.error('  を「制限付きユーザー」として追加してください');
    } else {
      console.error('Search Console API エラー:', err.message);
    }
    process.exit(1);
  });
}
