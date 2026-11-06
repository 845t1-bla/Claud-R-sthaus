# Rüsthaus-App – Installation auf dem Server (Ubuntu 26.04)

Diese Anleitung richtet sich an die Person, die den Server der Pfadfinder Roßtal betreut.
Zeitaufwand: ca. 15–20 Minuten.

## Kurz gesagt

Die Rüsthaus-App ist eine **reine statische Webseite** (HTML, JavaScript, CSS).

- **Der Server liefert nur Dateien aus.** Es gibt keinen Backend-Prozess, keine Datenbank, kein Node.js, PHP oder Docker auf dem Server und keine zusätzlichen Ports.
- **Daten, Logins und Produktbilder liegen bei Supabase** (gehostetes Postgres, Region Frankfurt). Der Browser der Nutzer spricht direkt mit Supabase über HTTPS (`https://<projekt>.supabase.co`).
- Der Server braucht also nur: **einen Webserver (nginx oder Apache) + HTTPS-Zertifikat + eine (Sub-)Domain.**

```
Browser (Handy/Laptop) ──HTTPS──> euer Server (nginx: liefert index.html + /assets)
         └────────────────HTTPS──> Supabase (Daten, Login, Bilder)
```

## Was du bekommst

Eine ZIP-Datei `ruesthaus-web_<datum>.zip` mit:

| Datei / Ordner | Zweck |
|---|---|
| `ruesthaus-web/` | die fertige App (index.html, assets/, favicon.svg) |
| `VERSION.txt` | Build-Datum und **Pfad (APP_BASE)**, für den das Paket gebaut wurde |
| `nginx-ruesthaus.conf` | nginx-Konfiguration für eine eigene Subdomain |
| `nginx-unterordner.conf` | nginx-Variante für einen Unterordner einer bestehenden Website |
| `apache-ruesthaus.conf` | Alternative für Apache |
| `ANLEITUNG-SERVER.md` | diese Anleitung |

## Voraussetzungen

1. **Domain:** empfohlen ist eine eigene Subdomain, z. B. `ruesthaus.<eure-domain>.de`, mit einem **A-Record** (und ggf. AAAA) auf die IP des Servers.
   Alternativ ein Unterordner einer bestehenden Website (z. B. `https://<eure-domain>.de/ruesthaus/`). Dann muss das Paket mit diesem Pfad gebaut sein. Das steht in `VERSION.txt` unter „Pfad (APP_BASE)“.
