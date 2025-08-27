import { SignSession, Keyshare } from '../../pkg/dkls_wasm_ll.js';
import { ProtocolMessage } from '../types';
import { BaseProcessor, BaseProcessorConfig } from './base-processor';
export interface SignProcessorConfig extends BaseProcessorConfig {
    keyShare: Keyshare;
    messageHash: Uint8Array;
    derivationPath?: string;
}
export interface SignProcessorEvents {
    'round-complete': (round: number, messages: ProtocolMessage[]) => void;
    'signing-complete': (signature: [Uint8Array, Uint8Array]) => void;
    'error': (error: Error) => void;
}
export declare class SignProcessor extends BaseProcessor {
    private session;
    private partialSignature;
    private finalSignature;
    private signConfig;
    constructor(config: SignProcessorConfig);
    /**
     * Initialize the sign session
     */
    initialize(): Promise<void>;
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
     * Check if signing is complete
     */
    isSigningComplete(): boolean;
    /**
     * Check if processor is still active (can process messages)
     */
    isActive(): boolean;
    /**
     * Get the session for debugging
     */
    getSession(): SignSession | null;
    /**
     * Override processMessage to handle END message completion from server
     */
    processMessage(message: ProtocolMessage): Promise<ProtocolMessage[]>;
    /**
     * Clean up resources
     */
    destroy(): void;
}
