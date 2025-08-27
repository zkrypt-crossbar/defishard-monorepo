import { EventEmitter } from '../events';
import { Config, ProtocolMessage, KeyShare } from '../types';
import { WebSocketManager } from '../websocket';
import { StorageInterface } from '../storage/interface';
export interface ProtocolManagerEvents {
    'keygen-complete': (keyShare: KeyShare) => void;
    'sign-complete': (signature: [Uint8Array, Uint8Array]) => void;
    'error': (error: Error) => void;
}
export declare class ProtocolManager extends EventEmitter {
    private static instanceCounter;
    private instanceId;
    private config;
    private storage;
    private debug;
    private apiClient;
    private websocketManager;
    private keygenProcessor;
    private signProcessor;
    private outgoingQueue;
    private processingOutgoing;
    private processedMessageIds;
    /**
     * Common validation and group info retrieval
     */
    private validateAndGetGroupInfo;
    /**
     * Common round-complete event handler
     */
    private handleRoundComplete;
    /**
     * Common processor error handler
     */
    private handleProcessorError;
    /**
     * Common completion handler
     */
    private handleProcessorComplete;
    /**
     * Setup common event handlers for processors
     */
    private setupProcessorEventHandlers;
    constructor(config: Config, storage: StorageInterface, debug?: boolean, websocketManager?: WebSocketManager);
    /**
     * Update configuration (called when SDK config changes)
     */
    updateConfig(config: Config): void;
    /**
     * Start keygen
     */
    startKeygen(distributed?: boolean, secret?: string): Promise<void>;
    /**
     * Start key rotation
     */
    startKeyRotation(oldKeyshare: any, distributed?: boolean, secret?: string): Promise<void>;
    /**
     * Start signing with provided keyshare (simple delegation)
     */
    startSigningWithKeyshare(messageHash: Uint8Array, keyshare: KeyShare): Promise<void>;
    /**
     * Start signing with explicit keyshare (the only method needed for real apps)
     */
    startSigning(messageHash: Uint8Array, keyshare: KeyShare): Promise<void>;
    /**
     * Handle incoming WebSocket messages
     * Routes messages to the appropriate processor automatically
     */
    handleMessage(protocolMessage: ProtocolMessage): Promise<void>;
    /**
     * Simple hash function for message content
     */
    private hashContent;
    /**
     * Queue an outgoing message to prevent recursion
     */
    private queueOutgoingMessage;
    /**
     * Process queued outgoing messages asynchronously
     */
    private processOutgoingQueue;
    /**
     * Get current keygen state
     */
    getKeygenState(): {
        round: number;
        isComplete: boolean;
    } | null;
    /**
     * Get current sign state
     */
    getSignState(): {
        round: number;
        isComplete: boolean;
    } | null;
    /**
     * Clean up resources
     */
    destroy(): void;
}
