// UI Elements
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const mcpCommand = document.getElementById('mcp-command');
const mcpArgs = document.getElementById('mcp-args');
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const architecture = document.getElementById('architecture');
const baseAddress = document.getElementById('base-address');
const assemblyInput = document.getElementById('assembly-input');
const cOutput = document.getElementById('c-output');
const decompileBtn = document.getElementById('decompile-btn');
const clearInputBtn = document.getElementById('clear-input-btn');
const copyOutputBtn = document.getElementById('copy-output-btn');
const saveOutputBtn = document.getElementById('save-output-btn');
const metadataDisplay = document.getElementById('metadata-display');
const messageBar = document.getElementById('message-bar');
const messageText = document.getElementById('message-text');
const closeMessage = document.getElementById('close-message');
const toolsBtn = document.getElementById('tools-btn');

// Debug: Check if tools button exists
console.log('Tools button element:', toolsBtn);
console.log('Tools button disabled state:', toolsBtn?.disabled);

if (!toolsBtn) {
  console.error('CRITICAL: Tools button not found in DOM!');
}

// State
let isConnected = false;
let currentOutput = '';
let currentFunctionName = null;
let currentAddress = null;

// Message Functions
function showMessage(text, type = 'info') {
  messageText.textContent = text;
  messageBar.className = `message-bar ${type}`;
  messageBar.classList.remove('hidden');
  
  setTimeout(() => {
    messageBar.classList.add('hidden');
  }, 5000);
}

closeMessage.addEventListener('click', () => {
  messageBar.classList.add('hidden');
});

// Update UI State
function updateConnectionState(connected) {
  isConnected = connected;
  
  if (connected) {
    statusIndicator.className = 'status-dot connected';
    statusText.textContent = 'Connected';
    connectBtn.disabled = true;
    disconnectBtn.disabled = false;
    decompileBtn.disabled = false;
    toolsBtn.disabled = false;
  } else {
    statusIndicator.className = 'status-dot disconnected';
    statusText.textContent = 'Disconnected';
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
    decompileBtn.disabled = true;
    toolsBtn.disabled = true;
  }
}

function setConnecting() {
  statusIndicator.className = 'status-dot connecting';
  statusText.textContent = 'Connecting...';
  connectBtn.disabled = true;
}

// Connect to MCP Server
connectBtn.addEventListener('click', async () => {
  setConnecting();
  
  const config = {
    url: mcpCommand.value.trim() || 'http://127.0.0.1:8081/sse'
  };
  
  try {
    const result = await window.electronAPI.connectMCP(config);
    
    if (result.success) {
      updateConnectionState(true);
      showMessage('Successfully connected to GhidraMCP server via SSE', 'success');
      
      // DON'T call getTools automatically - wait for user action
      // const toolsResult = await window.electronAPI.getTools();
      // if (toolsResult.success) {
      //   console.log('Available tools:', toolsResult.tools);
      // }
    } else {
      updateConnectionState(false);
      showMessage(`Connection failed: ${result.message}`, 'error');
    }
  } catch (error) {
    updateConnectionState(false);
    showMessage(`Connection error: ${error.message}`, 'error');
  }
});

// Disconnect from MCP Server
disconnectBtn.addEventListener('click', async () => {
  try {
    const result = await window.electronAPI.disconnectMCP();
    
    if (result.success) {
      updateConnectionState(false);
      showMessage('Disconnected from MCP server', 'info');
    }
  } catch (error) {
    showMessage(`Disconnect error: ${error.message}`, 'error');
  }
});

// Decompile Assembly
decompileBtn.addEventListener('click', async () => {
  const assembly = assemblyInput.value.trim();
  
  if (!assembly) {
    showMessage('Please enter assembly code', 'error');
    return;
  }
  
  if (!isConnected) {
    showMessage('Not connected to MCP server', 'error');
    return;
  }
  
  // Show loading state
  decompileBtn.disabled = true;
  decompileBtn.textContent = 'Decompiling...';
  cOutput.textContent = 'Processing...';
  
  try {
    const result = await window.electronAPI.decompile({
      assembly: assembly,
      architecture: architecture.value,
      baseAddress: baseAddress.value.trim()
    });
    
    if (result.success) {
      currentOutput = result.cCode;
      cOutput.textContent = currentOutput;
      
      // Show metadata
      if (result.metadata) {
        metadataDisplay.innerHTML = `
          <strong>Architecture:</strong> ${result.metadata.architecture} | 
          <strong>Base Address:</strong> ${result.metadata.baseAddress}
        `;
        metadataDisplay.classList.remove('hidden');
      }
      
      copyOutputBtn.disabled = false;
      saveOutputBtn.disabled = false;
      
      showMessage('Decompilation successful!', 'success');
    } else {
      cOutput.textContent = `Error: ${result.error}`;
      showMessage(`Decompilation failed: ${result.error}`, 'error');
    }
  } catch (error) {
    cOutput.textContent = `Error: ${error.message}`;
    showMessage(`Decompilation error: ${error.message}`, 'error');
  } finally {
    decompileBtn.disabled = false;
    decompileBtn.textContent = 'Decompile to C';
  }
});

