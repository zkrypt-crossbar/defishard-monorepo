# DeFiShArd SDK

A WebAssembly-based SDK for distributed key generation and threshold signatures using the DKLS23 protocol. This SDK enables secure multi-party computation (MPC) operations in web browsers, mobile apps, and browser extensions.

## Features

- **Distributed Key Generation**: Generate cryptographic keys across multiple parties without a trusted third party
- **Threshold Signatures**: Sign messages with threshold-based security (t-of-n)
- **WebAssembly Core**: High-performance cryptographic operations compiled from Rust
- **Real-time Communication**: WebSocket-based communication with relay servers
- **Cross-platform**: Works in browsers, mobile apps, and browser extensions
- **Event-driven API**: Clean, asynchronous interface with event callbacks

## Installation

### NPM Package

```bash
npm install defishard-sdk
```

### From Source

```bash
git clone https://github.com/your-org/defishard-sdk.git
cd defishard-sdk
npm install
npm run build
```

## Quick Start

### Basic Usage

```typescript
import { DeFiShArdSDK, SecureLocalStorageAdapter } from 'defishard-sdk';

// Initialize SDK with storage
const config = {
  relayerUrl: 'http://localhost:8080',
  websocketUrl: 'ws://localhost:8080',
  storage: new SecureLocalStorageAdapter('your-party-random-key') // Add secure storage for keyshare persistence
};

const sdk = new DeFiShArdSDK(config);

// Set up event listeners
sdk.on('initialized', () => console.log('SDK ready'));
sdk.on('keygenComplete', (keyShare) => console.log('Key generated and saved'));
sdk.on('signingComplete', (signature) => console.log('Message signed'));

// Initialize and register
await sdk.initialize();
const registration = await sdk.register();

// Create group and generate keys
const group = await sdk.createGroup(2, 3, 60); // 2-of-3 threshold
await sdk.startKeygen(true); // Distributed key generation
```

### Key Generation

```typescript
// Start distributed key generation
await sdk.startKeygen(true);

// Or start with a specific secret (non-distributed)
await sdk.startKeygen(false, 'your-secret-here');
```

### Signing

```typescript
// Create a message hash (32 bytes)
const messageHash = new Uint8Array(32);
crypto.getRandomValues(messageHash);

// Start signing process (keyshare automatically loaded from storage)
await sdk.startSigning(messageHash, 0); // keyShareId = 0
```

## Storage Integration

The SDK supports flexible storage integration for keyshare persistence. Each application can provide its own storage implementation.

### Using Built-in Storage

```typescript
import { SecureLocalStorageAdapter, SecureFileStorageAdapter } from 'defishard-sdk';

// Option 1: Secure localStorage (for browsers)
// Each party should use a unique random key for encryption
const localStorage = new SecureLocalStorageAdapter('your-party-random-key');

// Option 2: Secure file storage (for Node.js/Deno)
// Stores encrypted files in 'defishard_storage' directory
const fileStorage = new SecureFileStorageAdapter('your-party-random-key');

const sdk = new DeFiShArdSDK({
  relayerUrl: 'http://localhost:8080',
  websocketUrl: 'ws://localhost:8080',
  storage: localStorage // or fileStorage
});
```

### Custom Storage Implementation

```typescript
import { DefiShardStorage, KeyShare } from 'defishard-sdk';

class MySecureStorage implements DefiShardStorage {
  async saveKeyShare(groupId: string, partyIndex: number, keyshare: KeyShare): Promise<void> {
    // Implement secure storage (Keychain, Keystore, etc.)
  }
  
  async getKeyShare(groupId: string, partyIndex: number): Promise<KeyShare | null> {
    // Retrieve keyshare from secure storage
  }
  
  // ... implement other methods
}

const sdk = new DeFiShArdSDK({
  relayerUrl: 'http://localhost:8080',
  websocketUrl: 'ws://localhost:8080',
  storage: new MySecureStorage()
});
```

### Storage Flow

1. **Keygen Process**: Keyshares are automatically saved using the provided storage
2. **Signing Process**: Keyshares are automatically loaded from storage
3. **No Storage**: If no storage is provided, keyshares are not persisted

