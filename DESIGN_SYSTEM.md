# Somira Lab — デザインシステム
> 作成日: 2026-04-17 | 担当: designer エージェント
> **このドキュメントは全アプリの設計基準。新機能・リデザイン時は必ずここを参照すること。**

---

## 1. デザイン哲学

### コアコンセプト
**「ゲーム感 × ミニマリズム」の両立**

競合との空白地帯：
- Habitica/Duolingo → RPG感はあるが「重い・ごちゃごちゃ」
- Streaks/Bear      → シンプルだが「ゲーム感ゼロ」
- **Somira Lab**    → ゲーム感はあるが「洗練されていて軽い」← ここが独自性

### 5つの原則

| 原則 | 意味 | 実装例 |
|------|------|--------|
| **1. 数字を主役に** | 最重要指標は画面の中心に大きく | ヒーローゾーンの進捗% |
| **2. 余白で語る** | 線で区切らず余白で区切る | セクション間: 20〜32px |
| **3. 完了の喜びを演出** | タップした瞬間に「やった！」を伝える | checkPop アニメーション |
| **4. 情報の階層を3段に** | 見出し/本文/補足 の3段のみ | フォントサイズ体系参照 |
| **5. ダークファースト** | ダークテーマを主として設計し、ライトを派生 | Void/Ink が基準テーマ |

### やってはいけないこと（禁止リスト）

```
❌ 絵文字をボタンアイコンに使う → SVGに統一
❌ border-radius を 8px 以下にする → 最低 12px
❌ セクション区切りに水平線を多用する → 余白で区切る
❌ グレー背景に白カード → 量産型SaaSに見える
❌ フォントサイズが 12〜14px に集中 → 階層を使う
❌ 完了・成功の色を必ず緑にする → アクセントカラーを使う
❌ モーダルのオーバーレイが rgba(0,0,0,0.3) → 最低 0.55
❌ ボタンを角丸四角だけに統一 → 円形・ピル型を使い分ける
```

---

## 2. カラーシステム

### 基本構造（全アプリ共通トークン名）

```
bg          — 最背面（ページ背景）
surface     — カード・パネルの背景
surfaceAlt  — インプット・ボタン背景・ホバー時
border      — 枠線・セパレーター
text        — 本文テキスト
textSec     — サブテキスト
textMut     — 補足テキスト・ラベル
accent      — アクセント（CTA・アクティブ状態）
accentSoft  — アクセントの薄い背景（accent + "1a"）
```

### 推奨テーマ（デフォルト優先順）

#### 🖤 Void（habit-quest デフォルト）— 最高没入感
```
bg:      #080b10    surface: #0e1420    surfaceAlt: #141c2e
border:  #1c2537    text:    #e2e8f0    textSec:    #94a3b8
textMut: #475569    accent:  #3b82f6
```

#### 🖊 Ink（write-quest デフォルト）— シンプル＆スマート
```
bg:      #0d1117    surface: #161b22    surfaceAlt: #21262d
border:  #30363d    text:    #e6edf3    textSec:    #8b949e
textMut: #484f58    accent:  #58a6ff
```

#### 🌿 Forest（savings-quest 推奨）— 自然×ゲーム
```
bg:      #080e0c    surface: #0d1a14    surfaceAlt: #142010
border:  #163020    text:    #ecfdf5    textSec:    #86efac
textMut: #4ade80    accent:  #10b981
```

#### ⚾ Dark Green（batting-stats 推奨）— スポーツ×プロ
```
bg:      #0a0f0a    surface: #111a11    surfaceAlt: #182018
border:  #1e2e1e    text:    #f0fdf4    textSec:    #86efac
textMut: #4ade80    accent:  #22c55e
```

### アクセントグラデーション

単色より2色グラデーションを積極的に使う。

```css
/* ボタン・ヒーロー要素 */
background: linear-gradient(135deg, {accent}, {accent}cc);

/* XPバー */
background: linear-gradient(90deg, {accent}, {accent}99);

/* ヒーローゾーン（完了時） */
background: linear-gradient(135deg, {accent}22, {accent}08);
```

---

## 3. タイポグラフィ

### フォント
```
本文・UI:  'DM Sans', 'Noto Sans JP', sans-serif
数字・コード: 'JetBrains Mono', monospace
```

### サイズ階層（3段ルール）

| 用途 | サイズ | Weight | 使用例 |
|------|--------|--------|--------|
| **ヒーロー数字** | 48〜64px | 700 | 進捗%・ストリーク数 |
| **大見出し** | 20〜24px | 700 | モーダルタイトル |
| **中見出し** | 16〜18px | 600 | セクションヘッダー |
| **本文** | 14px | 400〜500 | メモ・説明 |
| **補足** | 11〜12px | 400 | 時刻・ラベル |
| **極小** | 10px | 400〜600 | バッジ・タグ |

### 行間
```
本文テキスト: line-height: 1.75 (leading-7)
見出し:       line-height: 1.2
補足ラベル:   line-height: 1.4
```

