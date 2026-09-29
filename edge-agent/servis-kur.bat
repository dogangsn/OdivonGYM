@echo off
setlocal
chcp 65001 >nul
rem ============================================================
rem  OdivonGYM Edge Agent - Windows acilisinda otomatik baslatma
rem  baslat.bat eslestirmeden sonra bunu kendisi calistirir.
rem  Elle kurmak: servis-kur.bat    Kaldirmak: servis-kur.bat kaldir
rem ============================================================

set "TASK=Odivon Edge Agent"
set "DIR=%~dp0"
if "%DIR:~-1%"=="\" set "DIR=%DIR:~0,-1%"

rem Yonetici degilse kendini yonetici olarak calistir ve bitmesini bekle
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo [BILGI] Otomatik baslatma icin yonetici izni isteniyor...
  if "%~1"=="" (
    powershell -NoProfile -Command "try { Start-Process -FilePath '%~f0' -Verb RunAs -Wait } catch { exit 1 }"
  ) else (
    powershell -NoProfile -Command "try { Start-Process -FilePath '%~f0' -ArgumentList '%~1' -Verb RunAs -Wait } catch { exit 1 }"
  )
  exit /b %errorlevel%
)

if /i "%~1"=="kaldir" (
  schtasks /End /TN "%TASK%" >nul 2>&1
  schtasks /Delete /TN "%TASK%" /F
  echo Otomatik baslatma kaldirildi.
  pause
  exit /b 0
)

if not exist "%DIR%\agent.js" (
  echo [HATA] agent.js bulunamadi. Bu dosya edge-agent klasorunde olmali.
  goto fail
)
if not exist "%DIR%\data\identity.json" (
  echo [HATA] Agent henuz eslestirilmemis. Once baslat.bat ile eslestirme kodunu girin.
  goto fail
)
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [HATA] Node.js bulunamadi. https://nodejs.org adresinden kurun.
  goto fail
)

rem Pencerede acik kalan agent'i kapat (ayni anda iki agent calismasin)
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*agent.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$node=(Get-Command node).Source;" ^
  "$action=New-ScheduledTaskAction -Execute $node -Argument '--disable-warning=ExperimentalWarning agent.js' -WorkingDirectory '%DIR%';" ^
  "$trigger=New-ScheduledTaskTrigger -AtStartup;" ^
  "$settings=New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew;" ^
  "Register-ScheduledTask -TaskName '%TASK%' -Action $action -Trigger $trigger -Settings $settings -User 'SYSTEM' -RunLevel Highest -Force | Out-Null;" ^
  "Start-ScheduledTask -TaskName '%TASK%'"
if %errorlevel% neq 0 (
  echo [HATA] Zamanlanmis gorev olusturulamadi.
  goto fail
)

rem Prizdeyken uyku / hazirda bekleme kapali (agent calismaya devam etsin)
powercfg /change standby-timeout-ac 0 >nul 2>&1
powercfg /change hibernate-timeout-ac 0 >nul 2>&1

echo.
echo  [TAMAM] Odivon Edge Agent arka planda calisiyor.
echo   - Bilgisayar acildiginda, kimse oturum acmasa bile baslar.
echo   - Kapanirsa 1 dakika icinde yeniden baslatilir.
echo   - Durumu admin panelindeki "cevrimici" bilgisinden takip edin.
echo   - Kaldirmak icin: servis-kur.bat kaldir
echo.
timeout /t 8 >nul
exit /b 0

:fail
pause
exit /b 1
