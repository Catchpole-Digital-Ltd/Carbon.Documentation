---
title: Map System
description: In-depth technical documentation of the Control Panel's interactive map system, including entity tracking, coordinate transformations, and real-time rendering.
---

# Map System

The Control Panel includes an interactive map system that displays the server's procedurally generated terrain with real-time entity tracking. This document provides an in-depth look at how the map works.

## Features

- **Live Map Image**: Displays the server's procedurally generated terrain
- **Real-Time Player Tracking**: Shows online and sleeping player positions
- **Monument Markers**: Displays named locations on the map
- **Dynamic Night Mode**: Adjusts brightness based on server time
- **Interactive Controls**: Pan, zoom, and fullscreen support
- **Entity Filtering**: Toggle which entity types to display

## Architecture Overview

The map system spans multiple files:

| File | Purpose |
|------|---------|
| `ControlPanel.Popup.Map.vue` | Popup wrapper for fullscreen map |
| `ServerMapImage.vue` | Core map rendering component |
| `ControlPanel.SaveLoad.ts` | Server class, RPCs, entity tracking |
| `ControlPanel.Tabs.Information.vue` | Embedded map display |

## User Interface

### Control Bar

The map includes a control bar in the top-right corner:

```
┌─────────────────────────────────────────────────────────────┐
│  12:45  │  −  │  100%  │  +  │ Reset │ ⛶ │ Map Markers │ 🌙 │
└─────────────────────────────────────────────────────────────┘
```

| Control | Function |
|---------|----------|
| Time Display | Shows current server time (HH:MM format) |
| − | Zoom out by 10% |
| Percentage | Current zoom level |
| + | Zoom in by 10% |
| Reset | Reset to default zoom and position |
| ⛶ | Open fullscreen map popup |
| Map Markers | Toggle monument labels |
| 🌙 | Toggle night mode brightness |

### Server Time Display

The server time is formatted from the `hour` float value:

```typescript
// hour = 12.75 (12:45 PM)
const hours = Math.floor(hour).toString().padStart(2, '0')      // "12"
const minutes = Math.floor((hour % 1) * 60).toString().padStart(2, '0')  // "45"
// Display: "12:45"
```

### Tracked Items Panel

The bottom-left panel allows filtering which entities appear on the map:

```
┌─────────────────────────────────────────┐
│ ● Tracked Items (2)                   ▾ │
├─────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐ │
│ │ Online Players  │ │ Offline Players │ │
│ │     (45)        │ │     (120)       │ │
│ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────┘
```

- **Collapsible**: Click header to expand/collapse
- **Entity Counts**: Shows count of each type currently on map
- **Toggle Chips**: Click to enable/disable tracking for each type
- **Visual State**: Active types highlighted in green, inactive are dimmed

### Fullscreen Mode

Clicking the expand button (⛶) opens the map in a popup:

```typescript
async function expand() {
  isDetached.value = true  // Hide embedded map

  addPopup(ControlPanel.Popup.Map, {
    src: mapImageUrl,
    live: true,
    title: 'Live Map',
    subtitle: serverHostname,
    isFullscreen: true,
    onClosed: () => {
      isDetached.value = false  // Restore embedded map
    }
  })
}
```

The embedded map is hidden while the popup is open to avoid duplicate rendering.

## Map Data Loading

### LoadMapInfo RPC

When a server is selected, the map metadata and image are requested:

```typescript
this.sendCall('LoadMapInfo')
```

The server responds with binary data containing the map image and metadata:

```typescript
this.setRpc('LoadMapInfo', read => {
  this.MapInfo = {
    imageWidth: read.int32(),
    imageHeight: read.int32(),
    imageUrl: URL.createObjectURL(
      new Blob([read.bytes(read.int32())], { type: 'image/png' })
    ),
    worldSize: read.int32(),
    availableTypes: Object.keys(MapEntityTypes).splice(
      Object.keys(MapEntityTypes).length / 2,
      Object.keys(MapEntityTypes).length
    ),
    entities: [],
    monuments: []
  }

  // Load monument locations
  const monumentCount = read.int32()
  for (let i = 0; i < monumentCount; i++) {
    this.MapInfo.monuments.push({
      label: read.string(),
      x: read.float(),
      y: read.float()
    })
  }
})
```

