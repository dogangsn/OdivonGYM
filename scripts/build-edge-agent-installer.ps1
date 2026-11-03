# Odivon Edge Agent kurulum dosyasını (OdivonEdgeAgentKurulum-<sürüm>.exe) üretir.
# Gerekli: Windows (.NET Framework 4.8 hazır gelir), Node.js + npm, Inno Setup 6 (ISCC.exe),
# internet (Node.js taşınabilir paketi için).
#   powershell -ExecutionPolicy Bypass -File scripts\build-edge-agent-installer.ps1
param(
  [string]$NodeVersion = '22.23.4',
  [string]$Iscc = 'C:\Program Files (x86)\Inno Setup 6\ISCC.exe'
)
$ErrorActionPreference = 'Stop'
$agentRoot = Join-Path (Split-Path -Parent $PSScriptRoot) 'edge-agent'
$build = Join-Path $agentRoot 'build'
$version = (Get-Content (Join-Path $agentRoot 'package.json') -Raw | ConvertFrom-Json).version

if (-not (Test-Path -LiteralPath $Iscc)) { throw "Inno Setup bulunamadı: $Iscc (winget install JRSoftware.InnoSetup)" }
if (Test-Path $build) { Remove-Item $build -Recurse -Force }
New-Item -ItemType Directory -Path (Join-Path $build 'node'), (Join-Path $build 'app') -Force | Out-Null

# 1) Taşınabilir Node.js (yalnızca node.exe): müşteri bilgisayarına ayrıca Node kurulmaz.
$zip = Join-Path $env:TEMP "node-v$NodeVersion-win-x64.zip"
if (-not (Test-Path $zip)) {
  Invoke-WebRequest "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip" -OutFile $zip
}
$sums = (Invoke-WebRequest "https://nodejs.org/dist/v$NodeVersion/SHASUMS256.txt" -UseBasicParsing).Content
$expected = ($sums -split "`n" | Where-Object { $_ -match "node-v$NodeVersion-win-x64.zip" }) -replace '\s.*$', ''
$actual = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
if ($expected -ne $actual) { throw "Node.js paketi doğrulanamadı (SHA256 $actual ≠ $expected)" }
$unpack = Join-Path $env:TEMP "node-v$NodeVersion-unpack"
if (Test-Path $unpack) { Remove-Item $unpack -Recurse -Force }
Expand-Archive $zip -DestinationPath $unpack
Copy-Item (Join-Path $unpack "node-v$NodeVersion-win-x64\node.exe") (Join-Path $build 'node\node.exe')
Copy-Item (Join-Path $unpack "node-v$NodeVersion-win-x64\LICENSE") (Join-Path $build 'node\LICENSE')

# 2) Agent dosyaları + üretim bağımlılıkları (config.json, data, testler girmez).
$app = Join-Path $build 'app'
foreach ($item in 'agent.js', 'package.json', 'package-lock.json', 'config.sample.json', 'README.md', 'src', 'ui', 'vendor') {
  Copy-Item (Join-Path $agentRoot $item) -Destination $app -Recurse
}

# 2b) ZK köprüsü her derlemede kaynaktan (tools\ZkemkeeperBridge.cs) üretilir; depodaki hazır exe eski kalabilir.
#     32-bit olmalı: üretici SDK'sı (zkemkeeper.dll) 32-bit COM.
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $csc)) { throw "C# derleyicisi bulunamadı: $csc (.NET Framework 4.8 gerekli)" }
$zkDir = Join-Path $app 'vendor\zkemkeeper'
& $csc /nologo /target:exe /platform:x86 /optimize+ `
  "/out:$(Join-Path $zkDir 'zkemkeeper-bridge.exe')" `
  "/reference:$(Join-Path $zkDir 'Interop.zkemkeeper.dll')" `
  /reference:System.Web.Extensions.dll /reference:System.Windows.Forms.dll `
  (Join-Path $agentRoot 'tools\ZkemkeeperBridge.cs')
if ($LASTEXITCODE -ne 0) { throw "ZK köprüsü derlenemedi: $LASTEXITCODE" }
Push-Location $app
try {
  & npm ci --omit=dev --ignore-scripts --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm ci başarısız: $LASTEXITCODE" }
} finally { Pop-Location }
foreach ($secret in 'serviceAccountKey.json', 'config.json', 'data') {
  if (Test-Path (Join-Path $app $secret)) { throw "Pakete girmemesi gereken dosya bulundu: $secret" }
}

# 3) Kurulum dosyası
& $Iscc "/DAppVersion=$version" (Join-Path $agentRoot 'installer\odivon-edge-agent.iss')
if ($LASTEXITCODE -ne 0) { throw "ISCC başarısız: $LASTEXITCODE" }
Write-Host "Hazır: $(Join-Path $agentRoot "dist\OdivonEdgeAgentKurulum-$version.exe")"
