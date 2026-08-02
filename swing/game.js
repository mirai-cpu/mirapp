// ── Audio ────────────────────────────────────────────────────
let _audioCtx = null;
function getAudio() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}
function playTone(freq, dur, type='sine', vol=0.2) {
  try {
    const ctx = getAudio();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + dur);
  } catch {}
}
function playCrack() {
  try {
    const ctx = getAudio();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.06));
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.6, ctx.currentTime);
    src.connect(g); g.connect(ctx.destination); src.start();
  } catch {}
}
function playSwing() { playTone(160, 0.15, 'sawtooth', 0.12); }
function playHit()   { playCrack(); playTone(440, 0.1, 'sine', 0.15); }
function playHR()    { playCrack(); playTone(880, 0.35, 'sine', 0.2); }
function playMiss()  { playTone(120, 0.2, 'sawtooth', 0.08); }
function playBall()  { playTone(300, 0.12, 'sine', 0.1); }
function playStrike(){ playTone(220, 0.15, 'square', 0.1); }

// ── Game config ──────────────────────────────────────────────
const PITCHES = [
  { name:'ストレート', key:'straight', baseSpeed:385, color:'#f0f0ff', glow:'rgba(240,240,255,0.7)' },
  { name:'スライダー', key:'slider',   baseSpeed:455, color:'#60a5fa', glow:'rgba(96,165,250,0.7)'  },
  { name:'カーブ',    key:'curve',    baseSpeed:585, color:'#fbbf24', glow:'rgba(251,191,36,0.7)'   },
  { name:'チェンジアップ',key:'change',baseSpeed:660, color:'#4ade80', glow:'rgba(74,222,128,0.7)'  },
];
const TOTAL_OUTS = 9;

// ── Difficulty settings ───────────────────────────────────────
const DIFFICULTIES = {
  easy:   { label:'かんたん',  strikeRate:0.72, speedFactor:1.35, perfectMs:130, goodMs:320, pitchTypes:[0,2],    windupMin:600, windupMax:1000 },
  normal: { label:'ふつう',    strikeRate:0.60, speedFactor:1.00, perfectMs:80,  goodMs:220, pitchTypes:[0,1,2,3], windupMin:800, windupMax:1500 },
  hard:   { label:'むずかしい',strikeRate:0.45, speedFactor:0.78, perfectMs:48,  goodMs:145, pitchTypes:[0,1,2,3], windupMin:500, windupMax:950  },
  pro:    { label:'プロ',      strikeRate:0.36, speedFactor:0.60, perfectMs:26,  goodMs:90,  pitchTypes:[0,1,2,3], windupMin:380, windupMax:680  },
};
let DIFF = DIFFICULTIES.normal;
let DIFF_KEY = 'normal';

// ── MY PLAYER ボーナス(Phase3) ──────────────────────────────────
// /player/stats.js が読み込まれていれば、他ツールの利用状況をゲームに軽く反映する。
// 未使用でも不利にはならない(ボーナスが0になるだけ)。
const MP_BONUS = { perfectMs: 0, goodMs: 0 };
(function initPlayerBonus() {
  if (typeof SomiraiPlayer === 'undefined') return;
  try {
    const lumberScore = SomiraiPlayer.getScore('lumber');       // 打撃
    const marginaliaScore = SomiraiPlayer.getScore('marginalia'); // 集中力
    MP_BONUS.perfectMs = Math.round((lumberScore / 100) * 15);   // 最大+15ms
    MP_BONUS.goodMs    = Math.round((marginaliaScore / 100) * 25); // 最大+25ms
  } catch (e) { /* keep bonus at 0 */ }
})();
function effPerfectMs() { return DIFF.perfectMs + MP_BONUS.perfectMs; }
function effGoodMs()    { return DIFF.goodMs + MP_BONUS.goodMs; }

