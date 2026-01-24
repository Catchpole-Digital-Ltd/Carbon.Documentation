---
title: Console System
description: Technical documentation of the Control Panel's console system, including command execution, output streaming, and history management.
---

# Console System

The Control Panel provides a real-time console interface for executing server commands and viewing output. This document covers the console architecture, command execution, output handling, and user interaction features.

## Overview

The console system provides:
- Real-time command execution on the server
- Streaming console output display
- Command history with keyboard navigation
- Smart auto-scroll behavior
- Permission-based access control

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Console Output Display                 │    │
│  │  ┌───────────────────────────────────────────────┐  │    │
│  │  │ > status                                      │  │    │
│  │  │ hostname: My Server                           │  │    │
│  │  │ players: 50/100                               │  │    │
│  │  │ > say Hello                                   │  │    │
│  │  │ [CHAT] SERVER: Hello                          │  │    │
│  │  └───────────────────────────────────────────────┘  │    │
│  │                            ▼ Auto-scroll zone       │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Command Input: [____________________________] [Send]│    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Server Connection                        │
├──────────────────────────┬──────────────────────────────────┤
│     Bridge Protocol      │       Legacy Protocol            │
│  ┌────────────────────┐  │  ┌────────────────────────────┐  │
│  │ ConsoleInput RPC   │  │  │ JSON { Message, Id }       │  │
│  │ ConsoleLog RPC     │  │  │ console.tail command       │  │
│  │ ConsoleTail RPC    │  │  │ Raw message responses      │  │
│  └────────────────────┘  │  └────────────────────────────┘  │
└──────────────────────────┴──────────────────────────────────┘
```

## Command Execution

### Sending Commands

Commands are sent differently based on the protocol mode:

**Bridge Protocol:**
```
┌─────────────┬─────────────────┬──────────────────┐
│ Message Type│     RPC ID      │     Command      │
│   (int32)   │    (uint32)     │    (string)      │
│      0      │ md5(ConsoleInput)│  "status"       │
└─────────────┴─────────────────┴──────────────────┘
```

**Legacy Protocol:**
```json
{
  "Message": "status",
  "Identifier": 1
}
```

### Command Flow

```
User Input
    │
    ▼
┌─────────────────────┐
│ Validate non-empty  │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Add to display with │
│ ">" prefix          │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Add to history      │
│ (if not duplicate)  │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Send via WebSocket  │
│ (Bridge or Legacy)  │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Clear input field   │
│ Reset history index │
└─────────────────────┘
```

### User Command Display

When a user sends a command, it's immediately displayed with visual formatting:

```html
<span style="color: var(--category-misc);">
  <strong>></strong>
</span> status
```

This provides immediate feedback before the server responds.

## Console Output

### Initial Load (ConsoleTail)

On connection, the console requests recent history:

**Bridge Protocol Request:**
```
RPC: ConsoleTail
Parameters:
  int32     LineCount         // typically 200
```

**Response Format:**
```
int32     LogEntryCount

// For each entry:
┌─────────────────────────────────────────────┐
│ string    Message                           │
│ string    Type                              │
│ int32     Time              // Unix timestamp│
└─────────────────────────────────────────────┘
```

**Legacy Protocol:**
```
Command: console.tail
Identifier: 7

Response: JSON array of log objects
[
  { "Message": "Server started", "Type": "Generic", "Time": 1234567890 },
  { "Message": "Player connected", "Type": "Generic", "Time": 1234567891 }
]
```

### Real-Time Streaming (ConsoleLog)

New console output is pushed from the server:

**Bridge Protocol (server-initiated):**
```
RPC: ConsoleLog

