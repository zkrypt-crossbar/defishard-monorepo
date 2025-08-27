/**
 * Base Processor for DeFiShArd Extension
 * Handles common message processing logic including deduplication and round management
 * Compatible with DeFiShArd SDK BaseProcessor
 */

class BaseProcessor {
    constructor(protocolManager, session = null) {
        this.protocolManager = protocolManager;
        this.session = session;
        this.messagesByRound = new Map();
        this.processedMessages = new Set();
        this.eventHandlers = {};
        this.currentRound = 0;
        this.totalRounds = 0;
        this.partyId = null;
        this.groupId = null;
    }

    /**
     * Set session information
     * @param {Object} session - Session object
     */
    setSession(session) {
        this.session = session;
        if (session) {
            this.partyId = session.partyId;
            this.groupId = session.groupId;
            this.totalRounds = session.totalRounds || 0;
        }
    }

    /**
     * Process incoming message
     * @param {Object} message - Protocol message to process
     */
    processMessage(message) {
        try {
            console.log(`📨 Processing message for round ${message.round}:`, message);

            // Generate unique message ID for deduplication
            const messageId = this.generateMessageId(message);

            // Check for duplicate messages
            if (this.processedMessages.has(messageId)) {
                console.log('🔄 Duplicate message ignored:', messageId);
                return;
            }

            // Mark message as processed
            this.processedMessages.add(messageId);

            // Store message by round
            this.storeMessage(message);

            // Check if round is complete
            if (this.isRoundComplete(message.round)) {
                console.log(`✅ Round ${message.round} complete, processing...`);
                this.processRound(message.round);
            }

        } catch (error) {
            console.error('❌ Error processing message:', error);
            this.emit('error', error);
        }
    }

    /**
     * Store message by round
     * @param {Object} message - Message to store
     */
    storeMessage(message) {
        const round = message.round;
        
        if (!this.messagesByRound.has(round)) {
            this.messagesByRound.set(round, []);
        }

        const roundMessages = this.messagesByRound.get(round);
        roundMessages.push(message);

        console.log(`💾 Stored message for round ${round}, total: ${roundMessages.length}`);
    }

    /**
     * Check if round is complete
     * @param {number} round - Round number to check
     * @returns {boolean}
     */
    isRoundComplete(round) {
        const roundMessages = this.messagesByRound.get(round);
        if (!roundMessages) {
            return false;
        }

        // Get unique senders for this round
        const senders = new Set(roundMessages.map(msg => msg.from_id));
        
        // For now, assume round is complete if we have at least 2 messages
        // In a real implementation, this would check against expected participants
        const isComplete = senders.size >= 2;
        
        console.log(`🔍 Round ${round} status: ${senders.size} senders, complete: ${isComplete}`);
        
        return isComplete;
    }

    /**
     * Process a complete round
     * @param {number} round - Round number to process
     */
    async processRound(round) {
        try {
            console.log(`🔄 Processing round ${round}...`);
            
            const roundMessages = this.messagesByRound.get(round);
            if (!roundMessages || roundMessages.length === 0) {
                console.warn(`⚠️ No messages found for round ${round}`);
                return;
            }

            // Convert protocol messages to WASM format
            const wasmMessages = await this.convertMessagesToWasm(roundMessages);

            // Process with WASM session if available
            if (this.session && typeof this.session.handleMessages === 'function') {
                console.log(`🧮 Processing ${wasmMessages.length} messages with WASM...`);
                const responses = await this.session.handleMessages(wasmMessages);
                
                // Convert responses back to protocol messages and queue them
                await this.queueResponses(responses, round + 1);
            } else {
                console.log('⚠️ No WASM session available, using fallback processing');
                await this.fallbackRoundProcessing(roundMessages, round);
            }

            // Emit round completion event
            this.emit('round:complete', { round, messageCount: roundMessages.length });

        } catch (error) {
            console.error(`❌ Error processing round ${round}:`, error);
            this.emit('round:error', { round, error });
        }
    }

