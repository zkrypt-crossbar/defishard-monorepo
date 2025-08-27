/**
 * SDK Bundler Entry Point
 * This file is used by webpack to bundle the DeFiShArd SDK for browser use
 */

// Import polyfills for browser compatibility
import 'buffer';
import 'crypto-browserify';
import 'stream-browserify';
import 'path-browserify';
import 'events';
import 'util';

// Import the DeFiShArd SDK
import { DeFiShArdSDK } from './public/sdk/index.js';

// Export the SDK as the default export
export default DeFiShArdSDK;

// Also expose it globally for debugging
if (typeof window !== 'undefined') {
  window.DeFiShArdSDK = DeFiShArdSDK;
}
