// Hybrid Chrome Extension Background Script
// Delegates SDK operations to content script running in browser context
console.log('🌉 Starting hybrid background script...');

// Default configuration
const DEFAULT_CONFIG = {
    relayerUrl: 'http://68.183.230.178:3000',
    websocketUrl: 'ws://68.183.230.178:3000',
    debug: false
};

// Current configuration (will be loaded from storage)
let CONFIG = { ...DEFAULT_CONFIG };

// Extension state
let extensionState = {
    partyId: null,
    apiKey: null,
    isRegistered: false,
    groupMonitoring: {
        active: false,
        groupId: null,
        interval: null,
        requiredParties: 0,
        threshold: 0
    },
    keygenState: {
        active: false,
        groupInfo: null
    }
};

// Content script delegation
let contentScriptReady = false;

// Extension Storage Adapter for SDK
class ExtensionStorageAdapter {
    async getItem(key) {
        try {
            const result = await chrome.storage.local.get([key]);
            return result[key] || null;
        } catch (error) {
            console.error('Storage getItem error:', error);
            return null;
        }
    }
    
    async setItem(key, value) {
        try {
            await chrome.storage.local.set({ [key]: value });
        } catch (error) {
            console.error('Storage setItem error:', error);
            throw error;
        }
    }
    
    async removeItem(key) {
        try {
            await chrome.storage.local.remove([key]);
        } catch (error) {
            console.error('Storage removeItem error:', error);
            throw error;
        }
    }
    
    async clear() {
        try {
            await chrome.storage.local.clear();
        } catch (error) {
            console.error('Storage clear error:', error);
            throw error;
        }
    }
}

// Simple message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received:', message);
    
    if (message.type === 'TEST_CONNECTION') {
        sendResponse({
            success: true,
            message: 'Minimal background is working!'
        });
    } else if (message.type === 'REGISTER_PARTY') {
        console.log('Delegating party registration to content script...');
        delegateToContentScript('SDK_REGISTER', {}, sendResponse);
        return true;
    } else if (message.type === 'CREATE_GROUP') {
        console.log('Delegating group creation to content script...');
        delegateToContentScript('SDK_CREATE_GROUP', message.data, sendResponse);
        return true;
    } else if (message.type === 'SETTINGS_UPDATED') {
        console.log('Settings updated:', message.settings);
        handleSettingsUpdate(message.settings, sendResponse);
        return true;
    } else if (message.type === 'GET_SETTINGS') {
        sendResponse({
            success: true,
            settings: CONFIG
        });
    } else if (message.type === 'START_GROUP_MONITORING') {
        console.log('Starting group monitoring:', message.data);
        handleStartGroupMonitoring(message.data, sendResponse);
        return true;
    } else if (message.type === 'STOP_GROUP_MONITORING') {
        console.log('Stopping group monitoring');
        handleStopGroupMonitoring(sendResponse);
        return true;
                } else if (message.type === 'START_KEYGEN') {
        console.log('Delegating keygen to content script...');
        delegateToContentScript('SDK_START_KEYGEN', message.data, sendResponse);
        return true;
    } else if (message.type === 'SET_QR_ENCRYPTION_KEY') {
        console.log('Delegating encryption key setting to content script...');
        delegateToContentScript('SDK_SET_ENCRYPTION_KEY', message.data, sendResponse);
        return true;
    } else if (message.type === 'SDK_EVENT_FROM_CONTENT') {
        // Handle events forwarded from content script
        console.log('📨 Event from content script:', message.event);
        broadcastToPopup(message.event.toUpperCase().replace('-', '_'), message.data);
        return true;
    } else if (message.type === 'STORAGE_GET' || message.type === 'STORAGE_SET' || 
               message.type === 'STORAGE_REMOVE' || message.type === 'STORAGE_CLEAR') {
        // Handle storage operations for content script
        handleStorageOperation(message, sendResponse);
        return true;
        
    } else {
        sendResponse({
            success: false,
            message: 'Unknown message type: ' + message.type
        });
    }
    
    return true;
});

