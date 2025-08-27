/**
 * SDK Service for DeFiShArd
 * Provides a wrapper around the DeFiShArd SDK for use in React components
 */
import { BrowserStorageAdapter } from './browser-storage-adapter';

// Import the real SDK
let RealDeFiShArdSDK;
try {
  // This will be replaced with the actual SDK when bundled
  RealDeFiShArdSDK = window.DeFiShArdSDK;
  
  // Check if the SDK is properly exposed as a constructor
  if (RealDeFiShArdSDK && typeof RealDeFiShArdSDK !== 'function') {
    // If it's an object with a default export, use that
    if (RealDeFiShArdSDK.default && typeof RealDeFiShArdSDK.default === 'function') {
      console.log('Using SDK from default export');
      RealDeFiShArdSDK = RealDeFiShArdSDK.default;
    } else {
      throw new Error('SDK is not a constructor function');
    }
  }
  
  if (!RealDeFiShArdSDK) {
    throw new Error('Real SDK not available');
  }
} catch (error) {
  console.error('Real SDK not available:', error);
  throw new Error('Real DeFiShArd SDK is required but not available');
}

// Persistent config keys
const RELAYER_URL_KEY = 'defishard_relayer_url';
const WS_URL_KEY = 'defishard_websocket_url';

/**
 * SDK Service class
 * Provides a singleton service for interacting with the DeFiShArd SDK
 */
class SDKService {
  constructor() {
    this.sdk = null;
    this.eventHandlers = {};
    this.isInitialized = false;
    this.partyId = null;
    this.groupId = null;
    this.isKeygenCompleted = false;
    
    // Add unique instance ID to track if multiple instances exist
    this.instanceId = Math.random().toString(36).substr(2, 9);
    
    // Use persistent tab ID from localStorage or create new one
    this.tabId = this.getPersistentTabId();
    this.listenersSetup = false;
    console.log(`🆔 SDKService instance created with ID: ${this.instanceId}, Tab ID: ${this.tabId}`);

    // Load persisted relayer/websocket URLs or defaults
    this.relayerUrl = localStorage.getItem(RELAYER_URL_KEY) || 'http://localhost:3000';
    this.websocketUrl = localStorage.getItem(WS_URL_KEY) || 'ws://localhost:3000';
  }
  
  /**
   * Get or create a persistent tab ID that survives page reloads
   * @returns {string} - Persistent tab ID
   */
  getPersistentTabId() {
    const storageKey = 'defishard_tab_id';
    let tabId = localStorage.getItem(storageKey);
    
    if (!tabId) {
      // Create new tab ID if none exists
      tabId = `tab_${Date.now()}_${this.instanceId}`;
      localStorage.setItem(storageKey, tabId);
      console.log(`🆔 Created new persistent tab ID: ${tabId}`);
    } else {
      console.log(`🆔 Using existing persistent tab ID: ${tabId}`);
    }
    
    return tabId;
  }

  /**
   * Check if the current storage adapter supports password setting
   * @returns {boolean} - True if password setting is supported
   */
  isPasswordSupported() {
    return this.sdk && this.sdk.storage && typeof this.sdk.storage.setPassword === 'function';
  }

  /**
   * Set password on storage adapter if supported
   * @param {string} password - Password to set
   */
  setStoragePassword(password) {
    if (!password) {
      console.log('⚠️ No password provided');
      return false;
    }

    // Check if we're using our custom BrowserStorageAdapter
    if (this.isPasswordSupported()) {
      try {
        this.sdk.storage.setPassword(password);
        console.log('🔐 Password set on storage adapter');
        return true;
      } catch (error) {
        console.error('❌ Failed to set password on storage adapter:', error);
        return false;
      }
    } else {
      console.log('⚠️ Storage adapter does not support password setting');
      console.log('🔍 Storage adapter type:', this.sdk?.storage?.constructor?.name);
      console.log('🔍 Available methods:', Object.getOwnPropertyNames(this.sdk?.storage || {}));
      return false;
    }
  }

