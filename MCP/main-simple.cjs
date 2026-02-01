const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const https = require('https');
const http = require('http');
const EventEmitter = require('events');

let mainWindow;
let mcpServerUrl = null;
let sessionId = null;
let requestId = 0;
let pendingRequests = new Map();
let sseConnection = null;
let sseEmitter = new EventEmitter();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    backgroundColor: '#1e1e1e',
    title: 'Ghidra Decompiler'
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (sseConnection) {
    sseConnection.destroy();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Helper function to connect SSE and send messages via POST to /messages endpoint
function connectSSE(url) {
  return new Promise((resolve, reject) => {
    const sseUrl = new URL(url);
    const protocol = sseUrl.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: sseUrl.hostname,
      port: sseUrl.port,
      path: sseUrl.pathname,
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    };

    const req = protocol.request(options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`SSE connection failed: ${res.statusCode}`));
        return;
      }

      let buffer = '';
      let currentEvent = null;
      
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.substring(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = line.substring(6).trim();
            if (data) {
              if (currentEvent === 'endpoint') {
                // Endpoint event contains the URL with session_id
                sseEmitter.emit('message', { endpoint: data });
              } else {
                try {
                  const message = JSON.parse(data);
                  sseEmitter.emit('message', message);
                } catch (e) {
                  console.error('Failed to parse SSE message:', e, data);
                }
              }
            }
          } else if (line === '') {
            // Empty line marks end of event
            currentEvent = null;
          }
        }
      });

      res.on('end', () => {
        console.log('SSE connection ended');
        sseConnection = null;
      });

      res.on('error', (error) => {
        console.error('SSE error:', error);
        reject(error);
      });

      sseConnection = req;
      resolve();
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

// Helper function to send JSON-RPC message via POST
function sendMCPMessage(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (!mcpServerUrl) {
      reject(new Error('Not connected to MCP server'));
      return;
    }

    const id = ++requestId;
    
    const message = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params
    });

    const url = new URL(mcpServerUrl);
    // Use /messages/ with session_id as query parameter
    const messagePath = sessionId ? `/messages/?session_id=${sessionId}` : '/messages/';
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: messagePath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(message)
      }
    };

    const protocol = url.protocol === 'https:' ? https : http;
    
    // Listen for response via SSE
    const responseHandler = (msg) => {
      if (msg.jsonrpc === '2.0' && msg.id === id) {
        sseEmitter.removeListener('message', responseHandler);
        clearTimeout(timeout);
        
        if (msg.error) {
          reject(new Error(msg.error.message || 'MCP error'));
        } else {
          resolve(msg.result);
        }
      }
    };

    sseEmitter.on('message', responseHandler);
    
    const req = protocol.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        // Response might come via SSE or direct response
        if (data && res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            sseEmitter.removeListener('message', responseHandler);
            clearTimeout(timeout);
            
            if (response.error) {
              reject(new Error(response.error.message || 'MCP error'));
            } else {
              resolve(response.result);
            }
          } catch (error) {
            // Wait for SSE response
          }
        }
      });
    });

    req.on('error', (error) => {
      sseEmitter.removeListener('message', responseHandler);
      clearTimeout(timeout);
      reject(error);
    });

    req.write(message);
    req.end();

    // Timeout after 30 seconds
    const timeout = setTimeout(() => {
      sseEmitter.removeListener('message', responseHandler);
      req.destroy();
      reject(new Error('Request timeout'));
    }, 30000);
  });
}

