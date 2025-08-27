/**
 * Memory Storage Implementation for DeFiShard SDK
 * 
 * Provides in-memory storage implementation.
 * Suitable for extension apps, mobile apps, and environments without localStorage.
 */

import { StorageInterface } from './interface';

export class MemoryStorageAdapter implements StorageInterface {
  private storage: Map<string, string> = new Map();
  private readonly prefix: string;

  constructor(prefix: string = 'defishard_') {
    this.prefix = prefix;
  }

  /**
   * Save data to memory storage
   */
  async save(key: string, data: string): Promise<void> {
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid key: must be a non-empty string');
    }

    if (typeof data !== 'string') {
      throw new Error('Invalid data: must be a string');
    }

    try {
      const fullKey = this.getFullKey(key);
      this.storage.set(fullKey, data);
    } catch (error) {
      throw new Error(`Failed to save to memory storage: ${error}`);
    }
  }

  /**
   * Retrieve data from memory storage
   */
  async get(key: string): Promise<string | null> {
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid key: must be a non-empty string');
    }

    try {
      const fullKey = this.getFullKey(key);
      return this.storage.get(fullKey) || null;
    } catch (error) {
      console.warn(`Failed to get from memory storage: ${error}`);
      return null;
    }
  }

  /**
   * Remove data from memory storage
   */
  async remove(key: string): Promise<void> {
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid key: must be a non-empty string');
    }

    try {
      const fullKey = this.getFullKey(key);
      this.storage.delete(fullKey);
    } catch (error) {
      console.warn(`Failed to remove from memory storage: ${error}`);
    }
  }

  /**
   * Check if memory storage is available
   */
  async isAvailable(): Promise<boolean> {
    return true; // Memory storage is always available
  }

  /**
   * Clear all DeFiShard data from memory storage
   */
  async clear(): Promise<void> {
    try {
      const keysToRemove: string[] = [];
      for (const key of this.storage.keys()) {
        if (key.startsWith(this.prefix)) {
          keysToRemove.push(key);
        }
      }
      
      for (const key of keysToRemove) {
        this.storage.delete(key);
      }
    } catch (error) {
      console.warn(`Failed to clear memory storage: ${error}`);
    }
  }

  /**
   * Get all DeFiShard keys from memory storage
   */
  async getKeys(): Promise<string[]> {
    try {
      const keys: string[] = [];
      for (const key of this.storage.keys()) {
        if (key.startsWith(this.prefix)) {
          // Remove prefix to return the original key
          keys.push(key.substring(this.prefix.length));
        }
      }
      return keys;
    } catch (error) {
      console.warn(`Failed to get keys from memory storage: ${error}`);
      return [];
    }
  }

  /**
   * Get the full storage key with prefix
   */
  private getFullKey(key: string): string {
    return `${this.prefix}${key}`;
  }
}


