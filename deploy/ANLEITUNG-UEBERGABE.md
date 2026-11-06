# Übergabe an den Server-Admin – deine Schritte

Die App braucht auf dem Server nur einen Webserver. Daten, Logins und Bilder bleiben bei Supabase.
Du schickst dem Admin **eine ZIP-Datei**, die Anleitung für ihn liegt im ZIP bei (`ANLEITUNG-SERVER.md`).

## 1. Adresse mit dem Admin klären

Frag ihn, unter welcher Adresse die App laufen soll:

- **Empfohlen: eigene Subdomain**, z. B. `https://ruesthaus.<eure-domain>.de`. Dann gilt Pfad `/`, und du musst beim Bauen nichts weiter einstellen.
- **Oder Unterordner**, z. B. `https://<eure-domain>.de/ruesthaus/`. Dann musst du das Paket mit diesem Pfad bauen (siehe Schritt 3).

Weise ihn darauf hin, dass **HTTPS Pflicht** ist (Let's Encrypt, kostenlos).

## 2. Supabase auf die neue Adresse einstellen

Im Supabase-Dashboard unter **Authentication → URL Configuration**:

1. **Site URL:** die neue Adresse eintragen, z. B. `https://ruesthaus.<eure-domain>.de` (bei Unterordner mit `/ruesthaus/` am Ende).
2. **Redirect URLs → Add URL:** dieselbe Adresse mit `/**` am Ende **und** `http://localhost:5173/**`, damit du weiter lokal testen kannst.
3. Speichern.

Das braucht es, damit die Links aus „Passwort vergessen“- und Einladungs-Mails auf den Server zeigen und nicht auf deinen Laptop.

Bei der Gelegenheit prüfen: **Authentication → Sign In / Providers → „Allow new users to sign up“ ist aus.**

## 3. Paket bauen

Im Projektordner ein Terminal öffnen.

**Eigene Subdomain:**

```powershell
npm run paket
```

**Unterordner** (Pfad anpassen):

```powershell
$env:APP_BASE="/ruesthaus/"; npm run paket; Remove-Item Env:APP_BASE
```

Ergebnis: `pakete\ruesthaus-web_<datum>.zip`. Die Supabase-Zugangsdaten aus deiner `.env` sind darin bereits eingebaut.

## 4. Dem Admin schicken

Per E-Mail, Cloud-Link o. Ä.:

- die ZIP-Datei,
- die gewünschte Adresse,
- den Hinweis: „Anleitung liegt im ZIP (ANLEITUNG-SERVER.md). Es ist nur eine statische Webseite: nginx/Apache + HTTPS, keine Datenbank, kein Node.js.“

**Nicht** schicken musst du: Quellcode, `.env`, Supabase-Passwort oder Secret-Key. Der Admin braucht keinen Zugang zu Supabase.

## 5. Nach der Installation testen

1. Adresse auf dem Handy öffnen → Anmeldeseite erscheint, Schloss-Symbol (HTTPS) ist da.
2. Anmelden, eine Unterseite (z. B. Kasse) öffnen und **neu laden** → die Seite muss wieder erscheinen.
3. „Passwort vergessen“ testen → der Link in der Mail muss auf die Server-Adresse führen.
4. Im Handy-Browser „Zum Startbildschirm hinzufügen“ → die App liegt wie eine normale App auf dem Handy.
5. Den anderen Ausgebern die Adresse geben und Logins anlegen (README, Abschnitt „Weitere Ausgeber hinzufügen“).

## 6. Updates später

Nach Änderungen an der App: `npm run paket` (ggf. mit `APP_BASE`) und das neue ZIP an den Admin schicken. Er tauscht nur die Dateien aus, das dauert 1 Minute.
Wenn er dir einen SFTP-Zugang nur für den App-Ordner gibt, kannst du Updates auch selbst hochladen.

## 7. Automatische Updates über GitHub einrichten (empfohlen)

Damit musst du nie wieder ZIPs verschicken: Du lädst Änderungen auf GitHub hoch, GitHub baut die App, und der Server holt sie sich nachts selbst.

1. **Repository anlegen:** Auf <https://github.com> anmelden → **New repository** → Name `ruesthaus-app`.
   - *Public* ist am einfachsten: Im Code stehen keine Geheimnisse, die `.env` wird nicht hochgeladen.
   - Bei *Private* braucht der Server einen Lese-Token (Schritt 5).
2. **Code hochladen.** Im Projektordner in PowerShell, `DEIN-NAME` ersetzen:
   ```powershell
   git init -b main
   git add .
   git commit -m "Rüsthaus-App"
   git remote add origin https://github.com/DEIN-NAME/ruesthaus-app.git
   git push -u origin main
   ```
   Beim ersten Push öffnet sich ein Browserfenster zur GitHub-Anmeldung.
3. **Zugangsdaten für den Build hinterlegen:** Im Repository **Settings → Secrets and variables → Actions → Reiter „Variables“ → New repository variable**:
   - `VITE_SUPABASE_URL` = `https://twbxdhtomzhfxaahnobe.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = dein `sb_publishable_…`-Key
   - `APP_BASE` = nur bei Unterordner, z. B. `/ruesthaus/`
4. **Ersten Build starten:** Reiter **Actions → „Release bauen“ → Run workflow**. Nach ca. 2 Minuten steht rechts unter **Releases** eine Version wie `v2026.11.06-1` mit `ruesthaus-web.zip`.
5. **Nur bei privatem Repository:** Unter GitHub **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token** einen Token anlegen.
   - Repository access: nur `ruesthaus-app`
   - Permissions: Contents → Read-only
   - Ablaufdatum notieren und den Token vor Ablauf erneuern.
6. **Supabase-Keepalive aktivieren:** Im Supabase **SQL Editor** den Inhalt von [`supabase/migrations/002_keepalive.sql`](../supabase/migrations/002_keepalive.sql) ausführen.
7. **Dem Admin schicken:**
   - den Repository-Namen (`DEIN-NAME/ruesthaus-app`),
   - ggf. den Token, auf sicherem Weg (z. B. persönlich oder über einen Passwort-Manager, nicht per offener Mail),
   - den Hinweis auf den Abschnitt „Automatische Updates“ in `ANLEITUNG-SERVER.md`.

**Später, bei jeder Änderung:**

```powershell
git add .
git commit -m "Was geändert wurde"
git push
```

Spätestens am nächsten Morgen ist die neue Version online. Welche Version läuft, siehst du in der App im Menü oben rechts unter deinem Namen.

## Gut zu wissen

- **Supabase-Gratistarif:** Ein Projekt ohne Nutzung über etwa eine Woche wird pausiert. Mit dem Keepalive-Timer auf dem Server (Schritt 7) passiert das nicht mehr. Falls doch: im Supabase-Dashboard auf „Restore“ klicken, die Daten bleiben erhalten.
- **Datensicherung:** Der Gratistarif hat keine herunterladbaren Backups. Exportiere regelmäßig (z. B. monatlich) Bestandsliste und Verkaufsübersicht als Excel.
- **Datenschutz:** In Supabase unter Organization Settings den Auftragsverarbeitungsvertrag (DPA) für den Verein abschließen, da Mitgliedernamen gespeichert werden.
