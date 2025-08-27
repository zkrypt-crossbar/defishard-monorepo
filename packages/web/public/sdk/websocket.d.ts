import { ProtocolMessage } from './types';
import { EventEmitter } from './events';
export declare class WebSocketManager extends EventEmitter {
    private websocketUrl;
    private ws;
    private isConnecting;
    private messageQueue;
    private readonly MAX_QUEUE_SIZE;
    private connectionParams;
    private debug;
    private ownPartyId;
    private cryptoKey;
    private isEncrypting;
    private readonly IV_LENGTH;
    constructor(websocketUrl: string, debug?: boolean);
    /**
     * Connect to the WebSocket server
     */
    connect(groupId: string, protocol: string, apiKey: string): Promise<void>;
    /**
     * Send a message via WebSocket
     */
    sendMessage(message: ProtocolMessage): Promise<void>;
    /**
     * Disconnect from WebSocket
     */
    disconnect(): Promise<void>;
    /**
     * Set own party ID for loop prevention
     */
    setOwnPartyId(partyId: string): void;
    /**
     * Check if connected
     */
    isConnected(): boolean;
    /**
     * Set encryption key for AES-256-GCM
     */
    setEncryptionKey(rawKey: Uint8Array | string): Promise<void>;
    /**
     * Check if encryption is enabled
     */
    private shouldEncryptMessage;
    /**
     * Encrypt message content using AES-256-GCM
     */
    private encryptContent;
    /**
     * Decrypt message content using AES-256-GCM
     */
    private decryptContent;
    /**
     * Safe base64 encoding for large data
     */
    private toBase64;
    /**
     * Safe base64 decoding
     */
    private fromBase64;
    /**
     * Send queued messages when connection is established
     */
    private flushMessageQueue;
    /**
     * Handle parsed message
     */
    private handleParsedMessage;
    /**
     * Validate ProtocolMessage structure
     */
    private validateProtocolMessage;
}
