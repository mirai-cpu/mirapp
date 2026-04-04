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
  k:      { atBat: true,  hit: false, tb: 0, showDir: true,  category: 'out' },
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
    if (s.pa < 10) return { typeKey: null, descKey: null, remaining: 10 - s.pa };

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

  // 対戦相手の一覧を返す（データが存在するものだけ、五十音順）
  function getOpponents(atBats) {
    return [...new Set(atBats.map(ab => ab.opponent).filter(Boolean))].sort();
  }

  // ── 特殊能力定義（50個）────────────────────────────────────────
  const ABILITIES = [
    // ── パワー系 ─────────────────────────────────
    { id: 'slg500',    name: 'パワーヒッター',   icon: '💪', cat: 'power',
      cond: (s)      => s.pa >= 20 && s.slg !== null && s.slg >= 0.500,
      hint: '長打率.500以上（20打席〜）' },
    { id: 'hr5',       name: 'アーチスト',       icon: '🏟️', cat: 'power',
      cond: (s)      => s.hr >= 5,
      hint: '本塁打5本以上' },
    { id: 'hr10',      name: 'ホームランキング', icon: '👑', cat: 'power',
      cond: (s)      => s.hr >= 10,
      hint: '本塁打10本以上' },
    { id: 'hr20',      name: '本塁打製造機',     icon: '💣', cat: 'power',
      cond: (s)      => s.hr >= 20,
      hint: '本塁打20本以上' },
    { id: 'double5',   name: '二塁打の鬼',       icon: '🔥', cat: 'power',
      cond: (s)      => s.double >= 5,
      hint: '二塁打5本以上' },
    { id: 'triple3',   name: '三塁打ランナー',   icon: '⚡', cat: 'power',
      cond: (s)      => s.triple >= 3,
      hint: '三塁打3本以上' },
    { id: 'ops900',    name: '強打者',           icon: '🗡️', cat: 'power',
      cond: (s)      => s.pa >= 20 && s.ops !== null && s.ops >= 0.900,
      hint: 'OPS .900以上（20打席〜）' },
    { id: 'ops1000',   name: '怪物打者',         icon: '👹', cat: 'power',
      cond: (s)      => s.pa >= 20 && s.ops !== null && s.ops >= 1.000,
      hint: 'OPS 1.000以上（20打席〜）' },
    { id: 'ops1200',   name: '異次元打者',       icon: '🌌', cat: 'power',
      cond: (s)      => s.pa >= 20 && s.ops !== null && s.ops >= 1.200,
      hint: 'OPS 1.200以上（20打席〜）' },

    // ── コンタクト系 ─────────────────────────────
    { id: 'avg300',    name: 'アベレージヒッター', icon: '🎯', cat: 'contact',
      cond: (s)      => s.ab >= 20 && s.avg !== null && s.avg >= 0.300,
      hint: '打率.300以上（20打数〜）' },
    { id: 'avg350',    name: '打率王',            icon: '🥇', cat: 'contact',
      cond: (s)      => s.ab >= 20 && s.avg !== null && s.avg >= 0.350,
      hint: '打率.350以上（20打数〜）' },
    { id: 'avg380',    name: '首位打者',          icon: '🏆', cat: 'contact',
      cond: (s)      => s.ab >= 20 && s.avg !== null && s.avg >= 0.380,
      hint: '打率.380以上（20打数〜）' },
    { id: 'h20',       name: '安打製造機',        icon: '⚾', cat: 'contact',
      cond: (s)      => s.h >= 20,
      hint: '安打20本以上' },
    { id: 'h50',       name: 'ヒットメイカー',    icon: '🌊', cat: 'contact',
      cond: (s)      => s.h >= 50,
      hint: '安打50本以上' },
    { id: 'no_k',      name: 'コンタクトマスター', icon: '🎖️', cat: 'contact',
      cond: (s)      => s.ab >= 20 && s.k / s.ab <= 0.10,
      hint: '三振率10%以下（20打数〜）' },
    { id: 'zero_k',    name: 'ノー三振',          icon: '✨', cat: 'contact',
      cond: (s)      => s.pa >= 20 && s.k === 0,
      hint: '三振0（20打席〜）' },
    { id: 'infield3',  name: '内野安打の達人',    icon: '🏃', cat: 'contact',
      cond: (_s, abs) => abs.filter(a => a.infieldHit).length >= 3,
      hint: '内野安打3本以上' },

    // ── 選球眼系 ─────────────────────────────────
    { id: 'bb_rate',   name: '選球眼',            icon: '👁️', cat: 'eye',
      cond: (s)      => s.pa >= 20 && s.bb / s.pa >= 0.15,
      hint: '四球率15%以上（20打席〜）' },
    { id: 'bb10',      name: 'フォアボール王',    icon: '🔭', cat: 'eye',
      cond: (s)      => s.bb >= 10,
      hint: '四球10個以上' },
    { id: 'obp400',    name: '出塁の鬼',          icon: '🚶', cat: 'eye',
      cond: (s)      => s.pa >= 20 && s.obp !== null && s.obp >= 0.400,
      hint: '出塁率.400以上（20打席〜）' },
    { id: 'obp450',    name: '塁上の支配者',      icon: '🏴', cat: 'eye',
      cond: (s)      => s.pa >= 20 && s.obp !== null && s.obp >= 0.450,
      hint: '出塁率.450以上（20打席〜）' },
    { id: 'hbp3',      name: '死球魂',            icon: '🩸', cat: 'eye',
      cond: (s)      => s.hbp >= 3,
      hint: '死球3個以上' },

    // ── 勝負強さ系 ───────────────────────────────
    { id: 'rbi10',     name: 'クラッチヒッター',  icon: '🎯', cat: 'clutch',
      cond: (s)      => s.rbi >= 10,
      hint: '打点10以上' },
    { id: 'rbi20',     name: '打点マシン',         icon: '💰', cat: 'clutch',
      cond: (s)      => s.rbi >= 20,
      hint: '打点20以上' },
    { id: 'rbi30',     name: '打点王',             icon: '🥊', cat: 'clutch',
      cond: (s)      => s.rbi >= 30,
      hint: '打点30以上' },
    { id: 'triplecrown', name: '三冠候補',         icon: '🌟', cat: 'clutch',
      cond: (s)      => s.ab >= 20 && s.avg >= 0.300 && s.hr >= 3 && s.rbi >= 10,
      hint: '打率.300↑ & HR3本↑ & 打点10↑' },
    { id: 'slash',     name: '打撃の申し子',       icon: '⭐', cat: 'clutch',
      cond: (s)      => s.pa >= 30 && s.avg >= 0.300 && s.obp >= 0.400 && s.slg >= 0.500,
      hint: '打率.300 / 出塁率.400 / 長打率.500（30打席〜）' },

    // ── 対投手系 ─────────────────────────────────
    { id: 'vsR320',    name: '右投手キラー',      icon: '🗡️', cat: 'vs',
      cond: (s)      => s.vsR.ab >= 10 && s.vsR.avg !== null && s.vsR.avg >= 0.320,
      hint: '対右打率.320以上（10打数〜）' },
    { id: 'vsL320',    name: '左腕ハンター',      icon: '⚔️', cat: 'vs',
      cond: (s)      => s.vsL.ab >= 10 && s.vsL.avg !== null && s.vsL.avg >= 0.320,
      hint: '対左打率.320以上（10打数〜）' },
    { id: 'vsLR',      name: '左右不問',          icon: '🔀', cat: 'vs',
      cond: (s)      => s.vsR.ab >= 10 && s.vsL.ab >= 10 &&
                        s.vsR.avg >= 0.280 && s.vsL.avg >= 0.280,
      hint: '対右.280↑ & 対左.280↑（各10打数〜）' },
    { id: 'vsR350',    name: '右腕の天敵',        icon: '🎭', cat: 'vs',
      cond: (s)      => s.vsR.ab >= 10 && s.vsR.avg !== null && s.vsR.avg >= 0.350,
      hint: '対右打率.350以上（10打数〜）' },
    { id: 'vsL350',    name: '左腕の悪夢',        icon: '👻', cat: 'vs',
      cond: (s)      => s.vsL.ab >= 10 && s.vsL.avg !== null && s.vsL.avg >= 0.350,
      hint: '対左打率.350以上（10打数〜）' },

    // ── 打球方向系 ───────────────────────────────
    { id: 'zones3',    name: '広角打法',          icon: '📐', cat: 'direction',
      cond: (_s, abs) => new Set(
        abs.filter(a => RESULT_TYPES[a.result]?.hit && a.direction).map(a => a.direction)
      ).size >= 3,
      hint: '3方向以上にヒット' },
    { id: 'zones5',    name: 'スプレーヒッター',  icon: '🌈', cat: 'direction',
      cond: (_s, abs) => new Set(
        abs.filter(a => RESULT_TYPES[a.result]?.hit && a.direction).map(a => a.direction)
      ).size >= 5,
      hint: '5方向以上にヒット' },
    { id: 'lf5',       name: 'レフト狙い',        icon: '↙️', cat: 'direction',
      cond: (_s, abs) => abs.filter(a => RESULT_TYPES[a.result]?.hit &&
        (a.direction === 'lf' || a.direction === 'lc')).length >= 5,
      hint: 'レフト方向への安打5本以上' },
    { id: 'rf5',       name: 'ライト狙い',        icon: '↘️', cat: 'direction',
      cond: (_s, abs) => abs.filter(a => RESULT_TYPES[a.result]?.hit &&
        (a.direction === 'rf' || a.direction === 'rc')).length >= 5,
      hint: 'ライト方向への安打5本以上' },
    { id: 'cf3',       name: 'センター返し',       icon: '⬆️', cat: 'direction',
      cond: (_s, abs) => abs.filter(a => RESULT_TYPES[a.result]?.hit &&
        a.direction === 'cf').length >= 3,
      hint: 'センターへの安打3本以上' },

    // ── キャリア系 ───────────────────────────────
    { id: 'debut',     name: '初陣',              icon: '🌱', cat: 'career',
      cond: (s)      => s.pa >= 1,
      hint: '1打席以上記録' },
    { id: 'games10',   name: '試合慣れ',           icon: '📅', cat: 'career',
      cond: (s)      => s.games >= 10,
      hint: '10試合以上' },
    { id: 'games20',   name: 'ベテラン打者',       icon: '🎓', cat: 'career',
      cond: (s)      => s.games >= 20,
      hint: '20試合以上' },
    { id: 'games30',   name: '百戦錬磨',           icon: '🦾', cat: 'career',
      cond: (s)      => s.games >= 30,
      hint: '30試合以上' },
    { id: 'pa100',     name: '打席数王',           icon: '💯', cat: 'career',
      cond: (s)      => s.pa >= 100,
      hint: '100打席以上' },

    // ── 特殊系 ───────────────────────────────────
    { id: 'sb5',       name: '犠打職人',           icon: '🫴', cat: 'special',
      cond: (s)      => s.sb >= 5,
      hint: '犠打5個以上' },
    { id: 'sf3',       name: '犠飛の名手',         icon: '🕊️', cat: 'special',
      cond: (s)      => s.sf >= 3,
      hint: '犠飛3個以上' },
    { id: 'e5',        name: 'エラー誘発',         icon: '😈', cat: 'special',
      cond: (s)      => s.e >= 5,
      hint: '失策5個以上（相手エラーで出塁）' },
    { id: 'dp5',       name: 'ゲッツー製造機',     icon: '😰', cat: 'special',
      cond: (s)      => s.dp >= 5,
      hint: '併殺打5個以上（要克服!）' },
    { id: 'k_swing5',  name: '空振り王',           icon: '🌪️', cat: 'special',
      cond: (_s, abs) => abs.filter(a => a.result === 'k' && a.kType === 'swing').length >= 5,
      hint: '空振り三振5個以上（要克服!）' },
    { id: 'perfect',   name: '完全体',             icon: '💎', cat: 'special',
      cond: (s)      => s.pa >= 50 && s.avg >= 0.300 && s.obp >= 0.400 && s.ops >= 0.900,
      hint: 'AVG.300↑ / OBP.400↑ / OPS.900↑（50打席〜）' },
    { id: 'legend',    name: 'レジェンド',         icon: '🌟', cat: 'special',
      cond: (s)      => s.pa >= 100 && s.ops !== null && s.ops >= 1.000,
      hint: 'PA100↑ & OPS 1.000↑' },
    { id: 'cheater',   name: '規格外',             icon: '🚀', cat: 'special',
      cond: (s)      => s.ab >= 30 && s.avg !== null && s.avg >= 0.400,
      hint: '打率.400以上（30打数〜）' },
  ];

  const ABILITY_CATEGORIES = {
    power:     { label: 'パワー',   color: '#ef4444' },
    contact:   { label: 'コンタクト', color: '#10b981' },
    eye:       { label: '選球眼',   color: '#3b82f6' },
    clutch:    { label: '勝負強さ', color: '#f97316' },
    vs:        { label: '対投手',   color: '#8b5cf6' },
    direction: { label: '打球方向', color: '#eab308' },
    career:    { label: 'キャリア', color: '#06b6d4' },
    special:   { label: '特殊',     color: '#f59e0b' },
  };

  function getAbilityResults(atBats) {
    const s = calculate(atBats);
    return ABILITIES.map(ab => ({
      ...ab,
      unlocked: (() => { try { return !!ab.cond(s, atBats); } catch { return false; } })(),
    }));
  }

  // 対戦相手の一覧を返す（データが存在するものだけ、五十音順）
  function getOpponents(atBats) {
    return [...new Set(atBats.map(ab => ab.opponent).filter(Boolean))].sort();
  }

  return { calculate, fmtAvg, fmtRate, fmtOps, avgTrend, gameTrend, resultCounts, directionCounts, directionsByResult, getYears, filterAtBats, calcStatsByPitcherHand, getDiagnosis, getAbilityResults, ABILITY_CATEGORIES, getOpponents, seedSampleData, verify };
})();
