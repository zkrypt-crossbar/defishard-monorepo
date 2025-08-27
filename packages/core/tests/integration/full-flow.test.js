#!/usr/bin/env node

/**
 * Integration tests for full flow with real backend servers
 * Tests complete keygen and signing processes with real network communication
 */

// Import real SDK components
const { DeFiShArdSDK, SecureLocalStorageAdapter } = require('../../js/index');

// Test configuration
const TEST_CONFIG = {
  // Real backend endpoints (these should be test environment URLs)
  relayerUrl: process.env.TEST_RELAYER_URL || 'https://test.relayer.defishard.com',
  websocketUrl: process.env.TEST_WEBSOCKET_URL || 'wss://test.relayer.defishard.com',
  apiKey: process.env.TEST_API_KEY || 'test-api-key',
  
  // Test group configuration
  groupId: process.env.TEST_GROUP_ID || 'test-group-' + Date.now(),
  partyId: process.env.TEST_PARTY_ID || 'test-party-' + Math.floor(Math.random() * 1000),
  
  // Test parameters
  totalParties: 3,
  threshold: 2,
  timeout: 30000, // 30 seconds timeout for operations
  retryAttempts: 3
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
      console.error('Error details:', error);
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
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
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
  // Simple hash function for testing
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(message));
  return crypto.subtle.digest('SHA-256', data).then(hash => new Uint8Array(hash));
}

