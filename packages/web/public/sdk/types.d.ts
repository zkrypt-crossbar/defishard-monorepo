export interface Config {
    relayerUrl: string;
    websocketUrl: string;
    apiKey?: string;
    partyId?: string;
    groupId?: string;
    privateKey?: string;
    debug?: boolean;
}
export interface RegistrationResult {
    success: boolean;
    message: string;
    partyId: string;
    token: string;
}
export interface GroupMember {
    partyId: string;
    index: number;
}
export interface GroupInfo {
    groupId: string;
    totalParties: number;
    threshold: number;
    timeout: number;
    createdAt: string;
    updatedAt: string;
    createdBy: Party;
    members: GroupMember[];
    status: string;
}
export interface Party {
    id: string;
    partyId: string;
    token: string;
    createdAt: string;
}
export interface GroupResult {
    success: boolean;
    message: string;
    group: GroupInfo;
    status?: string;
}
export interface ProtocolMessage {
    group_id: string;
    from_id: string;
    to_id: string;
    content: string;
    round: number;
    timestamp: string;
}
export type SessionType = 'keygen' | 'sign';
export interface SessionState {
    type: SessionType;
    session: any;
    round: number;
    partyIndex: number;
    groupInfo: GroupInfo;
    messageHash?: Uint8Array;
}
export interface KeyShare {
    serialized: number[];
    publicKey: string;
    participants: number;
    threshold: number;
    partyId: string;
    partyIndex: number;
    groupId: string;
    totalParties: number;
    timestamp: string;
    apiKey?: string;
}
export interface Signature {
    r: Uint8Array;
    s: Uint8Array;
}
export interface EncryptionOptions {
    usePasskey?: boolean;
    password?: string;
    rpId?: string;
    iterations?: number;
}
export interface DecryptionOptions {
    usePasskey?: boolean;
    password?: string;
    rpId?: string;
}
export interface EncryptedKeyshare {
    version: string;
    timestamp: number;
    salt: number[];
    iv: number[];
    encryptedData: number[];
    checksum: string;
    metadata: {
        groupId: string;
        partyId: number;
        publicKey: string;
        threshold: number;
        participants: number;
    };
    algorithm: 'AES-256-GCM';
    keyDerivation: 'Passkey-PRF' | 'PBKDF2';
    iterations: number;
    usePasskey: boolean;
}
export interface PasskeySetupResult {
    credentialId: string;
    publicKey: string;
    rpId: string;
    success: boolean;
}
export type RotationType = 'proactive' | 'reactive' | 'recovery';
export interface KeyRotationConfig {
    type: RotationType;
    oldKeyshare: KeyShare;
    seed?: Uint8Array;
    isDistributed?: boolean;
    lostShares?: Uint8Array;
}
export interface KeyRotationResult {
    newKeyshare: KeyShare;
    publicKey: string;
    success: boolean;
}
export declare enum ErrorType {
    NETWORK_ERROR = "NETWORK_ERROR",
    PROTOCOL_ERROR = "PROTOCOL_ERROR",
    AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    STORAGE_ERROR = "STORAGE_ERROR",
    WASM_ERROR = "WASM_ERROR"
}
export interface SDKError extends Error {
    type: ErrorType;
    code?: string;
    details?: any;
}
export type SDKEvent = 'initialized' | 'connected' | 'disconnected' | 'registered' | 'groupCreated' | 'groupJoined' | 'keygenStarted' | 'keygenComplete' | 'signingStarted' | 'signingComplete' | 'message' | 'error' | 'round-complete' | 'keygen-complete' | 'signing-complete' | 'keyshareEncrypted' | 'keyshareDecrypted' | 'passkeySetup' | 'keyRotationStarted' | 'keyRotationComplete';
export type EventHandler = (data?: any) => void;
