import { EventEmitter } from './events';
export class WebSocketManager extends EventEmitter {
    constructor(websocketUrl, debug = false) {
        super();
        this.websocketUrl = websocketUrl;
        this.ws = null;
        this.isConnecting = false;
        this.messageQueue = [];
        this.MAX_QUEUE_SIZE = 100; // Prevent unbounded memory growth
        this.connectionParams = null;
        this.ownPartyId = null; // Track our own party ID for loop prevention
        // Encryption state
        this.cryptoKey = null;
        this.isEncrypting = false; // Guard against recursive encryption
        this.IV_LENGTH = 12;
        this.debug = debug;
    }
    /**
     * Connect to the WebSocket server
     */
    async connect(groupId, protocol, apiKey) {
        if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
            return;
        }
        this.isConnecting = true;
        this.connectionParams = { groupId, protocol, apiKey };
        try {
            // Use the same URL format as Rust client: {websocket_url}/ws/{group_id}/{protocol}
            // Backend now supports Bearer token in URL query parameter
            const url = `${this.websocketUrl}/ws/${groupId}/${protocol}?token=${encodeURIComponent(apiKey)}`;
            this.ws = new WebSocket(url);
            // Add connection timeout
            const timeout = setTimeout(() => {
                if (this.ws) {
                    this.ws.close();
                    this.isConnecting = false;
                    throw new Error('Connection timeout after 10 seconds');
                }
            }, 10000);
            this.ws.onopen = () => {
                clearTimeout(timeout);
                this.isConnecting = false;
                if (this.debug) {
                    console.log(`[WebSocket] 🔌 Connected to ${url}`);
                }
                this.emit('connected');
                // Send queued messages
                this.flushMessageQueue();
            };
            this.ws.onmessage = (event) => {
                try {
                    if (typeof event.data === 'string') {
                        const data = JSON.parse(event.data);
                        this.handleParsedMessage(data).catch(error => {
                            console.error('Failed to handle message:', error);
                        });
                    }
                    else {
                        console.error('Unsupported message data type:', typeof event.data);
                    }
                }
                catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };
            this.ws.onclose = (event) => {
                clearTimeout(timeout);
                this.isConnecting = false;
                this.emit('disconnected');
                // Reconnect logic disabled for simplicity
            };
            this.ws.onerror = (error) => {
                clearTimeout(timeout);
                this.isConnecting = false;
                this.emit('error', error);
            };
        }
        catch (error) {
            this.isConnecting = false;
            throw new Error(`Failed to connect to WebSocket: ${error}`);
        }
    }
    /**
     * Send a message via WebSocket
     */
    async sendMessage(message) {
        // Create a copy of the message to avoid modifying the original
        const messageToSend = { ...message };
        // Encrypt content if encryption is enabled
        if (this.shouldEncryptMessage(messageToSend)) {
            try {
                messageToSend.content = await this.encryptContent(messageToSend.content);
            }
            catch (error) {
                console.error('[WebSocket] Failed to encrypt message:', error);
                throw error;
            }
        }
        if (this.ws?.readyState === WebSocket.OPEN) {
            // Send the message directly as JSON (like Rust client)
            const jsonMessage = JSON.stringify(messageToSend);
            this.ws.send(jsonMessage);
        }
        else {
            // Queue message for later with size limit
            if (this.messageQueue.length >= this.MAX_QUEUE_SIZE) {
                if (this.debug) {
                    console.warn(`[WebSocket] Queue full (${this.MAX_QUEUE_SIZE}), dropping oldest message`);
                }
                this.messageQueue.shift(); // Remove oldest message
            }
            this.messageQueue.push(messageToSend);
        }
    }
    /**
     * Disconnect from WebSocket
     */
    async disconnect() {
        if (this.ws) {
            // Clean up event listeners to prevent memory leaks
            this.ws.onopen = null;
            this.ws.onmessage = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.close(1000, 'Normal closure');
            this.ws = null;
        }
        this.isConnecting = false;
        this.connectionParams = null;
        this.messageQueue = []; // Clear queued messages
    }
    /**
     * Set own party ID for loop prevention
     */
    setOwnPartyId(partyId) {
        this.ownPartyId = partyId;
        if (this.debug) {
            console.log(`[WebSocket] 🆔 Set own party ID: ${partyId}`);
        }
    }
    /**
     * Check if connected
     */
    isConnected() {
        return this.ws?.readyState === WebSocket.OPEN;
    }
    /**
     * Set encryption key for AES-256-GCM
     */
    async setEncryptionKey(rawKey) {
        let keyBytes;
        if (typeof rawKey === 'string') {
            // Assume base64 encoded key
            keyBytes = Uint8Array.from(atob(rawKey), c => c.charCodeAt(0));
        }
        else {
            keyBytes = rawKey;
        }
        if (keyBytes.byteLength !== 32) {
            throw new Error('Encryption key must be 32 bytes for AES-256-GCM');
        }
        this.cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
        if (this.debug) {
            console.log('[WebSocket] 🔐 Encryption key set');
        }
    }
    /**
     * Check if encryption is enabled
     */
    shouldEncryptMessage(message) {
        // Don't encrypt server messages (from_id = all zeros)
        const SERVER_ID = '00000000000000000000000000000000000000000000000000000000000000000000';
        // Don't encrypt DONE messages (status messages to server)
        if (message.content === 'DONE' && message.to_id === SERVER_ID) {
            return false;
        }
        return this.cryptoKey !== null && message.from_id !== SERVER_ID;
    }
    /**
     * Encrypt message content using AES-256-GCM
     */
    async encryptContent(content) {
        if (!this.cryptoKey) {
            // If no encryption key, return content as-is
            return content;
        }
        if (this.isEncrypting) {
            throw new Error('Recursive encryption detected');
        }
        this.isEncrypting = true;
        try {
            // Generate random IV with cross-platform support
            const iv = (globalThis.crypto || crypto).getRandomValues(new Uint8Array(this.IV_LENGTH));
            // Encode and encrypt
            const encodedContent = new TextEncoder().encode(content);
            const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.cryptoKey, encodedContent);
            // Combine IV + encrypted data
            const result = new Uint8Array(iv.length + encrypted.byteLength);
            result.set(iv, 0);
            result.set(new Uint8Array(encrypted), iv.length);
            // Base64 encode safely
            return this.toBase64(result);
        }
        catch (err) {
            console.error('[Encryption] Failed:', err);
            throw err;
        }
        finally {
            this.isEncrypting = false;
        }
    }
    /**
     * Decrypt message content using AES-256-GCM
     */
    async decryptContent(encryptedContent) {
        if (!this.cryptoKey) {
            throw new Error('No encryption key set');
        }
        try {
            // Decode from base64
            const encryptedBytes = this.fromBase64(encryptedContent);
            // Extract IV (first 12 bytes) and ciphertext
            const iv = encryptedBytes.subarray(0, this.IV_LENGTH);
            const ciphertext = encryptedBytes.subarray(this.IV_LENGTH);
            // Decrypt
            const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, this.cryptoKey, ciphertext);
            // Return as string
            return new TextDecoder().decode(decrypted);
        }
        catch (error) {
            console.error('[Decryption] Failed:', error);
            throw new Error(`Decryption failed: ${error}`);
        }
    }
    /**
     * Safe base64 encoding for large data
     */
    toBase64(bytes) {
        let binary = '';
        const chunkSize = 0x8000; // 32KB chunks to avoid stack overflow
        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary);
    }
    /**
     * Safe base64 decoding
     */
    fromBase64(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
    /**
     * Send queued messages when connection is established
     */
    flushMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (this.ws?.readyState === WebSocket.OPEN) {
                // Message is already processed (encrypted if needed) from sendMessage
                this.ws.send(JSON.stringify(message));
            }
        }
    }
    /**
     * Handle parsed message
     */
    async handleParsedMessage(data) {
        // Handle both wrapped messages (type: 'message') and direct messages
        let protocolMessage;
        if (data.type === 'message') {
            protocolMessage = data.message;
        }
        else {
            // Direct message format (like from the server)
            protocolMessage = data;
        }
        // Validate the message before processing
        if (!this.validateProtocolMessage(protocolMessage)) {
            console.error('Invalid ProtocolMessage received:', protocolMessage);
            return;
        }
        // Loop prevention: ignore messages from our own party ID
        if (this.ownPartyId && protocolMessage.from_id === this.ownPartyId) {
            if (this.debug) {
                console.log(`[WebSocket] 🔄 Ignoring own message from ${this.ownPartyId} (loop prevention)`);
            }
            return;
        }
        // Log END messages specifically
        if (protocolMessage.content.startsWith('END:')) {
            console.log(`[WebSocket] [${this.ownPartyId?.substring(0, 8) || 'unknown'}] 📨 Received END message: ${protocolMessage.content}`);
        }
        // Decrypt content if encryption is enabled
        if (this.shouldEncryptMessage(protocolMessage)) {
            try {
                protocolMessage.content = await this.decryptContent(protocolMessage.content);
            }
            catch (error) {
                console.error('[WebSocket] Failed to decrypt message:', error);
                return; // Don't emit invalid message
            }
        }
        this.emit('message', protocolMessage);
    }
    /**
     * Validate ProtocolMessage structure
     */
    validateProtocolMessage(message) {
        return (typeof message === 'object' &&
            message !== null &&
            typeof message.group_id === 'string' &&
            typeof message.from_id === 'string' &&
            typeof message.to_id === 'string' &&
            typeof message.content === 'string' &&
            typeof message.round === 'number' &&
            typeof message.timestamp === 'string');
    }
}
