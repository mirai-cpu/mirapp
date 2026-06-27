// tutorial.js - First-visit tutorial & help modal

const Tutorial = (() => {
  const STORAGE_KEY = 'tutorial-seen-v1';

  const SLIDES = [
    {
      icon: '⚾',
      title: '打席結果を選んで記録するだけ！',
      body: `打率・OPS・スプレーチャートは自動計算されます。<br>
             まず試合の打席結果を選んで「記録する」を押してみてください。`,
    },
  ];

  let _currentSlide = 0;

  function init() {
    _bindHelpBtn();
    if (!localStorage.getItem(STORAGE_KEY)) {
      // 少し遅らせてページ描画後に表示
      setTimeout(openModal, 600);
    }
  }

  function _bindHelpBtn() {
    document.getElementById('btn-help')?.addEventListener('click', openModal);
    document.getElementById('tutorial-close')?.addEventListener('click', closeModal);
    document.getElementById('tutorial-overlay')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal();
    });
    document.getElementById('tutorial-prev')?.addEventListener('click', () => goTo(_currentSlide - 1));
    document.getElementById('tutorial-next')?.addEventListener('click', () => {
      if (_currentSlide < SLIDES.length - 1) {
        goTo(_currentSlide + 1);
      } else {
        closeModal();
      }
    });
  }

  function openModal() {
    _currentSlide = 0;
    _render();
    document.getElementById('tutorial-overlay').style.display = '';
  }

  function closeModal() {
    document.getElementById('tutorial-overlay').style.display = 'none';
    localStorage.setItem(STORAGE_KEY, '1');
  }

  function goTo(index) {
    if (index < 0 || index >= SLIDES.length) return;
    _currentSlide = index;
    _render();
  }

  function _render() {
    const slide = SLIDES[_currentSlide];
    const isLast = _currentSlide === SLIDES.length - 1;

    document.getElementById('tutorial-icon').textContent  = slide.icon;
    document.getElementById('tutorial-title').textContent = slide.title;
    document.getElementById('tutorial-body').innerHTML    = slide.body;

    // ドットインジケーター
    document.querySelectorAll('.tutorial-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === _currentSlide);
    });

    // ボタン
    const prevBtn = document.getElementById('tutorial-prev');
    const nextBtn = document.getElementById('tutorial-next');
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.textContent = 'はじめる →';
  }

  return { init, openModal };
})();
