using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Interop.zkemkeeper;

internal static class ZkemkeeperBridge
{
    private sealed class DeviceUser
    {
        public string EnrollNumber;
        public string Name;
        public string Card;
        public bool Enabled;
    }

    private static readonly object OutputLock = new object();
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    private static readonly Dictionary<string, DeviceUser> Users = new Dictionary<string, DeviceUser>();
    private static CZKEMClass Device;
    private static int MachineNumber = 1;
    private static string LastHidCard;
    private static DateTime LastHidAtUtc;
    private static volatile bool Running = true;
    private static volatile bool StdinClosed;
    /** Agent'tan gelen komutlar (stdin, satır başına bir JSON). COM çağrıları ana iş parçacığında yapılır. */
    private static readonly ConcurrentQueue<string> Commands = new ConcurrentQueue<string>();

    [STAThread]
    private static int Main(string[] args)
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        string host = ReadArgument(args, "--host", null);
        int port = ReadIntArgument(args, "--port", 4370);
        MachineNumber = ReadIntArgument(args, "--machine", 1);
        // Eski cihazlarda UDP ile tüm kullanıcıları / geçmişi okumak dakikalar sürebilir.
        bool skipUsers = HasFlag(args, "--skip-users");
        bool skipHistory = HasFlag(args, "--skip-history");

        if (String.IsNullOrWhiteSpace(host))
        {
            Emit(new { type = "error", message = "--host zorunludur." });
            return 2;
        }

        Console.CancelKeyPress += delegate(object sender, ConsoleCancelEventArgs eventArgs)
        {
            eventArgs.Cancel = true;
            Running = false;
        };

