/**
 * Extension WASM Loader
 * Comprehensive fix for WASM loading in Chrome extension service workers
 */

console.log('🔧 Initializing Extension WASM loader...');

// Override WebAssembly.instantiate to handle URL strings
const originalInstantiate = WebAssembly.instantiate;
WebAssembly.instantiate = async function(moduleOrBytes, importObject) {
    try {
        console.log('🔧 WebAssembly.instantiate called with:', {
            type: typeof moduleOrBytes,
            constructor: moduleOrBytes?.constructor?.name,
            isArrayBuffer: moduleOrBytes instanceof ArrayBuffer,
            isUint8Array: moduleOrBytes instanceof Uint8Array,
            isString: typeof moduleOrBytes === 'string',
            isURL: moduleOrBytes instanceof URL,
            isPromise: moduleOrBytes instanceof Promise,
            isResponse: moduleOrBytes instanceof Response,
            value: typeof moduleOrBytes === 'string' ? moduleOrBytes : `[${typeof moduleOrBytes}]`,
            keys: typeof moduleOrBytes === 'object' ? Object.keys(moduleOrBytes || {}) : 'N/A'
        });
        // If it's a URL object, convert to string and handle FIRST (before string check)
        if (moduleOrBytes instanceof URL || moduleOrBytes?.constructor?.name === 'URL') {
            console.log('🔧 WebAssembly.instantiate called with URL object:', moduleOrBytes.href || moduleOrBytes.toString());
            const urlString = moduleOrBytes.href || moduleOrBytes.toString();
            return WebAssembly.instantiate(urlString, importObject);
        }
        
        // If first argument is a string (URL), fetch it and convert to ArrayBuffer
        if (typeof moduleOrBytes === 'string') {
            console.log('🔧 WebAssembly.instantiate called with URL string:', moduleOrBytes);
            
            let wasmUrl;
            if (moduleOrBytes.endsWith('.wasm')) {
                // Extract filename and redirect to our actual WASM file
                const filename = moduleOrBytes.split('/').pop();
                const actualWasmFile = 'dkls_wasm_ll_bg.wasm';
                const wasmPath = `assets/sdk-bundle/${actualWasmFile}`;
                wasmUrl = chrome.runtime.getURL(wasmPath);
                
                console.log(`🔧 Redirecting WASM: ${filename} → ${actualWasmFile}`);
                console.log('🔧 Fetching REAL WASM from monorepo:', wasmUrl);
                const response = await fetch(wasmUrl);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch REAL WASM: ${response.status} ${response.statusText}`);
                }
                
                const arrayBuffer = await response.arrayBuffer();
                console.log('✅ REAL WASM fetched from monorepo, size:', arrayBuffer.byteLength, 'bytes');
                
                return originalInstantiate(arrayBuffer, importObject);
            } else {
                wasmUrl = moduleOrBytes;
                console.log('🔧 Fetching WASM from direct URL:', wasmUrl);
                const response = await fetch(wasmUrl);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
                }
                
                const arrayBuffer = await response.arrayBuffer();
                console.log('✅ WASM fetched, size:', arrayBuffer.byteLength, 'bytes');
                
                return originalInstantiate(arrayBuffer, importObject);
            }
        }
        
        // If it's a Response object, get the array buffer
        if (moduleOrBytes instanceof Response) {
            console.log('🔧 WebAssembly.instantiate called with Response object, converting to ArrayBuffer');
            const arrayBuffer = await moduleOrBytes.arrayBuffer();
            console.log('✅ Response converted to ArrayBuffer, size:', arrayBuffer.byteLength, 'bytes');
            return originalInstantiate(arrayBuffer, importObject);
        }
        
        // If it's a Promise, await it first
        if (moduleOrBytes instanceof Promise) {
            console.log('🔧 WebAssembly.instantiate called with Promise, awaiting...');
            const resolvedValue = await moduleOrBytes;
            console.log('✅ Promise resolved to:', typeof resolvedValue);
            return WebAssembly.instantiate(resolvedValue, importObject);
        }
        
        // If it's some other object type, try to handle it
        if (typeof moduleOrBytes === 'object' && moduleOrBytes !== null) {
            console.error('❌ WebAssembly.instantiate called with unsupported object type:', {
                constructor: moduleOrBytes.constructor?.name,
                keys: Object.keys(moduleOrBytes),
                proto: Object.getPrototypeOf(moduleOrBytes)?.constructor?.name
            });
            
            // If it looks like it might have a .arrayBuffer() method (like Response)
            if (typeof moduleOrBytes.arrayBuffer === 'function') {
                console.log('🔧 Object has arrayBuffer() method, trying to convert...');
                const arrayBuffer = await moduleOrBytes.arrayBuffer();
                console.log('✅ Object converted to ArrayBuffer, size:', arrayBuffer.byteLength, 'bytes');
                return originalInstantiate(arrayBuffer, importObject);
            }
            
            // If it looks like it might be a buffer already
            if (moduleOrBytes.buffer && moduleOrBytes.byteLength !== undefined) {
                console.log('🔧 Object looks like a typed array, using buffer...');
                return originalInstantiate(moduleOrBytes.buffer, importObject);
            }
            
            throw new Error(`Unsupported moduleOrBytes type: ${typeof moduleOrBytes} (${moduleOrBytes.constructor?.name})`);
        }
        
        // For ArrayBuffer, Uint8Array, or WebAssembly.Module, use original
        return originalInstantiate(moduleOrBytes, importObject);
        
    } catch (error) {
        console.error('❌ WebAssembly.instantiate failed:', error);
        throw error;
    }
};

// Override WebAssembly.instantiateStreaming as well
const originalInstantiateStreaming = WebAssembly.instantiateStreaming;
WebAssembly.instantiateStreaming = async function(source, importObject) {
    try {
        console.log('🔧 WebAssembly.instantiateStreaming called with:', {
            type: typeof source,
            constructor: source?.constructor?.name,
            isResponse: source instanceof Response,
            isPromise: source instanceof Promise,
            value: typeof source === 'string' ? source : `[${typeof source}]`
        });
        
        // If it's a string (URL), convert to fetch response
        if (typeof source === 'string') {
            console.log('🔧 instantiateStreaming with URL string:', source);
            
            let wasmUrl;
            if (source.endsWith('.wasm')) {
                const filename = source.split('/').pop();
                const actualWasmFile = 'dkls_wasm_ll_bg.wasm';
                wasmUrl = chrome.runtime.getURL(`assets/sdk-bundle/${actualWasmFile}`);
                console.log(`🔧 Redirecting streaming WASM: ${filename} → ${actualWasmFile}`);
            } else {
                wasmUrl = source;
            }
            
            console.log('🔧 Fetching WASM for streaming:', wasmUrl);
            const response = fetch(wasmUrl);
            return originalInstantiateStreaming(response, importObject);
        }
        
        // If it's a Promise that resolves to a Response, use it directly
        if (source instanceof Promise) {
            console.log('🔧 instantiateStreaming with Promise, using directly');
            return originalInstantiateStreaming(source, importObject);
        }
        
        // For Response objects, use directly
        return originalInstantiateStreaming(source, importObject);
        
    } catch (error) {
        console.error('❌ WebAssembly.instantiateStreaming failed:', error);
        throw error;
    }
};

// Override URL constructor for WASM files
const originalURL = globalThis.URL;
globalThis.URL = function(url, base) {
    // Handle WASM file construction with undefined/empty base
    if (typeof url === 'string' && url.endsWith('.wasm') && (!base || base === '' || base === undefined)) {
        // Redirect to our actual WASM file
        const filename = url.split('/').pop();
        const actualWasmFile = 'dkls_wasm_ll_bg.wasm';
        const wasmUrl = chrome.runtime.getURL(`assets/sdk-bundle/${actualWasmFile}`);
        console.log(`🔧 URL constructor redirected WASM: ${filename} → ${actualWasmFile}`);
        console.log('🔧 Final WASM URL:', wasmUrl);
        return new originalURL(wasmUrl);
    }
    
    // For all other cases, use original constructor
    if (base !== undefined) {
        return new originalURL(url, base);
    } else {
        return new originalURL(url);
    }
};

// Copy properties from original URL
Object.setPrototypeOf(globalThis.URL.prototype, originalURL.prototype);
Object.setPrototypeOf(globalThis.URL, originalURL);

// Override fetch for WASM files as backup
const originalFetch = globalThis.fetch;
globalThis.fetch = async function(url, options) {
    if (typeof url === 'string' && url.endsWith('.wasm')) {
        const filename = url.split('/').pop();
        const actualWasmFile = 'dkls_wasm_ll_bg.wasm';
        const wasmUrl = chrome.runtime.getURL(`assets/sdk-bundle/${actualWasmFile}`);
        console.log(`🔧 Fetch redirected WASM: ${filename} → ${actualWasmFile}`);
        console.log('🔧 Final WASM URL:', wasmUrl);
        return originalFetch(wasmUrl, options);
    }
    
    if (url instanceof URL && url.pathname.endsWith('.wasm')) {
        const filename = url.pathname.split('/').pop();
        const actualWasmFile = 'dkls_wasm_ll_bg.wasm';
        const wasmUrl = chrome.runtime.getURL(`assets/sdk-bundle/${actualWasmFile}`);
        console.log(`🔧 Fetch redirected WASM URL object: ${filename} → ${actualWasmFile}`);
        console.log('🔧 Final WASM URL:', wasmUrl);
        return originalFetch(wasmUrl, options);
    }
    
    return originalFetch(url, options);
};

// Mock import.meta for extension environment
if (typeof globalThis.import === 'undefined') {
    globalThis.import = {};
}
if (typeof globalThis.import.meta === 'undefined') {
    globalThis.import.meta = {
        url: chrome.runtime.getURL('background/extension-background.js')
    };
}

console.log('✅ Extension WASM loader initialized with comprehensive overrides:');
console.log('  - WebAssembly.instantiate (handles strings, URLs, Responses, Promises, objects)');
console.log('  - WebAssembly.instantiateStreaming (handles streaming WASM loading)');
console.log('  - URL constructor (redirects WASM files to real monorepo sources)');
console.log('  - fetch override (redirects WASM requests to real monorepo sources)');
console.log('  - import.meta polyfill (for service worker compatibility)');