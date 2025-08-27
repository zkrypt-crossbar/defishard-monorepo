/**
 * KeygenProcessor - Handles keygen protocol messages
 * Extends BaseProcessor with keygen-specific logic
 */

class KeygenProcessor extends BaseProcessor {
    constructor(protocolManager, session = null) {
        super(protocolManager, session);
        this.roundHandlers = new Map();
        this.wasmModule = null;
        this.keygenSession = null;
        this.isKeygenComplete = false;
        this.publicKey = null;
        this.threshold = 2;
        this.totalParties = 2;
        this.KeygenSession = null; // WASM KeygenSession class
        this.Message = null;       // WASM Message class
        this.setupRoundHandlers();
    }

    setupRoundHandlers() {
        this.roundHandlers.set(1, this.handleRound1.bind(this));
        this.roundHandlers.set(2, this.handleRound2.bind(this));
        this.roundHandlers.set(3, this.handleRound3.bind(this));
        this.roundHandlers.set(4, this.handleRound4.bind(this));
    }

    async initializeWasm() {
        try {
            console.log('🧮 Initializing WASM module...');
            
            // Wait a bit for WASM initialization if it's still in progress
            let attempts = 0;
            const maxAttempts = 10;
            
            while (attempts < maxAttempts) {
                if (globalThis.wasmInitialized && typeof wasm_bindgen !== 'undefined') {
                    break;
                }
                
                console.log(`⏳ Waiting for WASM initialization (attempt ${attempts + 1}/${maxAttempts})...`);
                await new Promise(resolve => setTimeout(resolve, 200));
                attempts++;
            }
            
            // Check if WASM is already initialized by the service worker wrapper
            if (typeof wasm_bindgen !== 'undefined') {
                if (globalThis.wasmInitialized) {
                    console.log('✅ WASM already initialized by service worker wrapper');
                    this.wasmModule = wasm_bindgen;
                    
                    // Check if this is a placeholder (direct loading mode)
                    if (typeof this.wasmModule.KeygenSession === 'function') {
                        try {
                            // Test if KeygenSession is actually available or just a placeholder
                            this.KeygenSession = this.wasmModule.KeygenSession;
                            this.Message = this.wasmModule.Message;
                            
                            console.log('✅ WASM classes available and ready');
                        } catch (testError) {
                            if (testError.message.includes('not yet available')) {
                                console.warn('⚠️ WASM is in placeholder mode, keygen functionality limited');
                                throw new Error('WASM module is loaded but not fully initialized. Keygen functionality not available yet.');
                            } else {
                                throw testError;
                            }
                        }
                    } else {
                        throw new Error('WASM KeygenSession class not found');
                    }
                } else {
                    console.log('🔄 WASM module loaded but not initialized, initializing now...');
                    // Get the extension's base URL for the WASM file
                    const extensionUrl = chrome.runtime.getURL('');
                    const wasmUrl = extensionUrl + 'background/wasm/dkls_wasm_ll_bg.wasm';
                    
                    this.wasmModule = wasm_bindgen;
                    await this.wasmModule(wasmUrl);
                    globalThis.wasmInitialized = true;
                    
                    // Import the specific classes we need
                    this.KeygenSession = this.wasmModule.KeygenSession;
                    this.Message = this.wasmModule.Message;
                    
                    console.log('✅ WASM module initialized successfully');
                }
                
                if (!this.KeygenSession || !this.Message) {
                    throw new Error('KeygenSession or Message classes not found in WASM module');
                }
                
            } else {
                throw new Error('WASM module not loaded. Make sure dkls_wasm_ll.js is properly imported.');
            }
            
        } catch (error) {
            console.error('❌ Failed to initialize WASM module:', error);
            console.error('Error details:', error.message);
            console.error('Stack:', error.stack);
            
            // Provide fallback error information
            console.error('WASM Status Debug:');
            console.error('- typeof wasm_bindgen:', typeof wasm_bindgen);
            console.error('- globalThis.wasmInitialized:', globalThis.wasmInitialized);
            console.error('- globalThis.wasmBytes exists:', !!globalThis.wasmBytes);
            
            throw error;
        }
    }

