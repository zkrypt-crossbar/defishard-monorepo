/**
 * WebSocket Manager for DeFiShArd Extension
 * Handles WebSocket connections, encryption/decryption, and message parsing
 * Compatible with DeFiShArd SDK WebSocket handling
 */

class WebSocketManager {
    constructor(config = {}) {
        this.config = config;
        this.websocket = null;
        this.encryptionKey = null;
        this.cryptoUtils = new CryptoUtils();
        this.messageUtils = new MessageUtils();
        this.eventHandlers = {};
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.connectionTimeout = 10000;
    }

    /**
     * Set encryption key for message encryption/decryption
     * @param {Uint8Array} keyBytes - Raw key bytes
     */
    async setEncryptionKey(keyBytes) {
        try {
            this.encryptionKey = await this.cryptoUtils.importKey(keyBytes);
            console.log('🔐 Encryption key set successfully');
        } catch (error) {
            console.error('❌ Failed to set encryption key:', error);
            throw error;
        }
    }

    /**
     * Connect to WebSocket server
     * @param {string} groupId - Group ID
     * @param {string} apiToken - API token for authentication
     * @param {string} protocol - Protocol type (keygen, sign)
     * @returns {Promise<void>}
     */
    async connect(groupId, apiToken, protocol = 'keygen') {
        if (!groupId || !apiToken) {
            throw new Error('Missing required parameters: groupId and apiToken');
        }

        if (this.isConnected) {
            console.log('🔌 Already connected, disconnecting first...');
            this.disconnect();
        }

        const wsUrl = this.buildWebSocketUrl(groupId, apiToken, protocol);
        console.log('🔌 Connecting to WebSocket:', wsUrl);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, this.connectionTimeout);

            try {
                this.websocket = new WebSocket(wsUrl);

                this.websocket.onopen = () => {
                    clearTimeout(timeout);
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    console.log('✅ WebSocket connected successfully');
                    this.emit('websocket:connected');
                    resolve();
                };

                this.websocket.onmessage = (event) => {
                    console.log('📨 WebSocket message received:', event.data);
                    this.handleRawMessage(event.data);
                };

                this.websocket.onclose = (event) => {
                    clearTimeout(timeout);
                    this.isConnected = false;
                    console.log('🔌 WebSocket closed:', event.code, event.reason);
                    this.emit('websocket:disconnected', event);
                    
                    // Attempt reconnection if not a normal closure
                    if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.attemptReconnect(groupId, apiToken, protocol);
                    }
                };