// ── 投手キャラ(Phase4) ───────────────────────────────────────────
const PITCHERS = [
  { id:'rookie',    name:'ルーキー右腕',   unlockAB:0,   pitchTypes:[0,2],     speedMod:1.00 },
  { id:'sidearm',   name:'サイドスロー',   unlockAB:20,  pitchTypes:[0,1],     speedMod:0.96 },
  { id:'ace',       name:'絶対エース',     unlockAB:50,  pitchTypes:[0,1,2,3], speedMod:0.92 },
  { id:'trickster', name:'技巧派左腕',     unlockAB:100, pitchTypes:[1,2,3],   speedMod:0.88 },
  { id:'legend',    name:'伝説の守護神',   unlockAB:200, pitchTypes:[0,1,2,3], speedMod:0.80 },
];
let PITCHER_KEY = 'rookie';
function currentPitcher() {
  return PITCHERS.find(p => p.id === PITCHER_KEY) || PITCHERS[0];
}

// ── シーズン通算(Phase4) ─────────────────────────────────────────
const SEASON_KEY = 'swing-season';
function loadSeason() {
  try {
    const raw = localStorage.getItem(SEASON_KEY);
    if (!raw) return { hits:0, ab:0, hr:0, games:0 };
    const p = JSON.parse(raw);
    return { hits:p.hits||0, ab:p.ab||0, hr:p.hr||0, games:p.games||0 };
  } catch (e) { return { hits:0, ab:0, hr:0, games:0 }; }
}
function saveSeason(season) {
  try { localStorage.setItem(SEASON_KEY, JSON.stringify(season)); } catch (e) {}
}
function addToSeason(hits, ab, hr) {
  const season = loadSeason();
  season.hits += hits; season.ab += ab; season.hr += hr; season.games += 1;
  saveSeason(season);
  return season;
}
function resetSeason() {
  saveSeason({ hits:0, ab:0, hr:0, games:0 });
}

// ── ゴーストバトル(Phase4) ───────────────────────────────────────
// サーバーなしで「合言葉」コードから他プレイヤーの成績を再現し、目標として比較する。
let GHOST = null; // { h, ab, hr } | null
function encodeGhost(h, ab, hr) {
  return [h, ab, hr].map(n => Math.max(0, Math.round(n)).toString(36)).join('.');
}
function decodeGhost(code) {
  try {
    const parts = String(code).trim().split('.');
    if (parts.length !== 3) return null;
    const h = parseInt(parts[0], 36), ab = parseInt(parts[1], 36), hr = parseInt(parts[2], 36);
    if (!isFinite(h) || !isFinite(ab) || !isFinite(hr)) return null;
    if (h < 0 || ab < 0 || hr < 0 || h > ab) return null;
    return { h, ab, hr };
  } catch (e) { return null; }
}

// ── State ────────────────────────────────────────────────────
const S = {
  phase: 'ready', // ready | windup | pitch | result
  balls: 0, strikes: 0, outs: 0,
  hits: 0, ab: 0, hr: 0,
  pitch: null,
  swingTime: null,
  releaseTime: null,
  plateTime: null,
  judgeTimer: null,
  animId: null,
  timingAnimId: null,
  swung: false,
};

// ── DOM refs ─────────────────────────────────────────────────
const $field        = document.getElementById('game-field');
const $ball         = document.getElementById('game-ball');
const $pitcher      = document.getElementById('pitcher-wrap');
const $sz           = document.getElementById('strike-zone');
const $swingBtn     = document.getElementById('swing-btn');
const $resultText   = document.getElementById('result-text');
const $resultInner  = document.getElementById('result-inner');
const $resultSub    = document.getElementById('result-sub');
const $flash        = document.getElementById('screen-flash');
const $swingFlash   = document.getElementById('swing-flash');
const $particles    = document.getElementById('particles');
const $windupText   = document.getElementById('windup-text');
const $timingMarker = document.getElementById('timing-marker');
const $timingWindow = document.getElementById('timing-window');
const $timingHint   = document.getElementById('timing-hint');
const $lastPitch    = document.getElementById('last-pitch');
const $pitchBadge   = document.getElementById('pitch-type-badge');
const $headerAvg    = document.getElementById('header-avg');
const $headerCounts = document.getElementById('header-counts');
const $inningNum    = document.getElementById('inning-num');

