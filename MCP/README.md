# Ghidra Assembly Decompiler

A desktop application that uses GhidraMCP (Model Context Protocol) to convert assembly code to C code using Ghidra's powerful decompilation engine.

## Features

- 🔧 **Multiple Architectures**: Support for x86, ARM, MIPS, and more
- 🚀 **Real-time Decompilation**: Convert assembly to C code instantly
- 💾 **Save/Load Files**: Import assembly files and export C code
- 📋 **Copy to Clipboard**: Quick copy functionality
- ⚙️ **Configurable**: Adjustable architecture and base address settings
- 🎨 **Modern UI**: Dark theme with VS Code-inspired design
- ⌨️ **Keyboard Shortcuts**: Ctrl+Enter to decompile, Ctrl+K to clear

## Prerequisites

Before running this application, you need:

1. **Node.js** (v16 or higher)
2. **Ghidra** installed on your system
3. **GhidraMCP Server** set up and configured

### Setting Up GhidraMCP

GhidraMCP is an MCP server that provides an interface to Ghidra's decompilation capabilities. Follow these steps:

1. Install Ghidra from: https://ghidra-sre.org/

2. Clone or install the GhidraMCP server:
   ```bash
   # Example - adjust based on actual GhidraMCP installation method
   git clone https://github.com/your-ghidra-mcp-repo/ghidra-mcp.git
   cd ghidra-mcp
   npm install
   ```

3. Configure the MCP server with your Ghidra installation path

4. Make note of the command to start the server (e.g., `node server.js` or `ghidra-mcp`)

## Installation

1. Clone or download this repository:
   ```bash
   git clone <your-repo-url>
   cd ghidra-decompiler
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

### Development Mode

Run with developer tools enabled:
```bash
npm run dev
```

### Production Mode

Run the application normally:
```bash
npm start
```

## Usage

### 1. Connect to GhidraMCP Server

- Enter the command to start your GhidraMCP server (e.g., `ghidra-mcp` or `node server.js`)
- Add any required arguments in the Arguments field
- Click **Connect**
- Wait for the connection status to show "Connected"

### 2. Configure Decompilation Settings

- Select your target **Architecture** from the dropdown:
  - x86-64 (Little Endian)
  - x86-32 (Little Endian)
  - ARM64 (Little Endian)
  - ARM32 v7 (Little Endian)
  - MIPS64 (Big Endian)
  - MIPS32 (Little Endian)
  
- Set the **Base Address** (default: 0x100000)

### 3. Enter Assembly Code

Paste or type your assembly code in the left panel. Example:

```asm
push rbp
mov rbp, rsp
mov DWORD PTR [rbp-4], edi
mov eax, DWORD PTR [rbp-4]
add eax, eax
pop rbp
ret
```

You can also:
- Click **Load File** to import an assembly file (.asm, .s, .txt)
- Click **Clear** to reset the input

### 4. Decompile

- Click **Decompile to C** button
- Or use keyboard shortcut: **Ctrl+Enter** (Cmd+Enter on Mac)
- The decompiled C code will appear in the right panel

### 5. Use the Output

- Click **Copy** to copy the C code to clipboard
- Click **Save** to download as a .c file
- View metadata (architecture, base address) below the output

## Keyboard Shortcuts

- **Ctrl/Cmd + Enter**: Decompile assembly code
- **Ctrl/Cmd + K**: Clear assembly input

## Configuration

The app saves your settings locally:
- MCP server command and arguments
- Last entered assembly code
- Window size and position

## Troubleshooting

### ES Module Error (ERR_REQUIRE_ESM)

**Problem**: "Error [ERR_REQUIRE_ESM]: require() of ES Module not supported"

**Solution**: This app now uses `main-simple.cjs` which doesn't require the MCP SDK package. The simpler version communicates directly with the MCP server via JSON-RPC over stdio.

If you see this error:
1. Make sure you're using the latest `package.json` 
2. Delete `node_modules` folder
3. Run `npm install` again
4. The app should now start without issues

### Connection Issues

**Problem**: "Connection failed" error

**Solutions**:
- Verify GhidraMCP server is installed correctly
- Check the command and arguments are correct
- Ensure Ghidra is properly installed and configured
- Check server logs for errors

### Decompilation Errors

**Problem**: Decompilation fails

**Solutions**:
- Verify the assembly syntax is correct for the selected architecture
- Check that the base address is valid (hexadecimal format)
- Try a different architecture if unsure
- Ensure the assembly code is complete and valid

### UI Issues

**Problem**: Application doesn't start

**Solutions**:
- Run `npm install` to ensure all dependencies are installed
- Check Node.js version (v16+)
- Look at console output for error messages
- Try clearing the app cache

## MCP Server API

This application expects the GhidraMCP server to implement the following MCP tool:

```javascript
{
  name: "decompile",
  arguments: {
    assembly_code: string,    // The assembly code to decompile
    architecture: string,     // Architecture specification (e.g., "x86:LE:64:default")
    base_address: string      // Base address in hex (e.g., "0x100000")
  }
}
```

## Architecture Specifications

The architecture string format is: `PROCESSOR:ENDIAN:SIZE:VARIANT`

Examples:
- `x86:LE:64:default` - x86-64 architecture, little endian
- `ARM:LE:64:v8A` - ARM64 v8A, little endian
- `MIPS:BE:32:default` - MIPS 32-bit, big endian

Refer to Ghidra documentation for complete architecture list.

## Project Structure

```
ghidra-decompiler/
├── main.js           # Main Electron process
├── preload.js        # Preload script for IPC
├── renderer.js       # Renderer process (UI logic)
├── index.html        # Main UI layout
├── styles.css        # Application styles
├── package.json      # Project configuration
└── README.md         # This file
```

## Technologies Used

- **Electron**: Cross-platform desktop framework
- **MCP SDK**: Model Context Protocol for Ghidra integration
- **Ghidra**: Reverse engineering and decompilation engine
- **HTML/CSS/JavaScript**: UI and application logic

## Building for Distribution

To package the application for distribution:

```bash
npm install electron-builder --save-dev
```

Add to package.json:
```json
"scripts": {
  "build": "electron-builder"
},
"build": {
  "appId": "com.ghidra.decompiler",
  "productName": "Ghidra Decompiler",
  "win": {
    "target": "nsis"
  },
  "mac": {
    "target": "dmg"
  },
  "linux": {
    "target": "AppImage"
  }
}
```

Then run:
```bash
npm run build
```

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Ghidra team for the amazing decompilation engine
- Anthropic for the Model Context Protocol
- Electron team for the desktop framework

## Support

For issues and questions:
1. Check the Troubleshooting section
2. Review GhidraMCP documentation
3. Open an issue on GitHub

---

Made with ❤️ using Electron and GhidraMCP
