/**
 * SDK Bridge for Service Worker
 * Converts ES6 modules to global objects for importScripts compatibility
 */

// Since we can't use ES6 imports in service worker, we'll manually load and expose the SDK
// This is a temporary bridge until we have a proper UMD build

// For now, let's create the SDK using direct API calls (like we had before but cleaner)
class ExtensionSDK {
    constructor(config) {
        this.config = config;
        this.isInitialized = false;
        this.partyId = null;
        this.apiKey = null;
        this.groupId = null;
        this.storage = config.storage;
        this.debug = config.debug || false;
        this.websocket = null;
        this.isConnected = false;
    }
    
    async initialize() {
        if (this.debug) {
            console.log('🔧 Initializing Extension SDK...');
        }
        this.isInitialized = true;
        return true;
    }
    
    async register() {
        const partyId = this.generatePartyId();
        const response = await fetch(`${this.config.relayerUrl}/party/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ party_id: partyId })
        });
        
        if (!response.ok) {
            throw new Error(`Registration failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        this.partyId = result.party_id;
        this.apiKey = result.token;
        
        return {
            partyId: result.party_id,
            token: result.token
        };
    }
    
    async createGroup(threshold, totalParties, timeoutMinutes = 60) {
        const groupId = this.generateGroupId();
        const response = await fetch(`${this.config.relayerUrl}/group/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                group_id: groupId,
                n: totalParties,
                t: threshold,
                timeout: timeoutMinutes
            })
        });
        
        if (!response.ok) {
            throw new Error(`Group creation failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        this.groupId = result.group?.group_id || groupId;
        
        return {
            success: true,
            group: {
                groupId: this.groupId,
                ...result.group
            }
        };
    }
    
    async joinGroup(groupId) {
        const response = await fetch(`${this.config.relayerUrl}/group/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({ group_id: groupId })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to join group: ${response.statusText}`);
        }
        
        const result = await response.json();
        this.groupId = groupId;
        
        return {
            success: true,
            group: result.group
        };
    }
    
    async getGroupInfo(groupId) {
        const response = await fetch(`${this.config.relayerUrl}/group/info`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({ group_id: groupId })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to get group info: ${response.status}`);
        }
        
        return await response.json();
    }
    
    async startKeygen(isCreator) {
        if (this.debug) {
            console.log('🔑 Starting keygen - WebSocket will connect automatically inside real SDK...');
        }
        
        if (!this.groupId) {
            throw new Error('No group ID set for keygen');
        }
        
        if (!this.apiKey) {
            throw new Error('No API key set for keygen');
        }
        
        // TODO: Replace this bridge with actual SDK call
        // Real SDK's startKeygen() method will:
        // 1. Automatically connect WebSocket to relay server
        // 2. Handle MPC protocol rounds with other parties
        // 3. Return real cryptographic keyshare
        
        // For now, simulate what real SDK would do:
        if (this.debug) {
            console.log('📝 Note: This should be calling real SDK.startKeygen() which handles WebSocket automatically');
        }
        
        // Simulate progress for now
        const rounds = 5;
        for (let round = 1; round <= rounds; round++) {
            if (this.onKeygenProgress) {
                this.onKeygenProgress({
                    round,
                    progress: (round / rounds) * 100,
                    message: `Keygen round ${round}/${rounds} (SDK should handle WebSocket)`
                });
            }
            await new Promise(resolve => setTimeout(resolve, 800));
        }
        
        const keyshare = {
            publicKey: 'placeholder_' + this.generateRandomHex(64),
            serialized: Array.from(crypto.getRandomValues(new Uint8Array(256))),
            groupId: this.groupId,
            partyId: this.partyId,
            threshold: 2,
            totalParties: 2,
            timestamp: new Date().toISOString(),
            note: 'This should be generated by real SDK with automatic WebSocket'
        };
        
        if (this.debug) {
            console.log('✅ Placeholder keygen completed - real SDK will handle WebSocket automatically');
        }
        
        return keyshare;
    }
    
    // WebSocket handling is done automatically by real SDK
    // No manual WebSocket methods needed here
    
    // Event handling (simple callback system)
    on(event, callback) {
        if (event === 'keygen-progress') {
            this.onKeygenProgress = callback;
        }
        // Add more events as needed
    }
    
    generatePartyId() {
        const bytes = new Uint8Array(33);
        crypto.getRandomValues(bytes);
        bytes[0] = bytes[1] % 2 === 0 ? 2 : 3;
        return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    
    generateGroupId() {
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    
    generateRandomHex(length) {
        const bytes = new Uint8Array(length / 2);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    }
}

// Make SDK available globally for service worker
globalThis.DeFiShArdSDK = ExtensionSDK;

console.log('⚠️ Extension SDK bridge loaded - THIS IS NOT THE REAL SDK!');
console.log('📝 TODO: Replace with real monorepo SDK that has WebSocket startKeygen()');
console.log('🔧 Current bridge does NOT call real SDK.startKeygen() with WebSocket');