// ── Utilities ────────────────────────────────────────────────
function fmtAvg(h, ab) { if (ab === 0) return '---'; return '.' + String(Math.round(h / ab * 1000)).padStart(3, '0'); }
function rnd(min, max) { return Math.random() * (max - min) + min; }
function lerp(a, b, t) { return a + (b - a) * t; }

function updateCountDots() {
  ['ball-dots','strike-dots','out-dots'].forEach((id, gi) => {
    const counts = [S.balls, S.strikes, S.outs];
    const maxes  = [4, 3, 3];
    document.getElementById(id).querySelectorAll('.dot').forEach((d, i) => {
      d.classList.toggle('lit', i < counts[gi]);
    });
  });
  const inning = Math.floor(S.outs / 3) + 1;
  $inningNum.textContent = Math.min(inning, 3);
  $headerAvg.textContent = fmtAvg(S.hits, S.ab);
  $headerCounts.innerHTML = `H: ${S.hits} &nbsp;HR: ${S.hr} &nbsp;<span style="font-size:11px;opacity:.55;">${DIFF.label}</span>`;
}

// ── Ball animation ───────────────────────────────────────────
function getFieldRect() { return $field.getBoundingClientRect(); }

function startBallAnim(pitch) {
  if (S.animId) cancelAnimationFrame(S.animId);
  const rect = getFieldRect();
  const W = rect.width, H = rect.height;

  // Pitcher release point (near top center)
  const startX = W * 0.5;
  const startY = H * 0.22;
  const startSize = 4;

  // Home plate landing (center-ish, lower)
  const endX = W * 0.5 + pitch.finalDx;
  const endY = H * 0.66 + pitch.finalDy;
  const endSize = 40;

  $ball.style.cssText = `
    display:block; border-radius:50%; position:absolute;
    background: radial-gradient(circle at 35% 30%, white, ${pitch.color});
    box-shadow: 0 0 16px ${pitch.glow}, 0 0 32px ${pitch.glow};
    pointer-events:none; will-change:transform,width,height,left,top;
    width:${startSize}px; height:${startSize}px;
    left:${startX - startSize/2}px; top:${startY - startSize/2}px;
    z-index:5;
  `;
  document.getElementById('ball-seam').style.borderColor = `rgba(200,80,60,.35)`;

  const duration = pitch.speed;
  const t0 = performance.now();

  function frame(now) {
    const t = Math.min((now - t0) / duration, 1);
    const tPos = t;
    const tSize = t * t * (3 - 2 * t); // smooth step for size

    const x = lerp(startX, endX, tPos);
    const y = lerp(startY, endY, tPos);
    const size = lerp(startSize, endSize, tSize);

    $ball.style.width  = size + 'px';
    $ball.style.height = size + 'px';
    $ball.style.left   = (x - size/2) + 'px';
    $ball.style.top    = (y - size/2) + 'px';

    if (t < 1) S.animId = requestAnimationFrame(frame);
    else        S.animId = null;
  }
  S.animId = requestAnimationFrame(frame);
}

// ── Timing rail animation ────────────────────────────────────
function startTimingAnim(pitch) {
  if (S.timingAnimId) cancelAnimationFrame(S.timingAnimId);
  const rail = document.getElementById('timing-rail');
  const railW = rail.offsetWidth;
  // Marker starts at right edge, moves to center (= plateTime)
  const startLeft = railW - 12;  // right edge
  const endLeft   = railW / 2 - 8;  // center

  $timingMarker.style.display = 'block';
  $timingMarker.style.left = startLeft + 'px';
  $timingMarker.style.setProperty('--marker-color', pitch.color);

  const t0 = performance.now();
  const dur = pitch.speed;

  function frame(now) {
    if (S.phase !== 'pitch') { S.timingAnimId = null; return; }
    const t = Math.min((now - t0) / dur, 1);
    const left = lerp(startLeft, endLeft, t);
    $timingMarker.style.left = left + 'px';

    // Show perfect window when marker is near center (t = 0.85 to 1.15)
    if (t > 0.82 && t < 1.18) {
      $timingWindow.classList.add('visible');
    } else {
      $timingWindow.classList.remove('visible');
    }

    if (t < 1.5) S.timingAnimId = requestAnimationFrame(frame);
    else { S.timingAnimId = null; $timingMarker.style.display = 'none'; $timingWindow.classList.remove('visible'); }
  }
  S.timingAnimId = requestAnimationFrame(frame);
}

