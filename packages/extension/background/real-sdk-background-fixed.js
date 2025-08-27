// Real SDK Chrome Extension Background Script with Recursive Fix
console.log('Starting real SDK background script with recursive messaging fix...');

// Load comprehensive service worker polyfills first
try {
    importScripts('service-worker-polyfill.js');
    console.log('✅ Service worker polyfills loaded');
} catch (error) {
    console.error('❌ Failed to load service worker polyfills:', error);
}

// Load recursive messaging fix BEFORE SDK
try {
    importScripts('recursive-messaging-fix.js');
    console.log('✅ Recursive messaging fix loaded');
} catch (error) {
    console.error('❌ Failed to load recursive messaging fix:', error);
}

// Load base64 stack overflow fix (preserves message signatures)
try {
    importScripts('base64-stack-fix.js');
    console.log('✅ Base64 stack overflow fix loaded');
} catch (error) {
    console.error('❌ Failed to load base64 stack overflow fix:', error);
}

// Load extension WASM loader and REAL SDK bundle
try {
    importScripts('extension-wasm-loader.js');
    console.log('✅ WASM loader imported');
    
    // Import REAL SDK bundle (built from monorepo)
    importScripts('/assets/sdk-bundle/defishard-sdk-extension.js');
    console.log('✅ REAL DeFiShArd SDK bundle imported - WITH recursive fix!');
} catch (error) {
    console.error('❌ Failed to load REAL SDK bundle:', error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
}

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

// Real SDK instance
let realSDK = null;
let sdkInitialized = false;

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
    
    // Add save method that keygen processor expects
    async save(key, value) {
        console.log('💾 Saving keyshare to extension storage:', key);
        return await this.setItem(key, value);
    }
    
    // Add load method for completeness
    async load(key) {
        console.log('📂 Loading from extension storage:', key);
        return await this.getItem(key);
    }
}

// Simple message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received:', message);
    
    if (message.type === 'TEST_CONNECTION') {
        sendResponse({
            success: true,
            message: 'Real SDK background with recursive fix is working!'
        });
    } else if (message.type === 'REGISTER_PARTY') {
        console.log('Registering party...');
        handleRegisterParty(sendResponse);
        return true; // Keep channel open for async response
    } else if (message.type === 'CREATE_GROUP') {
        console.log('Creating group with data:', message.data);
        handleCreateGroup(message.data, sendResponse);
        return true; // Keep channel open for async response
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
        console.log('Starting keygen process:', message.data);
        handleStartKeygen(message.data, sendResponse);
        return true;
    } else if (message.type === 'SET_QR_ENCRYPTION_KEY') {
        console.log('Setting QR encryption key on SDK...');
        handleSetQREncryptionKey(message.data, sendResponse);
        return true;        
    } else {
        sendResponse({
            success: false,
            message: 'Unknown message type: ' + message.type
        });
    }
    
    return true;
});

// Group creation handler
async function handleCreateGroup(data, sendResponse) {
    try {
        console.log('🔧 Creating group with config:', data);
        
        // Initialize real SDK for group creation
        await ensureSDKInitialized();
        
        // Use REAL SDK to register party and create group (exactly like web app)
        if (!extensionState.isRegistered) {
            console.log('🔧 Registering party with REAL SDK...');
            const registration = await realSDK.register();
            extensionState.partyId = registration.partyId;
            extensionState.apiKey = registration.token;
            extensionState.isRegistered = true;
            console.log('✅ Party registered via REAL SDK:', extensionState.partyId);
        }
        
        // Create group using REAL SDK (exactly like web app does)
        console.log('🔧 Creating group with REAL SDK...');
        const groupResult = await realSDK.createGroup(data.threshold, data.totalParties, data.timeoutMinutes || 60);
        
        console.log('✅ Group created via SDK:', groupResult);
        
        sendResponse({
            success: true,
            group: {
                groupId: groupResult.group?.groupId || groupResult.groupId,
                totalParties: data.totalParties,
                threshold: data.threshold,
                timeout: data.timeoutMinutes,
                members: groupResult.group?.members || [],
                status: groupResult.group?.status || 'created'
            }
        });
        
    } catch (error) {
        console.error('❌ Group creation failed:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// Party registration handler
async function handleRegisterParty(sendResponse) {
    try {
        console.log('🔧 Registering party...');
        await ensureSDKInitialized();
        
        const result = await realSDK.register();
        console.log('✅ Party registered via SDK:', result);
        
        // Update extension state
        extensionState.partyId = result.partyId;
        extensionState.apiKey = result.token;
        extensionState.isRegistered = true;
        
        sendResponse({
            success: true,
            partyId: result.partyId,
            token: result.token,
            message: 'Party registered successfully'
        });
        
    } catch (error) {
        console.error('❌ Party registration failed:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// Real SDK initialization and management
async function ensureSDKInitialized() {
    if (sdkInitialized && realSDK) {
        return realSDK;
    }
    
    try {
        console.log('🔧 Initializing real SDK with recursive fix...');
        
        // Create REAL SDK instance (like web app does)
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
        
        // Set up SDK event listeners (bridge style)
        realSDK.on('keygen-progress', (data) => {
            console.log('📊 Keygen progress event:', data);
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
            broadcastToPopup('KEYGEN_ERROR', {
                error: error.message || error
            });
        });
        
        realSDK.on('error', (error) => {
            console.error('❌ General SDK error:', error);
        });
        
        realSDK.on('round-complete', (data) => {
            console.log('🔄 Round completed:', data.round);
            broadcastToPopup('KEYGEN_PROGRESS', {
                progress: (data.round / 5) * 100, // Assuming 5 rounds
                message: `Round ${data.round} completed`,
                round: data.round
            });
        });
        
        sdkInitialized = true;
        console.log('✅ Real SDK initialized with recursive fix');
        
        return realSDK;
        
    } catch (error) {
        console.error('❌ Failed to initialize real SDK:', error);
        throw new Error(`SDK initialization failed: ${error.message}`);
    }
}

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
        
        // Get current group info using real SDK
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
            
            // Start keygen process
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
                    console.warn('⚠️ No AES key found in QR data');
                }
            } catch (keyError) {
                console.error('❌ Failed to set AES encryption key:', keyError);
            }
        } else {
            console.warn('⚠️ No QR data found in storage');
        }
        
        broadcastToPopup('KEYGEN_STARTED', {
            groupInfo: groupInfo,
            message: 'Starting REAL distributed key generation with recursive fix...'
        });
        
        // Call REAL SDK startKeygen (exactly like web app) - now with recursive fix!
        console.log('🔧 Calling REAL SDK.startKeygen(true) - WITH RECURSIVE FIX...');
        await realSDK.startKeygen(true); // true = isCreator
        
        console.log('✅ REAL SDK startKeygen() called - recursive fix should prevent infinite loops!');
        
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

// Initialize background script
async function initializeBackground() {
    await loadSettings();
    console.log('✅ Background script initialized with recursive fix');
}

// Start initialization
initializeBackground();

console.log('✅ Real SDK background script with recursive fix loaded successfully');