  /**
   * Initialize the SDK
   * @param {Object} options - SDK initialization options
   * @returns {Promise<boolean>} - True if initialization was successful
   */
  async initialize(options = {}) {
    if (this.isInitialized) return true;
    
    console.log('SDK Service initializing with options:', options);
    
    // Use the SDK's built-in LocalStorageAdapter with proper encryption/decryption
    // Import the real LocalStorageAdapter from the SDK
    let storage;
    try {
      // Try to get the LocalStorageAdapter from the SDK bundle
      const LocalStorageAdapter = window.DeFiShArdSDK?.LocalStorageAdapter || 
                                 window.DeFiShArdSDK?.default?.LocalStorageAdapter;
      
      if (!LocalStorageAdapter) {
        // Fallback to our custom adapter if SDK's adapter is not available
        console.log('Using custom BrowserStorageAdapter as fallback');
        storage = new BrowserStorageAdapter(`defishard_${this.tabId}_`);
        console.log(`BrowserStorageAdapter created with prefix: defishard_${this.tabId}_`);
      } else {
        console.log('Using SDK LocalStorageAdapter with encryption support');
        storage = new LocalStorageAdapter(`defishard_${this.tabId}_`);
        console.log(`LocalStorageAdapter created with prefix: defishard_${this.tabId}_`);
      }
      
      // Set password on storage adapter if provided in options
      if (options.password && typeof storage.setPassword === 'function') {
        try {
          storage.setPassword(options.password);
          console.log('🔐 Password set on storage adapter during initialization');
        } catch (error) {
          console.error('❌ Failed to set password during initialization:', error);
        }
      }
    } catch (error) {
      console.log('Error loading SDK storage adapter, using custom fallback:', error);
      storage = new BrowserStorageAdapter(`defishard_${this.tabId}_`);
      console.log(`BrowserStorageAdapter created with prefix: defishard_${this.tabId}_`);
    }
    
    console.log('Using real DeFiShArd SDK');
    console.log('RealDeFiShArdSDK type:', typeof RealDeFiShArdSDK);
    console.log('RealDeFiShArdSDK value:', RealDeFiShArdSDK);
    
    const relayerUrl = options.relayerUrl || this.relayerUrl || 'http://localhost:3000';
    const websocketUrl = options.websocketUrl || this.websocketUrl || 'ws://localhost:3000';
    
    console.log('Creating SDK instance with:');
    console.log('- relayerUrl:', relayerUrl);
    console.log('- websocketUrl:', websocketUrl);
    console.log('- websocketUrl type:', typeof websocketUrl);
    console.log('- websocketUrl length:', websocketUrl.length);
    
    try {
      console.log(`🆔 [${this.instanceId}] Creating new SDK instance...`);
      this.sdk = new RealDeFiShArdSDK({
        relayerUrl,
        websocketUrl,
        storage,
        debug: options.debug || false,
        // Add tab identifier to help with isolation
        tabId: this.tabId
      });
      
      console.log(`🆔 [${this.instanceId}] SDK instance created successfully`);
    } catch (error) {
      console.error('Error creating real SDK instance:', error);
      throw error;
    }
    
    // Set up event listeners
    this.setupEventListeners();
    
    try {
      // Initialize the SDK (loads WASM modules)
      console.log('Calling SDK initialize method...');
      const result = await this.sdk.initialize();
      console.log('SDK initialized successfully with result:', result);
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize SDK:', error);
      throw error;
    }
  }

  /**
   * Get persisted relayer configuration
   */
  getRelayerConfig() {
    return {
      relayerUrl: this.relayerUrl,
      websocketUrl: this.websocketUrl,
    };
  }

  /**
   * Persist and apply relayer configuration
   * @param {{relayerUrl?: string, websocketUrl?: string}} cfg
   */
  async setRelayerConfig(cfg = {}) {
    const updates = {};
    let hasUrlChanges = false;
    
    if (cfg.relayerUrl && cfg.relayerUrl !== this.relayerUrl) {
      this.relayerUrl = cfg.relayerUrl;
      localStorage.setItem(RELAYER_URL_KEY, this.relayerUrl);
      updates.relayerUrl = this.relayerUrl;
      hasUrlChanges = true;
    }
    if (cfg.websocketUrl && cfg.websocketUrl !== this.websocketUrl) {
      this.websocketUrl = cfg.websocketUrl;
      localStorage.setItem(WS_URL_KEY, this.websocketUrl);
      updates.websocketUrl = this.websocketUrl;
      hasUrlChanges = true;
    }

    // If URLs changed and SDK exists, we need to re-initialize
    if (hasUrlChanges && this.sdk) {
      console.log('🆔 [SDKService] Relayer URLs changed, re-initializing SDK...');
      
      // Disconnect existing SDK
      try {
        if (this.sdk.disconnect) {
          await this.sdk.disconnect();
        }
      } catch (error) {
        console.warn('🆔 [SDKService] Error disconnecting SDK:', error);
      }
      
      // Reset SDK state
      this.sdk = null;
      this.isInitialized = false;
      
      // Re-initialize with new URLs
      await this.initialize({ debug: true });
      console.log('🆔 [SDKService] SDK re-initialized with new relayer URLs');
    } else if (this.sdk && Object.keys(updates).length) {
      // If only other config changed, just update
      this.updateSDKConfig(updates);
    }
    
    console.log('🆔 [SDKService] Relayer config updated and persisted:', cfg);
  }

