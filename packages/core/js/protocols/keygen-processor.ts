import { KeygenSession, Message, Keyshare } from '../../pkg/dkls_wasm_ll.js';
import { ProtocolMessage, GroupInfo, KeyShare } from '../types';
import { BaseProcessor, BaseProcessorConfig } from './base-processor';
import { StorageInterface } from '../storage/interface';

export interface KeygenProcessorConfig extends BaseProcessorConfig {
  distributed: boolean;
  secret?: string;
  storage?: StorageInterface; // Optional storage implementation
}

export interface KeygenProcessorEvents {
  'round-complete': (round: number, messages: ProtocolMessage[]) => void;
  'keygen-complete': (keyShare: KeyShare) => void;
  'error': (error: Error) => void;
}

export class KeygenProcessor extends BaseProcessor {
  private session: KeygenSession | null = null;
  private keygenConfig: KeygenProcessorConfig;
  private storage: StorageInterface | null = null;
  private generatedKeyshare: any = null; // Store keyshare until END messages are received
  private isKeyRotation: boolean = false; // Flag to indicate if this is key rotation

  constructor(config: KeygenProcessorConfig, isKeyRotation: boolean = false) {
    super(config);
    this.keygenConfig = config;
    this.storage = config.storage || null;
    this.isKeyRotation = isKeyRotation;
  }

  /**
   * Initialize the keygen session
   */
  async initialize(oldKeyshare?: Keyshare): Promise<void> {
    try {
      if (oldKeyshare) {
        // Key rotation initialization
        this.session = KeygenSession.initKeyRotation(
          oldKeyshare,
          undefined, // seed
          this.keygenConfig.distributed
        );
      } else {
        // Regular DKG initialization
        this.session = new KeygenSession(
          this.config.groupInfo.totalParties,
          this.config.groupInfo.threshold,
          this.config.partyIndex,
          this.hexToBytes(this.config.groupId),
          undefined, // seed
          this.keygenConfig.distributed
        );
      }
      this.currentRound = -1;
    } catch (error) {
      this.emit('error', new Error(`Failed to initialize ${oldKeyshare ? 'key rotation' : 'keygen'}: ${error}`));
      throw error;
    }
  }

