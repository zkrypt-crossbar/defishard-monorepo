import { EventEmitter } from '../events';
/**
 * Base processor class containing common functionality for both keygen and sign processors
 */
export class BaseProcessor extends EventEmitter {
    constructor(config) {
        super();
        this.currentRound = 0;
        this.isComplete = false;
        this.roundStates = new Map();
        this.receivedMessageHashes = new Set();
        this.config = config;
        this.debug = config.debug ?? false;
    }
    /**
     * Process incoming protocol message
     */
    async processMessage(message) {
        if (this.isComplete) {
            if (this.debug) {
                console.log(`[BaseProcessor] Processor already complete, ignoring message from round ${message.round}`);
            }
            return [];
        }
        try {
            // Handle START message
            if (message.round === 0 && (message.content === 'start' || message.content === 'START')) {
                // Start message received
                return await this.startRound(0);
            }
            // Handle END message from server (new format with status codes)
            if (message.content.startsWith('END:') && message.from_id === '00000000000000000000000000000000000000000000000000000000000000000000') {
                // Only process END messages if we've already started (currentRound >= 0)
                if (this.currentRound >= 0) {
                    // END message from server - let specific processors handle it
                    return [];
                }
                else {
                    // Old END message from previous session, ignore it
                    return [];
                }
            }
            // Handle old END message format (for backward compatibility)
            if (message.content === 'end') {
                // Only process END messages if we've already started (currentRound >= 0)
                if (this.currentRound >= 0) {
                    // Old END message format - let specific processors handle it
                    return [];
                }
                else {
                    // Old END message from previous session, ignore it
                    return [];
                }
            }
            // If not started yet, ignore other messages
            if (this.currentRound === -1) {
                return [];
            }
            // Only process protocol messages (not START/END) in rounds 1+
            if (message.round === 0) {
                return [];
            }
            // Ignore messages from ourselves
            if (message.from_id === this.config.partyId) {
                return [];
            }
            // Message deduplication
            const messageHash = this.hashMessage(message);
            if (this.receivedMessageHashes.has(messageHash)) {
                // Duplicate message ignored
                return [];
            }
            this.receivedMessageHashes.add(messageHash);
            // Store message for the message's round
            const messageRound = message.round;
            if (!this.roundStates.has(messageRound)) {
                this.roundStates.set(messageRound, { messages: [], processed: false, emitted: false });
            }
            this.roundStates.get(messageRound).messages.push(message);
            // Check if round is ready to be processed
            const roundState = this.roundStates.get(messageRound);
            if (roundState && !roundState.processed) {
                const expectedMessages = this.getExpectedMessageCount(messageRound);
                if (roundState.messages.length >= expectedMessages) {
                    // Set processed flag to prevent race conditions
                    roundState.processed = true;
                    try {
                        return await this.processRound(messageRound, roundState.messages);
                    }
                    catch (error) {
                        // Reset processed flag on error so we can retry
                        roundState.processed = false;
                        throw error;
                    }
                }
            }
            return [];
        }
        catch (error) {
            this.emit('error', new Error(`Failed to process message: ${error}`));
            throw error;
        }
    }
    /**
     * Start a new round
     */
    async startRound(round) {
        this.currentRound = round;
        this.roundStates.set(round, {
            messages: [],
            processed: false,
            emitted: false
        });
        if (round === 0) {
            return await this.handleStartRound();
        }
        return [];
    }
    /**
     * Filter messages (exclude messages from self)
     */
    filterMessages(messages) {
        return messages.filter(msg => msg.from_id !== this.config.partyId);
    }
    /**
     * Select messages sent to us specifically
     */
    selectMessages(messages) {
        return messages.filter(msg => msg.from_id !== this.config.partyId &&
            (msg.to_id === this.config.partyId || msg.to_id === '0'));
    }
    /**
     * Convert WASM message to protocol message
     */
    convertToProtocolMessage(wasmMessage, round) {
        // Handle message routing based on round and to_id
        let to_id;
        if (wasmMessage.to_id === undefined) {
            // If to_id is undefined, this is a broadcast message to all parties
            to_id = '0';
        }
        else {
            // Validate that the to_id index is within bounds
            if (wasmMessage.to_id >= this.config.groupInfo.members.length) {
                throw new Error(`Invalid message from WASM: to_id index ${wasmMessage.to_id} is out of bounds for group with ${this.config.groupInfo.members.length} members.`);
            }
            to_id = this.config.groupInfo.members[wasmMessage.to_id].partyId;
        }
        const message = {
            group_id: this.config.groupId,
            from_id: this.config.partyId,
            to_id,
            content: this.bytesToBase64(wasmMessage.payload),
            round,
            timestamp: new Date().toISOString()
        };
        return message;
    }
    /**
     * Convert protocol message to WASM message
     */
    convertToWasmMessage(protocolMessage) {
        const payload = this.base64ToBytes(protocolMessage.content);
        const fromId = this.config.groupInfo.members.findIndex(m => m.partyId === protocolMessage.from_id);
        const toId = protocolMessage.to_id === '0' ? undefined :
            this.config.groupInfo.members.findIndex(m => m.partyId === protocolMessage.to_id);
        if (fromId === -1) {
            throw new Error(`Invalid from_id in protocol message: ${protocolMessage.from_id}`);
        }
        return new (this.getWasmMessageClass())(new Uint8Array(payload), fromId, toId !== -1 ? toId : undefined);
    }
    /**
     * Hash message for deduplication
     */
    hashMessage(message) {
        let hash = 0;
        const str = `${message.from_id}:${message.to_id}:${message.round}:${message.content}`;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash;
    }
    /**
     * Utility functions
     */
    bytesToBase64(bytes) {
        return btoa(String.fromCharCode(...bytes));
    }
    base64ToBytes(base64) {
        const binary = atob(base64);
        return new Uint8Array(binary.split('').map(char => char.charCodeAt(0)));
    }
    hexToBytes(hex) {
        return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    }
    /**
     * Get current state
     */
    getCurrentRound() {
        return this.currentRound;
    }
    isProcessComplete() {
        return this.isComplete;
    }
    /**
     * Clean up resources
     */
    destroy() {
        if (this.debug)
            console.log(`[${this.getProcessorName()}] 🧹 Cleaning up ${this.getProcessName()} processor`);
        // Clear data structures
        this.roundStates.clear();
        this.receivedMessageHashes.clear();
        // Remove all event listeners
        this.removeAllListeners();
    }
}