// Clear Input
clearInputBtn.addEventListener('click', () => {
  assemblyInput.value = '';
  assemblyInput.focus();
});

// Copy Output
copyOutputBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(currentOutput);
    showMessage('C code copied to clipboard', 'success');
  } catch (error) {
    showMessage('Failed to copy to clipboard', 'error');
  }
});

// Save Output
saveOutputBtn.addEventListener('click', () => {
  const blob = new Blob([currentOutput], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'decompiled.c';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showMessage('C code saved to file', 'success');
});

// Load File (for assembly input)
const loadFileBtn = document.getElementById('load-file-btn');
loadFileBtn.addEventListener('click', async () => {
  if (isConnected) {
    // Show menu: Load from Ghidra or from file
    const fromGhidra = confirm('Load from Ghidra project?\n\nOK = Load from Ghidra\nCancel = Load from file');
    if (fromGhidra) {
      await loadFromGhidra();
      return;
    }
  }
  
  // Load from file
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.asm,.s,.txt';
  
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        assemblyInput.value = event.target.result;
        showMessage(`Loaded: ${file.name}`, 'success');
      };
      reader.readAsText(file);
    }
  };
  
  input.click();
});

// Load from Ghidra function
async function loadFromGhidra() {
  try {
    showMessage('Loading functions from Ghidra...', 'info');
    
    const result = await window.electronAPI.listFunctions();
    if (!result.success) {
      showMessage(`Error: ${result.error}`, 'error');
      return;
    }

    if (!result.functions || result.functions.length === 0) {
      showMessage('No functions found in Ghidra project', 'error');
      return;
    }

    // Show custom function selection dialog
    showFunctionDialog(result.functions);

  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
  }
}

// Show function selection dialog
function showFunctionDialog(functions) {
  const dialog = document.getElementById('function-dialog');
  const functionList = document.getElementById('function-list');
  const searchInput = document.getElementById('function-search');
  const cancelBtn = document.getElementById('cancel-function');

  // Clear previous content
  functionList.innerHTML = '';
  searchInput.value = '';

  // Create function items
  let allFunctionItems = [];
  functions.forEach((func, idx) => {
    const item = document.createElement('div');
    item.className = 'function-item';
    item.textContent = func;
    item.dataset.index = idx;
    item.dataset.name = func.toLowerCase();
    
    item.addEventListener('click', async () => {
      dialog.classList.add('hidden');
      await loadSelectedFunction(func);
    });
    
    functionList.appendChild(item);
    allFunctionItems.push(item);
  });

  // Search functionality
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    allFunctionItems.forEach(item => {
      if (item.dataset.name.includes(query)) {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
      }
    });
  });

  // Cancel button
  cancelBtn.onclick = () => {
    dialog.classList.add('hidden');
  };

  // Show dialog
  dialog.classList.remove('hidden');
  searchInput.focus();
}

// Load selected function
async function loadSelectedFunction(selectedFunc) {
  try {
    const addressMatch = selectedFunc.match(/at\s+([0-9a-fA-F]+)/);
    if (!addressMatch) {
      showMessage('Could not parse address', 'error');
      return;
    }

    const address = addressMatch[1];
    const funcName = selectedFunc.split(' at ')[0];
    
    // Store current context
    currentFunctionName = funcName;
    currentAddress = address;
    
    showMessage(`Loading ${selectedFunc}...`, 'info');

    // Get disassembly
    const disResult = await window.electronAPI.getDisassembly({ address });
    if (disResult.success && disResult.assembly) {
      assemblyInput.value = disResult.assembly;
    }

    // Get decompiled code
    const decResult = await window.electronAPI.decompileFunction({ name: funcName });
    if (decResult.success && decResult.cCode) {
      currentOutput = decResult.cCode;
      cOutput.textContent = currentOutput;
      copyOutputBtn.disabled = false;
      saveOutputBtn.disabled = false;
      metadataDisplay.innerHTML = `<strong>Function:</strong> ${selectedFunc}`;
      metadataDisplay.classList.remove('hidden');
      showMessage(`Loaded: ${selectedFunc}`, 'success');
    } else {
      showMessage(`Decompile failed: ${decResult.error}`, 'error');
    }

  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
  }
}

