/**
 * Generic AES Encryption/Decryption Utilities
 *
 * Provides reusable AES-256-GCM encryption/decryption functions
 * that can be used for keyshares, ECDH, and other cryptographic operations.
 */
export interface EncryptedData {
    version: string;
    timestamp: number;
    salt: number[];
    iv: number[];
    encryptedData: number[];
    checksum: string;
    metadata: {
        [key: string]: any;
    };
    algorithm: 'AES-256-GCM';
    keyDerivation: string;
    iterations: number;
    usePasskey: boolean;
}
export interface EncryptionOptions {
    metadata?: {
        [key: string]: any;
    };
    keyDerivation?: string;
    iterations?: number;
    usePasskey?: boolean;
}
/**
 * AES Encryption/Decryption Utilities
 */
export declare class AESUtils {
    /**
     * Encrypt data with AES-256-GCM
     *
     * @param data - Data to encrypt (string or ArrayBuffer)
     * @param encryptionKey - CryptoKey for encryption
     * @param options - Encryption options
     * @returns EncryptedData object
     */
    static encrypt(data: string | ArrayBuffer, encryptionKey: CryptoKey, options?: EncryptionOptions): Promise<EncryptedData>;
    /**
     * Decrypt data with AES-256-GCM
     *
     * @param encryptedData - EncryptedData object
     * @param encryptionKey - CryptoKey for decryption
     * @returns Decrypted data as ArrayBuffer
     */
    static decrypt(encryptedData: EncryptedData, encryptionKey: CryptoKey): Promise<ArrayBuffer>;
    /**
     * Decrypt data and convert to string
     *
     * @param encryptedData - EncryptedData object
     * @param encryptionKey - CryptoKey for decryption
     * @returns Decrypted data as string
     */
    static decryptToString(encryptedData: EncryptedData, encryptionKey: CryptoKey): Promise<string>;
    /**
     * Generate SHA-256 checksum for data integrity
     */
    private static generateChecksum;
    /**
     * Validate encrypted data structure
     */
    private static validateEncryptedData;
    /**
     * Utility function to convert ArrayBuffer to base64
     */
    static arrayBufferToBase64(buffer: ArrayBuffer): string;
    /**
     * Utility function to convert base64 to ArrayBuffer
     */
    static base64ToArrayBuffer(base64: string): ArrayBuffer;
    /**
     * Utility function to convert Uint8Array to hex string
     */
    static uint8ArrayToHex(bytes: Uint8Array): string;
    /**
     * Utility function to convert hex string to Uint8Array
     */
    static hexToUint8Array(hex: string): Uint8Array;
}
