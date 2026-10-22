#!/usr/bin/env bash
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Necesitas instalar Node.js 22.22 o superior: https://nodejs.org"
  exit 1
fi

exec node scripts/runLocal.js
