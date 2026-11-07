[CmdletBinding()]
param([string]$ETS2LAPath = (Join-Path $env:USERPROFILE 'AppData\Local\ETS2LA\current'))
$ErrorActionPreference = 'Stop'

# This script is copied next to the two built plugins by Bauen.ps1.
$bridgeSource = Join-Path $PSScriptRoot 'StreamDeckBridge.dll'
$deckSource = Join-Path $PSScriptRoot 'de.lucat.ets2la.sdPlugin'
$bridgeInstaller = Join-Path $PSScriptRoot 'Installieren-Bridge.ps1'
if (!(Test-Path -LiteralPath $bridgeSource) -or !(Test-Path -LiteralPath $deckSource)) {
    throw 'Bitte Installieren.ps1 im fertigen artifacts-Ordner ausführen. Zuerst Bauen.ps1 ausführen, falls dort Dateien fehlen.'
}
if (!(Test-Path -LiteralPath (Join-Path $ETS2LAPath 'ETS2LA.Shared.dll'))) { throw "ETS2LA wurde nicht gefunden: $ETS2LAPath" }
if (!(Test-Path -LiteralPath $bridgeInstaller)) { throw 'Installieren-Bridge.ps1 fehlt im Paket.' }
$deckRoot = Join-Path $env:APPDATA 'Elgato\StreamDeck\Plugins'
if (!(Test-Path -LiteralPath (Split-Path $deckRoot))) { throw 'Stream Deck ist nicht installiert.' }
$bridgeTarget = Join-Path $env:USERPROFILE 'AppData\Roaming\ETS2LA\LocalPlugins\lucat.streamdeck\StreamDeckBridge.dll'
$deckTarget = Join-Path $deckRoot 'de.lucat.ets2la.sdPlugin'
if ((Test-Path -LiteralPath $deckTarget) -and (Get-Process -Name StreamDeck -ErrorAction SilentlyContinue)) { throw 'Für ein Update Stream Deck bitte zuerst vollständig beenden (auch im Infobereich).' }
if ((Test-Path -LiteralPath $bridgeTarget) -and (Get-Process -Name ETS2LA -ErrorAction SilentlyContinue)) { throw 'Für ein Update ETS2LA bitte zuerst beenden.' }
$backup = Join-Path $PSScriptRoot ('Backup\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if ((Test-Path -LiteralPath $bridgeTarget) -or (Test-Path -LiteralPath $deckTarget)) {
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    if (Test-Path -LiteralPath $bridgeTarget) { Copy-Item -LiteralPath $bridgeTarget -Destination $backup }
    if (Test-Path -LiteralPath $deckTarget) { Copy-Item -LiteralPath $deckTarget -Destination $backup -Recurse }
    Write-Host "Vorherige Version gesichert: $backup"
}
& $bridgeInstaller -SourceDll $bridgeSource -ETS2LAPath $ETS2LAPath
New-Item -ItemType Directory -Path $deckTarget -Force | Out-Null
Get-ChildItem -LiteralPath $deckSource | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $deckTarget -Recurse -Force }
Write-Host 'Beide Plugins installiert.' -ForegroundColor Green
Write-Host 'Jetzt ETS2LA starten und Stream Deck Bridge im Plugin-Manager aktivieren.'
Write-Host 'In Stream Deck die Aktionen aus der Kategorie ETS2LA auf freie Tasten ziehen.'
