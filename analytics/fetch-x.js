/**
 * fetch-x.js
 * X (Twitter) API v2 から自アカウントのデータを取得する
 * 使用: node fetch-x.js
 */

const https = require('https');
const config = require('./config.json');

const BEARER = config.x.bearerToken;
const BASE   = 'api.twitter.com';

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE,
      path,
      method: 'GET',
      headers: { Authorization: `Bearer ${BEARER}` },
    };
    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch(e) { reject(new Error('JSONパースエラー: ' + body)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchX() {
  if (!BEARER || BEARER === 'YOUR_X_BEARER_TOKEN') {
    return { error: 'X Bearer Token が未設定です。config.json を更新してください。' };
  }

  // 自分のユーザー情報取得
  const meRes = await apiGet('/2/users/me?user.fields=public_metrics,description,created_at');
  if (meRes.errors || !meRes.data) {
    return { error: 'ユーザー情報取得失敗', detail: meRes };
  }

  const userId = meRes.data.id;
  const metrics = meRes.data.public_metrics;

  // 直近20ツイートとエンゲージメント
  const tweetsRes = await apiGet(
    `/2/users/${userId}/tweets?max_results=20&tweet.fields=public_metrics,created_at,text`
  );

  const tweets = (tweetsRes.data || []).map(t => ({
    id: t.id,
    text: t.text.slice(0, 60) + (t.text.length > 60 ? '…' : ''),
    created_at: t.created_at,
    impressions:  t.public_metrics?.impression_count   ?? 0,
    likes:        t.public_metrics?.like_count         ?? 0,
    retweets:     t.public_metrics?.retweet_count      ?? 0,
    replies:      t.public_metrics?.reply_count        ?? 0,
    engagements:  (t.public_metrics?.like_count ?? 0)
                + (t.public_metrics?.retweet_count ?? 0)
                + (t.public_metrics?.reply_count ?? 0),
  }));

  // エンゲージメント率の高い順にソート
  const topTweets = [...tweets].sort((a, b) => b.engagements - a.engagements).slice(0, 5);

  return {
    account: {
      name:       meRes.data.name,
      username:   meRes.data.username,
      followers:  metrics.followers_count,
      following:  metrics.following_count,
      tweetCount: metrics.tweet_count,
    },
    recentTweets: tweets,
    topTweets,
    avgImpressions: tweets.length
      ? Math.round(tweets.reduce((s, t) => s + t.impressions, 0) / tweets.length)
      : 0,
    avgEngagements: tweets.length
      ? parseFloat((tweets.reduce((s, t) => s + t.engagements, 0) / tweets.length).toFixed(1))
      : 0,
  };
}

module.exports = { fetchX };

// 単体実行時
if (require.main === module) {
  fetchX().then(data => {
    console.log(JSON.stringify(data, null, 2));
  }).catch(err => {
    console.error('X API エラー:', err.message);
    process.exit(1);
  });
}
