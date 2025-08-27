# 🧪 DefiShard SDK Tests

This directory contains all tests for the DefiShard SDK, organized by test type and scope.

## 📁 Test Structure

```
tests/
├── unit/                    # Unit tests for individual components
│   ├── storage.test.js     # Storage interface tests
│   ├── keygen-processor.test.js  # Keygen processor tests
│   ├── sign-processor.test.js    # Sign processor tests
│   └── storage.test.ts     # TypeScript storage tests
├── integration/            # Integration tests with real backend
│   ├── config.js           # Environment configuration
│   ├── sdk-integration.test.js    # Basic SDK integration
│   ├── full-flow.test.js   # Complete keygen + signing flow
│   └── multi-party.test.js # Multi-party scenarios
├── e2e/                   # End-to-end tests
│   └── (future e2e tests)
├── setup.js               # Global test setup
├── test-runner.js         # Main test runner
└── README.md              # This file
```

## 🚀 Running Tests

### All Tests
```bash
npm test
# or
npm run test:all
```

### Unit Tests Only
```bash
npm run test:unit
```

### Individual Unit Tests
```bash
npm run test:unit:storage    # Storage tests only
npm run test:unit:keygen     # Keygen processor tests only
npm run test:unit:sign       # Sign processor tests only
```

### Integration Tests Only
```bash
npm run test:integration
```

### Individual Integration Tests
```bash
npm run test:integration:full-flow    # Complete keygen + signing flow
npm run test:integration:multi-party  # Multi-party scenarios
```

### E2E Tests Only
```bash
npm run test:e2e
```

### With Coverage
```bash
npm run test:coverage
```

## 🧪 Test Categories

### Unit Tests (`tests/unit/`)
- **Purpose**: Test individual components in isolation
- **Scope**: Single functions, classes, or modules
- **Dependencies**: Mocked external dependencies
- **Speed**: Fast execution

**Examples:**
- Storage interface implementations
- Keygen processor (distributed key generation)
- Sign processor (distributed signature generation)
- Utility functions
- Individual SDK methods

### Integration Tests (`tests/integration/`)
- **Purpose**: Test how components work together
- **Scope**: Multiple components interacting
- **Dependencies**: Real implementations of some dependencies
- **Speed**: Medium execution

**Examples:**
- SDK with real storage implementations
- Complete keygen and signing flows with real backend
- Multi-party scenarios with real network communication
- API client with real server
- WebSocket communication with real relay
- Error handling and recovery with real network conditions

### E2E Tests (`tests/e2e/`)
- **Purpose**: Test complete user workflows
- **Scope**: Full application from user perspective
- **Dependencies**: Real implementations (browser, network)
- **Speed**: Slow execution

**Examples:**
- Complete key generation flow
- End-to-end signing process
- Real browser testing

## 🔧 Test Setup

### Global Setup (`tests/setup.js`)
This file runs before all tests and provides:
- Mock implementations for browser APIs (localStorage, crypto, WebSocket)
- Global test utilities
- Jest configuration

### Integration Test Configuration (`tests/integration/config.js`)
Environment-specific configuration for integration tests:
- **Test Environment**: Default configuration for development testing
- **Staging Environment**: Configuration for staging server testing
- **Production Environment**: Configuration for production server testing

#### Environment Variables
```bash
# Required for real backend testing
export TEST_RELAYER_URL="https://your-relayer-url.com"
export TEST_WEBSOCKET_URL="wss://your-websocket-url.com"
export TEST_API_KEY="your-api-key"

# Optional overrides
export TEST_TIMEOUT=30000
export TEST_RETRY_ATTEMPTS=3
export TEST_TOTAL_PARTIES=3
export TEST_THRESHOLD=2

# Environment selection
export NODE_ENV="test"  # or "staging", "production"
```

### Test Utilities
```javascript
// Create a test keyshare
const testKeyshare = createTestKeyshare();

// Create a mock storage
const mockStorage = createMockStorage({
  getKeyShare: jest.fn().mockResolvedValue(testKeyshare)
});
```

## 📊 Test Results

Tests output results in the following format:
```
🧪 Running Unit Tests - Storage...

✅ LocalStorageAdapter - store and retrieve
✅ LocalStorageAdapter - return null for non-existent
✅ LocalStorageAdapter - delete keyshare
...

📊 Test Summary:
Total Tests: 13
Passed: 13
Failed: 0
Success Rate: 100.0%
```

