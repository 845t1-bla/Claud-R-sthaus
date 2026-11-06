# Rüsthaus Roßtal – Verwaltungs-App

Web-App für das Rüsthaus der Pfadfinder Roßtal: Bestand, Kasse mit Warenkorb, Kluftflat (Ausgabe, Rückgabe, Tausch),
Rabatte/Gratis-Ausgaben mit Pflichtgrund, mehrere Ausgeber mit eigenem Login, Excel-Exporte und Inventur.

Läuft im Browser auf Handy, Tablet und Laptop. Daten liegen zentral in **Supabase** (kostenloser Tarif reicht).

---

## Funktionen

| Bereich | Was geht |
|---|---|
| **Kasse** | Artikel per Bild-Kachel auswählen (Größe + Zustand), Warenkorb mit mehreren Artikeln, Preis pro Position änderbar, 🎁 „gratis“-Knopf. Bei Rabatt oder Gratis ist ein **Grund Pflicht**. Käufer auswählen oder direkt neu anlegen. Ausgeber = eingeloggte Person (umstellbar). |
| **Kluftflat** | Ausgabe für 40 € (Betrag in Einstellungen; Ermäßigung nur mit Grund). Standard-Aufnäher sind vorausgewählt und können **einzeln abgewählt** werden (bereits aufgenäht → wird nicht ausgebucht). Gebrauchte Flat-Kluften werden bevorzugt vorgeschlagen. |
| **Rückgabe** | *Sauber* → Bestand „Gebraucht (Flat)“, neue Kluft kostenlos (Tausch). *Beschädigt, aber tragbar* → Bestand „Härtefall“, Flat endet, neue Kluft kostet wieder. *Unbrauchbar* → Entsorgung, Flat endet. |
| **Härtefälle** | Härtefall-Ware über die Kasse (Zustand „Härtefall“) – standardmäßig gratis mit Grund. |
| **Verkäufe** | Liste mit Filtern (Zeitraum, Ausgeber, Art, Käufer, nur Rabatt/Gratis). Jeder Verkauf ist **bearbeitbar** (Käufer, Ausgeber, Menge, Preis, Grund, Datum) oder **stornierbar** – Bestand wird automatisch korrigiert, Änderungen werden protokolliert. |
| **Bestand** | Je Größe getrennt nach *Neu / Gebraucht (Flat) / Härtefall*, Wareneingang, Korrektur, Entsorgung, Mindestbestand-Warnung, Protokoll aller Buchungen. |
| **Produkte** | Anlegen/Bearbeiten, Größen (mit Vorlagen), abweichende Preise je Größe, **Produktbilder** (mehrere, Hauptbild, direkt mit Handykamera; werden automatisch verkleinert). |
| **Mitglieder** | Anlegen/Bearbeiten/Deaktivieren, Kaufhistorie und Flat-Status. |
| **Berichte** | Excel: **Bestandsliste**, **Verkaufsübersicht** (Verkäufe, Positionen, Rabatte & Gratis, Summen je Ausgeber), **Inventurdatei** (Zählliste mit Soll/Ist/Differenz). **Inventur erfassen** direkt in der App: Abweichungen werden gebucht. |
| **Einstellungen** | Flat-Preis, Standard-Aufnäher der Flat, Kategorien (welche zählen als „Kluft“), Ausgeber & Rollen. |

Alle Buchungen (Verkauf, Flat, Rückgabe, Storno, Inventur) laufen als Datenbank-Funktionen: entweder wird alles gebucht oder nichts.
Bestand kann nicht negativ werden.

---

## Einrichtung (einmalig, ca. 20 Minuten)

### 1. Supabase-Projekt anlegen
1. Auf <https://supabase.com> kostenlos registrieren → **New project** (Region z. B. *Frankfurt*), Datenbank-Passwort notieren.
2. Im Projekt links **SQL Editor** → **New query** → Inhalt von [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql) einfügen → **Run**.
3. Optional Startdaten: Inhalt von [`supabase/seed.sql`](supabase/seed.sql) ausführen (Kategorien, Beispielprodukte, Standard-Aufnäher – **Preise sind Beispiele**, bitte anpassen).

