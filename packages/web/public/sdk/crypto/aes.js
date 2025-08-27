/**
 * Generic AES Encryption/Decryption Utilities
 *
 * Provides reusable AES-256-GCM encryption/decryption functions
 * that can be used for keyshares, ECDH, and other cryptographic operations.
 */
/**
 * AES Encryption/Decryption Utilities
 */
export class AESUtils {
    /**
     * Encrypt data with AES-256-GCM
     *
     * @param data - Data to encrypt (string or ArrayBuffer)
     * @param encryptionKey - CryptoKey for encryption
     * @param options - Encryption options
     * @returns EncryptedData object
     */
    static async encrypt(data, encryptionKey, options = {}) {
        // Generate encryption parameters
        const salt = crypto.getRandomValues(new Uint8Array(32));
        const iv = crypto.getRandomValues(new Uint8Array(16));
        // Convert data to ArrayBuffer if it's a string
        const dataBuffer = typeof data === 'string'
            ? new TextEncoder().encode(data)
            : data;
        // Encrypt the data
        const encryptedData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encryptionKey, dataBuffer);
        // Generate checksum for integrity
        const checksum = await this.generateChecksum(encryptedData);
        // Create encrypted data object
        return {
            version: '1.0',
            timestamp: Date.now(),
            salt: Array.from(salt),
            iv: Array.from(iv),
            encryptedData: Array.from(new Uint8Array(encryptedData)),
            checksum,
            metadata: options.metadata || {},
            algorithm: 'AES-256-GCM',
            keyDerivation: options.keyDerivation || 'App-Provided',
            iterations: options.iterations || 0,
            usePasskey: options.usePasskey || false
        };
    }
    /**
     * Decrypt data with AES-256-GCM
     *
     * @param encryptedData - EncryptedData object
     * @param encryptionKey - CryptoKey for decryption
     * @returns Decrypted data as ArrayBuffer
     */
    static async decrypt(encryptedData, encryptionKey) {
        // Validate structure
        this.validateEncryptedData(encryptedData);
        // Verify checksum
        const encryptedDataForChecksum = new Uint8Array(encryptedData.encryptedData);
        const expectedChecksum = await this.generateChecksum(encryptedDataForChecksum.buffer);
        if (expectedChecksum !== encryptedData.checksum) {
            throw new Error('Checksum verification failed - data may be corrupted');
        }
        // Decrypt the data
        const decryptedData = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(encryptedData.iv) }, encryptionKey, new Uint8Array(encryptedData.encryptedData));
        return decryptedData;
    }
    /**
     * Decrypt data and convert to string
     *
     * @param encryptedData - EncryptedData object
     * @param encryptionKey - CryptoKey for decryption
     * @returns Decrypted data as string
     */
    static async decryptToString(encryptedData, encryptionKey) {
        const decryptedBuffer = await this.decrypt(encryptedData, encryptionKey);
        return new TextDecoder().decode(decryptedBuffer);
    }
    /**
     * Generate SHA-256 checksum for data integrity
     */
    static async generateChecksum(data) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    /**
     * Validate encrypted data structure
     */
    static validateEncryptedData(encryptedData) {
        if (!encryptedData.version || !encryptedData.salt || !encryptedData.iv ||
            !encryptedData.encryptedData || !encryptedData.checksum ||
            !encryptedData.metadata || !encryptedData.algorithm ||
            !encryptedData.keyDerivation || typeof encryptedData.usePasskey !== 'boolean') {
            throw new Error('Invalid encrypted data structure');
        }
        if (encryptedData.salt.length !== 32) {
            throw new Error('Invalid salt length');
        }
        if (encryptedData.iv.length !== 16) {
            throw new Error('Invalid IV length');
        }
    }
    /**
     * Utility function to convert ArrayBuffer to base64
     */
    static arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
    /**
     * Utility function to convert base64 to ArrayBuffer
     */
    static base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }
    /**
     * Utility function to convert Uint8Array to hex string
     */
    static uint8ArrayToHex(bytes) {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    /**
     * Utility function to convert hex string to Uint8Array
     */
    static hexToUint8Array(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }
}
