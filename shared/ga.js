// ga.js — 「ちゃんと使っているか」を測る重要イベントの共通部品
//   Track.ev(name, params)  : そのまま送る
//   Track.once(name, params): 1回のページ表示で1度だけ送る(「到達した」を測る用)
// イベントの一覧と意味は analytics/tool-events.json を参照(「よろしく」のセクション14で使う)。
const Track = (() => {
  const done = {};
  function ev(name, params) { try { if (typeof gtag === 'function') gtag('event', name, params || {}); } catch (e) {} }
  function once(name, params) { if (done[name]) return; done[name] = 1; ev(name, params); }
  return { ev, once };
})();
