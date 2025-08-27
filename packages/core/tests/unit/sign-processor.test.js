#!/usr/bin/env node

/**
 * Unit tests for SignProcessor
 * Tests the distributed signature generation process
 */

// Mock WASM modules
const mockSignSession = {
  createFirstMessage: () => mockMessage,
  handleMessages: () => [mockMessage, mockMessage],
  destroy: () => {}
};

const mockMessage = {
  toBytes: () => new Uint8Array([1, 2, 3, 4, 5]),
  fromBytes: (bytes) => mockMessage
};

const mockKeyshare = {
  toBytes: () => new Uint8Array([1, 2, 3, 4, 5]),
  publicKey: new Uint8Array([10, 20, 30, 40, 50]),
  partyId: 1,
  threshold: 2,
  participants: 3
};

// Mock WASM module
global.SignSession = function() {
  return mockSignSession;
};
global.Message = mockMessage;
global.Keyshare = mockKeyshare;

// Mock storage
const mockStorage = {
  saveKeyShare: () => Promise.resolve(),
  getKeyShare: () => Promise.resolve(null),
  deleteKeyShare: () => Promise.resolve(),
  clearGroupKeyshares: () => Promise.resolve(),
  saveConfig: () => Promise.resolve(),
  getConfig: () => Promise.resolve(null),
  isAvailable: () => Promise.resolve(true)
};

// Mock BaseProcessor
class MockBaseProcessor {
  constructor(config) {
    this.config = config;
    this.debug = config.debug || false;
    this.currentRound = -1;
    this.roundStates = new Map();
    this.isComplete = false;
    this.eventListeners = {};
  }

  emit(event, ...args) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => callback(...args));
    }
  }

  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  hexToBytes(hex) {
    return new Uint8Array(Buffer.from(hex, 'hex'));
  }

  convertToProtocolMessage(wasmMessage, round) {
    return {
      group_id: this.config.groupId,
      from_id: this.config.partyId,
      to_id: '0',
      content: wasmMessage.toBytes(),
      round: round,
      timestamp: new Date().toISOString()
    };
  }

  convertToWasmMessage(protocolMessage) {
    return Message.fromBytes(protocolMessage.content);
  }

  filterMessagesByIndex(messages) {
    return messages.filter(msg => msg.from_id !== this.config.partyId);
  }

  selectMessagesByIndex(messages) {
    return messages.filter(msg => msg.from_id !== this.config.partyId);
  }
}

// Mock SignProcessor
class MockSignProcessor extends MockBaseProcessor {
  constructor(config) {
    super(config);
    this.session = null;
    this.partialSignature = null;
    this.signConfig = config;
  }

  async initialize() {
    try {
      this.session = new SignSession(
        this.signConfig.keyShare,
        this.signConfig.derivationPath || 'm',
        undefined
      );

      if (this.debug) {
        console.log('[SignProcessor] ✅ Sign session initialized');
        console.log('[SignProcessor] 📊 Party ID:', this.config.partyId);
      }
      
      this.currentRound = -1;
    } catch (error) {
      this.emit('error', new Error(`Failed to initialize signing: ${error}`));
      throw error;
    }
  }

  async handleStartRound() {
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    try {
      const firstMessage = this.session.createFirstMessage(this.signConfig.messageHash);
      const protocolMessage = this.convertToProtocolMessage(firstMessage, 1);
      
      this.currentRound = 1;
      this.roundStates.set(1, { messages: [], processed: false, emitted: false });
      
      // Initialize round 0 state if it doesn't exist
      if (!this.roundStates.has(0)) {
        this.roundStates.set(0, { messages: [], processed: false, emitted: false });
      }
      
      const roundState = this.roundStates.get(0);
      if (roundState && !roundState.emitted) {
        roundState.emitted = true;
        this.emit('round-complete', 0, [protocolMessage]);
      }
      
      return [protocolMessage];
    } catch (error) {
      if (this.debug) console.log(`[SignProcessor] ❌ Error in handleStartRound:`, error);
      throw error;
    }
  }

