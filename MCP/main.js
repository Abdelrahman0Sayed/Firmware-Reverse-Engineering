const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fetch = require('node-fetch');

let mainWindow;
let sessionId = null;
let messagesUrl = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#1e1e1e',
    icon: path.join(__dirname, 'assets/icon.png')
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle MCP connection - Using plain fetch like Python requests
ipcMain.handle('connect-mcp', async (event, config) => {
  try {
    sessionId = null;

    const sseUrl = config.url || 'http://127.0.0.1:8081/sse';
    const baseUrl = sseUrl.replace('/sse', '');
    messagesUrl = `${baseUrl}/messages/`;
    
    console.log('Connecting to:', sseUrl);

    const response = await fetch(sseUrl, {
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to connect: ${response.status}`);
    }

    console.log('SSE connection established, reading stream...');

    const reader = response.body;
    let buffer = '';
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject({ success: false, message: 'Timeout waiting for session_id' });
      }, 5000);

      reader.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          console.log('SSE line:', line);
          
          if (line.startsWith('data:')) {
            const data = line.substring(5).trim();
            console.log('SSE data:', data);
            
            if (data.includes('session_id=')) {
              sessionId = data.split('session_id=')[1];
              console.log('✅ Got session_id:', sessionId);
              clearTimeout(timeout);
              resolve({ success: true, message: 'Connected to GhidraMCP via SSE' });
              
              // Don't close the stream, keep it open for future messages
              return;
            }
          }
        }
      });

      reader.on('error', (error) => {
        clearTimeout(timeout);
        console.error('Stream error:', error);
        reject({ success: false, message: 'Stream error' });
      });
    });
  } catch (error) {
    console.error('MCP connection error:', error);
    return { success: false, message: error.message };
  }
});

// Handle decompilation request - Direct HTTP like Python test
ipcMain.handle('decompile', async (event, { assembly, architecture, baseAddress }) => {
  try {
    if (!sessionId) {
      throw new Error('Not connected to MCP server');
    }

    // Step 1: List tools
    const listToolsMsg = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {}
    };

    const listResponse = await fetch(`${messagesUrl}?session_id=${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(listToolsMsg)
    });

    if (!listResponse.ok) {
      throw new Error(`List tools failed: ${listResponse.status} ${await listResponse.text()}`);
    }

    console.log('Tools list response:', listResponse.status);

    // Step 2: Call decompile tool
    const callToolMsg = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "decompile_function",
        arguments: {
          name: assembly  // Adjust based on actual Ghidra tool parameters
        }
      }
    };

    const callResponse = await fetch(`${messagesUrl}?session_id=${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(callToolMsg)
    });

    if (!callResponse.ok) {
      throw new Error(`Decompile failed: ${callResponse.status} ${await callResponse.text()}`);
    }

    const result = await callResponse.text();
    
    return {
      success: true,
      cCode: result || 'Decompilation completed',
      metadata: {
        architecture,
        baseAddress
      }
    };
  } catch (error) {
    console.error('Decompilation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Get available tools from MCP - Direct HTTP
ipcMain.handle('get-tools', async () => {
  try {
    if (!sessionId) {
      console.error('❌ get-tools called but sessionId is null!');
      throw new Error('Not connected to MCP server - no session_id');
    }

    console.log('Fetching tools with session_id:', sessionId);

    const message = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {}
    };

    const url = `${messagesUrl}?session_id=${sessionId}`;
    console.log('POST to:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Tools request failed:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.text();
    console.log('✅ Tools response:', result);
    return {
      success: true,
      tools: result
    };
  } catch (error) {
    console.error('get-tools error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Disconnect from MCP
ipcMain.handle('disconnect-mcp', async () => {
  try {
    sessionId = null;
    messagesUrl = null;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
