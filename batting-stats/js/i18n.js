// i18n.js - Internationalization (fetch-based JSON loader)

const I18n = (() => {
  let _lang = 'ja';
  let _data = {};

  // ── Language detection ──────────────────────────────────────
  function getCurrentLang() {
    return localStorage.getItem('lang')
      || (navigator.language.startsWith('ja') ? 'ja' : 'en');
  }

  function getLang() { return _lang; }

  // ── Load JSON from locales/ ─────────────────────────────────
  async function _load(lang) {
    const res = await fetch(`locales/${lang}.json`);
    if (!res.ok) throw new Error(`Failed to load locales/${lang}.json`);
    _data = await res.json();
    _lang = lang;
  }

  // ── Public API ──────────────────────────────────────────────
  async function init() {
    await _load(getCurrentLang());
    _applyToDOM();
  }

  async function setLang(lang) {
    localStorage.setItem('lang', lang);
    await _load(lang);
    _applyToDOM();
  }

  // t(key): returns translated string, falls back to key name
  function t(key) {
    return Object.prototype.hasOwnProperty.call(_data, key) ? _data[key] : key;
  }

  // ── DOM update ──────────────────────────────────────────────
  function _applyToDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPh);
    });
    document.documentElement.lang = _lang;

    // Dynamic meta updates
    if (Object.prototype.hasOwnProperty.call(_data, 'meta.title'))
      document.title = _data['meta.title'];
    const descEl = document.querySelector('meta[name="description"]');
    if (descEl && Object.prototype.hasOwnProperty.call(_data, 'meta.description'))
      descEl.setAttribute('content', _data['meta.description']);
  }

  return { init, getCurrentLang, getLang, setLang, t, applyToDOM: _applyToDOM };
})();
