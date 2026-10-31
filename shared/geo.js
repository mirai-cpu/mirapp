// geo.js — 現在地を都道府県・市区町村(区まで)に変換する共通部品
// 位置情報はブラウザ内だけで使い、保存も送信もしない(国土地理院の逆ジオコーダに座標を問い合わせるのみ)
// 使い方: const loc = await SomiraiGeo.locate();  // { lat, lon, prefName, prefIdx, muni, label }
// 失敗時は Error を投げる。err.code は 'unsupported' | 'denied' | 'timeout' | 'unavailable'
// 住所への変換だけ失敗した場合は prefName / muni / label が null のまま座標を返す
const SomiraiGeo = (() => {
  const PREFS = ['北海道','青森','岩手','宮城','秋田','山形','福島','茨城','栃木','群馬','埼玉','千葉','東京','神奈川','新潟','富山','石川','福井','山梨','長野','岐阜','静岡','愛知','三重','滋賀','京都','大阪','兵庫','奈良','和歌山','鳥取','島根','岡山','広島','山口','徳島','香川','愛媛','高知','福岡','佐賀','長崎','熊本','大分','宮崎','鹿児島','沖縄'];
  let muniTable = null;

  function position() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(Object.assign(new Error('unsupported'), { code: 'unsupported' })); return; }
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
        e => reject(Object.assign(new Error('geolocation'), { code: e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable' })),
        { timeout: 8000, maximumAge: 60000 }
      );
    });
  }

  // 緯度経度 → { prefIdx, prefName, muni, label }。失敗したら null
  async function reverse(lat, lon) {
    try {
      const res = await fetch(`https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lon}`);
      if (!res.ok) return null;
      const code = (await res.json()).results?.muniCd;
      if (!code) return null;
      if (!muniTable) muniTable = await (await fetch('/shared/muni.json')).json();
      const id = String(code).padStart(5, '0');
      const muni = muniTable[id];
      const prefIdx = Math.floor(+id / 1000) - 1;
      if (!muni || !PREFS[prefIdx]) return null;
      return { prefIdx, prefName: PREFS[prefIdx], muni, label: fullPref(prefIdx) + muni };
    } catch { return null; }
  }

  function fullPref(i) {
    const n = PREFS[i];
    return n === '北海道' ? n : n === '東京' ? '東京都' : (n === '大阪' || n === '京都') ? n + '府' : n + '県';
  }

  async function locate() {
    const { lat, lon } = await position();
    const addr = await reverse(lat, lon);
    return { lat, lon, prefName: null, prefIdx: null, muni: null, label: null, ...addr };
  }

  // 失敗理由をそのまま画面に出せる日本語にする
  function errorMessage(err) {
    return ({
      unsupported: 'このブラウザでは現在地を取得できません。',
      denied: '現在地の利用が許可されていません。ブラウザの設定で位置情報を許可してください。',
      timeout: '現在地の取得に時間がかかりました。もう一度試してください。',
      unavailable: '現在地を取得できませんでした。電波の良い場所でもう一度試してください。'
    })[err && err.code] || '現在地を取得できませんでした。';
  }

  return { locate, reverse, errorMessage, PREFS, fullPref };
})();