// ── Particles (HR) ───────────────────────────────────────────
function spawnParticles() {
  $particles.innerHTML = '';
  const colors = ['#ffd700','#ff6b35','#ff8c42','#ffab00','#fff176','#ffe082'];
  for (let i = 0; i < 28; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const angle = (i / 28) * 360 + rnd(-20, 20);
    const dist  = rnd(80, 180);
    const rad   = angle * Math.PI / 180;
    const px = Math.cos(rad) * dist;
    const py = Math.sin(rad) * dist;
    const sz = rnd(6, 14);
    p.style.cssText = `width:${sz}px;height:${sz}px;background:${colors[i%colors.length]};
      --px:${px}px;--py:${py}px;animation-duration:${rnd(0.6,1.1)}s;animation-delay:${rnd(0,0.1)}s;
      margin-left:-${sz/2}px;margin-top:-${sz/2}px;`;
    $particles.appendChild(p);
  }
  setTimeout(() => $particles.innerHTML = '', 1200);
}

// ── Screen flash ─────────────────────────────────────────────
function doFlash(color, dur=80) {
  $flash.style.background = color;
  $flash.style.opacity = '1';
  setTimeout(() => $flash.style.opacity = '0', dur);
}

// ── Show result ──────────────────────────────────────────────
function showResult(text, sub, color, isHR=false) {
  $resultInner.textContent = text;
  $resultInner.style.color = color;
  $resultSub.textContent   = sub;
  $resultSub.style.color   = color;
  $resultText.className    = 'show';
  $resultText.style.opacity = '1';
  if (isHR) {
    doFlash('rgba(255,107,53,0.3)', 200);
    spawnParticles();
  }
}
function clearResult() {
  $resultText.className = '';
  $resultText.style.opacity = '0';
}

// ── Update strike zone state ──────────────────────────────────
function szState(state) {
  $sz.className = state || '';
}

// ── Enable/disable swing button ───────────────────────────────
function enableSwing(yes) {
  $swingBtn.disabled = !yes;
  $swingBtn.classList.toggle('idle', !yes);
}

// ── Generate pitch ─────────────────────────────────────────────
// ストライクゾーン実座標を getBoundingClientRect で取得して着地点を計算。
// isStrike は乱数ではなく「実際に枠内に入るか否か」で確定させる。
function generatePitch() {
  const fieldRect = $field.getBoundingClientRect();
  const szRect    = $sz.getBoundingClientRect();
  const W = fieldRect.width;
  const H = fieldRect.height;

  // ボール基準着地点（フィールド座標）
  const baseX = W / 2;
  const baseY = H * 0.66;

  // ストライクゾーン中心（フィールド座標）
  const szCx = (szRect.left - fieldRect.left) + szRect.width  / 2;
  const szCy = (szRect.top  - fieldRect.top)  + szRect.height / 2;

  // ベースに対するストライクゾーン中心のオフセット
  const szRelX = szCx - baseX;
  const szRelY = szCy - baseY;
  const szHW   = szRect.width  / 2;
  const szHH   = szRect.height / 2;

  const wantStrike = Math.random() < DIFF.strikeRate;
  const pitcher = currentPitcher();
  const allowedTypes = DIFF.pitchTypes.filter(t => pitcher.pitchTypes.includes(t));
  const pitchPool = allowedTypes.length > 0 ? allowedTypes : DIFF.pitchTypes;
  const typeIdx = pitchPool[Math.floor(Math.random() * pitchPool.length)];
  const type = PITCHES[typeIdx];

  let finalDx, finalDy;

  const BALL_R = 20; // endSize/2

  if (wantStrike) {
    // ボールがゾーン内に完全に収まる（端からBall_R分余裕）
    finalDx = szRelX + rnd(-(szHW - BALL_R), szHW - BALL_R);
    finalDy = szRelY + rnd(-(szHH - BALL_R), szHH - BALL_R);
  } else {
    // ゾーン外に着地（一部は枠にかかるケースも含む）
    const dir     = Math.floor(Math.random() * 4);
    const margin  = rnd(4, 80);
    switch (dir) {
      case 0: finalDx = szRelX + szHW + margin;  finalDy = szRelY + rnd(-szHH, szHH); break; // 外角
      case 1: finalDx = szRelX - szHW - margin;  finalDy = szRelY + rnd(-szHH, szHH); break; // 内角
      case 2: finalDx = szRelX + rnd(-szHW*.6, szHW*.6); finalDy = szRelY - szHH - margin; break; // 高め
      case 3: finalDx = szRelX + rnd(-szHW*.6, szHW*.6); finalDy = szRelY + szHH + margin; break; // 低め
    }
  }

  // isStrike: ボール端（半径分）がゾーン枠にかかれば判定（枠の線もストライク）
  const isStrike = (
    finalDx > szRelX - szHW - BALL_R && finalDx < szRelX + szHW + BALL_R &&
    finalDy > szRelY - szHH - BALL_R && finalDy < szRelY + szHH + BALL_R
  );

  const speed = Math.round(type.baseSpeed * DIFF.speedFactor * pitcher.speedMod);
  return { ...type, speed, isStrike, finalDx, finalDy };
}

