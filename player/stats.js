/**
 * Somirai Lab MY PLAYER — 共有ステータス計算ロジック
 * /player/ と各ツール(SWING!等)から読み込んで使う。
 * 各ツールのXP計算式を複製しない — ここでは生データからの簡易スコア(0-100)のみを算出する。
 */
(function (global) {
  function safeReadJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function computeStats() {
    var stats = [];

    // TEMPER 体力
    var habitData = safeReadJSON('habit-quest:data');
    var temperScore = 0, temperDetail = '未プレイ';
    if (habitData && habitData.completions) {
      var totalCompletions = 0;
      for (var d in habitData.completions) {
        if (Array.isArray(habitData.completions[d])) totalCompletions += habitData.completions[d].length;
      }
      if (totalCompletions > 0) {
        temperScore = clamp(Math.round(totalCompletions / 150 * 100), 1, 100);
        temperDetail = '習慣' + ((habitData.habits || []).length) + '個・累計' + totalCompletions + '回達成';
      }
    }
    stats.push({ key: 'temper', label: '体力', tool: 'TEMPER', url: 'https://somirai.jp/habit/', score: temperScore, detail: temperDetail, color: '#f97316' });

    // MARGINALIA 集中力
    var writeData = safeReadJSON('write-quest:data');
    var mgScore = 0, mgDetail = '未プレイ';
    if (writeData && Array.isArray(writeData.memos) && writeData.memos.length > 0) {
      mgScore = clamp(Math.round(writeData.memos.length / 60 * 100), 1, 100);
      mgDetail = 'メモ' + writeData.memos.length + '件';
    }
    stats.push({ key: 'marginalia', label: '集中力', tool: 'MARGINALIA', url: 'https://somirai.jp/write/', score: mgScore, detail: mgDetail, color: '#d4a853' });

    // KURA 精神力
    var savingsData = safeReadJSON('saving-quest:data');
    var kuraScore = 0, kuraDetail = '未プレイ';
    if (savingsData && Array.isArray(savingsData.expenses) && savingsData.expenses.length > 0) {
      kuraScore = clamp(Math.round(savingsData.expenses.length / 60 * 100), 1, 100);
      kuraDetail = '記録' + savingsData.expenses.length + '件';
    }
    stats.push({ key: 'kura', label: '精神力', tool: 'KURA', url: 'https://somirai.jp/savings/', score: kuraScore, detail: kuraDetail, color: '#10b981' });

    // LUMBER 打撃
    var battingData = safeReadJSON('batting_stats_v1');
    var lumberScore = 0, lumberDetail = '未プレイ';
    if (Array.isArray(battingData) && battingData.length > 0) {
      lumberScore = clamp(Math.round(battingData.length / 100 * 100), 1, 100);
      lumberDetail = '打席' + battingData.length + '回';
    }
    stats.push({ key: 'lumber', label: '打撃', tool: 'LUMBER', url: 'https://somirai.jp/batting-stats/', score: lumberScore, detail: lumberDetail, color: '#00e676' });

    // TACTICIAN 戦術
    var players = safeReadJSON('sm_players');
    var lineups = safeReadJSON('sm_lineups');
    var tacticianScore = 0, tacticianDetail = '未プレイ';
    if (Array.isArray(players) && players.length > 0) {
      var lineupCount = Array.isArray(lineups) ? lineups.length : 0;
      tacticianScore = clamp(players.length * 5 + lineupCount * 15, 1, 100);
      tacticianDetail = '選手' + players.length + '人・オーダー' + lineupCount + 'パターン';
    }
    stats.push({ key: 'tactician', label: '戦術', tool: 'TACTICIAN', url: 'https://somirai.jp/order-maker/', score: tacticianScore, detail: tacticianDetail, color: '#60a5fa' });

    return stats;
  }

  function getScore(key) {
    var stats = computeStats();
    for (var i = 0; i < stats.length; i++) {
      if (stats[i].key === key) return stats[i].score;
    }
    return 0;
  }

  global.SomiraiPlayer = { computeStats: computeStats, getScore: getScore };
})(window);
