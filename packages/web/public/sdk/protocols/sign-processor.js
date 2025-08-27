import { SignSession, Message } from '../../pkg/dkls_wasm_ll.js';
import { BaseProcessor } from './base-processor';
export class SignProcessor extends BaseProcessor {
    constructor(config) {
        super(config);
        this.session = null;
        this.partialSignature = null;
        this.finalSignature = null;
        this.signConfig = config;
    }
    /**
     * Initialize the sign session
     */
    async initialize() {
        try {
            this.session = new SignSession(this.signConfig.keyShare, this.signConfig.derivationPath || 'm', undefined);
            this.currentRound = -1;
        }
        catch (error) {
            this.emit('error', new Error(`Failed to initialize signing: ${error}`));
            throw error;
        }
    }
    /**
     * Handle start round (round 0)
     */
    async handleStartRound() {
        if (!this.session) {
            throw new Error('Session not initialized');
        }
        try {
            // Creating first message
            const firstMessage = this.session.createFirstMessage(this.signConfig.messageHash);
            const protocolMessage = this.convertToProtocolMessage(firstMessage, 1);
            // Move to round 1 to receive messages from other parties
            this.currentRound = 1;
            this.roundStates.set(1, { messages: [], processed: false, emitted: false });
            // Emit round-complete event
            const roundState = this.roundStates.get(0);
            if (!roundState.emitted) {
                roundState.emitted = true;
                // First message created
                this.emit('round-complete', 0, [protocolMessage]);
            }
            return [protocolMessage];
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Process a complete round
     */
    async processRound(round, messages) {
        if (!this.session) {
            throw new Error('Session not initialized');
        }
        const roundState = this.roundStates.get(round);
        try {
            // Apply filtering based on round
            // Rounds 1,4: broadcast messages (include all except from us)
            // Rounds 2,3: point-to-point messages (only include messages sent to us)
            const onlyToUs = !(round === 1 || round === 4);
            const filteredMessages = this.filterMessagesForWasm(messages, onlyToUs);
            // Convert protocol messages to WASM messages
            const wasmMessages = filteredMessages.map(msg => this.convertToWasmMessage(msg));
            // Process messages through WASM (skip for Round 4 - it has special handling)
            let responseMessages = [];
            if (round !== 4) {
                try {
                    responseMessages = this.session.handleMessages(wasmMessages);
                }
                catch (error) {
                    const errorMessage = `WASM processing failed in round ${round}: ${error}`;
                    this.emit('error', new Error(errorMessage));
                    throw error;
                }
            }
            // Convert WASM responses to protocol messages
            const protocolResponses = responseMessages.map(msg => this.convertToProtocolMessage(msg, round + 1));
            // Handle round 3: create partial signature
            if (round === 3) {
                try {
                    const partialSignature = this.session.lastMessage(this.signConfig.messageHash);
                    this.partialSignature = partialSignature;
                    const protocolMessage = this.convertToProtocolMessage(partialSignature, round + 1);
                    // Move to next round (Round 4)
                    this.currentRound = round + 1;
                    this.roundStates.set(this.currentRound, {
                        messages: [],
                        processed: false,
                        emitted: false
                    });
                    // Emit round complete event
                    if (!roundState.emitted) {
                        roundState.emitted = true;
                        this.emit('round-complete', round, [protocolMessage]);
                    }
                    roundState.processed = true;
                    return [protocolMessage];
                }
                catch (error) {
                    if (this.debug)
                        console.error(`[SignProcessor] ❌ Round 3: Error creating partial signature:`, error);
                    throw new Error(`Failed to create partial signature in round 3: ${error}`);
                }
            }
            // Handle round 4: combine signatures and send DONE message
            if (round === 4) {
                try {
                    if (!this.partialSignature) {
                        throw new Error('Partial signature from round 3 not found');
                    }
                    // Convert incoming partial signatures to WASM messages
                    const otherPartialSignatures = filteredMessages.map(msg => this.convertToWasmMessage(msg));
                    // All parties should combine signatures to get the final result
                    // Our own partial signature is handled internally by the WASM session
                    const finalSignature = this.session.combine(otherPartialSignatures);
                    // Store the final signature until END message is received from server
                    this.finalSignature = finalSignature;
                    // Send DONE message to server (unencrypted status message)
                    const doneMessage = {
                        group_id: this.config.groupId,
                        from_id: this.config.partyId,
                        to_id: '00000000000000000000000000000000000000000000000000000000000000000000', // Server ID - triggers no encryption
                        content: 'DONE',
                        round: 5,
                        timestamp: new Date().toISOString()
                    };
                    // Emit round complete event with DONE message
                    if (!roundState.emitted) {
                        roundState.emitted = true;
                        this.emit('round-complete', round, [doneMessage]);
                    }
                    roundState.processed = true;
                    // Don't move to round 5 - wait for END message from server
                    this.currentRound = 4; // Stay in round 4 until server sends END
                    return [doneMessage];
                }
                catch (error) {
                    const errorMessage = `Failed to complete signing in round ${round}: ${error}`;
                    this.emit('error', new Error(errorMessage));
                    throw error;
                }
            }
            // Round 5 is deprecated - server handles completion
            if (round === 5) {
                roundState.processed = true;
                return [];
            }
            // Move to next round
            this.currentRound = round + 1;
            this.roundStates.set(this.currentRound, {
                messages: [],
                processed: false,
                emitted: false
            });
            // Emit round complete event
            if (!roundState.emitted) {
                roundState.emitted = true;
                this.emit('round-complete', round, protocolResponses);
            }
            roundState.processed = true;
            return protocolResponses;
        }
        catch (error) {
            const errorMessage = `Failed to process round ${round}: ${error}`;
            this.emit('error', new Error(errorMessage));
            throw error;
        }
    }
    /**
     * Filter messages for WASM processing
     * @param messages - Protocol messages to filter
     * @param onlyToUs - If true, only include messages sent to us (rounds 2,3), if false include all except from us (rounds 1,4)
     */
    filterMessagesForWasm(messages, onlyToUs) {
        return messages.filter(msg => {
            const fromIndex = this.config.groupInfo.members.findIndex(m => m.partyId === msg.from_id);
            // Always exclude messages from ourselves
            if (fromIndex === this.config.partyIndex) {
                return false;
            }
            // If onlyToUs is true, also check if message is addressed to us
            if (onlyToUs) {
                const toIndex = msg.to_id === '0' ? undefined :
                    this.config.groupInfo.members.findIndex(m => m.partyId === msg.to_id);
                return toIndex === this.config.partyIndex || msg.to_id === '0';
            }
            return true;
        });
    }
    /**
     * Get expected message count for a round
     */
    getExpectedMessageCount(round) {
        const threshold = this.config.groupInfo.threshold;
        switch (round) {
            case 1: // Round 1: broadcast messages from threshold parties except self
            case 2: // Round 2: point-to-point messages from threshold parties except self
            case 3: // Round 3: point-to-point messages from threshold parties except self
            case 4: // Round 4: broadcast messages from threshold parties except self
                return threshold - 1;
            case 5: // Round 5: deprecated - server handles completion
                return 0;
            default:
                return 0;
        }
    }
    /**
     * Get processor name for logging
     */
    getProcessorName() {
        return 'SignProcessor';
    }
    /**
     * Get process name for logging
     */
    getProcessName() {
        return 'signing';
    }
    /**
     * Get WASM message class
     */
    getWasmMessageClass() {
        return Message;
    }
    /**
     * Check if signing is complete
     */
    isSigningComplete() {
        return this.isComplete;
    }
    /**
     * Check if processor is still active (can process messages)
     */
    isActive() {
        return !this.isComplete;
    }
    /**
     * Get the session for debugging
     */
    getSession() {
        return this.session;
    }
    /**
     * Override processMessage to handle END message completion from server
     */
    async processMessage(message) {
        // Handle END messages from server (with status codes)
        if (message.content.startsWith('END:') && message.from_id === '00000000000000000000000000000000000000000000000000000000000000000000') {
            // Only process END messages if we've already started (currentRound >= 0)
            if (this.currentRound >= 0) {
                const status = message.content.split(':')[1];
                // Mark as complete regardless of status
                this.isComplete = true;
                // Emit completion event with status
                if (this.finalSignature) {
                    this.emit('signing-complete', this.finalSignature);
                    this.finalSignature = null; // Clear it after emission
                }
                // Emit status event for error handling
                if (status !== 'SUCCESS') {
                    this.emit('error', new Error(`Signing process ended with status: ${status}`));
                }
                return [];
            }
            else {
                // Old END message from previous session, ignore it
                return [];
            }
        }
        // For all other messages, use the parent implementation
        return super.processMessage(message);
    }
    /**
     * Clean up resources
     */
    destroy() {
        // Clear partial signature
        this.partialSignature = null;
        // Nullify session
        this.session = null;
        // Call parent destroy
        super.destroy();
    }
}
