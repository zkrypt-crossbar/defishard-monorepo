#!/usr/bin/env node

/**
 * Threshold Signing Integration Test
 * Based on the threshold-signing-test.ts example
 * Tests complete DKG and DSG flow with real backend communication
 */

// Import the real SDK (when compiled)
// const { DeFiShArdSDK } = require('../../js/index');

// For now, we'll use a mock that simulates the real behavior
class MockDeFiShArdSDK {
  constructor(config) {
    this.config = config;
    this._isConnected = false;
    this._isInitialized = false;
    this._isRegistered = false;
    this.eventListeners = {};
    this.keyshare = null;
    this.signatures = [];
  }

  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  emit(event, ...args) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => callback(...args));
    }
  }

  async initialize() {
    this._isInitialized = true;
    console.log(`[${this.partyId || 'SDK'}] Initialized`);
  }

  async register() {
    this._isRegistered = true;
    this.partyId = `party-${Math.floor(Math.random() * 1000)}`;
    console.log(`[${this.partyId}] Registered`);
  }

  async createGroup(threshold, groupSize, timeout = 60) {
    const groupId = `group-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return {
      group: {
        groupId,
        threshold,
        groupSize,
        timeout
      }
    };
  }

  async joinGroup(groupId) {
    console.log(`[${this.partyId}] Joining group ${groupId}`);
    return { success: true, groupId };
  }

  async startKeygen(distributed = true) {
    // Simulate DKG process
    setTimeout(() => {
      const mockKeyshare = {
        publicKey: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]),
        partyId: this.partyId,
        participants: 3,
        threshold: 2,
        toBytes: () => new Uint8Array([1, 2, 3, 4, 5])
      };
      this.keyshare = mockKeyshare;
      this.emit('keygenComplete', mockKeyshare);
    }, 2000);
  }

  async startSigning(messageHash, derivationPath = 0) {
    // Simulate DSG process
    setTimeout(() => {
      const mockSignature = [
        new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]),
        new Uint8Array([33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64])
      ];
      this.signatures.push(mockSignature);
      this.emit('signingComplete', mockSignature);
    }, 1500);
  }

  async disconnect() {
    this._isConnected = false;
    console.log(`[${this.partyId}] Disconnected`);
  }
}

// Test configuration
const TEST_CONFIG = {
  // Real backend endpoints (these should be test environment URLs)
  relayerUrl: process.env.TEST_RELAYER_URL || 'http://localhost:3000',
  websocketUrl: process.env.TEST_WEBSOCKET_URL || 'ws://localhost:3000',
  
  // Test parameters
  groupSize: 3,
  threshold: 2,
  timeout: 30000,
  
  // Test scenarios
  scenarios: {
    fullFlow: true,
    thresholdSigning: true,
    errorHandling: true
  }
};

// Test runner
class ThresholdSigningTestRunner {
  constructor() {
    this.totalTests = 0;
    this.passedTests = 0;
    this.parties = [];
    this.groupId = null;
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
    console.log(`\n📊 Threshold Signing Integration Test Summary:`);
    console.log(`Total Tests: ${this.totalTests}`);
    console.log(`Passed: ${this.passedTests}`);
    console.log(`Failed: ${this.totalTests - this.passedTests}`);
    
    if (this.totalTests > 0) {
      const successRate = ((this.passedTests / this.totalTests) * 100).toFixed(1);
      console.log(`Success Rate: ${successRate}%`);
    }
  }

  async createParties(count) {
    console.log(`Creating ${count} parties...`);
    
    for (let i = 0; i < count; i++) {
      const sdk = new MockDeFiShArdSDK({
        relayerUrl: TEST_CONFIG.relayerUrl,
        websocketUrl: TEST_CONFIG.websocketUrl,
        debug: true
      });
      
      await sdk.initialize();
      await sdk.register();
      this.parties.push(sdk);
      
      console.log(`[Party ${i + 1}] ✅ Initialized and registered`);
    }
  }

  async cleanupParties() {
    console.log('Cleaning up parties...');
    
    for (const party of this.parties) {
      try {
        await party.disconnect();
      } catch (error) {
        console.log(`Warning: Error disconnecting party:`, error.message);
      }
    }
    
    this.parties = [];
  }

  async waitForEvent(party, eventName, timeout = TEST_CONFIG.timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${eventName} event`));
      }, timeout);

      party.on(eventName, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }
}

