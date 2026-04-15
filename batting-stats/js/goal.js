// goal.js - Season goal tracking and progress prediction

const Goal = (() => {
  const KEY = 'batting_stats_goal_v1';

  function load() {
    try {
      const d = localStorage.getItem(KEY);
      return d ? JSON.parse(d) : {};
    } catch (e) { return {}; }
  }

  function save(goal) {
    localStorage.setItem(KEY, JSON.stringify(goal));
  }

  function calcProgress(atBats, goal) {
    const ab = atBats.filter(a => RESULT_TYPES[a.result]?.atBat).length;
    const h  = atBats.filter(a => RESULT_TYPES[a.result]?.hit).length;
    const currentAvg = ab > 0 ? h / ab : 0;

    const out = { ab, h, currentAvg };

    if (goal.targetAvg && goal.targetAvg > 0) {
      const ta = goal.targetAvg;
      out.targetAvg  = ta;
      out.avgGap     = ta - currentAvg;
      out.onTrack    = currentAvg >= ta;
      out.pct        = ab > 0 ? Math.min(100, Math.round((currentAvg / ta) * 100)) : 0;

      // 連続安打が何本必要か: (h+x)/(ab+x) = ta → x = (ta*ab - h)/(1-ta)
      if (!out.onTrack && ta < 1 && ab > 0) {
        const x = (ta * ab - h) / (1 - ta);
        out.hitsNeededStreak = Math.max(0, Math.ceil(x));
      }
    }

    if (goal.targetHits && goal.targetHits > 0) {
      out.targetHits    = goal.targetHits;
      out.hitsProgress  = h;
      out.hitsRemaining = Math.max(0, goal.targetHits - h);
      out.hitsPct       = Math.min(100, Math.round((h / goal.targetHits) * 100));
    }

    return out;
  }

  return { load, save, calcProgress };
})();
