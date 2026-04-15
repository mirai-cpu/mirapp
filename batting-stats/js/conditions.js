// conditions.js - Per-game condition tracking and correlation analysis

const Conditions = (() => {
  const KEY = 'batting_stats_conditions_v1';

  function load() {
    try {
      const d = localStorage.getItem(KEY);
      return d ? JSON.parse(d) : {};
    } catch (e) { return {}; }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function gameKey(date, opponent) {
    return `${date || ''}_${(opponent || '').trim()}`;
  }

  function set(date, opponent, patch) {
    const all = load();
    const key = gameKey(date, opponent);
    all[key] = { ...(all[key] || {}), ...patch };
    save(all);
  }

  function get(date, opponent) {
    return load()[gameKey(date, opponent)] || {};
  }

  function calcCorrelation(atBats) {
    const conditions = load();

    const byGame = {};
    for (const ab of atBats) {
      const key = gameKey(ab.date, ab.opponent);
      if (!byGame[key]) byGame[key] = { abs: [], cond: conditions[key] || {} };
      byGame[key].abs.push(ab);
    }

    const condGroups   = { 1: [], 2: [], 3: [] };
    const weatherGroups = { sunny: [], cloudy: [], rainy: [] };
    const fatigueGroups = { 1: [], 2: [], 3: [] };
    let hasAny = false;

    for (const { abs, cond } of Object.values(byGame)) {
      if (Object.keys(cond).length > 0) hasAny = true;
      if (cond.condition && condGroups[cond.condition])   condGroups[cond.condition].push(...abs);
      if (cond.weather   && weatherGroups[cond.weather])  weatherGroups[cond.weather].push(...abs);
      if (cond.fatigue   && fatigueGroups[cond.fatigue])  fatigueGroups[cond.fatigue].push(...abs);
    }

    function stats(abs) {
      const ab = abs.filter(a => RESULT_TYPES[a.result]?.atBat).length;
      const h  = abs.filter(a => RESULT_TYPES[a.result]?.hit).length;
      return { ab, h, avg: ab > 0 ? h / ab : null };
    }

    const conditionDefs = [
      { key: '3', label: '😊 好調', color: '#16a34a' },
      { key: '2', label: '😐 普通', color: '#2563eb' },
      { key: '1', label: '😔 不調', color: '#dc2626' },
    ];
    const weatherDefs = [
      { key: 'sunny',  label: '☀️ 晴れ',  color: '#f59e0b' },
      { key: 'cloudy', label: '☁️ 曇り', color: '#71717a' },
      { key: 'rainy',  label: '🌧️ 雨',   color: '#2563eb' },
    ];
    const fatigueDefs = [
      { key: '1', label: '💪 元気',  color: '#16a34a' },
      { key: '2', label: '🙂 普通',  color: '#2563eb' },
      { key: '3', label: '😴 疲労',  color: '#dc2626' },
    ];

    function buildRows(defs, groups) {
      return defs
        .map(d => ({ ...d, ...stats(groups[d.key] || []) }))
        .filter(r => r.ab > 0);
    }

    return {
      hasAny,
      condition: buildRows(conditionDefs, condGroups),
      weather:   buildRows(weatherDefs, weatherGroups),
      fatigue:   buildRows(fatigueDefs, fatigueGroups),
    };
  }

  return { load, save, set, get, gameKey, calcCorrelation };
})();
