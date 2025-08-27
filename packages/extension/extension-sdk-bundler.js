/**
 * Extension SDK Bundler Entry Point
 * This file is used by webpack to bundle the DeFiShArd SDK for Chrome extension service workers
 */

// Import polyfills for service worker compatibility
import 'buffer';
import 'crypto-browserify';
import 'stream-browserify';
import 'path-browserify';
import 'events';
import 'util';

// Import the real DeFiShArd SDK from monorepo
import { DeFiShArdSDK } from '../core/dist/index.js';

// Export the SDK as the default export
export default DeFiShArdSDK;

// Expose it globally for service worker (no window object)
if (typeof globalThis !== 'undefined') {
  globalThis.DeFiShArdSDK = DeFiShArdSDK;
  console.log('✅ Real DeFiShArd SDK exposed globally for extension');
  console.log('✅ DeFiShArdSDK type:', typeof DeFiShArdSDK);
  console.log('✅ DeFiShArdSDK constructor:', DeFiShArdSDK.toString().substring(0, 100));
}

// Log that this is the REAL SDK, not a bridge
console.log('🎯 REAL DeFiShArd SDK loaded from monorepo packages/core with WebSocket startKeygen() functionality');
console.log('📦 Real SDK imported from:', '../core/dist/index.js');
console.log('🔧 Real WASM files copied from:', '../core/pkg/*.wasm');
