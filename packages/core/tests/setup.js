/**
 * Test setup file for DefiShard SDK tests
 * This file runs before all tests
 */

// Mock localStorage for Node.js environment
if (typeof localStorage === 'undefined') {
  global.localStorage = {
    data: {},
    getItem: function(key) {
      return this.data[key] || null;
    },
    setItem: function(key, value) {
      // Remove size limit for testing
      this.data[key] = value;
    },
    removeItem: function(key) {
      delete this.data[key];
    },
    clear: function() {
      this.data = {};
    },
    key: function(index) {
      return Object.keys(this.data)[index] || null;
    },
    length: 0
  };
}

// Mock crypto API for Node.js environment
if (typeof crypto === 'undefined') {
  global.crypto = {
    getRandomValues: function(array) {
      // Handle large arrays more efficiently
      const chunkSize = 10000;
      for (let i = 0; i < array.length; i += chunkSize) {
        const end = Math.min(i + chunkSize, array.length);
        for (let j = i; j < end; j++) {
          array[j] = Math.floor(Math.random() * 256);
        }
      }
      return array;
    },
    subtle: {
      importKey: function() {
        return Promise.resolve({});
      },
      deriveKey: function() {
        return Promise.resolve({});
      },
      encrypt: function() {
        return Promise.resolve(new ArrayBuffer(10));
      },
      decrypt: function() {
        return Promise.resolve(new ArrayBuffer(5));
      }
    }
  };
}

// Mock WebSocket for Node.js environment
if (typeof WebSocket === 'undefined') {
  global.WebSocket = class MockWebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 0; // CONNECTING
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      this.onclose = null;
    }
    
    send(data) {
      // Mock send
    }
    
    close() {
      this.readyState = 3; // CLOSED
      if (this.onclose) this.onclose();
    }
  };
}

// Global test utilities
global.createTestKeyshare = function() {
  return {
    toBytes: () => new Uint8Array([1, 2, 3, 4, 5]),
    publicKey: new Uint8Array([10, 20, 30, 40, 50]),
    partyId: 1,
    threshold: 2,
    participants: 3
  };
};

global.createMockStorage = function(overrides = {}) {
  return {
    saveKeyShare: jest.fn(),
    getKeyShare: jest.fn(),
    deleteKeyShare: jest.fn(),
    clearGroupKeyshares: jest.fn(),
    saveConfig: jest.fn(),
    getConfig: jest.fn(),
    isAvailable: jest.fn().mockResolvedValue(true),
    ...overrides
  };
};

// Increase timeout for slow tests
jest.setTimeout(10000); 