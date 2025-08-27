/**
 * Extension Platform SDK
 * Convenience wrapper for browser extensions
 */
import { DeFiShArdSDK } from '../core/SDK';
import { ExtensionStorageAdapter } from '../../adapters/storage';
import { Config } from '../types';

export interface ExtensionConfig extends Omit<Config, 'storage'> {
  storage?: ExtensionStorageAdapter;
  storagePrefix?: string;
}

/**
 * Create a DeFiShArd SDK instance optimized for browser extensions
 */
export function createExtensionSDK(config: ExtensionConfig): DeFiShArdSDK {
  const storage = config.storage || new ExtensionStorageAdapter(config.storagePrefix);
  
  return new DeFiShArdSDK({
    ...config,
    storage,
    platform: 'extension'
  } as Config);
}
