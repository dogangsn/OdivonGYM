param(
  [string]$SdkDirectory = 'C:\Users\dogan\Downloads\UyeTakip\UyeTakip\Bilgi Aktar\dll'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$agentRoot = Join-Path $projectRoot 'edge-agent'
$sourcePath = Join-Path $agentRoot 'tools\ZkemkeeperBridge.cs'
$outputRoot = Join-Path $agentRoot 'vendor\zkemkeeper'
$sdkDll = Join-Path $SdkDirectory 'zkemkeeper.dll'
$interopPath = Join-Path $outputRoot 'Interop.zkemkeeper.dll'
$bridgePath = Join-Path $outputRoot 'zkemkeeper-bridge.exe'
$tlbImp = Get-ChildItem 'C:\Program Files (x86)\Microsoft SDKs\Windows' -Filter TlbImp.exe -Recurse -ErrorAction Stop |
  Where-Object FullName -NotMatch '\\x64\\' |
  Select-Object -Last 1 -ExpandProperty FullName
$compiler = 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe'
$sdkFiles = @(
  'commpro.dll',
  'comms.dll',
  'rscagent.dll',
  'rscomm.dll',
  'tcpcomm.dll',
  'usbcomm.dll',
  'zkemkeeper.dll',
  'zkemsdk.dll'
)

if (-not (Test-Path -LiteralPath $sdkDll)) { throw "zkemkeeper.dll bulunamadı: $sdkDll" }
if (-not (Test-Path -LiteralPath $compiler)) { throw "32-bit C# derleyicisi bulunamadı: $compiler" }

New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
foreach ($file in $sdkFiles) {
  $source = Join-Path $SdkDirectory $file
  if (-not (Test-Path -LiteralPath $source)) { throw "SDK dosyası eksik: $source" }
  Copy-Item -LiteralPath $source -Destination (Join-Path $outputRoot $file) -Force
}

& $tlbImp $sdkDll /namespace:Interop.zkemkeeper /out:$interopPath /silent
if ($LASTEXITCODE -ne 0) { throw "TlbImp başarısız: $LASTEXITCODE" }

& $compiler /nologo /target:exe /platform:x86 /optimize+ /out:$bridgePath `
  /reference:$interopPath `
  /reference:System.Web.Extensions.dll `
  /reference:System.Windows.Forms.dll `
  $sourcePath
if ($LASTEXITCODE -ne 0) { throw "C# bridge derlemesi başarısız: $LASTEXITCODE" }

Write-Host "zkemkeeper x86 bridge hazır: $bridgePath"