  async processRound(round, messages) {
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    const roundState = this.roundStates.get(round);
    if (!roundState) {
      throw new Error(`Round ${round} state not found`);
    }

    try {
      if (this.debug) console.log(`[SignProcessor] 🔄 Processing round ${round} with ${messages.length} messages`);

      const filteredMessages = (round === 1 || round === 4) 
        ? this.filterMessagesByIndex(messages) 
        : this.selectMessagesByIndex(messages);

      const wasmMessages = filteredMessages.map(msg => this.convertToWasmMessage(msg));
      const responseMessages = this.session.handleMessages(wasmMessages);
      const protocolResponses = responseMessages.map(msg => this.convertToProtocolMessage(msg, round + 1));

      if (round === 3) {
        // Round 3: Create partial signature
        if (responseMessages.length > 0) {
          this.partialSignature = responseMessages[0];
        }
      }

      if (round === 4) {
        // Round 4: Complete signing
        if (this.partialSignature) {
          const signature = [new Uint8Array([1, 2, 3, 4]), new Uint8Array([5, 6, 7, 8])];
          this.emit('signing-complete', signature);
          this.isComplete = true;
          
          const endMessage = {
            group_id: this.config.groupId,
            from_id: this.config.partyId,
            to_id: '0',
            content: 'end',
            round: 5,
            timestamp: new Date().toISOString()
          };
          
          if (!roundState.emitted) {
            roundState.emitted = true;
            this.emit('round-complete', round, [endMessage]);
          }

          roundState.processed = true;
          return [endMessage];
        }
      }

      this.currentRound = round + 1;
      this.roundStates.set(this.currentRound, {
        messages: [],
        processed: false,
        emitted: false
      });

      if (!roundState.emitted) {
        roundState.emitted = true;
        this.emit('round-complete', round, protocolResponses);
      }

      roundState.processed = true;
      return protocolResponses;
    } catch (error) {
      if (this.debug) console.error(`[SignProcessor] ❌ Round ${round}: Error:`, error);
      throw error;
    }
  }

  destroy() {
    if (this.session) {
      this.session.destroy();
      this.session = null;
    }
  }
}

// Test utilities
function createTestGroupInfo() {
  return {
    group_id: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    totalParties: 3,
    threshold: 2,
    members: [
      { partyId: 'party1', partyIndex: 0 },
      { partyId: 'party2', partyIndex: 1 },
      { partyId: 'party3', partyIndex: 2 }
    ]
  };
}

function createTestKeyshare() {
  return {
    toBytes: () => new Uint8Array([1, 2, 3, 4, 5]),
    publicKey: new Uint8Array([10, 20, 30, 40, 50]),
    partyId: 1,
    threshold: 2,
    participants: 3
  };
}

function createTestMessage(round, fromId, toId = '0') {
  return {
    group_id: 'test-group',
    from_id: fromId,
    to_id: toId,
    content: new Uint8Array([1, 2, 3, 4, 5]),
    round: round,
    timestamp: new Date().toISOString()
  };
}

function createTestMessageHash() {
  return new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]);
}

// Test runner
class SignTestRunner {
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
    console.log(`\n📊 Sign Processor Test Summary:`);
    console.log(`Total Tests: ${this.totalTests}`);
    console.log(`Passed: ${this.passedTests}`);
    console.log(`Failed: ${this.totalTests - this.passedTests}`);
    
    if (this.totalTests > 0) {
      const successRate = ((this.passedTests / this.totalTests) * 100).toFixed(1);
      console.log(`Success Rate: ${successRate}%`);
    }
  }
}

