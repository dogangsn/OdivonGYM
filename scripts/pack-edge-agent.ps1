$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$agentRoot = Join-Path $projectRoot 'edge-agent'
$downloadRoot = Join-Path $projectRoot 'public\downloads'
$archivePath = Join-Path $downloadRoot 'odivon-gym-edge-agent.zip'
$archiveItems = @(
  'agent.js',
  'package.json',
  'package-lock.json',
  'README.md',
  'baslat.bat',
  'servis-kur.bat',
  'durdur.bat',
  'yeniden-eslestir.bat',
  'config.sample.json',
  'src'
)

$missingItems = $archiveItems | Where-Object { -not (Test-Path -LiteralPath (Join-Path $agentRoot $_)) }
if ($missingItems.Count -gt 0) {
  throw "Agent paketi oluşturulamadı. Eksik öğeler: $($missingItems -join ', ')"
}

New-Item -ItemType Directory -Path $downloadRoot -Force | Out-Null
if (Test-Path -LiteralPath $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}

$paths = $archiveItems | ForEach-Object { Join-Path $agentRoot $_ }
Compress-Archive -LiteralPath $paths -DestinationPath $archivePath -CompressionLevel Optimal

$archive = Get-Item -LiteralPath $archivePath
Write-Host "Edge Agent paketi hazır: $($archive.FullName) ($($archive.Length) bayt)"
