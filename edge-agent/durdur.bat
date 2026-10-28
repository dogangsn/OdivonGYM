@echo off
setlocal
chcp 65001 >nul
rem ============================================================
rem  OdivonGYM Edge Agent - durdur ve otomatik baslatmayi sil
rem  Agent'i kapatir ve "Odivon Edge Agent" gorevini siler.
rem  Klasor ve data\ (eslestirme kimligi, bekleyen kayitlar) silinmez.
rem  Yeniden baslatmak icin: baslat.bat
rem ============================================================

set "TASK=Odivon Edge Agent"

rem Yonetici degilse kendini yonetici olarak calistir
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo [BILGI] Agent'i durdurmak icin yonetici izni isteniyor...
  powershell -NoProfile -Command "try { Start-Process -FilePath '%~f0' -Verb RunAs -Wait } catch { exit 1 }"
  exit /b %errorlevel%
)

echo [BILGI] Odivon Edge Agent durduruluyor...
schtasks /End /TN "%TASK%" >nul 2>&1

rem Arka planda veya pencerede kalan agent surecini kapat
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*agent.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

schtasks /Query /TN "%TASK%" >nul 2>&1
if %errorlevel% equ 0 (
  schtasks /Delete /TN "%TASK%" /F >nul 2>&1
  echo [TAMAM] Otomatik baslatma gorevi silindi.
) else (
  echo [BILGI] Otomatik baslatma gorevi zaten yok.
)

echo.
echo  [TAMAM] Odivon Edge Agent durduruldu.
echo   - Bilgisayar acildiginda artik kendiliginden baslamaz.
echo   - Bekleyen gecis kayitlari data\agent.db icinde durur, kaybolmaz.
echo   - Yeniden calistirmak icin: baslat.bat
echo.
pause
exit /b 0
