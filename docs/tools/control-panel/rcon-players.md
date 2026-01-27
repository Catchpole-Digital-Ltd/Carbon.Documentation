---
title: "RCon Players"
description: Detailed documentation of the RCON Players protocol, data models, and web implementation used in Carbon's Control Panel.
---

# RCon Players

The Players tab in Carbon's [Control Panel](/tools/control-panel/) provides real-time visibility and management of all players on a Rust server. The Control Panel supports two distinct communication protocols — **Legacy RCon** (JSON over WebSocket) and **Bridge** (binary over WebSocket) — each with different capabilities for player data.

## Connection Overview

Both protocols connect over a standard WebSocket. The URL format is the same regardless of protocol:

```
ws://<address>:<port>/<password>     # Standard
wss://<address>:<port>/<password>    # Secure (TLS)
```

The user toggles the **Bridge** button in the Control Panel UI before connecting. This determines which protocol is used for the session.

| | Legacy RCon | Bridge |
|---|---|---|
| **Transport** | WebSocket (text frames) | WebSocket (binary `arraybuffer` frames) |
| **Encoding** | JSON | Custom binary serialization |
| **Player list** | Online players only | Online and sleeping players |
| **Team data** | Not available | Full team membership and leader |
| **Inventory management** | Not available | Real-time view, move, give, drop |
| **Permissions** | Not available | Fine-grained permission flags |
| **Geolocation flags** | Supported | Supported |

:::tip
The Players tab in the UI requires **Bridge** to be enabled. When using legacy RCon, the tab is hidden but player data is still fetched and stored internally (e.g. for the Information tab player count). See the [Bridge documentation](/devs/features/bridge) for setup details.
:::

## Legacy RCon Protocol

### Message Format

Legacy RCon uses JSON text frames. Every message sent to the server is a `CommandSend` object:

```json
{
  "Message": "<command>",
  "Identifier": <number>
}
```

Every response from the server is a `CommandResponse` object:

```json
{
  "Message": "<payload>",
  "Identifier": <number>,
  "Type": <LogType>,
  "Stacktrace": "<string>"
}
```

The `Identifier` field is used to match responses to the command that triggered them. The Control Panel uses well-known identifiers for each command type.

### Log Types

The `Type` field in responses indicates the message category:

| Value | Name           |
|-------|----------------|
| `0`   | Generic        |
| `1`   | Error          |
| `2`   | Warning        |
| `3`   | Chat           |
| `4`   | Report         |
| `5`   | ClientPerf     |
| `6`   | Subscription   |

### Player List Request

The client sends the `playerlist` command with identifier `6`:

```json
{
  "Message": "playerlist",
  "Identifier": 6
}
```

This is sent automatically on connection and then every **10 seconds** as part of the periodic refresh cycle.

### Player List Response

The server responds with a JSON array in the `Message` field (identifier `6`). The `Message` string must be parsed as JSON to extract the array:

```json
[
  {
    "SteamID": "76561198012345678",
    "OwnerSteamID": "76561198012345678",
    "DisplayName": "PlayerName",
    "Ping": 42,
    "Address": "192.168.1.10:12345",
    "ConnectedSeconds": 3600,
    "VoiationLevel": 0.0,
    "CurrentLevel": 1,
    "UnspentXp": 0,
    "Health": 100.0
  }
]
```

| Field              | Type     | Description                                           |
|--------------------|----------|-------------------------------------------------------|
| `SteamID`          | `string` | Player's 64-bit Steam ID                              |
| `OwnerSteamID`     | `string` | Owner's Steam ID (differs if family-shared)            |
| `DisplayName`      | `string` | Current in-game display name                           |
| `Ping`             | `number` | Latency in milliseconds                                |
| `Address`          | `string` | IP address and port (e.g. `192.168.1.10:12345`)        |
| `ConnectedSeconds` | `number` | Total seconds connected to the server                  |
| `VoiationLevel`    | `number` | Anti-cheat violation score                             |
| `CurrentLevel`     | `number` | Player's XP level                                      |
| `UnspentXp`        | `number` | Available unspent experience points                    |
| `Health`           | `number` | Current health points                                  |

:::warning Limitations
Legacy RCon only returns **online** players. Sleeping players, team data, entity IDs, and inventory management are not available. The Players tab in the UI is disabled when using this protocol — the data is only used internally by the Information tab.
:::

### Other Legacy Commands

The following commands are also sent on connection using legacy RCon:

