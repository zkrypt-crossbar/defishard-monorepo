/**
 * LocalStorage Implementation for DeFiShard SDK
 * 
 * Provides localStorage-based storage implementation.
 * Suitable for browser environments.
 */

import { StorageInterface } from './interface';

export class LocalStorageAdapter implements StorageInterface {
  private readonly prefix: string;

  constructor(prefix: string = 'defishard_') {
    this.prefix = prefix;
  }

  /**
   * Save data to localStorage with encryption
   */
  async save(key: string, data: string): Promise<void> {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage is not available');
    }

    if (!key || typeof key !== 'string') {
      throw new Error('Invalid key: must be a non-empty string');
    }

    if (typeof data !== 'string') {
      throw new Error('Invalid data: must be a string');
    }

    try {
      // Generate a unique encryption key for this data
      const encryptionKey = await this.deriveEncryptionKey(key);
      
      // Encrypt the data
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        encryptionKey,
        new TextEncoder().encode(data)
      );

      // Store encrypted data and IV
      const fullKey = this.getFullKey(key);
      const ivKey = this.getFullKey(`${key}_iv`);
      
      localStorage.setItem(fullKey, this.arrayBufferToBase64(encrypted));
      localStorage.setItem(ivKey, this.arrayBufferToBase64(iv.buffer));
    } catch (error) {
      throw new Error(`Failed to save to localStorage: ${error}`);
    }
  }

  /**
   * Retrieve and decrypt data from localStorage
   */
  async get(key: string): Promise<string | null> {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    if (!key || typeof key !== 'string') {
      throw new Error('Invalid key: must be a non-empty string');
    }

    try {
      const fullKey = this.getFullKey(key);
      const ivKey = this.getFullKey(`${key}_iv`);
      
      const encryptedData = localStorage.getItem(fullKey);
      const iv = localStorage.getItem(ivKey);
      
      if (!encryptedData || !iv) {
        return null;
      }

      // Generate the same encryption key
      const encryptionKey = await this.deriveEncryptionKey(key);
      
      // Decrypt the data
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: this.base64ToArrayBuffer(iv)
        },
        encryptionKey,
        this.base64ToArrayBuffer(encryptedData)
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.warn(`Failed to get from localStorage: ${error}`);
      return null;
    }
  }

  /**
   * Remove data and IV from localStorage
   */
  async remove(key: string): Promise<void> {
    if (typeof localStorage === 'undefined') {
      return;
    }

    if (!key || typeof key !== 'string') {
      throw new Error('Invalid key: must be a non-empty string');
    }

    try {
      const fullKey = this.getFullKey(key);
      const ivKey = this.getFullKey(`${key}_iv`);
      
      localStorage.removeItem(fullKey);
      localStorage.removeItem(ivKey);
    } catch (error) {
      console.warn(`Failed to remove from localStorage: ${error}`);
    }
  }

  /**
   * Check if localStorage is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      return typeof localStorage !== 'undefined';
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear all DeFiShard data from localStorage
   */
  async clear(): Promise<void> {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      // Get all keys including IV keys
      const allKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          allKeys.push(key);
        }
      }
      
      // Remove all keys
      for (const key of allKeys) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`Failed to clear localStorage: ${error}`);
    }
  }

  /**
   * Get all DeFiShard keys from localStorage (excluding IV keys)
   */
  async getKeys(): Promise<string[]> {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix) && !key.endsWith('_iv')) {
          // Remove prefix to return the original key
          keys.push(key.substring(this.prefix.length));
        }
      }
      return keys;
    } catch (error) {
      console.warn(`Failed to get keys from localStorage: ${error}`);
      return [];
    }
  }

  /**
   * Get the full storage key with prefix
   */
  private getFullKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Derive encryption key from storage key
   */
  private async deriveEncryptionKey(key: string): Promise<CryptoKey> {
    // Use a combination of key and a fixed salt for key derivation
    const keyMaterial = `${key}_defishard_salt`;
    const keyBytes = new TextEncoder().encode(keyMaterial);
    
    // Import as raw key material
    const importedKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // Derive final encryption key using PBKDF2
    const salt = new TextEncoder().encode('defishard-localstorage-salt');
    
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      importedKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

} 