### Binary Protocol Format

```
LoadMapInfo Response:
┌─────────────────────────────────────────────────────┐
│ imageWidth      (int32)   - PNG width in pixels     │
│ imageHeight     (int32)   - PNG height in pixels    │
│ pngDataLength   (int32)   - Size of PNG data        │
│ pngData         (bytes)   - Raw PNG image bytes     │
│ worldSize       (int32)   - World size (e.g., 4250) │
│ monumentCount   (int32)   - Number of monuments     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ For each monument:                              │ │
│ │   label       (string)  - Monument name         │ │
│ │   x           (float)   - Normalized X (0-1)    │ │
│ │   y           (float)   - Normalized Y (0-1)    │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Map Image Blob

The PNG image is received as raw bytes and converted to a displayable URL:

```typescript
imageUrl: URL.createObjectURL(
  new Blob([read.bytes(read.int32())], { type: 'image/png' })
)
```

This creates a browser-managed blob URL (e.g., `blob:https://...`) that can be used as an image source.

## Coordinate System

### Normalized Coordinates

All positions use **normalized coordinates** ranging from 0.0 to 1.0:

- `x = 0.0` → West edge of map
- `x = 1.0` → East edge of map
- `y = 0.0` → South edge of map
- `y = 1.0` → North edge of map

This abstraction allows the system to work with any map size without needing to know the actual world dimensions.

### World to Map Transformation

The conversion from normalized coordinates to screen pixels:

```typescript
// For monuments and entities
mapPixelX = mapImage.clientWidth * normalizedX
mapPixelY = mapImage.clientHeight * (1 - normalizedY)
```

**Y-axis inversion** is necessary because:
- Game coordinates: Y increases northward (bottom to top)
- CSS coordinates: Y increases downward (top to bottom)

Applied in the template:

```vue
<div v-for="entity in selectedServer?.MapInfo?.entities"
     :style="{
       transform: `translate(
         ${(mapImage?.clientWidth ?? 0) * entity.x}px,
         ${(mapImage?.clientHeight ?? 0) * (1 - entity.y)}px
       )`
     }">
```

### Coordinate Flow Diagram

```
Server World Position (e.g., x=2125, z=1062 on 4250 map)
                    ↓
         Server Normalization
       (x/worldSize, z/worldSize)
                    ↓
    Normalized Coords (x=0.5, y=0.25)
                    ↓
         Binary Protocol Transfer
                    ↓
    Client receives (x=0.5, y=0.25)
                    ↓
         Pixel Calculation
    (imgWidth * x, imgHeight * (1-y))
                    ↓
    Screen Position (512px, 768px)
```

## Real-Time Entity Tracking

### Entity Types

```typescript
export enum MapEntityTypes {
  ActivePlayers = 0,
  SleepingPlayers = 1
}

export function getMapEntityTypeName(type: number) {
  switch(type) {
    case MapEntityTypes.ActivePlayers:
      return 'Online Players'
    case MapEntityTypes.SleepingPlayers:
      return 'Offline Players'
  }
}
```

### Tracking System

Entity tracking uses a 1-second polling interval:

```typescript
startMapEntityTracking() {
  this.clearMapEntityTracking()

  this.MapEntityUpdateInterval = setInterval(() => {
    if (this.MapInfo == null || this.MapSettings.trackedTypes == null) {
      return
    }

    const write = new BinaryWriter()
    write.int32(0)  // Message type: RPC
    write.uint32(this.getId('RequestMapEntities'))
    write.int32(this.MapSettings.trackedTypes.length)

    // Send which entity types to track
    for (let i = 0; i < this.MapSettings.trackedTypes.length; i++) {
      write.int32(this.MapSettings.trackedTypes[i])
    }

    this.Socket?.send(write.toArrayBuffer())
  }, 1000)  // 1 second interval
}
```