// Enable textarea auto-resize on input
assemblyInput.addEventListener('input', () => {
  // Auto-save to localStorage
  localStorage.setItem('assembly-input', assemblyInput.value);
});

// Load saved input on startup
window.addEventListener('load', () => {
  const savedInput = localStorage.getItem('assembly-input');
  if (savedInput) {
    assemblyInput.value = savedInput;
  }
  
  // Load saved connection config
  const savedCommand = localStorage.getItem('mcp-command');
  const savedArgs = localStorage.getItem('mcp-args');
  
  if (savedCommand) mcpCommand.value = savedCommand;
  if (savedArgs) mcpArgs.value = savedArgs;
});

// Save connection config
mcpCommand.addEventListener('change', () => {
  localStorage.setItem('mcp-command', mcpCommand.value);
});

mcpArgs.addEventListener('change', () => {
  localStorage.setItem('mcp-args', mcpArgs.value);
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + Enter to decompile
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    if (!decompileBtn.disabled) {
      decompileBtn.click();
    }
  }
  
  // Ctrl/Cmd + K to clear input
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    clearInputBtn.click();
  }
});

console.log('Ghidra Decompiler initialized');

// Tools Dialog - with comprehensive debugging
console.log('=== ATTACHING TOOLS BUTTON LISTENER ===');
console.log('toolsBtn exists?', !!toolsBtn);
console.log('toolsBtn value:', toolsBtn);

if (toolsBtn) {
  console.log('Adding click listener to tools button');
  toolsBtn.addEventListener('click', (event) => {
    alert('TOOLS BUTTON WAS CLICKED!'); // Simple test
    console.log('🔧 TOOLS BUTTON CLICKED! Event:', event);
    console.log('Button disabled state:', toolsBtn.disabled);
    console.log('isConnected:', isConnected);
    
    const dialog = document.getElementById('tools-dialog');
    console.log('Tools dialog element:', dialog);
    
    if (dialog) {
      console.log('Dialog classes before:', dialog.className);
      dialog.classList.remove('hidden');
      console.log('Dialog classes after:', dialog.className);
      
      const computedStyle = window.getComputedStyle(dialog);
      console.log('Dialog computed display:', computedStyle.display);
      console.log('Dialog computed visibility:', computedStyle.visibility);
      console.log('Dialog computed z-index:', computedStyle.zIndex);
    } else {
      console.error('Tools dialog element not found!');
    }
  });
  console.log('✅ Click listener attached successfully');
} else {
  console.error('❌ Cannot attach listener - toolsBtn is null!');
}

const closeToolsBtn = document.getElementById('close-tools');
console.log('Close tools button:', closeToolsBtn);
if (closeToolsBtn) {
  closeToolsBtn.addEventListener('click', () => {
    console.log('Close tools clicked');
    document.getElementById('tools-dialog').classList.add('hidden');
  });
} else {
  console.error('Close tools button not found!');
}

// Rename Function Tool
document.getElementById('tool-rename-func').addEventListener('click', async () => {
  if (!currentFunctionName) {
    showMessage('No function loaded. Load a function from Ghidra first.', 'error');
    return;
  }
  
  const newName = prompt(`Rename function "${currentFunctionName}" to:`);
  if (!newName || newName === currentFunctionName) return;
  
  try {
    const result = await window.electronAPI.renameFunction({
      oldName: currentFunctionName,
      newName: newName
    });
    
    if (result.success) {
      currentFunctionName = newName;
      showMessage(`Function renamed to "${newName}"`, 'success');
      metadataDisplay.innerHTML = `<strong>Function:</strong> ${newName} at ${currentAddress}`;
    } else {
      showMessage(`Rename failed: ${result.error}`, 'error');
    }
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
  }
});

// Rename Variable Tool
document.getElementById('tool-rename-var').addEventListener('click', async () => {
  if (!currentFunctionName) {
    showMessage('No function loaded. Load a function from Ghidra first.', 'error');
    return;
  }
  
  const oldName = prompt('Variable name to rename:');
  if (!oldName) return;
  
  const newName = prompt(`Rename variable "${oldName}" to:`);
  if (!newName || newName === oldName) return;
  
  try {
    const result = await window.electronAPI.renameVariable({
      functionName: currentFunctionName,
      oldName: oldName,
      newName: newName
    });
    
    if (result.success) {
      showMessage(`Variable "${oldName}" renamed to "${newName}"`, 'success');
      // Reload decompilation to show updated code
      const decResult = await window.electronAPI.decompileFunction({ name: currentFunctionName });
      if (decResult.success) {
        currentOutput = decResult.cCode;
        cOutput.textContent = currentOutput;
      }
    } else {
      showMessage(`Rename failed: ${result.error}`, 'error');
    }
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
  }
});

