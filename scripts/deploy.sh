#!/usr/bin/env bash
# Деплой на Vercel — использует Node из папки проекта (не нужен глобальный npx)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$ROOT/.node/bin:$PATH"

if ! command -v npx >/dev/null 2>&1; then
  echo "Node не найден. Установите Node.js: https://nodejs.org"
  echo "Или в Cursor: Terminal → cd $ROOT"
  exit 1
fi

cd "$ROOT"
echo "→ Node: $(node -v)"
echo "→ Деплой на production..."
npx vercel --prod "$@"