// Delegate function to content script running in browser context
async function delegateToContentScript(type, data, sendResponse) {
    try {
        // Find active tab to send message to content script
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tabs.length === 0) {
            sendResponse({
                success: false,
                error: 'No active tab found'
            });
            return;
        }
        
        const tabId = tabs[0].id;
        
        // Send message to content script
        chrome.tabs.sendMessage(tabId, {
            type: type,
            data: data
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('❌ Content script communication error:', chrome.runtime.lastError);
                sendResponse({
                    success: false,
                    error: 'Content script not available: ' + chrome.runtime.lastError.message
                });
            } else {
                sendResponse(response);
            }
        });
        
    } catch (error) {
        console.error('❌ Delegation failed:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// Handle storage operations for content script
async function handleStorageOperation(message, sendResponse) {
    try {
        const { type, key, value } = message;
        
        switch (type) {
            case 'STORAGE_GET':
                const result = await chrome.storage.local.get([key]);
                sendResponse({ success: true, value: result[key] || null });
                break;
                
            case 'STORAGE_SET':
                await chrome.storage.local.set({ [key]: value });
                sendResponse({ success: true });
                break;
                
            case 'STORAGE_REMOVE':
                await chrome.storage.local.remove([key]);
                sendResponse({ success: true });
                break;
                
            case 'STORAGE_CLEAR':
                await chrome.storage.local.clear();
                sendResponse({ success: true });
                break;
                
            default:
                sendResponse({ success: false, error: 'Unknown storage operation' });
        }
        
    } catch (error) {
        console.error('❌ Storage operation failed:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Initialize content script with current configuration
async function initializeContentScript() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'INIT_CONTENT_SDK',
                data: CONFIG
            });
        }
    } catch (error) {
        console.log('Content script not ready yet:', error.message);
    }
}

// Group monitoring via content script delegation
async function checkGroupStatus() {
    if (!extensionState.groupMonitoring.active || !extensionState.groupMonitoring.groupId) {
        return;
    }
    
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'SDK_GET_GROUP_INFO',
                data: { groupId: extensionState.groupMonitoring.groupId }
            }, (response) => {
                if (response?.success) {
                    const groupInfo = response.data;
                    console.log(`👥 Group status: ${groupInfo.members.length}/${extensionState.groupMonitoring.requiredParties} members`);
                    
                    broadcastToPopup('GROUP_MEMBER_UPDATE', {
                        currentMembers: groupInfo.members.length,
                        requiredMembers: extensionState.groupMonitoring.requiredParties,
                        members: groupInfo.members
                    });
                    
                    if (groupInfo.members.length >= extensionState.groupMonitoring.requiredParties) {
                        console.log('✅ All parties joined! Starting keygen...');
                        clearInterval(extensionState.groupMonitoring.interval);
                        extensionState.groupMonitoring.active = false;
                        
                        broadcastToPopup('ALL_PARTIES_JOINED', {
                            groupInfo: groupInfo,
                            message: 'All parties joined! Starting key generation...'
                        });
                        
                        setTimeout(() => {
                            delegateToContentScript('SDK_START_KEYGEN', { 
                                groupInfo: groupInfo,
                                isCreator: true 
                            }, () => {});
                        }, 2000);
                    }
                }
            });
        }
    } catch (error) {
        console.error('❌ Error checking group status:', error);
    }
}

// Settings management
async function loadSettings() {
    try {
        const stored = await chrome.storage.local.get(['relayerUrl', 'websocketUrl', 'debug']);
        CONFIG = { ...DEFAULT_CONFIG, ...stored };
        console.log('📂 Settings loaded:', CONFIG);
    } catch (error) {
        console.error('❌ Failed to load settings:', error);
    }
}

