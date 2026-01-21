# Permissions System Documentation

## Overview

The Control Panel implements a role-based permissions system that controls access to features and functionality. Permissions are received from the server via the `AccountPermissions` RPC when connecting in **Bridge mode only**. Legacy Rcon mode does not support permissions.

---

## Permission List

The system defines **16 account permissions** organized by feature area:

### Console Permissions

| Permission | Description |
|------------|-------------|
| `console_view` | View console/log output |
| `console_input` | Send console commands |

### Chat Permissions

| Permission | Description |
|------------|-------------|
| `chat_view` | View chat messages |
| `chat_input` | Send chat messages |

### Player Permissions

| Permission | Description |
|------------|-------------|
| `players_view` | View player list |
| `players_ip` | View player IP addresses/geolocation |
| `players_inventory` | Access player inventories |

### Entity Permissions

| Permission | Description |
|------------|-------------|
| `entities_view` | View and search entities |
| `entities_edit` | Edit/delete entity properties |

### Permission Management

| Permission | Description |
|------------|-------------|
| `permissions_view` | View permission groups interface |
| `permissions_edit` | Modify group permissions |

### Profiler Permissions

| Permission | Description |
|------------|-------------|
| `profiler_view` | View profiler tab |
| `profiler_load` | Load profiler recordings |
| `profiler_edit` | Start/stop profiling, delete recordings |

### Plugin Permissions

| Permission | Description |
|------------|-------------|
| `plugins_view` | View plugin list |
| `plugins_edit` | Load/unload/reload plugins |

---

## How Permissions Are Received

### RPC Handler

**Location:** `ControlPanel.SaveLoad.ts:562-579`

```typescript
this.setRpc('AccountPermissions', (read) => {
  this.RpcPermissions['console_view'] = read.bool()
  this.RpcPermissions['console_input'] = read.bool()
  this.RpcPermissions['chat_view'] = read.bool()
  this.RpcPermissions['chat_input'] = read.bool()
  this.RpcPermissions['players_view'] = read.bool()
  this.RpcPermissions['players_ip'] = read.bool()
  this.RpcPermissions['players_inventory'] = read.bool()
  this.RpcPermissions['entities_view'] = read.bool()
  this.RpcPermissions['entities_edit'] = read.bool()
  this.RpcPermissions['permissions_view'] = read.bool()
  this.RpcPermissions['permissions_edit'] = read.bool()
  this.RpcPermissions['profiler_view'] = read.bool()
  this.RpcPermissions['profiler_load'] = read.bool()
  this.RpcPermissions['profiler_edit'] = read.bool()
  this.RpcPermissions['plugins_view'] = read.bool()
  this.RpcPermissions['plugins_edit'] = read.bool()
})
```

### Binary Wire Format

```
┌─────────────┬─────────────────┬───────────────────────────────────────────┐
│ Header (4B) │ RPC ID (4B)     │ Permissions (16 × 1 byte each)            │
│ int32: 0    │ uint32: hash    │ bool × 16 (in order listed above)         │
└─────────────┴─────────────────┴───────────────────────────────────────────┘
```

### Request Timing

Permissions are requested immediately after connection is established.

**Location:** `ControlPanel.SaveLoad.ts:861`

```typescript
this.Socket.onopen = () => {
  // ... other initialization
  if (this.Bridge) {
    this.sendCall('ServerInfo')
    this.sendCall('CarbonInfo')
    // ...
    this.sendCall('AccountPermissions')  // Permissions requested here
  }
}
```

---

## Permission Storage

### Server Class Property

**Location:** `ControlPanel.SaveLoad.ts:354`

```typescript
export class Server {
  // ... other properties
  RpcPermissions: any | null = []  // Permission storage object
}
```

### Clearing on Disconnect

**Location:** `ControlPanel.SaveLoad.ts:430`

```typescript
clear() {
  // ...
  this.RpcPermissions = {}  // Cleared on disconnect
  // ...
}
```

### Persistence

Permissions are **NOT persisted** to localStorage. They are excluded from export.

**Location:** `ControlPanel.SaveLoad.ts:192`

```typescript
export function exportToJson(): string {
  return JSON.stringify(servers.value, (key, value) => {
    switch (key) {
      // ...
      case 'RpcPermissions':  // Excluded from persistence
        return undefined
    }
    return value
  })
}
```

---

## Permission Check Function

### `hasPermission()`

**Location:** `ControlPanel.SaveLoad.ts:410-415`

```typescript
hasPermission(permission: string) {
  if (permission in this.RpcPermissions) {
    return this.RpcPermissions[permission]
  }
  return true  // Default to true if permission not defined
}
```