    /**
     * Convert protocol messages to WASM format
     * @param {Array} protocolMessages - Array of protocol messages
     * @returns {Array} Array of WASM messages
     */
    async convertMessagesToWasm(protocolMessages) {
        const wasmMessages = [];

        for (const protocolMessage of protocolMessages) {
            try {
                // Decrypt content if needed
                let content = protocolMessage.content;
                if (this.protocolManager.websocketManager.encryptionKey) {
                    const decryptedBytes = this.protocolManager.websocketManager.cryptoUtils.base64ToBytes(content);
                    content = this.protocolManager.websocketManager.cryptoUtils.bytesToBase64(decryptedBytes);
                }

                const wasmMessage = {
                    payload: this.protocolManager.websocketManager.cryptoUtils.base64ToBytes(content),
                    fromId: this.parsePartyId(protocolMessage.from_id),
                    toId: protocolMessage.to_id === '0' ? undefined : this.parsePartyId(protocolMessage.to_id)
                };

                wasmMessages.push(wasmMessage);
            } catch (error) {
                console.error('❌ Error converting message to WASM format:', error);
            }
        }

        return wasmMessages;
    }

    /**
     * Queue responses for sending
     * @param {Array} responses - Array of WASM response messages
     * @param {number} round - Target round number
     */
    async queueResponses(responses, round) {
        console.log(`📤 Queueing ${responses.length} responses for round ${round}`);

        for (const wasmResponse of responses) {
            try {
                // Convert WASM response to protocol message
                const encryptedContent = this.protocolManager.websocketManager.cryptoUtils.bytesToBase64(wasmResponse.payload);
                
                const protocolMessage = {
                    group_id: this.groupId,
                    from_id: this.partyId,
                    to_id: wasmResponse.toId ? this.formatPartyId(wasmResponse.toId) : '0',
                    content: encryptedContent,
                    round: round,
                    timestamp: new Date().toISOString()
                };

                // Queue message for sending
                this.protocolManager.queueMessage(protocolMessage);

            } catch (error) {
                console.error('❌ Error queueing response:', error);
            }
        }
    }

    /**
     * Fallback round processing (when WASM is not available)
     * @param {Array} roundMessages - Messages for the round
     * @param {number} round - Round number
     */
    async fallbackRoundProcessing(roundMessages, round) {
        console.log(`🔄 Fallback processing for round ${round} with ${roundMessages.length} messages`);

        // Simple echo response for testing
        const response = {
            group_id: this.groupId,
            from_id: this.partyId,
            to_id: '0', // Broadcast
            content: btoa(JSON.stringify({ echo: true, round: round })),
            round: round + 1,
            timestamp: new Date().toISOString()
        };

        this.protocolManager.queueMessage(response);
    }

    /**
     * Parse party ID to numeric index
     * @param {string} partyId - Party ID string
     * @returns {number} Party index
     */
    parsePartyId(partyId) {
        let hash = 0;
        for (let i = 0; i < partyId.length; i++) {
            const char = partyId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash) % 256;
    }

    /**
     * Format party index to party ID
     * @param {number} partyIndex - Party index
     * @returns {string} Party ID
     */
    formatPartyId(partyIndex) {
        return `party_${partyIndex}`;
    }

    /**
     * Generate unique message ID for deduplication
     * @param {Object} message - Message object
     * @returns {string} Unique message ID
     */
    generateMessageId(message) {
        const data = `${message.group_id}:${message.from_id}:${message.round}:${message.timestamp}`;
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    /**
     * Start a new round
     * @param {number} round - Round number to start
     */
    startRound(round) {
        console.log(`🎯 Starting round ${round}`);
        this.currentRound = round;
        
        // Clear previous round messages if they exist
        if (this.messagesByRound.has(round - 1)) {
            this.messagesByRound.delete(round - 1);
        }

        this.emit('round:start', { round });
    }

    /**
     * Get messages for a specific round
     * @param {number} round - Round number
     * @returns {Array} Array of messages for the round
     */
    getRoundMessages(round) {
        return this.messagesByRound.get(round) || [];
    }

    /**
     * Clear all messages and processed state
     */
    clear() {
        this.messagesByRound.clear();
        this.processedMessages.clear();
        this.currentRound = 0;
        console.log('🧹 Cleared all message state');
    }

    /**
     * Event system
     */
    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
    }

    off(event, handler) {
        if (this.eventHandlers[event]) {
            const index = this.eventHandlers[event].indexOf(handler);
            if (index > -1) {
                this.eventHandlers[event].splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`❌ Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Get processor status
     * @returns {Object} Processor status
     */
    getStatus() {
        return {
            currentRound: this.currentRound,
            totalRounds: this.totalRounds,
            partyId: this.partyId,
            groupId: this.groupId,
            messageCount: this.processedMessages.size,
            roundMessageCounts: Array.from(this.messagesByRound.entries()).map(([round, messages]) => ({
                round,
                count: messages.length
            }))
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseProcessor;
} else {
    // Browser/extension environment
    window.BaseProcessor = BaseProcessor;
}
