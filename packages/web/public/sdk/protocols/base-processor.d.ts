import { ProtocolMessage, GroupInfo } from '../types';
import { EventEmitter } from '../events';
export interface BaseProcessorConfig {
    groupInfo: GroupInfo;
    partyId: string;
    partyIndex: number;
    groupId: string;
    debug?: boolean;
    apiKey?: string;
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
export declare abstract class BaseProcessor extends EventEmitter {
    protected config: BaseProcessorConfig;
    protected currentRound: number;
    protected isComplete: boolean;
    protected roundStates: Map<number, RoundState>;
    protected receivedMessageHashes: Set<number>;
    protected debug: boolean;
    constructor(config: BaseProcessorConfig);
    /**
     * Process incoming protocol message
     */
    processMessage(message: ProtocolMessage): Promise<ProtocolMessage[]>;
    /**
     * Start a new round
     */
    protected startRound(round: number): Promise<ProtocolMessage[]>;
    /**
     * Filter messages (exclude messages from self)
     */
    protected filterMessages(messages: ProtocolMessage[]): ProtocolMessage[];
    /**
     * Select messages sent to us specifically
     */
    protected selectMessages(messages: ProtocolMessage[]): ProtocolMessage[];
    /**
     * Convert WASM message to protocol message
     */
    protected convertToProtocolMessage(wasmMessage: any, round: number): ProtocolMessage;
    /**
     * Convert protocol message to WASM message
     */
    protected convertToWasmMessage(protocolMessage: ProtocolMessage): any;
    /**
     * Hash message for deduplication
     */
    protected hashMessage(message: ProtocolMessage): number;
    /**
     * Utility functions
     */
    protected bytesToBase64(bytes: Uint8Array): string;
    protected base64ToBytes(base64: string): Uint8Array;
    protected hexToBytes(hex: string): Uint8Array;
    /**
     * Get current state
     */
    getCurrentRound(): number;
    isProcessComplete(): boolean;
    /**
     * Clean up resources
     */
    destroy(): void;
    protected abstract getProcessorName(): string;
    protected abstract getProcessName(): string;
    protected abstract getWasmMessageClass(): any;
    protected abstract getExpectedMessageCount(round: number): number;
    protected abstract handleStartRound(): Promise<ProtocolMessage[]>;
    protected abstract processRound(round: number, messages: ProtocolMessage[]): Promise<ProtocolMessage[]>;
}
