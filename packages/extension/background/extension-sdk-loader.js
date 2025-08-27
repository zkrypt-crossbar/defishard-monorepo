/**
 * Extension SDK Loader
 * Loads the cross-platform SDK built specifically for extensions
 */

try {
    console.log('🔄 Loading DeFiShArd Extension SDK...');
    
    // Load WASM loader first to handle URL construction
    importScripts('extension-wasm-loader.js');
    
    // Load the bundled SDK that was built specifically for extensions
    importScripts('sdk-bundle.js');
    console.log('✅ Extension SDK bundle loaded successfully');
    
    // The extension build exposes DeFiShArdSDK globally
    if (typeof DeFiShArdSDK !== 'undefined') {
        console.log('✅ DeFiShArdSDK available globally');
        console.log('✅ Available SDK exports:', Object.keys(DeFiShArdSDK));
        
        // Make SDK available globally for background script
        globalThis.DeFiShArdSDK = DeFiShArdSDK.DeFiShArdSDK || DeFiShArdSDK;
        globalThis.createExtensionSDK = DeFiShArdSDK.createExtensionSDK || 
                                       ((config) => new globalThis.DeFiShArdSDK(config));
        
        console.log('✅ Extension SDK ready for use');
    } else {
        throw new Error('DeFiShArdSDK not found after loading bundle');
    }
    
} catch (error) {
    console.error('❌ Failed to load Extension SDK:', error);
    console.error('Error details:', error.message);
    throw error;
}