    async createKeygenSession(totalParties, threshold, partyIndex) {
        try {
            console.log(`🔧 Creating keygen session: ${totalParties}/${threshold}, party ${partyIndex}`);
            
            if (!this.KeygenSession) {
                await this.initializeWasm();
            }
            
            // Convert groupId to bytes
            const groupIdBytes = this.hexToBytes(this.groupId);
            
            // Create keygen session using WASM
            this.keygenSession = new this.KeygenSession(
                totalParties,
                threshold,
                partyIndex,
                groupIdBytes,
                undefined, // seed
                true // distributed
            );
            
            console.log('✅ Keygen session created successfully');
            return this.keygenSession;
            
        } catch (error) {
            console.error('❌ Failed to create keygen session:', error);
            throw error;
        }
    }

    async startKeygen(isCreator = false) {
        try {
            console.log(`🚀 Starting keygen process (creator: ${isCreator})`);
            
            if (!this.keygenSession) {
                throw new Error('Keygen session not created');
            }
            
            // Reset state
            this.isKeygenComplete = false;
            this.publicKey = null;
            this.clear();
            
            // Start round 1
            this.startRound(1);
            
            // If creator, generate initial message
            if (isCreator) {
                await this.generateInitialMessage();
            }
            
            this.emit('keygen:start', { isCreator });
            console.log('✅ Keygen process started');
            
        } catch (error) {
            console.error('❌ Failed to start keygen:', error);
            this.emit('keygen:error', error);
            throw error;
        }
    }

    async generateInitialMessage() {
        try {
            console.log('📤 Generating initial message for round 1...');
            
            if (!this.keygenSession) {
                throw new Error('Keygen session not initialized');
            }
            
            // Generate initial message using WASM
            const firstMessage = this.keygenSession.createFirstMessage();
            
            // Convert to protocol message and queue
            const protocolMessage = this.convertToProtocolMessage(firstMessage, 1);
            this.protocolManager.queueMessage(protocolMessage);
            
            console.log('✅ Initial message generated and queued');
            
        } catch (error) {
            console.error('❌ Failed to generate initial message:', error);
            throw error;
        }
    }

    async processRound(round) {
        try {
            console.log(`🔄 Processing keygen round ${round}...`);
            
            const roundMessages = this.getRoundMessages(round);
            if (!roundMessages || roundMessages.length === 0) {
                console.warn(`⚠️ No messages found for round ${round}`);
                return;
            }
            
            // Filter messages based on round type
            const onlyToUs = !(round === 1 || round === 4);
            const filteredMessages = this.filterMessagesForWasm(roundMessages, onlyToUs);
            
            // Convert protocol messages to WASM messages
            const wasmMessages = filteredMessages.map(msg => this.convertToWasmMessage(msg));
            
            // Process messages through WASM
            let responseMessages;
            try {
                responseMessages = this.keygenSession.handleMessages(wasmMessages);
            } catch (error) {
                const errorMessage = `WASM processing failed in round ${round}: ${error}`;
                this.emit('keygen:error', new Error(errorMessage));
                throw error;
            }
            
            // Convert WASM responses to protocol messages and queue them
            const protocolResponses = responseMessages.map(msg => this.convertToProtocolMessage(msg, round + 1));
            for (const response of protocolResponses) {
                this.protocolManager.queueMessage(response);
            }
            
            // Handle round-specific logic
            const roundHandler = this.roundHandlers.get(round);
            if (roundHandler) {
                await roundHandler();
            } else {
                console.warn(`⚠️ No handler for round ${round}`);
            }
            
        } catch (error) {
            console.error(`❌ Error processing keygen round ${round}:`, error);
            this.emit('keygen:error', error);
        }
    }

    async handleRound1() {
        console.log('🔄 Processing round 1: Initial commitments');
        this.emit('keygen:round', { round: 1, total: 4 });
    }

    async handleRound2() {
        console.log('🔄 Processing round 2: Share distribution');
        this.emit('keygen:round', { round: 2, total: 4 });
    }

    async handleRound3() {
        console.log('🔄 Processing round 3: Verification');
        this.emit('keygen:round', { round: 3, total: 4 });
    }

