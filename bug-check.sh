#!/bin/bash
# ============================================================
#  Somira Lab - サイトバグチェックスクリプト
#  使い方: bash bug-check.sh
#  対象: mirapp配下の全静的HTMLサイト
# ============================================================

PASS=0
FAIL=0
WARN=0
ERRORS=()
WARNS=()

ok()   { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL+1)); ERRORS+=("$1"); }
warn() { echo "  ⚠️  $1"; WARN=$((WARN+1)); WARNS+=("$1"); }

# ============================================================
#  個別サイトチェック
# ============================================================

check_html() {
  local file="$1"
  local label="$2"
  local expected_canonical="$3"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📄 $label"
  echo "   $file"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [ ! -f "$file" ]; then
    fail "ファイルが存在しない: $file"
    return
  fi

  # ── SEO必須項目 ──────────────────────────────────────────
  if grep -q 'name="description"' "$file"; then ok "meta description あり"; else fail "meta description なし"; fi
  if grep -q 'rel="canonical"'    "$file"; then ok "canonical あり";        else fail "canonical なし"; fi
  if grep -q 'og:title'           "$file"; then ok "og:title あり";         else fail "og:title なし"; fi
  if grep -q 'og:image'           "$file"; then ok "og:image あり";         else warn "og:image なし"; fi
  if grep -q 'twitter:card'       "$file"; then ok "twitter:card あり";     else warn "twitter:card なし"; fi
  if grep -q 'application/ld+json' "$file"; then ok "JSON-LD あり";         else warn "JSON-LD なし"; fi

  # ── アナリティクス・広告 ───────────────────────────────────
  if grep -q 'G-902VNDKEE9'            "$file"; then ok "GA4 あり";     else fail "GA4 なし"; fi
  if grep -q 'ca-pub-9485428408605916' "$file"; then ok "AdSense あり"; else warn "AdSense なし（任意）"; fi

  # ── Cookie同意バナー ──────────────────────────────────────
  if grep -q 'cookie_ok' "$file"; then ok "Cookieバナー あり"; else fail "Cookieバナー なし"; fi

  # ── プライバシーポリシーリンク ─────────────────────────────
  if grep -q 'privacy' "$file"; then ok "プライバシーポリシーリンク あり"; else warn "プライバシーポリシーリンク なし"; fi

  # ── viewport ─────────────────────────────────────────────
  if grep -q 'name="viewport"' "$file"; then ok "viewport あり"; else fail "viewport なし"; fi

  # ── script src の存在確認 ────────────────────────────────
  local dir
  dir=$(dirname "$file")
  local script_srcs
  script_srcs=$(grep -oE '<script[^>]+>' "$file" | grep -oE 'src="[^"]+"' | sed 's/src="//;s/"$//')
  local missing_scripts=0
  while IFS= read -r src; do
    [[ "$src" == http* ]] && continue
    [[ -z "$src" ]] && continue
    if [ ! -f "$dir/$src" ]; then
      fail "script src が存在しない: $src"
      missing_scripts=$((missing_scripts+1))
    fi
  done <<< "$script_srcs"
  [ "$missing_scripts" -eq 0 ] && ok "全script srcファイル存在確認OK"

  # ── 矛盾チェック ─────────────────────────────────────────
  echo "  [矛盾チェック]"

  # canonical と og:url の一致
  local canonical ogurl
  canonical=$(grep -oE 'canonical" href="[^"]+' "$file" | sed 's/canonical" href="//')
  ogurl=$(grep -oE 'og:url" content="[^"]+' "$file" | sed 's/og:url" content="//')
  if [ -n "$canonical" ] && [ -n "$ogurl" ]; then
    if [ "$canonical" = "$ogurl" ]; then
      ok "canonical と og:url が一致 ($canonical)"
    else
      fail "canonical と og:url が不一致: canonical=$canonical / og:url=$ogurl"
    fi
  fi

  # <title> と og:title の類似性（片方だけ存在チェック）
  local title ogtitle
  title=$(grep -oE '<title>[^<]+</title>' "$file" | sed 's/<title>//;s/<\/title>//')
  ogtitle=$(grep -oE 'og:title" content="[^"]+' "$file" | sed 's/og:title" content="//')
  if [ -n "$title" ] && [ -n "$ogtitle" ]; then
    ok "title あり: $title"
    ok "og:title あり: $ogtitle"
  fi

  # OGP画像のURL確認（統一されているか）
  local ogimage
  ogimage=$(grep -oE 'og:image" content="[^"]+' "$file" | sed 's/og:image" content="//')
  if [ -n "$ogimage" ]; then
    if echo "$ogimage" | grep -q 'somirai.jp/icons/ogp.png'; then
      ok "OGP画像: somirai.jp/icons/ogp.png (統一OK)"
    else
      warn "OGP画像が標準パスと異なる: $ogimage"
    fi
  fi

  # copyright年の確認
  if grep -q '2026' "$file"; then
    ok "copyright年 2026 あり"
  else
    warn "copyright年が見当たらない（更新が必要かも）"
  fi

  # 期待するcanonicalと実際のcanonicalの一致
  if [ -n "$expected_canonical" ] && [ -n "$canonical" ]; then
    if [ "$canonical" = "$expected_canonical" ]; then
      ok "canonical URL が期待値と一致"
    else
      fail "canonical URL が期待値と不一致: 期待=$expected_canonical / 実際=$canonical"
    fi
  fi
}

