/**
 * Web Storage Adapter
 * Uses localStorage for web browsers
 */
import { BaseStorageAdapter } from './interface';

export class WebStorageAdapter extends BaseStorageAdapter {
  constructor(prefix: string = 'defishard_') {
    super(prefix);
    
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage is not available in this environment');
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(this.getFullKey(key));
    } catch (error) {
      console.error('Failed to get from localStorage:', error);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(this.getFullKey(key), value);
    } catch (error) {
      console.error('Failed to set in localStorage:', error);
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(this.getFullKey(key));
    } catch (error) {
      console.error('Failed to remove from localStorage:', error);
      throw error;
    }
  }

  async getKeys(): Promise<string[]> {
    try {
      const allKeys = Object.keys(localStorage);
      return allKeys
        .filter(key => key.startsWith(this.prefix))
        .map(key => key.substring(this.prefix.length));
    } catch (error) {
      console.error('Failed to get keys from localStorage:', error);
      return [];
    }
  }
}