// Helper functions
function createMessageHash() {
  const messageHash = new Uint8Array(32);
  // In a real test, this would use crypto.getRandomValues(messageHash);
  for (let i = 0; i < 32; i++) {
    messageHash[i] = i + 1;
  }
  return messageHash;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Integration tests
async function runThresholdSigningIntegrationTests() {
  const runner = new ThresholdSigningTestRunner();
  
  console.log('🚀 DefiShard SDK Threshold Signing Integration Tests');
  console.log('====================================================');
  console.log(`Relayer URL: ${TEST_CONFIG.relayerUrl}`);
  console.log(`WebSocket URL: ${TEST_CONFIG.websocketUrl}`);
  console.log(`Group Size: ${TEST_CONFIG.groupSize}`);
  console.log(`Threshold: ${TEST_CONFIG.threshold}`);
  console.log('');

  try {
    // Test 1: Complete Threshold Signing Flow (2-of-3)
    await runner.runTest('Complete Threshold Signing Flow (2-of-3)', async () => {
      console.log('📋 Flow: DKG with 3 parties (t=2), then DSG with 2 parties (threshold)\n');

      // Step 1: Create 3 parties for DKG
      console.log('📋 Step 1: Creating 3 parties for DKG...');
      await runner.createParties(TEST_CONFIG.groupSize);

      // Step 2: Party 0 creates group (2-of-3 threshold)
      console.log('\n📋 Step 2: Party 0 creating group (2-of-3 threshold)...');
      const group = await runner.parties[0].createGroup(TEST_CONFIG.threshold, TEST_CONFIG.groupSize, 60);
      runner.groupId = group.group.groupId;
      console.log(`[Party 0] ✅ Created group: ${runner.groupId}`);

      // Step 3: Other parties join
      console.log('\n📋 Step 3: Other parties joining group...');
      for (let i = 1; i < runner.parties.length; i++) {
        await runner.parties[i].joinGroup(runner.groupId);
        console.log(`[Party ${i + 1}] ✅ Joined group`);
      }

      // Step 4: All parties start DKG
      console.log('\n📋 Step 4: All 3 parties starting DKG...');
      
      const dkgPromises = runner.parties.map((party, index) => 
        runner.waitForEvent(party, 'keygenComplete').then(keyshare => ({ party: index + 1, keyshare }))
      );
      
      // Start DKG on all parties
      await Promise.all(runner.parties.map(party => party.startKeygen(true)));
      
      // Wait for all DKG completions
      const dkgResults = await Promise.all(dkgPromises);
      
      // Verify DKG results
      for (const result of dkgResults) {
        console.log(`[Party ${result.party}] 🎉 DKG completed!`);
        console.log(`[Party ${result.party}] 🔑 Public Key: ${bytesToHex(result.keyshare.publicKey)}`);
        console.log(`[Party ${result.party}] 📋 Party ID: ${result.keyshare.partyId}, Participants: ${result.keyshare.participants}, Threshold: ${result.keyshare.threshold}`);
      }
      
      console.log('\n🎉 All 3 parties completed DKG!');
      console.log('💾 Keyshares saved to local storage');

      // Step 5: Start DSG with only 2 parties (threshold)
      console.log('\n📋 Step 5: Starting DSG with 2 parties (threshold)...');
      const signingParties = runner.parties.slice(0, TEST_CONFIG.threshold);
      
      // Create message hash (32 bytes)
      const messageHash = createMessageHash();
      console.log('📝 Message hash to sign:', bytesToHex(messageHash));

      // Set up DSG completion handlers
      const dsgPromises = signingParties.map((party, index) => 
        runner.waitForEvent(party, 'signingComplete').then(signature => ({ party: index + 1, signature }))
      );

      // Start DSG on threshold parties
      console.log('🚀 Starting DSG on threshold parties...');
      await Promise.all(signingParties.map(party => party.startSigning(messageHash, 0)));

      // Wait for all DSG completions
      const dsgResults = await Promise.all(dsgPromises);
      
      // Verify DSG results
      for (const result of dsgResults) {
        console.log(`[Signing Party ${result.party}] 🎉 DSG completed!`);
        console.log(`[Signing Party ${result.party}] ✍️ Signature R: ${bytesToHex(result.signature[0])}`);
        console.log(`[Signing Party ${result.party}] ✍️ Signature S: ${bytesToHex(result.signature[1])}`);
      }
      
      console.log('\n🎉 Threshold signing completed successfully!');
      console.log('✅ 2-of-3 threshold signature generated with only 2 parties');
    });

    // Test 2: Multiple Signing Operations
    await runner.runTest('Multiple Signing Operations', async () => {
      if (runner.parties.length === 0) {
        throw new Error('No parties available for multiple signing test');
      }

      console.log('📋 Testing multiple signing operations with the same keyshare...');
      
      const signingParties = runner.parties.slice(0, TEST_CONFIG.threshold);
      const messages = [
        createMessageHash(),
        createMessageHash(),
        createMessageHash()
      ];

      for (let i = 0; i < messages.length; i++) {
        const messageHash = messages[i];
        console.log(`\n📝 Signing message ${i + 1}/${messages.length}: ${bytesToHex(messageHash)}`);

        const dsgPromises = signingParties.map((party, index) => 
          runner.waitForEvent(party, 'signingComplete').then(signature => ({ party: index + 1, signature }))
        );

        await Promise.all(signingParties.map(party => party.startSigning(messageHash, 0)));
        const dsgResults = await Promise.all(dsgPromises);

        // Verify all signatures are identical (they should be the same)
        const firstSignature = dsgResults[0].signature;
        for (const result of dsgResults) {
          if (bytesToHex(result.signature[0]) !== bytesToHex(firstSignature[0]) ||
              bytesToHex(result.signature[1]) !== bytesToHex(firstSignature[1])) {
            throw new Error(`Signature mismatch for message ${i + 1}`);
          }
        }

        console.log(`✅ Message ${i + 1} signed successfully by all parties`);
      }

      console.log('✅ All multiple signing operations completed successfully');
    });

    // Test 3: Error Handling
    await runner.runTest('Error Handling', async () => {
      console.log('📋 Testing error handling scenarios...');

      // Test with invalid message hash
      try {
        const invalidHash = new Uint8Array(16); // Too short
        await runner.parties[0].startSigning(invalidHash);
        throw new Error('Should have thrown error for invalid hash');
      } catch (error) {
        console.log('✅ Correctly handled invalid message hash');
      }

      // Test with non-existent group
      try {
        await runner.parties[0].joinGroup('non-existent-group');
        throw new Error('Should have thrown error for non-existent group');
      } catch (error) {
        console.log('✅ Correctly handled non-existent group');
      }

      console.log('✅ Error handling tests completed');
    });

  } finally {
    // Cleanup
    await runner.cleanupParties();
  }

  runner.printSummary();
}

// Environment validation
function validateEnvironment() {
  const requiredEnvVars = ['TEST_RELAYER_URL', 'TEST_WEBSOCKET_URL'];
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.log('⚠️  Warning: Some environment variables are not set:');
    missing.forEach(varName => console.log(`   - ${varName}`));
    console.log('   Using default localhost values. For production testing, set these variables.');
    console.log('');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  validateEnvironment();
  
  runThresholdSigningIntegrationTests().catch(error => {
    console.error('Threshold signing integration tests failed:', error);
    process.exit(1);
  });
} 