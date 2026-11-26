# Odivon Edge Agent - Windows görevi (kurulum programı çağırır).
#   gorev.ps1 -AppDir "C:\Odivon\EdgeAgent" -Action kur|kaldir|durdur
param(
  [Parameter(Mandatory = $true)][string]$AppDir,
  [ValidateSet('kur', 'kaldir', 'durdur')][string]$Action = 'kur'
)
$ErrorActionPreference = 'Stop'
$task = 'Odivon Edge Agent'
$node = Join-Path $AppDir 'node\node.exe'
$app = Join-Path $AppDir 'app'
$bridge = Join-Path $app 'vendor\zkemkeeper\zkemkeeper-bridge.exe'

function Stop-Agent {
  # Görev yoksa (ilk kurulum) schtasks hata yazar; $ErrorActionPreference = 'Stop' bunu
  # durdurucu hataya çevirmesin diye Windows PowerShell'in yerel komut hatası burada yutulur.
  if (Get-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue
  }
  # Eski kurulumlar (ör. Downloads klasöründen çalışan agent) ve köprüleri: aynı cihaza iki bağlantı olmasın.
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*agent.js*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Get-Process zkemkeeper-bridge -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}

# Elle kurulmuş eski agent (servis-kur.bat) aynı görev adını kullanıyordu. Görev yeniden yazılmadan önce
# onun klasöründeki eşleştirme, kuyruk ve cihaz ayarları yeni kuruluma alınır (bkz. eski-kurulum.js).
function Import-OldInstall {
  $script = Join-Path $AppDir 'eski-kurulum.js'
  if (-not (Test-Path -LiteralPath $script)) { return }
  try {
    $old = (Get-ScheduledTask -TaskName $task -ErrorAction Stop).Actions[0].WorkingDirectory
  } catch {
    return
  }
  if ([string]::IsNullOrWhiteSpace($old)) { return }
  try {
    & $node $script $old.Trim('"') $app
  } catch {
    Write-Output "Eski kurulum taşınamadı: $_"
  }
}

function Remove-FirewallRules {
  # Kural yoksa netsh de hata yazar; yerel komutların hatası kurulumu durdurmasın.
  $ErrorActionPreference = 'Continue'
  netsh advfirewall firewall delete rule name="Odivon Edge Agent - ZK kopru" 2>&1 | Out-Null
  netsh advfirewall firewall delete rule name="Odivon Edge Agent - Node" 2>&1 | Out-Null
}

switch ($Action) {
  'durdur' { Stop-Agent }
  'kaldir' {
    Stop-Agent
    Unregister-ScheduledTask -TaskName $task -Confirm:$false -ErrorAction SilentlyContinue
    Remove-FirewallRules
  }
  'kur' {
    Stop-Agent
    Import-OldInstall
    # Eski cihazlar (ZK UDP/4370) cevabı gelen trafik olarak yollar; "Genel" ağ profilinde engellenmesin.
    Remove-FirewallRules
    netsh advfirewall firewall add rule name="Odivon Edge Agent - ZK kopru" dir=in action=allow program="$bridge" protocol=UDP profile=any | Out-Null
    netsh advfirewall firewall add rule name="Odivon Edge Agent - Node" dir=in action=allow program="$node" protocol=UDP profile=any | Out-Null

    $taskAction = New-ScheduledTaskAction -Execute $node -Argument '--disable-warning=ExperimentalWarning agent.js' -WorkingDirectory $app
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
      -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName $task -Action $taskAction -Trigger $trigger -Settings $settings -User 'SYSTEM' -RunLevel Highest -Force | Out-Null

    # Prizdeyken uyku / hazırda bekleme kapalı: agent çalışmaya devam etsin.
    $ErrorActionPreference = 'Continue'
    powercfg /change standby-timeout-ac 0 2>&1 | Out-Null
    powercfg /change hibernate-timeout-ac 0 2>&1 | Out-Null
    $ErrorActionPreference = 'Stop'

    Start-ScheduledTask -TaskName $task
  }
}
