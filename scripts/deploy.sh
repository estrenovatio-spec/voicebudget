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
echo "→ Сборка..."
npm run build
echo "→ Деплой на production (vercel)..."
npx vercel --prod "$@"