2. Ports **80 und 443** sind von außen erreichbar (für HTTPS und Let's Encrypt).
3. `sudo`-Zugang.

> **Bitte gib Sebastian vorab Bescheid, unter welcher Adresse die App erreichbar sein wird.** Er muss die Adresse in Supabase eintragen und, falls es ein Unterordner ist, das Paket passend bauen.

---

## Installation mit nginx (empfohlen)

In allen Befehlen `ruesthaus.beispiel.de` durch die echte Adresse ersetzen.

### 1. nginx und certbot installieren

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx unzip
```

Falls `ufw` aktiv ist:

```bash
sudo ufw allow 'Nginx Full'
```

### 2. App-Dateien ablegen

ZIP auf den Server kopieren (z. B. per `scp` nach `/tmp`), dann:

```bash
cd /tmp
unzip ruesthaus-web_*.zip -d ruesthaus-paket
cat ruesthaus-paket/VERSION.txt
sudo mkdir -p /var/www/ruesthaus
sudo cp -r ruesthaus-paket/ruesthaus-web/. /var/www/ruesthaus/
sudo chown -R root:root /var/www/ruesthaus
sudo find /var/www/ruesthaus -type d -exec chmod 755 {} \;
sudo find /var/www/ruesthaus -type f -exec chmod 644 {} \;
```

### 3. nginx konfigurieren

**Variante A – eigene Subdomain** (`VERSION.txt`: Pfad `/`):

```bash
sudo cp ruesthaus-paket/nginx-ruesthaus.conf /etc/nginx/sites-available/ruesthaus
sudo sed -i 's/ruesthaus.beispiel.de/ruesthaus.EURE-DOMAIN.de/' /etc/nginx/sites-available/ruesthaus
sudo ln -s /etc/nginx/sites-available/ruesthaus /etc/nginx/sites-enabled/ruesthaus
sudo nginx -t && sudo systemctl reload nginx
```

**Variante B – Unterordner** `/ruesthaus/` einer bestehenden Website (`VERSION.txt`: Pfad `/ruesthaus/`):
Den Inhalt von `nginx-unterordner.conf` in den bestehenden `server { … }`-Block der Website einfügen. Danach:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Wichtig für beide Varianten: Unbekannte Pfade (z. B. `/kasse`) müssen auf `index.html` umgeleitet werden. Das erledigt `try_files … /index.html`. Sonst gibt es beim Neuladen einer Unterseite einen 404-Fehler.

### 4. HTTPS einrichten (Pflicht)

Über die App werden Passwörter eingegeben, deshalb **nur mit HTTPS** betreiben.

```bash
sudo certbot --nginx -d ruesthaus.EURE-DOMAIN.de --redirect
```

certbot ergänzt die Konfiguration um Port 443 und die Weiterleitung von HTTP auf HTTPS. Die Zertifikate werden automatisch erneuert (`systemctl list-timers | grep certbot`).

### 5. Prüfen

```bash
curl -I https://ruesthaus.EURE-DOMAIN.de/
curl -I https://ruesthaus.EURE-DOMAIN.de/kasse
```

Beide Aufrufe müssen **200** liefern. Im Browser erscheint die Anmeldeseite „Rüsthaus Roßtal“.

---

## Alternative: Apache

Falls auf dem Server bereits Apache läuft:

```bash
sudo apt install -y python3-certbot-apache unzip
# Schritt 2 wie oben (Dateien nach /var/www/ruesthaus)
sudo cp ruesthaus-paket/apache-ruesthaus.conf /etc/apache2/sites-available/ruesthaus.conf
sudo sed -i 's/ruesthaus.beispiel.de/ruesthaus.EURE-DOMAIN.de/' /etc/apache2/sites-available/ruesthaus.conf
sudo a2enmod headers expires
sudo a2ensite ruesthaus
sudo apachectl configtest && sudo systemctl reload apache2
sudo certbot --apache -d ruesthaus.EURE-DOMAIN.de --redirect
```

---

## Automatische Updates von GitHub + Supabase wach halten (empfohlen)

Neue Versionen werden auf GitHub automatisch als Release gebaut. Ein systemd-Timer auf dem Server prüft **täglich um 4 Uhr**, ob es ein neues Release gibt, und installiert es. Ein zweiter Timer ruft **montags und donnerstags** Supabase auf, damit das Gratis-Projekt nicht wegen Inaktivität pausiert.

Einrichtung, nach Schritt B1 (nginx) und B3 (Konfiguration):

```bash
cd /tmp/ruesthaus-paket
sudo bash server/install.sh
sudo nano /etc/ruesthaus/ruesthaus.conf      # GITHUB_REPO eintragen, bei privatem Repo GITHUB_TOKEN
sudo systemctl start ruesthaus-update        # erste Installation sofort
journalctl -u ruesthaus-update -n 20 --no-pager
sudo systemctl start ruesthaus-keepalive
journalctl -u ruesthaus-keepalive -n 5 --no-pager
```

Was `install.sh` macht:
- installiert `curl unzip rsync python3`,
- legt den Systembenutzer `ruesthaus` an, dem `/var/www/ruesthaus` gehört,
- kopiert die Skripte nach `/usr/local/bin/ruesthaus-update` und `/usr/local/bin/ruesthaus-keepalive`,
- legt `/etc/ruesthaus/ruesthaus.conf` an (Rechte 640),
- aktiviert die Timer `ruesthaus-update.timer` und `ruesthaus-keepalive.timer`.

Die Dienste laufen ohne Root-Rechte und dürfen nur in `/var/www/ruesthaus` und `/var/lib/ruesthaus` schreiben.

Sicherheitsmechanismen des Update-Skripts:
- Ein Paket ohne `index.html` oder `assets/` wird nicht installiert.
- Ein Paket, das für einen anderen Pfad gebaut wurde (`EXPECTED_BASE`), wird nicht installiert.
- In diesen Fällen bleibt die alte Version unverändert online.

Nützliche Befehle:

```bash
systemctl list-timers 'ruesthaus-*'                       # nächste Läufe
cat /var/lib/ruesthaus/installed-version                  # installierte Version
sudo -u ruesthaus /usr/local/bin/ruesthaus-update --force # aktuelle Version neu installieren
```

Ein Fehlschlag steht im Journal (`journalctl -u ruesthaus-update`). Wer Mails bei Fehlern möchte, kann `OnFailure=` an die Service-Units hängen.

## Updates manuell einspielen (ohne GitHub)

Sebastian schickt bei Änderungen ein neues ZIP. Es werden nur die Dateien ausgetauscht, an der Server-Konfiguration ändert sich nichts.

```bash
cd /tmp && rm -rf ruesthaus-paket
unzip ruesthaus-web_*.zip -d ruesthaus-paket
sudo rsync -a --delete ruesthaus-paket/ruesthaus-web/ /var/www/ruesthaus/
```

Ein Neustart von nginx ist nicht nötig. `index.html` wird nicht gecacht, die Nutzer bekommen die neue Version beim nächsten Laden.

**Optional, um Updates einfacher zu machen:** Sebastian bekommt einen eingeschränkten SFTP-Zugang nur für `/var/www/ruesthaus` und kann Updates dann selbst hochladen.

---

## Alternative: Auf dem Server selbst bauen

Nur nötig, wenn ihr statt des fertigen ZIPs den Quellcode bekommt:

```bash
sudo apt install -y nodejs npm    # Node.js 20 oder neuer
cd ruesthaus-quellcode
# Datei .env mit VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY muss vorhanden sein
npm ci
npm run build                     # für Unterordner: APP_BASE=/ruesthaus/ npm run build
sudo rsync -a --delete dist/ /var/www/ruesthaus/
```

---

## Sicherheit und Datenschutz

- Der im Paket enthaltene Supabase-Key ist ein **öffentlicher Publishable-/Anon-Key**. Er ist dafür gedacht, im Browser zu stehen. Den Zugriffsschutz übernehmen Supabase-Login und Row-Level-Security in der Datenbank.
- Auf dem Server liegen **keine personenbezogenen Daten** und keine Geheimnisse.
- Die Daten (Mitgliedernamen, Verkäufe) liegen bei Supabase in Frankfurt (EU). Für den Verein sollte bei Supabase ein Auftragsverarbeitungsvertrag (DPA) abgeschlossen werden. Das erledigt der Verantwortliche im Supabase-Dashboard.

## Fehlerbehebung

| Problem | Ursache / Lösung |
|---|---|
| Unterseite (z. B. `/kasse`) gibt nach Neuladen 404 | `try_files … /index.html` fehlt oder greift nicht |
| Weiße Seite, im Browser-Konsole 404 auf `/assets/…` | Paket wurde für einen anderen Pfad gebaut als konfiguriert → `VERSION.txt` prüfen, ggf. neues Paket anfordern |
| Seite lädt, Anmeldung schlägt mit Netzwerkfehler fehl | Der **Browser** erreicht `*.supabase.co` nicht. Ursache ist meist das Netz des Nutzers oder eine zu strenge Content-Security-Policy auf dem Server. Lösung: keine CSP setzen oder `connect-src https://*.supabase.co wss://*.supabase.co` und `img-src 'self' data: blob: https://*.supabase.co` erlauben |
| „Einrichtung fehlt“ wird angezeigt | Paket wurde ohne Supabase-Zugangsdaten gebaut → neues Paket anfordern |
| Link aus „Passwort vergessen“-Mail führt auf `localhost` | Sebastian muss die Server-Adresse in Supabase als Site URL eintragen |
