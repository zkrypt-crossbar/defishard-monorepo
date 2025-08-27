import { KeygenSession, Keyshare } from '../../pkg/dkls_wasm_ll.js';
import { ProtocolMessage, KeyShare } from '../types';
import { BaseProcessor, BaseProcessorConfig } from './base-processor';
import { StorageInterface } from '../storage/interface';
export interface KeygenProcessorConfig extends BaseProcessorConfig {
    distributed: boolean;
    secret?: string;
    storage?: StorageInterface;
}
export interface KeygenProcessorEvents {
    'round-complete': (round: number, messages: ProtocolMessage[]) => void;
    'keygen-complete': (keyShare: KeyShare) => void;
    'error': (error: Error) => void;
}
export declare class KeygenProcessor extends BaseProcessor {
    private session;
    private keygenConfig;
    private storage;
    private generatedKeyshare;
    private isKeyRotation;
    constructor(config: KeygenProcessorConfig, isKeyRotation?: boolean);
    /**
     * Initialize the keygen session
     */
    initialize(oldKeyshare?: Keyshare): Promise<void>;
    /**
     * Handle start round (round 0)
     */
    protected handleStartRound(): Promise<ProtocolMessage[]>;
    /**
     * Process a complete round
     */
    protected processRound(round: number, messages: ProtocolMessage[]): Promise<ProtocolMessage[]>;
    /**
     * Filter messages for WASM processing
     * @param messages - Protocol messages to filter
     * @param onlyToUs - If true, only include messages sent to us (rounds 2,3), if false include all except from us (rounds 1,4)
     */
    protected filterMessagesForWasm(messages: ProtocolMessage[], onlyToUs: boolean): ProtocolMessage[];
    /**
     * Get expected message count for a round
     */
    protected getExpectedMessageCount(round: number): number;
    /**
     * Get processor name for logging
     */
    protected getProcessorName(): string;
    /**
     * Get process name for logging
     */
    protected getProcessName(): string;
    /**
     * Get WASM message class
     */
    protected getWasmMessageClass(): any;
    /**
     * Check if keygen is complete
     */
    isKeygenComplete(): boolean;
    /**
     * Save keyshare using storage interface
     */
    private saveKeyshare;
    /**
     * Handle backup logic for key rotation
     * Strategy: Keep only 2 versions - current and backup
     */
    private handleKeyRotationBackup;
    /**
     * Get the session for debugging
     */
    getSession(): KeygenSession | null;
    /**
     * Override processMessage to handle END message completion from server
     */
    processMessage(message: ProtocolMessage): Promise<ProtocolMessage[]>;
    /**
     * Clean up resources
     */
    destroy(): void;
}
