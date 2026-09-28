# Geçiş Sistemi — MainApi ↔ Edge Agent Sözleşmesi (v1)

Bu belge, OdivonGYM admin paneli, OdivonMainApi ve salondaki Edge Agent
arasındaki tek sözleşmedir. MainApi üyelik ve geçiş yetkisinin **tek kaynağıdır**;
Edge Agent Firebase'e hiç bağlanmaz, yalnızca MainApi'ye giden HTTPS isteği atar
ve cihazlarla yerel ağda konuşur.

Tüm yollar `/api/v1` önekiyle çalışır. Yanıtlar MainApi'nin standart
`{ success: true, data }` zarfını kullanır.

## 1. Veri modeli (tenant kapsamlı, `tenants/{tenantId}/...`)

### `gymTurnstileGates/{gateId}` — cihaz kaydı (mevcut koleksiyon, yeni alanlar)

| Alan | Tip | Not |
| --- | --- | --- |
| `name`, `location`, `direction` | mevcut | |
| `protocol` | `'yt-http-digest' \| 'zk-tcp-4370' \| 'vendor-sdk'` | Panelden seçilir. Eski kayıtlarda yoksa `yt-http-digest` kabul edilir. |
| `host` | string | Cihazın yerel IP'si (ör. `192.168.1.201`). |
| `port` | number \| null | YT HTTP için varsayılan 80, ZK için 4370. |
| `agentId` | string \| null | Cihazı yöneten agent. Eşleştirmede atanır. |
| `capabilities` | `{ events: boolean; userSync: boolean; doorOpen: boolean }` | Sunucu `protocol`'den türetir (bkz. §5). İstemci yazamaz. |
| `adapterStatus` | `'ready' \| 'hardware_pending' \| 'not_validated'` | Sunucu türetir. |
| `lastSeenAt` | timestamp \| null | Heartbeat'te cihaz `reachable: true` ise güncellenir. |
| `lastError` | string \| null | Heartbeat'ten. |
| `online` | boolean | **Okuma anında hesaplanır:** `lastSeenAt` son 30 sn içinde ve agent heartbeat'i son 30 sn içinde. Sabit değer yazılmaz. |

Cihaz parolası (Digest) **MainApi'de tutulmaz**; agent'ın yerel `config.json`
dosyasında `credentials[host]` altında durur.

### `gymAccessAgents/{agentId}` — eşleşmiş agent

`name`, `hostname`, `agentVersion`, `tokenHash` (sha256 hex), `gateIds: string[]`,
`createdAt`, `lastHeartbeatAt`, `revokedAt`.

Kimlik doğrulama için tenant bilinmeden erişilebilmesi gerektiğinden ayrıca
**üst düzey** bir dizin tutulur: `gymAgentIndex/{agentId} = { tenantId, tokenHash, revokedAt }`.

### `gymAgentPairingCodes/{sha256(code)}` — üst düzey, tek kullanımlık