## 🚀 Running Integration Tests with Real Backends

### Prerequisites
1. **Backend Server**: A running DefiShard relay server
2. **API Key**: Valid API key for authentication
3. **Network Access**: Ability to connect to the relay server

### Setup
```bash
# Set environment variables
export TEST_RELAYER_URL="https://your-relayer-url.com"
export TEST_WEBSOCKET_URL="wss://your-websocket-url.com"
export TEST_API_KEY="your-api-key"

# Run integration tests
npm run test:integration:full-flow
npm run test:integration:multi-party
```

### Test Scenarios

#### Full Flow Integration Tests (`full-flow.test.js`)
- **Complete Key Generation**: End-to-end DKG process with real backend
- **Complete Signing**: End-to-end DSG process with real backend
- **Storage Integration**: Real keyshare storage and retrieval
- **Error Handling**: Network errors, invalid inputs, recovery
- **Multiple Operations**: Sequential and concurrent operations
- **State Recovery**: Reconnection and state persistence

#### Multi-Party Integration Tests (`multi-party.test.js`)
- **Multi-Party Key Generation**: 3+ parties participating in DKG
- **Multi-Party Signing**: 3+ parties participating in DSG
- **Threshold Operations**: Signing with some parties offline
- **Concurrent Operations**: Multiple signing operations simultaneously
- **Party Failure Simulation**: Testing resilience with party disconnections
- **State Persistence**: Keyshare persistence across reconnections

### Expected Results
- **Success Rate**: 100% for properly configured environments
- **Performance**: Key generation: 30-60s, Signing: 10-30s
- **Network**: Real WebSocket communication with relay server
- **Storage**: Real keyshare storage and retrieval

## 🛠️ Writing Tests
```javascript
// tests/unit/example.test.js
describe('Example Tests', () => {
  test('should work correctly', async () => {
    // Test implementation
    expect(result).toBe(expected);
  });
});
```

### TypeScript Tests
```typescript
// tests/unit/example.test.ts
import { SomeClass } from '../../js/some-class';

describe('Example Tests', () => {
  test('should work correctly', async () => {
    const instance = new SomeClass();
    const result = await instance.doSomething();
    expect(result).toBe(expected);
  });
});
```

### Integration Tests
```javascript
// tests/integration/example.test.js
describe('Integration Tests', () => {
  test('should work with real dependencies', async () => {
    const storage = new LocalStorageAdapter();
    const sdk = new SDK({ storage });
    
    await sdk.initialize();
    expect(await sdk.isStorageAvailable()).toBe(true);
  });
});
```

## 🔍 Debugging Tests

### Running Individual Tests
```bash
# Run specific test file
node tests/unit/storage.test.js

# Run with Jest
npx jest tests/unit/storage.test.ts

# Run with verbose output
npx jest --verbose tests/unit/
```

### Debug Mode
```bash
# Run tests with Node.js debugger
node --inspect-brk tests/unit/storage.test.js

# Run Jest with debugger
npx jest --runInBand --detectOpenHandles tests/unit/
```

## 📈 Coverage

Generate coverage reports:
```bash
npm run test:coverage
```

Coverage reports are generated in the `coverage/` directory:
- `coverage/lcov-report/index.html` - HTML coverage report
- `coverage/lcov.info` - LCOV format for CI/CD

## 🚨 Best Practices

1. **Test Naming**: Use descriptive test names that explain the expected behavior
2. **Arrange-Act-Assert**: Structure tests with clear sections
3. **Mock Dependencies**: Mock external dependencies to isolate units
4. **Test Edge Cases**: Include tests for error conditions and edge cases
5. **Keep Tests Fast**: Unit tests should run quickly
6. **Use Setup/Teardown**: Clean up state between tests
7. **Test Coverage**: Aim for high test coverage, especially for critical paths

## 🔄 Continuous Integration

Tests are automatically run in CI/CD pipelines:
- Unit tests run on every commit
- Integration tests run on pull requests
- E2E tests run on main branch merges

## 📝 Adding New Tests

1. Create test file in appropriate directory
2. Follow naming convention: `*.test.js` or `*.test.ts`
3. Import required dependencies
4. Write tests using Jest syntax
5. Run tests locally to verify
6. Update this README if adding new test categories 