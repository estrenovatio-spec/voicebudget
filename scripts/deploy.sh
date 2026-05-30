#!/usr/bin/env bash
# Деплой на Vercel. Node берётся из voicebudget/.node/bin — глобальный npm не нужен.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$ROOT/.node/bin:$PATH"

cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node не найден в $ROOT/.node/bin"
  echo "   Скачайте Node с https://nodejs.org или выполните в терминале:"
  echo "   export PATH=\"$ROOT/.node/bin:\$PATH\""
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "❌ npx не найден. Проверьте папку .node в проекте."
  exit 1
fi

echo "→ Node: $(node -v) ($(command -v node))"
echo "→ Сборка (локально)..."
npm run build
echo "→ Vercel build (prebuilt)..."
npx vercel build --prod --yes
echo "→ Деплой на production (prebuilt, без ожидания CLI)..."
OUT="$(npx vercel deploy --prebuilt --prod --yes --no-wait 2>&1)"
echo "$OUT"
INSPECT="$(echo "$OUT" | sed -n 's/.*Inspect[[:space:]]*\(.*\)/\1/p' | head -1)"
if echo "$OUT" | grep -q 'BLOCKED'; then
  echo ""
  echo "⚠️  Vercel вернул BLOCKED — новая версия НЕ вышла в production."
  echo "   Откройте панель: https://vercel.com/renovatio-s-projects/voicebudget"
  echo "   Проверьте: Billing, Deployment Protection, лимиты Hobby."
  echo "   Застрявшие деплои: npx vercel ls voicebudget --prod"
  exit 1
fi
if [[ -n "${INSPECT:-}" ]]; then
  echo ""
  echo "→ Статус: $INSPECT"
  echo "   Production: https://voicebudget.vercel.app"
fi
