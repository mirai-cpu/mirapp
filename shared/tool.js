// tool.js — ツール共通の小さな部品(テーマ切り替え・Cookieバナー・乱数・コピー・保存)
const Tool = (() => {
  const $ = s => document.querySelector(s);

  // 明るい面/暗い面。選んだ面はサイト全体で共通のキーに保存する
  function initTheme(btnSel) {
    const btn = $(btnSel || '#themeBtn');
    function apply(th) {
      document.documentElement.setAttribute('data-theme', th);
      if (btn) btn.textContent = th === 'dark' ? '明るい面' : '暗い面';
      try { localStorage.setItem('somirai-face', th); } catch (e) {}
    }
    let th = null; try { th = localStorage.getItem('somirai-face'); } catch (e) {}
    if (!th) th = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    apply(th);
    if (btn) btn.addEventListener('click', () => apply(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
  }

  // Cookie同意バナー(サイト共通の cookie_ok キー)
  function initCookie() {
    try { if (localStorage.getItem('cookie_ok')) return; } catch (e) { return; }
    const b = document.createElement('div');
    b.id = 'ck-banner';
    b.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#2B2420;color:#D5D9DD;font-size:12px;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;z-index:9999;border-top:1px solid #4B403A;font-family:system-ui,sans-serif';
    b.innerHTML = '<span>本サイトはGoogle AdSense・Google AnalyticsのためにCookieを使用しています。詳細は<a href="/privacy.html" style="color:#F5C400">プライバシーポリシー</a>をご覧ください。</span><button type="button" style="background:#3AA860;color:#14110F;border:none;border-radius:4px;padding:10px 18px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;min-height:44px">OK</button>';
    b.querySelector('button').addEventListener('click', () => { try { localStorage.setItem('cookie_ok', '1'); } catch (e) {} b.remove(); });
    document.body.appendChild(b);
  }

  // 偏りの少ない乱数(暗号用の乱数を使う)
  function randInt(n) {
    const a = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n;
    do { crypto.getRandomValues(a); } while (a[0] >= lim);
    return a[0] % n;
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // 共有(対応端末は共有シート、それ以外はコピー)
  async function share(text, btn, doneLabel) {
    const orig = btn ? btn.textContent : '';
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); if (btn) { btn.textContent = doneLabel || 'コピーしました'; setTimeout(() => btn.textContent = orig, 1800); } }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      if (btn) { btn.textContent = 'コピーできませんでした。上の文を手でコピーしてください'; }
    }
  }

  function load(key, def) { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch (e) { return def; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

  // スタメンメーカーの名簿(あれば読み込む)。[{ name, pos:[...] }]
  function roster() {
    const players = load('sm_players', []);
    return Array.isArray(players) ? players.filter(p => p && p.name).map(p => ({ name: String(p.name), pos: Array.isArray(p.pos) ? p.pos : [] })) : [];
  }

  function reducedMotion() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  return { initTheme, initCookie, randInt, shuffle, share, load, save, roster, reducedMotion, buzz, esc };
})();
