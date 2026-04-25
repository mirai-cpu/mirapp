/**
 * fetch-x.js — X (Twitter) API v2 アカウント分析スクリプト
 * 取得内容: プロフィール・フォロワー数・直近ツイートのエンゲージメント
 */

const https = require("https");
const crypto = require("crypto");
const OAuth = require("oauth-1.0a");
const config = require("./config.json");

const { apiKey, apiKeySecret, accessToken, accessTokenSecret } = config.x;

const oauth = OAuth({
  consumer: { key: apiKey, secret: apiKeySecret },
  signature_method: "HMAC-SHA1",
  hash_function(baseString, key) {
    return crypto.createHmac("sha1", key).update(baseString).digest("base64");
  },
});

function request(url) {
  return new Promise((resolve, reject) => {
    const reqData = { url, method: "GET" };
    const token = { key: accessToken, secret: accessTokenSecret };
    const authHeader = oauth.toHeader(oauth.authorize(reqData, token));

    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "GET",
      headers: {
        ...authHeader,
        "User-Agent": "somirai-analytics/1.0",
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.errors || parsed.error || parsed.title) {
            reject(new Error(parsed.title || JSON.stringify(parsed.errors || parsed.error)));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error("JSON parse error: " + body.slice(0, 200)));
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  // 1. 自分のプロフィール取得
  const meUrl =
    "https://api.twitter.com/2/users/me" +
    "?user.fields=public_metrics,description,created_at,username";
  const me = await request(meUrl);
  const userId = me.data.id;
  const metrics = me.data.public_metrics;

  // 2. ツイート取得（CreditsDepleted の場合は graceful fallback）
  let tweetList = [];
  let tweetError = null;
  try {
    const tweetsUrl =
      `https://api.twitter.com/2/users/${userId}/tweets` +
      "?max_results=10" +
      "&tweet.fields=public_metrics,created_at,text";
    const tweets = await request(tweetsUrl);
    tweetList = tweets.data || [];
  } catch (e) {
    tweetError = e.message.includes("CreditsDepleted")
      ? "X API 無料枠ではツイート一覧の取得不可（Basic プラン $100/月 が必要）"
      : e.message;
  }

  // 3. エンゲージメント集計
  const totalImpressions = tweetList.reduce(
    (s, t) => s + (t.public_metrics?.impression_count || 0), 0
  );
  const totalLikes = tweetList.reduce(
    (s, t) => s + (t.public_metrics?.like_count || 0), 0
  );
  const totalRetweets = tweetList.reduce(
    (s, t) => s + (t.public_metrics?.retweet_count || 0), 0
  );
  const totalReplies = tweetList.reduce(
    (s, t) => s + (t.public_metrics?.reply_count || 0), 0
  );
  const avgEngRate =
    tweetList.length > 0
      ? (
          (((totalLikes + totalRetweets + totalReplies) / tweetList.length) /
            Math.max(metrics.followers_count, 1)) *
          100
        ).toFixed(2)
      : null;

  const result = {
    profile: {
      username: me.data.username,
      name: me.data.name,
      description: me.data.description,
      created_at: me.data.created_at,
    },
    followers: metrics.followers_count,
    following: metrics.following_count,
    tweet_count: metrics.tweet_count,
    listed_count: metrics.listed_count,
    ...(tweetError
      ? { tweetDataNote: tweetError }
      : {
          recentTweets: {
            count: tweetList.length,
            totalImpressions,
            totalLikes,
            totalRetweets,
            totalReplies,
            avgEngagementRate: avgEngRate + "%",
          },
          topTweets: [...tweetList]
            .sort(
              (a, b) =>
                (b.public_metrics?.like_count || 0) -
                (a.public_metrics?.like_count || 0)
            )
            .slice(0, 3)
            .map((t) => ({
              text: t.text.slice(0, 80) + (t.text.length > 80 ? "…" : ""),
              created_at: t.created_at,
              likes: t.public_metrics?.like_count,
              retweets: t.public_metrics?.retweet_count,
              replies: t.public_metrics?.reply_count,
              impressions: t.public_metrics?.impression_count,
            })),
        }),
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
