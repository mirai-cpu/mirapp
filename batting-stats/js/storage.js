// storage.js - localStorage operations

const Storage = (() => {
  const DATA_KEY = 'batting_stats_v1';
  const LANG_KEY = 'batting_stats_lang';

  function load() {
    try {
      const data = localStorage.getItem(DATA_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function save(atBats) {
    localStorage.setItem(DATA_KEY, JSON.stringify(atBats));
  }

  function add(atBat) {
    const atBats = load();
    atBat.id = Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    atBats.push(atBat);
    save(atBats);
    return atBat;
  }

  function remove(id) {
    const atBats = load().filter(ab => String(ab.id) !== String(id));
    save(atBats);
  }

  function update(id, data) {
    const atBats = load().map(ab => String(ab.id) === String(id) ? { ...data, id } : ab);
    save(atBats);
  }

  function getLang() {
    return localStorage.getItem(LANG_KEY) || 'ja';
  }

  function setLang(lang) {
    localStorage.setItem(LANG_KEY, lang);
  }

  const OPPONENT_KEY = 'batting_stats_opponent';
  function getLastOpponent() { return localStorage.getItem(OPPONENT_KEY) || ''; }
  function setLastOpponent(opp) { if (opp) localStorage.setItem(OPPONENT_KEY, opp); }

  function exportToCSV(atBats, i18nFn) {
    const t = i18nFn || (k => k);
    const headers = [
      t('csv.date'), t('csv.season'), t('csv.opponent'),
      t('csv.paNum'), t('csv.result'), t('csv.direction'),
      t('csv.pitcherHand'), t('csv.memo'),
    ];

    // Build per-date PA counter
    const paCounter = {};
    for (const ab of atBats) {
      const key = ab.date || '----';
      paCounter[key] = (paCounter[key] || 0) + 1;
    }
    const paIndex = {};
    const paCur   = {};
    for (const ab of atBats) {
      const key = ab.date || '----';
      paCur[key] = (paCur[key] || 0) + 1;
      paIndex[ab.id] = paCur[key];
    }

    const escape = v => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = [headers, ...atBats.map(ab => [
      ab.date        || '',
      (ab.date || '').substring(0, 4),
      ab.opponent    || '',
      paIndex[ab.id] || '',
      ab.result      || '',
      ab.direction   || '',
      ab.pitcherHand || '',
      ab.memo        || '',
    ])];

    const csv  = rows.map(r => r.map(escape).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.download = `batting-stats-${new Date().toISOString().slice(0, 10)}.csv`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }

  return { load, save, add, remove, update, getLang, setLang, getLastOpponent, setLastOpponent, exportToCSV };
})();
