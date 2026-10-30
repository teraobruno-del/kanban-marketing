#!/usr/bin/env bash
# Cria (do zero) o banco local de testes de integração e aplica as migrações.
# Uso: TEST_DATABASE_URL=postgresql://kanban:kanban@localhost:5432/kanban_test bash scripts/test-db-setup.sh
set -euo pipefail
: "${TEST_DATABASE_URL:?Defina TEST_DATABASE_URL}"
ADMIN_URL="${TEST_DATABASE_URL%/*}/postgres"
DB_NAME="${TEST_DATABASE_URL##*/}"
psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE)" -c "CREATE DATABASE \"$DB_NAME\""
psql "$TEST_DATABASE_URL" -q -f "$(dirname "$0")/local-supabase-shim.sql"
DIRECT_URL="$TEST_DATABASE_URL" npx prisma migrate deploy >/dev/null
echo "Banco de testes pronto: $DB_NAME"
