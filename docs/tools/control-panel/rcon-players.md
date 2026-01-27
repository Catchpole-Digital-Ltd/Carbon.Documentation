---
title: "RCon Players"
description: Detailed documentation of the RCON Players protocol, data models, and web implementation used in Carbon's Control Panel.
---

# RCon Players

The Players tab in Carbon's [Control Panel](/tools/control-panel/) provides real-time visibility and management of all players on a Rust server. It communicates over a WebSocket connection using Carbon's **Bridge** binary protocol to fetch, display, and interact with player data.

:::info Prerequisites
The Players tab requires the **Bridge** protocol to be enabled. It is not available when using legacy (plain-text) RCon. Ensure the server is started with the `-bridge.password` command-line flag. See the [Bridge documentation](/devs/features/bridge) for setup details.
:::

## Connection Overview

The Control Panel connects to a Carbon server over a WebSocket:

```
ws://<address>:<port>/<password>     # Standard
wss://<address>:<port>/<password>    # Secure (TLS)
```

When Bridge mode is enabled, the socket is set to binary (`arraybuffer`) mode. All messages use a compact binary serialization format rather than JSON, reducing bandwidth and improving parse performance.

## Protocol

### Message Framing

Every Bridge message follows this structure:

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

## Players RPC

### Request

To fetch the player list, the client sends a `Players` RPC with no additional payload:

| Offset | Type     | Value                              |
|--------|----------|------------------------------------|
| 0      | `int32`  | `0` (RPC channel)                  |
| 4      | `uint32` | MD5-derived ID of `"RPC_Players"`  |

This is sent automatically on connection and then every **10 seconds** as part of the periodic refresh cycle.

### Response

The server responds with a binary payload containing two consecutive lists: online players followed by sleeping players.

```
┌─────────────────────────────────────────┐
│ int32   playerCount                     │ ← Number of online players
│ Player[playerCount]                     │ ← Online player records
│ int32   sleeperCount                    │ ← Number of sleeping players
│ Player[sleeperCount]                    │ ← Sleeping player records
└─────────────────────────────────────────┘
```

### Player Record

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

## Player Inventory RPC

### Request

To fetch a specific player's inventory, the client sends a `SendPlayerInventory` RPC:

| Offset | Type     | Value                                          |
|--------|----------|------------------------------------------------|
| 0      | `int32`  | `0` (RPC channel)                              |
| 4      | `uint32` | MD5-derived ID of `"RPC_SendPlayerInventory"`  |
| 8      | `int32`  | Target player's entity ID                      |

While the inventory popup is open, this request is sent every **1 second** to keep the view up to date.

### Response

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

### Item Record

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

## Move Inventory Item RPC

### Request

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

### Container IDs

| ID  | Container         |
|-----|-------------------|
| `0` | Main inventory    |
| `1` | Belt / hotbar     |
| `2` | Wear / clothing   |
| `10`| Drop (ground)     |
| `11`| Discard (destroy) |

## Permissions

The server sends an `AccountPermissions` RPC on connection, containing a set of boolean flags that control what the client is allowed to see and do. The following permissions are relevant to the Players tab:

| Permission           | Type   | Description                                        |
|----------------------|--------|----------------------------------------------------|
| `players_view`       | `bool` | Whether the Players tab is visible at all           |
| `players_ip`         | `bool` | Whether player IP addresses are visible             |
| `players_inventory`  | `bool` | Whether the Inventory button is shown               |
| `console_input`      | `bool` | Whether commands can be sent (needed for Give Item) |

The Players tab is hidden entirely if `players_view` is `false` or if the Bridge protocol is not enabled.

## Geolocation

When the player list is received, the client resolves each player's IP address to a country flag using the [iplocation.net](https://iplocation.net) API:

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
| `ControlPanel.SaveLoad.ts` | `Server` class with WebSocket management, RPC registration, `readPlayer()` deserialization, `getAllPlayers()` and `getPlayer()` lookups |
| `ControlPanel.Tabs.Players.vue` | Vue component rendering the Players tab UI with search, team display, and action buttons |
| `ControlPanel.Inventory.ts` | Inventory state management, `Slot` model, `showInventory()` / `hideInventory()` lifecycle |
| `ControlPanel.Popup.PlayerInventory.vue` | Inventory popup with drag-and-drop grid, item search, and Give Item functionality |
| `BinaryReader.ts` | Binary deserialization utility (little-endian, UTF-8 strings) |
| `BinaryWriter.ts` | Binary serialization utility for outgoing RPC calls |

### Data Flow

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

1. **On connect** - The client immediately sends `Players` along with other initial RPCs (`ServerInfo`, `CarbonInfo`, etc.)
2. **Every 10 seconds** - A periodic timer sends `ServerInfo` and `Players` to keep the data current
3. **On tab mount** - The Players tab component calls `sendCall("Players")` when mounted

### Player Table Features

The Players tab displays a unified table of online and sleeping players with:

- **Search** - Case-insensitive filter by display name
- **Ping** - Shown with a country flag icon; hidden for sleeping players (ping = `-1`)
- **Steam links** - Direct links to Steam Community profile and Battlemetrics
- **Team view** - Expandable team member list with leader identification (crown icon)
- **Health bar** - Visual bar with percentage, capped at 100% width
- **Connection time** - Formatted as `Xh Xm Xs`
- **Inventory button** - Opens real-time inventory popup (requires `players_inventory` permission)

### Inventory Popup

The inventory popup provides:

- **Real-time sync** - Re-fetches inventory every 1 second
- **Drag and drop** - Move items between slots by dragging
- **Container grids** - Main (6x4), Wear (7x1), Belt (6x1)
- **Drop / Discard slots** - Special container IDs `10` and `11` to drop or destroy items
- **Give Item** - Searchable item autocomplete with amount input (requires `console_input` permission), executes `inventory.giveto` console command
- **Auto-close** - Closes automatically if the player disconnects
