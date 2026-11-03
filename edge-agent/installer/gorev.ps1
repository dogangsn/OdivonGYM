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
  schtasks /End /TN $task 2>$null | Out-Null
  # Eski kurulumlar (ör. Downloads klasöründen çalışan agent) ve köprüleri: aynı cihaza iki bağlantı olmasın.
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*agent.js*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Get-Process zkemkeeper-bridge -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}

function Remove-FirewallRules {
  netsh advfirewall firewall delete rule name="Odivon Edge Agent - ZK kopru" 2>$null | Out-Null
  netsh advfirewall firewall delete rule name="Odivon Edge Agent - Node" 2>$null | Out-Null
}

switch ($Action) {
  'durdur' { Stop-Agent }
  'kaldir' {
    Stop-Agent
    schtasks /Delete /TN $task /F 2>$null | Out-Null
    Remove-FirewallRules
  }
  'kur' {
    Stop-Agent
    # Eski cihazlar (ZK UDP/4370) cevabı gelen trafik olarak yollar; "Genel" ağ profilinde engellenmesin.
    Remove-FirewallRules
    netsh advfirewall firewall add rule name="Odivon Edge Agent - ZK kopru" dir=in action=allow program="$bridge" protocol=UDP profile=any | Out-Null
    netsh advfirewall firewall add rule name="Odivon Edge Agent - Node" dir=in action=allow program="$node" protocol=UDP profile=any | Out-Null

    $action = New-ScheduledTaskAction -Execute $node -Argument '--disable-warning=ExperimentalWarning agent.js' -WorkingDirectory $app
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
      -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName $task -Action $action -Trigger $trigger -Settings $settings -User 'SYSTEM' -RunLevel Highest -Force | Out-Null

    # Prizdeyken uyku / hazırda bekleme kapalı: agent çalışmaya devam etsin.
    powercfg /change standby-timeout-ac 0 2>$null | Out-Null
    powercfg /change hibernate-timeout-ac 0 2>$null | Out-Null

    Start-ScheduledTask -TaskName $task
  }
}
