/**
 * DeFiShArd Extension Background Service Worker
 * Using the cross-platform SDK
 */

// Global error handlers
self.addEventListener('error', (event) => {
    console.error('🚨 Uncaught error in service worker:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Unhandled promise rejection in service worker:', event.reason);
    event.preventDefault();
});

// Load the extension SDK
try {
    importScripts('extension-sdk-loader.js');
    console.log('✅ Extension SDK loader imported successfully');
} catch (error) {
    console.error('❌ Failed to import Extension SDK loader:', error);
    throw error;
}

class DeFiShArdExtensionBackground {
    constructor() {
        this.sdk = null;
        this.isInitialized = false;
        this.config = {
            relayerUrl: 'http://localhost:3000',
            websocketUrl: 'ws://localhost:3000',
            debug: true
        };
    }

    async initialize() {
        try {
            console.log('🔧 Initializing Extension Background...');
            
            await this.loadConfig();
            await this.initializeSDK();
            this.setupEventListeners();
            
            console.log('✅ Extension Background initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Extension Background:', error);
            this.broadcastError('INITIALIZATION_ERROR', error.message);
        }
    }

    async loadConfig() {
        try {
            const stored = await chrome.storage.local.get(['relayerUrl', 'websocketUrl']);
            if (stored.relayerUrl) this.config.relayerUrl = stored.relayerUrl;
            if (stored.websocketUrl) this.config.websocketUrl = stored.websocketUrl;
            console.log('✅ Config loaded:', this.config);
        } catch (error) {
            console.error('❌ Failed to load config:', error);
        }
    }

    async initializeSDK() {
        try {
            console.log('🔧 Initializing Extension SDK...');
            
            if (typeof createExtensionSDK === 'undefined') {
                throw new Error('createExtensionSDK not available. SDK not loaded properly.');
            }
            
            this.sdk = createExtensionSDK({
                relayerUrl: this.config.relayerUrl,
                websocketUrl: this.config.websocketUrl,
                debug: this.config.debug
            });
            
            await this.sdk.initialize();
            this.setupSDKEventListeners();
            this.isInitialized = true;
            
            console.log('✅ Extension SDK initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Extension SDK:', error);
            throw error;
        }
    }

    setupSDKEventListeners() {
        if (!this.sdk) return;

        // Listen for SDK events and broadcast to popup
        const events = [
            'keygen-complete', 'sign-complete', 'round-complete', 
            'error', 'connected', 'disconnected'
        ];

        events.forEach(event => {
            this.sdk.on(event, (data) => {
                console.log(`📡 SDK Event: ${event}`, data);
                this.broadcastMessage(event.toUpperCase(), data);
            });
        });
    }

    setupEventListeners() {
        // Listen for popup messages
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep the message channel open for async responses
        });
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            console.log('📨 Received message:', message.type);

            switch (message.type) {
                case 'REGISTER_PARTY':
                    const regResult = await this.sdk.register();
                    sendResponse({ success: true, data: regResult });
                    break;

                case 'CREATE_GROUP':
                    const { threshold, totalParties, timeoutMinutes } = message.payload;
                    const groupResult = await this.sdk.createGroup(threshold, totalParties, timeoutMinutes);
                    sendResponse({ success: true, data: groupResult });
                    break;

                case 'JOIN_GROUP':
                    const { groupId } = message.payload;
                    const joinResult = await this.sdk.joinGroup(groupId);
                    sendResponse({ success: true, data: joinResult });
                    break;

                case 'START_KEYGEN':
                    const { isCreator } = message.payload;
                    const keygenResult = await this.sdk.startKeygen(isCreator);
                    sendResponse({ success: true, data: keygenResult });
                    break;

                case 'SIGN_MESSAGE':
                    const { messageToSign } = message.payload;
                    const signResult = await this.sdk.startSigning(messageToSign);
                    sendResponse({ success: true, data: signResult });
                    break;

                case 'GET_STATUS':
                    sendResponse({
                        success: true,
                        data: {
                            isInitialized: this.isInitialized,
                            config: this.config
                        }
                    });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('❌ Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    broadcastMessage(type, data) {
        // Broadcast to all extension pages
        chrome.runtime.sendMessage({ type, data }).catch(() => {
            // Ignore errors if no listeners
        });
    }

    broadcastError(type, message) {
        this.broadcastMessage('SERVICE_WORKER_ERROR', { type, message });
    }
}

// Initialize the background service
const background = new DeFiShArdExtensionBackground();
background.initialize();