check_nextjs() {
  local out_dir="$1"
  local label="$2"
  local expected_canonical="$3"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "⚛️  $label (Next.js)"
  echo "   $out_dir"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  local idx="$out_dir/index.html"
  if [ -f "$idx" ]; then ok "index.html あり"; else fail "index.html なし"; fi
  if [ -f "$out_dir/404.html" ] || [ -f "$out_dir/404/index.html" ]; then
    ok "404ページ あり"
  else
    warn "404ページ なし"
  fi
  if [ -f "$out_dir/privacy.html" ]; then
    ok "privacy.html あり"
  else
    warn "privacy.html なし（/write/privacy.html等で共有の場合は問題なし）"
  fi

  if [ -f "$idx" ]; then
    if grep -q 'G-902VNDKEE9'            "$idx"; then ok "GA4 あり";          else fail "GA4 なし"; fi
    if grep -q 'ca-pub-9485428408605916' "$idx"; then ok "AdSense あり";      else warn "AdSense なし"; fi
    if grep -q 'cookie_ok'               "$idx"; then ok "Cookieバナー あり"; else fail "Cookieバナー なし"; fi

    # ── 矛盾チェック ──────────────────────────────────────
    echo "  [矛盾チェック]"

    local canonical ogurl
    canonical=$(grep -oE 'canonical" href="[^"]+' "$idx" | sed 's/canonical" href="//')
    ogurl=$(grep -oE 'og:url" content="[^"]+' "$idx" | sed 's/og:url" content="//')
    if [ -n "$canonical" ] && [ -n "$ogurl" ]; then
      if [ "$canonical" = "$ogurl" ]; then
        ok "canonical と og:url が一致"
      else
        fail "canonical と og:url が不一致: canonical=$canonical / og:url=$ogurl"
      fi
    elif [ -z "$ogurl" ]; then
      warn "og:url が見当たらない"
    fi

    local ogimage
    ogimage=$(grep -oE 'og:image" content="[^"]+' "$idx" | sed 's/og:image" content="//')
    if [ -n "$ogimage" ]; then
      if echo "$ogimage" | grep -q 'somirai.jp'; then
        ok "OGP画像: somirai.jp ドメイン (OK)"
      else
        warn "OGP画像ドメインが somirai.jp でない: $ogimage"
      fi
    else
      warn "OGP画像が設定されていない"
    fi

    if [ -n "$expected_canonical" ] && [ -n "$canonical" ]; then
      if [ "$canonical" = "$expected_canonical" ]; then
        ok "canonical URL が期待値と一致"
      else
        fail "canonical URL が期待値と不一致: 期待=$expected_canonical / 実際=$canonical"
      fi
    fi

    # copyright はソースで管理されJSバンドルに含まれるため静的HTML検査はスキップ
    ok "copyright: ソースファイルで管理（JSバンドル内に含まれる）"
  fi
}

