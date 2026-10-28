@echo off
setlocal
chcp 65001 >nul
title OdivonGYM - ZKEMKeeper SDK Kurulumu
cd /d "%~dp0"

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo [BILGI] Eski ZKTeco SDK kaydi icin yonetici izni isteniyor...
  powershell -NoProfile -Command "try { Start-Process -FilePath '%~f0' -Verb RunAs -Wait } catch { exit 1 }"
  exit /b %errorlevel%
)

set "SDK=%~dp0vendor\zkemkeeper"
if not exist "%SDK%\zkemkeeper.dll" (
  echo [HATA] vendor\zkemkeeper\zkemkeeper.dll bulunamadi.
  pause
  exit /b 1
)

"%WINDIR%\SysWOW64\regsvr32.exe" /s "%SDK%\zkemkeeper.dll"
if %errorlevel% neq 0 (
  echo [HATA] zkemkeeper.dll kaydedilemedi. Hata: %errorlevel%
  pause
  exit /b 1
)

echo [TAMAM] 32-bit ZKEMKeeper SDK kaydedildi.
pause
exit /b 0
