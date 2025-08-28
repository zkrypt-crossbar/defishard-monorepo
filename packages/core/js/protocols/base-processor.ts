import { ProtocolMessage, GroupInfo } from '../types';
import { EventEmitter } from '../events';

export interface BaseProcessorConfig {
  groupInfo: GroupInfo;
  partyId: string;
  partyIndex: number;
  groupId: string;
  debug?: boolean;
  apiKey?: string; // API key for the group
}

export interface BaseProcessorEvents {
  'round-complete': (round: number, messages: ProtocolMessage[]) => void;
  'error': (error: Error) => void;
}

export interface RoundState {
  messages: ProtocolMessage[];
  processed: boolean;
  emitted: boolean;
}

/**
 * Base processor class containing common functionality for both keygen and sign processors
 */
export abstract class BaseProcessor extends EventEmitter {
  protected config: BaseProcessorConfig;
  protected currentRound = 0;
  protected isComplete = false;
  protected roundStates: Map<number, RoundState> = new Map();
  protected receivedMessageHashes: Set<number> = new Set();
  protected debug: boolean;

  constructor(config: BaseProcessorConfig) {
    super();
    this.config = config;
    this.debug = config.debug ?? false;
  }

  /**
   * Process incoming protocol message
   */
  async processMessage(message: ProtocolMessage): Promise<ProtocolMessage[]> {
    if (this.isComplete) {
      if (this.debug) {
        console.log(`[BaseProcessor] Processor already complete, ignoring message from round ${message.round}`);
      }
      return [];
    }

    try {
      // Handle START message
      if (message.round === 0 && (message.content === 'start' || message.content === 'START')) {
        // Start message received
        return await this.startRound(0);
      }

      // Handle END message from server (new format with status codes)
      if (message.content.startsWith('END:') && message.from_id === '00000000000000000000000000000000000000000000000000000000000000000000') {
        // Only process END messages if we've already started (currentRound >= 0)
        if (this.currentRound >= 0) {
          // END message from server - let specific processors handle it
          return [];
        } else {
          // Old END message from previous session, ignore it
          return [];
        }
      }

      // Handle old END message format (for backward compatibility)
      if (message.content === 'end') {
        // Only process END messages if we've already started (currentRound >= 0)
        if (this.currentRound >= 0) {
          // Old END message format - let specific processors handle it
          return [];
        } else {
          // Old END message from previous session, ignore it
          return [];
        }
      }

      // If not started yet, ignore other messages
      if (this.currentRound === -1) {
        return [];
      }

      // Only process protocol messages (not START/END) in rounds 1+
      if (message.round === 0) {
        return [];
      }

      // Ignore messages from ourselves
      if (message.from_id === this.config.partyId) {
        return [];
      }

      // Message deduplication
      const messageHash = this.hashMessage(message);
      if (this.receivedMessageHashes.has(messageHash)) {
        // Duplicate message ignored
        return [];
      }
      this.receivedMessageHashes.add(messageHash);

      // Store message for the message's round
      const messageRound = message.round;
      if (!this.roundStates.has(messageRound)) {
        this.roundStates.set(messageRound, { messages: [], processed: false, emitted: false });
      }
      this.roundStates.get(messageRound)!.messages.push(message);



      // Check if round is ready to be processed
      const roundState = this.roundStates.get(messageRound);
      if (roundState && !roundState.processed) {
        const expectedMessages = this.getExpectedMessageCount(messageRound);
        if (roundState.messages.length >= expectedMessages) {
          // Set processed flag to prevent race conditions
          roundState.processed = true;
          try {
            return await this.processRound(messageRound, roundState.messages);
          } catch (error) {
            // Reset processed flag on error so we can retry
            roundState.processed = false;
            throw error;
          }
        }
      }

      return [];
    } catch (error) {
      this.emit('error', new Error(`Failed to process message: ${error}`));
      throw error;
    }
  }

