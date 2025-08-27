/**
 * Wallet Controller - Manages wallet operations and UI coordination
 * Orchestrates between UI components and MPC service
 */
import { eventBus, EVENTS } from '../core/EventBus.js';
import { stateManager } from '../core/StateManager.js';
import { mpcService } from '../services/MPCService.js';

export class WalletController {
    constructor() {
        this.setupEventListeners();
    }
    
    /**
     * Create a new wallet through MPC key generation
     * @param {Object} options - Wallet creation options
     */
    async createWallet(options) {
        try {
            const { name, threshold, totalParties, timeoutMinutes } = options;
            
            // Validate input
            this.validateWalletOptions(options);
            
            // Set loading state
            stateManager.batchUpdate({
                loading: true,
                error: null,
                currentView: 'create'
            });
            
            // Create MPC group
            const groupInfo = await mpcService.createGroup({
                threshold,
                totalParties,
                timeoutMinutes,
                walletName: name
            });
            
            return groupInfo;
            
        } catch (error) {
            console.error('Failed to create wallet:', error);
            stateManager.batchUpdate({
                loading: false,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Join an existing wallet group
     * @param {string} invitationData - QR code data or invitation
     */
    async joinWallet(invitationData) {
        try {
            // Set loading state
            stateManager.batchUpdate({
                loading: true,
                error: null,
                currentView: 'join'
            });
            
            // Join MPC group
            const groupInfo = await mpcService.joinGroup(invitationData);
            
            return groupInfo;
            
        } catch (error) {
            console.error('Failed to join wallet:', error);
            stateManager.batchUpdate({
                loading: false,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Complete wallet creation by starting keygen
     * @param {boolean} isCreator - Whether this party created the group
     */
    async completeWalletCreation(isCreator = false) {
        try {
            // Start keygen process
            const wallet = await mpcService.startKeygen(isCreator);
            
            // Update UI state
            stateManager.batchUpdate({
                loading: false,
                currentView: 'success',
                error: null
            });
            
            return wallet;
            
        } catch (error) {
            console.error('Failed to complete wallet creation:', error);
            stateManager.batchUpdate({
                loading: false,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Select an active wallet
     * @param {string} walletId - Wallet ID to select
     */
    selectWallet(walletId) {
        const wallets = stateManager.getState('wallets');
        const wallet = wallets.find(w => w.id === walletId);
        
        if (!wallet) {
            throw new Error('Wallet not found');
        }
        
        stateManager.setState('activeWallet', wallet);
        eventBus.emit(EVENTS.WALLET_SELECTED, wallet);
    }
    
    /**
     * Delete a wallet
     * @param {string} walletId - Wallet ID to delete
     */
    deleteWallet(walletId) {
        const wallets = stateManager.getState('wallets');
        const activeWallet = stateManager.getState('activeWallet');
        
        const updatedWallets = wallets.filter(w => w.id !== walletId);
        const newActiveWallet = activeWallet?.id === walletId ? null : activeWallet;
        
        stateManager.batchUpdate({
            wallets: updatedWallets,
            activeWallet: newActiveWallet
        });
        
        eventBus.emit(EVENTS.WALLET_DELETED, walletId);
    }
    
    /**
     * Get wallet list with metadata
     * @returns {Array} Formatted wallet list
     */
    getWalletList() {
        const wallets = stateManager.getState('wallets');
        const activeWallet = stateManager.getState('activeWallet');
        
        return wallets.map(wallet => ({
            ...wallet,
            isActive: activeWallet?.id === wallet.id,
            formattedPublicKey: this.formatPublicKey(wallet.publicKey),
            timeAgo: this.formatTimeAgo(wallet.lastUsed || wallet.created)
        }));
    }
    
    /**
     * Export wallet data
     * @param {string} walletId - Wallet ID to export
     * @returns {Object} Exportable wallet data
     */
    exportWallet(walletId) {
        const wallets = stateManager.getState('wallets');
        const wallet = wallets.find(w => w.id === walletId);
        
        if (!wallet) {
            throw new Error('Wallet not found');
        }
        
        // Return safe export data (exclude sensitive keyshare)
        return {
            id: wallet.id,
            name: wallet.name,
            publicKey: wallet.publicKey,
            threshold: wallet.threshold,
            totalParties: wallet.totalParties,
            created: wallet.created,
            lastUsed: wallet.lastUsed
        };
    }
    
    /**
     * Import wallet data
     * @param {Object} walletData - Wallet data to import
     * @param {string} keyshare - Encrypted keyshare
     */
    importWallet(walletData, keyshare) {
        const wallets = stateManager.getState('wallets');
        
        // Check if wallet already exists
        const existingWallet = wallets.find(w => w.publicKey === walletData.publicKey);
        if (existingWallet) {
            throw new Error('Wallet already exists');
        }
        
        const wallet = {
            ...walletData,
            keyshare,
            imported: true,
            importedAt: new Date().toISOString()
        };
        
        const updatedWallets = [...wallets, wallet];
        stateManager.setState('wallets', updatedWallets);
        
        eventBus.emit(EVENTS.WALLET_CREATED, wallet);
        return wallet;
    }
    
    // Private methods
    
    setupEventListeners() {
        // Listen to MPC events and update UI accordingly
        eventBus.on(EVENTS.KEYGEN_PROGRESS, (progress) => {
            // Update progress in UI
            eventBus.emit(EVENTS.NOTIFICATION_SHOWN, {
                type: 'progress',
                message: `Key generation progress: ${progress.percentage}%`,
                progress: progress.percentage
            });
        });
        
        eventBus.on(EVENTS.KEYGEN_COMPLETED, (wallet) => {
            eventBus.emit(EVENTS.NOTIFICATION_SHOWN, {
                type: 'success',
                message: `Wallet "${wallet.name}" created successfully!`
            });
        });
        
        eventBus.on(EVENTS.KEYGEN_FAILED, (error) => {
            eventBus.emit(EVENTS.NOTIFICATION_SHOWN, {
                type: 'error',
                message: `Wallet creation failed: ${error.message}`
            });
        });
    }
    
    validateWalletOptions(options) {
        const { name, threshold, totalParties } = options;
        
        if (!name || name.trim().length === 0) {
            throw new Error('Wallet name is required');
        }
        
        if (!threshold || threshold < 2) {
            throw new Error('Threshold must be at least 2');
        }
        
        if (!totalParties || totalParties < threshold) {
            throw new Error('Total parties must be at least equal to threshold');
        }
        
        if (totalParties > 10) {
            throw new Error('Maximum 10 parties supported');
        }
    }
    
    formatPublicKey(publicKey) {
        if (!publicKey) return '';
        return `${publicKey.slice(0, 8)}...${publicKey.slice(-8)}`;
    }
    
    formatTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now - time;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 0) {
            return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else if (diffHours > 0) {
            return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else {
            return 'Just now';
        }
    }
}

// Export singleton instance
export const walletController = new WalletController();
