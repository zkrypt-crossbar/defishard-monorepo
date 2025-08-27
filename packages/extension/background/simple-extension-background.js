/**
 * Simple Extension Background Script
 * Simplified approach that doesn't use the problematic bundled SDK
 */

console.log('🔧 Starting Simple Extension Background...');

// Mock window object for compatibility
if (typeof window === 'undefined') {
    globalThis.window = {};
}

// Simple configuration
const config = {
    relayerUrl: 'http://localhost:3000',
    websocketUrl: 'ws://localhost:3000',
    debug: true
};

class SimpleExtensionBackground {
    constructor() {
        this.isInitialized = false;
        this.config = config;
        
        console.log('✅ Simple Extension Background initialized');
    }

    async initialize() {
        try {
            console.log('🔧 Simple initialization...');
            
            // For now, just mark as initialized without SDK
            this.isInitialized = true;
            
            console.log('✅ Simple Extension Background ready');
            
            // Broadcast success
            this.broadcastToPopup('BACKGROUND_READY', { 
                status: 'ready',
                message: 'Extension background initialized successfully'
            });
            
        } catch (error) {
            console.error('❌ Simple initialization failed:', error);
            this.broadcastToPopup('BACKGROUND_ERROR', { 
                error: error.message,
                stack: error.stack 
            });
        }
    }

    broadcastToPopup(type, data) {
        try {
            chrome.runtime.sendMessage({ type, data }).catch(err => {
                // Ignore if no receivers
                console.log('No message receivers:', err.message);
            });
        } catch (error) {
            console.log('Message broadcast failed:', error.message);
        }
    }

    setupEventListeners() {
        // Handle messages from popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('📩 Message received:', message);
            
            switch (message.type) {
                case 'GET_STATUS':
                    sendResponse({ 
                        status: this.isInitialized ? 'ready' : 'initializing',
                        config: this.config
                    });
                    break;
                    
                case 'TEST_CONNECTION':
                    sendResponse({ 
                        success: true,
                        message: 'Simple background is working!'
                    });
                    break;
                    
                default:
                    sendResponse({ 
                        success: false,
                        message: `Unknown message type: ${message.type}`
                    });
            }
            
            return true; // Keep message channel open for async response
        });
    }
}

// Global error handlers
globalThis.addEventListener('error', (event) => {
    console.error('❌ Global error:', event.error);
});

globalThis.addEventListener('unhandledrejection', (event) => {
    console.error('❌ Unhandled promise rejection:', event.reason);
});

// Initialize
const background = new SimpleExtensionBackground();
background.setupEventListeners();
background.initialize();

console.log('✅ Simple Extension Background script loaded');
