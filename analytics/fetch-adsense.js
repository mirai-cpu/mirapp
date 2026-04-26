/**
 * fetch-adsense.js
 * AdSense の収益データを取得する
 *
 * ■ API モード（推奨）
 *   AdSense Management API v2 は OAuth2 が必要。
 *   初回セットアップ: node fetch-adsense.js --setup
 *   ※ config.json に "adsense": { "clientId": "...", "clientSecret": "...", "accountId": "pub-xxx" } を追加
 *
 * ■ 手動入力モード（APIなしでもOK）
 *   adsense-data.json に最新データを手入力するだけで分析に反映される
 *   アドセンス管理画面 → レポート → 手動で下記ファイルに貼り付け
 */

const fs = require('fs');
const path = require('path');

const MANUAL_DATA_PATH = path.join(__dirname, 'adsense-data.json');

function readManualData() {
  if (!fs.existsSync(MANUAL_DATA_PATH)) {
    // デフォルトテンプレートを作成
    const template = {
      _note: "アドセンス管理画面のデータを手動で更新してください（毎月1回程度）",
      updatedAt: new Date().toISOString().slice(0, 10),
      currentMonth: {
        revenue: 0,
        pageRPM: 0,
        impressions: 0,
        clicks: 0,
        ctr: 0,
      },
      lastMonth: {
        revenue: 0,
        pageRPM: 0,
        impressions: 0,
        clicks: 0,
        ctr: 0,
      },
      last30days: {
        revenue: 0,
        pageRPM: 0,
        impressions: 0,
        clicks: 0,
      },
    };
    fs.writeFileSync(MANUAL_DATA_PATH, JSON.stringify(template, null, 2), 'utf8');
    console.error(`adsense-data.json を作成しました。アドセンス管理画面のデータを手動で入力してください: ${MANUAL_DATA_PATH}`);
  }
  return JSON.parse(fs.readFileSync(MANUAL_DATA_PATH, 'utf8'));
}

async function fetchAdSense() {
  const data = readManualData();
  return {
    source: 'manual',
    updatedAt: data.updatedAt,
    currentMonth: data.currentMonth,
    lastMonth: data.lastMonth,
    last30days: data.last30days,
    monthOverMonth: data.lastMonth?.revenue > 0
      ? parseFloat(((data.currentMonth.revenue / data.lastMonth.revenue - 1) * 100).toFixed(1))
      : null,
  };
}

module.exports = { fetchAdSense };

if (require.main === module) {
  fetchAdSense().then((data) => {
    console.log(JSON.stringify(data, null, 2));
  }).catch((err) => {
    console.error('AdSense エラー:', err.message);
    process.exit(1);
  });
}
