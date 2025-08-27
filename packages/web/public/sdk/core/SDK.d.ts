import { EventEmitter } from '../events';
import { StorageInterface } from '../storage/interface';
import { Config, RegistrationResult, GroupResult } from '../types';
export { LocalStorageAdapter } from '../storage/local-storage';
export type { StorageInterface } from '../storage/interface';
export type { KeyShare } from '../types';
export declare class DeFiShArdSDK extends EventEmitter {
    private wasmInitialized;
    private apiClient;
    private websocketManager;
    private storage;
    private config;
    private protocolManager;
    private debug;
    constructor(config: Config & {
        storage?: StorageInterface;
    });
    /**
     * Initialize the SDK and WASM
     */
    initialize(): Promise<void>;
    /**
     * Register a new party
     */
    register(): Promise<RegistrationResult>;
    /**
     * Create a new group
     */
    createGroup(threshold: number, totalParties: number, timeoutMinutes?: number): Promise<GroupResult>;
    /**
     * Join an existing group
     */
    joinGroup(groupId: string): Promise<GroupResult>;
    /**
     * Start key generation
     */
    startKeygen(distributed?: boolean, secret?: string): Promise<void>;
    /**
     * Start key rotation
     */
    startKeyRotation(oldKeyshare: any, distributed?: boolean, secret?: string): Promise<void>;
    /**
     * Start signing
     */
    startSigning(messageHash: Uint8Array, keyshare: any): Promise<void>;
    /**
     * Start signing with specific keyshare details
     */
    startSigningWithKeyshare(messageHash: Uint8Array, keyshareGroupId: string, keyshareIndex: number): Promise<void>;
    /**
     * Handle WebSocket messages
     */
    private handleWebSocketMessage;
    /**
     * Get keygen state
     */
    getKeygenState(): {
        round: number;
        isComplete: boolean;
    } | null;
    /**
     * Get sign state
     */
    getSignState(): {
        round: number;
        isComplete: boolean;
    } | null;
    /**
     * Check if storage is available
     */
    isStorageAvailable(): Promise<boolean>;
    /**
     * Get storage instance
     */
    getStorage(): StorageInterface;
    /**
     * Set encryption key for WebSocket communication
     */
    setEncryptionKey(rawKey: Uint8Array | string): Promise<void>;
    /**
     * Disconnect from WebSocket
     */
    disconnect(): Promise<void>;
}
