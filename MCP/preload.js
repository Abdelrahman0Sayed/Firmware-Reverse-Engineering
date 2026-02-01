const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  connectMCP: (config) => ipcRenderer.invoke('connect-mcp', config),
  disconnectMCP: () => ipcRenderer.invoke('disconnect-mcp'),
  decompile: (data) => ipcRenderer.invoke('decompile', data),
  getTools: () => ipcRenderer.invoke('get-tools')
});
