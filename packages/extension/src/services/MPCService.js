/**
 * MPC Service - Handles all MPC operations (Keygen, Signing, Rotation)
 * Provides a clean interface to the underlying SDK
 */
import { eventBus, EVENTS } from '../core/EventBus.js';
import { stateManager } from '../core/StateManager.js';

export class MPCService {
    constructor() {
        this.sdk = null;
        this.isInitialized = false;
        this.currentOperation = null;
    }
    
    /**
     * Initialize the MPC service
     * @param {Object} config - Configuration object
     */
    async initialize(config) {
        try {
            // Initialize SDK with config
            this.sdk = await this.initializeSDK(config);
            this.isInitialized = true;
            
            // Set up event listeners
            this.setupEventListeners();
            
            eventBus.emit(EVENTS.CONNECTION_ESTABLISHED);
            stateManager.setState('isConnected', true);
            
            console.log('✅ MPC Service initialized');
        } catch (error) {
            console.error('❌ Failed to initialize MPC Service:', error);
            eventBus.emit(EVENTS.SERVER_ERROR, error);
            throw error;
        }
    }
    
    /**
     * Create a new MPC group for key generation
     * @param {Object} options - Group creation options
     * @returns {Promise<Object>} Group information
     */
    async createGroup(options) {
        this.validateInitialized();
        
        const { threshold, totalParties, timeoutMinutes = 60, walletName } = options;
        
        try {
            stateManager.setState('keygenStatus', 'creating');
            eventBus.emit(EVENTS.KEYGEN_STARTED, { phase: 'creating_group' });
            
            // Register party if needed
            if (!this.sdk.isRegistered) {
                await this.registerParty();
            }
            
            // Create group
            const groupResult = await this.sdk.createGroup(threshold, totalParties, timeoutMinutes);
            
            const groupInfo = {
                groupId: groupResult.group_id,
                threshold,
                totalParties,
                walletName,
                created: new Date().toISOString(),
                status: 'created'
            };
            
            stateManager.setState('currentGroup', groupInfo);
            eventBus.emit(EVENTS.GROUP_CREATED, groupInfo);
            
            return groupInfo;
            
        } catch (error) {
            stateManager.setState('keygenStatus', 'failed');
            eventBus.emit(EVENTS.KEYGEN_FAILED, error);
            throw error;
        }
    }
    
    /**
     * Join an existing MPC group
     * @param {string} groupData - QR code data or group invitation
     * @returns {Promise<Object>} Group information
     */
    async joinGroup(groupData) {
        this.validateInitialized();
        
        try {
            const invitation = typeof groupData === 'string' 
                ? JSON.parse(groupData) 
                : groupData;
            
            // Register party if needed
            if (!this.sdk.isRegistered) {
                await this.registerParty();
            }
            
            // Join group
            const joinResult = await this.sdk.joinGroup(invitation);
            
            const groupInfo = {
                groupId: invitation.groupId,
                threshold: invitation.threshold,
                totalParties: invitation.totalParties,
                joined: new Date().toISOString(),
                status: 'joined'
            };
            
            stateManager.setState('currentGroup', groupInfo);
            eventBus.emit(EVENTS.GROUP_JOINED, groupInfo);
            
            return groupInfo;
            
        } catch (error) {
            eventBus.emit(EVENTS.KEYGEN_FAILED, error);
            throw error;
        }
    }
    
    /**
     * Start key generation process
     * @param {boolean} isCreator - Whether this party is the group creator
     * @returns {Promise<Object>} Generated key information
     */
    async startKeygen(isCreator = false) {
        this.validateInitialized();
        
        if (this.currentOperation) {
            throw new Error('Another MPC operation is already in progress');
        }
        
        try {
            this.currentOperation = 'keygen';
            stateManager.setState('keygenStatus', 'in-progress');
            eventBus.emit(EVENTS.KEYGEN_STARTED, { isCreator });
            
            // Start keygen with progress tracking
            const keyResult = await this.sdk.startKeygen(isCreator);
            
            // Create wallet entry
            const wallet = {
                id: this.generateWalletId(),
                name: stateManager.getState('currentGroup')?.walletName || 'Unnamed Wallet',
                publicKey: keyResult.publicKey,
                keyshare: keyResult.keyshare,
                threshold: stateManager.getState('currentGroup')?.threshold,
                totalParties: stateManager.getState('currentGroup')?.totalParties,
                created: new Date().toISOString(),
                lastUsed: new Date().toISOString()
            };
            
            // Update state
            const wallets = stateManager.getState('wallets') || [];
            wallets.push(wallet);
            
            stateManager.batchUpdate({
                wallets,
                activeWallet: wallet,
                keygenStatus: 'completed',
                currentGroup: null
            });
            
            eventBus.emit(EVENTS.KEYGEN_COMPLETED, wallet);
            eventBus.emit(EVENTS.WALLET_CREATED, wallet);
            
            return wallet;
            
        } catch (error) {
            stateManager.setState('keygenStatus', 'failed');
            eventBus.emit(EVENTS.KEYGEN_FAILED, error);
            throw error;
        } finally {
            this.currentOperation = null;
        }
    }
    