Response:
┌─────────────────────────────────────────────┐
│ string    Message                           │
│ string    Type                              │
│ int32     Time                              │
└─────────────────────────────────────────────┘
```

**Legacy Protocol:**
```json
{
  "Message": "Player joined",
  "Identifier": 0,
  "Type": "Generic"
}
```

### Log Types

| Type | Description |
|------|-------------|
| Generic | Standard output |
| Error | Error messages |
| Warning | Warning messages |
| Chat | Chat messages (legacy) |
| Report | Player reports |
| ClientPerf | Client performance |
| Subscription | Subscription events |

### Chat Message Detection

In legacy mode, chat messages embedded in console output are detected and separated:

```
Pattern: /^\[CHAT\]\s+(.+?)\[(\d+)\]\s+:\s+(.+)$/

Example: "[CHAT] PlayerName[76561198012345678] : Hello world"
Captures:
  - Username: "PlayerName"
  - UserId: "76561198012345678"
  - Message: "Hello world"
```

Matched messages are routed to the chat display instead of console.

## Command History

### Storage Structure

```
CommandHistory: string[]

Index:  [0]      [1]      [2]      [3]
       "say hi" "status" "quit"  "help"
        ↑ Most recent            Oldest ↑
```

Commands are stored in reverse chronological order (newest first).

### Adding to History

```
1. Check if command is non-empty
2. Check if command differs from last entry (deduplication)
3. Prepend to history array (unshift)
4. Save to localStorage
```

Deduplication prevents consecutive identical commands from cluttering history.

### Navigation

| Key | Action |
|-----|--------|
| ↑ (Up Arrow) | Previous command (older) |
| ↓ (Down Arrow) | Next command (newer) |
| Enter | Execute command |

### Index State Machine

```
                    ┌─────────────────┐
         ┌─────────│  Index: -1      │◄────────┐
         │  Down   │  (Empty input)  │   Up    │
         │         └────────┬────────┘         │
         │                  │ Up               │
         ▼                  ▼                  │
┌─────────────────┐ ┌─────────────────┐        │
│  Index: len-1   │ │  Index: 0       │        │
│  (Oldest)       │ │  (Most recent)  │        │
└────────┬────────┘ └────────┬────────┘        │
         │                   │                 │
         │ Down              │ Up              │
         ▼                   ▼                 │
         └───────► ... ◄─────┘                 │
                    │                          │
                    └──────────────────────────┘
                           Wrap around
```

- Index `-1` represents empty input (no history selected)
- Navigation wraps circularly through history
- Selecting a history item populates the input field

## Auto-Scroll Behavior

### Smart Scrolling Algorithm

```
function shouldAutoScroll(container, forceScroll):
    scrollTop = container.scrollTop
    scrollHeight = container.scrollHeight
    clientHeight = container.clientHeight

    distanceFromBottom = scrollHeight - (scrollTop + clientHeight)

    if forceScroll:
        return true

    if distanceFromBottom <= 400:  // Within 400px of bottom
        return true

    return false
```

### Scroll Zones

```
┌─────────────────────────────────────┐
│                                     │
│    User is reading history          │  ← No auto-scroll
│    (scrolled up)                    │
│                                     │
├─────────────────────────────────────┤
│                                     │
│    Within 400px of bottom           │  ← Auto-scroll enabled
│                                     │
├─────────────────────────────────────┤
│ ▼ Current viewport                  │
└─────────────────────────────────────┘
```

### Invocation Points

| Trigger | Force Scroll | Behavior |
|---------|--------------|----------|
| ConsoleTail (initial load) | Yes | Always scroll to bottom |
| ConsoleLog (new output) | No | Smart scroll |
| Command sent | No | Smart scroll |
| Server selection | Yes | Always scroll to bottom |
| Tab selection | Yes | Always scroll to bottom |

## Log Buffer Management

### Storage

Logs are stored as an array of HTML strings on the Server instance:

```
Logs: string[] = []

