/**
 * DeFiShArd Extension Background Service Worker
 * New architecture with WebSocketManager, ProtocolManager, and KeygenProcessor
 */

// Global error handler for uncaught exceptions
self.addEventListener('error', (event) => {
    console.error('🚨 Uncaught error in service worker:', event.error);
    console.error('Stack trace:', event.error?.stack);
});

// Global error handler for unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Unhandled promise rejection in service worker:', event.reason);
    event.preventDefault(); // Prevent the default browser behavior
});

// Load SDK components with error handling
try {
    console.log('🔄 Loading SDK loader script...');
    importScripts('sdk-loader.js');
    console.log('✅ SDK loader imported successfully');
    
    // Check if SDK is available after loading
    console.log('🔍 Checking if DeFiShArdSDK is available after loading...');
    console.log('typeof DeFiShArdSDK:', typeof DeFiShArdSDK);
    console.log('typeof window:', typeof window);
    console.log('typeof globalThis.DeFiShArdSDK:', typeof globalThis.DeFiShArdSDK);
    
    if (typeof DeFiShArdSDK !== 'undefined') {
        console.log('✅ DeFiShArdSDK is available globally');
    } else {
        console.log('❌ DeFiShArdSDK is NOT available globally');
    }
} catch (error) {
    console.error('❌ Failed to import SDK loader:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    throw error; // Re-throw to prevent service worker from registering
}

class DeFiShArdBackground {
    constructor() {
        this.config = {
            relayerUrl: 'http://localhost:3000',
            websocketUrl: 'ws://localhost:3000',
            timeout: 60000
        };
        
        this.partyId = null;
        this.apiToken = null;
        this.isInitialized = false;
        
        // SDK instance
        this.sdk = null;
        
        this.initialize();
    }

    async initialize() {
        try {
            console.log('🚀 Initializing DeFiShArd Extension Background...');
            
            await this.loadConfig();
            await this.initializeSDK();
            this.setupEventListeners();
            
            console.log('✅ Background service worker initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize background:', error);
        }
    }

    async initializeSDK() {
        try {
            console.log('🔧 Initializing Extension SDK using bundled SDK...');
            
            // Check if the bundled SDK is available
            if (typeof DeFiShArdSDK === 'undefined') {
                throw new Error('DeFiShArd SDK not loaded. Make sure the bundled SDK is properly imported.');
            }
            
            console.log('✅ DeFiShArd SDK found, creating instance...');
            
            // Create storage adapter for extension
            const ExtensionStorageAdapter = class {
                constructor(prefix = 'defishard_') {
                    this.prefix = prefix;
                }
                
                async get(key) {
                    const result = await chrome.storage.local.get([`${this.prefix}${key}`]);
                    return result[`${this.prefix}${key}`];
                }
                
                async set(key, value) {
                    await chrome.storage.local.set({ [`${this.prefix}${key}`]: value });
                }
                
                async remove(key) {
                    await chrome.storage.local.remove([`${this.prefix}${key}`]);
                }
                
                async getKeys() {
                    const allItems = await chrome.storage.local.get(null);
                    return Object.keys(allItems).filter(key => key.startsWith(this.prefix))
                                                .map(key => key.substring(this.prefix.length));
                }
            };
            
            // Create SDK instance (same as web app)
            this.sdk = new DeFiShArdSDK({
                relayerUrl: this.config.relayerUrl,
                websocketUrl: this.config.websocketUrl,
                storage: new ExtensionStorageAdapter(),
                debug: true
            });
            
            console.log('🚀 Initializing SDK...');
            await this.sdk.initialize();
            
            console.log('✅ Extension SDK initialized successfully using bundled SDK');
            
            // Set up event listeners from real SDK
            this.setupSDKEventListeners();
            
            this.isInitialized = true;
            
        } catch (error) {
            console.error('❌ Failed to initialize SDK:', error);
            console.error('Error stack:', error.stack);
            throw error;
        }
    }

    async loadConfig() {
        try {
            const result = await chrome.storage.local.get(['defishard_config']);
            if (result.defishard_config) {
                this.config = { ...this.config, ...result.defishard_config };
            }
        } catch (error) {
            console.error('Failed to load config:', error);
        }
    }

    async saveConfig() {
        try {
            await chrome.storage.local.set({ defishard_config: this.config });
        } catch (error) {
            console.error('Failed to save config:', error);
        }
    }

    setupEventListeners() {
        // Handle extension installation/update
        chrome.runtime.onInstalled.addListener(this.handleInstall.bind(this));
        
        // Handle messages from popup and content scripts
        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
        
        // Handle extension startup
        chrome.runtime.onStartup.addListener(this.handleStartup.bind(this));
        
        // Handle tab updates for content script injection
        chrome.tabs.onUpdated.addListener(this.handleTabUpdate.bind(this));
    }
    
    setupSDKEventListeners() {
        // Set up SDK event listeners using the real SDK
        if (!this.sdk) return;
        
        // Keygen events
        this.sdk.on('keygen-complete', (data) => {
            console.log('🎯 SDK Event: Keygen completed', data);
            this.broadcastMessage({
                type: 'KEYGEN_COMPLETE',
                result: data
            });
        });
        
        this.sdk.on('round-complete', (data) => {
            console.log('🔄 SDK Event: Round complete', data);
            this.broadcastMessage({
                type: 'KEYGEN_PROGRESS', 
                progress: (data[0] / 4) * 100,
                text: `Round ${data[0]}/4`
            });
        });
        
        this.sdk.on('error', (error) => {
            console.error('❌ SDK Event: Error', error);
            this.broadcastMessage({
                type: 'KEYGEN_ERROR',
                error: error.message
            });
        });
    }

    handleInstall(details) {
        console.log('📦 Extension installed/updated:', details);
        if (details.reason === 'install') {
            this.saveConfig();
        }
    }

    handleStartup() {
        console.log('🚀 Extension startup');
    }

    handleTabUpdate(tabId, changeInfo, tab) {
        if (changeInfo.status === 'complete' && tab.url) {
            this.injectContentScript(tabId, tab.url);
        }
    }

    async injectContentScript(tabId, url) {
        try {
            if (url.startsWith('http://') || url.startsWith('https://')) {
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content-scripts/content.js']
                });
            }
        } catch (error) {
            console.error('Failed to inject content script:', error);
        }
    }

    handleMessage(message, sender, sendResponse) {
        console.log('📨 Background received message:', message.type);
        
        switch (message.type) {
            case 'CREATE_GROUP':
                this.createGroup(message.data).then(sendResponse).catch(error => {
                    console.error('Error in CREATE_GROUP:', error);
                    sendResponse({ success: false, error: error.message });
                });
                return true;
                
            case 'START_KEYGEN':
                this.startKeygen(message.data).then(sendResponse).catch(error => {
                    console.error('Error in START_KEYGEN:', error);
                    sendResponse({ success: false, error: error.message });
                });
                return true;
                
            case 'GET_GROUP_INFO':
                this.getGroupInfo(message.groupId).then(sendResponse).catch(error => {
                    console.error('Error in GET_GROUP_INFO:', error);
                    sendResponse({ success: false, error: error.message });
                });
                return true;
                
            case 'GET_EXISTING_WALLETS':
                this.getExistingWallets().then(sendResponse).catch(error => {
                    console.error('Error in GET_EXISTING_WALLETS:', error);
                    sendResponse({ success: false, error: error.message });
                });
                return true;
                
            case 'GET_CONNECTION_STATUS':
                sendResponse({ success: true, status: this.getConnectionStatus() });
                return false;
                
            default:
                console.warn('Unknown message type:', message.type);
                sendResponse({ success: false, error: 'Unknown message type' });
                return false;
        }
    }

    async createGroup(data) {
        try {
            console.log('📝 Creating group with data:', data);
            
            // Register party if not already registered
            if (!this.partyId || !this.apiToken) {
                const registrationResult = await this.sdk.register();
                this.partyId = registrationResult.partyId;
                this.apiToken = registrationResult.token;
            }
            
            // Create group using real SDK
            const result = await this.sdk.createGroup(
                data.threshold || 2,
                data.totalParties || 2,
                data.timeout || 5
            );
            
            console.log('✅ Group created successfully:', result);
            return { success: true, group: result.group };
            
        } catch (error) {
            console.error('❌ Group creation failed:', error);
            throw error;
        }
    }

    async startKeygen(data) {
        try {
            console.log('🚀 Starting keygen with data:', data);
            
            if (!this.isInitialized) {
                await this.initializeSDK();
            }
            
            // Join group first
            await this.sdk.joinGroup(data.groupId);
            
            // Start keygen process using real SDK
            await this.sdk.startKeygen(true); // Extension is creator
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Keygen failed:', error);
            throw error;
        }
    }

    async getGroupInfo(groupId) {
        try {
            const result = await this.sdk.protocolManager.apiClient.getGroupInfo(groupId);
            return { success: true, group: result };
        } catch (error) {
            console.error('❌ Failed to get group info:', error);
            throw error;
        }
    }

    async getExistingWallets() {
        try {
            const result = await chrome.storage.local.get(['defishard_wallets']);
            const wallets = result.defishard_wallets || [];
            return { success: true, wallets: wallets };
        } catch (error) {
            console.error('❌ Failed to get existing wallets:', error);
            throw error;
        }
    }

    getConnectionStatus() {
        return {
            isInitialized: this.isInitialized,
            partyId: this.partyId,
            hasApiToken: !!this.apiToken,
            sdkConnected: this.sdk && this.sdk.protocolManager ? true : false
        };
    }

    generateGroupId() {
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    broadcastMessage(message) {
        try {
            chrome.runtime.sendMessage(message).catch(() => {
                // Ignore errors when no listeners are available
            });
        } catch (error) {
            console.error('Failed to broadcast message:', error);
        }
    }
}

// Initialize the background service worker with error handling
try {
    const background = new DeFiShArdBackground();
    console.log('✅ DeFiShArd Background service worker created successfully');
} catch (error) {
    console.error('❌ Failed to create DeFiShArd Background service worker:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    
    // Send error to extension if possible
    try {
        chrome.runtime.sendMessage({
            type: 'SERVICE_WORKER_ERROR',
            error: error.message,
            stack: error.stack
        }).catch(() => {
            // Ignore if no listeners
        });
    } catch (msgError) {
        console.error('❌ Failed to send error message:', msgError);
    }
}