# ============================================================
#  横断的な矛盾チェック
# ============================================================

cross_check() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔍 横断矛盾チェック（全サイト共通設定）"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  local BASE="$1"
  local HTML_FILES=(
    "$BASE/index.html"
    "$BASE/batting-stats/index.html"
    "$BASE/order-maker/index.html"
    "$BASE/habit/index.html"
    "$BASE/write/index.html"
    "$BASE/savings/index.html"
  )
  local LABELS=("トップ" "batting-stats" "order-maker" "habit" "write" "savings")

  local all_ok=1

  # GA4 IDが全サイトで統一されているか
  echo ""
  echo "  [GA4 ID 統一チェック]"
  local ga_ids=()
  for f in "${HTML_FILES[@]}"; do
    [ -f "$f" ] || continue
    local id
    id=$(grep -oE 'G-[A-Z0-9]+' "$f" | head -1)
    ga_ids+=("$id")
  done
  local first_ga="${ga_ids[0]}"
  local ga_ok=1
  for i in "${!ga_ids[@]}"; do
    if [ "${ga_ids[$i]}" != "$first_ga" ]; then
      fail "GA4 IDが不一致: ${LABELS[$i]} = ${ga_ids[$i]} (期待値: $first_ga)"
      ga_ok=0; all_ok=0
    fi
  done
  [ "$ga_ok" -eq 1 ] && ok "GA4 ID 全サイト統一: $first_ga"

  # AdSense publisher IDが統一されているか
  echo ""
  echo "  [AdSense publisher ID 統一チェック]"
  local pub_ids=()
  for f in "${HTML_FILES[@]}"; do
    [ -f "$f" ] || continue
    local id
    id=$(grep -oE 'ca-pub-[0-9]+' "$f" | head -1)
    pub_ids+=("${id:-なし}")
  done
  local first_pub="${pub_ids[0]}"
  local pub_ok=1
  for i in "${!pub_ids[@]}"; do
    if [ "${pub_ids[$i]}" != "$first_pub" ]; then
      fail "AdSense publisher IDが不一致: ${LABELS[$i]} = ${pub_ids[$i]} (期待値: $first_pub)"
      pub_ok=0; all_ok=0
    fi
  done
  [ "$pub_ok" -eq 1 ] && ok "AdSense publisher ID 全サイト統一: $first_pub"

  # OGP画像が全サイトで統一されているか
  echo ""
  echo "  [OGP画像 統一チェック]"
  local ogp_imgs=()
  for f in "${HTML_FILES[@]}"; do
    [ -f "$f" ] || continue
    local img
    img=$(grep -oE 'og:image" content="[^"]+' "$f" | sed 's/og:image" content="//' | head -1)
    ogp_imgs+=("${img:-なし}")
  done
  local first_ogp="${ogp_imgs[0]}"
  local ogp_ok=1
  for i in "${!ogp_ids[@]}"; do
    if [ "${ogp_imgs[$i]}" != "$first_ogp" ]; then
      warn "OGP画像が異なる: ${LABELS[$i]} = ${ogp_imgs[$i]}"
      ogp_ok=0
    fi
  done
  [ "$ogp_ok" -eq 1 ] && ok "OGP画像 全サイト統一"

  # copyright年の統一チェック（Next.jsはソース確認、静的HTMLは直接確認）
  echo ""
  echo "  [Copyright年 統一チェック]"
  local NEXTJS_SOURCES=(
    "/Users/makabemirai/habit-quest/src/app/page.tsx"
    "/Users/makabemirai/write-quest/src/app/page.tsx"
    "/Users/makabemirai/savings-quest/src/app/page.tsx"
  )
  local NEXTJS_LABELS=("habit" "write" "savings")
  local year_ok=1

  # 静的HTMLのみ直接確認（トップ・batting-stats・order-maker）
  for i in 0 1 2; do
    local f="${HTML_FILES[$i]}"
    [ -f "$f" ] || continue
    if ! grep -q '2026' "$f"; then
      fail "copyright年 2026 なし: ${LABELS[$i]}"
      year_ok=0
    fi
  done

  # Next.jsはソースファイルで確認（ビルド済みHTMLには入らないため）
  for i in "${!NEXTJS_SOURCES[@]}"; do
    local src="${NEXTJS_SOURCES[$i]}"
    if [ -f "$src" ]; then
      if grep -q '2026' "$src"; then
        ok "Copyright 2026 確認OK（ソース）: ${NEXTJS_LABELS[$i]}"
      else
        warn "copyright年 2026 がソースにない: ${NEXTJS_LABELS[$i]}"
        year_ok=0
      fi
    fi
  done
  [ "$year_ok" -eq 1 ] && ok "Copyright年 2026 全サイト確認OK"

  # プライバシーポリシーURLの形式確認
  echo ""
  echo "  [プライバシーポリシーリンク形式チェック]"
  for i in "${!HTML_FILES[@]}"; do
    local f="${HTML_FILES[$i]}"
    [ -f "$f" ] || continue
    local pp_link
    pp_link=$(grep -oE 'href="[^"]*privacy[^"]*"' "$f" | head -1)
    if [ -n "$pp_link" ]; then
      ok "${LABELS[$i]}: $pp_link"
    else
      warn "${LABELS[$i]}: プライバシーポリシーリンクなし"
    fi
  done
}

