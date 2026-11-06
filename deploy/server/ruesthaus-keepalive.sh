#!/usr/bin/env bash
# Rüsthaus-App: hält das Supabase-Projekt (Gratistarif) aktiv,
# indem regelmäßig die Datenbank-Funktion keepalive() aufgerufen wird.
# Wird vom systemd-Timer "ruesthaus-keepalive.timer" aufgerufen.
# Manuell testen: sudo systemctl start ruesthaus-keepalive && journalctl -u ruesthaus-keepalive -n 5
set -euo pipefail

CONFIG="${RUESTHAUS_CONFIG:-/etc/ruesthaus/ruesthaus.conf}"
[ -r "$CONFIG" ] || { echo "Konfiguration $CONFIG fehlt oder ist nicht lesbar." >&2; exit 1; }
# shellcheck source=/dev/null
. "$CONFIG"

: "${SUPABASE_URL:?SUPABASE_URL fehlt in $CONFIG}"
: "${SUPABASE_KEY:?SUPABASE_KEY fehlt in $CONFIG}"

antwort="$(curl -fsS --retry 3 --max-time 60 -X POST "${SUPABASE_URL%/}/rest/v1/rpc/keepalive" \
  -H "apikey: $SUPABASE_KEY" -H "Content-Type: application/json" -d '{}')" || {
  echo "Supabase nicht erreichbar oder Funktion keepalive() fehlt (supabase/migrations/002_keepalive.sql ausführen)." >&2
  exit 1
}
echo "Supabase aktiv gehalten: $antwort"