**Behavior:**
- Returns the boolean value if permission exists
- Returns `true` by default if permission is not defined (permissive fallback)
- Used throughout UI for conditional rendering

---

## UI Impact by Permission

### Tab Visibility

Entire tabs are hidden based on `*_view` permissions.

**Location:** `ControlPanel.vue:55-102`

```typescript
const subTabs = [
  {
    Name: 'Console',
    IsDisabled: () => !selectedServer.value?.hasPermission('console_view')
  },
  {
    Name: 'Chat',
    IsDisabled: () => !selectedServer.value?.hasPermission('chat_view')
  },
  {
    Name: 'Information',
    // No permission required - always visible
  },
  {
    Name: 'Players',
    IsDisabled: () => !selectedServer.value?.Bridge || !selectedServer.value?.hasPermission('players_view')
  },
  {
    Name: 'Permissions',
    IsDisabled: () => !selectedServer.value?.Bridge || !selectedServer.value?.hasPermission('permissions_view')
  },
  {
    Name: 'Entities',
    IsDisabled: () => !selectedServer.value?.Bridge || !selectedServer.value?.hasPermission('entities_view')
  },
  {
    Name: 'Profiler',
    IsDisabled: () => !selectedServer.value?.Bridge || !selectedServer.value?.hasPermission('profiler_view')
  },
  {
    Name: 'Plugins',
    IsDisabled: () => !selectedServer.value?.Bridge || !selectedServer.value?.hasPermission('plugins_view')
  },
  {
    Name: 'Stats',
    IsDisabled: () => false  // Always visible
  }
]
```

**Rendering Logic:** `ControlPanel.vue:282`

```vue
<button
  v-for="(tab, index) in subTabs"
  v-show="tab.IsDisabled == null || !tab.IsDisabled()"
  ...
>
```

---

### Console Tab

#### `console_input`

**Location:** `ControlPanel.Tabs.Console.vue:14`

```vue
<div v-if="selectedServer?.hasPermission('console_input')" class="flex gap-2">
  <!-- Command input field -->
  <!-- Send button -->
  <!-- Clear button -->
</div>
```

**Effect:** Hides the entire command input section.

---

### Chat Tab

#### `chat_input`

**Location:** `ControlPanel.Tabs.Chat.vue:14`

```vue
<div v-if="selectedServer?.hasPermission('chat_input')" class="flex gap-2">
  <!-- Username input -->
  <!-- Color picker (Bridge only) -->
  <!-- Message input -->
  <!-- Send button -->
</div>
```

**Effect:** Hides the entire chat input section.

---

### Players Tab

#### `players_inventory`

**Location:** `ControlPanel.Tabs.Players.vue:92-97`

```vue
<button
  v-if="selectedServer?.hasPermission('players_inventory')"
  class="..."
  @click="showInventory(player.SteamID, player.DisplayName)">
  Inventory
</button>
```

**Effect:** Hides the "Inventory" button for each player row.

#### `players_ip`

This permission controls whether the server sends IP address data. The UI displays geolocation flags based on `player.Address`:

```vue
<img :src="geoFlagCache[player.Address]" class="w-4 h-4" />
```

**Effect:** Server-side enforcement - IP data not sent if permission is false.

---

### Player Inventory Popup

#### `console_input`

**Location:** `ControlPanel.Popup.PlayerInventory.vue:62-67`

```vue
<div :class="'inventory-grid-tools cols-' + (selectedServer?.hasPermission('console_input') ? '5' : '2')">
  <!-- Inventory slots -->
  <div v-if="selectedServer?.hasPermission('console_input')" class="slot-tool">
    <!-- Item search -->
    <!-- Amount input -->
    <!-- Give button -->
  </div>
</div>
```

**Effect:**
- Hides "Give Item" tool
- Changes grid layout from 5 columns to 2 columns

---

### Profiler Tab

#### `profiler_edit`

**Location:** `ControlPanel.Tabs.Profiler.vue:39`

```vue
<div v-if="selectedServer?.hasPermission('profiler_edit')">
  <!-- Duration input -->
  <!-- Start button -->
  <!-- Stop button -->
  <!-- Abort button -->
</div>
```

**Effect:** Hides all profiler control buttons.

#### `profiler_load`

**Location:** `ControlPanel.Tabs.Profiler.vue:89`

```vue
<button v-if="selectedServer?.hasPermission('profiler_load')" @click="loadProfile(file)">
  Load
</button>
```

**Effect:** Hides "Load" button for each profile recording.

#### `profiler_edit` (Delete)

