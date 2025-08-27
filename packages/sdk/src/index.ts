/**
 * DeFiShArd SDK - Cross-Platform Entry Point
 * This is the main entry point that exports platform-agnostic SDK
 */

// Re-export the main SDK class
export { DeFiShArdSDK } from './core/SDK';

// Re-export types
export type { 
  Config, 
  RegistrationResult, 
  GroupResult, 
  ProtocolMessage,
  KeyShare 
} from './types';

// Re-export core components for advanced usage
export { ApiClient } from './api';
export { WebSocketManager } from './websocket';
export { EventEmitter } from './events';
export { KeygenProcessor } from './protocols/keygen-processor';
export { SignProcessor } from './protocols/sign-processor';
export { BaseProcessor } from './protocols/base-processor';

// Re-export storage adapters
export { 
  StorageInterface,
  WebStorageAdapter,
  ExtensionStorageAdapter,
  MobileStorageAdapter,
  createStorageAdapter
} from '../adapters/storage';

// Platform-specific convenience exports
export { createWebSDK } from './platforms/web';
export { createExtensionSDK } from './platforms/extension';
export { createMobileSDK } from './platforms/mobile';