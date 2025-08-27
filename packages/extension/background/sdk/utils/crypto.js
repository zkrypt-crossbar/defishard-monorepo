/**
 * Crypto utilities for AES-256-GCM encryption/decryption
 * Compatible with DeFiShArd SDK encryption
 */

class CryptoUtils {
    constructor() {
        this.algorithm = 'AES-GCM';
        this.keyLength = 256;
        this.ivLength = 12;
    }

    /**
     * Generate a random AES key
     * @returns {Promise<CryptoKey>}
     */
    async generateKey() {
        return await crypto.subtle.generateKey(
            {
                name: this.algorithm,
                length: this.keyLength
            },
            true,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Import AES key from raw bytes
     * @param {Uint8Array} keyBytes - Raw key bytes
     * @returns {Promise<CryptoKey>}
     */
    async importKey(keyBytes) {
        return await crypto.subtle.importKey(
            'raw',
            keyBytes,
            {
                name: this.algorithm,
                length: this.keyLength
            },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Export key to raw bytes
     * @param {CryptoKey} key - CryptoKey to export
     * @returns {Promise<Uint8Array>}
     */
    async exportKey(key) {
        return await crypto.subtle.exportKey('raw', key);
    }

    /**
     * Generate random IV
     * @returns {Uint8Array}
     */
    generateIV() {
        return crypto.getRandomValues(new Uint8Array(this.ivLength));
    }

    /**
     * Encrypt data with AES-256-GCM
     * @param {string|Uint8Array} data - Data to encrypt
     * @param {CryptoKey} key - Encryption key
     * @param {Uint8Array} iv - Initialization vector (optional, auto-generated if not provided)
     * @returns {Promise<{encrypted: Uint8Array, iv: Uint8Array}>}
     */
    async encrypt(data, key, iv = null) {
        if (!iv) {
            iv = this.generateIV();
        }

        // Convert data to Uint8Array if it's a string
        let dataBytes;
        if (typeof data === 'string') {
            dataBytes = new TextEncoder().encode(data);
        } else {
            dataBytes = data;
        }

        const encrypted = await crypto.subtle.encrypt(
            {
                name: this.algorithm,
                iv: iv
            },
            key,
            dataBytes
        );

        return {
            encrypted: new Uint8Array(encrypted),
            iv: iv
        };
    }

    /**
     * Decrypt data with AES-256-GCM
     * @param {Uint8Array} encryptedData - Encrypted data
     * @param {CryptoKey} key - Decryption key
     * @param {Uint8Array} iv - Initialization vector
     * @returns {Promise<Uint8Array>}
     */
    async decrypt(encryptedData, key, iv) {
        const decrypted = await crypto.subtle.decrypt(
            {
                name: this.algorithm,
                iv: iv
            },
            key,
            encryptedData
        );

        return new Uint8Array(decrypted);
    }

    /**
     * Convert base64 to Uint8Array
     * @param {string} base64 - Base64 string
     * @returns {Uint8Array}
     */
    base64ToBytes(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * Convert Uint8Array to base64
     * @param {Uint8Array} bytes - Bytes to convert
     * @returns {string}
     */
    bytesToBase64(bytes) {
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Convert hex string to Uint8Array
     * @param {string} hex - Hex string
     * @returns {Uint8Array}
     */
    hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }

    /**
     * Convert Uint8Array to hex string
     * @param {Uint8Array} bytes - Bytes to convert
     * @returns {string}
     */
    bytesToHex(bytes) {
        return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CryptoUtils;
} else {
    // Browser/extension environment
    window.CryptoUtils = CryptoUtils;
}
