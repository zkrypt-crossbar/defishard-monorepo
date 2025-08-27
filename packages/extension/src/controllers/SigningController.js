/**
 * Signing Controller - Manages message signing operations
 * Handles the signing workflow and UI coordination
 */
import { eventBus, EVENTS } from '../core/EventBus.js';
import { stateManager } from '../core/StateManager.js';
import { mpcService } from '../services/MPCService.js';

export class SigningController {
    constructor() {
        this.pendingSignRequests = new Map();
        this.setupEventListeners();
    }
    
    /**
     * Sign a message with the active wallet
     * @param {string} message - Message to sign
     * @param {Object} options - Signing options
     */
    async signMessage(message, options = {}) {
        try {
            const activeWallet = stateManager.getState('activeWallet');
            if (!activeWallet) {
                throw new Error('No active wallet selected');
            }
            
            // Validate message
            this.validateSigningInput(message, options);
            
            // Set loading state
            stateManager.batchUpdate({
                loading: true,
                error: null,
                signingStatus: 'preparing'
            });
            
            // Create signing request
            const signingRequest = {
                id: this.generateRequestId(),
                message,
                wallet: activeWallet,
                options,
                status: 'pending',
                created: new Date().toISOString()
            };
            
            this.pendingSignRequests.set(signingRequest.id, signingRequest);
            
            // Check if this requires multi-party signing
            if (this.requiresMultiPartySignature(activeWallet, options)) {
                return await this.performMultiPartySignature(signingRequest);
            } else {
                return await this.performSinglePartySignature(signingRequest);
            }
            
        } catch (error) {
            console.error('Failed to sign message:', error);
            stateManager.batchUpdate({
                loading: false,
                error: error.message,
                signingStatus: 'failed'
            });
            throw error;
        }
    }
    
    /**
     * Sign a transaction (structured data)
     * @param {Object} transaction - Transaction object
     * @param {Object} options - Signing options
     */
    async signTransaction(transaction, options = {}) {
        try {
            // Convert transaction to signable message
            const message = this.serializeTransaction(transaction);
            
            const result = await this.signMessage(message, {
                ...options,
                type: 'transaction',
                transaction
            });
            
            return {
                ...result,
                transaction,
                signedTransaction: this.buildSignedTransaction(transaction, result.signature)
            };
            
        } catch (error) {
            console.error('Failed to sign transaction:', error);
            throw error;
        }
    }
    
    /**
     * Batch sign multiple messages
     * @param {Array} messages - Array of messages to sign
     * @param {Object} options - Signing options
     */
    async batchSign(messages, options = {}) {
        try {
            const activeWallet = stateManager.getState('activeWallet');
            if (!activeWallet) {
                throw new Error('No active wallet selected');
            }
            
            if (!Array.isArray(messages) || messages.length === 0) {
                throw new Error('Messages array is required');
            }
            
            if (messages.length > 10) {
                throw new Error('Maximum 10 messages per batch');
            }
            
            // Set loading state
            stateManager.batchUpdate({
                loading: true,
                error: null,
                signingStatus: 'batch_signing'
            });
            
            const results = [];
            
            for (let i = 0; i < messages.length; i++) {
                const message = messages[i];
                
                // Update progress
                eventBus.emit(EVENTS.SIGNING_PROGRESS, {
                    current: i + 1,
                    total: messages.length,
                    percentage: Math.round(((i + 1) / messages.length) * 100)
                });
                
                const result = await this.signMessage(message, {
                    ...options,
                    batchIndex: i,
                    totalBatch: messages.length
                });
                
                results.push(result);
            }
            
            stateManager.batchUpdate({
                loading: false,
                signingStatus: 'completed'
            });
            
            eventBus.emit(EVENTS.SIGNING_COMPLETED, {
                type: 'batch',
                results,
                count: results.length
            });
            
            return results;
            
        } catch (error) {
            console.error('Failed to batch sign messages:', error);
            stateManager.batchUpdate({
                loading: false,
                error: error.message,
                signingStatus: 'failed'
            });
            throw error;
        }
    }
    
    /**
     * Get signing history for a wallet
     * @param {string} walletId - Wallet ID (optional, uses active wallet if not provided)
     * @returns {Array} Signing history
     */
    getSigningHistory(walletId = null) {
        const targetWalletId = walletId || stateManager.getState('activeWallet')?.id;
        if (!targetWalletId) {
            return [];
        }
        
        // This would typically come from persistent storage
        // For now, return empty array - implement based on your storage strategy
        return [];
    }
    
