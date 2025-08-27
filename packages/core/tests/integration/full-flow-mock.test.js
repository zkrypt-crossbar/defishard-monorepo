#!/usr/bin/env node

/**
 * Mock Full Flow Integration Test
 * Tests the integration test structure without requiring the compiled SDK
 */

// Mock SDK for testing the test structure
class MockDeFiShArdSDK {
  constructor(config) {
    this.config = config;
    this._isConnected = false;
    this.eventListeners = {};
    this.storage = config.storage;
    this.generatedKeyshare = null;
    this.generatedSignature = null;
  }

  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  once(event, callback) {
    const wrappedCallback = (...args) => {
      callback(...args);
      // Remove the listener after first call
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== wrappedCallback);
    };
    this.on(event, wrappedCallback);
  }

  emit(event, ...args) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => callback(...args));
    }
  }

  isConnected() {
    return this._isConnected;
  }

  async connect() {
    this._isConnected = true;
    return true;
  }

  async disconnect() {
    this._isConnected = false;
    return true;
  }

  async createGroup(totalParties, threshold) {
    return {
      groupId: 'mock-group-' + Date.now(),
      totalParties,
      threshold,
      success: true
    };
  }

  async joinGroup(groupId) {
    return {
      groupId,
      partyId: 'mock-party-' + Math.floor(Math.random() * 1000),
      partyIndex: 0,
      success: true
    };
  }

  async startKeygen(distributed = true) {
    // Simulate keygen process
    setTimeout(() => {
      const mockKeyshare = {
        toBytes: () => new Uint8Array([1, 2, 3, 4, 5]),
        publicKey: new Uint8Array([10, 20, 30, 40, 50]),
        partyId: 1,
        threshold: 2,
        participants: 3
      };
      this.generatedKeyshare = mockKeyshare;
      this.emit('keygenComplete', mockKeyshare);
    }, 1000);
  }

  async startSigning(messageHash) {
    // Simulate signing process
    setTimeout(() => {
      const mockSignature = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8])
      ];
      this.generatedSignature = mockSignature;
      this.emit('signingComplete', mockSignature);
    }, 1000);
  }

  getStorage() {
    return this.storage;
  }
}

// Mock storage
class MockLocalStorageAdapter {
  constructor() {
    this.data = {};
  }

  async saveKeyShare(groupId, partyId, keyshare) {
    const key = `${groupId}_${partyId}`;
    this.data[key] = keyshare;
  }

  async getKeyShare(groupId, partyId) {
    const key = `${groupId}_${partyId}`;
    return this.data[key] || null;
  }

