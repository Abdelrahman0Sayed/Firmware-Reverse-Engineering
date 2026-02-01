# MCP SSE Connection Guide

## The 400 Bad Request Issue

When trying to connect to `http://127.0.0.1:8081/sse`, you may encounter:

```
INFO: 127.0.0.1:34747 - "POST /messages/ HTTP/1.1" 400 Bad Request
```

This happens because the MCP SSE protocol requires a **session-based connection flow**.

## Root Cause

The error occurs when you try to POST to `/messages/` without:
1. First establishing a session via GET `/sse`
2. Including the `session_id` query parameter in your POST requests

## Correct Connection Flow

### Step 1: Establish Session
```http
GET http://127.0.0.1:8081/sse
```

**Response:**
```
event: endpoint
data: /messages/?session_id=<unique_session_id>
```

### Step 2: Send Messages
```http
POST http://127.0.0.1:8081/messages/?session_id=<unique_session_id>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "your-client",
      "version": "1.0.0"
    }
  }
}
```

## Python Example

See [mcp_sse_client.py](./mcp_sse_client.py) for a complete working example.

Quick usage:
```python
from mcp_sse_client import MCPSSEClient

client = MCPSSEClient()
if client.connect():
    client.initialize()
    client.list_tools()
    client.call_tool("list_functions")
    client.disconnect()
```

## Testing Your Connection

Run the test script:
```bash
python test_sse_connection.py
```

Expected output:
```
✓ Got session_id: <session_id>
Status: 202 (Accepted)
```

## Common Mistakes

❌ **Wrong:** Direct POST without session
```bash
curl -X POST http://127.0.0.1:8081/messages/
# Returns: 400 Bad Request - "session_id is required"
```

❌ **Wrong:** POST with invalid session
```bash
curl -X POST "http://127.0.0.1:8081/messages/?session_id=invalid"
# Returns: 400 Bad Request - "Invalid session ID"
```

✅ **Correct:** GET session first, then POST with session_id
```bash
# 1. Get session (extract session_id from response)
curl http://127.0.0.1:8081/sse

# 2. Use the session_id in all subsequent requests
curl -X POST "http://127.0.0.1:8081/messages/?session_id=<extracted_id>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}'
```

## Integration with Your App

If you're using a JavaScript/TypeScript MCP client library, ensure it supports SSE transport and properly handles the session establishment. For the Electron app in this repository, you may need to update the client to use SSE transport instead of stdio.

### For Electron/Node.js

Install the MCP SDK with SSE support:
```bash
npm install @modelcontextprotocol/sdk
```

Use SSE transport:
```javascript
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');

const transport = new SSEClientTransport(
  new URL('http://127.0.0.1:8081/sse')
);

const client = new Client({
  name: 'ghidra-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);
```

## Troubleshooting

1. **Make sure the server is running**
   ```bash
   python bridge_mcp_ghidra.py --transport sse
   ```

2. **Check server logs** for detailed error messages

3. **Verify Ghidra backend is accessible**
   ```bash
   curl http://127.0.0.1:8080/methods?offset=0&limit=10
   ```

4. **Test with the provided client**
   ```bash
   python mcp_sse_client.py
   ```