### RequestMapEntities RPC

**Request Format:**
```
┌────────────────────────────────────────┐
│ messageType     (int32)  - Always 0    │
│ rpcId           (uint32) - RPC hash    │
│ typeCount       (int32)  - # of types  │
│ ┌────────────────────────────────────┐ │
│ │ For each type:                     │ │
│ │   typeId      (int32)              │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

**Response Format:**
```
┌─────────────────────────────────────────────────────┐
│ entityCount     (int32)   - Number of entities      │
│ ┌─────────────────────────────────────────────────┐ │
│ │ For each entity:                                │ │
│ │   type        (int32)   - Entity type ID        │ │
│ │   entId       (uint64)  - Network entity ID     │ │
│ │   hasLabel    (bool)    - Has label flag        │ │
│ │   label       (string)  - If hasLabel is true   │ │
│ │   x           (float)   - Normalized X (0-1)    │ │
│ │   y           (float)   - Normalized Y (0-1)    │ │
│ └─────────────────────────────────────────────────┘ │
│ serverHour      (float)   - Current server time     │
└─────────────────────────────────────────────────────┘
```

### Response Handler

```typescript
this.setRpc('RequestMapEntities', read => {
  // Memory management: clear entities every 20 seconds
  if (performance.now() - timeSince.value > 20000) {
    timeSince.value = performance.now()
    this.MapInfo.entities.length = 0
  }

  const entityCount = read.int32()
  const batch = []

  for (let i = 0; i < entityCount; i++) {
    const entity = {
      type: read.int32(),
      entId: read.uint64(),
      label: read.bool() ? read.string() : undefined,
      x: read.float(),
      y: read.float()
    }
    batch.push(entity)
  }

  this.MapInfo.hour = read.float()

  // Merge with existing entities
  for (const element of batch) {
    const existing = this.MapInfo.entities.find(
      (x: any) => x.entId == element.entId
    )

    if (existing != null) {
      // Update existing entity (only changed properties)
      if (existing.label != element.label) existing.label = element.label
      if (existing.type != element.type) existing.type = element.type
      if (existing.x != element.x) existing.x = element.x
      if (existing.y != element.y) existing.y = element.y
    } else {
      // Add new entity
      this.MapInfo.entities.push(element)
    }
  }
})
```

### Memory Management

To prevent memory leaks from entities that have despawned or logged off, the entity array is cleared every 20 seconds:

```typescript
if (performance.now() - timeSince.value > 20000) {
  timeSince.value = performance.now()
  this.MapInfo.entities.length = 0
}
```

This ensures stale entities are removed while allowing the next update to repopulate active entities.

## Map Settings

### Configuration Structure

```typescript
MapSettings: {
  trackedTypes: number[]    // Entity type IDs to track
  showMarkers: boolean      // Show monument markers
  nightMode: boolean        // Apply day/night brightness
}
```

### Toggling Entity Types

```typescript
toggleTrackedType(i: number) {
  this.MapInfo.entities.length = 0  // Clear existing

  if (!this.hasTrackedType(i)) {
    this.MapSettings.trackedTypes.push(i)
  } else {
    this.MapSettings.trackedTypes = this.MapSettings.trackedTypes.filter(
      t => t !== i
    )
  }

  this.MapInfo.entities.length = 0
  this.startMapEntityTracking()  // Restart with new types
  save()
}