    /**
     * Sign a message using threshold signing
     * @param {string} message - Message to sign
     * @param {Object} wallet - Wallet to use for signing
     * @returns {Promise<Object>} Signature result
     */
    async signMessage(message, wallet) {
        this.validateInitialized();
        
        if (this.currentOperation) {
            throw new Error('Another MPC operation is already in progress');
        }
        
        try {
            this.currentOperation = 'signing';
            stateManager.setState('signingStatus', 'in-progress');
            eventBus.emit(EVENTS.SIGNING_STARTED, { message, walletId: wallet.id });
            
            // Load wallet keyshare
            await this.sdk.loadKeyshare(wallet.keyshare);
            
            // Create signing group
            const signingGroup = await this.createSigningGroup(wallet);
            
            // Start signing process
            const signature = await this.sdk.sign(message);
            
            const result = {
                message,
                signature,
                publicKey: wallet.publicKey,
                timestamp: new Date().toISOString()
            };
            
            // Update wallet last used
            wallet.lastUsed = new Date().toISOString();
            const wallets = stateManager.getState('wallets');
            const updatedWallets = wallets.map(w => w.id === wallet.id ? wallet : w);
            
            stateManager.batchUpdate({
                wallets: updatedWallets,
                signingStatus: 'completed'
            });
            
            eventBus.emit(EVENTS.SIGNING_COMPLETED, result);
            
            return result;
            
        } catch (error) {
            stateManager.setState('signingStatus', 'failed');
            eventBus.emit(EVENTS.SIGNING_FAILED, error);
            throw error;
        } finally {
            this.currentOperation = null;
        }
    }
    
    /**
     * Rotate keys for enhanced security
     * @param {Object} wallet - Wallet to rotate keys for
     * @returns {Promise<Object>} New wallet with rotated keys
     */
    async rotateKeys(wallet) {
        this.validateInitialized();
        
        if (this.currentOperation) {
            throw new Error('Another MPC operation is already in progress');
        }
        
        try {
            this.currentOperation = 'rotation';
            stateManager.setState('rotationStatus', 'in-progress');
            eventBus.emit(EVENTS.ROTATION_STARTED, { walletId: wallet.id });
            
            // Load current keyshare
            await this.sdk.loadKeyshare(wallet.keyshare);
            
            // Create rotation group with same threshold/parties
            const rotationGroup = await this.createRotationGroup(wallet);
            
            // Start key rotation
            const newKeyResult = await this.sdk.rotateKeys();
            
            // Create new wallet with rotated keys
            const rotatedWallet = {
                ...wallet,
                id: this.generateWalletId(),
                name: `${wallet.name} (Rotated)`,
                publicKey: newKeyResult.publicKey,
                keyshare: newKeyResult.keyshare,
                rotatedFrom: wallet.id,
                created: new Date().toISOString(),
                lastUsed: new Date().toISOString()
            };
            
            // Update state
            const wallets = stateManager.getState('wallets');
            const updatedWallets = wallets.map(w => 
                w.id === wallet.id ? { ...w, status: 'rotated' } : w
            );
            updatedWallets.push(rotatedWallet);
            
            stateManager.batchUpdate({
                wallets: updatedWallets,
                activeWallet: rotatedWallet,
                rotationStatus: 'completed'
            });
            
            eventBus.emit(EVENTS.ROTATION_COMPLETED, rotatedWallet);
            eventBus.emit(EVENTS.WALLET_CREATED, rotatedWallet);
            
            return rotatedWallet;
            
        } catch (error) {
            stateManager.setState('rotationStatus', 'failed');
            eventBus.emit(EVENTS.ROTATION_FAILED, error);
            throw error;
        } finally {
            this.currentOperation = null;
        }
    }
    
    /**
     * Get current operation status
     * @returns {string|null} Current operation type or null
     */
    getCurrentOperation() {
        return this.currentOperation;
    }
    
    /**
     * Cancel current operation
     */
    async cancelOperation() {
        if (this.currentOperation && this.sdk.cancelOperation) {
            try {
                await this.sdk.cancelOperation();
                this.currentOperation = null;
                
                // Reset status
                stateManager.batchUpdate({
                    keygenStatus: 'idle',
                    signingStatus: 'idle',
                    rotationStatus: 'idle'
                });
                
            } catch (error) {
                console.error('Failed to cancel operation:', error);
            }
        }
    }
    
    // Private methods
    
    async initializeSDK(config) {
        // This would be implemented based on your actual SDK
        // Return initialized SDK instance
        throw new Error('SDK initialization not implemented');
    }
    
    async registerParty() {
        // Register party with the MPC relayer
        const registration = await this.sdk.register();
        return registration;
    }
    
    async createSigningGroup(wallet) {
        // Create a signing group with sufficient parties
        // Implementation depends on your MPC protocol
        throw new Error('Signing group creation not implemented');
    }
    
    async createRotationGroup(wallet) {
        // Create a rotation group
        // Implementation depends on your MPC protocol
        throw new Error('Rotation group creation not implemented');
    }
    
    setupEventListeners() {
        // Set up SDK event listeners for progress updates
        if (this.sdk.on) {
            this.sdk.on('keygen_progress', (progress) => {
                eventBus.emit(EVENTS.KEYGEN_PROGRESS, progress);
            });
            
            this.sdk.on('signing_progress', (progress) => {
                eventBus.emit(EVENTS.SIGNING_PROGRESS, progress);
            });
            
            this.sdk.on('rotation_progress', (progress) => {
                eventBus.emit(EVENTS.ROTATION_PROGRESS, progress);
            });
        }
    }
    
    validateInitialized() {
        if (!this.isInitialized) {
            throw new Error('MPC Service not initialized');
        }
    }
    
    generateWalletId() {
        return `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Export singleton instance
export const mpcService = new MPCService();
