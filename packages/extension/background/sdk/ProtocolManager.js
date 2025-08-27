/**
 * Protocol Manager for DeFiShArd Extension
 * Handles message routing, queueing, and coordination between components
 * Compatible with DeFiShArd SDK ProtocolManager
 */

class ProtocolManager {
    constructor(websocketManager) {
        this.websocketManager = websocketManager;
        this.processors = new Map();
        this.outgoingQueue = [];
        this.eventHandlers = {};
        this.isProcessingQueue = false;
        this.maxQueueSize = 100;
        this.queueProcessingDelay = 50; // ms

        // Set up WebSocket event listeners
        this.setupWebSocketListeners();
    }

    /**
     * Set up WebSocket event listeners
     */
    setupWebSocketListeners() {
        // Listen for parsed messages from WebSocketManager
        this.websocketManager.on('parsed:message', (message) => {
            this.handleMessage(message);
        });

        // Listen for WebSocket connection events
        this.websocketManager.on('websocket:connected', () => {
            console.log('🔗 ProtocolManager: WebSocket connected');
            this.emit('websocket:connected');
        });

        this.websocketManager.on('websocket:disconnected', (event) => {
            console.log('🔗 ProtocolManager: WebSocket disconnected');
            this.emit('websocket:disconnected', event);
        });

        this.websocketManager.on('websocket:error', (error) => {
            console.error('🔗 ProtocolManager: WebSocket error:', error);
            this.emit('websocket:error', error);
        });
    }

    /**
     * Register a processor for a specific protocol
     * @param {string} protocol - Protocol name (keygen, sign)
     * @param {BaseProcessor} processor - Processor instance
     */
    registerProcessor(protocol, processor) {
        if (!protocol || !processor) {
            throw new Error('Protocol and processor are required');
        }

        this.processors.set(protocol, processor);
        console.log(`📋 Registered processor for protocol: ${protocol}`);

        // Set up processor event listeners
        this.setupProcessorListeners(protocol, processor);
    }

    /**
     * Set up event listeners for a processor
     * @param {string} protocol - Protocol name
     * @param {BaseProcessor} processor - Processor instance
     */
    setupProcessorListeners(protocol, processor) {
        // Listen for round completion events
        processor.on('round:complete', (data) => {
            console.log(`🔄 ${protocol} round ${data.round} complete`);
            this.emit('round:complete', { protocol, ...data });
        });

        // Listen for round start events
        processor.on('round:start', (data) => {
            console.log(`🎯 ${protocol} round ${data.round} started`);
            this.emit('round:start', { protocol, ...data });
        });

        // Listen for error events
        processor.on('error', (error) => {
            console.error(`❌ ${protocol} processor error:`, error);
            this.emit('processor:error', { protocol, error });
        });

        // Listen for round error events
        processor.on('round:error', (data) => {
            console.error(`❌ ${protocol} round ${data.round} error:`, data.error);
            this.emit('round:error', { protocol, ...data });
        });
    }

    /**
     * Handle incoming message
     * @param {Object} message - Protocol message to handle
     */
    handleMessage(message) {
        try {
            console.log('📨 ProtocolManager handling message:', message);

            // Determine protocol from message
            const protocol = this.determineProtocol(message);
            
            if (!protocol) {
                console.warn('⚠️ Could not determine protocol for message:', message);
                return;
            }

            // Get processor for protocol
            const processor = this.processors.get(protocol);
            
            if (!processor) {
                console.warn(`⚠️ No processor registered for protocol: ${protocol}`);
                return;
            }

            // Route message to processor
            processor.processMessage(message);

        } catch (error) {
            console.error('❌ Error handling message in ProtocolManager:', error);
            this.emit('message:error', error);
        }
    }

    /**
     * Determine protocol from message
     * @param {Object} message - Message to analyze
     * @returns {string|null} Protocol name or null if unknown
     */
    determineProtocol(message) {
        // For now, assume all messages are keygen protocol
        // In a real implementation, this would check message type or other indicators
        return 'keygen';
    }