        try
        {
            Device = new CZKEMClass();
            Device.OnAttTransactionEx += OnAttTransactionEx;
            Device.OnHIDNum += OnHidNumber;
            Device.OnConnected += OnConnected;
            Device.OnDisConnected += OnDisconnected;

            if (!Device.Connect_Net(host, port))
            {
                int errorCode = 0;
                Device.GetLastError(ref errorCode);
                Emit(new { type = "error", message = "zkemkeeper Connect_Net başarısız.", errorCode = errorCode });
                return 3;
            }

            if (!skipUsers)
            {
                Emit(new { type = "stage", stage = "users" });
                LoadUsers();
            }
            EmitDeviceInfo(host, port);
            if (!skipHistory)
            {
                Emit(new { type = "stage", stage = "history" });
                ReadHistoricalEvents();
            }

            if (!Device.RegEvent(MachineNumber, 65535))
            {
                int errorCode = 0;
                Device.GetLastError(ref errorCode);
                Emit(new { type = "error", message = "zkemkeeper RegEvent başarısız.", errorCode = errorCode });
                return 4;
            }

            StartCommandReader();
            Emit(new { type = "ready", transport = "zkemkeeper-com", users = Users.Count, commands = true });
            while (Running)
            {
                Application.DoEvents();
                string line;
                while (Commands.TryDequeue(out line)) HandleCommand(line);
                // Agent kapandıysa köprü de kapanır; sahipsiz köprü cihaz bağlantısını tutmasın.
                if (StdinClosed) Running = false;
                Thread.Sleep(25);
            }

            return 0;
        }
        catch (Exception error)
        {
            Emit(new { type = "error", message = error.Message, detail = error.ToString() });
            return 1;
        }
        finally
        {
            try
            {
                if (Device != null) Device.Disconnect();
            }
            catch
            {
                // Süreç kapanırken cihaz zaten kopmuş olabilir.
            }
        }
    }

    private static void LoadUsers()
    {
        Users.Clear();
        if (!Device.ReadAllUserID(MachineNumber)) return;

        string enrollNumber;
        string name;
        string password;
        int privilege;
        bool enabled;
        while (Device.SSR_GetAllUserInfo(
            MachineNumber,
            out enrollNumber,
            out name,
            out password,
            out privilege,
            out enabled))
        {
            string card = null;
            try
            {
                string readCard;
                if (Device.GetStrCardNumber(out readCard)) card = Normalize(readCard);
            }
            catch
            {
                // Bazı eski firmware'ler kart alanını desteklemez.
            }

            string normalizedEnroll = Normalize(enrollNumber);
            if (normalizedEnroll == null) continue;
            Users[normalizedEnroll] = new DeviceUser
            {
                EnrollNumber = normalizedEnroll,
                Name = Normalize(name),
                Card = card == "0" ? null : card,
                Enabled = enabled
            };
        }
    }

    private static void ReadHistoricalEvents()
    {
        if (!Device.ReadGeneralLogData(MachineNumber)) return;

        string enrollNumber;
        int verifyMode;
        int inOutMode;
        int year;
        int month;
        int day;
        int hour;
        int minute;
        int second;
        int workCode = 0;
        while (Device.SSR_GetGeneralLogData(
            MachineNumber,
            out enrollNumber,
            out verifyMode,
            out inOutMode,
            out year,
            out month,
            out day,
            out hour,
            out minute,
            out second,
            ref workCode))
        {
            EmitEvent("history", enrollNumber, null, inOutMode, verifyMode, year, month, day, hour, minute, second, workCode);
        }
    }

    private static void OnAttTransactionEx(
        string enrollNumber,
        int isInvalid,
        int attState,
        int verifyMethod,
        int year,
        int month,
        int day,
        int hour,
        int minute,
        int second,
        int workCode)
    {
        EmitEvent("realtime", enrollNumber, isInvalid, attState, verifyMethod, year, month, day, hour, minute, second, workCode);
    }

    private static void OnHidNumber(int cardNumber)
    {
        LastHidCard = cardNumber > 0 ? cardNumber.ToString() : null;
        LastHidAtUtc = DateTime.UtcNow;
    }

    private static void OnConnected()
    {
        Emit(new { type = "status", connected = true });
    }

    private static void OnDisconnected()
    {
        Emit(new { type = "status", connected = false });
        // SDK kendiliğinden yeniden bağlanmıyor: kapan, agent köprüyü yeniden başlatsın.
        Running = false;
    }

    // ─── Agent komutları ─────────────────────────────────────────────────────
    //  {"id":1,"cmd":"getUser","enrollNumber":"14441"}
    //  {"id":2,"cmd":"setUser","enrollNumber":"14441","name":"AHMET Y","card":"9855037","enabled":true}
    //  {"id":3,"cmd":"enableUser","enrollNumber":"14441","enabled":false}
    //  {"id":4,"cmd":"deleteUser","enrollNumber":"14441"}
    //  {"id":5,"cmd":"listUsers"}
    // Yanıt: {"type":"result","id":1,"ok":true,"user":{...}} ya da {"type":"result","id":1,"ok":false,"error":"..."}

    private static void StartCommandReader()
    {
        var reader = new Thread(delegate ()
        {
            try
            {
                string line;
                while ((line = Console.In.ReadLine()) != null)
                {
                    if (!String.IsNullOrWhiteSpace(line)) Commands.Enqueue(line);
                }
            }
            catch
            {
                // stdin kapandı
            }
            StdinClosed = true;
        });
        reader.IsBackground = true;
        reader.Start();
    }

    private static void HandleCommand(string line)
    {
        object id = null;
        try
        {
            var command = Json.DeserializeObject(line) as Dictionary<string, object>;
            if (command == null) throw new InvalidOperationException("Komut JSON nesnesi olmalı.");
            command.TryGetValue("id", out id);
            string cmd = Text(command, "cmd");
            string enroll = Normalize(Text(command, "enrollNumber"));
            if (cmd != "listUsers" && enroll == null) throw new InvalidOperationException("enrollNumber zorunlu.");

            object result;
            if (cmd == "getUser") { UserRecord found = ReadUser(enroll); result = new { found = found != null, user = Public(found) }; }
            else if (cmd == "setUser") result = new { user = WriteUser(enroll, Text(command, "name"), Text(command, "card"), Flag(command, "enabled", true)) };
            else if (cmd == "enableUser") result = new { user = EnableUser(enroll, Flag(command, "enabled", true)) };
            else if (cmd == "deleteUser") result = new { deleted = DeleteUser(enroll) };
            else if (cmd == "listUsers") { LoadUsers(); result = new { users = PublicUsers() }; }
            else throw new InvalidOperationException("Bilinmeyen komut: " + cmd);
            Emit(new { type = "result", id = id, ok = true, data = result });
        }
        catch (Exception error)
        {
            Emit(new { type = "result", id = id, ok = false, error = error.Message });
        }
    }

    /** Agent'a giden liste: getUser ile aynı küçük harfli alanlar (parola yok). */
    private static List<object> PublicUsers()
    {
        var list = new List<object>();
        foreach (DeviceUser user in Users.Values)
        {
            list.Add(new { enrollNumber = user.EnrollNumber, name = user.Name, card = user.Card, enabled = user.Enabled });
        }
        return list;
    }

    private sealed class UserRecord
    {
        public string enrollNumber;
        public string name;
        public string card;
        public bool enabled;
        public int privilege;
        public string password;
    }

    /** Önce SSR (dize kimlik), olmazsa eski siyah-beyaz cihaz (sayı kimlik) arayüzü denenir. */
    private static UserRecord ReadUser(string enroll)
    {
        string name, password;
        int privilege;
        bool enabled;
        bool found = false;
        try
        {
            found = Device.SSR_GetUserInfo(MachineNumber, enroll, out name, out password, out privilege, out enabled);
        }
        catch
        {
            name = null; password = null; privilege = 0; enabled = false;
        }
        int numeric;
        if (!found && Int32.TryParse(enroll, out numeric))
        {
            found = Device.GetUserInfo(MachineNumber, numeric, ref name, ref password, ref privilege, ref enabled);
        }
        if (!found) return null;
        string card = null;
        try
        {
            string readCard;
            if (Device.GetStrCardNumber(out readCard)) card = Normalize(readCard);
        }
        catch
        {
            // kart alanı desteklenmiyor
        }
        return new UserRecord
        {
            enrollNumber = enroll,
            name = Normalize(name),
            card = card == "0" ? null : card,
            enabled = enabled,
            privilege = privilege,
            password = password
        };
    }

    private static UserRecord WriteUser(string enroll, string name, string card, bool enabled)
    {
        UserRecord existing = ReadUser(enroll);
        // Var olan parola, yetki ve (yeni kart verilmediyse) kart korunur; parmak izi/yüz şablonlarına dokunulmaz.
        string password = existing != null ? existing.password ?? "" : "";
        int privilege = existing != null ? existing.privilege : 0;
        string finalName = Normalize(name) ?? (existing != null ? existing.name : null) ?? "";
        string finalCard = Normalize(card) ?? (existing != null ? existing.card : null);

        Device.EnableDevice(MachineNumber, false);
        try
        {
            Device.SetStrCardNumber(finalCard ?? "");
            bool ok = false;
            try
            {
                ok = Device.SSR_SetUserInfo(MachineNumber, enroll, finalName, password, privilege, enabled);
            }
            catch
            {
                ok = false;
            }
            int numeric;
            if (!ok && Int32.TryParse(enroll, out numeric))
            {
                ok = Device.SetUserInfo(MachineNumber, numeric, finalName, password, privilege, enabled);
            }
            if (!ok) throw new InvalidOperationException("Cihaz kullanıcıyı yazmadı (hata " + LastError() + ").");
            Device.RefreshData(MachineNumber);
        }
        finally
        {
            Device.EnableDevice(MachineNumber, true);
        }
        UserRecord after = ReadUser(enroll);
        if (after != null) Users[enroll] = new DeviceUser { EnrollNumber = enroll, Name = after.name, Card = after.card, Enabled = after.enabled };
        return Public(after);
    }

    private static UserRecord EnableUser(string enroll, bool enabled)
    {
        UserRecord existing = ReadUser(enroll);
        if (existing == null) throw new InvalidOperationException("Kullanıcı cihazda yok: " + enroll);
        bool ok = false;
        try
        {
            ok = Device.SSR_EnableUser(MachineNumber, enroll, enabled);
        }
        catch
        {
            ok = false;
        }
        int numeric;
        if (!ok && Int32.TryParse(enroll, out numeric))
        {
            ok = Device.EnableUser(MachineNumber, numeric, MachineNumber, 0, enabled);
        }
        if (!ok)
        {
            // Bazı firmware'ler EnableUser desteklemez: aynı bilgilerle Enabled alanı yazılır.
            return WriteUser(enroll, existing.name, existing.card, enabled);
        }
        Device.RefreshData(MachineNumber);
        return Public(ReadUser(enroll));
    }

    private static bool DeleteUser(string enroll)
    {
        if (ReadUser(enroll) == null) return true;
        bool ok = false;
        Device.EnableDevice(MachineNumber, false);
        try
        {
            try
            {
                ok = Device.SSR_DeleteEnrollData(MachineNumber, enroll, 12);
            }
            catch
            {
                ok = false;
            }
            int numeric;
            if (!ok && Int32.TryParse(enroll, out numeric))
            {
                ok = Device.DeleteEnrollData(MachineNumber, numeric, MachineNumber, 12);
            }
            Device.RefreshData(MachineNumber);
        }
        finally
        {
            Device.EnableDevice(MachineNumber, true);
        }
        Users.Remove(enroll);
        if (!ok && ReadUser(enroll) != null) throw new InvalidOperationException("Cihaz kullanıcıyı silmedi (hata " + LastError() + ").");
        return true;
    }

    /** Parola dışarı verilmez. */
    private static UserRecord Public(UserRecord user)
    {
        if (user == null) return null;
        return new UserRecord { enrollNumber = user.enrollNumber, name = user.name, card = user.card, enabled = user.enabled, privilege = user.privilege };
    }

    private static int LastError()
    {
        int errorCode = 0;
        try
        {
            Device.GetLastError(ref errorCode);
        }
        catch
        {
        }
        return errorCode;
    }

    private static string Text(Dictionary<string, object> command, string key)
    {
        object value;
        return command.TryGetValue(key, out value) && value != null ? Convert.ToString(value) : null;
    }

    private static bool Flag(Dictionary<string, object> command, string key, bool fallback)
    {
        object value;
        if (!command.TryGetValue(key, out value) || value == null) return fallback;
        if (value is bool) return (bool)value;
        bool parsed;
        return Boolean.TryParse(Convert.ToString(value), out parsed) ? parsed : fallback;
    }

    private static void EmitEvent(
        string source,
        string enrollNumber,
        int? isInvalid,
        int attState,
        int verifyMethod,
        int year,
        int month,
        int day,
        int hour,
        int minute,
        int second,
        int workCode)
    {
        string normalizedEnroll = Normalize(enrollNumber);
        DeviceUser user = null;
        if (normalizedEnroll != null) Users.TryGetValue(normalizedEnroll, out user);
        string card = user != null ? user.Card : null;
        if (card == null && LastHidCard != null && DateTime.UtcNow.Subtract(LastHidAtUtc).TotalSeconds <= 3)
        {
            card = LastHidCard;
        }

        string timestamp;
        try
        {
            timestamp = new DateTime(year, month, day, hour, minute, second, DateTimeKind.Unspecified)
                .ToString("yyyy-MM-dd'T'HH:mm:ss");
        }
        catch
        {
            timestamp = null;
        }

        Emit(new
        {
            type = "event",
            source = source,
            enrollNumber = normalizedEnroll,
            card = card,
            deviceUserName = user != null ? user.Name : null,
            isInvalid = isInvalid,
            attState = attState,
            verifyMethod = verifyMethod,
            timestamp = timestamp,
            workCode = workCode
        });
    }

    private static void EmitDeviceInfo(string host, int port)
    {
        string serial = null;
        string mac = null;
        string firmware = null;
        try { Device.GetSerialNumber(MachineNumber, out serial); } catch { }
        try { Device.GetDeviceMAC(MachineNumber, ref mac); } catch { }
        try { Device.GetFirmwareVersion(MachineNumber, ref firmware); } catch { }
        Emit(new
        {
            type = "device",
            host = host,
            port = port,
            serialNumber = Normalize(serial),
            mac = Normalize(mac),
            firmware = Normalize(firmware)
        });
    }

    private static void Emit(object value)
    {
        lock (OutputLock)
        {
            Console.Out.WriteLine(Json.Serialize(value));
            Console.Out.Flush();
        }
    }

    private static string Normalize(string value)
    {
        if (String.IsNullOrWhiteSpace(value)) return null;
        return value.Trim().Trim('\0');
    }

    private static string ReadArgument(string[] args, string name, string fallback)
    {
        for (int index = 0; index + 1 < args.Length; index++)
        {
            if (String.Equals(args[index], name, StringComparison.OrdinalIgnoreCase)) return args[index + 1];
        }
        return fallback;
    }

    private static bool HasFlag(string[] args, string name)
    {
        foreach (string arg in args)
        {
            if (String.Equals(arg, name, StringComparison.OrdinalIgnoreCase)) return true;
        }
        return false;
    }

    private static int ReadIntArgument(string[] args, string name, int fallback)
    {
        int parsed;
        return Int32.TryParse(ReadArgument(args, name, null), out parsed) ? parsed : fallback;
    }
}
