// weather.js — JMA（予報）+ Open-Meteo Archive（過去）天気モジュール
// 気象庁 API: 政府オープンデータ CC BY 4.0（商用利用OK）
// Open-Meteo Archive: 非商用利用無料（過去日付のみ）

const WeatherModule = (() => {
  const CACHE_KEY = 'somirai-weather-cache-v1';
  const PREF_KEY  = 'somirai-weather-pref';

  const PREF_OFFICES = {
    '北海道':'016000','青森':'020000','岩手':'030000','宮城':'040000','秋田':'050000',
    '山形':'060000','福島':'070000','茨城':'080000','栃木':'090000','群馬':'100000',
    '埼玉':'110000','千葉':'120000','東京':'130000','神奈川':'140000','新潟':'150000',
    '富山':'160000','石川':'170000','福井':'180000','山梨':'190000','長野':'200000',
    '岐阜':'210000','静岡':'220000','愛知':'230000','三重':'240000','滋賀':'250000',
    '京都':'260000','大阪':'270000','兵庫':'280000','奈良':'290000','和歌山':'300000',
    '鳥取':'310000','島根':'320000','岡山':'330000','広島':'340000','山口':'350000',
    '徳島':'360000','香川':'370000','愛媛':'380000','高知':'390000','福岡':'400000',
    '佐賀':'410000','長崎':'420000','熊本':'430000','大分':'440000','宮崎':'450000',
    '鹿児島':'460100','沖縄':'471000',
  };

  const PREF_COORDS = {
    '北海道':{lat:43.06,lon:141.35},'青森':{lat:40.82,lon:140.74},'岩手':{lat:39.70,lon:141.15},
    '宮城':{lat:38.27,lon:140.87},'秋田':{lat:39.72,lon:140.10},'山形':{lat:38.24,lon:140.36},
    '福島':{lat:37.75,lon:140.47},'茨城':{lat:36.34,lon:140.45},'栃木':{lat:36.57,lon:139.88},
    '群馬':{lat:36.39,lon:139.06},'埼玉':{lat:35.86,lon:139.65},'千葉':{lat:35.61,lon:140.12},
    '東京':{lat:35.69,lon:139.69},'神奈川':{lat:35.45,lon:139.64},'新潟':{lat:37.91,lon:139.02},
    '富山':{lat:36.70,lon:137.21},'石川':{lat:36.59,lon:136.63},'福井':{lat:36.07,lon:136.22},
    '山梨':{lat:35.66,lon:138.57},'長野':{lat:36.65,lon:138.19},'岐阜':{lat:35.39,lon:136.72},
    '静岡':{lat:34.98,lon:138.38},'愛知':{lat:35.18,lon:136.91},'三重':{lat:34.73,lon:136.51},
    '滋賀':{lat:35.00,lon:135.87},'京都':{lat:35.02,lon:135.76},'大阪':{lat:34.69,lon:135.50},
    '兵庫':{lat:34.69,lon:135.18},'奈良':{lat:34.69,lon:135.83},'和歌山':{lat:34.23,lon:135.17},
    '鳥取':{lat:35.50,lon:134.24},'島根':{lat:35.47,lon:133.05},'岡山':{lat:34.66,lon:133.94},
    '広島':{lat:34.40,lon:132.46},'山口':{lat:34.19,lon:131.47},'徳島':{lat:34.07,lon:134.56},
    '香川':{lat:34.34,lon:134.05},'愛媛':{lat:33.84,lon:132.77},'高知':{lat:33.56,lon:133.53},
    '福岡':{lat:33.61,lon:130.42},'佐賀':{lat:33.25,lon:130.30},'長崎':{lat:32.74,lon:129.87},
    '熊本':{lat:32.79,lon:130.74},'大分':{lat:33.24,lon:131.61},'宮崎':{lat:31.91,lon:131.42},
    '鹿児島':{lat:31.56,lon:130.56},'沖縄':{lat:26.21,lon:127.68},
  };

  const DAY_JA = ['日','月','火','水','木','金','土'];

  function jmaEmoji(code) {
    const c = parseInt(code, 10);
    if (c >= 400) return '❄️';
    if (c >= 300) return '🌧️';
    if (c >= 200) return '☁️';
    if (c >= 110) return '⛅';
    return '☀️';
  }

  function wmoEmoji(c) {
    if (c === 0) return '☀️';
    if (c <= 2)  return '⛅';
    if (c <= 3)  return '☁️';
    if (c <= 49) return '🌫️';
    if (c <= 67) return '🌧️';
    if (c <= 77) return '❄️';
    if (c <= 82) return '🌧️';
    if (c <= 86) return '❄️';
    return '⛈️';
  }

  function wmoDesc(c) {
    const m = {0:'快晴',1:'晴れ',2:'晴れ時々くもり',3:'くもり',45:'霧',48:'霧',
               51:'小雨',53:'雨',55:'大雨',61:'雨',63:'雨',65:'大雨',
               71:'小雪',73:'雪',75:'大雪',77:'みぞれ',80:'にわか雨',81:'雨',82:'大雨',
               85:'にわか雪',86:'大雪',95:'雷雨'};
    return m[c] || '—';
  }

  // localStorage cache
  function getCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
  }
  function cached(pref, date) { return getCache()[`${pref}_${date}`] || null; }
  function storeCache(pref, date, data) {
    const c = getCache();
    c[`${pref}_${date}`] = { ...data, _ts: Date.now() };
    const keys = Object.keys(c);
    if (keys.length > 120) {
      keys.sort((a,b) => (c[a]._ts||0) - (c[b]._ts||0)).slice(0, keys.length - 100).forEach(k => delete c[k]);
    }
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {}
  }

  function getSavedPref() { return localStorage.getItem(PREF_KEY) || '東京'; }
  function savePref(pref) { localStorage.setItem(PREF_KEY, pref); }

  function isPast(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const t = new Date(); t.setHours(0,0,0,0);
    return d < t;
  }

  function dateLabel(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getMonth()+1}/${d.getDate()}(${DAY_JA[d.getDay()]})`;
  }

  // JMA 予報（翌7日以内）
  async function fromJMA(pref, dateStr) {
    const officeCode = PREF_OFFICES[pref];
    if (!officeCode) return null;
    const res = await fetch(`https://www.jma.go.jp/bosai/forecast/data/forecast/${officeCode}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    const ts = data[0].timeSeries;
    const wSeries = ts[0];
    const idx = wSeries.timeDefines.findIndex(d => d.startsWith(dateStr));
    if (idx < 0) return null;
    const wArea = wSeries.areas[0];
    // pop
    let pop = '—';
    if (ts[1]) {
      const pArea = ts[1].areas[0];
      const matches = ts[1].timeDefines
        .map((td, i) => td.startsWith(dateStr) && pArea.pops[i] !== '' ? pArea.pops[i] : null)
        .filter(v => v !== null);
      if (matches.length) pop = matches[Math.min(2, matches.length - 1)] + '%';
    }
    // temp
    let tMin = '—', tMax = '—';
    if (ts[2]) {
      const tArea = ts[2].areas[0];
      const mn = tArea.tempsMin?.[idx]; const mx = tArea.tempsMax?.[idx] || tArea.temps?.[idx];
      if (mn && mn !== '') tMin = mn + '°';
      if (mx && mx !== '') tMax = mx + '°';
    }
    return {
      emoji: jmaEmoji(wArea.weatherCodes?.[idx] || '100'),
      desc: (wArea.weathers?.[idx] || '').replace(/\s+/g,' ').trim() || '—',
      pop, tempMin: tMin, tempMax: tMax, source: 'JMA',
    };
  }

  // Open-Meteo Archive（過去日付）
  async function fromArchive(pref, dateStr) {
    const coords = PREF_COORDS[pref];
    if (!coords) return null;
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${coords.lat}&longitude=${coords.lon}&start_date=${dateStr}&end_date=${dateStr}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Asia%2FTokyo`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.daily?.time?.length) return null;
    const code = data.daily.weathercode[0];
    const precip = parseFloat(data.daily.precipitation_sum[0]) || 0;
    const popEst = precip > 15 ? '80%' : precip > 8 ? '60%' : precip > 3 ? '40%' : precip > 0.5 ? '20%' : '0%';
    return {
      emoji: wmoEmoji(code),
      desc: wmoDesc(code),
      pop: popEst,
      tempMin: Math.round(data.daily.temperature_2m_min[0]) + '°',
      tempMax: Math.round(data.daily.temperature_2m_max[0]) + '°',
      source: 'Archive',
    };
  }

  // 3日予報（パネル表示用）
  async function forecast3Day(pref) {
    const officeCode = PREF_OFFICES[pref];
    if (!officeCode) return [];
    const res = await fetch(`https://www.jma.go.jp/bosai/forecast/data/forecast/${officeCode}.json`);
    if (!res.ok) return [];
    const data = await res.json();
    const ts = data[0].timeSeries;
    const wSeries = ts[0];
    const rawDates = wSeries.timeDefines.slice(0, 3);
    const wArea = wSeries.areas[0];
    const popsMap = {};
    if (ts[1]) {
      const pArea = ts[1].areas[0];
      ts[1].timeDefines.forEach((td, i) => {
        const ds = td.slice(0, 10);
        if (!popsMap[ds] && pArea.pops[i] !== '') popsMap[ds] = pArea.pops[i] + '%';
      });
    }
    const tempsMap = {};
    if (ts[2]) {
      const tArea = ts[2].areas[0];
      rawDates.forEach((d, i) => {
        const ds = d.slice(0, 10);
        const mn = tArea.tempsMin?.[i]; const mx = tArea.tempsMax?.[i] || tArea.temps?.[i];
        tempsMap[ds] = {
          min: (mn && mn !== '') ? mn + '°' : '—',
          max: (mx && mx !== '') ? mx + '°' : '—',
        };
      });
    }
    return rawDates.map((d, i) => {
      const ds = d.slice(0, 10);
      return {
        dateStr: ds,
        dateLabel: dateLabel(ds),
        emoji: jmaEmoji(wArea.weatherCodes?.[i] || '100'),
        desc: (wArea.weathers?.[i] || '').replace(/\s+/g,' ').trim() || '—',
        pop: popsMap[ds] || '—',
        tempMin: tempsMap[ds]?.min || '—',
        tempMax: tempsMap[ds]?.max || '—',
      };
    });
  }

  // メイン取得API
  async function getWeather(pref, dateStr) {
    const hit = cached(pref, dateStr);
    if (hit) return hit;
    const result = isPast(dateStr)
      ? await fromArchive(pref, dateStr)
      : await fromJMA(pref, dateStr);
    if (result) storeCache(pref, dateStr, result);
    return result;
  }

  // 過去キャッシュ一覧（最新20件）
  function getCacheHistory() {
    const c = getCache();
    return Object.entries(c)
      .map(([k, v]) => { const [pref, date] = k.split('_'); return { pref, date, ...v }; })
      .filter(e => e.date && e.emoji)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 20);
  }

  const PREFS = Object.keys(PREF_OFFICES);

  return {
    getWeather, forecast3Day, getCacheHistory,
    getSavedPref, savePref,
    isPast, dateLabel, PREFS,
  };
})();