| Command                | Identifier | Purpose                        |
|------------------------|------------|--------------------------------|
| `serverinfo`           | `2`        | Server information             |
| `console.tail`         | `7`        | Recent console logs            |
| `c.version`            | `3`        | Carbon version info            |
| `server.headerimage`   | `4`        | Server header image URL        |
| `server.description`   | `5`        | Server description text        |

## Bridge Protocol

### Message Framing

Every Bridge message follows this binary structure:

| Offset | Type     | Description                                              |
|--------|----------|----------------------------------------------------------|
| 0      | `int32`  | Channel identifier. Always `0` for RPC messages.         |
| 4      | `uint32` | RPC ID. An MD5-derived identifier for the method name.   |
| 8+     | varies   | Payload. Field types depend on the specific RPC.         |

### RPC Identification

RPC names are converted to numeric IDs using an MD5-based hash. The first four bytes of the MD5 digest of the string `RPC_<MethodName>` are read as a little-endian `uint32`:

```
ID = uint32_le( MD5( "RPC_Players" )[0..3] )
```

This same hashing scheme is used for all Bridge RPCs. The client and server both compute these IDs identically to match requests to handlers.

### Binary Encoding

All multi-byte integers and floats use **little-endian** byte order. The following primitive types are used throughout:

| Type     | Size    | Description                                                       |
|----------|---------|-------------------------------------------------------------------|
| `int32`  | 4 bytes | Signed 32-bit integer                                             |
| `uint32` | 4 bytes | Unsigned 32-bit integer                                           |
| `uint64` | 8 bytes | Unsigned 64-bit integer (used for Steam IDs and entity IDs)       |
| `float`  | 4 bytes | 32-bit IEEE 754 floating point                                    |
| `bool`   | 1 byte  | `0x01` = true, `0x00` = false                                     |
| `string` | varies  | UTF-8 encoded, prefixed with a `uint32` byte-length               |

### Players RPC

#### Request

To fetch the player list, the client sends a `Players` RPC with no additional payload:

| Offset | Type     | Value                              |
|--------|----------|------------------------------------|
| 0      | `int32`  | `0` (RPC channel)                  |
| 4      | `uint32` | MD5-derived ID of `"RPC_Players"`  |

This is sent automatically on connection and then every **10 seconds** as part of the periodic refresh cycle.

#### Response

The server responds with a binary payload containing two consecutive lists: online players followed by sleeping players.

```
┌─────────────────────────────────────────┐
│ int32   playerCount                     │ ← Number of online players
│ Player[playerCount]                     │ ← Online player records
│ int32   sleeperCount                    │ ← Number of sleeping players
│ Player[sleeperCount]                    │ ← Sleeping player records
└─────────────────────────────────────────┘
```

#### Player Record

Each player record has the following binary layout:

| Field              | Type     | Description                                            |
|--------------------|----------|--------------------------------------------------------|
| `SteamID`          | `uint64` | Player's 64-bit Steam ID                               |
| `OwnerSteamID`     | `uint64` | Owner's Steam ID (differs if family-shared)             |
| `DisplayName`      | `string` | Current in-game display name                            |
| `Ping`             | `int32`  | Latency in milliseconds (`-1` for sleeping players)     |
| `Address`          | `string` | IP address and port (e.g. `192.168.1.10:12345`)         |
| `EntityId`         | `uint64` | Server-side entity ID for this player                   |
| `ConnectedSeconds` | `int32`  | Total seconds connected to the server                   |
| `ViolationLevel`   | `float`  | Anti-cheat violation score                              |
| `CurrentLevel`     | `int32`  | Player's XP level                                       |
| `UnspentXp`        | `int32`  | Available unspent experience points                     |
| `Health`           | `float`  | Current health points                                   |
| `HasTeam`          | `bool`   | Whether the player belongs to a team                    |

If `HasTeam` is `true`, the following additional fields are present:

| Field        | Type       | Description                                    |
|--------------|------------|------------------------------------------------|
| `TeamLeader` | `uint64`   | Steam ID of the team leader                    |
| `TeamCount`  | `int32`    | Number of team members                         |
| `Team`       | `uint64[]` | Array of Steam IDs for each team member        |

:::warning Conditional Fields
The `TeamLeader`, `TeamCount`, and `Team` fields are **only present** when `HasTeam` is `true`. Attempting to read them otherwise will corrupt the binary stream position.
:::

### Player Inventory RPC

#### Request

To fetch a specific player's inventory, the client sends a `SendPlayerInventory` RPC:

| Offset | Type     | Value                                          |
|--------|----------|------------------------------------------------|
| 0      | `int32`  | `0` (RPC channel)                              |
| 4      | `uint32` | MD5-derived ID of `"RPC_SendPlayerInventory"`  |
| 8      | `int32`  | Target player's entity ID                      |

