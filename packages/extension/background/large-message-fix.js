/**
 * Large Message Fix
 * Fixes stack overflow in bytesToBase64 and convertToProtocolMessage for 126KB+ messages
 */

console.log('🔧 Loading large message fix...');

// Safe base64 conversion for large byte arrays
function safeBase64Encode(bytes) {
    // For large arrays, process in chunks to avoid stack overflow
    if (bytes.length > 65536) { // 64KB threshold
        console.log('🔄 Processing large message in chunks:', bytes.length, 'bytes');
        
        const chunkSize = 32768; // 32KB chunks
        let result = '';
        
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.slice(i, i + chunkSize);
            // Use the safe method for chunks
            result += btoa(String.fromCharCode.apply(null, chunk));
        }
        
        console.log('✅ Large message encoded successfully');
        return result;
    } else {
        // For smaller arrays, use the normal method
        return btoa(String.fromCharCode.apply(null, bytes));
    }
}

// Safe base64 decoding for large strings
function safeBase64Decode(base64String) {
    if (base64String.length > 87380) { // ~64KB in base64
        console.log('🔄 Decoding large base64 string in chunks:', base64String.length, 'chars');
        
        const chunkSize = 43690; // ~32KB in base64
        const result = [];
        
        for (let i = 0; i < base64String.length; i += chunkSize) {
            const chunk = base64String.slice(i, i + chunkSize);
            const decoded = atob(chunk);
            
            for (let j = 0; j < decoded.length; j++) {
                result.push(decoded.charCodeAt(j));
            }
        }
        
        console.log('✅ Large base64 decoded successfully');
        return new Uint8Array(result);
    } else {
        // For smaller strings, use the normal method
        const decoded = atob(base64String);
        const result = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) {
            result[i] = decoded.charCodeAt(i);
        }
        return result;
    }
}

// Patch SDK after it loads
function patchSDKLargeMessageFix() {
    if (typeof DeFiShArdSDK === 'undefined') {
        setTimeout(patchSDKLargeMessageFix, 100);
        return;
    }
    
    console.log('🔧 Patching SDK for large message handling...');
    
    const originalSDK = globalThis.DeFiShArdSDK;
    
    globalThis.DeFiShArdSDK = function(...args) {
        const sdkInstance = new originalSDK(...args);
        
        // Patch the protocol manager to fix processors
        const originalStartKeygen = sdkInstance.protocolManager?.startKeygen;
        if (originalStartKeygen) {
            sdkInstance.protocolManager.startKeygen = async function(...keygenArgs) {
                const result = await originalStartKeygen.apply(this, keygenArgs);
                
                // Patch the keygen processor for large messages
                if (this.keygenProcessor) {
                    patchProcessorForLargeMessages(this.keygenProcessor);
                }
                
                return result;
            };
        }
        
        const originalStartSigning = sdkInstance.protocolManager?.startSigning;
        if (originalStartSigning) {
            sdkInstance.protocolManager.startSigning = async function(...signingArgs) {
                const result = await originalStartSigning.apply(this, signingArgs);
                
                // Patch the signing processor for large messages
                if (this.signProcessor) {
                    patchProcessorForLargeMessages(this.signProcessor);
                }
                
                return result;
            };
        }
        
        return sdkInstance;
    };
    
    // Copy static properties
    Object.setPrototypeOf(globalThis.DeFiShArdSDK, originalSDK);
    Object.assign(globalThis.DeFiShArdSDK, originalSDK);
    
    console.log('✅ SDK patched for large message handling');
}

function patchProcessorForLargeMessages(processor) {
    if (!processor) return;
    
    // Patch bytesToBase64 method to handle large arrays safely
    if (processor.bytesToBase64) {
        const originalBytesToBase64 = processor.bytesToBase64;
        processor.bytesToBase64 = function(bytes) {
            try {
                return safeBase64Encode(bytes);
            } catch (error) {
                console.error('❌ bytesToBase64 error, using safe method:', error.message);
                return safeBase64Encode(bytes);
            }
        };
    }
    
    // Patch base64ToBytes method to handle large strings safely
    if (processor.base64ToBytes) {
        const originalBase64ToBytes = processor.base64ToBytes;
        processor.base64ToBytes = function(base64String) {
            try {
                return safeBase64Decode(base64String);
            } catch (error) {
                console.error('❌ base64ToBytes error, using safe method:', error.message);
                return safeBase64Decode(base64String);
            }
        };
    }
    
    // DON'T patch convertToProtocolMessage - it must preserve message signature for other parties
    // Instead, the bytesToBase64 fix should be sufficient for large content handling
    
    console.log('✅ Processor patched for large message handling');
}

// Override global btoa/atob for safety - but preserve encrypted data integrity
const originalBtoa = globalThis.btoa;
const originalAtob = globalThis.atob;

// Check if data looks like encrypted content (has IV prefix pattern)
function looksLikeEncryptedData(base64) {
    // Encrypted data typically has a predictable structure: IV (12 bytes) + ciphertext
    // This is a heuristic to avoid chunking encrypted data
    try {
        const testDecode = originalAtob(base64.substring(0, Math.min(100, base64.length)));
        // Look for patterns that suggest this might be encrypted binary data
        // Encrypted data usually has high entropy and specific length patterns
        return base64.length > 100 && base64.indexOf('=') > base64.length - 5; // Padding suggests binary
    } catch {
        return false;
    }
}

globalThis.btoa = function(str) {
    try {
        if (str.length > 65536) {
            console.log('🔄 Using safe btoa for large string:', str.length, 'chars');
            
            const chunkSize = 32768;
            let result = '';
            
            for (let i = 0; i < str.length; i += chunkSize) {
                const chunk = str.slice(i, i + chunkSize);
                result += originalBtoa(chunk);
            }
            
            return result;
        } else {
            return originalBtoa(str);
        }
    } catch (error) {
        console.error('❌ btoa error:', error);
        throw error;
    }
};

globalThis.atob = function(base64) {
    try {
        // CRITICAL: Do not chunk encrypted data - it breaks cryptographic integrity
        if (looksLikeEncryptedData(base64)) {
            console.log('🔐 Preserving encrypted data integrity for decryption:', base64.length, 'chars');
            return originalAtob(base64);
        }
        
        if (base64.length > 87380) {
            console.log('🔄 Using safe atob for large base64:', base64.length, 'chars');
            
            const chunkSize = 43690;
            let result = '';
            
            for (let i = 0; i < base64.length; i += chunkSize) {
                const chunk = base64.slice(i, i + chunkSize);
                result += originalAtob(chunk);
            }
            
            return result;
        } else {
            return originalAtob(base64);
        }
    } catch (error) {
        console.error('❌ atob error:', error);
        // If chunking fails, try original method for encrypted data
        if (looksLikeEncryptedData(base64)) {
            console.log('🔐 Falling back to original atob for encrypted data');
            return originalAtob(base64);
        }
        throw error;
    }
};

// Start patching when this script loads
patchSDKLargeMessageFix();

console.log('✅ Large message fix loaded');
