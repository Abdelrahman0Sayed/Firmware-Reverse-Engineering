"""
Proper MCP SSE Client Example for Ghidra Bridge
"""
import requests
import json
import time
from threading import Thread

class MCPSSEClient:
    def __init__(self, base_url="http://127.0.0.1:8081"):
        self.base_url = base_url
        self.sse_url = f"{base_url}/sse"
        self.messages_url = f"{base_url}/messages/"
        self.session_id = None
        self.message_id = 0
        self.sse_thread = None
        self.running = False
        
    def connect(self):
        """Connect to the MCP server and get session_id"""
        print(f"Connecting to {self.sse_url}...")
        
        try:
            response = requests.get(self.sse_url, stream=True, timeout=3)
            if response.status_code != 200:
                print(f"❌ Failed to connect: {response.status_code}")
                return False
            
            # Read the first SSE event to get session_id
            for line in response.iter_lines(decode_unicode=True):
                if line and line.startswith("data:"):
                    data = line.split(":", 1)[1].strip()
                    if "session_id=" in data:
                        self.session_id = data.split("session_id=")[1]
                        print(f"✅ Connected! Session ID: {self.session_id}")
                        
                        # Start SSE listener in background
                        self.running = True
                        self.sse_thread = Thread(target=self._listen_sse, args=(response,))
                        self.sse_thread.daemon = True
                        self.sse_thread.start()
                        return True
                        
        except requests.exceptions.ReadTimeout:
            if self.session_id:
                return True
        except Exception as e:
            print(f"❌ Connection error: {e}")
            return False
            
        return False
    
    def _listen_sse(self, response):
        """Listen for SSE events in the background"""
        try:
            for line in response.iter_lines(decode_unicode=True):
                if not self.running:
                    break
                if line:
                    print(f"📨 SSE: {line}")
        except Exception as e:
            if self.running:
                print(f"⚠️  SSE connection closed: {e}")
    
    def send_message(self, method, params=None):
        """Send a JSON-RPC message to the MCP server"""
        if not self.session_id:
            print("❌ Not connected. Call connect() first.")
            return None
            
        self.message_id += 1
        message = {
            "jsonrpc": "2.0",
            "id": self.message_id,
            "method": method,
            "params": params or {}
        }
        
        try:
            response = requests.post(
                self.messages_url,
                json=message,
                headers={"Content-Type": "application/json"},
                params={"session_id": self.session_id},
                timeout=5
            )
            
            if response.status_code in [200, 202]:
                print(f"✅ Message sent: {method}")
                return response.text
            else:
                print(f"❌ Error {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Error sending message: {e}")
            return None
    
    def initialize(self):
        """Initialize the MCP session"""
        return self.send_message("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "ghidra-client",
                "version": "1.0.0"
            }
        })
    
    def list_tools(self):
        """List available tools"""
        return self.send_message("tools/list")
    
    def call_tool(self, tool_name, arguments=None):
        """Call a specific tool"""
        return self.send_message("tools/call", {
            "name": tool_name,
            "arguments": arguments or {}
        })
    
    def disconnect(self):
        """Close the connection"""
        self.running = False
        print("Disconnected")

# Example usage
if __name__ == "__main__":
    client = MCPSSEClient()
    
    # Connect to server
    if client.connect():
        # Initialize MCP session
        client.initialize()
        time.sleep(0.5)
        
        # List available tools
        print("\n--- Listing Tools ---")
        client.list_tools()
        time.sleep(0.5)
        
        # Example: Call list_functions tool
        print("\n--- Calling list_functions ---")
        client.call_tool("list_functions")
        time.sleep(0.5)
        
        # Example: Call list_methods with parameters
        print("\n--- Calling list_methods ---")
        client.call_tool("list_methods", {"offset": 0, "limit": 10})
        time.sleep(2)
        
        # Disconnect
        client.disconnect()
    else:
        print("Failed to connect to MCP server")