hasTrackedType(i: number): boolean {
  return this.MapSettings.trackedTypes.includes(i)
}
```

### Night Mode

Night mode dynamically adjusts map brightness based on server time:

```typescript
const getMapBrightness = computed(() => {
  return 0.3 + Math.cos(((hour.value - 12) / 24) * Math.PI * 2) * 0.35 + 0.35
})
```

**Brightness Curve:**

| Server Hour | Brightness | Description |
|-------------|------------|-------------|
| 0 (midnight) | 30% | Darkest |
| 6 (dawn) | 65% | Getting lighter |
| 12 (noon) | 100% | Brightest |
| 18 (dusk) | 65% | Getting darker |
| 24 (midnight) | 30% | Darkest |

Applied via CSS filter:

```vue
<img
  :src="src"
  :style="[
    selectedServer?.MapSettings?.nightMode
      ? { filter: `brightness(${getMapBrightness})` }
      : ''
  ]"
/>
```

## Entity Rendering

### Player Markers

Players are rendered as small colored dots on the map:

```
Online Player:        Sleeping Player:
    ┌───┐                 ┌───┐
    │ ● │ Green           │ ● │ Red (semi-transparent)
    └───┘                 └───┘
      │                     │
  ┌───────┐             ┌───────┐
  │ Name  │             │ Name  │  ← Hover label
  └───────┘             └───────┘
