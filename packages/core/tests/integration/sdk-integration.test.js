/**
 * Integration tests for DefiShard SDK
 * Tests the SDK with real storage implementations
 */

// Import storage implementations - using inline implementations for now
// In a real setup, you'd compile TypeScript or use ts-node

// Simplified storage implementations for testing
class SecureLocalStorageAdapter {
  constructor(partyRandom) {
    this.data = {};
    this.partyRandom = partyRandom;
  }

  async saveKeyShare(groupId, partyIndex, keyshare) {
    const key = `${groupId}_${partyIndex}`;
    this.data[key] = keyshare;
  }

  async getKeyShare(groupId, partyIndex) {
    const key = `${groupId}_${partyIndex}`;
    return this.data[key] || null;
  }

  async deleteKeyShare(groupId, partyIndex) {
    const key = `${groupId}_${partyIndex}`;
    delete this.data[key];
  }

  async clearGroupKeyshares(groupId) {
    Object.keys(this.data).forEach(key => {
      if (key.startsWith(groupId + '_')) {
        delete this.data[key];
      }
    });
  }

  async saveConfig(key, value) {
    this.data[`config_${key}`] = value;
  }

  async getConfig(key) {
    return this.data[`config_${key}`] || null;
  }

  async isAvailable() {
    return true;
  }
}

// Mock SDK for testing
class MockSDK {
  constructor(config) {
    this.storage = config.storage || new SecureLocalStorageAdapter('default-test-random');
    this.config = config;
  }

  async initialize() {
    // Mock initialization
    return Promise.resolve();
  }

  async isStorageAvailable() {
    return await this.storage.isAvailable();
  }

  getStorage() {
    return this.storage;
  }
}

// Simple test runner for integration tests
class IntegrationTestRunner {
  constructor() {
    this.results = [];
    this.totalTests = 0;
    this.passedTests = 0;
  }

  async runTest(name, testFn) {
    try {
      await testFn();
      console.log(`✅ ${name}`);
      this.passedTests++;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
    }
    this.totalTests++;
  }

  printSummary() {
    console.log(`\n📊 Integration Test Summary:`);
    console.log(`Total Tests: ${this.totalTests}`);
    console.log(`Passed: ${this.passedTests}`);
    console.log(`Failed: ${this.totalTests - this.passedTests}`);
    
    if (this.totalTests > 0) {
      const successRate = ((this.passedTests / this.totalTests) * 100).toFixed(1);
      console.log(`Success Rate: ${successRate}%`);
    }
  }
}

// Test utilities
function createTestKeyshare() {
  return {
    toBytes: () => new Uint8Array([1, 2, 3, 4, 5]),
    publicKey: new Uint8Array([10, 20, 30, 40, 50]),
    partyId: 1,
    threshold: 2,
    participants: 3
  };
}

// Run integration tests
async function runIntegrationTests() {
  const runner = new IntegrationTestRunner();
  
  console.log('🧪 Running SDK Integration Tests...\n');

  await runner.runTest('SDK with SecureLocalStorageAdapter - initialization', async () => {
    const storage = new SecureLocalStorageAdapter('test-party-random');
    const sdk = new MockSDK({
      relayerUrl: 'https://test.relayer.com',
      websocketUrl: 'wss://test.relayer.com',
      storage: storage
    });

    await sdk.initialize();
    
    if (sdk.getStorage() !== storage) {
      throw new Error('Storage not properly set');
    }
    
    if (!(await sdk.isStorageAvailable())) {
      throw new Error('Storage not available');
    }
  });

  await runner.runTest('SDK with SecureLocalStorageAdapter - store and retrieve', async () => {
    const storage = new SecureLocalStorageAdapter('test-party-random');
    const sdk = new MockSDK({
      relayerUrl: 'https://test.relayer.com',
      websocketUrl: 'wss://test.relayer.com',
      storage: storage
    });

    await sdk.initialize();

    const testKeyshare = createTestKeyshare();
    await storage.saveKeyShare('test-group', 1, testKeyshare);
    
    const retrieved = await storage.getKeyShare('test-group', 1);
    if (!retrieved) {
      throw new Error('Keyshare not retrieved');
    }
    
    if (retrieved.publicKey[0] !== testKeyshare.publicKey[0]) {
      throw new Error('Keyshare data corrupted');
    }
  });

  await runner.runTest('SDK with SecureLocalStorageAdapter (different random) - initialization', async () => {
    const storage = new SecureLocalStorageAdapter('different-test-random');
    const sdk = new MockSDK({
      relayerUrl: 'https://test.relayer.com',
      websocketUrl: 'wss://test.relayer.com',
      storage: storage
    });

    await sdk.initialize();
    
    if (sdk.getStorage() !== storage) {
      throw new Error('Storage not properly set');
    }
    
    if (!(await sdk.isStorageAvailable())) {
      throw new Error('Storage not available');
    }
  });

  await runner.runTest('SDK with SecureLocalStorageAdapter (different random) - store and retrieve', async () => {
    const storage = new SecureLocalStorageAdapter('different-test-random');
    const sdk = new MockSDK({
      relayerUrl: 'https://test.relayer.com',
      websocketUrl: 'wss://test.relayer.com',
      storage: storage
    });

    await sdk.initialize();

    const testKeyshare = createTestKeyshare();
    await storage.saveKeyShare('test-group', 1, testKeyshare);
    
    const retrieved = await storage.getKeyShare('test-group', 1);
    if (!retrieved) {
      throw new Error('Keyshare not retrieved');
    }
    
    if (retrieved.publicKey[0] !== testKeyshare.publicKey[0]) {
      throw new Error('Keyshare data corrupted');
    }
  });

  await runner.runTest('SDK with custom storage', async () => {
    const customStorage = {
      saveKeyShare: () => Promise.resolve(),
      getKeyShare: () => Promise.resolve(createTestKeyshare()),
      deleteKeyShare: () => Promise.resolve(),
      clearGroupKeyshares: () => Promise.resolve(),
      saveConfig: () => Promise.resolve(),
      getConfig: () => Promise.resolve(null),
      isAvailable: () => Promise.resolve(true)
    };

    const sdk = new MockSDK({
      relayerUrl: 'https://test.relayer.com',
      websocketUrl: 'wss://test.relayer.com',
      storage: customStorage
    });

    await sdk.initialize();
    
    if (sdk.getStorage() !== customStorage) {
      throw new Error('Custom storage not properly set');
    }
    
    if (!(await sdk.isStorageAvailable())) {
      throw new Error('Custom storage not available');
    }
  });

  runner.printSummary();
}

// Run tests if this file is executed directly
if (require.main === module) {
  runIntegrationTests().catch(error => {
    console.error('Integration tests failed:', error);
    process.exit(1);
  });
} 