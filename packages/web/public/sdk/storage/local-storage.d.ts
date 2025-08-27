/**
 * LocalStorage Implementation for DeFiShard SDK
 *
 * Provides localStorage-based storage implementation.
 * Suitable for browser environments.
 */
import { StorageInterface } from './interface';
export declare class LocalStorageAdapter implements StorageInterface {
    private readonly prefix;
    constructor(prefix?: string);
    /**
     * Save data to localStorage with encryption
     */
    save(key: string, data: string): Promise<void>;
    /**
     * Retrieve and decrypt data from localStorage
     */
    get(key: string): Promise<string | null>;
    /**
     * Remove data and IV from localStorage
     */
    remove(key: string): Promise<void>;
    /**
     * Check if localStorage is available
     */
    isAvailable(): Promise<boolean>;
    /**
     * Clear all DeFiShard data from localStorage
     */
    clear(): Promise<void>;
    /**
     * Get all DeFiShard keys from localStorage (excluding IV keys)
     */
    getKeys(): Promise<string[]>;
    /**
     * Get the full storage key with prefix
     */
    private getFullKey;
    /**
     * Derive encryption key from storage key
     */
    private deriveEncryptionKey;
    /**
     * Convert ArrayBuffer to base64 string
     */
    private arrayBufferToBase64;
    /**
     * Convert base64 string to ArrayBuffer
     */
    private base64ToArrayBuffer;
}
