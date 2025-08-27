/**
 * Mobile Storage Adapter
 * Uses AsyncStorage for React Native
 */
import { BaseStorageAdapter } from './interface';

// Import AsyncStorage dynamically to avoid requiring it in non-mobile environments
let AsyncStorage: any;

try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (error) {
  // AsyncStorage not available - will throw error in constructor
}

export class MobileStorageAdapter extends BaseStorageAdapter {
  constructor(prefix: string = 'defishard_') {
    super(prefix);
    
    if (!AsyncStorage) {
      throw new Error('@react-native-async-storage/async-storage is not available. Please install it for React Native projects.');
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(this.getFullKey(key));
    } catch (error) {
      console.error('Failed to get from AsyncStorage:', error);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(this.getFullKey(key), value);
    } catch (error) {
      console.error('Failed to set in AsyncStorage:', error);
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.getFullKey(key));
    } catch (error) {
      console.error('Failed to remove from AsyncStorage:', error);
      throw error;
    }
  }

  async getKeys(): Promise<string[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      return allKeys
        .filter(key => key.startsWith(this.prefix))
        .map(key => key.substring(this.prefix.length));
    } catch (error) {
      console.error('Failed to get keys from AsyncStorage:', error);
      return [];
    }
  }

  async clear(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter(key => key.startsWith(this.prefix));
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } catch (error) {
      console.error('Failed to clear AsyncStorage:', error);
      throw error;
    }
  }
}
