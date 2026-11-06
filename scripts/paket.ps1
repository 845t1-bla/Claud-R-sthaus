# Baut die App und packt alles, was der Server-Admin braucht, in eine ZIP-Datei.
# Aufruf:            npm run paket
# Fuer Unterordner:   $env:APP_BASE="/ruesthaus/"; npm run paket
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path "$root\.env")) { throw "Die Datei .env fehlt (Supabase-URL und Key). Siehe README.md." }
if (-not (Test-Path "$root\dist\index.html")) { throw "Build fehlt - bitte 'npm run paket' verwenden." }

$base = if ($env:APP_BASE) { $env:APP_BASE } else { '/' }
$datum = Get-Date -Format 'yyyy-MM-dd_HHmm'
$staging = Join-Path $env:TEMP "ruesthaus-paket-$datum"
$ziel = Join-Path $root "pakete"
$zip = Join-Path $ziel "ruesthaus-web_$datum.zip"

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Force -Path "$staging\ruesthaus-web" | Out-Null
New-Item -ItemType Directory -Force -Path $ziel | Out-Null

Copy-Item "$root\dist\*" "$staging\ruesthaus-web" -Recurse
# Netlify/Vercel-Dateien werden auf dem eigenen Server nicht gebraucht
Remove-Item "$staging\ruesthaus-web\_redirects" -ErrorAction SilentlyContinue
Copy-Item "$root\deploy\ANLEITUNG-SERVER.md", "$root\deploy\nginx-ruesthaus.conf", "$root\deploy\nginx-unterordner.conf", "$root\deploy\apache-ruesthaus.conf" $staging
Copy-Item "$root\deploy\server" "$staging\server" -Recurse

$supabaseUrl = (Select-String -Path "$root\.env" -Pattern '^VITE_SUPABASE_URL=(.*)$').Matches[0].Groups[1].Value
@"
Ruesthaus-App - Webpaket
Gebaut am:      $(Get-Date -Format 'dd.MM.yyyy HH:mm')
Pfad (APP_BASE): $base
Supabase:       $supabaseUrl

Inhalt von ruesthaus-web/ nach /var/www/ruesthaus/ kopieren.
Anleitung: ANLEITUNG-SERVER.md
"@ | Set-Content -Encoding UTF8 "$staging\VERSION.txt"

# tar.exe (in Windows enthalten) erzeugt ZIPs mit "/" als Pfadtrenner, die unter Linux sauber entpacken
# (Compress-Archive aus Windows PowerShell 5.1 schreibt "\" und macht unter Linux Probleme).
if (Test-Path $zip) { Remove-Item $zip -Force }
$eintraege = Get-ChildItem $staging | ForEach-Object { $_.Name }
& "$env:SystemRoot\System32\tar.exe" -a -c -f $zip -C $staging @eintraege
if ($LASTEXITCODE -ne 0) { throw "ZIP konnte nicht erstellt werden." }
Remove-Item $staging -Recurse -Force
Write-Host ""
Write-Host "Paket erstellt: $zip" -ForegroundColor Green
Write-Host "Pfad (APP_BASE): $base"
