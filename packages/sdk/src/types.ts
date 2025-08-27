// Configuration types
export interface Config {
  relayerUrl: string;
  websocketUrl: string;
  apiKey?: string;
  partyId?: string;
  groupId?: string;
  privateKey?: string;
  debug?: boolean;
}

// API response types
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

// Protocol message types
export interface ProtocolMessage {
  group_id: string;
  from_id: string;
  to_id: string; // '0' for broadcast
  content: string; // base64 encoded
  round: number;
  timestamp: string;
}

// Session state types
export type SessionType = 'keygen' | 'sign';

export interface SessionState {
  type: SessionType;
  session: any; // KeygenSession or SignSession from WASM
  round: number;
  partyIndex: number;
  groupInfo: GroupInfo;
  messageHash?: Uint8Array; // Only for sign sessions
}

// Key share and signature types
export interface KeyShare {
  serialized: number[]; // Serialized keyshare bytes
  publicKey: string; // Hex string of public key
  participants: number;
  threshold: number;
  partyId: string; // Changed from number to string to match party ID format
  partyIndex: number;
  groupId: string;
  totalParties: number;
  timestamp: string;
  apiKey?: string; // API key for this group (for rotation/signing)
}

export interface Signature {
  r: Uint8Array;
  s: Uint8Array;
}

// Unified encryption types
export interface EncryptionOptions {
  usePasskey?: boolean;        // Use Passkey PRF instead of password
  password?: string;           // User password (fallback)
  rpId?: string;              // Relying Party ID for Passkey
  iterations?: number;         // PBKDF2 iterations (default: 100000)
}

export interface DecryptionOptions {
  usePasskey?: boolean;
  password?: string;
  rpId?: string;
}

export interface EncryptedKeyshare {
  version: string;             // Encryption format version
  timestamp: number;           // Encryption timestamp
  salt: number[];              // 32-byte salt for key derivation
  iv: number[];                // 16-byte IV for AES-GCM
  encryptedData: number[];     // Encrypted keyshare bytes
  checksum: string;            // SHA-256 integrity check
  metadata: {                  // Keyshare metadata (unencrypted)
    groupId: string;
    partyId: number;
    publicKey: string;
    threshold: number;
    participants: number;
  };
  algorithm: 'AES-256-GCM';    // Encryption algorithm
  keyDerivation: 'Passkey-PRF' | 'PBKDF2'; // Key derivation method
  iterations: number;          // PBKDF2 iterations
  usePasskey: boolean;         // Whether Passkey was used
}

export interface PasskeySetupResult {
  credentialId: string;
  publicKey: string;
  rpId: string;
  success: boolean;
}

// Key rotation types
export type RotationType = 'proactive' | 'reactive' | 'recovery';

export interface KeyRotationConfig {
  type: RotationType;
  oldKeyshare: KeyShare;
  seed?: Uint8Array;
  isDistributed?: boolean;
  lostShares?: Uint8Array; // For recovery type
}

export interface KeyRotationResult {
  newKeyshare: KeyShare;
  publicKey: string; // Should be the same as old keyshare
  success: boolean;
}

// Error types
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  PROTOCOL_ERROR = 'PROTOCOL_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  WASM_ERROR = 'WASM_ERROR'
}

export interface SDKError extends Error {
  type: ErrorType;
  code?: string;
  details?: any;
}

// Event types
export type SDKEvent =
  | 'initialized'
  | 'connected'
  | 'disconnected'
  | 'registered'
  | 'groupCreated'
  | 'groupJoined'
  | 'keygenStarted'
  | 'keygenComplete'
  | 'signingStarted'
  | 'signingComplete'
  | 'message'
  | 'error'
  | 'round-complete'
  | 'keygen-complete'
  | 'signing-complete'
  | 'keyshareEncrypted'
  | 'keyshareDecrypted'
  | 'passkeySetup'
  | 'keyRotationStarted'
  | 'keyRotationComplete';

export type EventHandler = (data?: any) => void; 