`tenantId`, `gateIds`, `createdBy`, `expiresAt` (oluşturma + 10 dk), `usedAt`, `agentId`.
Kod 8 karakter, karışmayan alfabe (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`). Düz kod
saklanmaz.

### `gymDeviceCommands/{gateId}_{memberId}` — istenen yetki durumu

Her (cihaz, üye) çifti için **tek belge**; üzerine yazılır, kuyruk büyümez.

| Alan | Tip | Not |
| --- | --- | --- |
| `gateId`, `memberId` | string | |
| `userId` | string | Cihazdaki sabit kullanıcı kimliği = MainApi `memberNumber`. |
| `name` | string | Cihazda görünen ad (ASCII'ye indirgenmesi agent'ın işi). |
| `card` | string \| null | RFID kart no (`rfidCardNumber`). |
| `validEnd` | `'YYYYMMDD'` \| null | Üyelik bitiş günü, **Türkiye saatiyle** o günün sonuna kadar geçerli. |
| `enabled` | boolean | `false` ⇒ cihazdan yetki derhal kaldırılır. |
| `version` | integer | Her değişiklikte +1. |
| `status` | `'pending' \| 'delivered' \| 'applied' \| 'error'` | |
| `deliveredVersion`, `appliedVersion` | integer \| null | |
| `leaseUntil` | timestamp \| null | `delivered` iken 60 sn kiralama. |
| `attempts` | integer | |
| `lastError` | string \| null | |
| `updatedAt` | timestamp | |

**Üretim kuralı (sunucu):** Üye oluşturma, güncelleme (kart / üye no / ad),
yenileme, dondurma, iptal ve arşiv/silme işlemlerinin sonunda MainApi, tenant'taki
`capabilities.userSync === true` olan her cihaz için belgeyi yeniden hesaplar.
Hesaplanan alanlar (`userId`, `name`, `card`, `validEnd`, `enabled`) öncekiyle
aynıysa hiçbir şey yazmaz; farklıysa `version += 1`, `status = 'pending'`,
`leaseUntil = null`, `lastError = null`.

- `enabled = true` yalnızca üye aktif (iptal/arşiv/dondurulmuş değil), `memberNumber`
  dolu ve bitiş tarihi bugün (TR) veya sonrası ise.
- `validEnd`: üyeliğin `endsAt` değeri `Europe/Istanbul` saat dilimine çevrilip
  `YYYYMMDD` biçiminde yazılır.
- Tarayıcı artık `POST /gym/access/commands` ile senkron komutu **göndermez**.

### `gymAccessLogs/{gateId}_{eventId}` — geçiş kayıtları (mevcut koleksiyon)

Agent'tan gelen olaylar belge kimliği `{gateId}_{eventId}` ile **create-if-absent**
yazılır; tekrar gelen olay ikinci belge oluşturmaz. Ek alanlar: `gateId`,
`deviceUserId`, `card`, `eventId`, `source: 'agent'`, `rawVerifyMode`.
`status`: cihaz sonucu bildirdiyse `granted`/`denied`, bildirmediyse **`unknown`**
(agent ve sunucu tahmin etmez).

## 2. Admin uçları (Firebase auth + `gym` modülü + owner/admin rolü)

| Yöntem | Yol | Gövde / Yanıt |
| --- | --- | --- |
| POST | `/gym/access/agents/pairing-codes` | `{ gateIds: string[] }` → `{ code, expiresAt }` |
| GET | `/gym/access/agents` | agent listesi: `{ id, name, hostname, agentVersion, gateIds, lastHeartbeatAt, online, revokedAt }` |
| DELETE | `/gym/access/agents/:id` | agent'ı iptal eder (`revokedAt`), cihazlarının `agentId`'sini boşaltır |
| GET | `/gym/access/gates` | mevcut; §1 alanlarını ve hesaplanmış `online` değerini döner |
| POST/PATCH | `/gym/access/gates[/:id]` | `protocol`, `host`, `port` kabul eder; `capabilities`/`adapterStatus` istemciden kabul edilmez |
| GET | `/gym/access/sync` | `?gateId=&status=&limit=` → `gymDeviceCommands` listesi (panelde bekliyor / uygulandı / hata) |
| GET | `/gym/access/sync/summary` | `{ [gateId]: { pending, delivered, applied, error } }` |
| POST | `/gym/access/sync/resync` | `{ gateId }` → tenant'taki tüm üyeler için belgeleri yeniden hesaplar ve `pending` yapar (ilk kurulum) |

## 3. Agent uçları (agent kimliğiyle)

Kimlik başlığı: `Authorization: Agent <agentId>.<token>`.
Guard: `gymAgentIndex/{agentId}` okunur, `sha256(token)` sabit-zamanlı
karşılaştırılır, `revokedAt` boş olmalı; `TenantContext` agent'ın tenant'ıyla
kurulur. Agent yalnızca `gateIds` listesindeki cihazlara dokunabilir; listede
olmayan `gateId` ⇒ `403`.

### `POST /gym/access/agents/enroll` (kimliksiz, IP başına sıkı rate-limit)

İstek: `{ code, name, hostname, agentVersion }`
Yanıt: `{ agentId, token, tenantId, gateIds }`

Kod transaction içinde tüketilir (`usedAt` boş ve `expiresAt > now` olmalı).
Başarıda agent kaydı ve dizin yazılır, `gateIds` içindeki cihazların `agentId`'si
atanır. `token` 32 bayt rastgele, base64url; yalnızca bu yanıtta döner.

### `GET /gym/access/agents/work?limit=50`

Yanıt:
```json
{
  "devices": [
    { "gateId": "g1", "name": "Turnike 1", "protocol": "yt-http-digest",
      "host": "192.168.1.201", "port": 80, "direction": "in",
      "capabilities": { "events": true, "userSync": true, "doorOpen": false } }
  ],
  "items": [
    { "id": "g1_m1", "gateId": "g1", "memberId": "m1", "userId": "1042",
      "name": "Ayse Yilmaz", "card": "0012345678", "validEnd": "20261031",
      "enabled": true, "version": 7 }
  ],
  "pollAfterMs": 5000
}
```

**Atomik teslim:** Transaction içinde agent'ın cihazlarına ait
`status == 'pending'` **veya** (`status == 'delivered'` ve `leaseUntil < now`)
belgeler seçilir; her biri `status = 'delivered'`, `deliveredVersion = version`,
`leaseUntil = now + 60 sn`, `attempts += 1` yapılır. Aynı belge aynı anda iki
agent'a / iki isteğe teslim edilmez.

### `POST /gym/access/agents/work/:id/ack`

İstek: `{ version, result: 'applied' | 'error', verified: boolean, error?: string }`

- `version < belge.version` ⇒ eski sürümün sonucu; belge **değişmez**
  (yeni sürüm zaten `pending`). Yanıt `{ status: 'superseded' }`.
- `result = 'applied'` yalnızca `verified === true` ise kabul edilir
  (agent cihazdan geri okuyup doğruladı); aksi halde `400`.
- `applied` ⇒ `status = 'applied'`, `appliedVersion = version`, `leaseUntil = null`, `lastError = null`.
- `error` ⇒ `status = 'error'`, `lastError = error`, `leaseUntil = null`.
  Hata durumundaki belge bir sonraki üye değişikliğinde ya da `resync` ile
  yeniden `pending` olur; agent ayrıca kendi içinde üstel geri çekilmeyle yeniden dener
  (bkz. §4).

### `POST /gym/access/agents/events/batch`

İstek (en çok 500 olay):
```json
{ "events": [
  { "gateId": "g1", "eventId": "yt-000123", "userId": "1042", "card": null,
    "time": "2026-09-28T21:14:05+03:00", "direction": "in",
    "result": null, "verifyMode": "card", "raw": { } }
] }
```
Yanıt: `{ accepted, duplicates, rejected: [{ eventId, reason }] }`.
`userId` → `memberNumber` ile, o yoksa `card` → `rfidCardNumber` ile üye eşlenir.
`result` `null` ise log `status = 'unknown'`.

### `POST /gym/access/agents/heartbeat`

İstek: `{ agentVersion, queueDepth, devices: [{ gateId, reachable, lastError, lastEventAt, deviceTime }] }`
Etki: `gymAccessAgents.lastHeartbeatAt = now`; her cihaz için `reachable` ise
`lastSeenAt = now`, `lastError` yazılır. Agent 15 sn'de bir gönderir.

## 4. Agent davranışı (OdivonGYM/edge-agent)

- Her cihaz 5 sn'de bir taranır; tüm log sayfaları okunur, yeni kayıtlar yerel
  SQLite (`agent.db`) kuyruğuna alınır, sonra MainApi'ye toplu gönderilir.
  İnternet yoksa kuyruk diskte kalır; gönderim başarılı olunca silinir.
- Her iş öğesi cihaza uygulanır, cihazdan `GetUserInfo` ile geri okunur; alanlar
  eşleşirse `verified: true` ile `applied` onayı gönderilir. Eşleşmezse `error`.
- `enabled: false` ⇒ `DeleteUserInfo`; geri okumada kullanıcı yoksa doğrulanmış sayılır.
- Kapı açma (`doorOpen`) YT için **kapalıdır**; `SetDoorStatus=open` kalıcı açık
  konuma geçebileceğinden kullanılmaz.

## 5. Protokol yetenekleri (sunucu tablosu)

| protocol | events | userSync | doorOpen | adapterStatus |
| --- | --- | --- | --- | --- |
| `yt-http-digest` | ✓ | ✓ | ✗ | `hardware_pending` (fiziksel test geçince `ready`) |
| `zk-tcp-4370` | ✗ | ✗ | ✗ | `not_validated` |
| `vendor-sdk` | ✗ | ✗ | ✗ | `not_validated` |

## 6. Güvenlik notları

- Enroll dışındaki tüm agent uçları agent kimliği ister; Firebase ID token'ı ile
  agent uçlarına, agent token'ıyla admin uçlarına erişilemez.
- Agent token'ı ve eşleştirme kodu düz metin saklanmaz (sha256).
- Tenant kimliği hiçbir zaman istek gövdesinden alınmaz.