    /**
     * Queue message for sending
     * @param {Object} message - Message to queue
     */
    queueMessage(message) {
        try {
            // Validate message before queuing
            if (!this.validateOutgoingMessage(message)) {
                console.error('❌ Invalid outgoing message:', message);
                return;
            }

            // Add message to queue
            this.outgoingQueue.push(message);

            // Limit queue size
            if (this.outgoingQueue.length > this.maxQueueSize) {
                console.warn(`⚠️ Queue size limit reached, removing oldest message`);
                this.outgoingQueue.shift();
            }

            console.log(`📤 Queued message, queue size: ${this.outgoingQueue.length}`);

            // Start processing queue if not already processing
            if (!this.isProcessingQueue) {
                this.processOutgoingQueue();

            }

        } catch (error) {
            console.error('❌ Error queueing message:', error);
            this.emit('queue:error', error);
        }
    }

    /**
     * Validate outgoing message
     * @param {Object} message - Message to validate
     * @returns {boolean}
     */
    validateOutgoingMessage(message) {
        if (!message || typeof message !== 'object') {
            return false;
        }

        const requiredFields = ['group_id', 'from_id', 'to_id', 'content', 'round', 'timestamp'];
        
        for (const field of requiredFields) {
            if (!(field in message)) {
                console.error(`Missing required field: ${field}`);
                return false;
            }
        }

        return true;
    }

    /**
     * Process outgoing message queue
     */
    async processOutgoingQueue() {
        if (this.isProcessingQueue || this.outgoingQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        try {
            while (this.outgoingQueue.length > 0) {
                const message = this.outgoingQueue.shift();
                
                try {
                    // Send message through WebSocket
                    await this.websocketManager.sendMessage(message);
                    console.log('📤 Sent queued message successfully');
                    
                    // Small delay between messages to prevent flooding
                    if (this.outgoingQueue.length > 0) {
                        await new Promise(resolve => setTimeout(resolve, this.queueProcessingDelay));
                    }

                } catch (error) {
                    console.error('❌ Failed to send queued message:', error);
                    
                    // Re-queue message if it's a temporary error
                    if (this.isTemporaryError(error)) {
                        this.outgoingQueue.unshift(message);
                        console.log('🔄 Re-queued message due to temporary error');
                    }
                    
                    // Stop processing on permanent errors
                    break;
                }
            }

        } catch (error) {
            console.error('❌ Error processing outgoing queue:', error);
            this.emit('queue:error', error);
        } finally {
            this.isProcessingQueue = false;
        }
    }

    /**
     * Check if error is temporary and message can be re-queued
     * @param {Error} error - Error to check
     * @returns {boolean}
     */
    isTemporaryError(error) {
        // Network errors are usually temporary
        const temporaryErrors = [
            'WebSocket not connected',
            'Network error',
            'Connection timeout'
        ];

        return temporaryErrors.some(msg => error.message.includes(msg));
    }

    /**
     * Get processor for a specific protocol
     * @param {string} protocol - Protocol name
     * @returns {BaseProcessor|null} Processor instance or null
     */
    getProcessor(protocol) {
        return this.processors.get(protocol) || null;
    }

    /**
     * Start a round for a specific protocol
     * @param {string} protocol - Protocol name
     * @param {number} round - Round number
     */
    startRound(protocol, round) {
        const processor = this.getProcessor(protocol);
        if (processor) {
            processor.startRound(round);
        } else {
            console.warn(`⚠️ No processor found for protocol: ${protocol}`);
        }
    }

    /**
     * Clear all processors and queue
     */
    clear() {
        // Clear processors
        this.processors.clear();
        
        // Clear outgoing queue
        this.outgoingQueue = [];
        this.isProcessingQueue = false;
        
        console.log('🧹 Cleared all processors and queue');
    }

    /**
     * Get protocol manager status
     * @returns {Object} Status information
     */
    getStatus() {
        const processorStatuses = {};
        for (const [protocol, processor] of this.processors) {
            processorStatuses[protocol] = processor.getStatus();
        }

        return {
            processors: Object.keys(processorStatuses),
            processorStatuses,
            queueSize: this.outgoingQueue.length,
            isProcessingQueue: this.isProcessingQueue,
            websocketStatus: this.websocketManager.getConnectionStatus()
        };
    }

    /**
     * Event system
     */
    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
    }

    off(event, handler) {
        if (this.eventHandlers[event]) {
            const index = this.eventHandlers[event].indexOf(handler);
            if (index > -1) {
                this.eventHandlers[event].splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`❌ Error in event handler for ${event}:`, error);
                }
            });
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProtocolManager;
} else {
    // Browser/extension environment
    window.ProtocolManager = ProtocolManager;
}
