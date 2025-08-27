/**
 * Storage Adapters Export
 * Platform-specific storage implementations
 */

export { StorageInterface, BaseStorageAdapter } from './interface';
export { WebStorageAdapter } from './web-storage';
export { ExtensionStorageAdapter } from './extension-storage';
export { MobileStorageAdapter } from './mobile-storage';

/**
 * Factory function to create appropriate storage adapter based on environment
 */
export function createStorageAdapter(prefix?: string): any {
  // Check for React Native environment
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    const { MobileStorageAdapter } = require('./mobile-storage');
    return new MobileStorageAdapter(prefix);
  }
  
  // Check for Chrome extension environment
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const { ExtensionStorageAdapter } = require('./extension-storage');
    return new ExtensionStorageAdapter(prefix);
  }
  
  // Default to web storage for browsers
  if (typeof localStorage !== 'undefined') {
    const { WebStorageAdapter } = require('./web-storage');
    return new WebStorageAdapter(prefix);
  }
  
  throw new Error('No suitable storage adapter found for this environment');
}
