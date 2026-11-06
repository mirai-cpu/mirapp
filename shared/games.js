/*
 * 複数試合の通算計算(WHIP・防御率の計算機で共通)
 * - 試合ごとの行を入力 → 合計してから通算値を出す
 * - 上の1試合の計算結果を register() で登録できる
 * - 入力はブラウザ(localStorage)に保存。登録した試合の一覧は隠せる(通算には含めたまま)
 * - 試合ごとに「通算」のチェックを外すと、その試合だけ通算から外せる(数字は残る)
 *
 * GameLog({
 *   key: 'somirai:whip-games',
 *   root: 要素(中に #game-rows などを持つカード),
 *   fields: [{ cls: 'g-bb', label: '与四球', placeholder: '2', innings: false }, ...],
 *   compute: function (sums, outs, used) { return { value: '1.06', note: '...' } または null },
 *   event: 'whip_multi_calculated'
 * })
 */
(function () {
  // 投球回を「アウト数」に変換(6.1 → 19, 6.2 → 20)。不正な値は null
  function toOuts(raw) {
    if (raw === '' || raw === null || raw === undefined) return null;
    var n = parseFloat(raw);
    if (!isFinite(n) || n < 0) return null;
    var whole = Math.floor(n);
    var frac = Math.round((n - whole) * 10);
    if (frac > 2) return null;
    return whole * 3 + frac;
  }
  function fmtInnings(outs) {
    return Math.floor(outs / 3) + (outs % 3 ? '.' + (outs % 3) : '');
  }

  function GameLog(opt) {
    var root = opt.root;
    var q = function (sel) { return root.querySelector(sel); };
    var $rows = q('#game-rows'), $res = q('#multi-result'), $val = q('#multi-value'), $note = q('#multi-note');
    var $toggle = q('#toggle-games'), $hiddenNote = q('#hidden-note'), $head = q('.game-head');
    var fields = opt.fields;
    var hidden = false;

    function save() {
      try {
        var data = Array.prototype.map.call($rows.children, function (r) {
          return {
            v: fields.map(function (f) { return r.querySelector('.' + f.cls).value; }),
            off: !r.querySelector('.g-use').checked
          };
        });
        localStorage.setItem(opt.key, JSON.stringify({ rows: data, hidden: hidden }));
      } catch (e) {}
    }
    function load() {
      try {
        var d = JSON.parse(localStorage.getItem(opt.key) || 'null');
        if (Array.isArray(d)) d = { rows: d, hidden: false }; // 以前の保存形式
        return d && Array.isArray(d.rows) && d.rows.length ? d : null;
      } catch (e) { return null; }
    }

    function isEmpty(r) {
      return fields.every(function (f) { return !r.querySelector('.' + f.cls).value; });
    }
    function offCount() {
      return Array.prototype.filter.call($rows.children, function (r) { return !isEmpty(r) && isOff(r); }).length;
    }
    function filledCount() {
      return Array.prototype.filter.call($rows.children, function (r) { return !isEmpty(r); }).length;
    }

    function isOff(r) { return !r.querySelector('.g-use').checked; }

    function addRow(vals, off) {
      var no = $rows.children.length + 1;
      var row = document.createElement('div');
      row.className = 'game-row';
      var html = '<span class="game-no"></span>';
      fields.forEach(function (f) {
        html += '<input type="number" class="' + f.cls + '" min="0" step="' + (f.innings ? '0.1' : '1') + '" inputmode="' +
          (f.innings ? 'decimal' : 'numeric') + '" placeholder="' + f.placeholder + '">';
      });
      html += '<label class="use"><input type="checkbox" class="g-use" checked></label>';
      html += '<button type="button" class="rm" aria-label="この行を削除">×</button>';
      row.innerHTML = html;
      row.querySelector('.rm').addEventListener('click', function () {
        if ($rows.children.length > 1) { row.remove(); } else { fields.forEach(function (f) { row.querySelector('.' + f.cls).value = ''; }); }
        renumber(); calc();
      });
      row.addEventListener('input', calc);
      row.querySelector('.g-use').addEventListener('change', function () {
        row.classList.toggle('off', isOff(row)); renumber(); calc();
      });
      if (vals) fields.forEach(function (f, i) { row.querySelector('.' + f.cls).value = vals[i] || ''; });
      if (off) { row.querySelector('.g-use').checked = false; row.classList.add('off'); }
      $rows.appendChild(row);
      renumber();
      return row;
    }
    function renumber() {
      Array.prototype.forEach.call($rows.children, function (r, i) {
        var no = (i + 1) + '試合目';
        r.querySelector('.game-no').textContent = no;
        r.querySelector('.g-use').setAttribute('aria-label', no + 'を通算に含める');
        fields.forEach(function (f) { r.querySelector('.' + f.cls).setAttribute('aria-label', no + ' ' + f.label); });
      });
    }

    function render() {
      $rows.style.display = hidden ? 'none' : '';
      if ($head) $head.style.display = hidden ? 'none' : '';
      var n = filledCount();
      $toggle.textContent = hidden ? '登録した試合を表示する' : '登録した試合を隠す';
      $toggle.setAttribute('aria-expanded', hidden ? 'false' : 'true');
      $hiddenNote.style.display = hidden ? 'block' : 'none';
      var off = offCount();
      $hiddenNote.textContent = n + '試合を非表示にしています（' +
        (off ? '通算から外した' + off + '試合を除き、通算に含まれています）' : '通算には含まれています）');
    }
    function setHidden(h) { hidden = h; render(); save(); }

    function calc(silent) {
      save();
      var sums = {}, outs = 0, used = 0;
      fields.forEach(function (f) { if (!f.innings) sums[f.cls] = 0; });
      Array.prototype.forEach.call($rows.children, function (r) {
        if (isOff(r)) return;
        var o = null, ok = true, vals = {};
        fields.forEach(function (f) {
          var v = r.querySelector('.' + f.cls).value;
          if (f.innings) { o = toOuts(v); if (o === null) ok = false; }
          else { var x = parseFloat(v); if (!isFinite(x) || x < 0) ok = false; vals[f.cls] = x; }
        });
        if (!ok) return;
        Object.keys(vals).forEach(function (k) { sums[k] += vals[k]; });
        outs += o; used++;
      });
      render();
      var out = used > 0 && outs > 0 ? opt.compute(sums, outs, used) : null;
      if (!out) { $res.style.display = 'none'; return; }
      $val.textContent = out.value;
      var off = offCount();
      $note.textContent = out.note + (off ? '（' + off + '試合は通算から外しています）' : '');
      $res.style.display = 'block';
      if (silent !== true && opt.event && typeof gtag === 'function') gtag('event', opt.event, {});
    }

    q('#add-game').addEventListener('click', function () {
      if (hidden) hidden = false;
      var r = addRow(); calc(true);
      r.querySelector('input').focus();
    });
    q('#clear-games').addEventListener('click', function () {
      if (!confirm('入力した試合をすべて消します。よろしいですか？')) return;
      $rows.innerHTML = '';
      hidden = false;
      addRow(); addRow(); addRow();
      calc(true);
    });
    $toggle.addEventListener('click', function () { setHidden(!hidden); });

    var saved = load();
    if (saved) {
      saved.rows.forEach(function (d) { if (Array.isArray(d)) addRow(d); else addRow(d.v, d.off); }); hidden = !!saved.hidden;
    }
    else { addRow(); addRow(); addRow(); }
    calc(true);

    return {
      // 1試合分を登録する。値の順番は fields と同じ。登録した試合番号を返す(不正な値なら null)
      register: function (vals) {
        var bad = fields.some(function (f, i) {
          if (f.innings) return toOuts(vals[i]) === null;
          var x = parseFloat(vals[i]); return !isFinite(x) || x < 0;
        });
        if (bad) return null;
        var target = null;
        Array.prototype.some.call($rows.children, function (r) {
          if (isEmpty(r) && !isOff(r)) { target = r; return true; }
          return false;
        });
        if (!target) target = addRow();
        fields.forEach(function (f, i) { target.querySelector('.' + f.cls).value = vals[i]; });
        calc(true);
        return Array.prototype.indexOf.call($rows.children, target) + 1;
      },
      isHidden: function () { return hidden; }
    };
  }

  GameLog.toOuts = toOuts;
  GameLog.fmtInnings = fmtInnings;
  window.GameLog = GameLog;
})();