                this.websocket.onerror = (error) => {
                    clearTimeout(timeout);
                    console.error('❌ WebSocket error:', error);
                    this.emit('websocket:error', error);
                    reject(error);
                };

            } catch (error) {
                clearTimeout(timeout);
                console.error('❌ Failed to create WebSocket:', error);
                reject(error);
            }
        });
    }

    /**
     * Build WebSocket URL
     * @param {string} groupId - Group ID
     * @param {string} apiToken - API token
     * @param {string} protocol - Protocol type
     * @returns {string} WebSocket URL
     */
    buildWebSocketUrl(groupId, apiToken, protocol) {
        const baseUrl = this.config.relayerUrl || 'ws://localhost:3000';
        const wsUrl = baseUrl.replace('http', 'ws');
        return `${wsUrl}/ws/${groupId}/${protocol}?token=${encodeURIComponent(apiToken)}`;
    }

    /**
     * Attempt to reconnect to WebSocket
     * @param {string} groupId - Group ID
     * @param {string} apiToken - API token
     * @param {string} protocol - Protocol type
     */
    async attemptReconnect(groupId, apiToken, protocol) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        console.log(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        
        setTimeout(async () => {
            try {
                await this.connect(groupId, apiToken, protocol);
            } catch (error) {
                console.error('❌ Reconnection failed:', error);
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.attemptReconnect(groupId, apiToken, protocol);
                }
            }
        }, delay);
    }

    /**
     * Disconnect from WebSocket
     */
    disconnect() {
        if (this.websocket) {
            this.websocket.close(1000, 'Normal closure');
            this.websocket = null;
        }
        this.isConnected = false;
        console.log('🔌 WebSocket disconnected');
    }

    /**
     * Send message through WebSocket
     * @param {Object} message - Message to send
     */
    async sendMessage(message) {
        if (!this.isConnected || !this.websocket) {
            throw new Error('WebSocket not connected');
        }

        try {
            let messageToSend = message;

            // Encrypt message content if needed
            if (this.messageUtils.shouldEncryptMessage(message) && this.encryptionKey) {
                messageToSend = await this.encryptMessage(message);
            }

            const messageStr = JSON.stringify(messageToSend);
            console.log('📤 Sending message:', messageStr);
            
            this.websocket.send(messageStr);
            this.emit('message:sent', message);
        } catch (error) {
            console.error('❌ Failed to send message:', error);
            this.emit('message:error', error);
            throw error;
        }
    }

    /**
     * Encrypt message content
     * @param {Object} message - Message to encrypt
     * @returns {Object} Encrypted message
     */
    async encryptMessage(message) {
        if (!this.encryptionKey) {
            throw new Error('Encryption key not set');
        }

        const { encrypted, iv } = await this.cryptoUtils.encrypt(message.content, this.encryptionKey);
        const encryptedContent = this.cryptoUtils.bytesToBase64(encrypted);
        const ivBase64 = this.cryptoUtils.bytesToBase64(iv);

        return {
            ...message,
            content: encryptedContent,
            iv: ivBase64
        };
    }

    /**
     * Handle raw WebSocket message
     * @param {string} data - Raw message data
     */
    async handleRawMessage(data) {
        try {
            const message = JSON.parse(data);
            console.log('📨 Parsed message:', message);

            // Decrypt message content if needed
            if (message.iv && this.encryptionKey) {
                message.content = await this.decryptMessageContent(message);
            }

            // Validate message format
            if (!this.messageUtils.validateProtocolMessage(message)) {
                console.error('❌ Invalid message format:', message);
                this.emit('message:invalid', message);
                return;
            }

            // Emit parsed message event
            this.emit('message', message);
            this.handleParsedMessage(message);

        } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error);
            this.emit('message:error', error);
        }
    }

    /**
     * Decrypt message content
     * @param {Object} message - Message with encrypted content
     * @returns {string} Decrypted content
     */
    async decryptMessageContent(message) {
        if (!this.encryptionKey || !message.iv) {
            return message.content;
        }

        try {
            const encryptedBytes = this.cryptoUtils.base64ToBytes(message.content);
            const ivBytes = this.cryptoUtils.base64ToBytes(message.iv);
            const decryptedBytes = await this.cryptoUtils.decrypt(encryptedBytes, this.encryptionKey, ivBytes);
            return this.cryptoUtils.bytesToBase64(decryptedBytes);
        } catch (error) {
            console.error('❌ Failed to decrypt message content:', error);
            throw error;
        }
    }

    /**
     * Handle parsed message (following web app pattern)
     * @param {Object} message - Parsed and validated message
     */
    handleParsedMessage(message) {
        // Validate message to prevent loops
        if (this.isLoopMessage(message)) {
            console.log('🔄 Ignoring loop message:', message);
            return;
        }

        // Emit message for processing by ProtocolManager
        this.emit('parsed:message', message);
    }

    /**
     * Check if message is a loop (sent by this party)
     * @param {Object} message - Message to check
     * @returns {boolean}
     */
    isLoopMessage(message) {
        // This will be implemented when we have party ID tracking
        return false;
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
     * Get connection status
     * @returns {Object} Connection status
     */
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSocketManager;
} else {
    // Browser/extension environment
    window.WebSocketManager = WebSocketManager;
}