See [Storage Flow Guide](docs/STORAGE_FLOW_GUIDE.md) for detailed examples.

## API Reference

### Configuration

```typescript
interface Config {
  relayerUrl: string;      // HTTP API endpoint
  websocketUrl: string;    // WebSocket endpoint
  apiKey?: string;         // Authentication token
  partyId?: string;        // Party identifier
  groupId?: string;        // Group identifier
  privateKey?: string;     // Private key
}
```

### Main SDK Class

#### Constructor
```typescript
new DeFiShArdSDK(config: Config)
```

#### Methods

- `initialize(): Promise<void>` - Initialize WASM module and load configuration
- `register(): Promise<RegistrationResult>` - Register with relay server
- `createGroup(threshold: number, totalParties: number, timeoutMinutes?: number): Promise<GroupResult>` - Create new group
- `joinGroup(groupId: string): Promise<GroupResult>` - Join existing group
- `startKeygen(distributed?: boolean, secret?: string): Promise<void>` - Start key generation
- `startSigning(messageHash: Uint8Array, keyShareId?: number): Promise<void>` - Start signing process
- `disconnect(): Promise<void>` - Disconnect and cleanup

#### Events

- `initialized` - SDK initialization complete
- `connected` - WebSocket connected
- `disconnected` - WebSocket disconnected
- `registered` - Registration successful
- `groupCreated` - Group creation successful
- `groupJoined` - Group join successful
- `keygenStarted` - Key generation started
- `keygenComplete` - Key generation completed
- `signingStarted` - Signing process started
- `signingComplete` - Signing process completed
- `error` - Error occurred

### Event Handling

```typescript
sdk.on('keygenComplete', (keyShare) => {
  console.log('Key share generated:', keyShare);
  // Store key share securely
});

sdk.on('signingComplete', (signature) => {
  const [r, s] = signature;
  console.log('Signature R:', r);
  console.log('Signature S:', s);
});

sdk.on('error', (error) => {
  console.error('SDK error:', error);
});
```

## Protocol Flow

### Key Generation (4 Rounds)

1. **Round 0**: Initiator starts protocol, generates first message
2. **Round 1**: All parties exchange initial messages
3. **Round 2**: Parties process messages and generate responses
4. **Round 3**: Parties process responses and generate final messages
5. **Round 4**: Parties combine messages to generate key shares

### Signing (4 Rounds)

1. **Round 0**: Initiator starts signing with message hash
2. **Round 1**: Parties exchange signing messages
3. **Round 2**: Parties process messages and generate responses
4. **Round 3**: Parties create pre-signatures
5. **Round 4**: Parties combine signatures to produce final signature

## Security Considerations

- **Key Storage**: Key shares are stored locally and should be encrypted
- **Network Security**: Use WSS (secure WebSocket) in production
- **Authentication**: Always use API keys for server communication
- **Input Validation**: Validate all inputs before processing
- **Memory Management**: Sensitive data is cleared from memory after use

## Platform Support

### Browser
```html
<script type="module">
  import { DeFiShArdSDK } from './pkg/defishard_sdk.js';
  // Use SDK
</script>
```

### React Native
```typescript
import { DeFiShArdSDK } from 'defishard-sdk';
// Use SDK with secure storage
```

### Browser Extension
```typescript
import { DeFiShArdSDK } from 'defishard-sdk';
// Use SDK with extension storage
```

## Development

### Building

```bash
# Build WASM
npm run build

# Build for specific targets
npm run build:web      # Web browsers
npm run build:node     # Node.js
npm run build:all      # All targets
```

### Testing

```bash
# Run tests
npm test

# Browser tests
npm run test:browser
```

### Development Server

```bash
npm run dev
```

## Examples

See the `examples/` directory for complete working examples:

- `basic-usage.ts` - Basic SDK usage
- `mobile-example.ts` - React Native integration
- `extension-example.ts` - Browser extension integration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- Documentation: [GitHub Wiki](https://github.com/your-org/defishard-sdk/wiki)
- Issues: [GitHub Issues](https://github.com/your-org/defishard-sdk/issues)
- Discussions: [GitHub Discussions](https://github.com/your-org/defishard-sdk/discussions)