  async deleteKeyShare(groupId, partyId) {
    const key = `${groupId}_${partyId}`;
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

// Test configuration
const TEST_CONFIG = {
  relayerUrl: 'https://mock.relayer.defishard.com',
  websocketUrl: 'wss://mock.relayer.defishard.com',
  apiKey: 'mock-api-key',
  groupId: 'mock-group-' + Date.now(),
  partyId: 'mock-party-' + Math.floor(Math.random() * 1000),
  totalParties: 3,
  threshold: 2,
  timeout: 5000,
  retryAttempts: 2
};

// Test utilities
class IntegrationTestRunner {
  constructor() {
    this.results = [];
    this.totalTests = 0;
    this.passedTests = 0;
    this.sdk = null;
    this.generatedKeyshare = null;
  }

  async runTest(name, testFn) {
    try {
      console.log(`\n🧪 Running: ${name}`);
      const startTime = Date.now();
      
      await testFn();
      
      const duration = Date.now() - startTime;
      console.log(`✅ ${name} (${duration}ms)`);
      this.passedTests++;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
    }
    this.totalTests++;
  }

  printSummary() {
    console.log(`\n📊 Mock Integration Test Summary:`);
    console.log(`Total Tests: ${this.totalTests}`);
    console.log(`Passed: ${this.passedTests}`);
    console.log(`Failed: ${this.totalTests - this.passedTests}`);
    
    if (this.totalTests > 0) {
      const successRate = ((this.passedTests / this.totalTests) * 100).toFixed(1);
      console.log(`Success Rate: ${successRate}%`);
    }
  }

  async waitForEvent(sdk, eventName, timeout = TEST_CONFIG.timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${eventName} event`));
      }, timeout);

      sdk.once(eventName, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  async retryOperation(operation, maxAttempts = TEST_CONFIG.retryAttempts) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.log(`Attempt ${attempt} failed: ${error.message}`);
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        }
      }
    }
    throw lastError;
  }
}

// Helper functions
function createTestMessage() {
  return {
    message: 'Hello, DefiShard!',
    timestamp: Date.now(),
    nonce: Math.random().toString(36).substring(7)
  };
}

function createMessageHash(message) {
  // Simple hash simulation
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(message));
  return new Uint8Array(32).fill(1); // Mock 32-byte hash
}

// Integration tests
async function runMockFullFlowIntegrationTests() {
  const runner = new IntegrationTestRunner();
  
  console.log('🚀 DefiShard SDK Mock Full Flow Integration Tests');
  console.log('================================================');
  console.log(`Relayer URL: ${TEST_CONFIG.relayerUrl}`);
  console.log(`WebSocket URL: ${TEST_CONFIG.websocketUrl}`);
  console.log(`Group ID: ${TEST_CONFIG.groupId}`);
  console.log(`Party ID: ${TEST_CONFIG.partyId}`);
  console.log('');

  // Test 1: SDK Initialization
  await runner.runTest('SDK Initialization with Mock Backend', async () => {
    const storage = new MockLocalStorageAdapter();
    
    runner.sdk = new MockDeFiShArdSDK({
      relayerUrl: TEST_CONFIG.relayerUrl,
      websocketUrl: TEST_CONFIG.websocketUrl,
      apiKey: TEST_CONFIG.apiKey,
      storage: storage
    });

    await runner.sdk.connect();
    const isConnected = runner.sdk.isConnected();
    
    if (!isConnected) {
      throw new Error('SDK failed to connect to mock backend');
    }

    console.log('✅ SDK initialized and connected to mock backend');
  });

  // Test 2: Group Creation
  await runner.runTest('Group Creation', async () => {
    const groupResult = await runner.retryOperation(async () => {
      return await runner.sdk.createGroup(
        TEST_CONFIG.totalParties,
        TEST_CONFIG.threshold
      );
    });

    if (!groupResult.groupId) {
      throw new Error('Group creation failed - no group ID returned');
    }

    console.log(`✅ Group created: ${groupResult.groupId}`);
    console.log(`   Total parties: ${groupResult.totalParties}`);
    console.log(`   Threshold: ${groupResult.threshold}`);
  });

  // Test 3: Group Joining
  await runner.runTest('Group Joining', async () => {
    const joinResult = await runner.retryOperation(async () => {
      return await runner.sdk.joinGroup(TEST_CONFIG.groupId);
    });

    if (!joinResult.success) {
      throw new Error('Failed to join group');
    }

    console.log(`✅ Joined group: ${joinResult.groupId}`);
    console.log(`   Party ID: ${joinResult.partyId}`);
    console.log(`   Party Index: ${joinResult.partyIndex}`);
  });

  // Test 4: Key Generation Flow
  await runner.runTest('Complete Key Generation Flow', async () => {
    console.log('   Starting distributed key generation...');
    
    const keygenPromise = runner.waitForEvent(runner.sdk, 'keygenComplete');
    await runner.sdk.startKeygen(true);
    
    const keyshare = await keygenPromise;
    
    if (!keyshare) {
      throw new Error('Key generation failed - no keyshare returned');
    }

    if (!keyshare.publicKey || !keyshare.toBytes) {
      throw new Error('Invalid keyshare structure');
    }

    runner.generatedKeyshare = keyshare;
    
    console.log(`✅ Key generation completed`);
    console.log(`   Public key length: ${keyshare.publicKey.length} bytes`);
    console.log(`   Party ID: ${keyshare.partyId}`);
    console.log(`   Threshold: ${keyshare.threshold}`);
    console.log(`   Participants: ${keyshare.participants}`);
  });

  // Test 5: Keyshare Storage and Retrieval
  await runner.runTest('Keyshare Storage and Retrieval', async () => {
    if (!runner.generatedKeyshare) {
      throw new Error('No keyshare available for storage test');
    }

    const storage = runner.sdk.getStorage();
    await storage.saveKeyShare(TEST_CONFIG.groupId, 0, runner.generatedKeyshare);
    
    const retrievedKeyshare = await storage.getKeyShare(TEST_CONFIG.groupId, 0);
    
    if (!retrievedKeyshare) {
      throw new Error('Failed to retrieve stored keyshare');
    }

    const originalBytes = runner.generatedKeyshare.toBytes();
    const retrievedBytes = retrievedKeyshare.toBytes();
    
    if (originalBytes.length !== retrievedBytes.length) {
      throw new Error('Retrieved keyshare has different size');
    }

    console.log(`✅ Keyshare stored and retrieved successfully`);
    console.log(`   Original size: ${originalBytes.length} bytes`);
    console.log(`   Retrieved size: ${retrievedBytes.length} bytes`);
  });

  // Test 6: Message Preparation
  await runner.runTest('Message Preparation for Signing', async () => {
    const testMessage = createTestMessage();
    const messageHash = createMessageHash(testMessage);
    
    if (messageHash.length !== 32) {
      throw new Error('Invalid message hash length');
    }

    runner.testMessage = testMessage;
    runner.messageHash = messageHash;
    
    console.log(`✅ Message prepared for signing`);
    console.log(`   Message: ${JSON.stringify(testMessage)}`);
    console.log(`   Hash length: ${messageHash.length} bytes`);
  });

  // Test 7: Complete Signing Flow
  await runner.runTest('Complete Signing Flow', async () => {
    if (!runner.generatedKeyshare || !runner.messageHash) {
      throw new Error('Missing keyshare or message hash for signing');
    }

    console.log('   Starting distributed signature generation...');
    
    const signingPromise = runner.waitForEvent(runner.sdk, 'signingComplete');
    await runner.sdk.startSigning(runner.messageHash);
    
    const signature = await signingPromise;
    
    if (!signature) {
      throw new Error('Signing failed - no signature returned');
    }

    if (!Array.isArray(signature) || signature.length !== 2) {
      throw new Error('Invalid signature structure - expected [r, s] array');
    }

    const [r, s] = signature;
    if (!(r instanceof Uint8Array) || !(s instanceof Uint8Array)) {
      throw new Error('Invalid signature components - expected Uint8Array');
    }

    runner.generatedSignature = signature;
    
    console.log(`✅ Signature generation completed`);
    console.log(`   R component: ${r.length} bytes`);
    console.log(`   S component: ${s.length} bytes`);
    console.log(`   R (hex): ${Buffer.from(r).toString('hex')}`);
    console.log(`   S (hex): ${Buffer.from(s).toString('hex')}`);
  });

  // Test 8: Multiple Signing Operations
  await runner.runTest('Multiple Signing Operations', async () => {
    if (!runner.generatedKeyshare) {
      throw new Error('No keyshare available for multiple signing test');
    }

    const signatures = [];
    const messages = [
      createTestMessage(),
      createTestMessage(),
      createTestMessage()
    ];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const messageHash = createMessageHash(message);
      
      console.log(`   Signing message ${i + 1}/${messages.length}...`);
      
      const signingPromise = runner.waitForEvent(runner.sdk, 'signingComplete');
      await runner.sdk.startSigning(messageHash);
      const signature = await signingPromise;
      
      signatures.push(signature);
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (signatures.length !== messages.length) {
      throw new Error('Not all messages were signed');
    }

    console.log(`✅ Multiple signing operations completed`);
    console.log(`   Messages signed: ${signatures.length}`);
    
    for (let i = 0; i < signatures.length; i++) {
      const [r, s] = signatures[i];
      if (!(r instanceof Uint8Array) || !(s instanceof Uint8Array)) {
        throw new Error(`Invalid signature structure for message ${i + 1}`);
      }
    }
  });

  // Test 9: Cleanup and Disconnection
  await runner.runTest('Cleanup and Disconnection', async () => {
    await runner.sdk.disconnect();
    
    const isConnected = runner.sdk.isConnected();
    if (isConnected) {
      throw new Error('SDK should be disconnected');
    }

    console.log(`✅ SDK disconnected successfully`);
  });

  runner.printSummary();
  
  // Cleanup
  if (runner.sdk) {
    try {
      await runner.sdk.disconnect();
    } catch (error) {
      console.log('Warning: Error during final cleanup:', error.message);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runMockFullFlowIntegrationTests().catch(error => {
    console.error('Mock integration tests failed:', error);
    process.exit(1);
  });
} 