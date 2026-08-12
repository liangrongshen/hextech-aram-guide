#!/usr/bin/env bash
# 海克斯出装助手 · 本地定时更新脚本
# 用法：
#   ./update.sh          # 全量更新（列表 + 符文表 + 172 英雄详情，约 5 分钟）
#   ./update.sh quick    # 快速更新（仅列表 + 符文表，约 5 秒）
set -euo pipefail

cd "$(dirname "$0")"

PYTHON="${PYTHON:-python3}"
OUT="${DATA_JS:-../js/data.js}"

echo "==> 检查依赖 ..."
if ! "$PYTHON" -c "import requests, bs4" 2>/dev/null; then
  echo "    安装依赖: pip install -r requirements.txt"
  "$PYTHON" -m pip install -r requirements.txt --break-system-packages
fi

if [[ "${1:-}" == "quick" ]]; then
  echo "==> 快速更新（列表 + 符文表）..."
  "$PYTHON" scraper.py --augments-only --out "$OUT"
else
  echo "==> 全量更新 ..."
  "$PYTHON" scraper.py --out "$OUT"
fi

echo "==> 校验 data.js 语法 ..."
if command -v node >/dev/null 2>&1; then
  node --check "$OUT"
fi
echo "==> 完成"
