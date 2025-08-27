/**
 * Message utilities for DeFiShArd protocol messages
 * Handles message validation, format conversion, and parsing
 */

class MessageUtils {
    constructor() {
        this.supportedProtocols = ['keygen', 'sign'];
        this.messageTypes = ['keygen_start', 'keygen_round', 'keygen_complete', 'error'];
    }

    /**
     * Validate protocol message format
     * @param {Object} message - Message to validate
     * @returns {boolean}
     */
    validateProtocolMessage(message) {
        if (!message || typeof message !== 'object') {
            return false;
        }

        const requiredFields = ['group_id', 'from_id', 'to_id', 'content', 'round', 'timestamp'];
        
        for (const field of requiredFields) {
            if (!(field in message)) {
                console.error(`Missing required field: ${field}`);
                return false;
            }
        }

        // Validate field types
        if (typeof message.group_id !== 'string' || message.group_id.length === 0) {
            console.error('Invalid group_id');
            return false;
        }

        if (typeof message.from_id !== 'string' || message.from_id.length === 0) {
            console.error('Invalid from_id');
            return false;
        }

        if (typeof message.to_id !== 'string') {
            console.error('Invalid to_id');
            return false;
        }

        if (typeof message.content !== 'string') {
            console.error('Invalid content');
            return false;
        }

        if (typeof message.round !== 'number' || message.round < 0) {
            console.error('Invalid round');
            return false;
        }

        if (typeof message.timestamp !== 'string' || !this.isValidTimestamp(message.timestamp)) {
            console.error('Invalid timestamp');
            return false;
        }

        return true;
    }

    /**
     * Validate WASM message format
     * @param {Object} message - WASM message to validate
     * @returns {boolean}
     */
    validateWasmMessage(message) {
        if (!message || typeof message !== 'object') {
            return false;
        }

        if (!('payload' in message) || !(message.payload instanceof Uint8Array)) {
            console.error('Invalid payload');
            return false;
        }

        if (!('fromId' in message) || typeof message.fromId !== 'number') {
            console.error('Invalid fromId');
            return false;
        }

        // toId is optional for broadcast messages
        if ('toId' in message && typeof message.toId !== 'number') {
            console.error('Invalid toId');
            return false;
        }

        return true;
    }

    /**
     * Convert protocol message to WASM message format
     * @param {Object} protocolMessage - Protocol message
     * @param {Uint8Array} decryptedContent - Decrypted content
     * @returns {Object} WASM message
     */
    convertToWasmMessage(protocolMessage, decryptedContent) {
        return {
            payload: decryptedContent,
            fromId: this.parsePartyId(protocolMessage.from_id),
            toId: protocolMessage.to_id === '0' ? undefined : this.parsePartyId(protocolMessage.to_id)
        };
    }

    /**
     * Convert WASM message to protocol message format
     * @param {Object} wasmMessage - WASM message
     * @param {string} groupId - Group ID
     * @param {string} fromId - Sender party ID
     * @param {number} round - Current round
     * @param {string} encryptedContent - Encrypted content
     * @returns {Object} Protocol message
     */
    convertToProtocolMessage(wasmMessage, groupId, fromId, round, encryptedContent) {
        return {
            group_id: groupId,
            from_id: fromId,
            to_id: wasmMessage.toId ? this.formatPartyId(wasmMessage.toId) : '0',
            content: encryptedContent,
            round: round,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Parse party ID to numeric index
     * @param {string} partyId - Party ID string
     * @returns {number} Party index
     */
    parsePartyId(partyId) {
        // For now, use a simple hash-based approach
        // In a real implementation, this would map to actual party indices
        let hash = 0;
        for (let i = 0; i < partyId.length; i++) {
            const char = partyId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash) % 256; // Return 0-255 range
    }

    /**
     * Format party index to party ID
     * @param {number} partyIndex - Party index
     * @returns {string} Party ID
     */
    formatPartyId(partyIndex) {
        // For now, use a simple format
        // In a real implementation, this would map to actual party IDs
        return `party_${partyIndex}`;
    }

    /**
     * Validate timestamp format
     * @param {string} timestamp - ISO timestamp string
     * @returns {boolean}
     */
    isValidTimestamp(timestamp) {
        const date = new Date(timestamp);
        return !isNaN(date.getTime());
    }

    /**
     * Create a join group message
     * @param {string} groupId - Group ID
     * @param {string} partyId - Party ID
     * @returns {Object} Join group message
     */
    createJoinGroupMessage(groupId, partyId) {
        return {
            type: 'join_group',
            group_id: groupId,
            party_id: partyId,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Create a keygen start message
     * @param {string} groupId - Group ID
     * @param {string} partyId - Party ID
     * @param {boolean} isCreator - Whether this party is the creator
     * @returns {Object} Keygen start message
     */
    createKeygenStartMessage(groupId, partyId, isCreator = false) {
        return {
            type: 'keygen_start',
            group_id: groupId,
            party_id: partyId,
            is_creator: isCreator,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Create a round message
     * @param {string} groupId - Group ID
     * @param {string} fromId - Sender party ID
     * @param {string} toId - Target party ID ('0' for broadcast)
     * @param {number} round - Round number
     * @param {string} content - Encrypted content
     * @returns {Object} Round message
     */
    createRoundMessage(groupId, fromId, toId, round, content) {
        return {
            group_id: groupId,
            from_id: fromId,
            to_id: toId,
            content: content,
            round: round,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Create an error message
     * @param {string} groupId - Group ID
     * @param {string} partyId - Party ID
     * @param {string} error - Error message
     * @returns {Object} Error message
     */
    createErrorMessage(groupId, partyId, error) {
        return {
            type: 'error',
            group_id: groupId,
            party_id: partyId,
            error: error,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Check if message should be encrypted
     * @param {Object} message - Message to check
     * @returns {boolean}
     */
    shouldEncryptMessage(message) {
        // Don't encrypt control messages
        const controlTypes = ['join_group', 'keygen_start', 'error'];
        return !controlTypes.includes(message.type);
    }

    /**
     * Generate unique message ID
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MessageUtils;
} else {
    // Browser/extension environment
    window.MessageUtils = MessageUtils;
}
