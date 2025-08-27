/**
 * Memory Storage Implementation for DeFiShard SDK
 *
 * Provides in-memory storage implementation.
 * Suitable for extension apps, mobile apps, and environments without localStorage.
 */
import { StorageInterface } from './interface';
export declare class MemoryStorageAdapter implements StorageInterface {
    private storage;
    private readonly prefix;
    constructor(prefix?: string);
    /**
     * Save data to memory storage
     */
    save(key: string, data: string): Promise<void>;
    /**
     * Retrieve data from memory storage
     */
    get(key: string): Promise<string | null>;
    /**
     * Remove data from memory storage
     */
    remove(key: string): Promise<void>;
    /**
     * Check if memory storage is available
     */
    isAvailable(): Promise<boolean>;
    /**
     * Clear all DeFiShard data from memory storage
     */
    clear(): Promise<void>;
    /**
     * Get all DeFiShard keys from memory storage
     */
    getKeys(): Promise<string[]>;
    /**
     * Get the full storage key with prefix
     */
    private getFullKey;
}
