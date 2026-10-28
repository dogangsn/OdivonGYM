@echo off
setlocal
chcp 65001 >nul
title OdivonGYM Edge Agent - Yeniden eslestir
cd /d "%~dp0"
rem ============================================================
rem  OdivonGYM Edge Agent - yeni eslestirme kodu gir
rem  Agent'i durdurur, yeni kodla eslestirir (eski kimligin uzerine yazar)
rem  ve tekrar baslatir. Bekleyen gecis kayitlari silinmez.
rem ============================================================

set "TASK=Odivon Edge Agent"

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [HATA] Node.js bulunamadi. https://nodejs.org adresinden Node.js 22.13 veya uzerini kurun.
  pause
  exit /b 1
)

rem Arka planda (SYSTEM) calisan agent'i kapatmak icin yonetici izni gerekir
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo [BILGI] Agent'i durdurmak icin yonetici izni isteniyor...
  powershell -NoProfile -Command "try { Start-Process -FilePath '%~f0' -Verb RunAs -Wait } catch { exit 1 }"
  exit /b %errorlevel%
)

echo [BILGI] Calisan agent durduruluyor...
schtasks /End /TN "%TASK%" >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*agent.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

:ask
echo.
set "KOD="
set /p KOD="Admin panelindeki yeni eslestirme kodunu girin: "
if "%KOD%"=="" goto ask
node --disable-warning=ExperimentalWarning agent.js enroll "%KOD%"
if %errorlevel% neq 0 (
  echo [HATA] Eslestirme basarisiz. Kod 10 dk gecerli ve tek kullanimlik; panelden yeni kod alin.
  goto ask
)

schtasks /Query /TN "%TASK%" >nul 2>&1
if %errorlevel% equ 0 (
  schtasks /Run /TN "%TASK%" >nul 2>&1
  echo [TAMAM] Agent yeni kimlikle arka planda calisiyor.
  timeout /t 8 >nul
  exit /b 0
)

echo [BILGI] Agent bu pencerede baslatiliyor. Pencereyi acik birakin.
node --disable-warning=ExperimentalWarning agent.js
pause
