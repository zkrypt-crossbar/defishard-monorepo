/**
 * Recursive Messaging Fix
 * Fixes the infinite retry loop in base-processor.ts lines 122-124
 * When processRound fails, it resets processed=false, causing same round to retry infinitely
 */

console.log('🔧 Loading recursive messaging fix...');

// Track failed rounds to prevent infinite retries
const failedRounds = new Map(); // round -> attempt count
const MAX_RETRY_ATTEMPTS = 2;

// Patch the SDK after it loads to fix the recursive retry issue
function patchSDKRecursiveFix() {
    // Wait for SDK to be available
    if (typeof DeFiShArdSDK === 'undefined') {
        setTimeout(patchSDKRecursiveFix, 100);
        return;
    }
    
    console.log('🔧 Patching SDK to fix recursive messaging...');
    
    // We need to patch the SDK's processor creation to fix the recursive retry bug
    // The issue is in base-processor.ts processMessage method
    const originalSDK = globalThis.DeFiShArdSDK;
    
    // Override SDK constructor to patch processors after creation
    globalThis.DeFiShArdSDK = function(...args) {
        const sdkInstance = new originalSDK(...args);
        
        // Patch the protocol manager to fix processor retry loops
        const originalStartKeygen = sdkInstance.protocolManager?.startKeygen;
        if (originalStartKeygen) {
            sdkInstance.protocolManager.startKeygen = async function(...keygenArgs) {
                const result = await originalStartKeygen.apply(this, keygenArgs);
                
                // Patch the keygen processor to prevent infinite retries
                if (this.keygenProcessor) {
                    patchProcessorRetryLoop(this.keygenProcessor, 'keygen');
                }
                
                return result;
            };
        }
        
        const originalStartSigning = sdkInstance.protocolManager?.startSigning;
        if (originalStartSigning) {
            sdkInstance.protocolManager.startSigning = async function(...signingArgs) {
                const result = await originalStartSigning.apply(this, signingArgs);
                
                // Patch the signing processor to prevent infinite retries
                if (this.signProcessor) {
                    patchProcessorRetryLoop(this.signProcessor, 'signing');
                }
                
                return result;
            };
        }
        
        return sdkInstance;
    };
    
    // Copy static properties
    Object.setPrototypeOf(globalThis.DeFiShArdSDK, originalSDK);
    Object.assign(globalThis.DeFiShArdSDK, originalSDK);
    
    console.log('✅ SDK patched to prevent recursive messaging loops');
}

function patchProcessorRetryLoop(processor, type) {
    if (!processor.processMessage) return;
    
    const originalProcessMessage = processor.processMessage;
    
    processor.processMessage = async function(message) {
        const roundKey = `${type}_${message.round}`;
        
        try {
            // Call original processMessage
            const result = await originalProcessMessage.call(this, message);
            
            // If successful, clear any failure count for this round
            failedRounds.delete(roundKey);
            
            return result;
            
        } catch (error) {
            console.error(`❌ ${type} processor error in round ${message.round}:`, error.message);
            
            // Track failed attempts for this round
            const attempts = (failedRounds.get(roundKey) || 0) + 1;
            failedRounds.set(roundKey, attempts);
            
            if (attempts >= MAX_RETRY_ATTEMPTS) {
                console.error(`🚫 Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached for ${type} round ${message.round}`);
                console.error('🚫 Marking processor as failed to prevent infinite loop');
                
                // Mark processor as complete to stop processing
                this.isComplete = true;
                
                // Emit error event
                this.emit('error', new Error(`${type} failed after ${attempts} attempts: ${error.message}`));
                
                // Don't retry - return empty array
                return [];
            }
            
            console.warn(`⚠️ Retrying ${type} round ${message.round} (attempt ${attempts}/${MAX_RETRY_ATTEMPTS})`);
            
            // Rethrow to maintain original behavior for first retry
            throw error;
        }
    };
    
    console.log(`✅ Patched ${type} processor to limit retries`);
}

// Start patching when this script loads
patchSDKRecursiveFix();

console.log('✅ Recursive messaging fix loaded');