While the inventory popup is open, this request is sent every **1 second** to keep the view up to date.

#### Response

The response contains the player's active belt slot index followed by three sequential inventory containers:

```
┌─────────────────────────────────────────┐
│ int32   activeSlot                      │ ← Currently held belt slot index
│ Container  main                         │ ← Main inventory (24 slots)
│ Container  belt                         │ ← Belt/hotbar (6 slots)
│ Container  wear                         │ ← Clothing/armor (7 slots)
└─────────────────────────────────────────┘
```

Each **Container** is structured as:

```
┌─────────────────────────────────────────┐
│ int32   itemCount                       │
│ Item[itemCount]                         │
└─────────────────────────────────────────┘
```

#### Item Record

| Field                 | Type     | Description                                  |
|-----------------------|----------|----------------------------------------------|
| `ItemId`              | `int32`  | Rust item definition ID                       |
| `ShortName`           | `string` | Item short name (e.g. `rifle.ak`)             |
| `Amount`              | `int32`  | Stack size                                    |
| `Position`            | `int32`  | Slot index within the container               |
| `MaxCondition`        | `float`  | Maximum durability                            |
| `Condition`           | `float`  | Current durability                            |
| `ConditionNormalized` | `float`  | Durability as a 0.0-1.0 ratio                 |
| `HasCondition`        | `bool`   | Whether the item has durability               |

### Move Inventory Item RPC

#### Request

To move an item between inventory slots, the client sends a `MoveInventoryItem` RPC:

| Offset | Type     | Value                                          |
|--------|----------|------------------------------------------------|
| 0      | `int32`  | `0` (RPC channel)                              |
| 4      | `uint32` | MD5-derived ID of `"RPC_MoveInventoryItem"`    |
| 8      | `int32`  | Target player's entity ID                      |
| 12     | `int32`  | Source container ID                             |
| 16     | `int32`  | Source slot position                            |
| 20     | `int32`  | Destination container ID                        |
| 24     | `int32`  | Destination slot position                       |

#### Container IDs

| ID  | Container         |
|-----|-------------------|
| `0` | Main inventory    |
| `1` | Belt / hotbar     |
| `2` | Wear / clothing   |
| `10`| Drop (ground)     |
| `11`| Discard (destroy) |

### Sending Commands via Bridge

When Bridge is enabled, console commands are not sent as raw JSON packets. Instead, the client uses the `ConsoleInput` RPC:

| Offset | Type     | Value                                          |
|--------|----------|------------------------------------------------|
| 0      | `int32`  | `0` (RPC channel)                              |
| 4      | `uint32` | MD5-derived ID of `"RPC_ConsoleInput"`         |
| 8      | `string` | The command string to execute                  |

This is used by the Give Item feature in the inventory popup, which executes `inventory.giveto` as a console command.

### Account Permissions RPC

The server sends an `AccountPermissions` RPC on connection, containing a set of boolean flags that control what the client is allowed to see and do. The following permissions are relevant to the Players tab:

| Permission           | Type   | Description                                        |
|----------------------|--------|----------------------------------------------------|
| `players_view`       | `bool` | Whether the Players tab is visible at all           |
| `players_ip`         | `bool` | Whether player IP addresses are visible             |
| `players_inventory`  | `bool` | Whether the Inventory button is shown               |
| `console_input`      | `bool` | Whether commands can be sent (needed for Give Item) |

The full `AccountPermissions` response contains 16 boolean flags read sequentially:

```
console_view, console_input, chat_view, chat_input,
players_view, players_ip, players_inventory,
entities_view, entities_edit,
permissions_view, permissions_edit,
profiler_view, profiler_load, profiler_edit,
plugins_view, plugins_edit
```

The Players tab is hidden entirely if `players_view` is `false` or if the Bridge protocol is not enabled.

### Initial RPCs on Connect

When Bridge mode is active, the client sends the following RPCs immediately on WebSocket open:

| RPC                  | Purpose                                |
|----------------------|----------------------------------------|
| `ServerInfo`         | Server metadata (hostname, map, FPS)   |
| `CarbonInfo`         | Carbon version string                  |
| `ServerDescription`  | Server description text                |
| `ServerHeaderImage`  | Server header image URL                |
| `Players`            | Full player and sleeper list           |
| `Plugins`            | Loaded, unloaded, and failed plugins   |
| `ConsoleTail`        | Last 200 console log entries           |
| `ChatTail`           | Last 200 chat messages                 |
| `AccountPermissions` | Permission flags for this connection   |