    async handleRound4() {
        try {
            console.log('🔄 Processing round 4: Finalization');
            
            if (!this.keygenSession) {
                throw new Error('Keygen session not available for finalization');
            }
            
            // Get the generated keyshare
            const keyshare = this.keygenSession.getKeyshare();
            
            // Extract public key from keyshare
            this.publicKey = keyshare.publicKey;
            this.isKeygenComplete = true;
            
            console.log('🎉 Keygen completed successfully!');
            console.log('🔑 Public key:', this.publicKey);
            
            // Emit completion event
            this.emit('keygen:complete', {
                publicKey: this.publicKey,
                partyId: this.partyId,
                groupId: this.groupId,
                threshold: this.threshold,
                totalParties: this.totalParties,
                keyshare: keyshare
            });
            
        } catch (error) {
            console.error('❌ Error in round 4 finalization:', error);
            this.emit('keygen:error', error);
        }
    }

    filterMessagesForWasm(messages, onlyToUs) {
        if (onlyToUs) {
            // Only include messages sent to us
            return messages.filter(msg => msg.to_id === this.partyId || msg.to_id === '0');
        } else {
            // Include all messages except from us
            return messages.filter(msg => msg.from_id !== this.partyId);
        }
    }

    convertToWasmMessage(protocolMessage) {
        // Decrypt content if needed
        let content = protocolMessage.content;
        if (this.protocolManager.websocketManager.encryptionKey) {
            const decryptedBytes = this.protocolManager.websocketManager.cryptoUtils.base64ToBytes(content);
            content = this.protocolManager.websocketManager.cryptoUtils.bytesToBase64(decryptedBytes);
        }
        
        return new this.Message(
            this.protocolManager.websocketManager.cryptoUtils.base64ToBytes(content),
            this.parsePartyId(protocolMessage.from_id),
            protocolMessage.to_id === '0' ? undefined : this.parsePartyId(protocolMessage.to_id)
        );
    }

    convertToProtocolMessage(wasmMessage, round) {
        const encryptedContent = this.protocolManager.websocketManager.cryptoUtils.bytesToBase64(wasmMessage.payload);
        
        return {
            group_id: this.groupId,
            from_id: this.partyId,
            to_id: wasmMessage.toId ? this.formatPartyId(wasmMessage.toId) : '0',
            content: encryptedContent,
            round: round,
            timestamp: new Date().toISOString()
        };
    }

    hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }

    async queueResponses(responses, round) {
        console.log(`📤 Queueing ${responses.length} keygen responses for round ${round}`);
        
        for (const wasmResponse of responses) {
            try {
                // Convert WASM response to protocol message
                const encryptedContent = this.protocolManager.websocketManager.cryptoUtils.bytesToBase64(wasmResponse.payload);
                
                const protocolMessage = {
                    group_id: this.groupId,
                    from_id: this.partyId,
                    to_id: wasmResponse.toId ? this.formatPartyId(wasmResponse.toId) : '0',
                    content: encryptedContent,
                    round: round,
                    timestamp: new Date().toISOString()
                };
                
                // Queue message for sending
                this.protocolManager.queueMessage(protocolMessage);
                
            } catch (error) {
                console.error('❌ Error queueing keygen response:', error);
            }
        }
    }

    getKeygenStatus() {
        return {
            ...this.getStatus(),
            isKeygenComplete: this.isKeygenComplete,
            publicKey: this.publicKey,
            threshold: this.threshold,
            totalParties: this.totalParties,
            wasmModuleLoaded: !!this.wasmModule,
            keygenSessionActive: !!this.keygenSession
        };
    }

    cleanup() {
        try {
            if (this.keygenSession && this.wasmModule) {
                this.wasmModule.cleanup_keygen_session(this.keygenSession);
                this.keygenSession = null;
            }
            this.clear();
            console.log('🧹 Keygen resources cleaned up');
        } catch (error) {
            console.error('❌ Error cleaning up keygen resources:', error);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KeygenProcessor;
} else {
    // Browser/extension environment
    window.KeygenProcessor = KeygenProcessor;
}
