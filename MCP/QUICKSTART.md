# Quick Start Guide

## Step 1: Install Dependencies

```bash
cd ghidra-decompiler
npm install
```

## Step 2: Set Up GhidraMCP

Make sure you have:
1. Ghidra installed
2. GhidraMCP server ready to run

## Step 3: Run the App

```bash
npm start
```

## Step 4: Connect to Server

1. In the app, enter your GhidraMCP command (e.g., `ghidra-mcp` or `node /path/to/server.js`)
2. Click "Connect"
3. Wait for "Connected" status

## Step 5: Try an Example

1. Click "Load File" and select `examples/example1_x64.asm`
2. Ensure architecture is set to "x86-64 (Little Endian)"
3. Click "Decompile to C" or press Ctrl+Enter
4. View the decompiled C code on the right

## Common Commands

### GhidraMCP Command Examples

Depending on how your GhidraMCP is set up:

```bash
# If installed globally
ghidra-mcp

# If running from source
node /path/to/ghidra-mcp/server.js

# With Python
python3 /path/to/ghidra-mcp/server.py

# With custom port
ghidra-mcp --port 8080
```

## Tips

- Use Ctrl+Enter to quickly decompile
- The app auto-saves your assembly input
- Connection settings are remembered
- Try different architectures if decompilation fails

## Next Steps

- Read the full README.md for detailed information
- Check the Troubleshooting section if you encounter issues
- Explore different assembly examples in the `examples/` folder