### 文字間隔
```
セクションラベル:  letter-spacing: 0.07em (大文字化不要)
タブラベル:        letter-spacing: 0.04em
本文:              letter-spacing: normal
```

---

## 4. スペーシング

### ルール
```
コンテンツ最大幅: max-w-2xl (672px)
ページ左右余白:   px-4 (16px)
カード内余白:     p-5 (20px) — 最小 p-4 (16px)
セクション間:     mb-5 (20px) or mb-8 (32px)
要素間（密）:     gap-2 (8px)
要素間（標準）:   gap-3 (12px)
要素間（広）:     gap-4 (16px)
```

### 角丸
```
カード・パネル:     border-radius: 16px (rounded-2xl)
ボタン（通常）:     border-radius: 12px (rounded-xl)
ボタン（コンパクト）: border-radius: 8px (rounded-lg)
ピルバッジ:         border-radius: 9999px (rounded-full)
完了ボタン（円形）:  border-radius: 50%
```

---

## 5. コンポーネント仕様

### 5-1. カード

```
/* 基本カード */
background: tokens.surface
border: 1px solid tokens.border
border-radius: 16px
padding: 20px

/* アクティブ/完了カード */
background: {catColor}0d   /* カテゴリカラー 5%透明 */
border: 1px solid {catColor}33
border-left: 3px solid {catColor}  /* カテゴリを左ボーダーで表現 */

/* ヒーローカード（グラデーション）*/
background: linear-gradient(135deg, tokens.surface, tokens.surfaceAlt)
border: 1px solid tokens.border
border-radius: 16px
padding: 20px
```

### 5-2. ボタン

```
/* プライマリ（完了・投稿・送信）*/
background: linear-gradient(135deg, accent, accent+cc)
color: #fff または bg
border-radius: 12px
padding: 14px 24px
font-weight: 600
active: scale(0.95)

/* 丸型完了ボタン（習慣カード）*/
width: 48px / height: 48px
border-radius: 50%
background（未完了）: surfaceAlt / border: 2px solid border
background（完了）:   linear-gradient(135deg, catColor, catColor+cc)
box-shadow（完了）:   0 4px 16px catColor+44
active: scale(0.90)

/* アイコンボタン（ヘッダー）*/
width: 32px / height: 32px
border-radius: 8px
color: textSec
active: scale(0.90) / hover: opacity 0.7

/* セカンダリ */
background: surfaceAlt
border: 1px solid border
border-radius: 12px
color: textSec
```

### 5-3. 入力欄

```
background: transparent（カード内）または inputBg
border: 1px solid border
border-radius: 12px
padding: 12px 16px
font-size: 14px
line-height: 1.75
focus: border-color → accent（アウトラインなし、borderのみ変化）
```

### 5-4. プログレスバー

```
/* XPバー（ヘッダー）*/
height: 1px
background（トラック）: border
background（塗り）: linear-gradient(90deg, accent, accent+99)
border-radius: 9999px

/* カテゴリバー（カード内）*/
height: 4px
background（トラック）: border
background（塗り）: catColor
border-radius: 9999px
width: 56px（固定）

/* 進捗リング（ヒーロー）*/
size: 88〜120px
strokeWidth: 7px
color: accent / trackColor: border
```

### 5-5. バッジ・タグ

```
/* カテゴリタグ */
background: catColor+18
color: catColor
border-radius: 9999px
padding: 2px 8px
font-size: 10px
font-weight: 600

/* レベルバッジ */
background: surfaceAlt
border: 1px solid border
border-radius: 8px
padding: 4px 10px
font-family: mono
color: accent
```

### 5-6. タブナビゲーション

```
/* タブバー */
border-bottom: 1px solid border
padding: 0 16px

/* タブボタン */
flex: 1
SVGアイコン: 16×16px
ラベル: 10px / letter-spacing: 0.04em
color（非アクティブ）: textMut
color（アクティブ）: accent

/* アクティブインジケーター */
position: absolute, bottom: 0
width: 24px / height: 2px
border-radius: 9999px
background: accent
```

### 5-7. ヘッダー

```
/* 構造 */
sticky top-0 / z-index: 40
padding: safe-area-top + 12px → 8px below
border-bottom: 1px solid border

/* コンテンツ */
左: ワードマーク(14px bold) + サブテキスト(12px textMut)
右: レベルバッジ + SVGアイコンボタン群

/* XPバー */
height: 1px（極細）
margin-top: 8px
```

### 5-8. ヒーローゾーン

```
/* 全アプリ共通パターン */
border-radius: 16px
padding: 20px
margin-bottom: 20px
background: linear-gradient(135deg, surface, surfaceAlt)
border: 1px solid border

/* 完了・達成時 */
background: linear-gradient(135deg, accent+22, accent+08)
border-color: accent+44

/* 内部構造 */
- 大型数字 or プログレスリング（左）
- サブ情報テキスト（左下）
- ストリーク/レベルカード（右）
- カテゴリ進捗バー（底部、セパレーター後）
```

