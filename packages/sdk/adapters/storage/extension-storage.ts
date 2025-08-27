/**
 * Extension Storage Adapter
 * Uses chrome.storage.local for browser extensions
 */
import { BaseStorageAdapter } from './interface';

export class ExtensionStorageAdapter extends BaseStorageAdapter {
  constructor(prefix: string = 'defishard_') {
    super(prefix);
    
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      throw new Error('chrome.storage.local is not available in this environment');
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await chrome.storage.local.get([fullKey]);
      return result[fullKey] || null;
    } catch (error) {
      console.error('Failed to get from chrome.storage.local:', error);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      await chrome.storage.local.set({ [fullKey]: value });
    } catch (error) {
      console.error('Failed to set in chrome.storage.local:', error);
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      await chrome.storage.local.remove([fullKey]);
    } catch (error) {
      console.error('Failed to remove from chrome.storage.local:', error);
      throw error;
    }
  }

  async getKeys(): Promise<string[]> {
    try {
      const allItems = await chrome.storage.local.get(null);
      return Object.keys(allItems)
        .filter(key => key.startsWith(this.prefix))
        .map(key => key.substring(this.prefix.length));
    } catch (error) {
      console.error('Failed to get keys from chrome.storage.local:', error);
      return [];
    }
  }

  async clear(): Promise<void> {
    try {
      const allItems = await chrome.storage.local.get(null);
      const keysToRemove = Object.keys(allItems)
        .filter(key => key.startsWith(this.prefix));
      
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
      }
    } catch (error) {
      console.error('Failed to clear chrome.storage.local:', error);
      throw error;
    }
  }
}
