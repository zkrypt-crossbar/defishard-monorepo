/**
 * SDK Loader for DeFiShArd Extension
 * Loads the bundled SDK like the web app does
 */

try {
    // Create a mock window object for the SDK bundle since it expects window.DeFiShArdSDK
    if (typeof window === 'undefined') {
        globalThis.window = {};
    }
    
    // Load the bundled SDK directly (same as web app)
    // This contains all the WASM loading logic already working
    // Note: In service worker context, paths are relative to the extension root
    console.log('🔄 Attempting to load bundled SDK from different paths...');
    
    // Try different path formats for service worker context
    const possiblePaths = [
        'assets/sdk/defishard-sdk.bundle.js',
        '/assets/sdk/defishard-sdk.bundle.js',
        './assets/sdk/defishard-sdk.bundle.js',
        '../assets/sdk/defishard-sdk.bundle.js'
    ];
    
    // Also try using chrome.runtime.getURL for absolute path
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        try {
            const absolutePath = chrome.runtime.getURL('assets/sdk/defishard-sdk.bundle.js');
            possiblePaths.unshift(absolutePath);
            console.log('🔗 Added chrome.runtime.getURL path:', absolutePath);
        } catch (error) {
            console.log('⚠️ Could not get chrome.runtime.getURL:', error.message);
        }
    }
    
    let loadSuccess = false;
    let lastError = null;
    
    for (const path of possiblePaths) {
        try {
            console.log(`🔄 Trying path: ${path}`);
            importScripts(path);
            console.log(`✅ importScripts succeeded with path: ${path}`);
            loadSuccess = true;
            break;
        } catch (importError) {
            console.log(`❌ Path ${path} failed:`, importError.name, importError.message);
            
            // Log detailed information for DOMException
            if (importError.name === 'DOMException') {
                console.log(`❌ DOMException details for ${path}:`);
                console.log('❌ Code:', importError.code);
                console.log('❌ Name:', importError.name);
                console.log('❌ Message:', importError.message);
                console.log('❌ Stack:', importError.stack);
            }
            
            lastError = importError;
            continue;
        }
    }
    
    if (!loadSuccess) {
        console.error('❌ All paths failed. Last error details:');
        console.error('❌ Error name:', lastError.name);
        console.error('❌ Error message:', lastError.message);
        console.error('❌ Error stack:', lastError.stack);
        throw lastError;
    }
    console.log('✅ Bundled SDK loaded successfully');
    
    // The bundled SDK exposes exports on window.DeFiShArdSDK
    if (typeof window.DeFiShArdSDK !== 'undefined') {
        console.log('✅ DeFiShArdSDK exports available on window');
        console.log('✅ window.DeFiShArdSDK structure:', Object.keys(window.DeFiShArdSDK));
        console.log('✅ window.DeFiShArdSDK type:', typeof window.DeFiShArdSDK);
        
        // Check if it's the constructor function directly or if it has a default export
        let SDK;
        if (typeof window.DeFiShArdSDK === 'function') {
            // Direct export case
            SDK = window.DeFiShArdSDK;
            console.log('✅ Using direct export as SDK constructor');
        } else if (window.DeFiShArdSDK.default && typeof window.DeFiShArdSDK.default === 'function') {
            // Default export case
            SDK = window.DeFiShArdSDK.default;
            console.log('✅ Using default export as SDK constructor');
        } else if (window.DeFiShArdSDK.DeFiShArdSDK && typeof window.DeFiShArdSDK.DeFiShArdSDK === 'function') {
            // Named export case
            SDK = window.DeFiShArdSDK.DeFiShArdSDK;
            console.log('✅ Using named export as SDK constructor');
        } else {
            throw new Error('No valid SDK constructor found in window.DeFiShArdSDK');
        }
        
        // Make it available for the extension background script
        globalThis.DeFiShArdSDK = SDK;
        
        // Try to get LocalStorageAdapter from different possible locations
        const LocalStorageAdapter = window.DeFiShArdSDK.LocalStorageAdapter || 
                                   window.DeFiShArdSDK.default?.LocalStorageAdapter ||
                                   SDK.LocalStorageAdapter;
        
        if (LocalStorageAdapter) {
            globalThis.LocalStorageAdapter = LocalStorageAdapter;
            console.log('✅ LocalStorageAdapter found and made available globally');
        } else {
            console.log('⚠️ LocalStorageAdapter not found in bundle, will use extension adapter');
        }
        
        console.log('✅ SDK components made available globally');
        console.log('✅ globalThis.DeFiShArdSDK type:', typeof globalThis.DeFiShArdSDK);
    } else {
        throw new Error('DeFiShArdSDK not found on window after loading bundle');
    }
    
} catch (error) {
    console.error('❌ Failed to load bundled SDK:', error);
    console.error('Error details:', error.message);
    
    // The bundled SDK likely fails due to eval() restrictions in service workers
    // Try alternative approach: load the individual SDK modules directly
    console.log('🔄 Bundled SDK failed, trying direct module loading...');
    
    try {
        // Create a simplified SDK that imports components directly
        console.log('🔄 Loading individual SDK modules...');
        
        // Import the API client directly
        importScripts('assets/sdk/api.js');
        
        // Import core components
        importScripts('assets/sdk/events.js');
        importScripts('assets/sdk/websocket.js');
        
        // Import the main SDK class
        importScripts('assets/sdk/core/SDK.js');
        
        // Import storage adapter
        importScripts('assets/sdk/storage/local-storage.js');
        
        console.log('✅ Direct SDK modules loaded successfully');
        
        // Check if the SDK is available after direct loading
        if (typeof DeFiShArdSDK !== 'undefined') {
            globalThis.DeFiShArdSDK = DeFiShArdSDK;
            console.log('✅ DeFiShArdSDK available from direct modules');
        } else {
            throw new Error('DeFiShArdSDK not found after direct module loading');
        }
        
    } catch (directError) {
        console.error('❌ Direct module loading also failed:', directError);
        
        // Final fallback: original approach with custom SDK components
        console.log('🔄 Falling back to custom SDK implementation...');
        
        try {
            // Load service worker WASM wrapper first
            importScripts('wasm/wasm-service-worker.js');

            // Import utility classes first
            importScripts('sdk/utils/crypto.js');
            importScripts('sdk/utils/message.js');

            // Import core components
            importScripts('sdk/WebSocketManager.js');
            importScripts('sdk/ProtocolManager.js');

            // Import processors
            importScripts('sdk/processors/BaseProcessor.js');
            importScripts('sdk/processors/KeygenProcessor.js');

            console.log('✅ Fallback SDK components loaded successfully');
        } catch (fallbackError) {
            console.error('❌ All SDK loading methods failed:', fallbackError);
            throw fallbackError;
        }
    }
}