### 2. Login-Einstellungen
1. **Authentication → Sign In / Providers → Email**: „Allow new users to sign up“ **ausschalten** (nur ihr legt Logins an).
2. **Authentication → URL Configuration**: *Site URL* auf die spätere Adresse der App setzen (lokal: `http://localhost:5173`).
3. **Authentication → Users → Add user → Create new user**: deine E-Mail + Passwort, „Auto Confirm User“ an.
   → **Der erste Nutzer wird automatisch Admin.**

### 3. App lokal starten
Voraussetzung: [Node.js](https://nodejs.org) (LTS).

```bash
npm install
```

Datei `.env.example` nach `.env` kopieren und Werte aus **Project Settings → API** eintragen (*Project URL* und *anon public key*).

```bash
npm run dev
```

Dann <http://localhost:5173> öffnen und anmelden.

### 4. Weitere Ausgeber hinzufügen
1. In der App: **Einstellungen → Ausgeber → Ausgeber anlegen** (Name + E-Mail).
2. In Supabase: **Authentication → Users → Add user** mit derselben E-Mail (Passwort vergeben oder „Send invitation“).
3. Beim ersten Login wird die Person automatisch verknüpft. Ohne vorherigen Eintrag in der App wird ein Login als *inaktiv* angelegt und muss vom Admin freigeschaltet werden.

Personen ohne eigenes Login können trotzdem bei Verkäufen als Ausgeber ausgewählt werden.

### 5a. Auf dem eigenen Server (Ubuntu) betreiben

`npm run paket` erzeugt `pakete\ruesthaus-web_<datum>.zip` für den Server-Admin.
Deine Schritte: [deploy/ANLEITUNG-UEBERGABE.md](deploy/ANLEITUNG-UEBERGABE.md) · Anleitung für den Admin (liegt im ZIP): [deploy/ANLEITUNG-SERVER.md](deploy/ANLEITUNG-SERVER.md)

### 5b. Alternativ: Online stellen (Netlify, kostenlos)
1. ```bash
   npm run build
   ```
2. Auf <https://app.netlify.com/drop> den Ordner `dist` hineinziehen – fertig. (Alternativ Repository verbinden, Build-Befehl `npm run build`, Ordner `dist`, Umgebungsvariablen `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` setzen.)
3. Die Netlify-Adresse in Supabase unter **Authentication → URL Configuration** als *Site URL* eintragen.

Vercel funktioniert genauso (`vercel.json` liegt bei). Am Handy im Browser „Zum Startbildschirm hinzufügen“ – dann verhält sich die App wie eine normale App.

---

## Typische Abläufe

- **Ware kommt an:** Bestand → ➕ bei der Größe → Menge eingeben.
- **Verkauf:** Kasse → Artikel antippen → Größe wählen → in den Warenkorb → Käufer wählen → *Verkauf abschließen*.
- **Geschenk / Rabatt:** in der Kasse 🎁 drücken oder Preis senken → Grund eintragen (Pflicht).
- **Neue Kluftflat:** Kluftflat → *Neue Flat ausgeben* → Mitglied, Größe, ggf. Aufnäher abwählen → ausgeben.
- **Kind ist rausgewachsen:** Kluftflat → *Rückgabe / Tausch* → Mitglied → Zustand bewerten → bei „sauber“ direkt neue Kluft ausgeben.
- **Fehler gemacht:** Verkäufe → Vorgang öffnen → *Bearbeiten* oder *Stornieren*.
- **Inventur:** Berichte → Inventurdatei herunterladen und zählen → unter *Inventur erfassen* die Ist-Werte eintragen → *Inventur buchen*.

---

## Technik

- Vite + React + TypeScript, UI: Mantine
- Supabase: Postgres, Auth, Storage (Bucket `produktbilder`), Row Level Security (nur freigeschaltete Ausgeber sehen Daten; Bestand und Verkäufe nur über die Buchungsfunktionen änderbar)
- Excel-Export: ExcelJS (im Browser)

```
supabase/migrations/001_init.sql   Tabellen, Regeln, Buchungsfunktionen, Rechte
supabase/seed.sql                  Startdaten (optional)
src/lib/                           Datenzugriff, Export, Formatierung, Login
src/pages/                         Seiten (Kasse, Kluftflat, Verkäufe, Bestand, …)
src/components/                    gemeinsame Bausteine
```
