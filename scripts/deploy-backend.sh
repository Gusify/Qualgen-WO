#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage:
  RG=... BACKEND_APP=... ACR=... MYSQL_SERVER=... MYSQL_DB=... MYSQL_ADMIN=... MYSQL_PASS=... \\
  ./scripts/deploy-backend.sh [BACKEND_TAG]

Optional env vars:
  BACKEND_IMAGE_REPO   default: qualgen-backend
  DB_HOST              default: <MYSQL_SERVER>.mysql.database.azure.com
  DB_PORT              default: 3306
  DB_USER_OVERRIDE     default: <MYSQL_ADMIN>
USAGE
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_var() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "Missing required env var: $name" >&2
    exit 1
  fi
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

if [ "$#" -gt 1 ]; then
  usage
  exit 1
fi

require_cmd az
require_cmd npm
require_cmd node
require_cmd curl

require_var RG
require_var BACKEND_APP
require_var ACR
require_var MYSQL_SERVER
require_var MYSQL_DB
require_var MYSQL_ADMIN
require_var MYSQL_PASS

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
BACKEND_IMAGE_REPO="${BACKEND_IMAGE_REPO:-qualgen-backend}"
BACKEND_TAG="${1:-${BACKEND_TAG:-$(date +%Y%m%d%H%M%S)}}"

echo "==> Resolving ACR login server"
ACR_SERVER="$(az acr show -g "$RG" -n "$ACR" --query loginServer -o tsv)"

echo "==> Building and pushing backend image: $ACR_SERVER/$BACKEND_IMAGE_REPO:$BACKEND_TAG"
az acr build -r "$ACR" -t "$BACKEND_IMAGE_REPO:$BACKEND_TAG" "$BACKEND_DIR"

echo "==> Updating backend container app image"
az containerapp update \
  -g "$RG" -n "$BACKEND_APP" \
  --image "$ACR_SERVER/$BACKEND_IMAGE_REPO:$BACKEND_TAG" >/dev/null

echo "==> Building backend locally for migration runner"
cd "$BACKEND_DIR"
npm run build >/dev/null

echo "==> Running database migrations"
export DB_HOST="${DB_HOST:-$MYSQL_SERVER.mysql.database.azure.com}"
export DB_PORT="${DB_PORT:-3306}"
export DB_NAME="$MYSQL_DB"
export DB_PASSWORD="$MYSQL_PASS"
export NODE_ENV=production

PRIMARY_DB_USER="${DB_USER_OVERRIDE:-$MYSQL_ADMIN}"
export DB_USER="$PRIMARY_DB_USER"

if ! node dist/migrate.js; then
  if [[ "$PRIMARY_DB_USER" != *"@"* ]]; then
    FALLBACK_DB_USER="${MYSQL_ADMIN}@${MYSQL_SERVER}"
    echo "Migration failed with DB_USER=$PRIMARY_DB_USER; retrying with DB_USER=$FALLBACK_DB_USER"
    export DB_USER="$FALLBACK_DB_USER"
    node dist/migrate.js
  else
    exit 1
  fi
fi

echo "==> Enforcing production migration-only startup settings"
az containerapp update \
  -g "$RG" -n "$BACKEND_APP" \
  --set-env-vars NODE_ENV=production DB_SYNC=false DB_SYNC_ALTER=false >/dev/null

echo "==> Verifying backend health"
BACKEND_FQDN="$(az containerapp show -g "$RG" -n "$BACKEND_APP" --query properties.configuration.ingress.fqdn -o tsv)"
HEALTH_RESPONSE="$(curl -fsS "https://$BACKEND_FQDN/api/health")"

echo "Health response: $HEALTH_RESPONSE"

echo "==> Effective runtime env flags"
az containerapp show -g "$RG" -n "$BACKEND_APP" \
  --query "properties.template.containers[0].env[?name=='NODE_ENV' || name=='DB_SYNC' || name=='DB_SYNC_ALTER']" \
  -o table

echo "Deploy complete: $ACR_SERVER/$BACKEND_IMAGE_REPO:$BACKEND_TAG"