// Handle MCP connection
ipcMain.handle('connect-mcp', async (event, config) => {
  try {
    // Close existing connection if any
    if (sseConnection) {
      sseConnection.destroy();
      sseConnection = null;
    }

    // Clear pending requests
    pendingRequests.clear();
    requestId = 0;
    sessionId = null;
    sseEmitter.removeAllListeners();

    // For HTTP SSE transport, config.command should be the URL
    // e.g., "http://127.0.0.1:8081/sse"
    mcpServerUrl = config.command || 'http://127.0.0.1:8081/sse';
    
    // Validate URL
    if (!mcpServerUrl.startsWith('http://') && !mcpServerUrl.startsWith('https://')) {
      mcpServerUrl = 'http://' + mcpServerUrl;
    }

    console.log('Connecting to MCP server at:', mcpServerUrl);

    // Connect to SSE endpoint first to get session_id from server
    await connectSSE(mcpServerUrl);
    console.log('SSE connection established');
    
    // Wait for session_id from SSE endpoint event
    sessionId = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for session_id')), 5000);
      
      const handler = (msg) => {
        // Look for endpoint message with session_id
        if (msg.endpoint && msg.endpoint.includes('session_id=')) {
          const id = msg.endpoint.split('session_id=')[1];
          clearTimeout(timeout);
          sseEmitter.removeListener('message', handler);
          resolve(id);
        }
      };
      
      sseEmitter.on('message', handler);
    });
    
    console.log('✅ Got session_id from server:', sessionId);

    // Test connection by sending initialize request
    const initResult = await sendMCPMessage('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'ghidra-decompiler',
        version: '1.0.0'
      }
    });

    console.log('Initialize result:', initResult);

    // Send initialized notification (no response expected)
    const url = new URL(mcpServerUrl);
    const notificationMessage = JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {}
    });

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: `/messages/?session_id=${sessionId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(notificationMessage)
      }
    };

    const protocol = url.protocol === 'https:' ? https : http;
    const notifReq = protocol.request(options);
    notifReq.on('error', () => {}); // Ignore errors on notification
    notifReq.write(notificationMessage);
    notifReq.end();

    return { success: true, message: 'Connected to GhidraMCP server' };
  } catch (error) {
    console.error('MCP connection error:', error);
    mcpServerUrl = null;
    if (sseConnection) {
      sseConnection.destroy();
      sseConnection = null;
    }
    return { success: false, message: error.message };
  }
});

// Handle decompilation request
ipcMain.handle('decompile', async (event, { assembly, architecture, baseAddress }) => {
  try {
    if (!mcpServerUrl) {
      throw new Error('Not connected to MCP server');
    }

    // Since the Ghidra MCP bridge works with Ghidra projects,
    // we'll first list available functions and decompile the first one as a demo
    // In the future, you'd need to upload assembly to Ghidra first
    
    // List available tools to see what we can do
    const toolsList = await sendMCPMessage('tools/list', {});
    console.log('Available tools:', toolsList);
    
    // Try to list functions in the current Ghidra project
    const functions = await sendMCPMessage('tools/call', {
      name: 'list_functions',
      arguments: {}
    });
    
    console.log('Functions result:', functions);
    
    // Parse the response
    let cCode = 'Available Tools:\n\n';
    if (toolsList.tools) {
      toolsList.tools.forEach(tool => {
        cCode += `- ${tool.name}: ${tool.description}\n`;
      });
    }
    
    cCode += '\n\nTo use this app:\n';
    cCode += '1. Open a binary in Ghidra\n';
    cCode += '2. Run the Ghidra MCP bridge server\n';
    cCode += '3. Use "list_functions" to see available functions\n';
    cCode += '4. Use "decompile_function" with a function name\n\n';
    
    if (functions.content) {
      cCode += 'Functions in current project:\n';
      cCode += JSON.stringify(functions.content, null, 2);
    }

    return {
      success: true,
      cCode: cCode,
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

// List functions from Ghidra project
ipcMain.handle('list-functions', async () => {
  try {
    if (!mcpServerUrl) {
      throw new Error('Not connected to MCP server');
    }

    const result = await sendMCPMessage('tools/call', {
      name: 'list_functions',
      arguments: {}
    });

    let functions = [];
    if (result.content && Array.isArray(result.content)) {
      functions = result.content.map(item => item.text || '');
    }

    return { success: true, functions };
  } catch (error) {
    console.error('List functions error:', error);
    return { success: false, error: error.message };
  }
});

// Get disassembly for a function
ipcMain.handle('get-disassembly', async (event, { address }) => {
  try {
    if (!mcpServerUrl) {
      throw new Error('Not connected to MCP server');
    }

    const result = await sendMCPMessage('tools/call', {
      name: 'disassemble_function',
      arguments: { address }
    });

    let assembly = '';
    if (result.content && Array.isArray(result.content)) {
      assembly = result.content.map(item => item.text || '').join('\n');
    }

    return { success: true, assembly };
  } catch (error) {
    console.error('Get disassembly error:', error);
    return { success: false, error: error.message };
  }
});

// Decompile a function by name
ipcMain.handle('decompile-function', async (event, { name }) => {
  try {
    if (!mcpServerUrl) {
      throw new Error('Not connected to MCP server');
    }

    const result = await sendMCPMessage('tools/call', {
      name: 'decompile_function',
      arguments: { name }
    });

    let cCode = '';
    if (typeof result === 'string') {
      cCode = result;
    } else if (result.content && Array.isArray(result.content)) {
      cCode = result.content.map(item => item.text || '').join('\n');
    }

    return { success: true, cCode };
  } catch (error) {
    console.error('Decompile function error:', error);
    return { success: false, error: error.message };
  }
});

// Get available tools from MCP
ipcMain.handle('get-tools', async () => {
  try {
    if (!mcpServerUrl) {
      throw new Error('Not connected to MCP server');
    }

    const result = await sendMCPMessage('tools/list');
    
    return {
      success: true,
      tools: result.tools || []
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Disconnect from MCP
ipcMain.handle('disconnect-mcp', async () => {
  try {
    if (sseConnection) {
      sseConnection.destroy();
      sseConnection = null;
    }
    mcpServerUrl = null;
    sessionId = null;
    pendingRequests.clear();
    sseEmitter.removeAllListeners();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Rename function
ipcMain.handle('rename-function', async (event, { oldName, newName }) => {
  try {
    if (!mcpServerUrl) {
      throw new Error('Not connected to MCP server');
    }

    const result = await sendMCPMessage('tools/call', {
      name: 'rename_function',
      arguments: { old_name: oldName, new_name: newName }
    });

    let message = '';
    if (typeof result === 'string') {
      message = result;
    } else if (result.content && Array.isArray(result.content)) {
      message = result.content.map(item => item.text || '').join('\n');
    }

    return { success: true, message };
  } catch (error) {
    console.error('Rename function error:', error);
    return { success: false, error: error.message };
  }
});

// Rename variable
ipcMain.handle('rename-variable', async (event, { functionName, oldName, newName }) => {
  try {
    if (!mcpServerUrl) {
      throw new Error('Not connected to MCP server');
    }

    const result = await sendMCPMessage('tools/call', {
      name: 'rename_variable',
      arguments: { function_name: functionName, old_name: oldName, new_name: newName }
    });

    let message = '';
    if (typeof result === 'string') {
      message = result;
    } else if (result.content && Array.isArray(result.content)) {
      message = result.content.map(item => item.text || '').join('\n');
    }

    return { success: true, message };
  } catch (error) {
    console.error('Rename variable error:', error);
    return { success: false, error: error.message };
  }
});

// Set decompiler comment
ipcMain.handle('set-decompiler-comment', async (event, { address, comment }) => {
  try {
    if (!mcpServerUrl) {
      throw new Error('Not connected to MCP server');
    }

    const result = await sendMCPMessage('tools/call', {
      name: 'set_decompiler_comment',
      arguments: { address, comment }
    });

    let message = '';
    if (typeof result === 'string') {
      message = result;
    } else if (result.content && Array.isArray(result.content)) {
      message = result.content.map(item => item.text || '').join('\n');
    }

    return { success: true, message };
  } catch (error) {
    console.error('Set decompiler comment error:', error);
    return { success: false, error: error.message };
  }
});

// Set disassembly comment
ipcMain.handle('set-disassembly-comment', async (event, { address, comment }) => {
  try {
    if (!mcpServerUrl) {
      throw new Error('Not connected to MCP server');
    }

    const result = await sendMCPMessage('tools/call', {
      name: 'set_disassembly_comment',
      arguments: { address, comment }
    });

    let message = '';
    if (typeof result === 'string') {
      message = result;
    } else if (result.content && Array.isArray(result.content)) {
      message = result.content.map(item => item.text || '').join('\n');
    }

    return { success: true, message };
  } catch (error) {
    console.error('Set disassembly comment error:', error);
    return { success: false, error: error.message };
  }
});

// Search functions by name
ipcMain.handle('search-functions', async (event, { query }) => {
  try {
    if (!mcpServerUrl) {
      throw new Error('Not connected to MCP server');
    }

    const result = await sendMCPMessage('tools/call', {
      name: 'search_functions_by_name',
      arguments: { query }
    });

    let functions = [];
    if (result.content && Array.isArray(result.content)) {
      functions = result.content.map(item => item.text || '');
    }

    return { success: true, functions };
  } catch (error) {
    console.error('Search functions error:', error);
    return { success: false, error: error.message };
  }
});

// Get XRefs to address
ipcMain.handle('get-xrefs-to', async (event, { address }) => {
  try {
    if (!mcpServerUrl) {
      throw new Error('Not connected to MCP server');
    }

    const result = await sendMCPMessage('tools/call', {
      name: 'get_xrefs_to',
      arguments: { address }
    });

    let xrefs = [];
    if (result.content && Array.isArray(result.content)) {
      xrefs = result.content.map(item => item.text || '');
    }

    return { success: true, xrefs };
  } catch (error) {
    console.error('Get XRefs to error:', error);
    return { success: false, error: error.message };
  }
});

// Get XRefs from address
ipcMain.handle('get-xrefs-from', async (event, { address }) => {
  try {
    if (!mcpServerUrl) {
      throw new Error('Not connected to MCP server');
    }

    const result = await sendMCPMessage('tools/call', {
      name: 'get_xrefs_from',
      arguments: { address }
    });

    let xrefs = [];
    if (result.content && Array.isArray(result.content)) {
      xrefs = result.content.map(item => item.text || '');
    }

    return { success: true, xrefs };
  } catch (error) {
    console.error('Get XRefs from error:', error);
    return { success: false, error: error.message };
  }
});
