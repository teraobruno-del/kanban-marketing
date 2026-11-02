#!/usr/bin/env bash
# Teste completo no navegador (e2e), com Supabase de mentirinha e banco local.
# Uso: bash e2e/run.sh            (monta o site, roda o roteiro e desliga tudo)
#      bash e2e/run.sh --keep     (deixa o site em http://localhost:3000 ligado ao final)
#      bash e2e/run.sh --stop     (só desliga os servidores de teste)
#      SKIP_BUILD=1 bash e2e/run.sh   (reaproveita a última montagem)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=e2e/out; mkdir -p "$OUT"
export DATABASE_URL=postgresql://kanban:kanban@localhost:5432/kanban_e2e
export DIRECT_URL=$DATABASE_URL
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fake-public
export SUPABASE_SECRET_KEY=fake-secret
export INITIAL_ADMIN_EMAIL=chefe@empresa.com
export INITIAL_ADMIN_PASSWORD=senha-inicial-123

# Desliga os servidores de teste pelo número do processo (guardado ao ligar).
stop() {
  for f in "$OUT/app.pid" "$OUT/fake.pid"; do
    [ -f "$f" ] && { pkill -P "$(cat "$f")" 2>/dev/null || true; kill "$(cat "$f")" 2>/dev/null || true; rm -f "$f"; }
  done
  # garante que não sobrou servidor de uma execução antiga (processo "next-server" órfão)
  for pid in $(ps -eo pid,comm | awk '$2 == "next-server" {print $1}'); do kill "$pid" 2>/dev/null || true; done
  for port in 3000 54321; do
    for pid in $(lsof -t -iTCP:$port -sTCP:LISTEN 2>/dev/null); do kill "$pid" 2>/dev/null || true; done
  done
}
stop; sleep 1
[ "${1:-}" = "--stop" ] && exit 0
TEST_DATABASE_URL=$DATABASE_URL bash scripts/test-db-setup.sh >/dev/null
[ "${SKIP_BUILD:-}" = "1" ] || npx next build >"$OUT/build.log" 2>&1 || { tail -30 "$OUT/build.log"; exit 1; }
nohup node e2e/fake-supabase.mjs >"$OUT/fake.log" 2>&1 & echo $! >"$OUT/fake.pid"
nohup node_modules/.bin/next start -p 3000 >"$OUT/server.log" 2>&1 & echo $! >"$OUT/app.pid"
for _ in $(seq 1 40); do curl -s -o /dev/null localhost:3000/login && break; sleep 1; done
status=0
node e2e/flow.cjs || status=$?
[ "${1:-}" = "--keep" ] || stop
exit $status