### 5-9. セクションヘッダー

```
/* ラインセパレーター付き */
<div className="flex items-center gap-3 mb-3">
  <span style={{ color: tokens.textMut, fontSize: 11, letterSpacing: "0.07em" }}>
    セクション名
  </span>
  <div style={{ flex: 1, height: 1, background: tokens.border }} />
</div>
```

### 5-10. 空状態（EmptyState）

```
/* 中央配置 */
padding-top: 64px
text-align: center

/* 構造 */
- アイコン/絵文字: 48px / opacity: 0.4
- メインメッセージ: 16px / textSec
- サブメッセージ: 13px / textMut
- CTAボタン（任意）
```

---

## 6. アニメーション

### 定義

```css
/* 登場 */
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* 出現（モーダル・バッジ）*/
@keyframes popIn {
  0%   { transform: scale(0.7); opacity: 0; }
  60%  { transform: scale(1.1); }
  100% { transform: scale(1);   opacity: 1; }
}

/* 完了チェック */
@keyframes checkPop {
  0%   { transform: scale(0.6); }
  50%  { transform: scale(1.25); }
  100% { transform: scale(1); }
}

/* グロウパルス（強調） */
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(accent, 0); }
  50%       { box-shadow: 0 0 0 8px rgba(accent, 0.15); }
}
```

### 使い分け

| 場面 | アニメーション | duration |
|------|--------------|----------|
| カード・ページ登場 | fadeSlideUp | 0.35s ease |
| モーダル・バッジ出現 | popIn | 0.4s cubic-bezier |
| 習慣・ToDo完了時 | checkPop | 0.3s cubic-bezier |
| 達成ボタン強調 | glowPulse | 2s infinite |
| XPバー塗り | transition width | 0.7s ease |
| テーマ切り替え | transition bg/color | 0.3s ease |

### ルール
```
✅ active時は必ず scale(0.90〜0.95)
✅ transition-all は使わない → 個別指定
✅ アニメーション時間は最大 0.5s（重く見えない）
✅ reducedMotion 対応は将来対応（現状は省略）
```

---

## 7. レイアウトパターン

### 全アプリ共通構造

```
┌─────────────────────────────────┐
│  Header（sticky）                │ ← 最小限・SVGアイコン
│  XPバー 1px                      │
├─────────────────────────────────┤
│  TabNav                          │ ← SVGアイコン + ラベル
├─────────────────────────────────┤
│  main（スクロール領域）           │
│  ┌───────────────────────────┐  │
│  │  ヒーローゾーン             │  │ ← 最重要指標を大きく
│  └───────────────────────────┘  │
│                                  │
│  ── セクションA ────────────    │
│  カード群                        │
│                                  │
│  ── セクションB ────────────    │
│  カード群                        │
│                                  │
├─────────────────────────────────┤
│  Footer（クロスツールリンク）      │
└─────────────────────────────────┘
```

---

## 8. アプリ別アイデンティティ

各アプリはデザインシステムを共有しつつ、カラーと世界観で差別化する。

| アプリ | テーマ | アクセント | 世界観 |
|--------|--------|-----------|--------|
| habit-quest | Void | #3b82f6 青 | RPG・冒険・強さ |
| write-quest | Ink | #58a6ff 明るい青 | 知性・静寂・記録 |
| savings-quest | Forest | #10b981 緑 | 成長・豊かさ・自然 |
| batting-stats | Dark Green | #22c55e 緑 | スポーツ・データ・プロ |
| order-maker | Dark | #f0a855 アンバー | チーム・戦略・野球 |

---

## 9. 各アプリのリデザイン優先度

| アプリ | 状態 | 優先度 | 主な課題 |
|--------|------|--------|---------|
| habit-quest | ✅ リデザイン済み | — | 完了 |
| write-quest | ✅ リデザイン済み | — | 完了 |
| savings-quest | 🟡 部分的 | 高 | ヒーローゾーン未実装・テーマ刷新 |
| batting-stats | 🔴 旧デザイン | 高 | 統計ヒーロー・カード改善 |
| order-maker | 🔴 旧デザイン | 中 | 余白・タイポグラフィ改善 |

---

## 10. 実装チェックリスト

新しいコンポーネントを作る際に確認すること：

```
□ border-radius は 12px 以上か
□ ボタンに active:scale-90〜95 があるか
□ アイコンは SVG か（絵文字ではないか）
□ フォントサイズは3段階(見出し/本文/補足)か
□ セクション区切りは余白ベースか（線多用していないか）
□ 完了・アクション時にアニメーションがあるか
□ ダークテーマで視認性は確保されているか（コントラスト）
□ タップターゲットは最低 44px か
□ モバイルで左右余白 16px 確保されているか
□ 空状態のデザインはあるか
```

---

*Somira Lab designer エージェント作成 — 2026-04-17*
