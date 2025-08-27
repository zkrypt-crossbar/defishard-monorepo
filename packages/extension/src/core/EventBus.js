/**
 * Event Bus for Extension-wide Communication
 * Enables decoupled communication between components
 */
class EventBus {
    constructor() {
        this.events = new Map();
        this.onceEvents = new Set();
    }
    
    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Event handler
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        
        this.events.get(event).add(callback);
        
        return () => {
            const eventCallbacks = this.events.get(event);
            if (eventCallbacks) {
                eventCallbacks.delete(callback);
            }
        };
    }
    
    /**
     * Subscribe to an event only once
     * @param {string} event - Event name
     * @param {Function} callback - Event handler
     * @returns {Function} Unsubscribe function
     */
    once(event, callback) {
        const wrappedCallback = (...args) => {
            callback(...args);
            this.off(event, wrappedCallback);
        };
        
        this.onceEvents.add(wrappedCallback);
        return this.on(event, wrappedCallback);
    }
    
    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Event handler to remove
     */
    off(event, callback) {
        const eventCallbacks = this.events.get(event);
        if (eventCallbacks) {
            eventCallbacks.delete(callback);
            if (eventCallbacks.size === 0) {
                this.events.delete(event);
            }
        }
    }
    
    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {...*} args - Event arguments
     */
    emit(event, ...args) {
        const eventCallbacks = this.events.get(event);
        if (eventCallbacks) {
            eventCallbacks.forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }
    
    /**
     * Emit an event and wait for all async handlers
     * @param {string} event - Event name
     * @param {...*} args - Event arguments
     * @returns {Promise<Array>} Results from all handlers
     */
    async emitAsync(event, ...args) {
        const eventCallbacks = this.events.get(event);
        if (!eventCallbacks) return [];
        
        const promises = Array.from(eventCallbacks).map(async callback => {
            try {
                return await callback(...args);
            } catch (error) {
                console.error(`Error in async event listener for ${event}:`, error);
                throw error;
            }
        });
        
        return Promise.allSettled(promises);
    }
    
    /**
     * Remove all listeners
     */
    clear() {
        this.events.clear();
        this.onceEvents.clear();
    }
    
    /**
     * Get all active events (for debugging)
     * @returns {Array<string>} Event names
     */
    getActiveEvents() {
        return Array.from(this.events.keys());
    }
}

// Common event names as constants
export const EVENTS = {
    // Wallet events
    WALLET_CREATED: 'wallet:created',
    WALLET_SELECTED: 'wallet:selected',
    WALLET_DELETED: 'wallet:deleted',
    
    // MPC events
    KEYGEN_STARTED: 'mpc:keygen_started',
    KEYGEN_PROGRESS: 'mpc:keygen_progress',
    KEYGEN_COMPLETED: 'mpc:keygen_completed',
    KEYGEN_FAILED: 'mpc:keygen_failed',
    
    SIGNING_STARTED: 'mpc:signing_started',
    SIGNING_PROGRESS: 'mpc:signing_progress',
    SIGNING_COMPLETED: 'mpc:signing_completed',
    SIGNING_FAILED: 'mpc:signing_failed',
    
    ROTATION_STARTED: 'mpc:rotation_started',
    ROTATION_PROGRESS: 'mpc:rotation_progress',
    ROTATION_COMPLETED: 'mpc:rotation_completed',
    ROTATION_FAILED: 'mpc:rotation_failed',
    
    // Network events
    CONNECTION_ESTABLISHED: 'network:connected',
    CONNECTION_LOST: 'network:disconnected',
    SERVER_ERROR: 'network:server_error',
    
    // UI events
    VIEW_CHANGED: 'ui:view_changed',
    MODAL_OPENED: 'ui:modal_opened',
    MODAL_CLOSED: 'ui:modal_closed',
    NOTIFICATION_SHOWN: 'ui:notification_shown',
    
    // Group events
    GROUP_CREATED: 'group:created',
    GROUP_JOINED: 'group:joined',
    PARTY_JOINED: 'group:party_joined',
    PARTY_LEFT: 'group:party_left'
};

// Export singleton instance
export const eventBus = new EventBus();
