[CmdletBinding()]
param([string]$ETS2LAPath = (Join-Path $env:USERPROFILE 'AppData\Local\ETS2LA\current'))
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    $dotnet = Join-Path $PSScriptRoot '.tools\dotnet\dotnet.exe'
    if (!(Test-Path -LiteralPath $dotnet)) { $dotnet = (Get-Command dotnet -ErrorAction Stop).Source }
    $env:DOTNET_CLI_HOME = Join-Path $PSScriptRoot '.tools\cli'
    $env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
    $env:DOTNET_ADD_GLOBAL_TOOLS_TO_PATH = 'false'
    $env:DOTNET_GENERATE_ASPNET_CERTIFICATE = 'false'
    & $dotnet restore 'src\ETS2LA.StreamDeck\ETS2LA.StreamDeck.csproj' --configfile NuGet.Config --packages '.tools\packages' "-p:ETS2LAPath=$ETS2LAPath"
    if ($LASTEXITCODE) { throw 'Restore fehlgeschlagen.' }
    & $dotnet build 'src\ETS2LA.StreamDeck\ETS2LA.StreamDeck.csproj' -c Release --no-restore --nologo "-p:ETS2LAPath=$ETS2LAPath"
    if ($LASTEXITCODE) { throw 'Build fehlgeschlagen.' }
    node 'scripts\build-streamdeck.cjs'
    if ($LASTEXITCODE) { throw 'Stream-Deck-Build fehlgeschlagen.' }
    node 'scripts\preview.cjs'
    if ($LASTEXITCODE) { throw 'Vorschau fehlgeschlagen.' }
    Copy-Item -LiteralPath 'src\ETS2LA.StreamDeck\bin\Release\net10.0\StreamDeckBridge.dll' -Destination 'artifacts\StreamDeckBridge.dll' -Force
    Copy-Item -LiteralPath 'scripts\Installieren.ps1' -Destination 'artifacts\Installieren.ps1' -Force
    Copy-Item -LiteralPath 'scripts\Installieren-Bridge.ps1' -Destination 'artifacts\Installieren-Bridge.ps1' -Force
    Copy-Item -LiteralPath 'README.md' -Destination 'artifacts\ANLEITUNG.md' -Force
    $cli = '.tools\elgato\node_modules\@elgato\cli\bin\streamdeck.mjs'
    if (Test-Path -LiteralPath $cli) {
        node $cli pack 'artifacts\de.lucat.ets2la.sdPlugin' --output 'artifacts' --force --no-update-check --no-file-list
        if ($LASTEXITCODE) { throw 'Stream-Deck-Paketprüfung fehlgeschlagen.' }
    }
    Write-Host 'Fertige Dateien: artifacts' -ForegroundColor Green
} finally { Pop-Location }
