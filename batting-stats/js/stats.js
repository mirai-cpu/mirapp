// stats.js - Statistics calculation

// Result type definitions
// atBat: counts as official at-bat
// hit: counts as a hit
// tb: total bases
// showDir: whether to show field direction selector
const RESULT_TYPES = {
  single: { atBat: true,  hit: true,  tb: 1, showDir: true,  category: 'hit' },
  double: { atBat: true,  hit: true,  tb: 2, showDir: true,  category: 'hit' },
  triple: { atBat: true,  hit: true,  tb: 3, showDir: true,  category: 'hit' },
  hr:     { atBat: true,  hit: true,  tb: 4, showDir: true,  category: 'hit' },
  bb:     { atBat: false, hit: false, tb: 0, showDir: false, category: 'walk' },
  hbp:    { atBat: false, hit: false, tb: 0, showDir: false, category: 'walk' },
  k:      { atBat: true,  hit: false, tb: 0, showDir: false, category: 'out' },
  go:     { atBat: true,  hit: false, tb: 0, showDir: true,  category: 'out' },
  fo:     { atBat: true,  hit: false, tb: 0, showDir: true,  category: 'out' },
  lo:     { atBat: true,  hit: false, tb: 0, showDir: true,  category: 'out' },
  sb:     { atBat: false, hit: false, tb: 0, showDir: false, category: 'special' },
  sf:     { atBat: false, hit: false, tb: 0, showDir: true,  category: 'special' },
  e:      { atBat: true,  hit: false, tb: 0, showDir: true,  category: 'special' },
  dp:     { atBat: true,  hit: false, tb: 0, showDir: true,  category: 'out' },
};