```

### Visual Indicators

Entities are rendered as colored dots with CSS:

```css
.entity-online {
  @apply bg-[#74cc00] w-[6px] h-[6px] rounded-full
         ring-1 ring-black/50 shadow-md;
}

.entity-offline {
  @apply bg-[#dd24247c] w-[6px] h-[6px] rounded-full
         ring-1 ring-black/50 shadow-md;
}
```

| Entity Type | Color | Size | Opacity | Description |
|-------------|-------|------|---------|-------------|
| Online Players | Green (#74cc00) | 6px | 100% | Currently connected |
| Sleeping Players | Red (#dd2424) | 6px | ~48% | Logged out but body remains |

### Marker Styling

Each marker includes:
- **Fill Color**: Entity type indicator
- **Ring**: 1px black border at 50% opacity
- **Shadow**: Drop shadow for depth
- **Shape**: Circular (rounded-full)

### Label Display

Labels appear on hover:

```vue
<span @mouseover="showLabel(idx, true)"
      @mouseout="showLabel(idx, false)">
  <div v-if="entity.type == 0" class="entity-online"></div>
  <div v-if="entity.type == 1" class="entity-offline"></div>
</span>

<div v-if="labelRefs[idx]"
     class="absolute left-1/2 -top-3 -translate-x-1/2
            text-[9px] px-[3px] rounded bg-black/70
            border border-white/10">
  {{ entity.label }}
</div>
```

### Monument Markers

Monuments are named locations on the map (Launch Site, Dome, Airfield, etc.).

**Visibility Control:**
```typescript
function toggleShowMarkers() {
  selectedServer.MapSettings.showMarkers = !selectedServer.MapSettings.showMarkers
  save()  // Persist to localStorage
}
```

**Rendering:**
```
┌─────────────────────────────────────────────┐
│           ┌───────────────┐                 │
│           │ Launch Site   │  ← Label        │
│           └───────────────┘                 │
│                  •  ← Monument position     │
│                                             │
└─────────────────────────────────────────────┘
```

**Label Styling:**
- Background: Semi-transparent black (70% opacity)
- Border: White with 10% opacity
- Font: 7px, no text wrapping
- Position: Centered on monument coordinates

**Monument Data Structure:**
```typescript
interface Monument {
  label: string   // HTML-formatted name (e.g., "Launch Site")
  x: number       // Normalized X position (0.0 - 1.0)
  y: number       // Normalized Y position (0.0 - 1.0)
}
```

Monument labels support HTML formatting, allowing rich text display with colors and icons if sent by the server.

## Pan and Zoom

### Transform-Based Rendering

The map uses CSS transforms for GPU-accelerated pan and zoom:

```vue
<div class="zpi-image transform-gpu"
     :style="{
       transform: `translate(${tx}px, ${ty}px) scale(${scale})`
     }">
  <img :src="src" />
  <!-- Entities and monuments rendered inside -->
</div>
```

### State Variables

```typescript
const tx = ref(0)      // X translation (pixels)
const ty = ref(0)      // Y translation (pixels)
const scale = ref(1)   // Zoom scale (1 = 100%)
```

### Zoom Configuration

```typescript
props: {
  minScale: 0.25,        // Maximum zoom out (4x)
  maxScale: 10,          // Maximum zoom in (10x)
  initialScale: 1,       // Starting zoom level
  zoomStep: 1.1,         // Button zoom increment (10%)
  wheelZoomSpeed: 0.0012 // Mouse wheel sensitivity
}
```

### Pointer Events

**Single Pointer (Pan):**

```typescript
function onPointerMove(ev: PointerEvent) {
  if (activePointers.size === 1 && lastPanAt) {
    const p = getContainerPoint(ev)
    const dx = p.x - lastPanAt.x
    const dy = p.y - lastPanAt.y
    tx.value += dx
    ty.value += dy
    lastPanAt = p
  }
}
```

**Two Pointers (Pinch Zoom):**

```typescript
function onPointerMove(ev: PointerEvent) {
  if (activePointers.size === 2) {
    const { midpoint, distance } = getMidpointAndDistance()

    if (pinchStart.distance > 0) {
      const factor = distance / pinchStart.distance
      scale.value = clamp(
        pinchStart.scale * factor,
        props.minScale,
        props.maxScale
      )

      // Adjust position to zoom toward pinch center
      const f = scale.value / pinchStart.scale
      tx.value = pinchStart.midpoint.x - f * (pinchStart.midpoint.x - pinchStart.tx)
      ty.value = pinchStart.midpoint.y - f * (pinchStart.midpoint.y - pinchStart.ty)
    }
  }
}
```

**Mouse Wheel:**

```typescript
function onWheel(ev: WheelEvent) {
  ev.preventDefault()
  const p = getContainerPoint(ev as unknown as PointerEvent)
  const factor = Math.exp(-ev.deltaY * props.wheelZoomSpeed)
  zoomAt(p, factor)
}
```

### Zoom At Point

Zooming maintains the point under the cursor:

```typescript
function zoomAt(p: Point, factor: number) {
  const newScale = clamp(scale.value * factor, props.minScale, props.maxScale)
  const f = newScale / scale.value

  // Adjust translation so point p stays fixed
  tx.value = p.x - f * (p.x - tx.value)
  ty.value = p.y - f * (p.y - ty.value)
  scale.value = newScale
}
```

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        INITIALIZATION                           │
├─────────────────────────────────────────────────────────────────┤
│ 1. User selects server                                          │
│ 2. sendCall('LoadMapInfo') sent                                 │
│ 3. Server responds with PNG + metadata                          │
│ 4. MapInfo populated (imageUrl, worldSize, monuments)           │
│ 5. startMapEntityTracking() called                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      POLLING LOOP (1s)                          │
├─────────────────────────────────────────────────────────────────┤
│ 1. Build RequestMapEntities with tracked types                  │
│ 2. Send via WebSocket                                           │
│ 3. Server responds with entity positions                        │
│ 4. Merge entities into MapInfo.entities                         │
│ 5. Vue reactivity triggers DOM update                           │
│ 6. Entities rendered at new positions                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     MEMORY CLEANUP (20s)                        │
├─────────────────────────────────────────────────────────────────┤
│ 1. Check if 20 seconds elapsed                                  │
│ 2. Clear MapInfo.entities array                                 │
│ 3. Next poll repopulates with current entities                  │
└─────────────────────────────────────────────────────────────────┘
```

## Performance Considerations

### Efficient Updates

- Only changed entity properties are updated (not entire objects)
- Entity lookup uses `find()` by `entId` (could be optimized with Map)
- DOM updates batched via Vue's reactivity system

### GPU Acceleration

- `transform-gpu` class enables hardware acceleration
- CSS transforms avoid layout recalculation
- Smooth 60fps pan/zoom on modern browsers

### Memory Management

- 20-second entity cleanup prevents unbounded growth
- Blob URLs should be revoked when map changes (currently not implemented)
- Interval cleared on disconnect via `clearMapEntityTracking()`

### Network Efficiency

- Binary protocol minimizes bandwidth
- Only tracked entity types requested
- 1-second interval balances freshness vs. bandwidth

## Map Data Structures

### MapInfo

```typescript
interface MapInfo {
  imageWidth: number       // PNG image width
  imageHeight: number      // PNG image height
  imageUrl: string         // Blob URL to PNG
  worldSize: number        // Server world size
  availableTypes: string[] // Entity type names
  entities: Entity[]       // Current entities
  monuments: Monument[]    // Map landmarks
  hour?: number            // Server time (0-24)
}
```

### Entity

```typescript
interface Entity {
  type: number      // MapEntityTypes enum value
  entId: bigint     // Network entity ID (uint64)
  label?: string    // Display name
  x: number         // Normalized X (0-1)
  y: number         // Normalized Y (0-1)
}
```

### Monument

```typescript
interface Monument {
  label: string     // HTML-formatted name
  x: number         // Normalized X (0-1)
  y: number         // Normalized Y (0-1)
}
```

## Integration Points

### Information Tab

The Information tab embeds a small map preview:

```vue
<ServerMapImage
  v-if="selectedServer?.MapInfo?.imageUrl"
  :src="selectedServer?.MapInfo?.imageUrl"
  :server="selectedServer"
/>
```

### Map Popup

The fullscreen map is opened via popup:

```typescript
async function openMap() {
  addPopup(
    (await import(`./ControlPanel.Popup.Map.vue`)).default,
    {
      title: 'Server Map',
      subtitle: selectedServer.value?.CachedHostname
    }
  )
}
```

### Tracking Control

Entity tracking is started when map info loads and stopped on disconnect:

```typescript
// On connection
this.setRpc('LoadMapInfo', read => {
  // ... load map data
  this.startMapEntityTracking()
})

// On disconnect
clear() {
  this.clearMapEntityTracking()
  this.MapInfo = null
}
```

## User Interaction Flow

### Initial Load

```
1. User selects server
           │
           ▼
2. Server connects
           │
           ▼
3. LoadMapInfo RPC sent
           │
           ▼
4. Server returns PNG + monuments
           │
           ▼
5. Map image displayed
           │
           ▼
6. startMapEntityTracking() called
           │
           ▼
7. Entity polling begins (1s interval)
```

### Viewing Player Positions

```
1. Enable "Online Players" in Tracked Items
           │
           ▼
2. RequestMapEntities includes type 0
           │
           ▼
3. Server returns player positions
           │
           ▼
4. Green dots appear on map
           │
           ▼
5. Hover over dot to see player name
```

### Zooming to a Location

```
Method 1: Mouse Wheel
  - Scroll up to zoom in
  - Scroll down to zoom out
  - Zoom centers on cursor position

Method 2: Buttons
  - Click + to zoom in 10%
  - Click - to zoom out 10%
  - Zoom centers on map center

Method 3: Pinch (Touch)
  - Two-finger pinch to zoom
  - Zoom centers on pinch midpoint

Method 4: Double-Click
  - Double-click to reset view
```

### Panning the Map

```
Mouse/Touch:
  1. Press and hold on map
  2. Drag to pan
  3. Release to stop

The map follows the pointer with 1:1 movement ratio.
```

## Settings Persistence

Map settings are saved to localStorage:

```typescript
MapSettings: {
  trackedTypes: number[]    // Which entity types to track
  showMarkers: boolean      // Monument visibility
  nightMode: boolean        // Brightness adjustment
}
```

Settings persist across page reloads and sessions.

## Limitations

- **Entity Types**: Currently limited to Online/Sleeping players
- **Update Rate**: Fixed 1-second polling interval
- **Memory**: Entity array cleared every 20 seconds (stale cleanup)
- **No Clustering**: High player counts may overlap markers
- **No Search**: Cannot search for specific players on map