**Location:** `ControlPanel.Tabs.Profiler.vue:90`

```vue
<button v-if="selectedServer?.hasPermission('profiler_edit')" @click="deleteProfile(file)">
  Delete
</button>
```

**Effect:** Hides "Delete" button for each profile recording.

---

### Plugins Tab

#### `plugins_edit`

**Location:** `ControlPanel.Tabs.Plugins.vue:49-73`

```vue
<div v-if="selectedServer?.hasPermission('plugins_edit')">
  <button v-if="!plugin.IsUnloaded && !plugin.Errors" @click="unloadPlugin(...)">
    Unload
  </button>
  <button v-if="!plugin.IsUnloaded && !plugin.Errors" @click="reloadPlugin(...)">
    Reload
  </button>
  <button v-if="plugin.IsUnloaded || plugin.Errors" @click="loadPlugin(...)">
    Load
  </button>
  <button v-if="!plugin.IsUnloaded && !plugin.Errors" @click="openPluginDetails(...)">
    Details
  </button>
</div>
```

**Effect:** Hides all plugin action buttons (Unload, Reload, Load, Details).

---

### Entities Tab

#### `entities_edit`

This permission is received but **not currently enforced in the UI**. Edit and delete buttons are always visible if the Entities tab is accessible.

**Server-side enforcement:** The server may reject edit/delete operations if permission is false.

---

### Permissions Tab

#### `permissions_edit`

This permission is received but **not currently enforced in the UI**. Grant/revoke buttons are always visible if the Permissions tab is accessible.

**Server-side enforcement:** The server may reject permission changes if permission is false.

---

## Permission Matrix

| Permission | Tab Visibility | UI Elements Hidden | Server-Side |
|------------|---------------|-------------------|-------------|
| `console_view` | Console tab | - | - |
| `console_input` | - | Command input, Send/Clear buttons, Give Item tool | Yes |
| `chat_view` | Chat tab | - | - |
| `chat_input` | - | Chat input section | Yes |
| `players_view` | Players tab | - | - |
| `players_ip` | - | (IP data not sent) | Yes |
| `players_inventory` | - | Inventory button per player | Yes |
| `entities_view` | Entities tab | - | - |
| `entities_edit` | - | (Not enforced in UI) | Yes |
| `permissions_view` | Permissions tab | - | - |
| `permissions_edit` | - | (Not enforced in UI) | Yes |
| `profiler_view` | Profiler tab | - | - |
| `profiler_load` | - | Load button per recording | Yes |
| `profiler_edit` | - | Start/Stop/Abort, Delete buttons | Yes |
| `plugins_view` | Plugins tab | - | - |
| `plugins_edit` | - | All plugin action buttons | Yes |

---

## Bridge Mode Requirement

Most permissions only apply when connected in **Bridge mode**. Tab visibility checks include both permission and Bridge mode:

```typescript
IsDisabled: () => !selectedServer.value?.Bridge || !selectedServer.value?.hasPermission('...')
```

**Bridge-only tabs:**
- Players
- Permissions
- Entities
- Profiler
- Plugins

**Available in both modes:**
- Console
- Chat
- Information
- Stats

---

## Flow Diagram

```
Connection Established (Bridge Mode)
              │
              ▼
    sendCall('AccountPermissions')
              │
              ▼
    Server sends 16 boolean values
              │
              ▼
    AccountPermissions RPC handler
    stores in RpcPermissions object
              │
              ▼
    Vue components call hasPermission()
              │
              ▼
    v-if/v-show conditionals
    hide/show UI elements
              │
              ▼
    User interacts with visible features
              │
              ▼
    Server may additionally enforce
    permissions on RPC calls
```

---

## Key Files

| File | Purpose |
|------|---------|
| `ControlPanel.SaveLoad.ts:562-579` | `AccountPermissions` RPC handler |
| `ControlPanel.SaveLoad.ts:410-415` | `hasPermission()` function |
| `ControlPanel.SaveLoad.ts:354` | `RpcPermissions` property |
| `ControlPanel.vue:55-102` | Tab visibility definitions |
| `ControlPanel.Tabs.Console.vue:14` | Console input permission check |
| `ControlPanel.Tabs.Chat.vue:14` | Chat input permission check |
| `ControlPanel.Tabs.Players.vue:93` | Inventory button permission check |
| `ControlPanel.Tabs.Profiler.vue:39,89-90` | Profiler permission checks |
| `ControlPanel.Tabs.Plugins.vue:49-73` | Plugin action permission checks |
| `ControlPanel.Popup.PlayerInventory.vue:62-67` | Give item permission check |
