#!/usr/bin/env bash
# One-step backend setup for the OTT API (api.ottcafe.in -> port 1351).
#   1. Creates backend/.env by asking for each value (skipped if it already exists).
#   2. Installs dependencies and runs the automated tests.
#   3. (Re)starts the API with pm2 and checks it is connected to MySQL.
# Usage:  bash /path/to/ott/setup-backend.sh
set -euo pipefail

OTT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$OTT_DIR/backend"
ENV_FILE="$BACKEND/.env"
PORT=1351

ask() { # ask VAR "prompt" secret(0/1) minlen
  local __var=$1 prompt=$2 secret=$3 min=$4 value
  while true; do
    if [ "$secret" = 1 ]; then read -rsp "$prompt" value; echo; else read -rp "$prompt" value; fi
    if [ ${#value} -lt "$min" ]; then echo "  Must be at least $min characters."; continue; fi
    if [[ "$value" =~ [[:space:]\"\'\\\#\$] ]]; then echo "  Please avoid spaces, quotes, \\, # and \$."; continue; fi
    printf -v "$__var" '%s' "$value"; return
  done
}

if [ -f "$ENV_FILE" ]; then
  echo "backend/.env already exists -- keeping it. (Delete it and run this again to re-enter the values.)"
else
  echo "Creating backend/.env. Password answers are not shown while typing."
  ask DB_NAME   "MySQL database name: " 0 1
  ask DB_USER   "MySQL username: " 0 1
  ask DB_PASS   "MySQL password: " 1 1
  ask ADMIN_PW  "Choose the ADMIN password (owner master login, 10+ characters): " 1 10
  ask OWNER_PC  "Choose the OWNER passcode (6+ characters, different from the admin password): " 1 6
  if [ "$ADMIN_PW" = "$OWNER_PC" ]; then echo "Admin password and owner passcode must differ. Run again."; exit 1; fi
  umask 077
  cat > "$ENV_FILE" <<EOF
PORT=$PORT
NODE_ENV=production
ALLOWED_ORIGIN=https://ottcafe.in
ADMIN_PASSWORD=$ADMIN_PW
OWNER_PASSCODE=$OWNER_PC
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=$DB_USER
MYSQL_PASSWORD=$DB_PASS
MYSQL_DATABASE=$DB_NAME
MYSQL_SSL=false
DISABLE_OTP_PREVIEW=false
EOF
  chmod 600 "$ENV_FILE"
  echo "Saved $ENV_FILE (readable by this user only)."
fi

cd "$BACKEND"
echo; echo "== Installing backend dependencies"
npm install --no-audit --no-fund
echo; echo "== Running automated tests"
npm test

echo; echo "== (Re)starting the API"
pm2 delete ott-backend >/dev/null 2>&1 || true
if command -v fuser >/dev/null 2>&1 && fuser "$PORT/tcp" >/dev/null 2>&1; then
  echo "Port $PORT is still used by an older OTT process -- stopping it."
  fuser -k "$PORT/tcp" || true
  sleep 1
fi
pm2 start dist/index.cjs --name ott-backend --cwd "$BACKEND"
sleep 6
pm2 logs ott-backend --lines 12 --nostream || true

echo; echo "== Database check"
STATUS="$(curl -s "http://127.0.0.1:$PORT/api/mysql/status" || true)"
echo "$STATUS"
if echo "$STATUS" | grep -q '"connected":true'; then
  pm2 save
  echo; echo "SUCCESS: API is running and connected to MySQL. pm2 will keep it running."
else
  echo; echo "NOT CONNECTED: check the MySQL name/user/password. To re-enter them:"
  echo "  rm $ENV_FILE && bash $OTT_DIR/setup-backend.sh"
  exit 1
fi
