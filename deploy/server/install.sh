#!/usr/bin/env bash
# Richtet auf dem Server ein:
#   - täglichen Update-Check von GitHub   (ruesthaus-update.timer)
#   - Supabase-Keepalive 2x pro Woche     (ruesthaus-keepalive.timer)
# Aufruf aus dem entpackten Paket:  sudo bash server/install.sh
# Kann gefahrlos erneut ausgeführt werden; eine bestehende Konfiguration bleibt erhalten.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Bitte mit sudo ausführen: sudo bash $0" >&2; exit 1; }
hier="$(cd "$(dirname "$0")" && pwd)"

echo "==> Pakete installieren"
apt-get update -qq
apt-get install -y -qq curl unzip rsync python3 >/dev/null

echo "==> Systembenutzer 'ruesthaus' anlegen"
id ruesthaus >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin ruesthaus

echo "==> App-Ordner /var/www/ruesthaus vorbereiten"
install -d -m 755 /var/www/ruesthaus
chown -R ruesthaus:ruesthaus /var/www/ruesthaus

echo "==> Skripte installieren"
install -m 755 "$hier/ruesthaus-update.sh" /usr/local/bin/ruesthaus-update
install -m 755 "$hier/ruesthaus-keepalive.sh" /usr/local/bin/ruesthaus-keepalive

echo "==> Konfiguration"
install -d -m 750 -o root -g ruesthaus /etc/ruesthaus
if [ ! -f /etc/ruesthaus/ruesthaus.conf ]; then
  install -m 640 -o root -g ruesthaus "$hier/ruesthaus.conf.beispiel" /etc/ruesthaus/ruesthaus.conf
  neu=1
else
  echo "    /etc/ruesthaus/ruesthaus.conf existiert bereits – bleibt unverändert."
  neu=0
fi

echo "==> systemd-Timer einrichten"
install -m 644 "$hier"/systemd/ruesthaus-*.service "$hier"/systemd/ruesthaus-*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now ruesthaus-update.timer ruesthaus-keepalive.timer

echo
echo "Fertig. Geplante Läufe:"
systemctl list-timers 'ruesthaus-*' --no-pager || true
echo
if [ "$neu" -eq 1 ] || grep -q 'BESITZER/REPOSITORY' /etc/ruesthaus/ruesthaus.conf; then
  echo "NÄCHSTER SCHRITT: GITHUB_REPO (und ggf. GITHUB_TOKEN) eintragen:"
  echo "    sudo nano /etc/ruesthaus/ruesthaus.conf"
fi
echo "Danach testen:"
echo "    sudo systemctl start ruesthaus-update    && journalctl -u ruesthaus-update -n 20 --no-pager"
echo "    sudo systemctl start ruesthaus-keepalive && journalctl -u ruesthaus-keepalive -n 5 --no-pager"