    /**
     * Cancel pending signing request
     * @param {string} requestId - Request ID to cancel
     */
    async cancelSigningRequest(requestId) {
        const request = this.pendingSignRequests.get(requestId);
        if (!request) {
            throw new Error('Signing request not found');
        }
        
        if (request.status === 'in_progress') {
            // Cancel the MPC operation
            await mpcService.cancelOperation();
        }
        
        request.status = 'cancelled';
        this.pendingSignRequests.delete(requestId);
        
        stateManager.batchUpdate({
            loading: false,
            signingStatus: 'idle'
        });
        
        eventBus.emit(EVENTS.SIGNING_FAILED, new Error('Signing cancelled by user'));
    }
    
    /**
     * Verify a signature
     * @param {string} message - Original message
     * @param {string} signature - Signature to verify
     * @param {string} publicKey - Public key to verify against
     * @returns {boolean} Verification result
     */
    async verifySignature(message, signature, publicKey) {
        try {
            // This would use your cryptographic library to verify
            // Placeholder implementation
            return true;
        } catch (error) {
            console.error('Failed to verify signature:', error);
            return false;
        }
    }
    
    // Private methods
    
    async performMultiPartySignature(signingRequest) {
        try {
            signingRequest.status = 'in_progress';
            
            // Coordinate with other parties for threshold signing
            const result = await mpcService.signMessage(
                signingRequest.message,
                signingRequest.wallet
            );
            
            signingRequest.status = 'completed';
            signingRequest.result = result;
            
            stateManager.batchUpdate({
                loading: false,
                signingStatus: 'completed'
            });
            
            return result;
            
        } catch (error) {
            signingRequest.status = 'failed';
            signingRequest.error = error.message;
            throw error;
        } finally {
            this.pendingSignRequests.delete(signingRequest.id);
        }
    }
    
    async performSinglePartySignature(signingRequest) {
        // For wallets that don't require threshold signing
        // This might be for testing or special wallet types
        throw new Error('Single party signing not implemented');
    }
    
    requiresMultiPartySignature(wallet, options) {
        // Always require multi-party for MPC wallets
        return wallet.threshold > 1;
    }
    
    serializeTransaction(transaction) {
        // Convert transaction object to canonical string format
        // This depends on your transaction format
        return JSON.stringify(transaction, null, 0);
    }
    
    buildSignedTransaction(transaction, signature) {
        // Build the signed transaction object
        return {
            ...transaction,
            signature
        };
    }
    
    setupEventListeners() {
        eventBus.on(EVENTS.SIGNING_PROGRESS, (progress) => {
            // Update UI with signing progress
            eventBus.emit(EVENTS.NOTIFICATION_SHOWN, {
                type: 'progress',
                message: `Signing in progress: ${progress.percentage || 0}%`,
                progress: progress.percentage
            });
        });
        
        eventBus.on(EVENTS.SIGNING_COMPLETED, (result) => {
            if (result.type === 'batch') {
                eventBus.emit(EVENTS.NOTIFICATION_SHOWN, {
                    type: 'success',
                    message: `Successfully signed ${result.count} messages`
                });
            } else {
                eventBus.emit(EVENTS.NOTIFICATION_SHOWN, {
                    type: 'success',
                    message: 'Message signed successfully'
                });
            }
        });
        
        eventBus.on(EVENTS.SIGNING_FAILED, (error) => {
            eventBus.emit(EVENTS.NOTIFICATION_SHOWN, {
                type: 'error',
                message: `Signing failed: ${error.message}`
            });
        });
    }
    
    validateSigningInput(message, options) {
        if (!message || typeof message !== 'string') {
            throw new Error('Valid message string is required');
        }
        
        if (message.length === 0) {
            throw new Error('Message cannot be empty');
        }
        
        if (message.length > 10000) {
            throw new Error('Message too long (max 10,000 characters)');
        }
        
        // Additional validation based on options
        if (options.type === 'transaction' && !options.transaction) {
            throw new Error('Transaction object required for transaction signing');
        }
    }
    
    generateRequestId() {
        return `sign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Export singleton instance
export const signingController = new SigningController();