  /**
   * Handle start round (round 0)
   */
  protected async handleStartRound(): Promise<ProtocolMessage[]> {
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    try {
      // Creating first message
      const firstMessage = this.session.createFirstMessage();
      const protocolMessage = this.convertToProtocolMessage(firstMessage, 1);
      
      // Move to round 1 to receive messages from other parties
      this.currentRound = 1;
      this.roundStates.set(1, { messages: [], processed: false, emitted: false });
      
      // Emit round-complete event
      const roundState = this.roundStates.get(0)!;
      if (!roundState.emitted) {
        roundState.emitted = true;
        // First message created
        this.emit('round-complete', 0, [protocolMessage]);
      }
      
      return [protocolMessage];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Process a complete round
   */
  protected async processRound(round: number, messages: ProtocolMessage[]): Promise<ProtocolMessage[]> {
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    const roundState = this.roundStates.get(round)!;

    try {
      // Round 5 is deprecated - server handles completion, no WASM processing needed
      if (round === 5) {
        roundState.processed = true;
        return [];
      }

      // Processing round

      // Apply filtering based on round
      // Rounds 1,4: broadcast messages (include all except from us)
      // Rounds 2,3: point-to-point messages (only include messages sent to us)
      const onlyToUs = !(round === 1 || round === 4);
      const filteredMessages = this.filterMessagesForWasm(messages, onlyToUs);

      if (this.debug) {
    
      }

      // Convert protocol messages to WASM messages
      const wasmMessages = filteredMessages.map(msg => this.convertToWasmMessage(msg));

      // Process messages through WASM
      let responseMessages: Message[];
      try {
        responseMessages = this.session.handleMessages(wasmMessages);
      } catch (error) {
        const errorMessage = `WASM processing failed in round ${round}: ${error}`;
        this.emit('error', new Error(errorMessage));
        throw error;
      }

      if (this.debug) {
    
      }

      // Convert WASM responses to protocol messages
      const protocolResponses = responseMessages.map(msg => this.convertToProtocolMessage(msg, round + 1));

      // Handle round 4: complete keygen and send DONE message
      if (round === 4) {
        // Check if already completed to prevent re-processing
        if (this.isComplete) {
          if (this.debug) {
            console.log(`[KeygenProcessor] Round 4 already processed, keygen complete. Skipping.`);
          }
          return [];
        }
        
        try {
          const keyShare = this.session.keyshare();
          
          // Save keyshare using storage interface asynchronously (don't block)
          this.saveKeyshare(keyShare).catch((error: unknown) => {
            this.emit('error', new Error(`Failed to save keyshare: ${error}`));
          });
          
          // Store the keyshare for completion when server sends END:SUCCESS
          this.generatedKeyshare = keyShare;
          
          // Send DONE message to server (unencrypted status message)
          const doneMessage = {
            group_id: this.config.groupId,
            from_id: this.config.partyId,
            to_id: '00000000000000000000000000000000000000000000000000000000000000000000', // Server ID - triggers no encryption
            content: 'DONE',
            round: 5,
            timestamp: new Date().toISOString()
          };
          
          // Emit round complete event
          if (!roundState.emitted) {
            roundState.emitted = true;
            this.emit('round-complete', round, [doneMessage]);
          }

          roundState.processed = true;
          
          // Store keyshare for completion when server sends END:SUCCESS
          // Don't emit keygen-complete yet - wait for server confirmation
          
          return [doneMessage];
        } catch (error) {
          const errorMessage = `Failed to complete keygen in round ${round}: ${error}`;
          this.emit('error', new Error(errorMessage));
          throw error;
        }
      }





      // Move to next round
      this.currentRound = round + 1;
      this.roundStates.set(this.currentRound, {
        messages: [],
        processed: false,
        emitted: false
      });

      // Emit round complete event
      if (!roundState.emitted) {
        roundState.emitted = true;
        this.emit('round-complete', round, protocolResponses);
      }

      roundState.processed = true;
      
      return protocolResponses;

    } catch (error) {
      const errorMessage = `Failed to process round ${round}: ${error}`;
      this.emit('error', new Error(errorMessage));
      throw error;
    }
  }

  /**
   * Filter messages for WASM processing
   * @param messages - Protocol messages to filter
   * @param onlyToUs - If true, only include messages sent to us (rounds 2,3), if false include all except from us (rounds 1,4)
   */
  protected filterMessagesForWasm(messages: ProtocolMessage[], onlyToUs: boolean): ProtocolMessage[] {
    return messages.filter(msg => {
      const fromIndex = this.config.groupInfo.members.findIndex(m => m.partyId === msg.from_id);
      
      // Always exclude messages from ourselves
      if (fromIndex === this.config.partyIndex) {
        return false;
      }
      
      // If onlyToUs is true, also check if message is addressed to us
      if (onlyToUs) {
        const toIndex = msg.to_id === '0' ? undefined : 
          this.config.groupInfo.members.findIndex(m => m.partyId === msg.to_id);
        return toIndex === this.config.partyIndex || msg.to_id === '0';
      }
      
      return true;
    });
  }

  /**
   * Get expected message count for a round
   */
  protected getExpectedMessageCount(round: number): number {
    const totalParties = this.config.groupInfo.totalParties;
    
    switch (round) {
      case 1: // Round 1: broadcast messages from all parties except self
      case 2: // Round 2: point-to-point messages from all parties except self
      case 3: // Round 3: point-to-point messages from all parties except self
      case 4: // Round 4: broadcast messages from all parties except self
        return totalParties - 1;
      default:
        return 0;
    }
  }

  /**
   * Get processor name for logging
   */
  protected getProcessorName(): string {
    return 'KeygenProcessor';
  }

  /**
   * Get process name for logging
   */
  protected getProcessName(): string {
    return 'keygen';
  }

  /**
   * Get WASM message class
   */
  protected getWasmMessageClass(): any {
    return Message;
  }

  /**
   * Check if keygen is complete
   */
  isKeygenComplete(): boolean {
    return this.isComplete;
  }

  /**
   * Save keyshare using storage interface
   */
  private async saveKeyshare(keyShare: any): Promise<void> {
    try {
      if (this.debug) {
        console.log(`[KeygenProcessor] 💾 Attempting to save keyshare...`);
      }
      
      if (!this.storage) {
        if (this.debug) {
          console.log(`[KeygenProcessor] ⚠️ No storage implementation provided, skipping keyshare save`);
        }
        return;
      }

      // Convert WASM keyshare to our KeyShare format
      const keyshareData: KeyShare = {
        serialized: Array.from(keyShare.toBytes()), // Convert to regular array
        publicKey: Array.from(keyShare.publicKey as Uint8Array).map(b => b.toString(16).padStart(2, '0')).join(''), // Convert to hex string
        participants: keyShare.participants,
        threshold: keyShare.threshold,
        partyId: this.config.partyId, // Use config party ID (string), not WASM party ID (number)
        partyIndex: this.config.partyIndex,
        groupId: this.config.groupId,
        totalParties: this.config.groupInfo.totalParties,
        timestamp: new Date().toISOString(),
        apiKey: this.config.apiKey // Store API key for later use in rotation/signing
      };

      const storageKey = `keyshare_${this.config.groupId}_${this.config.partyIndex}`;
      
      // For key rotation: backup existing keyshare before saving new one
      if (this.isKeyRotation) {
        await this.handleKeyRotationBackup(storageKey, keyshareData);
      } else {
        // Regular keygen: just save the keyshare
        await this.storage.save(storageKey, JSON.stringify(keyshareData));
      }
    } catch (error) {
      console.error(`[KeygenProcessor] ❌ Failed to save keyshare: ${error}`);
      throw error;
    }
  }

  /**
   * Handle backup logic for key rotation
   * Strategy: Keep only 2 versions - current and backup
   */
  private async handleKeyRotationBackup(storageKey: string, newKeyshareData: KeyShare): Promise<void> {
    try {
      if (!this.storage) {
        throw new Error('Storage not available for key rotation backup');
      }
      
      const backupKey = `${storageKey}.bak`;
      
      // Check if there's an existing keyshare to backup
      const existingKeyshare = await this.storage.get(storageKey);
      
      if (existingKeyshare) {
        // Delete old backup if it exists (keep only 2 versions)
        try {
          const oldBackup = await this.storage.get(backupKey);
          if (oldBackup) {
            await this.storage.remove(backupKey);
          }
        } catch (error) {
          // Silently continue if backup deletion fails
        }
        
        // Move current keyshare to backup
        await this.storage.save(backupKey, existingKeyshare);
      }
      
      // Save new rotated keyshare
      await this.storage.save(storageKey, JSON.stringify(newKeyshareData));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get the session for debugging
   */
  getSession(): KeygenSession | null {
    return this.session;
  }

  // KeygenProcessor is only for regular DKG, not key rotation

  /**
   * Override processMessage to handle END message completion from server
   */
  async processMessage(message: ProtocolMessage): Promise<ProtocolMessage[]> {
    // Handle END messages from server (with status codes)
    if (message.content.startsWith('END:') && message.from_id === '00000000000000000000000000000000000000000000000000000000000000000000') {
      // Only process END messages if we've already started (currentRound >= 0)
      if (this.currentRound >= 0) {
        const status = message.content.split(':')[1];
        
        // Mark as complete regardless of status
        this.isComplete = true;
        
        // Emit keygen-complete when server confirms completion
        if (this.generatedKeyshare) {
          this.emit('keygen-complete', this.generatedKeyshare);
          this.generatedKeyshare = null; // Clear it after emission
        }
        
        // Emit status event for error handling
        if (status !== 'SUCCESS') {
          this.emit('error', new Error(`Keygen process ended with status: ${status}`));
        }
        
        return [];
      } else {
        // Old END message from previous session, ignore it
        return [];
      }
    }


    
    // For all other messages, use the parent implementation
    return super.processMessage(message);
  }

  /**
   * Clean up resources
   */
  override destroy(): void {
    // Nullify session
    this.session = null;
    
    // Call parent destroy
    super.destroy();
  }
}