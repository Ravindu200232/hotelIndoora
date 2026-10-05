#!/bin/bash
#
# Runs ON one hotelIndoora instance, as root, sent by Systems Manager.
# Returns the instance to the release it was running before the last one and
# proves it answers again.
#
#   rollback.sh <service> <port>
#
set -euo pipefail

APP=hotelindoora
SERVICE="$1"
PORT="$2"

BASE=/opt/$APP
RELEASES=$BASE/releases
CURRENT=$BASE/current
CURRENT_TARGET="$(readlink -f "$CURRENT" 2>/dev/null || true)"
PREVIOUS="$(ls -1dt "$RELEASES"/*/ 2>/dev/null | sed -n 2p | sed 's:/$::')"

if [ -z "$PREVIOUS" ] || [ ! -d "$PREVIOUS" ]; then
  echo "there is no earlier release on this instance to go back to"
  exit 1
fi

echo "moving $SERVICE from $CURRENT_TARGET back to $PREVIOUS"
ln -sfn "$PREVIOUS" "$CURRENT"
systemctl restart $APP

ok=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 3 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done

if [ "$ok" != "1" ]; then
  echo "the earlier release did not answer either; leaving it in place and reporting"
  journalctl -u $APP -n 60 --no-pager || true
  exit 1
fi

echo "$SERVICE is answering again on the earlier release $PREVIOUS"
