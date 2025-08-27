# DeFiShArd Cross-Platform Monorepo

A unified repository for DeFiShArd's secure MPC key generation and threshold signing across all platforms.

## 🏗️ Architecture

```
defishard-monorepo/
├── packages/
│   ├── core/           # Rust core + WASM bindings
│   ├── sdk/            # Cross-platform TypeScript SDK
│   ├── extension/      # Browser extension
│   ├── web/            # Web application
│   └── mobile/         # React Native mobile app
└── tools/              # Shared build tools and configs
```

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- Rust + Cargo
- wasm-pack
- React Native CLI (for mobile development)

### Setup

```bash
# Clone and setup
git clone <repo-url> defishard-monorepo
cd defishard-monorepo
./setup.sh
```

### Development

```bash
# Build everything
npm run build:all

# Develop specific platforms
npm run dev:extension    # Extension development
npm run dev:web         # Web app development  
npm run dev:mobile      # Mobile app development

# Run tests
npm run test:all
```

## 📦 Packages

### Core (`packages/core/`)
- **Language**: Rust
- **Purpose**: Core cryptographic functions and WASM bindings
- **Outputs**: WASM modules for web platforms

### SDK (`packages/sdk/`)
- **Language**: TypeScript
- **Purpose**: Cross-platform SDK with platform-specific adapters
- **Outputs**: 
  - `dist/web/` - ES modules for web
  - `dist/extension/` - IIFE bundle for extensions
  - `dist/mobile/` - CommonJS for React Native
  - `dist/node/` - Node.js modules

### Extension (`packages/extension/`)
- **Platform**: Chrome/Firefox browser extension
- **Features**: Service worker background, popup UI, content scripts
- **Dependencies**: Uses SDK extension build

### Web (`packages/web/`)
- **Platform**: Web browsers
- **Framework**: React (existing web app)
- **Dependencies**: Uses SDK web build

### Mobile (`packages/mobile/`)
- **Platform**: iOS/Android
- **Framework**: React Native
- **Features**: Native mobile app with shared SDK logic
- **Dependencies**: Uses SDK mobile build

## 🔧 Platform-Specific Usage

### Browser Extension

```javascript
import { createExtensionSDK } from '@defishard/sdk';

const sdk = createExtensionSDK({
  relayerUrl: 'http://localhost:3000',
  websocketUrl: 'ws://localhost:3000'
});

await sdk.initialize();
```

### Web Application

```javascript
import { createWebSDK } from '@defishard/sdk';

const sdk = createWebSDK({
  relayerUrl: 'http://localhost:3000',
  websocketUrl: 'ws://localhost:3000'
});

await sdk.initialize();
```

### React Native Mobile

```javascript
import { createMobileSDK } from '@defishard/sdk';

const sdk = createMobileSDK({
  relayerUrl: 'http://localhost:3000',
  websocketUrl: 'ws://localhost:3000'
});

await sdk.initialize();
```

## 🛠️ Build System

The monorepo uses a multi-target build system:

1. **Rust Core**: Built with Cargo to WASM
2. **SDK**: Built with esbuild to multiple targets
3. **Platforms**: Each platform uses the appropriate SDK build

### Build Targets

- **Web**: ES modules for modern browsers
- **Extension**: IIFE bundle for service workers (no eval)
- **Mobile**: CommonJS for React Native Metro bundler
- **Node**: CommonJS for server-side usage

## 🔄 Development Workflow

### Making Changes

1. **Core Changes**: Edit Rust code in `packages/core/src/`
2. **SDK Changes**: Edit TypeScript code in `packages/sdk/src/`
3. **Platform Changes**: Edit platform-specific code in respective packages

### Testing Changes

```bash
# Test SDK
cd packages/sdk && npm test

# Test specific platform
cd packages/extension && npm run build && # load in browser
cd packages/web && npm run dev
cd packages/mobile && npm run android
```

## 📱 Mobile Development

### iOS Setup

```bash
cd packages/mobile
npx pod-install ios
npm run ios
```

### Android Setup

```bash
cd packages/mobile
npm run android
```

## 🔌 Extension Development

```bash
cd packages/extension
npm run dev

# Load packages/extension as unpacked extension in Chrome
```

## 🌐 Web Development

```bash
cd packages/web
npm run dev
```

## 🏗️ Adding New Platforms

1. Create new package: `packages/my-platform/`
2. Add platform-specific SDK adapter in `packages/sdk/adapters/`
3. Create platform wrapper in `packages/sdk/src/platforms/`
4. Add build target in `packages/sdk/build.config.js`
5. Update root scripts in `package.json`

## 📊 Storage Adapters

The SDK includes platform-specific storage adapters:

- **Web**: `localStorage`
- **Extension**: `chrome.storage.local`
- **Mobile**: `AsyncStorage`
- **Custom**: Implement `StorageInterface`

## 🔐 Security Considerations

- Service workers have strict CSP (no eval)
- WASM modules are loaded securely
- Storage is encrypted where possible
- Each platform uses appropriate security models

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following the existing patterns
4. Test across platforms
5. Submit a pull request

## 📄 License

MIT License - see LICENSE.md for details
