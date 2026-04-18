/**
 * fetch-ga4.js
 * GA4 Data API からトラフィックデータを取得する
 * 使用: node fetch-ga4.js [days=30]
 */

const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const config = require('./config.json');
const path = require('path');

const days = parseInt(process.argv[2] || '30', 10);

async function fetchGA4() {
  const client = new BetaAnalyticsDataClient({
    keyFilename: path.resolve(__dirname, config.ga4.keyFilePath),
  });

  const propertyId = config.ga4.propertyId;

  // ① ツール別ページビュー・ユーザー数
  const [pageRes] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
    ],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 20,
  });

  // ② 流入元別セッション数
  const [sourceRes] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  });

  // ③ 日別セッション推移（直近30日）
  const [trendRes] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
    orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
  });

  // ④ デバイス別
  const [deviceRes] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'deviceCategory' }],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
  });

  return {
    period: `直近${days}日`,
    pages: formatRows(pageRes),
    sources: formatRows(sourceRes),
    trend: formatRows(trendRes),
    devices: formatRows(deviceRes),
  };
}

function formatRows(report) {
  return (report.rows || []).map(row => {
    const dims = {};
    const mets = {};
    (report.dimensionHeaders || []).forEach((h, i) => {
      dims[h.name] = row.dimensionValues[i].value;
    });
    (report.metricHeaders || []).forEach((h, i) => {
      const v = row.metricValues[i].value;
      mets[h.name] = isNaN(v) ? v : parseFloat(parseFloat(v).toFixed(2));
    });
    return { ...dims, ...mets };
  });
}

module.exports = { fetchGA4 };

// 単体実行時
if (require.main === module) {
  fetchGA4().then(data => {
    console.log(JSON.stringify(data, null, 2));
  }).catch(err => {
    console.error('GA4 API エラー:', err.message);
    process.exit(1);
  });
}
