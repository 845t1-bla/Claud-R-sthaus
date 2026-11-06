#!/usr/bin/env bash
# Rüsthaus-App: prüft auf GitHub, ob es ein neues Release gibt, und installiert es.
# Wird täglich vom systemd-Timer "ruesthaus-update.timer" aufgerufen.
# Manuell:          sudo systemctl start ruesthaus-update
# Neu installieren: sudo -u ruesthaus /usr/local/bin/ruesthaus-update --force
set -euo pipefail

CONFIG="${RUESTHAUS_CONFIG:-/etc/ruesthaus/ruesthaus.conf}"
[ -r "$CONFIG" ] || { echo "Konfiguration $CONFIG fehlt oder ist nicht lesbar." >&2; exit 1; }
# shellcheck source=/dev/null
. "$CONFIG"

: "${GITHUB_REPO:?GITHUB_REPO fehlt in $CONFIG}"
TARGET_DIR="${TARGET_DIR:-/var/www/ruesthaus}"
STATE_DIR="${STATE_DIR:-/var/lib/ruesthaus}"
ASSET_NAME="${ASSET_NAME:-ruesthaus-web.zip}"
GITHUB_API="${GITHUB_API:-https://api.github.com}"
FORCE="${1:-}"

auth=()
if [ -n "${GITHUB_TOKEN:-}" ]; then auth=(-H "Authorization: Bearer $GITHUB_TOKEN"); fi

mkdir -p "$STATE_DIR"
exec 9>"$STATE_DIR/update.lock"
if command -v flock >/dev/null 2>&1; then
  flock -n 9 || { echo "Ein Update läuft bereits."; exit 0; }
fi

# 1. Neuestes Release abfragen
release_json="$(curl -fsSL --retry 3 --max-time 60 "${auth[@]}" \
  -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" \
  "$GITHUB_API/repos/$GITHUB_REPO/releases/latest")" \
  || { echo "GitHub nicht erreichbar oder kein Release vorhanden ($GITHUB_REPO)." >&2; exit 1; }

read -r tag asset_url < <(printf '%s' "$release_json" | python3 -c '
import json, sys
r = json.load(sys.stdin)
a = next((a for a in r.get("assets", []) if a.get("name") == sys.argv[1]), None)
print(r.get("tag_name") or "-", (a or {}).get("url") or "-")
' "$ASSET_NAME" | tr -d '\r')

if [ -z "${tag:-}" ] || [ -z "${asset_url:-}" ] || [ "$tag" = "-" ] || [ "$asset_url" = "-" ]; then
  echo "Antwort von GitHub unverständlich oder neuestes Release enthält keine Datei $ASSET_NAME." >&2
  exit 1
fi

installed="$(cat "$STATE_DIR/installed-version" 2>/dev/null || true)"
if [ "$tag" = "$installed" ] && [ "$FORCE" != "--force" ]; then
  echo "Aktuell: $tag – nichts zu tun."
  exit 0
fi
echo "Neue Version gefunden: $tag (installiert: ${installed:-keine})"

# 2. Herunterladen und prüfen
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl -fsSL --retry 3 --max-time 300 "${auth[@]}" -H "Accept: application/octet-stream" \
  -o "$tmp/paket.zip" "$asset_url"
unzip -q "$tmp/paket.zip" -d "$tmp/paket"

src="$tmp/paket/ruesthaus-web"
if [ ! -f "$src/index.html" ] || [ ! -d "$src/assets" ]; then
  echo "Paket ist unvollständig (index.html oder assets/ fehlt) – Abbruch, alte Version bleibt." >&2
  exit 1
fi

if [ -n "${EXPECTED_BASE:-}" ] && [ -f "$tmp/paket/VERSION.txt" ]; then
  base="$(sed -n 's/^Pfad (APP_BASE): *//p' "$tmp/paket/VERSION.txt" | tr -d '\r ')"
  if [ -n "$base" ] && [ "$base" != "$EXPECTED_BASE" ]; then
    echo "Paket wurde für Pfad '$base' gebaut, erwartet ist '$EXPECTED_BASE' – Abbruch, alte Version bleibt." >&2
    exit 1
  fi
fi

# 3. Installieren: neue Dateien zuerst, index.html und Löschen alter Dateien zum Schluss
mkdir -p "$TARGET_DIR"
rsync -a --delay-updates --delete-after --chmod=D755,F644 "$src/" "$TARGET_DIR/"
printf '%s\n' "$tag" > "$STATE_DIR/installed-version"
echo "Installiert: $tag"