function handleSettingsUpdate(newSettings, sendResponse) {
    try {
        CONFIG = { ...CONFIG, ...newSettings };
        console.log('⚙️ Configuration updated:', CONFIG);
        
        // Reinitialize content script with new config
        initializeContentScript();
        
        sendResponse({
            success: true,
            message: 'Settings updated successfully'
        });
    } catch (error) {
        console.error('❌ Failed to update settings:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// Group monitoring functions
async function handleStartGroupMonitoring(data, sendResponse) {
    try {
        console.log('🔍 Starting group monitoring for:', data.groupId);
        
        if (extensionState.groupMonitoring.interval) {
            clearInterval(extensionState.groupMonitoring.interval);
        }
        
        extensionState.groupMonitoring = {
            active: true,
            groupId: data.groupId,
            requiredParties: data.totalParties,
            threshold: data.threshold,
            interval: null
        };
        
        extensionState.groupMonitoring.interval = setInterval(async () => {
            await checkGroupStatus();
        }, 200);
        
        await checkGroupStatus();
        
        sendResponse({
            success: true,
            message: 'Group monitoring started'
        });
        
    } catch (error) {
        console.error('❌ Failed to start group monitoring:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

function handleStopGroupMonitoring(sendResponse) {
    try {
        if (extensionState.groupMonitoring.interval) {
            clearInterval(extensionState.groupMonitoring.interval);
        }
        
        extensionState.groupMonitoring = {
            active: false,
            groupId: null,
            interval: null,
            requiredParties: 0,
            threshold: 0
        };
        
        console.log('⏹️ Group monitoring stopped');
        
        sendResponse({
            success: true,
            message: 'Group monitoring stopped'
        });
        
    } catch (error) {
        console.error('❌ Failed to stop group monitoring:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// Utility function to broadcast messages to popup
function broadcastToPopup(type, data) {
    try {
        chrome.runtime.sendMessage({
            type: type,
            data: data,
            timestamp: new Date().toISOString()
        }).catch(() => {
            console.log('No popup receivers for:', type);
        });
    } catch (error) {
        console.log('Failed to broadcast to popup:', error.message);
    }
}

// Initialize background script
async function initialize() {
    await loadSettings();
    setTimeout(initializeContentScript, 1000); // Give content script time to load
    console.log('✅ Hybrid background script initialized');
}

// Start initialization
initialize();
        if (typeof DeFiShArdSDK === 'undefined') {
            throw new Error('Real DeFiShArdSDK not available after import');
        }
        
        const sdkConfig = {
            relayerUrl: CONFIG.relayerUrl,
            websocketUrl: CONFIG.websocketUrl,
            storage: new ExtensionStorageAdapter(),
            debug: CONFIG.debug || true
        };
        
        console.log('🔧 Creating SDK with config:', sdkConfig);
        realSDK = new DeFiShArdSDK(sdkConfig);
        
        // Initialize the SDK
        await realSDK.initialize();
        
        // Minimal debugging - just log critical errors
        if (realSDK.protocolManager) {
            const originalHandleProcessorError = realSDK.protocolManager.handleProcessorError;
            if (originalHandleProcessorError) {
                realSDK.protocolManager.handleProcessorError = function(error, type) {
                    console.error('❌ SDK Error:', error.message);
                    return originalHandleProcessorError.call(this, error, type);
                };
            }
        }
        
        // Set up SDK event listeners (bridge style)
        realSDK.on('keygen-progress', (data) => {
            console.log('📊 Keygen progress event:', data);
            broadcastToPopup('KEYGEN_PROGRESS', {
                progress: data.progress || 0,
                message: data.message || 'Key generation in progress...',
                round: data.round
            });
        });
        
        sdkInitialized = true;
        console.log('✅ Real SDK initialized with event listeners');
        
        return realSDK;
        
    } catch (error) {
        console.error('❌ Failed to initialize real SDK:', error);
        throw new Error(`SDK initialization failed: ${error.message}`);
    }
}

// Real SDK setup complete - no simulation needed

async function loadSDKBundle() {
    // No external bundle needed - we use SimpleExtensionSDK
    console.log('✅ Using built-in SimpleExtensionSDK');
}

function setupSDKEventListeners() {
    if (!realSDK) return;
    
    try {
        // Listen for keygen progress events (like web app)
        realSDK.on('keygen-progress', (data) => {
            console.log('📊 Keygen progress:', data);
            broadcastToPopup('KEYGEN_PROGRESS', {
                progress: data.progress || 0,
                message: data.message || 'Key generation in progress...',
                round: data.round
            });
        });
        
        realSDK.on('keygen-complete', async (keyshare) => {
            console.log('🎉 REAL keygen completed via event:', keyshare);
            console.log('💾 Keyshare saved to storage automatically by SDK (like web app)');
            
            try {
                // NOTE: No manual saving needed - SDK already saves keyshare automatically
                // Just notify popup of completion (like web app does)
                broadcastToPopup('KEYGEN_COMPLETED', {
                    success: true,
                    message: 'Key generation completed successfully!',
                    keyshare: {
                        publicKey: keyshare.publicKey,
                        groupId: extensionState.keygenState.groupInfo?.group_id,
                        threshold: extensionState.groupMonitoring.threshold,
                        totalParties: extensionState.groupMonitoring.requiredParties,
                        partyId: extensionState.partyId,
                        keyshareData: keyshare // Full keyshare for reference
                    }
                });
                
                // Reset keygen state
                extensionState.keygenState.active = false;
                
            } catch (error) {
                console.error('❌ Failed to handle keygen completion:', error);
                broadcastToPopup('KEYGEN_ERROR', {
                    error: error.message
                });
                extensionState.keygenState.active = false;
            }
        });
        
        realSDK.on('keygen-error', (error) => {
            console.error('❌ Keygen error via event:', error);
            console.error('❌ Error details:', error.message, error.stack);
            console.error('❌ This error likely caused processor cleanup!');
            broadcastToPopup('KEYGEN_ERROR', {
                error: error.message || error
            });
        });
        
        realSDK.on('error', (error) => {
            console.error('❌ General SDK error:', error);
            console.error('❌ Error details:', error.message, error.stack);
            console.error('❌ This error might cause processor cleanup!');
        });
        
        realSDK.on('disconnected', () => {
            console.warn('⚠️ WebSocket disconnected - this might cause processor cleanup');
        });
        
        realSDK.on('round-complete', (data) => {
            console.log('🔄 Round completed:', data.round);
            broadcastToPopup('KEYGEN_PROGRESS', {
                progress: (data.round / 5) * 100, // Assuming 5 rounds
                message: `Round ${data.round} completed`,
                round: data.round
            });
        });
        
        console.log('✅ SDK event listeners set up');
        
    } catch (error) {
        console.error('❌ Failed to setup SDK event listeners:', error);
    }
}

// NOTE: saveKeyshareToStorage function removed - SDK automatically saves keyshares
// The SDK handles saving via the storage adapter passed in constructor (ExtensionStorageAdapter)

// Settings management
async function loadSettings() {
    try {
        const stored = await chrome.storage.local.get([
            'relayerUrl', 'websocketUrl', 'debug'
        ]);
        
        CONFIG = { ...DEFAULT_CONFIG, ...stored };
        console.log('📂 Settings loaded:', CONFIG);
    } catch (error) {
        console.error('❌ Failed to load settings:', error);
    }
}

function handleSettingsUpdate(newSettings, sendResponse) {
    try {
        CONFIG = { ...CONFIG, ...newSettings };
        console.log('⚙️ Configuration updated:', CONFIG);
        
        // Reset registration state if URLs changed
        if (newSettings.relayerUrl || newSettings.websocketUrl) {
            extensionState.isRegistered = false;
            extensionState.apiKey = null;
            extensionState.partyId = null;
            console.log('🔄 Registration state reset due to URL change');
        }
        
        sendResponse({
            success: true,
            message: 'Settings updated successfully'
        });
    } catch (error) {
        console.error('❌ Failed to update settings:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// Initialize background script
async function initializeBackground() {
    await loadSettings();
    console.log('✅ Background script initialized with settings');
}

// Group monitoring functions
async function handleStartGroupMonitoring(data, sendResponse) {
    try {
        console.log('🔍 Starting group monitoring for:', data.groupId);
        
        // Stop any existing monitoring
        if (extensionState.groupMonitoring.interval) {
            clearInterval(extensionState.groupMonitoring.interval);
        }
        
        // Setup monitoring state
        extensionState.groupMonitoring = {
            active: true,
            groupId: data.groupId,
            requiredParties: data.totalParties,
            threshold: data.threshold,
            interval: null
        };
        
        // Start polling for group status (200ms like web app)
        extensionState.groupMonitoring.interval = setInterval(async () => {
            await checkGroupStatus();
        }, 200); // Check every 200ms like web app
        
        // Initial check
        await checkGroupStatus();
        
        sendResponse({
            success: true,
            message: 'Group monitoring started'
        });
        
    } catch (error) {
        console.error('❌ Failed to start group monitoring:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

function handleStopGroupMonitoring(sendResponse) {
    try {
        if (extensionState.groupMonitoring.interval) {
            clearInterval(extensionState.groupMonitoring.interval);
        }
        
        extensionState.groupMonitoring = {
            active: false,
            groupId: null,
            interval: null,
            requiredParties: 0,
            threshold: 0
        };
        
        console.log('⏹️ Group monitoring stopped');
        
        sendResponse({
            success: true,
            message: 'Group monitoring stopped'
        });
        
    } catch (error) {
        console.error('❌ Failed to stop group monitoring:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

async function checkGroupStatus() {
    if (!extensionState.groupMonitoring.active || !extensionState.groupMonitoring.groupId) {
        return;
    }
    
    try {
        // Ensure SDK is initialized
        await ensureSDKInitialized();
        
        // Get current group info using bridge SDK
        const groupInfo = await realSDK.apiClient.getGroupInfo(extensionState.groupMonitoring.groupId);
        console.log(`👥 Group status: ${groupInfo.members.length}/${extensionState.groupMonitoring.requiredParties} members`);
        
        // Notify popup of member count update
        broadcastToPopup('GROUP_MEMBER_UPDATE', {
            currentMembers: groupInfo.members.length,
            requiredMembers: extensionState.groupMonitoring.requiredParties,
            members: groupInfo.members
        });
        
        // Check if we have enough members to start keygen
        if (groupInfo.members.length >= extensionState.groupMonitoring.requiredParties) {
            console.log('✅ All parties joined! Starting keygen...');
            
            // Stop monitoring
            clearInterval(extensionState.groupMonitoring.interval);
            extensionState.groupMonitoring.active = false;
            
            // Notify popup that keygen is starting
            broadcastToPopup('ALL_PARTIES_JOINED', {
                groupInfo: groupInfo,
                message: 'All parties joined! Starting key generation...'
            });
            
            // Start keygen process (for now, just notify - will implement actual keygen next)
            setTimeout(() => {
                startKeygenProcess(groupInfo);
            }, 2000); // Give UI time to update
        }
        
    } catch (error) {
        console.error('❌ Error checking group status:', error);
        
        // Notify popup of error
        broadcastToPopup('GROUP_MONITORING_ERROR', {
            error: error.message
        });
    }
}

        async function startKeygenProcess(groupInfo) {
            try {
                console.log('🔑 Starting REAL keygen process for group:', groupInfo.group_id);
                
                extensionState.keygenState = {
                    active: true,
                    groupInfo: groupInfo
                };
                
                // Initialize the real SDK if not already done
                await ensureSDKInitialized();
                
                // CRITICAL: Set the AES encryption key on the SDK before starting keygen
                // This ensures WebSocket messages are encrypted like the web app
                const storedQRData = await chrome.storage.local.get(['currentQRData']);
                if (storedQRData.currentQRData) {
                    try {
                        const qrData = JSON.parse(storedQRData.currentQRData);
                        if (qrData.aesKey) {
                            console.log('🔐 Setting AES encryption key on SDK for secure WebSocket communication...');
                            const aesKeyBytes = Uint8Array.from(atob(qrData.aesKey), c => c.charCodeAt(0));
                            await realSDK.setEncryptionKey(aesKeyBytes);
                            console.log('✅ AES encryption key set on SDK');
                        } else {
                            console.warn('⚠️ No AES key found in QR data - WebSocket messages will not be encrypted!');
                        }
                    } catch (keyError) {
                        console.error('❌ Failed to set AES encryption key:', keyError);
                        // Continue anyway, but log the error
                    }
                } else {
                    console.warn('⚠️ No QR data found in storage - WebSocket messages will not be encrypted!');
                }
                
                broadcastToPopup('KEYGEN_STARTED', {
                    groupInfo: groupInfo,
                    message: 'Starting REAL distributed key generation...'
                });
                
                // Call REAL SDK startKeygen (exactly like web app)
                // NOTE: startKeygen() doesn't return the keyshare - it emits events!
                console.log('🔧 Calling REAL SDK.startKeygen(true) - NO SIMULATION...');
                await realSDK.startKeygen(true); // true = isCreator
                
                console.log('✅ REAL SDK startKeygen() called - waiting for keygen-complete event...');
                
                // NOTE: The actual keyshare will be received via the 'keygen-complete' event
                // which is already set up in ensureSDKInitialized(). The completion handling
                // is done in the event listener, not here.
                
            } catch (error) {
                console.error('❌ Real keygen process failed:', error);
                
                broadcastToPopup('KEYGEN_ERROR', {
                    error: error.message
                });
                
                extensionState.keygenState.active = false;
            }
        }

        async function handleStartKeygen(data, sendResponse) {
            try {
                console.log('🔑 Manual keygen start requested');
                await startKeygenProcess(data.groupInfo);
                
                sendResponse({
                    success: true,
                    message: 'Keygen process started'
                });
                
            } catch (error) {
                console.error('❌ Failed to start keygen:', error);
                sendResponse({
                    success: false,
                    error: error.message
                });
            }
        }

        async function handleSetQREncryptionKey(data, sendResponse) {
            try {
                console.log('🔐 Setting AES encryption key on SDK from QR data...');
                
                await ensureSDKInitialized();
                
                if (!data.aesKey) {
                    throw new Error('No AES key provided in QR data');
                }
                
                const aesKeyBytes = Uint8Array.from(atob(data.aesKey), c => c.charCodeAt(0));
                await realSDK.setEncryptionKey(aesKeyBytes);
                
                console.log('✅ AES encryption key set on SDK for secure WebSocket communication');
                
                sendResponse({
                    success: true,
                    message: 'Encryption key set successfully'
                });
                
            } catch (error) {
                console.error('❌ Failed to set encryption key:', error);
                sendResponse({
                    success: false,
                    error: error.message
                });
            }
        }



// Utility function to broadcast messages to popup
function broadcastToPopup(type, data) {
    try {
        chrome.runtime.sendMessage({
            type: type,
            data: data,
            timestamp: new Date().toISOString()
        }).catch(error => {
            // Ignore if no receivers (popup might be closed)
            console.log('No popup receivers for:', type);
        });
    } catch (error) {
        console.log('Failed to broadcast to popup:', error.message);
    }
}

// Start initialization
initializeBackground();

console.log('✅ Minimal background script loaded successfully');