Example contents:
[
  "<span style=\"color: var(--category-misc);\"><strong>></strong></span> status",
  "hostname: My Server",
  "players: 50/100",
  "<span style=\"color: var(--category-misc);\"><strong>></strong></span> say Hello",
  "[CHAT] SERVER: Hello"
]
```

### Characteristics

| Property | Value |
|----------|-------|
| Size limit | None (unbounded) |
| Persistence | Not persisted (lost on refresh) |
| Format | Raw HTML strings |
| Deduplication | None |

### Memory Considerations

- Logs accumulate indefinitely during a session
- Long sessions may consume significant memory
- Manual clear available via UI button
- Clearing also clears command history

## Permission System

### Required Permissions

| Permission | Capability |
|------------|------------|
| `console_view` | View console output |
| `console_input` | Send console commands |

### UI Behavior

```
If !hasPermission('console_view'):
    Console tab is disabled

If !hasPermission('console_input'):
    Console output visible
    Command input hidden
```

## Identified Commands (Legacy Mode)

In legacy mode, responses are routed by numeric identifier:

| Identifier | Command | Handler |
|------------|---------|---------|
| 0 | Server output | Display in console |
| 1 | User input echo | Display in console |
| 2 | serverinfo | Parse server info |
| 3 | c.version | Parse Carbon info |
| 4 | server.headerimage | Extract image URL |
| 5 | server.description | Extract description |
| 6 | playerlist | Parse player list |
| 7 | console.tail | Append to console |
| 8 | chat.tail | Append to chat |
| 100 | c.webpanel.cmd | RPC callback |

### Routing Logic

```
onMessage(response):
    identifier = response.Identifier

    if identifier in [0, 1]:
        // Regular console output
        appendLog(response.Message)
        return

    if identifier == 7:
        // Console tail response
        for log in response.data:
            appendLog(log.Message)
        return

    if identifier == 100:
        // RPC wrapper response
        rpcId = response.data.rpcId
        callbacks[rpcId](response.data)
        return

    // Other identified commands
    handleIdentifiedCommand(identifier, response.data)
```

## Global Command Execution

For executing commands across multiple servers:

### Request Tracking

```
Server state:
  PendingRequest: boolean       // Waiting for response
  LastGlobalCommand: string     // Command that was sent
  LastGlobalCommandResult: string  // Response received
```

### Flow

```
1. Set PendingRequest = true
2. Store LastGlobalCommand
3. Send command to server
4. Wait for ConsoleLog RPC
5. Store response in LastGlobalCommandResult
6. Set PendingRequest = false
7. Display result in UI
```

This allows tracking command results across multiple servers simultaneously.

## HTML Rendering

Console output supports HTML formatting:

### Supported Formatting

```html
<!-- User command prefix -->
<span style="color: var(--category-misc);">
  <strong>></strong>
</span>

<!-- Colored text -->
<span style="color: #ff0000;">Error message</span>

<!-- Links -->
<a href="https://example.com" target="_blank">Link</a>
```

### Security Note

Output is rendered with `v-html` without sanitization. Server-side output is trusted, but this could be a consideration for untrusted environments.

## State Persistence

| State | Persisted | Storage |
|-------|-----------|---------|
| Command history | Yes | localStorage |
| Console logs | No | Memory only |
| Scroll position | No | Memory only |
| Command input | No | Memory only |

### LocalStorage Format

```json
{
  "CommandHistory": ["status", "say hi", "quit"]
}
```

Command history is saved automatically after each command execution.

## Connection Lifecycle

### On Connect

```
1. Register RPC handlers (ConsoleTail, ConsoleLog)
2. Request ConsoleTail(200) for history
3. Begin receiving ConsoleLog pushes
```

### On Disconnect

```
1. Stop receiving ConsoleLog pushes
2. Logs remain in memory (not cleared)
3. Command history preserved in localStorage
```

### On Reconnect

```
1. Request fresh ConsoleTail(200)
2. Append to existing logs (no deduplication)
3. Resume ConsoleLog streaming
```

Note: Reconnection may cause duplicate log entries if the tail overlaps with previously received logs.