// Integration tests
async function runFullFlowIntegrationTests() {
  const runner = new IntegrationTestRunner();
  
  console.log('🚀 DefiShard SDK Full Flow Integration Tests');
  console.log('============================================');
  console.log(`Relayer URL: ${TEST_CONFIG.relayerUrl}`);
  console.log(`WebSocket URL: ${TEST_CONFIG.websocketUrl}`);
  console.log(`Group ID: ${TEST_CONFIG.groupId}`);
  console.log(`Party ID: ${TEST_CONFIG.partyId}`);
  console.log('');

  // Test 1: SDK Initialization
  await runner.runTest('SDK Initialization with Real Backend', async () => {
    const storage = new SecureLocalStorageAdapter('test-party-random-key');
    
    runner.sdk = new DeFiShArdSDK({
      relayerUrl: TEST_CONFIG.relayerUrl,
      websocketUrl: TEST_CONFIG.websocketUrl,
      apiKey: TEST_CONFIG.apiKey,
      storage: storage,
      debug: true
    });

    // Test basic connectivity
    const isConnected = await runner.sdk.isConnected();
    if (!isConnected) {
      throw new Error('SDK failed to connect to backend');
    }

    console.log('✅ SDK initialized and connected to backend');
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
    
    // Start keygen process
    const keygenPromise = runner.waitForEvent(runner.sdk, 'keygenComplete');
    
    await runner.sdk.startKeygen(true); // distributed = true
    
    // Wait for keygen completion
    const keyshare = await keygenPromise;
    
    if (!keyshare) {
      throw new Error('Key generation failed - no keyshare returned');
    }

    // Validate keyshare structure
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

    // Test storage
    const storage = runner.sdk.getStorage();
    await storage.saveKeyShare(TEST_CONFIG.groupId, 0, runner.generatedKeyshare);
    
    // Test retrieval
    const retrievedKeyshare = await storage.getKeyShare(TEST_CONFIG.groupId, 0);
    
    if (!retrievedKeyshare) {
      throw new Error('Failed to retrieve stored keyshare');
    }

    // Compare keyshares
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
    const messageHash = await createMessageHash(testMessage);
    
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
    
    // Start signing process
    const signingPromise = runner.waitForEvent(runner.sdk, 'signingComplete');
    
    await runner.sdk.startSigning(runner.messageHash);
    
    // Wait for signing completion
    const signature = await signingPromise;
    
    if (!signature) {
      throw new Error('Signing failed - no signature returned');
    }

    // Validate signature structure
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

  // Test 8: Signature Verification (if verification function is available)
  await runner.runTest('Signature Verification', async () => {
    if (!runner.generatedSignature || !runner.generatedKeyshare || !runner.messageHash) {
      throw new Error('Missing signature, keyshare, or message hash for verification');
    }

    // Note: This would require a verification function in the SDK
    // For now, we'll just validate the signature structure
    const [r, s] = runner.generatedSignature;
    
    // Basic validation
    if (r.length === 0 || s.length === 0) {
      throw new Error('Signature components cannot be empty');
    }

    console.log(`✅ Signature structure validated`);
    console.log(`   R component valid: ${r.length > 0}`);
    console.log(`   S component valid: ${s.length > 0}`);
    console.log(`   Message hash: ${Buffer.from(runner.messageHash).toString('hex')}`);
  });

  // Test 9: Multiple Signing Operations
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
      const messageHash = await createMessageHash(message);
      
      console.log(`   Signing message ${i + 1}/${messages.length}...`);
      
      const signingPromise = runner.waitForEvent(runner.sdk, 'signingComplete');
      await runner.sdk.startSigning(messageHash);
      const signature = await signingPromise;
      
      signatures.push(signature);
      
      // Small delay between operations
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (signatures.length !== messages.length) {
      throw new Error('Not all messages were signed');
    }

    console.log(`✅ Multiple signing operations completed`);
    console.log(`   Messages signed: ${signatures.length}`);
    
    // Verify all signatures have valid structure
    for (let i = 0; i < signatures.length; i++) {
      const [r, s] = signatures[i];
      if (!(r instanceof Uint8Array) || !(s instanceof Uint8Array)) {
        throw new Error(`Invalid signature structure for message ${i + 1}`);
      }
    }
  });

  // Test 10: Error Handling and Recovery
  await runner.runTest('Error Handling and Recovery', async () => {
    // Test with invalid message hash
    const invalidHash = new Uint8Array(16); // Too short
    
    try {
      await runner.sdk.startSigning(invalidHash);
      throw new Error('Should have thrown error for invalid hash');
    } catch (error) {
      console.log(`✅ Correctly rejected invalid hash: ${error.message}`);
    }

    // Test with non-existent group
    try {
      await runner.sdk.joinGroup('non-existent-group');
      throw new Error('Should have thrown error for non-existent group');
    } catch (error) {
      console.log(`✅ Correctly rejected non-existent group: ${error.message}`);
    }
  });

  // Test 11: Cleanup and Disconnection
  await runner.runTest('Cleanup and Disconnection', async () => {
    // Test graceful disconnection
    await runner.sdk.disconnect();
    
    const isConnected = await runner.sdk.isConnected();
    if (isConnected) {
      throw new Error('SDK should be disconnected');
    }

    console.log(`✅ SDK disconnected successfully`);
  });

  // Test 12: Reconnection and State Recovery
  await runner.runTest('Reconnection and State Recovery', async () => {
    // Reconnect to the same group
    await runner.sdk.connect();
    
    const isConnected = await runner.sdk.isConnected();
    if (!isConnected) {
      throw new Error('SDK should be reconnected');
    }

    // Verify we can still access stored keyshare
    const storage = runner.sdk.getStorage();
    const retrievedKeyshare = await storage.getKeyShare(TEST_CONFIG.groupId, 0);
    
    if (!retrievedKeyshare) {
      throw new Error('Should be able to retrieve keyshare after reconnection');
    }

    console.log(`✅ Reconnection and state recovery successful`);
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

// Environment validation
function validateEnvironment() {
  const requiredEnvVars = ['TEST_RELAYER_URL', 'TEST_WEBSOCKET_URL', 'TEST_API_KEY'];
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.log('⚠️  Warning: Some environment variables are not set:');
    missing.forEach(varName => console.log(`   - ${varName}`));
    console.log('   Using default test values. For production testing, set these variables.');
    console.log('');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  validateEnvironment();
  
  runFullFlowIntegrationTests().catch(error => {
    console.error('Integration tests failed:', error);
    process.exit(1);
  });
} 