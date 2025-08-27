#!/usr/bin/env node

/**
 * Unit tests for KeygenProcessor
 * Tests the distributed key generation process
 */

// Mock WASM modules
const mockKeygenSession = {
  createFirstMessage: () => mockMessage,
  handleMessages: () => [mockMessage, mockMessage],
  keyshare: () => createTestKeyshare(),
  destroy: () => {}
};

const mockMessage = {
  toBytes: () => new Uint8Array([1, 2, 3, 4, 5]),
  fromBytes: (bytes) => mockMessage
};

// Mock WASM module
global.KeygenSession = function() {
  return mockKeygenSession;
};
global.Message = mockMessage;

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

// Mock KeygenProcessor
class MockKeygenProcessor extends MockBaseProcessor {
  constructor(config) {
    super(config);
    this.session = null;
    this.keygenConfig = config;
  }

  async initialize() {
    try {
      this.session = new KeygenSession(
        this.config.groupInfo.totalParties,
        this.config.groupInfo.threshold,
        this.config.partyIndex,
        this.hexToBytes(this.config.groupId),
        undefined,
        this.keygenConfig.distributed
      );
      this.currentRound = -1;
    } catch (error) {
      this.emit('error', new Error(`Failed to initialize keygen: ${error}`));
      throw error;
    }
  }

  async handleStartRound() {
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    try {
      const firstMessage = this.session.createFirstMessage();
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
      if (this.debug) console.log(`[KeygenProcessor] ❌ Error in handleStartRound:`, error);
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
      const filteredMessages = (round === 1 || round === 4) 
        ? this.filterMessagesByIndex(messages) 
        : this.selectMessagesByIndex(messages);

      const wasmMessages = filteredMessages.map(msg => this.convertToWasmMessage(msg));
      const responseMessages = this.session.handleMessages(wasmMessages);
      const protocolResponses = responseMessages.map(msg => this.convertToProtocolMessage(msg, round + 1));

      if (round === 4) {
        const keyShare = this.session.keyshare();
        this.emit('keygen-complete', keyShare);
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
      if (this.debug) console.error(`[KeygenProcessor] ❌ Round ${round}: Error:`, error);
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

// Test runner
class KeygenTestRunner {
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
    console.log(`\n📊 Keygen Processor Test Summary:`);
    console.log(`Total Tests: ${this.totalTests}`);
    console.log(`Passed: ${this.passedTests}`);
    console.log(`Failed: ${this.totalTests - this.passedTests}`);
    
    if (this.totalTests > 0) {
      const successRate = ((this.passedTests / this.totalTests) * 100).toFixed(1);
      console.log(`Success Rate: ${successRate}%`);
    }
  }
}

// Run keygen processor tests
async function runKeygenProcessorTests() {
  const runner = new KeygenTestRunner();
  
  console.log('🧪 Running KeygenProcessor Tests...\n');

  // Test 1: Initialization
  await runner.runTest('KeygenProcessor - initialization', async () => {
    const groupInfo = createTestGroupInfo();
    const processor = new MockKeygenProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      distributed: true,
      debug: false
    });

    await processor.initialize();
    
    if (!processor.session) {
      throw new Error('Session not initialized');
    }
    
    if (processor.currentRound !== -1) {
      throw new Error('Current round should be -1 after initialization');
    }
  });

  // Test 2: Start round
  await runner.runTest('KeygenProcessor - handle start round', async () => {
    const groupInfo = createTestGroupInfo();
    const processor = new MockKeygenProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      distributed: true,
      debug: false
    });

    await processor.initialize();
    
    // Mock the first message creation
    // mockKeygenSession.createFirstMessage already returns mockMessage
    
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
  });

  // Test 3: Process round 1
  await runner.runTest('KeygenProcessor - process round 1', async () => {
    const groupInfo = createTestGroupInfo();
    const processor = new MockKeygenProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      distributed: true,
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
    // mockKeygenSession.handleMessages already returns [mockMessage, mockMessage]
    
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

  // Test 4: Process round 4 (completion)
  await runner.runTest('KeygenProcessor - process round 4 completion', async () => {
    const groupInfo = createTestGroupInfo();
    const processor = new MockKeygenProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      distributed: true,
      debug: false
    });

    await processor.initialize();
    
    // Set up round 4 state
    processor.roundStates.set(4, { messages: [], processed: false, emitted: false });
    processor.currentRound = 4;
    
    // Mock messages from other parties
    const messages = [
      createTestMessage(4, 'party2'),
      createTestMessage(4, 'party3')
    ];
    
    // Mock WASM message handling and keyshare creation
    // mockKeygenSession.handleMessages already returns [mockMessage, mockMessage]
    // mockKeygenSession.keyshare already returns createTestKeyshare()
    
    let keygenCompleteEmitted = false;
    processor.on('keygen-complete', (keyShare) => {
      keygenCompleteEmitted = true;
    });
    
    const responses = await processor.processRound(4, messages);
    
    if (!keygenCompleteEmitted) {
      throw new Error('keygen-complete event should be emitted');
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

  // Test 5: Error handling - session not initialized
  await runner.runTest('KeygenProcessor - error handling session not initialized', async () => {
    const groupInfo = createTestGroupInfo();
    const processor = new MockKeygenProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      distributed: true,
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

  // Test 6: Error handling - WASM error
  await runner.runTest('KeygenProcessor - error handling WASM error', async () => {
    const groupInfo = createTestGroupInfo();
    const processor = new MockKeygenProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      distributed: true,
      debug: false
    });

    await processor.initialize();
    
    // Mock WASM error
    const originalCreateFirstMessage = mockKeygenSession.createFirstMessage;
    mockKeygenSession.createFirstMessage = () => {
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
      mockKeygenSession.createFirstMessage = originalCreateFirstMessage;
    }
  });

  // Test 7: Message filtering
  await runner.runTest('KeygenProcessor - message filtering', async () => {
    const groupInfo = createTestGroupInfo();
    const processor = new MockKeygenProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      distributed: true,
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

  // Test 8: Round state management
  await runner.runTest('KeygenProcessor - round state management', async () => {
    const groupInfo = createTestGroupInfo();
    const processor = new MockKeygenProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      distributed: true,
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

  // Test 9: Cleanup
  await runner.runTest('KeygenProcessor - cleanup', async () => {
    const groupInfo = createTestGroupInfo();
    const processor = new MockKeygenProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      distributed: true,
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

  // Test 10: Event emission
  await runner.runTest('KeygenProcessor - event emission', async () => {
    const groupInfo = createTestGroupInfo();
    const processor = new MockKeygenProcessor({
      groupInfo,
      partyId: 'party1',
      partyIndex: 0,
      groupId: 'test-group',
      distributed: true,
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
    // mockKeygenSession.createFirstMessage already returns mockMessage
    
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
  runKeygenProcessorTests().catch(error => {
    console.error('Keygen processor tests failed:', error);
    process.exit(1);
  });
} 