// ── Judge outcome ────────────────────────────────────────────
function judge() {
  const p = S.pitch;
  clearTimeout(S.judgeTimer);
  S.judgeTimer = null;

  if (!S.swung) {
    // No swing
    if (p.isStrike) {
      S.strikes++;
      if (S.strikes >= 3) { handleOut('見逃し三振', ''); return; }
      showResult('見逃し', 'ストライク', 'var(--col-strike)');
      playStrike();
      szState('miss');
    } else {
      S.balls++;
      if (S.balls >= 4) { handleWalk(); return; }
      showResult('ボール', `${S.balls} BALL`, 'var(--col-ball)');
      playBall();
    }
    scheduleNext(1400);
    return;
  }

  // Swung
  playSwing();
  $swingFlash.classList.remove('show');
  void $swingFlash.offsetWidth;
  $swingFlash.classList.add('show');

  if (!p.isStrike) {
    S.strikes++;
    if (S.strikes >= 3) { handleOut('空振り三振', 'BALL OUTSIDE'); playMiss(); return; }
    showResult('空振り', 'ボール球', 'var(--col-out)');
    playMiss();
    szState('miss');
    scheduleNext(1400);
    return;
  }

  const diff = Math.abs(S.swingTime - S.plateTime);
  if (diff <= effPerfectMs()) {
    // ジャスト
    S.ab++;
    S.hits++;
    const isHR = Math.random() < 0.12;
    if (isHR) {
      S.hr++;
      showResult('⚾ HOME RUN !!', 'PERFECT TIMING', 'var(--col-hr)', true);
      doFlash('rgba(255,107,53,.25)', 300);
      playHR();
    } else {
      showResult('⚾ HIT !', 'PERFECT !', 'var(--col-perfect)');
      doFlash('rgba(255,215,0,.15)', 100);
      playHit();
    }
    szState('hit');
    scheduleNext(isHR ? 2000 : 1500);
  } else if (diff <= effGoodMs()) {
    // 許容タイミング
    S.ab++;
    const outcomes = ['ゴロ', 'フライ', 'ライナー'];
    const label = outcomes[Math.floor(Math.random() * outcomes.length)];
    if (Math.random() < 0.22) {
      S.hits++;
      showResult('HIT !', `${label} / 内野安打`, 'var(--col-hit)');
      playHit();
      szState('hit');
    } else {
      showResult('アウト', label, 'var(--col-out)');
      playMiss();
      szState('miss');
      S.strikes = 0; S.balls = 0;
      S.outs++;
      if (S.outs >= TOTAL_OUTS) { scheduleGameOver(); return; }
    }
    scheduleNext(1400);
  } else {
    // タイミング外れ
    S.strikes++;
    const earlyLate = S.swingTime < S.plateTime ? '早すぎ！' : '遅すぎ！';
    if (S.strikes >= 3) { handleOut('空振り三振', earlyLate); playMiss(); return; }
    showResult('空振り', earlyLate, 'var(--col-out)');
    playMiss();
    szState('miss');
    scheduleNext(1400);
  }
}

