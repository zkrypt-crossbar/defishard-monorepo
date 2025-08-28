import { EventEmitter } from '../events';
import { ApiClient } from '../api';
import { WebSocketManager } from '../websocket';
import { KeygenProcessor } from '../protocols/keygen-processor';
import { SignProcessor } from '../protocols/sign-processor';
export class ProtocolManager extends EventEmitter {
    /**
     * Common validation and group info retrieval
     */
    async validateAndGetGroupInfo(operation) {
        if (!this.config.groupId) {
            throw new Error(`No group ID available. Please create or join a group first.`);
        }
        if (!this.config.apiKey) {
            throw new Error(`API key required for ${operation}`);
        }
        const groupInfo = await this.apiClient.getGroupInfo(this.config.groupId);
        const partyIndex = groupInfo.members.findIndex((m) => m.partyId === this.config.partyId);
        if (partyIndex === -1) {
            throw new Error('Party not found in group members');
        }
        return { groupInfo, partyIndex };
    }
    /**
     * Common round-complete event handler
     */
    handleRoundComplete(round, messages) {
        if (this.debug) {
            console.log(`[ProtocolManager#${this.instanceId}] [${this.config.partyId?.substring(0, 8)}] 🎯 round-complete event received: Round ${round}, ${messages.length} messages`);
        }
        // Queue messages instead of sending immediately to prevent recursion
        for (const message of messages) {
            this.queueOutgoingMessage(message);
        }
        // Process queued messages
        this.processOutgoingQueue();
    }
    /**
     * Common processor error handler
     */
    handleProcessorError(error, type) {
        // Clean up processor on error
        if (type === 'keygen' && this.keygenProcessor) {
            this.keygenProcessor.destroy();
            this.keygenProcessor = null;
        }
        else if (type === 'sign' && this.signProcessor) {
            this.signProcessor.destroy();
            this.signProcessor = null;
        }
        this.emit('error', error);
    }
    /**
     * Common completion handler
     */
    async handleProcessorComplete(result, eventName, processorType) {
        if (this.debug) {
            console.log(`[ProtocolManager] [${this.config.partyId?.substring(0, 8)}] 🎉 ${processorType} completed`);
        }
        // Disconnect immediately (server handles completion)
        try {
            await this.websocketManager.disconnect();
        }
        catch (error) {
            if (this.debug) {
                console.warn('[ProtocolManager] Error during disconnect:', error);
            }
        }
        // Clear processor
        if (processorType === 'keygen') {
            this.keygenProcessor = null;
        }
        else {
            this.signProcessor = null;
        }
        // Emit completion event
        this.emit(eventName, result);
    }
    /**
     * Setup common event handlers for processors
     */
    setupProcessorEventHandlers(processor, type) {
        // Common round-complete handler
        processor.on('round-complete', this.handleRoundComplete.bind(this));
        // Common error handler
        processor.on('error', (err) => this.handleProcessorError(err, type));
        // Type-specific completion handler
        if (type === 'keygen') {
            processor.on('keygen-complete', (keyShare) => this.handleProcessorComplete(keyShare, 'keygen-complete', 'keygen'));
        }
        else {
            processor.on('signing-complete', (signature) => this.handleProcessorComplete(signature, 'sign-complete', 'sign'));
        }
    }
    constructor(config, storage, debug = false, websocketManager) {
        super();
        this.keygenProcessor = null;
        this.signProcessor = null;
        // Queue for outgoing messages to prevent recursion during message processing
        this.outgoingQueue = [];
        this.processingOutgoing = false;
        this.processedMessageIds = new Set(); // Track processed messages to prevent duplicates
        this.instanceId = ++ProtocolManager.instanceCounter;
        this.config = config;
        this.storage = storage;
        this.debug = debug;
        this.apiClient = new ApiClient(config.relayerUrl);
        // Use provided WebSocketManager or create a new one
        this.websocketManager = websocketManager || new WebSocketManager(config.websocketUrl || 'ws://localhost:3000', debug);
        // Set up WebSocket message handler (only if we're using our own WebSocketManager)
        // When using a shared WebSocketManager (from SDK), the SDK handles message routing
        if (!websocketManager) {
            this.websocketManager.on('message', (message) => {
                this.handleMessage(message).catch((error) => {
                    this.emit('error', error instanceof Error ? error : new Error(String(error)));
                });
            });
            this.websocketManager.on('error', (error) => {
                this.emit('error', error instanceof Error ? error : new Error(String(error)));
            });
        }
    }
    /**
     * Update configuration (called when SDK config changes)
     */
    updateConfig(config) {
        this.config = config;
        this.apiClient.updateConfig(config);
    }
    /**
     * Start keygen
     */
    async startKeygen(distributed = true, secret) {
        try {
            // Clear processed message IDs and outgoing queue to allow restarting keygen in same session
            this.processedMessageIds.clear();
            this.outgoingQueue = [];
            this.processingOutgoing = false;
            
            // Common validation and group info retrieval
            const { groupInfo, partyIndex } = await this.validateAndGetGroupInfo('keygen');
            // Create automated keygen processor
            this.keygenProcessor = new KeygenProcessor({
                groupInfo,
                partyId: this.config.partyId,
                partyIndex,
                groupId: this.config.groupId,
                distributed,
                secret,
                debug: this.debug,
                storage: this.storage,
                apiKey: this.config.apiKey // Pass API key for storage in keyshare
            });
            // Setup common event handlers
            this.setupProcessorEventHandlers(this.keygenProcessor, 'keygen');
            // Connect to WebSocket for message exchange
            await this.websocketManager.connect(this.config.groupId, 'keygen', this.config.apiKey);
            // Initialize the processor (but don't start automatically)
            await this.keygenProcessor.initialize();
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
            // Common validation and group info retrieval
            const { groupInfo, partyIndex } = await this.validateAndGetGroupInfo('key rotation');
            if (this.debug) {
                console.log(`[ProtocolManager] 🔄 Using keyshare data for rotation: partyIndex=${partyIndex}, totalParties=${groupInfo.totalParties}`);
            }
            // Create automated keygen processor for key rotation
            this.keygenProcessor = new KeygenProcessor({
                groupInfo,
                partyId: this.config.partyId,
                partyIndex,
                groupId: this.config.groupId, // Use current group ID (original group with fresh API key)
                distributed,
                secret,
                debug: this.debug,
                storage: this.storage,
                apiKey: this.config.apiKey // Pass API key for storage in keyshare
            }, true); // isKeyRotation = true
            // Setup common event handlers
            this.setupProcessorEventHandlers(this.keygenProcessor, 'keygen');
            // Connect to WebSocket for message exchange
            await this.websocketManager.connect(this.config.groupId, 'keygen', this.config.apiKey);
            // Initialize the processor with the provided keyshare
            // Accept both JSON KeyShare (like signing) and WASM Keyshare for backward compatibility
            let wasmKeyshare = null;
            try {
                if (oldKeyshare && typeof oldKeyshare.toBytes === 'function') {
                    // Already a WASM Keyshare instance
                    wasmKeyshare = oldKeyshare;
                }
                else if (oldKeyshare && Array.isArray(oldKeyshare.serialized)) {
                    // JSON KeyShare: convert to WASM Keyshare (same as signing flow)
                    const { Keyshare } = await import('../../pkg/dkls_wasm_ll.js');
                    wasmKeyshare = Keyshare.fromBytes(new Uint8Array(oldKeyshare.serialized));
                }
                else {
                    throw new Error('Invalid keyshare format: expected WASM Keyshare or KeyShare JSON with serialized bytes');
                }
            }
            catch (error) {
                this.emit('error', new Error(`Failed to prepare keyshare for rotation: ${error}`));
                throw error;
            }
            await this.keygenProcessor.initialize(wasmKeyshare);
        }
        catch (error) {
            this.emit('error', new Error(`Failed to start key rotation: ${error}`));
            throw error;
        }
    }
    /**
     * Start signing with provided keyshare (simple delegation)
     */
    async startSigningWithKeyshare(messageHash, keyshare) {
        return this.startSigning(messageHash, keyshare);
    }
    /**
     * Start signing with explicit keyshare (the only method needed for real apps)
     */
    async startSigning(messageHash, keyshare) {
        try {
            // Clear processed message IDs and outgoing queue to allow restarting signing in same session
            this.processedMessageIds.clear();
            this.outgoingQueue = [];
            this.processingOutgoing = false;
            
            // Validate message hash
            if (messageHash.length !== 32) {
                throw new Error('Message hash must be 32 bytes');
            }
            // Common validation and group info retrieval
            const { groupInfo, partyIndex } = await this.validateAndGetGroupInfo('signing');
            // Ensure keygen processor is cleaned up before starting signing
            if (this.keygenProcessor) {
                this.keygenProcessor.destroy();
                this.keygenProcessor = null;
            }
            // Always use the provided keyshare (real apps always specify which keyshare to use)
            console.log(`📋 Using provided keyshare for party index ${partyIndex} in group ${keyshare.groupId}`);
            // Import WASM module and create Keyshare object from provided data
            const { Keyshare } = await import('../../pkg/dkls_wasm_ll.js');
            const wasmKeyshare = Keyshare.fromBytes(new Uint8Array(keyshare.serialized));
            // Create sign processor
            this.signProcessor = new SignProcessor({
                groupInfo,
                partyId: this.config.partyId,
                partyIndex,
                groupId: this.config.groupId,
                keyShare: wasmKeyshare,
                messageHash,
                debug: this.debug
            });
            // Setup common event handlers
            this.setupProcessorEventHandlers(this.signProcessor, 'sign');
            // Connect to WebSocket for message exchange
            await this.websocketManager.connect(this.config.groupId, 'sign', this.config.apiKey);
            // Initialize the processor
            await this.signProcessor.initialize();
        }
        catch (error) {
            this.emit('error', new Error(`Failed to start signing: ${error}`));
            throw error;
        }
    }
    /**
     * Handle incoming WebSocket messages
     * Routes messages to the appropriate processor automatically
     */
    async handleMessage(protocolMessage) {
        try {
            // Log END messages specifically
            if (protocolMessage.content.startsWith('END:')) {
                console.log(`[ProtocolManager] [${this.config.partyId?.substring(0, 8) || 'unknown'}] 📨 Processing END message: ${protocolMessage.content}`);
            }
            // Reconnect if not connected (for round-based connection management)
            if (!this.websocketManager.isConnected()) {
                if (this.config.groupId && this.config.apiKey) {
                    // Determine protocol based on active processor
                    const protocol = this.keygenProcessor ? 'keygen' : 'sign';
                    await this.websocketManager.connect(this.config.groupId, protocol, this.config.apiKey);
                }
            }
            // Route message to the appropriate processor
            // Keygen processor handles rounds 0-4 and END messages (round 5)
            // Sign processor handles rounds 0-4 for signing
            if (this.keygenProcessor && !this.keygenProcessor.isKeygenComplete()) {
                // Process message through keygen processor
                // Outgoing messages are emitted via 'round-complete' event; do not queue here to avoid duplicates
                await this.keygenProcessor.processMessage(protocolMessage);
            }
            else if (this.signProcessor && this.signProcessor.isActive()) {
                // Route signing messages (rounds 0-5) to sign processor
                if (protocolMessage.round <= 5) {
                    // Process message through sign processor
                    // Outgoing messages are emitted via 'round-complete' event; do not queue here to avoid duplicates
                    await this.signProcessor.processMessage(protocolMessage);
                }
            }
            else {
                // No active processor to handle message
                if (this.debug) {
                    console.log('[ProtocolManager] No active processor to handle message, ignoring');
                }
            }
            // Process queued outgoing messages after handling incoming message
            this.processOutgoingQueue();
        }
        catch (error) {
            this.emit('error', new Error(`Failed to handle message: ${error}`));
            throw error;
        }
    }
    /**
     * Simple hash function for message content
     */
    hashContent(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36); // Convert to base36 for shorter string
    }
    /**
     * Queue an outgoing message to prevent recursion
     */
    queueOutgoingMessage(message) {
        // Add message deduplication to prevent duplicate sends
        const messageKey = `${message.round}_${message.from_id}_${this.hashContent(message.content)}`;
        // Check if this message is already in the queue
        const isDuplicate = this.outgoingQueue.some(existing => {
            const existingKey = `${existing.round}_${existing.from_id}_${this.hashContent(existing.content)}`;
            return existingKey === messageKey;
        });
        if (isDuplicate) {
            if (this.debug) {
                console.log(`[ProtocolManager#${this.instanceId}] [${this.config.partyId?.substring(0, 8)}] 🚫 Skipping duplicate message: Round ${message.round}`);
            }
            return;
        }
        if (this.debug) {
            console.log(`[ProtocolManager#${this.instanceId}] [${this.config.partyId?.substring(0, 8)}] 📤 Queueing message: Round ${message.round}, Content: ${message.content.substring(0, 20)}...`);
        }
        this.outgoingQueue.push(message);
    }
    /**
     * Process queued outgoing messages asynchronously
     */
    processOutgoingQueue() {
        if (this.processingOutgoing || this.outgoingQueue.length === 0) {
            return;
        }
        this.processingOutgoing = true;
        // Process queue asynchronously to avoid blocking current message handling
        setTimeout(async () => {
            try {
                while (this.outgoingQueue.length > 0) {
                    const message = this.outgoingQueue.shift();
                    // Validate message before sending
                    if (!message.group_id || !message.from_id || !message.content) {
                        if (this.debug) {
                            console.warn('[ProtocolManager] Skipping invalid message:', message);
                        }
                        continue;
                    }
                    // Create unique message ID to prevent duplicate processing
                    const messageId = `${message.round}_${message.from_id}_${this.hashContent(message.content)}`;
                    // Skip if already processed
                    if (this.processedMessageIds.has(messageId)) {
                        if (this.debug) {
                            console.log(`[ProtocolManager] [${this.config.partyId?.substring(0, 8)}] 🚫 Skipping already processed message: Round ${message.round}`);
                        }
                        continue;
                    }
                    // Mark as processed
                    this.processedMessageIds.add(messageId);
                    await this.websocketManager.sendMessage(message);
                    // Small delay between messages to prevent overwhelming
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }
            catch (error) {
                console.error('[ProtocolManager] Error processing outgoing queue:', error);
                this.emit('error', error);
            }
            finally {
                this.processingOutgoing = false;
            }
        }, 0);
    }
    /**
     * Get current keygen state
     */
    getKeygenState() {
        if (!this.keygenProcessor) {
            return null;
        }
        return {
            round: this.keygenProcessor.getCurrentRound(),
            isComplete: this.keygenProcessor.isKeygenComplete()
        };
    }
    /**
     * Get current sign state
     */
    getSignState() {
        if (!this.signProcessor) {
            return null;
        }
        return {
            round: this.signProcessor.getCurrentRound(),
            isComplete: this.signProcessor.isSigningComplete()
        };
    }
    /**
     * Clean up resources
     */
    destroy() {
        // Clean up processors
        if (this.keygenProcessor) {
            this.keygenProcessor.destroy();
            this.keygenProcessor = null;
        }
        if (this.signProcessor) {
            this.signProcessor.destroy();
            this.signProcessor = null;
        }
        // Clear outgoing queue
        this.outgoingQueue = [];
        this.processingOutgoing = false;
        // Clear processed message IDs to prevent "already processed" errors in new sessions
        this.processedMessageIds.clear();
        // Disconnect WebSocket
        this.websocketManager.disconnect().catch((error) => {
            if (this.debug) {
                console.warn('[ProtocolManager] Error during WebSocket disconnect:', error);
            }
        });
    }
}
ProtocolManager.instanceCounter = 0;
