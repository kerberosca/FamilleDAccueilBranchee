param([string]$ConfigPath = "local-data/newsletter.env")
$ErrorActionPreference = "Stop"
$newsletterRepo = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $newsletterRepo
$newsletterConfig = Join-Path $newsletterRepo $ConfigPath
if (-not (Test-Path -LiteralPath $newsletterConfig)) { throw "Créer le fichier local-data/newsletter.env (voir docs/INFOLETTRE_CYBERIMPACT.md)." }
foreach ($newsletterLine in Get-Content -LiteralPath $newsletterConfig) {
  if ($newsletterLine -match '^([A-Z][A-Z0-9_]*)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
  }
}
$newsletterDatabase = [Uri]$env:DATABASE_URL
if ($newsletterDatabase.Host -notin @("127.0.0.1", "localhost") -or $newsletterDatabase.Port -ne 5436 -or
    $newsletterDatabase.AbsolutePath -ne "/fab_newsletter_test" -or $env:PORT -ne "3006" -or $env:NODE_ENV -ne "development") {
  throw "Ce lanceur est réservé à la base de test locale fab_newsletter_test (5436) et à l’API locale (3006)."
}
if ($env:EMAIL_DELIVERY_MODE -ne "log" -or $env:ALLY_TRAINING_EMAILS_ENABLED -ne "false") {
  throw "Les autres courriels FAB doivent rester désactivés pour ce test local."
}
Write-Host "API de test FAB sur http://127.0.0.1:3006; les ajouts Cyberimpact déclenchent le scénario réel de bienvenue."
& node "dist/src/main.js"
exit $LASTEXITCODE