# ============================================================
#  チェック実行
# ============================================================

BASE="/Users/makabemirai/mirapp"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Somira Lab バグチェック $(date '+%Y-%m-%d %H:%M')   ║"
echo "╚══════════════════════════════════════════╝"

check_html "$BASE/index.html"               "somirai.jp トップ"    "https://somirai.jp/"
check_html "$BASE/batting-stats/index.html" "My Batting Stats"     "https://somirai.jp/batting-stats/"
check_html "$BASE/order-maker/index.html"   "スタメンメーカー"       "https://somirai.jp/order-maker/"
check_nextjs "$BASE/habit"                  "Habit Quest"          "https://somirai.jp/habit/"
check_nextjs "$BASE/write"                  "Write Quest"          "https://somirai.jp/write/"
check_nextjs "$BASE/savings"               "節約クエスト"           "https://somirai.jp/savings/"

cross_check "$BASE"

# ── sitemap確認 ─────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🗺️  sitemap.xml チェック"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
SITEMAP="$BASE/sitemap.xml"
if [ -f "$SITEMAP" ]; then
  for path in "" "batting-stats/" "order-maker/" "habit/" "write/" "savings/"; do
    if grep -q "somirai.jp/${path}" "$SITEMAP"; then
      ok "sitemap: somirai.jp/${path:-（トップ）}"
    else
      fail "sitemap: somirai.jp/${path} が未登録"
    fi
  done
else
  fail "sitemap.xml が存在しない"
fi

# ── 結果サマリー ────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║              チェック結果                ║"
echo "╠══════════════════════════════════════════╣"
printf  "║  ✅ PASS: %-3d  ⚠️  WARN: %-3d  ❌ FAIL: %-3d ║\n" $PASS $WARN $FAIL
echo "╚══════════════════════════════════════════╝"

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo ""
  echo "❌ 要修正リスト:"
  for e in "${ERRORS[@]}"; do
    echo "   • $e"
  done
fi

if [ ${#WARNS[@]} -gt 0 ]; then
  echo ""
  echo "⚠️  警告リスト（任意対応）:"
  for w in "${WARNS[@]}"; do
    echo "   • $w"
  done
fi

if [ "$FAIL" -eq 0 ]; then
  echo ""
  echo "🎉 重大なバグなし！"
  exit 0
else
  echo ""
  echo "上記の ❌ 項目を修正してください。"
  exit 1
fi