function handleOut(label, sub) {
  S.ab++;
  S.outs++;
  S.strikes = 0; S.balls = 0;
  showResult(label, sub, 'var(--col-out)');
  doFlash('rgba(244,63,94,.12)', 120);
  if (S.outs >= TOTAL_OUTS) { scheduleGameOver(); return; }
  scheduleNext(1600);
}

function handleWalk() {
  showResult('⚡ 四球', '4 BALLS — 出塁', 'var(--col-ball)');
  playBall();
  S.balls = 0; S.strikes = 0;
  scheduleNext(1400);
}

function scheduleNext(delay) {
  updateCountDots();
  $ball.style.display = 'none';
  if (S.animId) { cancelAnimationFrame(S.animId); S.animId = null; }
  if (S.timingAnimId) { cancelAnimationFrame(S.timingAnimId); S.timingAnimId = null; }
  $timingMarker.style.display = 'none';
  $timingWindow.classList.remove('visible');
  enableSwing(false);
  setTimeout(() => {
    szState('');
    clearResult();
    startPitch();
  }, delay);
}

function scheduleGameOver() {
  updateCountDots();
  $ball.style.display = 'none';
  enableSwing(false);
  setTimeout(showGameOver, 1800);
}

// ── Pitch cycle ──────────────────────────────────────────────
function startPitch() {
  if (S.outs >= TOTAL_OUTS) { showGameOver(); return; }

  S.phase   = 'windup';
  S.swung   = false;
  S.swingTime = null;
  S.pitch   = generatePitch();
  S.releaseTime = null;
  S.plateTime   = null;

  // Show windup
  $pitcher.className = 'windup';
  $windupText.style.opacity = '1';
  $timingHint.textContent = 'ボールを待て…';
  enableSwing(false);

  const windupDelay = rnd(DIFF.windupMin, DIFF.windupMax);
  setTimeout(() => {
    if (S.phase !== 'windup') return;
    $pitcher.className = 'throwing';
    $windupText.style.opacity = '0';

    setTimeout(() => {
      S.phase       = 'pitch';
      S.releaseTime = performance.now();
      S.plateTime   = S.releaseTime + S.pitch.speed;

      // Update pitch type display
      const p = S.pitch;
      $lastPitch.textContent = 'ボール接近中 — スイングのタイミング！';
      $pitchBadge.textContent = p.name;
      $pitchBadge.style.color = p.color;
      $pitchBadge.style.background = `${p.glow.replace('0.7','0.12')}`;

      $timingHint.textContent = '◆ に合わせてSWING！';
      szState('active');
      enableSwing(true);

      startBallAnim(p);
      startTimingAnim(p);

      // Auto-judge after plateTime + 220ms
      S.judgeTimer = setTimeout(() => {
        if (S.phase === 'pitch') {
          S.phase = 'result';
          judge();
        }
      }, p.speed + 220);

    }, 120);
  }, windupDelay);
}

// ── Swing handler ─────────────────────────────────────────────
function doSwing() {
  if (S.phase !== 'pitch' || S.swung) return;
  S.swung     = true;
  S.swingTime = performance.now();
  clearTimeout(S.judgeTimer);
  S.judgeTimer = null;
  S.phase = 'result';
  $swingBtn.classList.add('pressed');
  setTimeout(() => $swingBtn.classList.remove('pressed'), 200);
  judge();
}

