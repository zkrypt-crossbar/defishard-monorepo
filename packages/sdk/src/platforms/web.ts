/**
 * Web Platform SDK
 * Convenience wrapper for web browsers
 */
import { DeFiShArdSDK } from '../core/SDK';
import { WebStorageAdapter } from '../../adapters/storage';
import { Config } from '../types';

export interface WebConfig extends Omit<Config, 'storage'> {
  storage?: WebStorageAdapter;
  storagePrefix?: string;
}

/**
 * Create a DeFiShArd SDK instance optimized for web browsers
 */
export function createWebSDK(config: WebConfig): DeFiShArdSDK {
  const storage = config.storage || new WebStorageAdapter(config.storagePrefix);
  
  return new DeFiShArdSDK({
    ...config,
    storage,
    platform: 'web'
  } as Config);
}