const Stats = (() => {
  function calculate(atBats) {
    const s = {
      games: 0,
      pa: 0, ab: 0, h: 0, single: 0, double: 0, triple: 0, hr: 0,
      bb: 0, hbp: 0, k: 0, go: 0, fo: 0, lo: 0,
      sb: 0, sf: 0, e: 0, dp: 0, tb: 0, rbi: 0,
      avg: 0, obp: 0, slg: 0, ops: 0,
      vsR: { ab: 0, h: 0, avg: 0 },
      vsL: { ab: 0, h: 0, avg: 0 },
    };

    // ── 試合数（ユニーク日付で計算）──────────────────
    s.games = new Set(atBats.map(ab => ab.date).filter(Boolean)).size;

    for (const ab of atBats) {
      const rt = RESULT_TYPES[ab.result];
      if (!rt) continue;

      s.pa++;
      s.rbi += (ab.rbi || 0);

      if (rt.atBat) s.ab++;
      if (rt.hit) {
        s.h++;
        s[ab.result]++;
        s.tb += rt.tb;
      }

      switch (ab.result) {
        case 'bb':  s.bb++;  break;
        case 'hbp': s.hbp++; break;
        case 'k':   s.k++;   break;
        case 'go':  s.go++;  break;
        case 'fo':  s.fo++;  break;
        case 'lo':  s.lo++;  break;
        case 'sb':  s.sb++;  break;
        case 'sf':  s.sf++;  break;
        case 'e':   s.e++;   break;
        case 'dp':  s.dp++;  break;
      }

      // ── 対左右投手成績 ────────────────────────────
      const vs = ab.pitcherHand === 'L' ? s.vsL : s.vsR;
      if (rt.atBat) vs.ab++;
      if (rt.hit)   vs.h++;
    }

    s.avg = s.ab > 0 ? s.h / s.ab : null;
    const obpDenom = s.ab + s.bb + s.hbp + s.sf;
    s.obp = obpDenom > 0 ? (s.h + s.bb + s.hbp) / obpDenom : null;
    s.slg = s.ab > 0 ? s.tb / s.ab : null;
    s.ops = (s.obp !== null && s.slg !== null) ? s.obp + s.slg : null;

    s.vsR.avg = s.vsR.ab > 0 ? s.vsR.h / s.vsR.ab : null;
    s.vsL.avg = s.vsL.ab > 0 ? s.vsL.h / s.vsL.ab : null;

    return s;
  }

  // val が null（打数0）の場合は '---' を返す
  function fmtAvg(val) {
    if (val === null) return '---';
    if (val === 0)    return '.000';
    return '.' + Math.round(val * 1000).toString().padStart(3, '0');
  }

  function fmtRate(val) {
    if (val === null) return '---';
    return val.toFixed(3).replace('0.', '.');
  }

  function fmtOps(val) {
    if (val === null) return '---';
    return val.toFixed(3);
  }

  // Running AVG trend: returns array of { pa, avg } for each at-bat
  function avgTrend(atBats) {
    let ab = 0, h = 0;
    return atBats.map((x, i) => {
      const rt = RESULT_TYPES[x.result];
      if (rt?.atBat) { ab++; if (rt.hit) h++; }
      return { pa: i + 1, avg: ab > 0 ? h / ab : null, date: x.date };
    });
  }

  // Count by result category
  function resultCounts(atBats) {
    const counts = { hit: 0, out: 0, walk: 0, special: 0 };
    for (const ab of atBats) {
      const rt = RESULT_TYPES[ab.result];
      if (rt) counts[rt.category]++;
    }
    return counts;
  }

  // Count hits by direction zone
  function directionCounts(atBats) {
    const counts = {};
    for (const ab of atBats) {
      if (ab.direction) {
        counts[ab.direction] = (counts[ab.direction] || 0) + 1;
      }
    }
    return counts;
  }

  // Direction counts split by hit vs non-hit (for spray heatmap)
  function directionsByResult(atBats) {
    const hit = {}, out = {};
    for (const ab of atBats) {
      if (!ab.direction) continue;
      const rt = RESULT_TYPES[ab.result];
      if (!rt) continue;
      const target = rt.hit ? hit : out;
      target[ab.direction] = (target[ab.direction] || 0) + 1;
    }
    return { hit, out };
  }

  // Get unique years from data
  function getYears(atBats) {
    const years = new Set(atBats.map(ab => ab.date?.substring(0, 4)).filter(Boolean));
    return [...years].sort().reverse();
  }

  // Filter at-bats by filterType
  // "all"        → all at-bats
  // "last5"      → at-bats from the most recent 5 unique dates
  // "last10"     → at-bats from the most recent 10 unique dates
  // "season:YYYY"→ at-bats whose date starts with YYYY
  function filterAtBats(atBats, filterType) {
    if (filterType === 'all' || !filterType) return atBats;

    if (filterType === 'last5' || filterType === 'last10') {
      const n = filterType === 'last5' ? 5 : 10;
      const uniqueDates = [...new Set(
        atBats.map(ab => ab.date).filter(Boolean)
      )].sort().reverse();
      const lastNDates = new Set(uniqueDates.slice(0, n));
      return atBats.filter(ab => lastNDates.has(ab.date));
    }

    if (filterType.startsWith('season:')) {
      const season = filterType.slice(7);
      return atBats.filter(ab => ab.date?.startsWith(season));
    }

    return atBats;
  }

  // Full stats for one pitcher hand
  function calcStatsByPitcherHand(hand, atBats) {
    return calculate(atBats.filter(ab => ab.pitcherHand === hand));
  }

  // Game-by-game cumulative trend: returns array of { gameNum, date, opponent, avg, ops }
  function gameTrend(atBats) {
    const byDate = {};
    for (const ab of atBats) {
      if (!ab.date) continue;
      (byDate[ab.date] = byDate[ab.date] || []).push(ab);
    }
    const dates = Object.keys(byDate).sort();
    const result = [];
    let cumulative = [];

    for (let i = 0; i < dates.length; i++) {
      cumulative = cumulative.concat(byDate[dates[i]]);
      const s = calculate(cumulative);
      result.push({
        gameNum:  i + 1,
        date:     dates[i],
        opponent: byDate[dates[i]][0]?.opponent || '',
        avg:      s.avg,
        ops:      s.ops,
      });
    }
    return result;
  }

  // ── 打者タイプ診断 ─────────────────────────────────────────────
  // Returns { typeKey, descKey, power, meet, eye } or { remaining } if PA < 20
  function getDiagnosis(s) {
    if (s.pa < 20) return { typeKey: null, descKey: null, remaining: 20 - s.pa };

    const hrRate = s.ab  > 0 ? s.hr / s.ab  : 0;
    const bbRate = s.pa  > 0 ? s.bb / s.pa  : 0;
    const avg    = s.avg ?? 0;
    const slg    = s.slg ?? 0;
    const obp    = s.obp ?? 0;

    let typeKey, descKey;
    if      (avg >= 0.300 && slg < 0.450)              { typeKey = 'diag.type1'; descKey = 'diag.desc1'; }
    else if (avg >= 0.280 && slg >= 0.500)             { typeKey = 'diag.type2'; descKey = 'diag.desc2'; }
    else if (hrRate >= 0.05 && avg < 0.250)            { typeKey = 'diag.type3'; descKey = 'diag.desc3'; }
    else if (obp >= 0.380 && bbRate >= 0.12)           { typeKey = 'diag.type4'; descKey = 'diag.desc4'; }
    else                                               { typeKey = 'diag.type5'; descKey = 'diag.desc5'; }

    return {
      typeKey, descKey, remaining: 0,
      power: Math.min(1, slg    / 0.600),
      meet:  Math.min(1, avg    / 0.350),
      eye:   Math.min(1, bbRate / 0.150),
    };
  }

  // ── テスト用サンプルデータ ────────────────────────────────────
  // localStorage に5件の打席データを投入する
  function seedSampleData() {
    const base = (overrides) => ({
      memo: '', infieldHit: false, fielderPos: null, direction: null, rbi: 0,
      ...overrides,
    });
    const samples = [
      base({ date: '2025-04-01', opponent: 'タイガース', pitcherHand: 'R', result: 'single', rbi: 1,  direction: 'lf'  }),
      base({ date: '2025-04-01', opponent: 'タイガース', pitcherHand: 'R', result: 'go',     fielderPos: 4, direction: 'if2b' }),
      base({ date: '2025-04-05', opponent: 'ジャイアンツ', pitcherHand: 'L', result: 'double', rbi: 2,  direction: 'cf'  }),
      base({ date: '2025-04-05', opponent: 'ジャイアンツ', pitcherHand: 'R', result: 'k',     kType: 'swing' }),
      base({ date: '2025-04-08', opponent: 'カープ',   pitcherHand: 'L', result: 'bb' }),
    ];
    samples.forEach((s, i) => { s.id = Date.now() + i; });
    localStorage.setItem('batting_stats_v1', JSON.stringify(samples));
    return samples;
  }

  // サンプルデータで計算結果を検証（コンソール出力）
  function verify() {
    const data   = seedSampleData();
    const s      = calculate(data);
    const ok     = (label, actual, expected) =>
      console.log(`${actual === expected ? '✅' : '❌'} ${label}: ${actual} (期待値: ${expected})`);

    console.group('Stats.verify() — サンプル5件の検証');
    ok('games', s.games, 3);
    ok('pa',    s.pa,    5);
    ok('ab',    s.ab,    4);
    ok('h',     s.h,     2);
    ok('single',s.single,1);
    ok('double',s.double,1);
    ok('bb',    s.bb,    1);
    ok('k',     s.k,     1);
    ok('go',    s.go,    1);
    ok('tb',    s.tb,    3);   // 1塁打×1 + 2塁打×1 = 3
    ok('rbi',   s.rbi,   3);   // 1 + 2 = 3
    ok('AVG',   fmtAvg(s.avg), '.500');  // 2/4
    ok('OBP',   fmtRate(s.obp), '.600'); // (2+1)/(4+1)
    ok('SLG',   fmtRate(s.slg), '.750'); // 3/4
    ok('OPS',   fmtOps(s.ops),  '1.350');
    ok('vsR.ab', s.vsR.ab, 3);
    ok('vsR.h',  s.vsR.h,  1);
    ok('vsR.AVG', fmtAvg(s.vsR.avg), '.333');
    ok('vsL.ab', s.vsL.ab, 1);
    ok('vsL.h',  s.vsL.h,  1);
    ok('vsL.AVG', fmtAvg(s.vsL.avg), '1.000');
    console.groupEnd();

    return s;
  }

  return { calculate, fmtAvg, fmtRate, fmtOps, avgTrend, gameTrend, resultCounts, directionCounts, directionsByResult, getYears, filterAtBats, calcStatsByPitcherHand, getDiagnosis, seedSampleData, verify };
})();
