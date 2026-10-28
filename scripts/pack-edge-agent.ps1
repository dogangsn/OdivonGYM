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
  'zkemkeeper-kur.bat',
  'config.sample.json',
  'src',
  'node_modules\zkteco-js',
  'vendor\zkemkeeper'
)

$missingItems = $archiveItems | Where-Object { -not (Test-Path -LiteralPath (Join-Path $agentRoot $_)) }
if ($missingItems.Count -gt 0) {
  throw "Agent paketi oluşturulamadı. Eksik öğeler: $($missingItems -join ', ')"
}

New-Item -ItemType Directory -Path $downloadRoot -Force | Out-Null
if (Test-Path -LiteralPath $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open(
  $archivePath,
  [System.IO.Compression.ZipArchiveMode]::Create
)
try {
  $agentPrefix = $agentRoot.TrimEnd('\') + '\'
  foreach ($item in $archiveItems) {
    $sourcePath = Join-Path $agentRoot $item
    $files = if (Test-Path -LiteralPath $sourcePath -PathType Container) {
      Get-ChildItem -LiteralPath $sourcePath -Recurse -File
    } else {
      Get-Item -LiteralPath $sourcePath
    }

    foreach ($file in $files) {
      $entryName = $file.FullName.Substring($agentPrefix.Length).Replace('\', '/')
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $archive,
        $file.FullName,
        $entryName,
        [System.IO.Compression.CompressionLevel]::Optimal
      ) | Out-Null
    }
  }
} finally {
  $archive.Dispose()
}

$archiveFile = Get-Item -LiteralPath $archivePath
Write-Host "Edge Agent paketi hazır: $($archiveFile.FullName) ($($archiveFile.Length) bayt)"
