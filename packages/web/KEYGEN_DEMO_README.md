# DeFiShArd Keygen Demo

A comprehensive web-based demonstration of DeFiShArd's distributed key generation (DKG) protocol, allowing users to participate as either creators or joiners in a multi-party threshold signing setup.

## Features

### 🔐 Keygen Demo Mode
- **Role Selection**: Choose between Creator or Joiner roles
- **Interactive Workflow**: Step-by-step guided process
- **Real-time Progress**: Visual progress indicators during keygen rounds
- **QR Code Sharing**: Easy setup data sharing between parties
- **Live Logging**: Real-time activity logs with timestamps
- **Reset Functionality**: Start fresh demos anytime

### 🏗️ Creator Role
1. **Initialize SDK** - Set up the DeFiShArd SDK
2. **Register Party** - Register with the relay server
3. **Create Group** - Set threshold and total party count
4. **Share Setup Data** - Generate QR codes and setup data for joiners
5. **Start Keygen** - Initiate distributed key generation
6. **Sign Messages** - Test threshold signing (optional)

### 🔗 Joiner Role
1. **Initialize SDK** - Set up the DeFiShArd SDK
2. **Register Party** - Register with the relay server
3. **Join Group** - Use Group ID or paste setup data
4. **Start Keygen** - Participate in distributed key generation
5. **Sign Messages** - Test threshold signing (optional)

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)
- DeFiShArd relay server running (optional, falls back to mock)

### Installation & Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Bundle the SDK** (if using real SDK):
   ```bash
   npm run bundle-sdk
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```

4. **Open your browser** and navigate to `http://localhost:3000`

## Usage Guide

### For Creators

1. **Select Creator Role**: Click the "🏗️ Creator" button
2. **Initialize SDK**: Click "🚀 Initialize SDK"
3. **Register Party**: Click "📝 Register Party" to get your party ID
4. **Configure Group**: Set your desired threshold and total parties
5. **Create Group**: Click "🏗️ Create Group" to create a new group
6. **Share Setup Data**: Copy the QR code or setup data to share with joiners
7. **Start Keygen**: Click "🔐 Start Key Generation" and wait for joiners
8. **Test Signing**: After keygen completes, try signing a message

### For Joiners

1. **Select Joiner Role**: Click the "🔗 Joiner" button
2. **Initialize SDK**: Click "🚀 Initialize SDK"
3. **Register Party**: Click "📝 Register Party" to get your party ID
4. **Join Group**: Either:
   - Enter the Group ID directly, or
   - Paste the setup data from the creator
5. **Start Keygen**: Click "🔐 Start Key Generation"
6. **Test Signing**: After keygen completes, try signing a message

### Multi-Party Testing

To test with multiple parties:

1. **Open multiple browser tabs/windows**
2. **One tab as Creator**: Follow the creator workflow
3. **Other tabs as Joiners**: Follow the joiner workflow
4. **Share setup data**: Copy the setup data from creator to joiners
5. **Start keygen simultaneously**: All parties should start keygen around the same time

## Configuration

### Relay Server
By default, the app connects to:
- **Relay Server**: `http://localhost:3000`
- **WebSocket**: `ws://localhost:3000`

For production, update these URLs in the SDK service.

### Threshold Schemes
- **2-of-2**: Minimum viable setup (2 parties, 2 required to sign)
- **2-of-3**: Fault-tolerant setup (3 parties, 2 required to sign)
- **3-of-5**: High-security setup (5 parties, 3 required to sign)

## Troubleshooting

### Common Issues

1. **SDK Initialization Fails**
   - Check if relay server is running
   - App will fall back to mock mode if real SDK unavailable

2. **Party Registration Fails**
   - Verify relay server connectivity
   - Check browser console for detailed errors

3. **Keygen Hangs**
   - Ensure all parties have joined the group
   - Check that all parties start keygen within a reasonable time

4. **Setup Data Issues**
   - Verify JSON format is correct
   - Check that Group ID matches between creator and joiners

### Debug Mode
The app runs in debug mode by default. Check the browser console for detailed logs and SDK events.

## Architecture

### Components
- **KeygenDemo**: Main demo component with role selection
- **SDKService**: Service layer for SDK interaction
- **BrowserStorageAdapter**: Local storage for keyshares

### Event Flow
1. **Initialization** → SDK setup and WASM loading
2. **Registration** → Party registration with relay server
3. **Group Management** → Create or join groups
4. **Key Generation** → Multi-round DKG protocol
5. **Signing** → Threshold signature generation

### Mock Mode
When the real SDK is unavailable, the app uses a mock implementation that:
- Simulates realistic timing for keygen rounds
- Provides visual feedback for all operations
- Maintains the same API interface

## Development

### Adding New Features
1. Extend the `SDKService` class for new functionality
2. Add corresponding UI components in `KeygenDemo`
3. Update event handlers for real-time feedback
4. Add appropriate error handling and validation

### Testing
- Use multiple browser tabs for multi-party testing
- Test different threshold configurations
- Verify error handling with network issues
- Test QR code sharing between devices

## Security Notes

⚠️ **This is a demo application for testing and development purposes only.**

- Keyshares are stored in browser localStorage (not secure for production)
- No encryption of sensitive data in transit
- Mock mode does not perform real cryptographic operations
- Use only in trusted development environments

For production use, implement proper security measures including:
- Secure key storage
- Encrypted communication
- Input validation and sanitization
- Proper error handling without information disclosure
