const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  connectMCP: (config) => ipcRenderer.invoke('connect-mcp', config),
  disconnectMCP: () => ipcRenderer.invoke('disconnect-mcp'),
  decompile: (data) => ipcRenderer.invoke('decompile', data),
  getTools: () => ipcRenderer.invoke('get-tools'),
  listFunctions: () => ipcRenderer.invoke('list-functions'),
  getDisassembly: (data) => ipcRenderer.invoke('get-disassembly', data),
  decompileFunction: (data) => ipcRenderer.invoke('decompile-function', data),
  renameFunction: (data) => ipcRenderer.invoke('rename-function', data),
  renameVariable: (data) => ipcRenderer.invoke('rename-variable', data),
  setDecompilerComment: (data) => ipcRenderer.invoke('set-decompiler-comment', data),
  setDisassemblyComment: (data) => ipcRenderer.invoke('set-disassembly-comment', data),
  searchFunctions: (data) => ipcRenderer.invoke('search-functions', data),
  getXrefsTo: (data) => ipcRenderer.invoke('get-xrefs-to', data),
  getXrefsFrom: (data) => ipcRenderer.invoke('get-xrefs-from', data)
});
