/**
 * Base64 Stack Overflow Fix
 * Fixes stack overflow in String.fromCharCode.apply() for large arrays
 * WITHOUT changing message signatures or formats
 */

console.log('🔧 Loading base64 stack overflow fix...');

// Store original methods
const originalFromCharCode = String.fromCharCode;

// Safe function for large byte arrays without modifying global String.fromCharCode
function safeFromCharCode(bytes) {
    if (bytes.length > 65536) {
        console.log('🔄 Processing large fromCharCode:', bytes.length, 'bytes');
        
        let result = '';
        const chunkSize = 32768;
        
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.slice(i, i + chunkSize);
            result += originalFromCharCode.apply(null, chunk);
        }
        
        console.log('✅ Large fromCharCode completed');
        return result;
    } else {
        // For normal size, use original method
        return originalFromCharCode.apply(null, bytes);
    }
}

// Patch SDK after it loads to fix the specific bytesToBase64 issue
function patchSDKBase64Fix() {
    if (typeof DeFiShArdSDK === 'undefined') {
        setTimeout(patchSDKBase64Fix, 100);
        return;
    }
    
    console.log('🔧 Patching SDK base64 conversion for large data...');
    
    const originalSDK = globalThis.DeFiShArdSDK;
    
    globalThis.DeFiShArdSDK = function(...args) {
        const sdkInstance = new originalSDK(...args);
        
        // Patch protocol manager to fix processors
        const originalStartKeygen = sdkInstance.protocolManager?.startKeygen;
        if (originalStartKeygen) {
            sdkInstance.protocolManager.startKeygen = async function(...keygenArgs) {
                const result = await originalStartKeygen.apply(this, keygenArgs);
                
                if (this.keygenProcessor) {
                    patchProcessorBase64(this.keygenProcessor);
                }
                
                return result;
            };
        }
        
        const originalStartSigning = sdkInstance.protocolManager?.startSigning;
        if (originalStartSigning) {
            sdkInstance.protocolManager.startSigning = async function(...signingArgs) {
                const result = await originalStartSigning.apply(this, signingArgs);
                
                if (this.signProcessor) {
                    patchProcessorBase64(this.signProcessor);
                }
                
                return result;
            };
        }
        
        return sdkInstance;
    };
    
    // Copy static properties
    Object.setPrototypeOf(globalThis.DeFiShArdSDK, originalSDK);
    Object.assign(globalThis.DeFiShArdSDK, originalSDK);
    
    console.log('✅ SDK patched for base64 large data handling');
}

function patchProcessorBase64(processor) {
    if (!processor || !processor.bytesToBase64) return;
    
    const originalBytesToBase64 = processor.bytesToBase64;
    
    processor.bytesToBase64 = function(bytes) {
        try {
            // The original method likely uses String.fromCharCode.apply(null, bytes)
            // which causes stack overflow for large arrays
            
            if (bytes.length > 65536) {
                console.log('🔄 Safe base64 encoding for large data:', bytes.length, 'bytes');
                
                // Use our safe function instead of String.fromCharCode.apply
                const binaryString = safeFromCharCode(bytes);
                const result = btoa(binaryString);
                
                console.log('✅ Large data base64 encoded successfully');
                return result;
            } else {
                // For normal size, use original method
                return originalBytesToBase64.call(this, bytes);
            }
        } catch (error) {
            console.error('❌ bytesToBase64 error:', error);
            throw error;
        }
    };
    
    console.log('✅ Processor base64 conversion patched');
}

// Start patching when this script loads
patchSDKBase64Fix();

console.log('✅ Base64 stack overflow fix loaded');
