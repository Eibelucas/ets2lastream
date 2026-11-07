[CmdletBinding()]
param([string]$ETS2LAPath = (Join-Path $env:USERPROFILE 'AppData\Local\ETS2LA\current'))
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot
$fixture = Join-Path $root ('.tools\installer-test-' + [Guid]::NewGuid().ToString('N'))
$program = Join-Path $fixture 'program\current'
$profile = Join-Path $fixture 'profile'
$install = Join-Path $profile 'LocalPlugins\lucat.streamdeck'
$manifestPath = Join-Path $profile 'InstalledPluginManifest.json'
New-Item -ItemType Directory -Path (Join-Path $program 'Plugins'),$profile -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $ETS2LAPath 'ETS2LA.Shared.dll') -Destination $program
$source = Join-Path $root 'src\ETS2LA.StreamDeck\bin\Release\net10.0\StreamDeckBridge.dll'
Copy-Item -LiteralPath $source -Destination (Join-Path $program 'Plugins\StreamDeckBridge.dll')
$other = [PSCustomObject]@{ Id = 'existing.plugin'; Version = '2.0'; DllPath = 'Plugins\existing\Existing.dll'; Dependencies = @([PSCustomObject]@{ Id = 'existing.lib'; Version = $null }); Type = 0; ExtraProperty = 'keep me' }
[PSCustomObject]@{ InstalledPlugins = @($other); ExtraRootProperty = 'keep me too' } | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $manifestPath -Encoding utf8
$originalOther = $other | ConvertTo-Json -Depth 20 -Compress
$installer = Join-Path $root 'scripts\Installieren-Bridge.ps1'
& $installer -SourceDll $source -ETS2LAPath $program -ManifestPath $manifestPath -InstallDirectory $install -BackupDirectory (Join-Path $fixture 'Backups') | Out-Host
function Check($condition, $message) { if (!$condition) { throw $message }; Write-Output "PASS $message" }
$registered = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$bridge = @($registered.InstalledPlugins | Where-Object Id -eq 'lucat.streamdeck')
Check ($bridge.Count -eq 1) 'Bridge registered once'
Check ([IO.Path]::IsPathRooted($bridge[0].DllPath) -and $bridge[0].DllPath -eq (Join-Path $install 'StreamDeckBridge.dll')) 'Uses persistent absolute DLL path outside current'
Check ((($registered.InstalledPlugins | Where-Object Id -eq 'existing.plugin') | ConvertTo-Json -Depth 20 -Compress) -ceq $originalOther) 'Other plugin and its unknown fields preserved'
Check ($registered.ExtraRootProperty -eq 'keep me too') 'Unknown root properties preserved'
Check (!(Test-Path -LiteralPath (Join-Path $program 'Plugins\StreamDeckBridge.dll'))) 'Old loose DLL migrated to backup'
Check ((Get-FileHash -LiteralPath $bridge[0].DllPath).Hash -eq (Get-FileHash -LiteralPath $source).Hash) 'Installed DLL matches build'
& $installer -SourceDll $source -ETS2LAPath $program -ManifestPath $manifestPath -InstallDirectory $install -BackupDirectory (Join-Path $fixture 'Backups') | Out-Host
$registered = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
Check (@($registered.InstalledPlugins | Where-Object Id -eq 'lucat.streamdeck').Count -eq 1) 'Repeated repair does not duplicate registration'
# Simulate replacing the app folder during an update, while retaining the user profile.
Move-Item -LiteralPath $program -Destination (Join-Path $fixture 'previous-program')
New-Item -ItemType Directory -Path $program -Force | Out-Null
Check (Test-Path -LiteralPath $bridge[0].DllPath) 'Registered DLL still exists after current folder replacement'
Write-Output '8 installer checks passed.'
