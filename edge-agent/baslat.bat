@echo off
chcp 65001 > nul
title OdivonGYM Edge Agent
cd /d "%~dp0"

echo ========================================================
echo   OdivonGYM Edge Agent (MainApi ^<-^> Gecis Cihazlari)
echo ========================================================
echo.

if not exist "config.json" (
    echo [UYARI] config.json bulunamadi, config.sample.json kopyalaniyor...
    copy config.sample.json config.json
    echo.
    echo [DIKKAT] config.json dosyasina cihaz IP'si, kullanici adi ve parolasini girin.
    pause
    exit /b
)

if exist "data\identity.json" goto run
echo [BILGI] Agent henuz eslestirilmemis.
set /p KOD="Admin panelindeki eslestirme kodunu girin: "
call npm run enroll -- %KOD%
if not exist "data\identity.json" (
    pause
    exit /b
)
echo.

:run

rem Otomatik baslatma kuruluysa agent arka planda calisir; pencere gerekmez.
schtasks /Query /TN "Odivon Edge Agent" >nul 2>&1
if %errorlevel% equ 0 (
    schtasks /Run /TN "Odivon Edge Agent" >nul 2>&1
    echo [TAMAM] Edge Agent arka planda calisiyor ^(Windows acilisinda otomatik baslar^).
    echo         Durumu admin panelindeki "cevrimici" bilgisinden takip edin.
    timeout /t 8 >nul
    exit /b
)

echo [BILGI] Otomatik baslatma kuruluyor ^(yonetici izni istenecek^)...
call "%~dp0servis-kur.bat" otomatik
schtasks /Query /TN "Odivon Edge Agent" >nul 2>&1
if %errorlevel% equ 0 (
    echo [TAMAM] Kurulum tamamlandi. Bu pencereyi kapatabilirsiniz.
    timeout /t 8 >nul
    exit /b
)

echo [UYARI] Otomatik baslatma kurulamadi; agent bu pencerede calisacak.
echo [BILGI] Edge Agent baslatiliyor. Pencereyi acik birakin veya kucultun.
echo.
call npm start
pause
