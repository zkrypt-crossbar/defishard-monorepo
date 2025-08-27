/**
 * Central State Manager for DeFiShArd Extension
 * Implements observable pattern for state management
 */
class StateManager {
    constructor() {
        this.state = {
            // Wallet state
            wallets: [],
            activeWallet: null,
            
            // MPC state
            currentGroup: null,
            keygenStatus: 'idle', // idle, creating, in-progress, completed, failed
            signingStatus: 'idle',
            rotationStatus: 'idle',
            
            // UI state
            currentView: 'welcome', // welcome, create, sign, rotate, settings
            loading: false,
            error: null,
            
            // Network state
            isConnected: false,
            serverConfig: null
        };
        
        this.listeners = new Map();
        this.persistentKeys = ['wallets', 'activeWallet', 'serverConfig'];
    }
    
    /**
     * Subscribe to state changes
     * @param {string} key - State key to watch
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key).add(callback);
        
        // Return unsubscribe function
        return () => {
            const keyListeners = this.listeners.get(key);
            if (keyListeners) {
                keyListeners.delete(callback);
            }
        };
    }
    
    /**
     * Update state and notify listeners
     * @param {string} key - State key
     * @param {*} value - New value
     */
    setState(key, value) {
        const oldValue = this.state[key];
        this.state[key] = value;
        
        // Persist certain state keys
        if (this.persistentKeys.includes(key)) {
            this.persistState();
        }
        
        // Notify listeners
        const listeners = this.listeners.get(key);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(value, oldValue);
                } catch (error) {
                    console.error(`Error in state listener for ${key}:`, error);
                }
            });
        }
    }
    
    /**
     * Get current state value
     * @param {string} key - State key
     * @returns {*} State value
     */
    getState(key) {
        return this.state[key];
    }
    
    /**
     * Get entire state (for debugging)
     * @returns {Object} Current state
     */
    getAllState() {
        return { ...this.state };
    }
    
    /**
     * Batch update multiple state keys
     * @param {Object} updates - Object with key-value pairs
     */
    batchUpdate(updates) {
        const notifiedKeys = new Set();
        
        // Update all values first
        Object.entries(updates).forEach(([key, value]) => {
            this.state[key] = value;
        });
        
        // Persist if needed
        const shouldPersist = Object.keys(updates).some(key => 
            this.persistentKeys.includes(key)
        );
        if (shouldPersist) {
            this.persistState();
        }
        
        // Notify listeners
        Object.entries(updates).forEach(([key, value]) => {
            const listeners = this.listeners.get(key);
            if (listeners && !notifiedKeys.has(key)) {
                listeners.forEach(callback => {
                    try {
                        callback(value);
                    } catch (error) {
                        console.error(`Error in state listener for ${key}:`, error);
                    }
                });
                notifiedKeys.add(key);
            }
        });
    }
    
    /**
     * Persist state to storage
     */
    async persistState() {
        try {
            const persistentState = {};
            this.persistentKeys.forEach(key => {
                persistentState[key] = this.state[key];
            });
            
            if (typeof chrome !== 'undefined' && chrome.storage) {
                await chrome.storage.local.set({ extensionState: persistentState });
            }
        } catch (error) {
            console.error('Failed to persist state:', error);
        }
    }
    
    /**
     * Load state from storage
     */
    async loadState() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get('extensionState');
                if (result.extensionState) {
                    Object.entries(result.extensionState).forEach(([key, value]) => {
                        this.state[key] = value;
                    });
                }
            }
        } catch (error) {
            console.error('Failed to load state:', error);
        }
    }
    
    /**
     * Reset state to defaults
     */
    reset() {
        const defaultState = {
            wallets: [],
            activeWallet: null,
            currentGroup: null,
            keygenStatus: 'idle',
            signingStatus: 'idle',
            rotationStatus: 'idle',
            currentView: 'welcome',
            loading: false,
            error: null,
            isConnected: false,
            serverConfig: null
        };
        
        this.state = defaultState;
        this.persistState();
    }
}

// Export singleton instance
export const stateManager = new StateManager();
