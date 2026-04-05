// tutorial.js - First-visit tutorial & help modal

const Tutorial = (() => {
  const STORAGE_KEY = 'tutorial-seen-v1';

  const SLIDES = [
    {
      icon: '⚾',
      title: 'My Batting Stats へようこそ',
      body: `野球の打撃成績を簡単に記録・分析できるアプリです。<br>
             打率・OPS・打球方向など、さまざまなデータを自動で計算します。`,
    },
    {
      icon: '📝',
      title: '① 打席を記録する（記録タブ）',
      body: `<strong>日付・相手・投手の左右</strong>を入力し、<br>
             打席の<strong>結果ボタン</strong>（単打・三振・ゴロなど）を選んで<br>
             <strong>「記録する」</strong>をタップするだけで保存できます。<br><br>
             フィールド図をタップして<strong>打球方向</strong>も記録できます。`,
    },
    {
      icon: '📊',
      title: '② 成績を確認する（成績タブ）',
      body: `打席を記録すると<strong>打率・出塁率・長打率・OPS</strong>が自動計算されます。<br><br>
             フィルターで<strong>期間別・チーム別</strong>に絞り込み可能。<br>
             打球方向ヒートマップや打率推移グラフも確認できます。`,
    },
    {
      icon: '⚡',
      title: '③ 特殊能力 & シェア',
      body: `成績に応じて<strong>特殊能力</strong>が解放されます（50種類）。<br>
             「広角打法」「ホームランバッター」など、あなたのプレースタイルが分かります。<br><br>
             <strong>「成績をシェアする」</strong>ボタンから画像カードを作成してSNSに投稿できます。`,
    },
    {
      icon: '💾',
      title: '④ データについて',
      body: `データはすべて<strong>このデバイスに保存</strong>されます（サーバー送信なし）。<br><br>
             履歴タブの<strong>「CSVエクスポート」</strong>でデータをバックアップできます。<br>
             ホーム画面に追加するとアプリとして使えます（PWA対応）。`,
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
    prevBtn.style.visibility = _currentSlide === 0 ? 'hidden' : '';
    nextBtn.textContent = isLast ? '✓ 閉じる' : '次へ →';
  }

  return { init, openModal };
})();