// ── Game over ────────────────────────────────────────────────
function showGameOver() {
  S.phase = 'gameover';
  const avg = fmtAvg(S.hits, S.ab);
  document.getElementById('go-avg').textContent   = avg;
  document.getElementById('go-hits').textContent  = S.hits;
  document.getElementById('go-hr').textContent    = S.hr;
  document.getElementById('go-ab').textContent    = S.ab;

  // Highscore
  const prev = localStorage.getItem('swing-highscore') || '0';
  const prevVal = parseFloat(prev) || 0;
  const cur = S.ab > 0 ? S.hits / S.ab : 0;
  const hsMsg = document.getElementById('highscore-msg');
  if (cur > prevVal && S.ab >= 3) {
    localStorage.setItem('swing-highscore', cur.toFixed(4));
    hsMsg.textContent = '🏆 打率記録更新！最高: ' + avg;
  } else if (prevVal > 0) {
    hsMsg.textContent = `最高打率: .${String(Math.round(prevVal * 1000)).padStart(3,'0')}`;
  } else {
    hsMsg.textContent = '';
  }

  // シーズン通算を更新(Phase4)
  const prevSeasonAB = loadSeason().ab;
  const season = addToSeason(S.hits, S.ab, S.hr);
  const seasonAvg = fmtAvg(season.hits, season.ab);
  const $goSeason = document.getElementById('go-season');
  if ($goSeason) {
    $goSeason.textContent = `シーズン通算 ${seasonAvg}（${season.hits}安打/${season.ab}打数・本塁打${season.hr}・${season.games}試合）`;
  }

  // 投手の新規解放チェック(Phase4)
  const $goUnlock = document.getElementById('go-unlock-msg');
  if ($goUnlock) {
    const newlyUnlocked = PITCHERS.find(p => p.unlockAB > prevSeasonAB && p.unlockAB <= season.ab);
    $goUnlock.textContent = newlyUnlocked ? `🔓 新しい投手「${newlyUnlocked.name}」が解放されました！` : '';
  }

  // ゴースト比較(Phase4)
  const $goGhost = document.getElementById('go-ghost-result');
  if ($goGhost) {
    if (GHOST && GHOST.ab > 0) {
      const ghostAvg = GHOST.h / GHOST.ab;
      const myAvg = S.ab > 0 ? S.hits / S.ab : 0;
      if (myAvg > ghostAvg) $goGhost.textContent = `🏆 ゴースト（${fmtAvg(GHOST.h, GHOST.ab)}）に勝利！`;
      else if (myAvg === ghostAvg) $goGhost.textContent = `🤝 ゴースト（${fmtAvg(GHOST.h, GHOST.ab)}）と引き分け`;
      else $goGhost.textContent = `👻 ゴースト（${fmtAvg(GHOST.h, GHOST.ab)}）に一歩及ばず`;
    } else {
      $goGhost.textContent = '';
    }
  }

  // シェアボタンにコードを埋め込む(Phase4)
  const $shareBtn = document.getElementById('share-btn');
  if ($shareBtn) {
    const code = encodeGhost(S.hits, S.ab, S.hr);
    const tweetText = `SWING!で打率${avg}(H:${S.hits}/AB:${S.ab}/HR:${S.hr})を記録！\n合言葉「${code}」を破れるか？\nhttps://somirai.jp/swing/`;
    $shareBtn.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(tweetText);
  }

  if(typeof gtag === 'function') gtag('event', 'game_complete', { game: 'swing', hits: S.hits, ab: S.ab, hr: S.hr, pitcher: PITCHER_KEY });
  document.getElementById('gameover-screen').classList.remove('hidden');
}

// ── Reset & start ─────────────────────────────────────────────
function resetGame() {
  if (S.animId) cancelAnimationFrame(S.animId);
  if (S.timingAnimId) cancelAnimationFrame(S.timingAnimId);
  clearTimeout(S.judgeTimer);
  Object.assign(S, { phase:'ready', balls:0, strikes:0, outs:0, hits:0, ab:0, hr:0,
    pitch:null, swingTime:null, releaseTime:null, plateTime:null, judgeTimer:null,
    animId:null, timingAnimId:null, swung:false });
  $ball.style.display = 'none';
  $windupText.style.opacity = '0';
  clearResult();
  szState('');
  $timingMarker.style.display = 'none';
  $timingWindow.classList.remove('visible');
  $pitcher.className = '';
  updateCountDots();
  $lastPitch.textContent = '— 最初の投球を待て —';
  $pitchBadge.textContent = '';
  $timingHint.textContent = 'ボールを待て…';
}