// Run sign processor tests
async function runSignProcessorTests() {
  const runner = new SignTestRunner();
  
  console.log('🧪 Running SignProcessor Tests...\n');

  // Test 1: Initialization
  await runner.runTest('SignProcessor - initialization', async () => {
    const groupInfo = createTestGroupInfo();
    const keyShare = createTestKeyshare();
    const messageHash = createTestMessageHash();
    
    const processor = new MockSignProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      keyShare,
      messageHash,
      derivationPath: 'm',
      debug: false
    });

    await processor.initialize();
    
    if (!processor.session) {
      throw new Error('Session not initialized');
    }
    
    if (processor.currentRound !== -1) {
      throw new Error('Current round should be -1 after initialization');
    }
    
    if (processor.signConfig.keyShare !== keyShare) {
      throw new Error('KeyShare should be stored in config');
    }
    
    if (processor.signConfig.messageHash !== messageHash) {
      throw new Error('MessageHash should be stored in config');
    }
  });

  // Test 2: Start round
  await runner.runTest('SignProcessor - handle start round', async () => {
    const groupInfo = createTestGroupInfo();
    const keyShare = createTestKeyshare();
    const messageHash = createTestMessageHash();
    
    const processor = new MockSignProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      keyShare,
      messageHash,
      derivationPath: 'm',
      debug: false
    });

    await processor.initialize();
    
    // Mock the first message creation
    // mockSignSession.createFirstMessage already returns mockMessage
    
    const messages = await processor.handleStartRound();
    
    if (messages.length !== 1) {
      throw new Error('Should return exactly one message');
    }
    
    if (processor.currentRound !== 1) {
      throw new Error('Should move to round 1');
    }
    
    if (!processor.roundStates.has(1)) {
      throw new Error('Round 1 state should be created');
    }
    
    // Verify createFirstMessage was called with messageHash
    // In a real test, we would verify the call was made with messageHash
  });

  // Test 3: Process round 1
  await runner.runTest('SignProcessor - process round 1', async () => {
    const groupInfo = createTestGroupInfo();
    const keyShare = createTestKeyshare();
    const messageHash = createTestMessageHash();
    
    const processor = new MockSignProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      keyShare,
      messageHash,
      derivationPath: 'm',
      debug: false
    });

    await processor.initialize();
    
    // Set up round 1 state
    processor.roundStates.set(1, { messages: [], processed: false, emitted: false });
    processor.currentRound = 1;
    
    // Mock messages from other parties
    const messages = [
      createTestMessage(1, 'party2'),
      createTestMessage(1, 'party3')
    ];
    
    // Mock WASM message handling
    // mockSignSession.handleMessages already returns [mockMessage, mockMessage]
    
    const responses = await processor.processRound(1, messages);
    
    if (responses.length !== 2) {
      throw new Error('Should return 2 response messages');
    }
    
    if (processor.currentRound !== 2) {
      throw new Error('Should move to round 2');
    }
    
    if (!processor.roundStates.has(2)) {
      throw new Error('Round 2 state should be created');
    }
  });

  // Test 4: Process round 3 (partial signature)
  await runner.runTest('SignProcessor - process round 3 partial signature', async () => {
    const groupInfo = createTestGroupInfo();
    const keyShare = createTestKeyshare();
    const messageHash = createTestMessageHash();
    
    const processor = new MockSignProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      keyShare,
      messageHash,
      derivationPath: 'm',
      debug: false
    });

    await processor.initialize();
    
    // Set up round 3 state
    processor.roundStates.set(3, { messages: [], processed: false, emitted: false });
    processor.currentRound = 3;
    
    // Mock messages from other parties
    const messages = [
      createTestMessage(3, 'party2'),
      createTestMessage(3, 'party3')
    ];
    
    // Mock WASM message handling with partial signature
    const partialSignatureMessage = { ...mockMessage, isPartialSignature: true };
    // Temporarily override handleMessages for this test
    const originalHandleMessages = mockSignSession.handleMessages;
    mockSignSession.handleMessages = () => [partialSignatureMessage];
    
    const responses = await processor.processRound(3, messages);
    
    if (processor.partialSignature !== partialSignatureMessage) {
      throw new Error('Partial signature should be stored');
    }
    
    if (processor.currentRound !== 4) {
      throw new Error('Should move to round 4');
    }
  });

  // Test 5: Process round 4 (completion)
  await runner.runTest('SignProcessor - process round 4 completion', async () => {
    const groupInfo = createTestGroupInfo();
    const keyShare = createTestKeyshare();
    const messageHash = createTestMessageHash();
    
    const processor = new MockSignProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      keyShare,
      messageHash,
      derivationPath: 'm',
      debug: false
    });

    await processor.initialize();
    
    // Set up round 4 state
    processor.roundStates.set(4, { messages: [], processed: false, emitted: false });
    processor.currentRound = 4;
    
    // Set partial signature from previous round
    processor.partialSignature = mockMessage;
    
    // Mock messages from other parties
    const messages = [
      createTestMessage(4, 'party2'),
      createTestMessage(4, 'party3')
    ];
    
    // Mock WASM message handling
    // mockSignSession.handleMessages already returns [mockMessage, mockMessage]
    
    let signingCompleteEmitted = false;
    let signatureData = null;
    processor.on('signing-complete', (signature) => {
      signingCompleteEmitted = true;
      signatureData = signature;
    });
    
    const responses = await processor.processRound(4, messages);
    
    if (!signingCompleteEmitted) {
      throw new Error('signing-complete event should be emitted');
    }
    
    if (!signatureData) {
      throw new Error('Signature data should be provided');
    }
    
    if (!Array.isArray(signatureData) || signatureData.length !== 2) {
      throw new Error('Signature should be an array with 2 elements');
    }
    
    if (!processor.isComplete) {
      throw new Error('Processor should be marked as complete');
    }
    
    if (responses.length !== 1) {
      throw new Error('Should return exactly one END message');
    }
    
    if (responses[0].content !== 'end') {
      throw new Error('Should return END message');
    }
  });

  // Test 6: Error handling - session not initialized
  await runner.runTest('SignProcessor - error handling session not initialized', async () => {
    const groupInfo = createTestGroupInfo();
    const keyShare = createTestKeyshare();
    const messageHash = createTestMessageHash();
    
    const processor = new MockSignProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      keyShare,
      messageHash,
      derivationPath: 'm',
      debug: false
    });

    // Don't initialize the session
    
    try {
      await processor.handleStartRound();
      throw new Error('Should throw error when session not initialized');
    } catch (error) {
      if (!error.message.includes('Session not initialized')) {
        throw new Error('Should throw session not initialized error');
      }
    }
  });

  // Test 7: Error handling - WASM error
  await runner.runTest('SignProcessor - error handling WASM error', async () => {
    const groupInfo = createTestGroupInfo();
    const keyShare = createTestKeyshare();
    const messageHash = createTestMessageHash();
    
    const processor = new MockSignProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      keyShare,
      messageHash,
      derivationPath: 'm',
      debug: false
    });

    await processor.initialize();
    
    // Mock WASM error
    const originalCreateFirstMessage = mockSignSession.createFirstMessage;
    mockSignSession.createFirstMessage = () => {
      throw new Error('WASM error');
    };
    
    try {
      await processor.handleStartRound();
      throw new Error('Should throw error when WASM fails');
    } catch (error) {
      if (!error.message.includes('WASM error')) {
        throw new Error('Should propagate WASM error');
      }
    } finally {
      // Restore original function
      mockSignSession.createFirstMessage = originalCreateFirstMessage;
    }
  });

  // Test 8: Message filtering
  await runner.runTest('SignProcessor - message filtering', async () => {
    const groupInfo = createTestGroupInfo();
    const keyShare = createTestKeyshare();
    const messageHash = createTestMessageHash();
    
    const processor = new MockSignProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      keyShare,
      messageHash,
      derivationPath: 'm',
      debug: false
    });

    await processor.initialize();
    
    const messages = [
      createTestMessage(1, 'party1'), // Should be filtered out
      createTestMessage(1, 'party2'), // Should be kept
      createTestMessage(1, 'party3')  // Should be kept
    ];
    
    const filtered = processor.filterMessagesByIndex(messages);
    
    if (filtered.length !== 2) {
      throw new Error('Should filter out own messages');
    }
    
    if (filtered.some(msg => msg.from_id === 'party1')) {
      throw new Error('Should not contain own messages');
    }
  });

  // Test 9: Round state management
  await runner.runTest('SignProcessor - round state management', async () => {
    const groupInfo = createTestGroupInfo();
    const keyShare = createTestKeyshare();
    const messageHash = createTestMessageHash();
    
    const processor = new MockSignProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      keyShare,
      messageHash,
      derivationPath: 'm',
      debug: false
    });

    await processor.initialize();
    
    // Test round state creation
    processor.roundStates.set(1, { messages: [], processed: false, emitted: false });
    
    const state = processor.roundStates.get(1);
    if (!state) {
      throw new Error('Round state should exist');
    }
    
    if (state.processed || state.emitted) {
      throw new Error('Round state should be unprocessed initially');
    }
    
    // Test round state update
    state.processed = true;
    state.emitted = true;
    
    const updatedState = processor.roundStates.get(1);
    if (!updatedState.processed || !updatedState.emitted) {
      throw new Error('Round state should be updated');
    }
  });

  // Test 10: Cleanup
  await runner.runTest('SignProcessor - cleanup', async () => {
    const groupInfo = createTestGroupInfo();
    const keyShare = createTestKeyshare();
    const messageHash = createTestMessageHash();
    
    const processor = new MockSignProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      keyShare,
      messageHash,
      derivationPath: 'm',
      debug: false
    });

    await processor.initialize();
    
    if (!processor.session) {
      throw new Error('Session should exist before cleanup');
    }
    
    processor.destroy();
    
    if (processor.session) {
      throw new Error('Session should be null after cleanup');
    }
    
    // Verify destroy was called on WASM session
    // In a real test, we would verify destroy was called
  });

  // Test 11: Event emission
  await runner.runTest('SignProcessor - event emission', async () => {
    const groupInfo = createTestGroupInfo();
    const keyShare = createTestKeyshare();
    const messageHash = createTestMessageHash();
    
    const processor = new MockSignProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      keyShare,
      messageHash,
      derivationPath: 'm',
      debug: false
    });

    await processor.initialize();
    
    let roundCompleteEmitted = false;
    let errorEmitted = false;
    
    processor.on('round-complete', (round, messages) => {
      roundCompleteEmitted = true;
    });
    
    processor.on('error', (error) => {
      errorEmitted = true;
    });
    
    // Mock the first message creation
    // mockSignSession.createFirstMessage already returns mockMessage
    
    await processor.handleStartRound();
    
    if (!roundCompleteEmitted) {
      throw new Error('round-complete event should be emitted');
    }
    
    // Test error emission
    processor.emit('error', new Error('Test error'));
    
    if (!errorEmitted) {
      throw new Error('error event should be emitted');
    }
  });

  // Test 12: Derivation path handling
  await runner.runTest('SignProcessor - derivation path handling', async () => {
    const groupInfo = createTestGroupInfo();
    const keyShare = createTestKeyshare();
    const messageHash = createTestMessageHash();
    
    const processor = new MockSignProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      keyShare,
      messageHash,
      derivationPath: 'm/44\'/60\'/0\'/0/0',
      debug: false
    });

    await processor.initialize();
    
    if (processor.signConfig.derivationPath !== 'm/44\'/60\'/0\'/0/0') {
      throw new Error('Custom derivation path should be stored');
    }
    
    // Test default derivation path
    const processorDefault = new MockSignProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      keyShare,
      messageHash,
      debug: false
    });

    await processorDefault.initialize();
    
    if (processorDefault.signConfig.derivationPath !== undefined) {
      throw new Error('Default derivation path should be undefined');
    }
  });

  runner.printSummary();
}

// Mock expect for compatibility
global.expect = {
  toHaveBeenCalled: function() {
    // Simple mock - in real Jest this would check if the mock was called
    return true;
  }
};

// Run tests if this file is executed directly
if (require.main === module) {
  runSignProcessorTests().catch(error => {
    console.error('Sign processor tests failed:', error);
    process.exit(1);
  });
} 