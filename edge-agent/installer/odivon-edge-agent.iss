; Odivon Edge Agent kurulum programı (Inno Setup 6).
; Derleme: scripts/build-edge-agent-installer.ps1 ya da GitHub Actions "Edge Agent kurulum".
; build\ klasörü derleme betiği tarafından hazırlanır: build\node\node.exe ve build\app\...

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
AppId={{7B3F6A52-6C1E-4E77-9D4B-0D1E5E0A9A11}
AppName=Odivon Edge Agent
AppVersion={#AppVersion}
AppPublisher=Odivon
DefaultDirName=C:\Odivon\EdgeAgent
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist
OutputBaseFilename=OdivonEdgeAgentKurulum-{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=Odivon Edge Agent
SetupLogging=yes

[Languages]
Name: "tr"; MessagesFile: "compiler:Languages\Turkish.isl"

[Files]
Source: "..\build\node\*"; DestDir: "{app}\node"; Flags: recursesubdirs ignoreversion
Source: "..\build\app\*"; DestDir: "{app}\app"; Excludes: "config.json,data\*"; Flags: recursesubdirs ignoreversion
Source: "gorev.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "eski-kurulum.js"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{app}\app\data"

[INI]
Filename: "{app}\Odivon Edge Agent.url"; Section: "InternetShortcut"; Key: "URL"; String: "http://127.0.0.1:47800/"

[Icons]
Name: "{commondesktop}\Odivon Edge Agent"; Filename: "{app}\Odivon Edge Agent.url"
Name: "{commonprograms}\Odivon Edge Agent"; Filename: "{app}\Odivon Edge Agent.url"
Name: "{commonprograms}\Odivon Edge Agent - Log klasoru"; Filename: "{app}\app\data\logs"

[Run]
; Eski ZK cihazları için 32-bit üretici SDK'sı. Kayıt bu klasöre bağlıdır.
Filename: "{syswow64}\regsvr32.exe"; Parameters: "/s ""{app}\app\vendor\zkemkeeper\zkemkeeper.dll"""; StatusMsg: "ZK cihaz sürücüsü kaydediliyor..."; Flags: runhidden waituntilterminated
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\gorev.ps1"" -AppDir ""{app}"" -Action kur"; StatusMsg: "Arka plan görevi ve güvenlik duvarı ayarlanıyor..."; Flags: runhidden waituntilterminated
Filename: "{app}\Odivon Edge Agent.url"; Description: "Yönetim arayüzünü aç"; Flags: postinstall shellexec nowait skipifsilent

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\gorev.ps1"" -AppDir ""{app}"" -Action kaldir"; Flags: runhidden waituntilterminated; RunOnceId: "OdivonAgentTask"
Filename: "{syswow64}\regsvr32.exe"; Parameters: "/s /u ""{app}\app\vendor\zkemkeeper\zkemkeeper.dll"""; Flags: runhidden waituntilterminated; RunOnceId: "OdivonAgentSdk"

[Code]
// Dosyalar kopyalanmadan önce çalışan agent durdurulur (node.exe ve köprü kilitli kalmasın).
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Exec('schtasks.exe', '/End /TN "Odivon Edge Agent"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('taskkill.exe', '/F /IM zkemkeeper-bridge.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('powershell.exe', '-NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name=''node.exe''\" | Where-Object { $_.CommandLine -like ''*agent.js*'' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(1500);
  Result := '';
end;