// ── Event listeners ───────────────────────────────────────────
// 難易度ボタン
const DIFF_DESCS = {
  easy:   'ストレート・カーブのみ / タイミング広め',
  normal: '全4球種 / 標準タイミング',
  hard:   '全4球種 / タイミング厳しめ / 速い球',
  pro:    '全4球種 / タイミング最難 / 最速球',
};
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    DIFF_KEY = btn.dataset.diff;
    DIFF = DIFFICULTIES[DIFF_KEY];
    document.getElementById('diff-desc').textContent = DIFF_DESCS[DIFF_KEY];
  });
});
// 初期説明をふつうに設定
document.getElementById('diff-desc').textContent = DIFF_DESCS['normal'];

// ── 投手選択(Phase4) ─────────────────────────────────────────────
function renderPitcherSelector() {
  const season = loadSeason();
  const $wrap = document.getElementById('pitcher-selector');
  if (!$wrap) return;
  $wrap.innerHTML = '';
  PITCHERS.forEach(p => {
    const unlocked = season.ab >= p.unlockAB;
    const btn = document.createElement('button');
    btn.className = 'pitcher-btn' + (p.id === PITCHER_KEY ? ' active' : '') + (unlocked ? '' : ' locked');
    btn.disabled = !unlocked;
    btn.textContent = unlocked ? p.name : `🔒 ${p.name}（通算${p.unlockAB}打数で解放）`;
    if (unlocked) {
      btn.addEventListener('click', () => {
        PITCHER_KEY = p.id;
        renderPitcherSelector();
      });
    }
    $wrap.appendChild(btn);
  });
}
renderPitcherSelector();

// ── シーズン表示(Phase4) ─────────────────────────────────────────
function renderSeasonSummary() {
  const season = loadSeason();
  const $el = document.getElementById('season-summary');
  if (!$el) return;
  if (season.games > 0) {
    $el.textContent = `シーズン通算 ${fmtAvg(season.hits, season.ab)}（${season.games}試合・本塁打${season.hr}）`;
  } else {
    $el.textContent = 'シーズン記録なし（このゲームが1試合目です）';
  }
}
renderSeasonSummary();

document.getElementById('season-reset-btn')?.addEventListener('click', () => {
  if (confirm('シーズン記録をリセットしますか？投手の解放状況もリセットされます。')) {
    resetSeason();
    renderSeasonSummary();
    renderPitcherSelector();
  }
});

// ── ゴーストコード(Phase4) ───────────────────────────────────────
document.getElementById('ghost-set-btn')?.addEventListener('click', () => {
  const input = document.getElementById('ghost-input');
  const decoded = decodeGhost(input.value);
  const $status = document.getElementById('ghost-status');
  if (decoded) {
    GHOST = decoded;
    if ($status) $status.textContent = `🎯 目標セット: ${fmtAvg(decoded.h, decoded.ab)}（H:${decoded.h}/AB:${decoded.ab}/HR:${decoded.hr}）`;
  } else if (input.value.trim() === '') {
    GHOST = null;
    if ($status) $status.textContent = '';
  } else {
    if ($status) $status.textContent = '⚠️ 合言葉が正しくありません';
  }
});

document.getElementById('start-btn').addEventListener('click', () => {
  document.getElementById('start-screen').classList.add('hidden');
  resetGame();
  setTimeout(startPitch, 600);
});

document.getElementById('retry-btn').addEventListener('click', () => {
  document.getElementById('gameover-screen').classList.add('hidden');
  resetGame();
  setTimeout(startPitch, 400);
});

$swingBtn.addEventListener('click', doSwing);
$swingBtn.addEventListener('touchstart', e => { e.preventDefault(); doSwing(); }, { passive: false });

// Keyboard
document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    doSwing();
  }
});

// Prevent scroll on game field touch
$field.addEventListener('touchstart', e => { e.preventDefault(); doSwing(); }, { passive: false });
