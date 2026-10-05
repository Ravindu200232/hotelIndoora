#!/bin/bash
#
# Runs ON one hotelIndoora instance, as root, sent by Systems Manager.
# It never prints a secret: the environment file is written straight from
# Secrets Manager and is readable only by root.
#
#   release.sh <service> <s3-key> <secret-name> <region> <bucket> <port>
#
set -euo pipefail

APP=hotelindoora
SERVICE="$1"
RELEASE_KEY="$2"
SECRET_NAME="$3"
REGION="$4"
BUCKET="$5"
PORT="$6"
HEALTH_PATH="/health"

BASE=/opt/$APP
RELEASES=$BASE/releases
CURRENT=$BASE/current
ENV_FILE=/etc/$APP/env
ID="$(basename "$RELEASE_KEY" .tar.gz)"
TARGET=$RELEASES/$ID
PREVIOUS="$(readlink -f "$CURRENT" 2>/dev/null || true)"

mkdir -p "$RELEASES"

if [ ! -d "$TARGET" ]; then
  mkdir -p "$TARGET"
  aws s3 cp "s3://$BUCKET/$RELEASE_KEY" "/tmp/$ID.tar.gz" --region "$REGION" --only-show-errors
  tar -xzf "/tmp/$ID.tar.gz" -C "$TARGET"
  rm -f "/tmp/$ID.tar.gz"
fi
chown -R app:app "$TARGET"

# ---- the environment this service needs, and nothing else --------------------
mkdir -p /etc/$APP
RAW="$(aws secretsmanager get-secret-value --secret-id "$SECRET_NAME" --region "$REGION" --query SecretString --output text)"
printf '%s' "$RAW" | node -e '
  let input = "";
  process.stdin.on("data", (chunk) => { input += chunk; });
  process.stdin.on("end", () => {
    const all = JSON.parse(input);
    const service = process.argv[1];
    const common = ["MONGODB_URI", "SESSION_SECRET", "NODE_ENV", "HOTEL_NAME", "EMAIL_PROVIDER", "EMAIL_API_KEY", "MAIL_FROM"];
    const per = {
      gateway: ["PORT", "AUTH_URL", "ROOMS_URL", "BOOKINGS_URL"],
      auth: ["AUTH_PORT", "BOOKINGS_URL"],
      rooms: ["ROOMS_PORT", "BOOKINGS_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ROOM_PHOTOS_BUCKET"],
      bookings: ["BOOKINGS_PORT", "ROOMS_URL", "AUTH_URL", "PAYPAL_ENV"],
    };
    const keys = [...common, ...(per[service] ?? [])];
    const lines = keys.filter((k) => all[k] !== undefined && all[k] !== "").map((k) => k + "=" + all[k]);
    process.stdout.write(lines.join("\n") + "\n");
  });
' "$SERVICE" > "$ENV_FILE"
chown root:root "$ENV_FILE"
chmod 600 "$ENV_FILE"

# ---- switch the release and restart -----------------------------------------
ln -sfn "$TARGET" "$CURRENT"
systemctl restart $APP

ok=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 3 "http://127.0.0.1:$PORT$HEALTH_PATH" >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done

if [ "$ok" != "1" ]; then
  echo "release $ID did not answer on $HEALTH_PATH; rolling back"
  if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    ln -sfn "$PREVIOUS" "$CURRENT"
    systemctl restart $APP
  fi
  journalctl -u $APP -n 60 --no-pager || true
  echo "previous release restored: $PREVIOUS"
  exit 1
fi

# ---- keep the last five releases -------------------------------------------
cd "$RELEASES"
ls -1dt */ 2>/dev/null | tail -n +6 | xargs -r rm -rf

echo "release $ID live for $SERVICE on port $PORT"
