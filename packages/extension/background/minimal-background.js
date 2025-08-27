// Minimal Chrome Extension Background Script
console.log('Starting minimal background script...');

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

// Simple message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received:', message);
    
    if (message.type === 'TEST_CONNECTION') {
        sendResponse({
            success: true,
            message: 'Minimal background is working!'
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
        
        // Generate a mock group ID
        const groupId = generateGroupId();
        
        // Initialize real SDK for group creation
        await ensureSDKInitialized();
        
        // Use SDK to register party and create group (like web app)
        if (!extensionState.isRegistered) {
            console.log('🔧 Registering party with real SDK...');
            const registration = await realSDK.register();
            extensionState.partyId = registration.partyId;
            extensionState.apiKey = registration.token;
            extensionState.isRegistered = true;
            console.log('✅ Party registered via SDK:', extensionState.partyId);
        }
        
        // Create group using real SDK (like web app)
        console.log('🔧 Creating group with real SDK...');
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
        
        const partyId = generatePartyId();
        
        const response = await fetch(`${CONFIG.relayerUrl}/party/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                party_id: partyId
            })
        });
        
        if (!response.ok) {
            throw new Error(`Registration failed: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('✅ Party registered:', result);
        
        // Update extension state
        extensionState.partyId = result.party_id;
        extensionState.apiKey = result.token;
        extensionState.isRegistered = true;
        
        sendResponse({
            success: true,
            partyId: result.party_id,
            token: result.token,
            message: result.message
        });
        
    } catch (error) {
        console.error('❌ Party registration failed:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// Auto-register for internal use
async function autoRegister() {
    if (extensionState.isRegistered) return;
    
    console.log('🔧 Auto-registering party...');
    
    const partyId = generatePartyId();
    
    const response = await fetch(`${CONFIG.relayerUrl}/party/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            party_id: partyId
        })
    });
    
    if (!response.ok) {
        throw new Error(`Auto-registration failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ Auto-registered party:', result);
    
    // Update extension state
    extensionState.partyId = result.party_id;
    extensionState.apiKey = result.token;
    extensionState.isRegistered = true;
}

// Generate a random party ID
function generatePartyId() {
    const bytes = new Uint8Array(33);
    crypto.getRandomValues(bytes);
    bytes[0] = bytes[1] % 2 === 0 ? 2 : 3; // First byte should be 2 or 3
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Generate a random group ID
function generateGroupId() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Real SDK initialization and management
async function ensureSDKInitialized() {
    if (sdkInitialized && realSDK) {
        return realSDK;
    }
    
    try {
        console.log('🔧 Initializing real SDK...');
        
        // Import and initialize the actual SDK
        if (typeof createExtensionSDK === 'undefined') {
            // Load the SDK bundle first
            await loadSDKBundle();
        }
        
        // Create SDK instance with current config
        realSDK = createExtensionSDK({
            relayerUrl: CONFIG.relayerUrl,
            websocketUrl: CONFIG.websocketUrl,
            debug: CONFIG.debug || true
        });
        
        // Initialize the SDK
        await realSDK.initialize();
        
        // Set up SDK event listeners for keygen progress
        setupSDKEventListeners();
        
        sdkInitialized = true;
        console.log('✅ Real SDK initialized successfully');
        
        return realSDK;
        
    } catch (error) {
        console.error('❌ Failed to initialize real SDK:', error);
        throw new Error(`SDK initialization failed: ${error.message}`);
    }
}

async function loadSDKBundle() {
    try {
        console.log('📦 Loading SDK bundle...');
        
        // Load the SDK bundle (assuming it's available in the extension)
        // This should make createExtensionSDK available globally
        if (typeof importScripts !== 'undefined') {
            importScripts('sdk-bundle.js');
        }
        
        // Verify SDK is loaded
        if (typeof createExtensionSDK === 'undefined') {
            throw new Error('createExtensionSDK not available after loading bundle');
        }
        
        console.log('✅ SDK bundle loaded successfully');
        
    } catch (error) {
        console.error('❌ Failed to load SDK bundle:', error);
        throw error;
    }
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
        
        realSDK.on('keygen-complete', (keyshare) => {
            console.log('🎉 Keygen completed via event:', keyshare);
            // This might be called in addition to the promise resolution
        });
        
        realSDK.on('keygen-error', (error) => {
            console.error('❌ Keygen error via event:', error);
            broadcastToPopup('KEYGEN_ERROR', {
                error: error.message || error
            });
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

async function saveKeyshareToStorage(keyshareResult, groupInfo) {
    try {
        console.log('💾 Saving keyshare to extension storage...');
        
        const keyshareData = {
            publicKey: keyshareResult.publicKey,
            groupId: groupInfo.group_id,
            partyId: extensionState.partyId,
            threshold: extensionState.groupMonitoring.threshold,
            totalParties: extensionState.groupMonitoring.requiredParties,
            timestamp: new Date().toISOString(),
            keyshareBytes: keyshareResult.serialized || keyshareResult.toBytes?.() || null,
            // Store additional metadata
            metadata: {
                relayerUrl: CONFIG.relayerUrl,
                websocketUrl: CONFIG.websocketUrl,
                apiKey: extensionState.apiKey
            }
        };
        
        // Save to chrome.storage.local
        const storageKey = `keyshare_${groupInfo.group_id}_${extensionState.partyId}`;
        await chrome.storage.local.set({
            [storageKey]: JSON.stringify(keyshareData)
        });
        
        console.log('✅ Keyshare saved to storage:', storageKey);
        
    } catch (error) {
        console.error('❌ Failed to save keyshare:', error);
        // Don't throw - this shouldn't fail the entire keygen process
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
        
        // Get current group info using real SDK (like web app)
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
        
        broadcastToPopup('KEYGEN_STARTED', {
            groupInfo: groupInfo,
            message: 'Real key generation process started...'
        });
        
        // Call actual SDK startKeygen (like web app)
        console.log('🔧 Calling real SDK.startKeygen(true)...');
        const keyshareResult = await realSDK.startKeygen(true); // true = isCreator
        
        console.log('✅ Real keygen completed:', keyshareResult);
        
        // Save the real keyshare to storage
        await saveKeyshareToStorage(keyshareResult, groupInfo);
        
        broadcastToPopup('KEYGEN_COMPLETED', {
            success: true,
            message: 'Key generation completed successfully!',
            keyshare: {
                publicKey: keyshareResult.publicKey,
                groupId: groupInfo.group_id,
                threshold: extensionState.groupMonitoring.threshold,
                totalParties: extensionState.groupMonitoring.requiredParties,
                partyId: extensionState.partyId,
                keyshareData: keyshareResult // Full keyshare for storage
            }
        });
        
        extensionState.keygenState.active = false;
        
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
