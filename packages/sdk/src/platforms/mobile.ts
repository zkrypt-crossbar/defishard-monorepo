/**
 * Mobile Platform SDK
 * Convenience wrapper for React Native mobile apps
 */
import { DeFiShArdSDK } from '../core/SDK';
import { MobileStorageAdapter } from '../../adapters/storage';
import { Config } from '../types';

export interface MobileConfig extends Omit<Config, 'storage'> {
  storage?: MobileStorageAdapter;
  storagePrefix?: string;
}

/**
 * Create a DeFiShArd SDK instance optimized for React Native mobile apps
 */
export function createMobileSDK(config: MobileConfig): DeFiShArdSDK {
  const storage = config.storage || new MobileStorageAdapter(config.storagePrefix);
  
  return new DeFiShArdSDK({
    ...config,
    storage,
    platform: 'mobile'
  } as Config);
}