## Geolocation

Regardless of protocol, when the player list is received, the client resolves each online player's IP address to a country flag using the [iplocation.net](https://iplocation.net) API:

```
GET https://api.iplocation.net/?ip=<ip>
```

Responses are cached client-side in a reactive map (`geoFlagCache`) keyed by IP address. The resulting country code is used to display a flag icon from `flagcdn.com`:

```
https://flagcdn.com/32x24/<country_code>.png
```

Localhost addresses (`127.0.0.1`) are skipped.

## Web Implementation

### Component Architecture

The Players feature spans several source files:

| File | Purpose |
|------|---------|
| `ControlPanel.SaveLoad.ts` | `Server` class with WebSocket management, protocol switching, RPC/command registration, `readPlayer()` deserialization, `getAllPlayers()` and `getPlayer()` lookups |
| `ControlPanel.Vue` | Root component with the 10-second refresh timer, tab visibility logic (Bridge + permission checks), and inventory slot initialization |
| `ControlPanel.Tabs.Players.vue` | Vue component rendering the Players tab UI with search, team display, and action buttons |
| `ControlPanel.Inventory.ts` | Inventory state management, `Slot` model, `showInventory()` / `hideInventory()` lifecycle |
| `ControlPanel.Popup.PlayerInventory.vue` | Inventory popup with drag-and-drop grid, item search, and Give Item functionality |
| `BinaryReader.ts` | Binary deserialization utility (little-endian, UTF-8 strings) — Bridge only |
| `BinaryWriter.ts` | Binary serialization utility for outgoing RPC calls — Bridge only |

### Data Flow

The data flow differs depending on the active protocol.

**Legacy RCon:**

```
Server (Rust)
    │
    ▼
WebSocket (JSON text frame)
    │
    ▼
Socket.onmessage → JSON.parse()
    │
    ▼
onIdentifiedCommand(6, data)
    │
    └─→ PlayerInfo = data (JSON array)
        └─→ fetchGeolocation() per IP → geoFlagCache{}
```

**Bridge:**

```
Server (Rust/Carbon)
    │
    ▼
WebSocket (binary arraybuffer)
    │
    ▼
Socket.onmessage → BinaryReader
    │
    ▼
onIdentifiedRpc() → RpcCallbacks["Players"]
    │
    ├─→ readPlayer() × playerCount   → PlayerInfo[]
    ├─→ readPlayer() × sleeperCount  → SleeperInfo[]
    └─→ fetchGeolocation() per IP    → geoFlagCache{}
                │
                ▼
        Vue Reactive State
                │
                ▼
    ControlPanel.Tabs.Players.vue
    (table rendering, search, team view)
```

### Refresh Cycle

The periodic refresh runs every 10 seconds for all connected servers:

| Protocol    | Commands sent                                  |
|-------------|-------------------------------------------------|
| Legacy RCon | `serverinfo` (ID `2`), `playerlist` (ID `6`)   |
| Bridge      | `ServerInfo` RPC, `Players` RPC                 |

Additionally:
- **On connect** — The full set of initial commands/RPCs is sent immediately (see [Initial RPCs on Connect](#initial-rpcs-on-connect) for Bridge, or [Other Legacy Commands](#other-legacy-commands) for RCon)
- **On tab mount** — The Players tab component sends a `Players` RPC when mounted (Bridge only)

### Player Table Features

The Players tab (Bridge only) displays a unified table of online and sleeping players with:

- **Search** — Case-insensitive filter by display name
- **Ping** — Shown with a country flag icon; hidden for sleeping players (ping = `-1`)
- **Steam links** — Direct links to Steam Community profile and Battlemetrics
- **Team view** — Expandable team member list with leader identification (crown icon)
- **Health bar** — Visual bar with percentage, capped at 100% width
- **Connection time** — Formatted as `Xh Xm Xs`; hidden for sleeping players
- **Inventory button** — Opens real-time inventory popup (requires `players_inventory` permission)

### Inventory Popup

The inventory popup (Bridge only) provides:

- **Real-time sync** — Re-fetches inventory every 1 second via `SendPlayerInventory` RPC
- **Drag and drop** — Move items between slots by dragging, sends `MoveInventoryItem` RPC
- **Container grids** — Main (6x4), Wear (7x1), Belt (6x1)
- **Drop / Discard slots** — Special container IDs `10` and `11` to drop or destroy items
- **Give Item** — Searchable item autocomplete with amount input (requires `console_input` permission), executes `inventory.giveto` via `ConsoleInput` RPC
- **Auto-close** — Closes automatically if the player disconnects
