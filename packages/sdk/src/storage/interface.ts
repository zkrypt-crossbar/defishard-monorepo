/**
 * Storage Interface for DeFiShard SDK
 * 
 * Defines the interface that apps must implement for secure storage.
 * Apps can implement this interface for their specific storage needs
 * (localStorage, IndexedDB, Keychain, Keystore, etc.).
 */

export interface StorageInterface {
  /**
   * Save encrypted data to storage
   * 
   * @param key - Storage key
   * @param encryptedData - Encrypted data to store
   * @returns Promise that resolves when data is saved
   */
  save(key: string, encryptedData: string): Promise<void>;

  /**
   * Retrieve encrypted data from storage
   * 
   * @param key - Storage key
   * @returns Promise that resolves to encrypted data or null if not found
   */
  get(key: string): Promise<string | null>;

  /**
   * Remove data from storage
   * 
   * @param key - Storage key
   * @returns Promise that resolves when data is removed
   */
  remove(key: string): Promise<void>;

  /**
   * Check if storage is available
   * 
   * @returns Promise that resolves to true if storage is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Clear all data from storage
   * 
   * @returns Promise that resolves when all data is cleared
   */
  clear(): Promise<void>;

  /**
   * Get all keys in storage
   * 
   * @returns Promise that resolves to array of storage keys
   */
  getKeys(): Promise<string[]>;
} 