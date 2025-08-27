// Main entry point - re-export the refactored SDK
export { DeFiShArdSDK } from './core/SDK';

// Re-export storage interfaces and implementations
export { LocalStorageAdapter } from './storage/local-storage';
export type { StorageInterface } from './storage/interface';

// Re-export types
export type { 
  Config, 
  RegistrationResult, 
  GroupResult, 
  ProtocolMessage,
  KeyShare 
} from './types.js';

// Re-export other components for advanced usage
export { ApiClient } from './api';
export { WebSocketManager } from './websocket';
export { EventEmitter } from './events';
export { KeygenProcessor } from './protocols/keygen-processor';
export { SignProcessor } from './protocols/sign-processor';
export { BaseProcessor } from './protocols/base-processor'; 