// blog-ga.js — ブログ記事の読了を測る(スクロール25/50/75/100%と、きちんと読んだ判定)
// イベント名に割合を含める: GAのカスタムディメンションを作らなくても、ページごとに集計できる。
(function () {
  if (typeof gtag !== 'function') return;
  var body = document.querySelector('.article-body') || document.querySelector('article');
  if (!body) return;
  var sent = {}, t0 = Date.now(), read = false;
  function send(n) { if (!sent[n]) { sent[n] = 1; gtag('event', n); } }
  function check() {
    var r = body.getBoundingClientRect();
    var total = body.offsetHeight || 1;
    var seen = (window.innerHeight - r.top) / total;          // 本文のうち画面に入った割合
    var p = Math.max(0, Math.min(1, seen));
    [25, 50, 75, 100].forEach(function (m) { if (p * 100 >= m - (m === 100 ? 3 : 0)) send('blog_scroll_' + m); });
    // 本文の75%まで進み、かつ45秒以上いた = 実際に読んだ
    if (!read && p >= 0.75 && Date.now() - t0 >= 45000) { read = true; send('blog_read'); }
  }
  var tick = false;
  window.addEventListener('scroll', function () { if (tick) return; tick = true; setTimeout(function () { tick = false; check(); }, 250); }, { passive: true });
  setInterval(check, 5000);
  check();
})();