// Add Decompiler Comment Tool
document.getElementById('tool-add-decomp-comment').addEventListener('click', async () => {
  if (!currentFunctionName) {
    showMessage('No function loaded. Load a function from Ghidra first.', 'error');
    return;
  }
  
  const lineNum = prompt('Line number (in decompiled code):');
  if (!lineNum) return;
  
  const comment = prompt('Comment text:');
  if (!comment) return;
  
  try {
    const result = await window.electronAPI.setDecompilerComment({
      functionName: currentFunctionName,
      lineNumber: parseInt(lineNum),
      comment: comment
    });
    
    if (result.success) {
      showMessage('Decompiler comment added', 'success');
      // Reload decompilation
      const decResult = await window.electronAPI.decompileFunction({ name: currentFunctionName });
      if (decResult.success) {
        currentOutput = decResult.cCode;
        cOutput.textContent = currentOutput;
      }
    } else {
      showMessage(`Comment failed: ${result.error}`, 'error');
    }
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
  }
});

// Add Disassembly Comment Tool
document.getElementById('tool-add-disasm-comment').addEventListener('click', async () => {
  if (!currentAddress) {
    showMessage('No function loaded. Load a function from Ghidra first.', 'error');
    return;
  }
  
  const comment = prompt('Comment text:');
  if (!comment) return;
  
  try {
    const result = await window.electronAPI.setDisassemblyComment({
      address: currentAddress,
      comment: comment
    });
    
    if (result.success) {
      showMessage('Disassembly comment added', 'success');
      // Reload disassembly
      const disResult = await window.electronAPI.getDisassembly({ address: currentAddress });
      if (disResult.success) {
        assemblyInput.value = disResult.assembly;
      }
    } else {
      showMessage(`Comment failed: ${result.error}`, 'error');
    }
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
  }
});

// Search Functions Tool
document.getElementById('tool-search-funcs').addEventListener('click', async () => {
  const query = prompt('Search for function name:');
  if (!query) return;
  
  try {
    const result = await window.electronAPI.searchFunctions({ query });
    
    if (result.success && result.functions) {
      if (result.functions.length === 0) {
        showMessage('No functions found', 'info');
      } else {
        showFunctionDialog(result.functions);
      }
    } else {
      showMessage(`Search failed: ${result.error}`, 'error');
    }
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
  }
});

// Get XRefs To Tool
document.getElementById('tool-xrefs-to').addEventListener('click', async () => {
  if (!currentAddress) {
    showMessage('No function loaded. Load a function from Ghidra first.', 'error');
    return;
  }
  
  try {
    const result = await window.electronAPI.getXrefsTo({ address: currentAddress });
    
    if (result.success && result.xrefs) {
      if (result.xrefs.length === 0) {
        showMessage('No references found', 'info');
      } else {
        const xrefsText = result.xrefs.join('\n');
        alert(`References to ${currentAddress}:\n\n${xrefsText}`);
      }
    } else {
      showMessage(`Get XRefs failed: ${result.error}`, 'error');
    }
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
  }
});

// Get XRefs From Tool
document.getElementById('tool-xrefs-from').addEventListener('click', async () => {
  if (!currentAddress) {
    showMessage('No function loaded. Load a function from Ghidra first.', 'error');
    return;
  }
  
  try {
    const result = await window.electronAPI.getXrefsFrom({ address: currentAddress });
    
    if (result.success && result.xrefs) {
      if (result.xrefs.length === 0) {
        showMessage('No references found', 'info');
      } else {
        const xrefsText = result.xrefs.join('\n');
        alert(`References from ${currentAddress}:\n\n${xrefsText}`);
      }
    } else {
      showMessage(`Get XRefs failed: ${result.error}`, 'error');
    }
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
  }
});

// TODO: Add remaining tools
document.getElementById('tool-rename-data').addEventListener('click', () => {
  showMessage('Rename Data tool - Coming soon!', 'info');
});

document.getElementById('tool-set-prototype').addEventListener('click', () => {
  showMessage('Set Function Prototype tool - Coming soon!', 'info');
});

document.getElementById('tool-set-var-type').addEventListener('click', () => {
  showMessage('Set Variable Type tool - Coming soon!', 'info');
});

