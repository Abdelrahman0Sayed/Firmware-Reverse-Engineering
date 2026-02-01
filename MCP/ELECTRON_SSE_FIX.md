# SSE Connection Fix for Electron App

## Problem
The standard MCP SDK `SSEClientTransport` doesn't properly extract and use the `session_id` from FastMCP server's SSE response, causing:
```
Received request without session_id
INFO: 127.0.0.1:57700 - "POST /messages/ HTTP/1.1" 400 Bad Request
```

## Solution
Created a custom SSE transport (`custom-sse-transport.js`) that:

1. ✅ Connects to `/sse` endpoint
2. ✅ Listens for the `endpoint` event
3. ✅ Extracts `session_id` from the event data
4. ✅ Includes `session_id` in all POST requests to `/messages/`

## Changes Made

### 1. Custom Transport (`custom-sse-transport.js`)
- Properly handles FastMCP's session-based SSE protocol
- Extracts `session_id` from the endpoint event
- Adds `session_id` as query parameter in all POST requests

### 2. Updated Dependencies (`package.json`)
```json
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.25.0",
  "eventsource": "^2.0.2",
  "node-fetch": "^2.7.0"
}
```

### 3. Updated Main Process (`main.js`)
- Replaced `SSEClientTransport` with `FastMCPSSETransport`
- Properly initializes the custom transport before connecting

### 4. Updated UI (`index.html`, `renderer.js`)
- Changed from command/args input to URL input
- Default URL: `http://127.0.0.1:8081/sse`

## How to Use

1. **Start the MCP Server:**
   ```bash
   python bridge_mcp_ghidra.py --transport sse
   ```

2. **Start the Electron App:**
   ```bash
   npm run dev
   ```

3. **Connect:**
   - The default URL `http://127.0.0.1:8081/sse` is pre-filled
   - Click "Connect" button
   - You should see: ✅ "Successfully connected to GhidraMCP server via SSE"

## Verification

Check the server logs - you should now see:
```
INFO: 127.0.0.1:xxxxx - "GET /sse HTTP/1.1" 200 OK
✅ SSE session established: <session_id>
INFO: 127.0.0.1:xxxxx - "POST /messages/?session_id=<session_id> HTTP/1.1" 202 Accepted
```

No more "Received request without session_id" errors! 🎉
