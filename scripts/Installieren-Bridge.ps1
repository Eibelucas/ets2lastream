[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$SourceDll = (Join-Path $PSScriptRoot 'StreamDeckBridge.dll'),
    [string]$ETS2LAPath = (Join-Path $env:USERPROFILE 'AppData\Local\ETS2LA\current'),
    [string]$ManifestPath = (Join-Path $env:USERPROFILE 'AppData\Roaming\ETS2LA\InstalledPluginManifest.json'),
    [string]$InstallDirectory = (Join-Path $env:USERPROFILE 'AppData\Roaming\ETS2LA\LocalPlugins\lucat.streamdeck'),
    [string]$BackupDirectory = (Join-Path $PSScriptRoot 'Backup')
)
$ErrorActionPreference = 'Stop'
$SourceDll = [IO.Path]::GetFullPath($SourceDll)
$ETS2LAPath = [IO.Path]::GetFullPath($ETS2LAPath)
$ManifestPath = [IO.Path]::GetFullPath($ManifestPath)
$InstallDirectory = [IO.Path]::GetFullPath($InstallDirectory)
$destination = Join-Path $InstallDirectory 'StreamDeckBridge.dll'
$legacy = Join-Path $ETS2LAPath 'Plugins\StreamDeckBridge.dll'
if (!(Test-Path -LiteralPath $SourceDll)) { throw "Bridge-DLL fehlt: $SourceDll" }
if (!(Test-Path -LiteralPath (Join-Path $ETS2LAPath 'ETS2LA.Shared.dll'))) { throw "ETS2LA wurde nicht gefunden: $ETS2LAPath" }
if ($InstallDirectory.Equals($ETS2LAPath, [StringComparison]::OrdinalIgnoreCase) -or
    $InstallDirectory.StartsWith($ETS2LAPath.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Der dauerhafte Pluginordner muss außerhalb des ETS2LA-Programmordners liegen.'
}
$identity = [Reflection.AssemblyName]::GetAssemblyName($SourceDll)
if ($identity.Name -ne 'StreamDeckBridge') { throw 'Die Quelldatei ist keine StreamDeckBridge-DLL.' }
$version = $identity.Version.ToString(3)
$original = if (Test-Path -LiteralPath $ManifestPath) { [IO.File]::ReadAllText($ManifestPath) } else { $null }
$manifest = if ($null -ne $original) { $original | ConvertFrom-Json } else { [PSCustomObject]@{ InstalledPlugins = @() } }
if ($null -eq $manifest -or !($manifest.PSObject.Properties.Name -contains 'InstalledPlugins') -or $null -eq $manifest.InstalledPlugins) {
    throw 'Ungültiges ETS2LA-Pluginmanifest. Es wurde nichts geändert.'
}
$manifest.InstalledPlugins = @($manifest.InstalledPlugins | Where-Object { $_.Id -ne 'lucat.streamdeck' }) + @(
    [PSCustomObject]@{ Id = 'lucat.streamdeck'; Version = $version; DllPath = $destination; Dependencies = @(); Type = 0 }
)
$json = $manifest | ConvertTo-Json -Depth 100
if (!$PSCmdlet.ShouldProcess($destination, "Bridge $version kopieren und in $ManifestPath registrieren")) { return }

$backup = Join-Path $BackupDirectory ('Bridge-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 6))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
if ($null -ne $original) { [IO.File]::WriteAllText((Join-Path $backup 'InstalledPluginManifest.json'), $original, (New-Object Text.UTF8Encoding($false))) }
if (Test-Path -LiteralPath $destination) { Copy-Item -LiteralPath $destination -Destination (Join-Path $backup 'StreamDeckBridge.dll') }
New-Item -ItemType Directory -Path $InstallDirectory -Force | Out-Null
if (!$SourceDll.Equals($destination, [StringComparison]::OrdinalIgnoreCase)) { Copy-Item -LiteralPath $SourceDll -Destination $destination -Force }
if ((Get-FileHash -LiteralPath $SourceDll).Hash -ne (Get-FileHash -LiteralPath $destination).Hash) { throw 'Die kopierte Bridge stimmt nicht mit der Quelle überein.' }

# Do not overwrite a concurrent change from ETS2LA or another installer.
$current = if (Test-Path -LiteralPath $ManifestPath) { [IO.File]::ReadAllText($ManifestPath) } else { $null }
if ($current -cne $original) { throw 'Die Pluginliste wurde während der Installation verändert. Bitte erneut ausführen.' }
# Update the existing file without requiring permission to delete/replace it.
# The original contents are backed up above, as for ETS2LA's own settings saves.
[IO.File]::WriteAllText($ManifestPath, $json, (New-Object Text.UTF8Encoding($false)))

# Disable only our obsolete loose DLL, so the loader cannot prefer an old duplicate.
if (Test-Path -LiteralPath $legacy) {
    Move-Item -LiteralPath $legacy -Destination (Join-Path $backup 'Legacy-StreamDeckBridge.dll')
}
Write-Output "Stream Deck Bridge $version registriert: $destination"
Write-Output "Sicherung: $backup"