  /**
   * Test current relayer health endpoint
   */
  async testRelayerHealth(urlOverride) {
    const base = urlOverride || this.relayerUrl || this.sdk?.apiClient?.config?.relayerUrl;
    if (!base) return { ok: false, status: 0, error: 'No relayer URL configured' };
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/health`);
      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { ok: false, status: 0, error: e.message };
    }
  }
  
  /**
   * Set up event listeners for SDK events
   */
  setupEventListeners() {
    // Prevent multiple listener setup
    if (this.listenersSetup) {
      console.log('🆔 SDK event listeners already set up, skipping...');
      return;
    }
    
    // Listen for the actual events emitted by the SDK
    const sdkEvents = [
      'keygen-complete', 'sign-complete', 'round-complete', 'round-finished',
      'error', 'disconnected', 'connected'
    ];
    
    console.log('🆔 Setting up SDK event listeners...');
    
    sdkEvents.forEach(event => {
      const handler = (data) => {
        console.log(`🆔 [${this.instanceId}] SDK Event: ${event}`, data);
        
        // Handle keygen completion
        if (event === 'keygen-complete') {
          this.isKeygenCompleted = true;
          
          // Transform the keyshare data to match web app expectations
          const transformedData = this.transformKeyshareData(data);
          
          // Forward as keygen:complete for backward compatibility
          this.forwardEvent('keygen:complete', transformedData);
        }
        
        // Handle round completion - forward as keygen:round or sign:round based on context
        if (event === 'round-complete') {
          const roundNumber = data[0]; // round number
          const messages = data[1]; // messages
          
          // Determine if this is keygen or signing based on current state
          if (this.isKeygenCompleted === false) {
            // Still in keygen process
            this.forwardEvent('keygen:round', {
              index: roundNumber,
              total: 5, // total rounds for keygen
              messages: messages
            });
          } else {
            // In signing process
            this.forwardEvent('sign:round', {
              index: roundNumber,
              total: 3, // total rounds for signing
              messages: messages
            });
          }
        }
        
        // Handle sign completion
        if (event === 'sign-complete') {
          // Transform signature data to match web app expectations
          const transformedData = this.transformSignatureData(data);
          this.forwardEvent('sign:complete', transformedData);
        }
        
        // Handle errors
        if (event === 'error') {
          this.forwardEvent('error', data);
        }
        
        // Handle connection events
        if (event === 'disconnected') {
          this.forwardEvent('disconnect', data);
        } else if (event === 'connected') {
          this.forwardEvent('reconnect', data);
        }
      };
      
      // Store handler reference for potential cleanup
      if (!this.sdkEventHandlers) {
        this.sdkEventHandlers = {};
      }
      this.sdkEventHandlers[event] = handler;
      
      this.sdk.on(event, handler);
    });
    
    this.listenersSetup = true;
    console.log('🆔 SDK event listeners setup complete');
  }
  
  /**
   * Register an event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
    console.log(`🆔 [${this.instanceId}] Event handler added for '${event}'. Total handlers: ${this.eventHandlers[event].length}`);
  }
  
  /**
   * Remove an event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler to remove
   */
  off(event, handler) {
    if (this.eventHandlers[event]) {
      const beforeCount = this.eventHandlers[event].length;
      this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
      const afterCount = this.eventHandlers[event].length;
      console.log(`🆔 [${this.instanceId}] Event handler removed for '${event}'. Handlers: ${beforeCount} → ${afterCount}`);
    }
  }
  
  /**
   * Forward an event to registered handlers
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  forwardEvent(event, data) {
    console.log(`🆔 [${this.instanceId}] Forwarding event: ${event}`, data);
    
    // Forward the event to our event handlers
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`🆔 [${this.instanceId}] Error in event handler for ${event}:`, error);
        }
      });
    }
  }
  
  /**
   * Transform keyshare data from WASM format to web app format
   * @param {any} wasmKeyshare - Raw keyshare from WASM
   * @returns {Object} - Transformed keyshare data
   */
  transformKeyshareData(wasmKeyshare) {
    try {
      console.log('🔄 Transforming keyshare data:', wasmKeyshare);
      
      // Extract data from WASM keyshare object
      const publicKey = wasmKeyshare.publicKey ? 
        Array.from(wasmKeyshare.publicKey).map(b => b.toString(16).padStart(2, '0')).join('') : 
        'Generated';
      
      const partyId = this.partyId || 'Unknown';
      const participants = wasmKeyshare.participants || 'All parties';
      const threshold = wasmKeyshare.threshold || 'Unknown';
      
      const transformedData = {
        publicKey,
        partyId,
        participants,
        threshold,
        groupId: this.groupId,
        partyIndex: wasmKeyshare.partyIndex,
        totalParties: wasmKeyshare.totalParties,
        timestamp: new Date().toISOString(),
        // Include the original WASM keyshare for advanced usage
        rawKeyshare: wasmKeyshare
      };
      
      console.log('✅ Transformed keyshare data:', transformedData);
      return transformedData;
    } catch (error) {
      console.error('❌ Error transforming keyshare data:', error);
      // Return a fallback object if transformation fails
      return {
        publicKey: 'Error',
        partyId: this.partyId || 'Unknown',
        participants: 'Error',
        threshold: 'Error',
        groupId: this.groupId,
        error: error.message
      };
    }
  }
  
  /**
   * Transform signature data from WASM format to web app format
   * @param {Array} wasmSignature - Raw signature from WASM [Uint8Array, Uint8Array]
   * @returns {Object} - Transformed signature data
   */
  transformSignatureData(wasmSignature) {
    try {
      console.log('🔄 Transforming signature data:', wasmSignature);
      
      // WASM signature is [r, s] where r and s are Uint8Arrays
      const [r, s] = wasmSignature;
      
      // Convert Uint8Arrays to hex strings
      const rHex = Array.from(r).map(b => b.toString(16).padStart(2, '0')).join('');
      const sHex = Array.from(s).map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Combine into a single signature string
      const signature = rHex + sHex;
      
      const transformedData = {
        message: 'Message signed successfully', // We don't have the original message here
        signature: signature,
        r: rHex,
        s: sHex,
        timestamp: new Date().toISOString(),
        groupId: this.groupId,
        partyId: this.partyId,
        // Include the original WASM signature for advanced usage
        rawSignature: wasmSignature
      };
      
      console.log('✅ Transformed signature data:', transformedData);
      return transformedData;
    } catch (error) {
      console.error('❌ Error transforming signature data:', error);
      // Return a fallback object if transformation fails
      return {
        message: 'Error',
        signature: 'Error',
        groupId: this.groupId,
        partyId: this.partyId,
        error: error.message
      };
    }
  }
  
  /**
   * Register a party
   * @returns {Promise<string|{partyId: string}>} - Party ID or registration result
   */
  async registerParty() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      console.log('Registering party with relay server...');
      // Try to use register() first (from SDK tests), fall back to registerParty() if needed
      if (typeof this.sdk.register === 'function') {
        console.log('Using sdk.register() method');
        const result = await this.sdk.register();
        console.log('Party registered successfully:', result);
        this.partyId = result.party_id || result.partyId;
        
        // Store the API token for future requests
        if (result.token) {
          this.apiToken = result.token;
          console.log('API token stored:', this.apiToken.substring(0, 20) + '...');
          
          // Update SDK config with the token
          if (this.sdk && this.sdk.config) {
            this.sdk.config.apiKey = result.token;
            console.log('Updated SDK config with API token');
            
            // Update API client with the new config
            if (this.sdk.apiClient) {
              this.sdk.apiClient.updateConfig(this.sdk.config);
            }
          }
        }
        
        return result;
      } else if (typeof this.sdk.registerParty === 'function') {
        console.log('Using sdk.registerParty() method');
        const partyId = await this.sdk.registerParty();
        console.log('Party registered successfully with ID:', partyId);
        this.partyId = partyId;
        return { partyId };
      } else {
        throw new Error('No registration method available in SDK');
      }
    } catch (error) {
      console.error('Failed to register party:', error);
      throw error;
    }
  }
  
  /**
   * Create a group
   * @param {number} threshold - Threshold for the group
   * @param {number} totalParties - Total number of parties in the group
   * @param {number} timeoutMinutes - Timeout in minutes (default: 60)
   * @returns {Promise<Object>} - Group information
   */
  async createGroup(threshold, totalParties, timeoutMinutes = 60) {
    if (!this.isInitialized) {
      throw new Error('SDK not initialized');
    }
    
    if (!this.partyId) {
      throw new Error('Party not registered');
    }
    
    try {
      const result = await this.sdk.createGroup(threshold, totalParties, timeoutMinutes);
      console.log('Create group result:', result);
      console.log('Create group result structure:', JSON.stringify(result, null, 2));
      
      // Handle different result structures
      if (result.group && result.group.groupId) {
        this.groupId = result.group.groupId;
        console.log('Set groupId from result.group.groupId:', this.groupId);
      } else if (result.groupId) {
        this.groupId = result.groupId;
        console.log('Set groupId from result.groupId:', this.groupId);
      } else {
        console.error('No groupId found in result:', result);
        throw new Error('Invalid group creation result - no groupId found');
      }
      
      // Update SDK's internal configuration (like party.ts does)
      if (this.sdk && this.sdk.config) {
        this.sdk.config.groupId = this.groupId;
        console.log('Updated SDK config groupId:', this.sdk.config.groupId);
        
        // Update API client and protocol manager with new config
        if (this.sdk.apiClient) {
          this.sdk.apiClient.updateConfig(this.sdk.config);
        }
        if (this.sdk.protocolManager) {
          this.sdk.protocolManager.updateConfig(this.sdk.config);
        }
      }
      
      console.log('[SDK Service] After setting groupId:', this.groupId);
      console.log('[SDK Service] groupId type after setting:', typeof this.groupId);
      
      return result;
    } catch (error) {
      console.error('Failed to create group:', error);
      throw error;
    }
  }
  
  /**
   * Join a group
   * @param {string} groupId - Group ID to join
   * @returns {Promise<boolean>} - True if successful
   */
  async joinGroup(groupId) {
    console.log(`🆔 [${this.instanceId}] SDK Service joinGroup called with groupId=${groupId}`);
    
    if (!this.isInitialized) {
      console.error(`🆔 [${this.instanceId}] SDK not initialized`);
      throw new Error('SDK not initialized');
    }
    
    if (!this.partyId) {
      console.error(`🆔 [${this.instanceId}] Party not registered`);
      throw new Error('Party not registered');
    }
    
    console.log(`🆔 [${this.instanceId}] Joining group:`, groupId, 'for party:', this.partyId);
    try {
      const result = await this.sdk.joinGroup(groupId);
      console.log(`🆔 [${this.instanceId}] joinGroup result:`, result);
      this.groupId = groupId;
      
      // Update SDK's internal configuration (like party.ts does)
      if (this.sdk && this.sdk.config) {
        this.sdk.config.groupId = this.groupId;
        console.log('Updated SDK config groupId after join:', this.sdk.config.groupId);
        
        // Update API client and protocol manager with new config
        if (this.sdk.apiClient) {
          this.sdk.apiClient.updateConfig(this.sdk.config);
        }
        if (this.sdk.protocolManager) {
          this.sdk.protocolManager.updateConfig(this.sdk.config);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Failed to join group:', error);
      throw error;
    }
  }
  
  /**
   * Start key generation
   * @param {boolean} isCreator - Whether this party is the creator of the group
   * @returns {Promise<Object>} - Keyshare information
   */
  async startKeygen(isCreator = false) {
    console.log(`🆔 [${this.instanceId}] SDK Service startKeygen called with isCreator=${isCreator}`);
    
    if (!this.isInitialized) {
      console.error(`🆔 [${this.instanceId}] SDK not initialized`);
      throw new Error('SDK not initialized');
    }
    
    if (!this.partyId) {
      console.error(`🆔 [${this.instanceId}] Party not registered`);
      throw new Error('Party not registered');
    }
    
    console.log(`🆔 [${this.instanceId}] SDK Service startKeygen - Current state:`);
    console.log('- isInitialized:', this.isInitialized);
    console.log('- partyId:', this.partyId);
    console.log('- groupId:', this.groupId);
    console.log('- isCreator:', isCreator);
    console.log('- groupId type:', typeof this.groupId);
    console.log('- groupId truthy check:', !!this.groupId);
    
    if (!this.groupId) {
      console.error(`🆔 [${this.instanceId}] SDK Service groupId is falsy, throwing error`);
      throw new Error('No active group');
    }
    
    try {
      // Emit keygen start event
      this.forwardEvent('keygen:start', { isCreator, groupId: this.groupId });
      
      console.log(`🆔 [${this.instanceId}] Starting DKG as ${isCreator ? 'creator' : 'joiner'}...`);
      const result = await this.sdk.startKeygen(isCreator);
      console.log(`🆔 [${this.instanceId}] DKG startKeygen completed successfully`);
      return result;
    } catch (error) {
      console.error(`🆔 [${this.instanceId}] Failed to start keygen:`, error);
      throw error;
    }
  }
  
  /**
   * Sign a message
   * @param {string} message - Message to sign
   * @returns {Promise<Object>} - Signature information
   */
  async signMessage(message) {
    if (!this.isInitialized) {
      throw new Error('SDK not initialized');
    }
    
    if (!this.partyId) {
      throw new Error('Party not registered');
    }
    
    if (!this.groupId) {
      throw new Error('No active group');
    }
    
    if (!this.isKeygenCompleted) {
      throw new Error('Key generation not completed');
    }
    
    try {
      // Emit sign start event
      this.forwardEvent('sign:start', { message, groupId: this.groupId });
      
      // Convert message to hash (32 bytes)
      const messageHash = await this.hashMessage(message);
      console.log(`🆔 [${this.instanceId}] Message hashed: ${Array.from(messageHash).map(b => b.toString(16).padStart(2, '0')).join('')}`);
      
      // Load keyshare from storage
      const keyshare = await this.loadKeyshareForSigning();
      console.log(`🆔 [${this.instanceId}] Keyshare loaded for signing`);
      
      // Call SDK with proper parameters
      return await this.sdk.startSigning(messageHash, keyshare);
    } catch (error) {
      console.error('Failed to sign message:', error);
      throw error;
    }
  }
  
  /**
   * Hash a message to 32 bytes
   * @param {string} message - Message to hash
   * @returns {Promise<Uint8Array>} - 32-byte hash
   */
  async hashMessage(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer);
  }
  
  /**
   * Load keyshare from storage for signing
   * @returns {Promise<Object>} - Keyshare object
   */
  async loadKeyshareForSigning() {
    try {
      // Find keyshare in storage
      const storage = this.sdk?.storage;
      if (!storage) {
        throw new Error('Storage not available');
      }
      
      const keys = await storage.getKeys();
      const keyshareKeys = keys.filter(key => key.includes('keyshare'));
      
      if (keyshareKeys.length === 0) {
        throw new Error('No keyshare found in storage');
      }
      
      // Use the first keyshare found
      const keyshareKey = keyshareKeys[0];
      console.log(`🆔 [${this.instanceId}] Loading keyshare from: ${keyshareKey}`);
      
      const keyshareData = await storage.get(keyshareKey);
      if (!keyshareData) {
        throw new Error(`Keyshare data not found for key: ${keyshareKey}`);
      }
      
      const keyshare = JSON.parse(keyshareData);
      console.log(`🆔 [${this.instanceId}] Keyshare loaded: Party ${keyshare.partyId}, Group ${keyshare.groupId}`);
      
      return keyshare;
    } catch (error) {
      console.error(`🆔 [${this.instanceId}] Failed to load keyshare for signing:`, error);
      throw new Error(`Failed to load keyshare: ${error.message}`);
    }
  }
  
  /**
   * Get the current state
   * @returns {Object} - Current state
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      partyId: this.partyId,
      groupId: this.groupId,
      isKeygenCompleted: this.isKeygenCompleted,
      apiKey: this.sdk && this.sdk.config ? this.sdk.config.apiKey : null
    };
  }
  
  /**
   * Get the API key
   * @returns {string|null} - The current API key
   */
  getApiKey() {
    return this.sdk && this.sdk.config ? this.sdk.config.apiKey : null;
  }

  /**
   * Test if current API key is valid by making a request to a protected endpoint
   * @returns {Promise<boolean>} - True if valid, false if expired
   */
  async testApiKeyValidity() {
    console.log('🆔 [SDKService] Testing API key validity...');
    console.log('🆔 [SDKService] SDK exists:', !!this.sdk);
    console.log('🆔 [SDKService] API client exists:', !!this.sdk?.apiClient);
    console.log('🆔 [SDKService] SDK config API key exists:', !!this.sdk?.config?.apiKey);
    console.log('🆔 [SDKService] SDK config API key value:', this.sdk?.config?.apiKey?.substring(0, 20) + '...');
    console.log('🆔 [SDKService] Relayer URL:', this.sdk?.apiClient?.config?.relayerUrl);
    
    if (!this.sdk?.apiClient) {
      console.log('🆔 [SDKService] No API client available');
      return false;
    }
    
    // Use the main SDK config as the single source of truth
    const apiKey = this.sdk.config?.apiKey;
    if (!apiKey) {
      console.log('🆔 [SDKService] No API key available in SDK config');
      return false;
    }
    
    try {
      const url = `${this.sdk.apiClient.config.relayerUrl}/party/info`;
      console.log('🆔 [SDKService] Making request to:', url);
      
      // Test the API key by making a request to a protected endpoint
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        }
      });
      
      console.log('🆔 [SDKService] Response status:', response.status);
      
      if (response.ok) {
        console.log('🆔 [SDKService] API key is valid');
        return true;
      } else if (response.status === 401) {
        console.log('🆔 [SDKService] API key is expired/invalid (401)');
        return false; // Token is expired or invalid
      } else {
        console.log('🆔 [SDKService] Other error, but token might still be valid');
        // Other error, but token might still be valid
        return true;
      }
    } catch (error) {
      console.log('🆔 [SDKService] API key validation failed:', error.message);
      return false;
    }
  }
  
  /**
   * Update SDK config and sync all components
   * @param {Object} config - Configuration to update
   */
  updateSDKConfig(config) {
    if (!this.sdk) {
      console.log('🆔 [SDKService] SDK not available for config update');
      return;
    }
    
    // Update main SDK config
    Object.assign(this.sdk.config, config);
    console.log('🆔 [SDKService] Updated main SDK config:', config);
    console.log('🆔 [SDKService] SDK config after update:', this.sdk.config);
    
    // Sync API client config
    if (this.sdk.apiClient) {
      this.sdk.apiClient.updateConfig(this.sdk.config);
      console.log('🆔 [SDKService] Synced API client config');
      console.log('🆔 [SDKService] API client config after sync:', this.sdk.apiClient.config);
    }
    
    // Sync protocol manager config
    if (this.sdk.protocolManager) {
      this.sdk.protocolManager.updateConfig(this.sdk.config);
      console.log('🆔 [SDKService] Synced protocol manager config');
      console.log('🆔 [SDKService] Protocol manager config after sync:', this.sdk.protocolManager.config);
    }
    
    // Update internal state
    if (config.partyId) this.partyId = config.partyId;
    if (config.groupId) this.groupId = config.groupId;
    if (config.apiKey) this.apiToken = config.apiKey;
  }
  
  /**
   * Refresh token for existing party
   * @param {string} partyId - Party ID to refresh token for
   * @returns {Promise<Object>} - Refresh result
   */
  async refreshToken(partyId) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      console.log(`🆔 [${this.instanceId}] Refreshing token for party: ${partyId}`);
      const result = await this.sdk.apiClient.refreshToken(partyId);
      console.log(`🆔 [${this.instanceId}] Token refreshed successfully`);
      
      // Update SDK config and sync all components
      this.updateSDKConfig({
        apiKey: result.token,
        partyId: result.partyId
      });
      
      return result;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw error;
    }
  }
  
  /**
   * Reset the service state
   */
  reset() {
    // Clean up SDK event listeners
    if (this.sdk && this.sdkEventHandlers) {
      Object.entries(this.sdkEventHandlers).forEach(([event, handler]) => {
        if (typeof this.sdk.off === 'function') {
          this.sdk.off(event, handler);
        }
      });
    }
    
    this.isInitialized = false;
    this.partyId = null;
    this.groupId = null;
    this.isKeygenCompleted = false;
    this.eventHandlers = {};
    this.sdkEventHandlers = {};
    this.listenersSetup = false;
  }
  
  /**
   * Clear persistent tab ID (for testing or when you want a fresh start)
   */
  clearPersistentTabId() {
    localStorage.removeItem('defishard_tab_id');
    console.log('🆔 Cleared persistent tab ID');
  }
}

// Create and export a singleton instance
const sdkService = new SDKService();
export default sdkService;
