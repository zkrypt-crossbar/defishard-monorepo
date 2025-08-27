import { EventEmitter } from '../events';
import { ApiClient } from '../api';
import { WebSocketManager } from '../websocket';
import { LocalStorageAdapter } from '../storage/local-storage';
import { ProtocolManager } from '../core/ProtocolManager';
// Export storage interface and implementations for easy access
export { LocalStorageAdapter } from '../storage/local-storage';
export class DeFiShArdSDK extends EventEmitter {
    constructor(config) {
        super();
        this.wasmInitialized = false;
        this.config = config;
        this.debug = config.debug ?? false;
        this.apiClient = new ApiClient(config.relayerUrl);
        this.websocketManager = new WebSocketManager(config.websocketUrl, this.debug);
        // Use provided storage or fallback to localStorage
        this.storage = config.storage || new LocalStorageAdapter('defishard_');
        // Initialize protocol manager with shared WebSocketManager
        this.protocolManager = new ProtocolManager(this.config, this.storage, this.debug, this.websocketManager);
        // Set up WebSocket message handler to route to ProtocolManager
        this.websocketManager.on('message', (protocolMessage) => {
            this.handleWebSocketMessage(protocolMessage).catch((error) => {
                this.emit('error', error);
            });
        });
        // Forward WebSocket events
        this.websocketManager.on('connected', () => {
            if (this.debug) {
                console.log(`[SDK] 🔌 WebSocket connected for party ${this.config.partyId}`);
            }
            this.emit('connected');
        });
        this.websocketManager.on('disconnected', () => {
            if (this.debug) {
                console.log(`[SDK] 🔌 WebSocket disconnected for party ${this.config.partyId}`);
            }
            this.emit('disconnected');
        });
        this.websocketManager.on('error', (error) => {
            if (this.debug) {
                console.log(`[SDK] ❌ WebSocket error for party ${this.config.partyId}:`, error);
            }
            this.emit('error', error);
        });
        // Forward protocol events
        this.protocolManager.on('keygen-complete', (keyShare) => {
            this.emit('keygen-complete', keyShare);
        });
        this.protocolManager.on('sign-complete', (signature) => {
            this.emit('sign-complete', signature);
        });
        this.protocolManager.on('error', (error) => {
            this.emit('error', error);
        });
    }
    /**
     * Initialize the SDK and WASM
     */
    async initialize() {
        try {
            if (this.wasmInitialized) {
                return;
            }
            // Initialize WASM
            const { default: init } = await import('../../pkg/dkls_wasm_ll.js');
            await init();
            this.wasmInitialized = true;
            // SDK initialized
        }
        catch (error) {
            this.emit('error', new Error(`Failed to initialize SDK: ${error}`));
            throw error;
        }
    }
    /**
     * Register a new party
     */
    async register() {
        try {
            const result = await this.apiClient.register();
            if (result.success) {
                this.config.partyId = result.partyId;
                this.config.apiKey = result.token;
                // Update API client with the new config
                this.apiClient.updateConfig(this.config);
                // Update ProtocolManager with the new config
                this.protocolManager.updateConfig(this.config);
                // Set party ID on WebSocketManager for loop prevention
                this.websocketManager.setOwnPartyId(result.partyId);
                if (this.debug) {
                    console.log(`[SDK] ✅ Registered party ${result.partyId}`);
                }
            }
            return result;
        }
        catch (error) {
            this.emit('error', new Error(`Failed to register: ${error}`));
            throw error;
        }
    }
    /**
     * Create a new group
     */
    async createGroup(threshold, totalParties, timeoutMinutes = 60) {
        try {
            const result = await this.apiClient.createGroup(threshold, totalParties, timeoutMinutes);
            if (result.success) {
                this.config.groupId = result.group.groupId;
                if (this.debug) {
                    console.log(`[SDK] ✅ Created group ${result.group.groupId}`);
                }
            }
            return result;
        }
        catch (error) {
            this.emit('error', new Error(`Failed to create group: ${error}`));
            throw error;
        }
    }
    /**
     * Join an existing group
     */
    async joinGroup(groupId) {
        try {
            const result = await this.apiClient.joinGroup(groupId);
            if (result.success) {
                this.config.groupId = result.group.groupId;
                if (this.debug) {
                    console.log(`[SDK] ✅ Joined group ${result.group.groupId}`);
                }
            }
            return result;
        }
        catch (error) {
            this.emit('error', new Error(`Failed to join group: ${error}`));
            throw error;
        }
    }
    /**
     * Start key generation
     */
    async startKeygen(distributed = true, secret) {
        try {
            await this.protocolManager.startKeygen(distributed, secret);
        }
        catch (error) {
            this.emit('error', new Error(`Failed to start keygen: ${error}`));
            throw error;
        }
    }
    /**
     * Start key rotation
     */
    async startKeyRotation(oldKeyshare, distributed = true, secret) {
        try {
            await this.protocolManager.startKeyRotation(oldKeyshare, distributed, secret);
        }
        catch (error) {
            this.emit('error', new Error(`Failed to start key rotation: ${error}`));
            throw error;
        }
    }
    /**
     * Start signing
     */
    async startSigning(messageHash, keyshare) {
        try {
            await this.protocolManager.startSigning(messageHash, keyshare);
        }
        catch (error) {
            this.emit('error', new Error(`Failed to start signing: ${error}`));
            throw error;
        }
    }
    /**
     * Start signing with specific keyshare details
     */
    async startSigningWithKeyshare(messageHash, keyshareGroupId, keyshareIndex) {
        try {
            // Load the keyshare manually from the specified location
            const keyshareStorageKey = `keyshare_${keyshareGroupId}_${keyshareIndex}`;
            const keyshareData = await this.storage.get(keyshareStorageKey);
            if (!keyshareData) {
                throw new Error(`No keyshare found at ${keyshareStorageKey}`);
            }
            const keyshare = JSON.parse(keyshareData);
            console.log(`📋 Loaded keyshare from ${keyshareStorageKey}: Party ${keyshare.partyId}`);
            // Pass the loaded keyshare to the protocol manager
            await this.protocolManager.startSigningWithKeyshare(messageHash, keyshare);
        }
        catch (error) {
            this.emit('error', new Error(`Failed to start signing: ${error}`));
            throw error;
        }
    }
    /**
     * Handle WebSocket messages
     */
    async handleWebSocketMessage(protocolMessage) {
        try {
            await this.protocolManager.handleMessage(protocolMessage);
        }
        catch (error) {
            this.emit('error', new Error(`Failed to handle WebSocket message: ${error}`));
            throw error;
        }
    }
    /**
     * Get keygen state
     */
    getKeygenState() {
        return this.protocolManager.getKeygenState();
    }
    /**
     * Get sign state
     */
    getSignState() {
        return this.protocolManager.getSignState();
    }
    /**
     * Check if storage is available
     */
    async isStorageAvailable() {
        return await this.storage.isAvailable();
    }
    /**
     * Get storage instance
     */
    getStorage() {
        return this.storage;
    }
    /**
     * Set encryption key for WebSocket communication
     */
    async setEncryptionKey(rawKey) {
        await this.websocketManager.setEncryptionKey(rawKey);
    }
    /**
     * Disconnect from WebSocket
     */
    async disconnect() {
        await this.websocketManager.disconnect();
        this.protocolManager.destroy();
    }
}
