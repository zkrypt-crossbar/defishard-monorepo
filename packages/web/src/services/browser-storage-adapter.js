/**
 * Browser Storage Adapter for DeFiShArd SDK
 * Implements the StorageInterface required by the SDK
 */
export class BrowserStorageAdapter {
  constructor(prefix = 'defishard_') {
    this.prefix = prefix;
    this.password = null; // Store password for encryption
  }

  /**
   * Set password for encryption/decryption
   * @param {string} password - Password to use for encryption
   */
  setPassword(password) {
    this.password = password;
  }

  /**
   * Get current password
   * @returns {string|null} - Current password or null
   */
  getPassword() {
    return this.password;
  }
  
  /**
   * Get a value from storage
   * @param {string} key - The key to retrieve
   * @returns {Promise<string|null>} - The stored value or null if not found
   */
  async get(key) {
    try {
      const value = localStorage.getItem(this.prefix + key);
      return value; // Return the string value directly, not parsed JSON
    } catch (error) {
      console.error('Error getting from storage:', error);
      return null;
    }
  }
  
  /**
   * Save encrypted data to storage (required by StorageInterface)
   * @param {string} key - The key to store
   * @param {string} encryptedData - The encrypted data to store (as string)
   * @returns {Promise<void>}
   */
  async save(key, encryptedData) {
    try {
      // Check if we have enough space before attempting to save
      const dataSize = encryptedData.length;
      const hasSpace = await this.hasEnoughSpace(dataSize);
      
      if (!hasSpace) {
        console.log(`⚠️ Not enough space for ${dataSize} bytes, attempting cleanup...`);
        await this.cleanupOldData();
      }
      
      localStorage.setItem(this.prefix + key, encryptedData);
    } catch (error) {
      console.error('Error saving to storage:', error);
      
      // If it's a quota exceeded error, try to clean up old data
      if (error.name === 'QuotaExceededError' || error.code === 22) {
        console.log('🔄 Storage quota exceeded, attempting cleanup...');
        await this.cleanupOldData();
        
        // Try again after cleanup
        try {
          localStorage.setItem(this.prefix + key, encryptedData);
          console.log('✅ Successfully saved after cleanup');
          return;
        } catch (retryError) {
          console.error('❌ Still failed after cleanup, trying nuclear option...');
          
          // Nuclear option: Clear ALL localStorage for this domain
          try {
            console.log('💥 Clearing ALL localStorage to make space...');
            localStorage.clear();
            console.log('✅ All localStorage cleared');
            
            // Try one more time
            localStorage.setItem(this.prefix + key, encryptedData);
            console.log('✅ Successfully saved after nuclear cleanup');
            return;
          } catch (nuclearError) {
            console.error('❌ Even nuclear cleanup failed:', nuclearError);
            throw nuclearError;
          }
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Set a value in storage (alias for save for backward compatibility)
   * @param {string} key - The key to store
   * @param {any} value - The value to store
   * @returns {Promise<void>}
   */
  async set(key, value) {
    try {
      const dataToStore = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(this.prefix + key, dataToStore);
    } catch (error) {
      console.error('Error setting to storage:', error);
      throw error;
    }
  }
  
  /**
   * Remove a value from storage
   * @param {string} key - The key to remove
   * @returns {Promise<void>}
   */
  async remove(key) {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (error) {
      console.error('Error removing from storage:', error);
      throw error;
    }
  }

  /**
   * Check if storage is available
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const testKey = this.prefix + 'test';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear all data from storage
   * @returns {Promise<void>}
   */
  async clear() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }

  /**
   * Get all keys in storage
   * @returns {Promise<string[]>}
   */
  async getKeys() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keys.push(key.substring(this.prefix.length));
        }
      }
      return keys;
    } catch (error) {
      console.error('Error getting keys from storage:', error);
      return [];
    }
  }

  /**
   * Clean up old data to free up storage space
   * Removes old keyshares and session data, keeping only the most recent
   * @returns {Promise<void>}
   */
  async cleanupOldData() {
    try {
      console.log('🧹 Starting storage cleanup...');
      
      // Get all our keys
      const allKeys = await this.getKeys();
      console.log(`📊 Found ${allKeys.length} keys in storage`);
      
      // Group keys by type
      const keyshares = allKeys.filter(key => key.includes('keyshare'));
      const sessions = allKeys.filter(key => key.includes('session'));
      const others = allKeys.filter(key => !key.includes('keyshare') && !key.includes('session'));
      
      console.log(`🔑 Keyshares: ${keyshares.length}, Sessions: ${sessions.length}, Others: ${others.length}`);
      
      // If we have any keyshares, remove ALL of them to make space for the new one
      if (keyshares.length > 0) {
        console.log(`🗑️ Removing ALL ${keyshares.length} existing keyshares to make space...`);
        for (const key of keyshares) {
          await this.remove(key);
          console.log(`🗑️ Removed keyshare: ${key}`);
        }
      }
      
      // Remove all sessions to free up more space
      if (sessions.length > 0) {
        console.log(`🗑️ Removing ALL ${sessions.length} sessions to free up space...`);
        for (const key of sessions) {
          await this.remove(key);
          console.log(`🗑️ Removed session: ${key}`);
        }
      }
      
      // Remove other keys if we still need space
      if (others.length > 0) {
        console.log(`🗑️ Removing ${others.length} other keys to free up space...`);
        for (const key of others) {
          await this.remove(key);
          console.log(`🗑️ Removed other key: ${key}`);
        }
      }
      
      // Check storage usage after cleanup
      const remainingKeys = await this.getKeys();
      console.log(`✅ Cleanup complete. Remaining keys: ${remainingKeys.length}`);
      
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      throw error;
    }
  }

  /**
   * Get storage usage information
   * @returns {Promise<Object>} - Storage usage stats
   */
  async getStorageUsage() {
    try {
      const keys = await this.getKeys();
      let totalSize = 0;
      
      for (const key of keys) {
        const value = localStorage.getItem(this.prefix + key);
        if (value) {
          totalSize += value.length;
        }
      }
      
      return {
        keyCount: keys.length,
        totalSizeBytes: totalSize,
        totalSizeKB: Math.round(totalSize / 1024 * 100) / 100,
        keys: keys
      };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return { keyCount: 0, totalSizeBytes: 0, totalSizeKB: 0, keys: [] };
    }
  }

  /**
   * Check if we have enough space for a given data size
   * @param {number} dataSize - Size of data to be stored in bytes
   * @returns {Promise<boolean>} - True if enough space available
   */
  async hasEnoughSpace(dataSize) {
    try {
      // Try to estimate available space by attempting to store a test value
      const testKey = this.prefix + '_space_test_' + Date.now();
      const testData = 'x'.repeat(Math.min(dataSize, 1000)); // Test with smaller size
      
      localStorage.setItem(testKey, testData);
      localStorage.removeItem(testKey);
      
      return true;
    } catch (error) {
      console.log('⚠️ Storage space check failed, likely not enough space');
      return false;
    }
  }

  /**
   * Get estimated available storage space
   * @returns {Promise<number>} - Estimated available space in bytes
   */
  async getAvailableSpace() {
    try {
      const usage = await this.getStorageUsage();
      const totalUsed = usage.totalSizeBytes;
      
      // Estimate total localStorage limit (varies by browser, typically 5-10MB)
      const estimatedTotal = 5 * 1024 * 1024; // 5MB estimate
      const available = Math.max(0, estimatedTotal - totalUsed);
      
      return available;
    } catch (error) {
      console.error('Error estimating available space:', error);
      return 0;
    }
  }
}
