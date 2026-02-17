# Script de démarrage démo Docker + ngrok sécurisé (FAB)
# Exécute depuis la racine du projet : .\demarrage-demo-ngrok.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

Set-Location $root

# 1. Créer le fichier de policy ngrok s'il n'existe pas
$policyFile = Join-Path $root "ngrok-demo-policy.yml"
if (-not (Test-Path $policyFile)) {
    Copy-Item (Join-Path $root "ngrok-demo.example.yml") $policyFile
    (Get-Content $policyFile) -replace "DEMO_PASSWORD_ICI", "FabDemo2025!" | Set-Content $policyFile
    Write-Host "[OK] Fichier ngrok-demo-policy.yml créé (login: demo, mot de passe: FabDemo2025!)" -ForegroundColor Green
} else {
    Write-Host "[OK] ngrok-demo-policy.yml existe déjà." -ForegroundColor Green
}

# 2. Démarrer les conteneurs Docker
Write-Host "`n[Docker] Démarrage de postgres et api..." -ForegroundColor Cyan
docker-compose up -d postgres api
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur docker-compose. Vérifie que Docker tourne." -ForegroundColor Red
    exit 1
}

Write-Host "Attente du healthcheck API (environ 30 s)..." -ForegroundColor Gray
$max = 60
$n = 0
while ($n -lt $max) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3000/api/v1/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) { break }
    } catch {}
    Start-Sleep -Seconds 2
    $n += 2
}
if ($n -ge $max) {
    Write-Host "L'API n'a pas répondu à temps. Lance quand même les tunnels et vérifie plus tard." -ForegroundColor Yellow
} else {
    Write-Host "[OK] API prête." -ForegroundColor Green
}

# 3. Démarrer le frontend en arrière-plan (Docker) pour que le port 3002 soit pris
Write-Host "`n[Docker] Démarrage du frontend (port 3002)..." -ForegroundColor Cyan
docker-compose up -d frontend
Start-Sleep -Seconds 3

# 4. Ouvrir deux fenêtres ngrok
Write-Host "`n[Ngrok] Ouverture de deux fenêtres ngrok..." -ForegroundColor Cyan
$apiCmd = "ngrok http 3000"
$frontCmd = "ngrok http 3002 --traffic-policy-file=`"$policyFile`""
Start-Process cmd -ArgumentList "/k", "cd /d `"$root`" && title Ngrok API && $apiCmd"
Start-Sleep -Seconds 1
Start-Process cmd -ArgumentList "/k", "cd /d `"$root`" && title Ngrok Frontend && $frontCmd"

Write-Host @"

========================================
  ÉTAPES SUIVANTES (à faire à la main)
========================================

1) Dans les deux fenêtres ngrok, note les URLs HTTPS affichées :
   - Tunnel API    → ex. https://xxxx.ngrok-free.app   (URL_API)
   - Tunnel Front  → ex. https://yyyy.ngrok-free.app   (URL_FRONTEND)

2) Ouvre ton fichier .env et ajoute URL_FRONTEND dans CORS_ORIGINS :
   CORS_ORIGINS=http://localhost:3000,http://localhost:3002,https://yyyy.ngrok-free.app

3) Redémarre l'API pour prendre en compte le CORS :
   docker-compose restart api

4) Pour que le client appelle l'API publique, arrête le frontend Docker
   et lance le frontend en local avec l'URL de l'API ngrok :
   docker-compose stop frontend
   cd frontend
   `$env:NEXT_PUBLIC_API_URL="https://xxxx.ngrok-free.app/api/v1"
   npm run dev

5) Envoie au client : l'URL du tunnel FRONTEND (yyyy...) + identifiants :
   Login : demo
   Mot de passe : (celui dans ngrok-demo-policy.yml, par défaut FabDemo2025!)

Détails complets : DEMO-NGROK-SECURISE.md

"@ -ForegroundColor Yellow
