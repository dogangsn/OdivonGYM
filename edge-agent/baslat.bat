@echo off
chcp 65001 > nul
title OdivonGYM - Perkotek YT-32 Turnike Ajanı

echo ========================================================
echo   OdivonGYM - Perkotek YT-32 Turnike Köprüsü (Edge Agent)
echo ========================================================
echo.

if not exist "node_modules\" (
    echo [BILGI] Gerekli paketler yukleniyor (npm install)...
    call npm install
    echo.
)

if not exist "config.json" (
    echo [UYARI] config.json bulunamadi! config.sample.json dosyasindan olusturuluyor...
    copy config.sample.json config.json
    echo.
    echo [DIKKAT] Lutfen config.json dosyasini acip salon Tenant ID ve Cihaz IP bilgilerinizi girin.
    pause
    exit /b
)

if not exist "serviceAccountKey.json" (
    echo [HATA] serviceAccountKey.json bulunamadi!
    echo Lutfen Firebase Console'dan indirdiginiz Service Account anahtarini
    echo bu klasore 'serviceAccountKey.json' olarak kopyalayin.
    pause
    exit /b
)

echo [BILGI] Edge Agent baslatiliyor...
echo Pencereyi acik birakin veya kucultun.
echo.

node agent.js

pause
