@echo off
chcp 65001 > nul
title OdivonGYM Edge Agent

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

echo [BILGI] Edge Agent baslatiliyor. Pencereyi acik birakin veya kucultun.
echo.
call npm start
pause
