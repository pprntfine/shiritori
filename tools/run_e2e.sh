#!/usr/bin/env bash
# 2台の送受信テストを動かす。中継所（worker）を手元の wrangler dev（https:443）で立てて、
# chromium 2台を「zatsugaku-push.pprnt908.workers.dev → 127.0.0.1」に向ける。ntfy.sh・公開MQTT はふさぐ。
# 使い方: bash tools/run_e2e.sh tools/e2e/relay_basic.js
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST="${1:?テストのファイルを指定してください}"
WORK="${TMPDIR:-/tmp}/zg-e2e"
mkdir -p "$WORK"
python3 "$ROOT/tools/make_test.py" "$ROOT/index.html" "$WORK/app" >/dev/null
DEPS="$ROOT/tools/deps"
if [ ! -x "$DEPS/node_modules/.bin/wrangler" ]; then
  mkdir -p "$DEPS" && (cd "$DEPS" && echo '{"name":"zg-tools-deps","private":true}' > package.json && npm i wrangler@3 >/dev/null)
fi
(cd "$ROOT/worker" && CI=1 WRANGLER_SEND_METRICS=false "$DEPS/node_modules/.bin/wrangler" dev --port 443 --ip 127.0.0.1 --local-protocol https > "$WORK/wrangler.log" 2>&1 &)
for i in $(seq 1 40); do curl -sk https://127.0.0.1/ >/dev/null && break; sleep 1; done
set +e
env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy node "$ROOT/$TEST" "$WORK/app"
code=$?
pkill -f "wrangler dev" || true
exit $code
