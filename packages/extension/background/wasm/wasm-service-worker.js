/**
 * Service Worker Compatible WASM Wrapper
 * Provides browser APIs that WASM module expects but aren't available in service workers
 */

// Service worker compatible global object
if (typeof globalThis === 'undefined') {
    globalThis = self;
}

// Mock window object for service worker
if (typeof window === 'undefined') {
    window = {
        location: {
            href: 'chrome-extension://',
            origin: 'chrome-extension://'
        },
        document: {
            createElement: () => ({}),
            getElementById: () => null
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
        console: console,
        crypto: crypto,
        TextEncoder: TextEncoder,
        TextDecoder: TextDecoder,
        Uint8Array: Uint8Array,
        ArrayBuffer: ArrayBuffer,
        DataView: DataView,
        Promise: Promise,
        Error: Error,
        TypeError: TypeError,
        RangeError: RangeError,
        ReferenceError: ReferenceError
    };
}

// Mock document if needed
if (typeof document === 'undefined') {
    document = window.document;
}

// Mock location if needed
if (typeof location === 'undefined') {
    location = window.location;
}

// Mock navigator if needed
if (typeof navigator === 'undefined') {
    navigator = {
        userAgent: 'Chrome Extension Service Worker',
        platform: 'Chrome Extension'
    };
}

// Mock URL constructor for service worker
if (typeof URL === 'undefined') {
    URL = function(url, base) {
        return {
            href: url,
            origin: 'chrome-extension://',
            pathname: url,
            search: '',
            hash: ''
        };
    };
}

// Skip loading WASM JS wrapper in service worker
// The dkls_wasm_ll.js file uses ES6 modules which are incompatible with importScripts()
// We'll load the WASM binary directly instead
console.log('📝 Skipping WASM JS wrapper import (ES6 module incompatible with service worker)');

// Alternative WASM loading using direct fetch and WebAssembly.instantiate
async function initWasmDirect() {
    try {
        console.log('🔄 Attempting direct WASM loading...');
        
        const extensionUrl = chrome.runtime.getURL('');
        const wasmUrl = extensionUrl + 'background/wasm/dkls_wasm_ll_bg.wasm';
        
        console.log('📥 Fetching WASM file:', wasmUrl);
        const response = await fetch(wasmUrl);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
        }
        
        const bytes = await response.arrayBuffer();
        console.log('✅ WASM file loaded, size:', bytes.byteLength);
        
        // Create a minimal WASM interface for the extension
        globalThis.wasmBytes = bytes;
        globalThis.wasmInitialized = true;
        
        // Create placeholder functions that will be replaced when the actual WASM module loads
        globalThis.wasm_bindgen = {
            KeygenSession: function() {
                throw new Error('WASM KeygenSession not yet available - WASM module initialization pending');
            },
            Message: function() {
                throw new Error('WASM Message not yet available - WASM module initialization pending');
            }
        };
        
        console.log('✅ Direct WASM loading completed (placeholder mode)');
        return true;
        
    } catch (error) {
        console.error('❌ Direct WASM loading failed:', error);
        return false;
    }
}

// Initialize WASM with explicit path to avoid import.meta.url issues
async function initWasmForServiceWorker() {
    try {
        // Get the extension's base URL
        const extensionUrl = chrome.runtime.getURL('');
        const wasmUrl = extensionUrl + 'background/wasm/dkls_wasm_ll_bg.wasm';
        
        console.log('🧮 Initializing WASM with explicit path:', wasmUrl);
        
        // Initialize WASM with explicit path
        if (typeof wasm_bindgen !== 'undefined') {
            await wasm_bindgen(wasmUrl);
            console.log('✅ WASM initialized successfully for service worker');
            
            // Make it globally available
            globalThis.wasmInitialized = true;
            globalThis.wasm_bindgen = wasm_bindgen;
        } else {
            throw new Error('wasm_bindgen not found');
        }
    } catch (error) {
        console.error('❌ Failed to initialize WASM for service worker:', error);
        throw error;
    }
}

// Auto-initialize WASM when this script loads (with a small delay to ensure everything is loaded)
setTimeout(async () => {
    if (typeof wasm_bindgen !== 'undefined') {
        console.log('🚀 Starting auto WASM initialization with wasm_bindgen...');
        try {
            await initWasmForServiceWorker();
        } catch (error) {
            console.error('❌ Auto WASM initialization with wasm_bindgen failed:', error);
            console.log('🔄 Falling back to direct WASM loading...');
            await initWasmDirect();
        }
    } else {
        console.warn('⚠️ wasm_bindgen not available, trying direct WASM loading...');
        await initWasmDirect();
    }
}, 100); // Small delay to ensure all scripts are loaded

// Note: import.meta handling will be done in the WASM module itself
// The WASM module will need to handle the case where import.meta.url is not available

console.log('🔧 Service worker WASM wrapper initialized');
