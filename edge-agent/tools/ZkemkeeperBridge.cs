using System;
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
    }

    private static readonly object OutputLock = new object();
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    private static readonly Dictionary<string, DeviceUser> Users = new Dictionary<string, DeviceUser>();
    private static CZKEMClass Device;
    private static int MachineNumber = 1;
    private static string LastHidCard;
    private static DateTime LastHidAtUtc;
    private static volatile bool Running = true;

    [STAThread]
    private static int Main(string[] args)
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        string host = ReadArgument(args, "--host", null);
        int port = ReadIntArgument(args, "--port", 4370);
        MachineNumber = ReadIntArgument(args, "--machine", 1);

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

            LoadUsers();
            EmitDeviceInfo(host, port);
            ReadHistoricalEvents();

            if (!Device.RegEvent(MachineNumber, 65535))
            {
                int errorCode = 0;
                Device.GetLastError(ref errorCode);
                Emit(new { type = "error", message = "zkemkeeper RegEvent başarısız.", errorCode = errorCode });
                return 4;
            }

            Emit(new { type = "ready", transport = "zkemkeeper-com", users = Users.Count });
            while (Running)
            {
                Application.DoEvents();
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
                Card = card == "0" ? null : card
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

    private static int ReadIntArgument(string[] args, string name, int fallback)
    {
        int parsed;
        return Int32.TryParse(ReadArgument(args, name, null), out parsed) ? parsed : fallback;
    }
}