  /**
   * Start a new round
   */
  protected async startRound(round: number): Promise<ProtocolMessage[]> {
    this.currentRound = round;
    this.roundStates.set(round, {
      messages: [],
      processed: false,
      emitted: false
    });

    if (round === 0) {
      return await this.handleStartRound();
    }

    return [];
  }

  /**
   * Filter messages (exclude messages from self)
   */
  protected filterMessages(messages: ProtocolMessage[]): ProtocolMessage[] {
    return messages.filter(msg => msg.from_id !== this.config.partyId);
  }

  /**
   * Select messages sent to us specifically
   */
  protected selectMessages(messages: ProtocolMessage[]): ProtocolMessage[] {
    return messages.filter(msg => 
      msg.from_id !== this.config.partyId && 
      (msg.to_id === this.config.partyId || msg.to_id === '0')
    );
  }

  /**
   * Convert WASM message to protocol message
   */
  protected convertToProtocolMessage(wasmMessage: any, round: number): ProtocolMessage {
    // Handle message routing based on round and to_id
    let to_id: string;
    if (wasmMessage.to_id === undefined) {
      // If to_id is undefined, this is a broadcast message to all parties
      to_id = '0';
    } else {
      // Validate that the to_id index is within bounds
      if (wasmMessage.to_id >= this.config.groupInfo.members.length) {
        throw new Error(`Invalid message from WASM: to_id index ${wasmMessage.to_id} is out of bounds for group with ${this.config.groupInfo.members.length} members.`);
      }
      to_id = this.config.groupInfo.members[wasmMessage.to_id].partyId;
    }
    
    const message = {
      group_id: this.config.groupId,
      from_id: this.config.partyId,
      to_id,
      content: this.bytesToBase64(wasmMessage.payload),
      round,
      timestamp: new Date().toISOString()
    };
    

    
    return message;
  }

  /**
   * Convert protocol message to WASM message
   */
  protected convertToWasmMessage(protocolMessage: ProtocolMessage): any {
    const payload = this.base64ToBytes(protocolMessage.content);
    const fromId = this.config.groupInfo.members.findIndex(m => m.partyId === protocolMessage.from_id);
    const toId = protocolMessage.to_id === '0' ? undefined : 
      this.config.groupInfo.members.findIndex(m => m.partyId === protocolMessage.to_id);
    
    if (fromId === -1) {
      throw new Error(`Invalid from_id in protocol message: ${protocolMessage.from_id}`);
    }
    
    return new (this.getWasmMessageClass())(
      new Uint8Array(payload),
      fromId,
      toId !== -1 ? toId : undefined
    );
  }

  /**
   * Hash message for deduplication
   */
  protected hashMessage(message: ProtocolMessage): number {
    let hash = 0;
    const str = `${message.from_id}:${message.to_id}:${message.round}:${message.content}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Utility functions
   */
  protected bytesToBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes));
  }

  protected base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    return new Uint8Array(binary.split('').map(char => char.charCodeAt(0)));
  }

  protected hexToBytes(hex: string): Uint8Array {
    return new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  }

  /**
   * Get current state
   */
  getCurrentRound(): number {
    return this.currentRound;
  }

  isProcessComplete(): boolean {
    return this.isComplete;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.debug) console.log(`[${this.getProcessorName()}] 🧹 Cleaning up ${this.getProcessName()} processor`);
    
    // Clear data structures
    this.roundStates.clear();
    this.receivedMessageHashes.clear();
    
    // Remove all event listeners
    this.removeAllListeners();
  }

  // Abstract methods that must be implemented by subclasses
  protected abstract getProcessorName(): string;
  protected abstract getProcessName(): string;
  protected abstract getWasmMessageClass(): any;
  protected abstract getExpectedMessageCount(round: number): number;
  protected abstract handleStartRound(): Promise<ProtocolMessage[]>;
  protected abstract processRound(round: number, messages: ProtocolMessage[]): Promise<ProtocolMessage[]>;
} 