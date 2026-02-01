"""
Test SSE connection to the MCP server
"""
import requests
import json

# Test the SSE endpoint
sse_url = "http://127.0.0.1:8081/sse"
messages_url = "http://127.0.0.1:8081/messages/"

print("Testing MCP SSE connection...")
print(f"SSE endpoint: {sse_url}")
print(f"Messages endpoint: {messages_url}")
print()

# Test 1: GET request to /sse (should work for SSE connection and get session_id)
print("Test 1: GET /sse (Get session)")
session_id = None
try:
    response = requests.get(sse_url, stream=True, timeout=3)
    print(f"Status: {response.status_code}")
    
    # Try to read first SSE event to get session_id
    for line in response.iter_lines(decode_unicode=True):
        if line:
            print(f"SSE: {line}")
            if line.startswith("data:"):
                data = line.split(":", 1)[1].strip()
                # Extract session_id from URL like /messages/?session_id=xxx
                if "session_id=" in data:
                    session_id = data.split("session_id=")[1]
                    print(f"✓ Got session_id: {session_id}")
                    break
except requests.exceptions.ReadTimeout:
    # This is expected - we just need the first event
    if session_id:
        print("✓ Session established (timeout after getting session_id is normal)")
except Exception as e:
    print(f"Error: {e}")
print()

if not session_id:
    print("WARNING: Could not get session_id from SSE endpoint")
    session_id = "test-session-123"  # Use a test ID
    print(f"Using test session_id: {session_id}")
    print()

# Test 2: POST to /messages/ with proper MCP initialization and session_id
print("Test 2: POST /messages/ (Initialize)")
init_message = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {
            "name": "test-client",
            "version": "1.0.0"
        }
    }
}

try:
    response = requests.post(
        messages_url,
        json=init_message,
        headers={"Content-Type": "application/json"},
        params={"session_id": session_id},  # Add session_id as query parameter
        timeout=5
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
print()

# Test 3: List tools
print("Test 3: POST /messages/ (List Tools)")
list_tools_message = {
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
}

try:
    response = requests.post(
        messages_url,
        json=list_tools_message,
        headers={"Content-Type": "application/json"},
        params={"session_id": session_id},  # Add session_id as query parameter
        timeout=5
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")  # First 500 chars
except Exception as e:
    print(f"Error: {e}")
