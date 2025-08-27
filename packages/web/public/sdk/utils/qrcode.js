// QR Code utilities for DeFiShArd SDK
// Handles generation and parsing of QR codes with AES encryption keys
/**
 * Generate AES key for QR code
 */
function generateAESKey() {
    const key = crypto.getRandomValues(new Uint8Array(32)); // 256-bit key
    const base64 = btoa(String.fromCharCode(...key));
    return { key, base64 };
}
/**
 * Generate QR code data for keygen session
 */
export function generateKeygenQRCode(groupId, threshold, totalParties, timeout = 60) {
    const { base64: aesKey } = generateAESKey();
    const qrData = {
        type: 'keygen',
        aesKey,
        groupId,
        threshold,
        totalParties,
        timeout,
        timestamp: Date.now(),
        version: '1.0'
    };
    return {
        qrData: JSON.stringify(qrData),
        aesKey
    };
}
/**
 * Generate QR code data for signing session
 */
export function generateSignQRCode(groupId, messageHash, threshold, totalParties, txId, description) {
    const { base64: aesKey } = generateAESKey();
    const qrData = {
        type: 'sign',
        aesKey,
        groupId,
        threshold,
        totalParties,
        messageHash,
        timestamp: Date.now(),
        version: '1.0'
    };
    return {
        qrData: JSON.stringify(qrData),
        aesKey
    };
}
/**
 * Generate QR code data for key rotation session
 */
export function generateRotationQRCode(groupId, rotationType, threshold, totalParties, timeout = 60) {
    const { base64: aesKey } = generateAESKey();
    const qrData = {
        type: 'rotation',
        aesKey,
        groupId,
        threshold,
        totalParties,
        timeout,
        rotationType,
        timestamp: Date.now(),
        version: '1.0'
    };
    return {
        qrData: JSON.stringify(qrData),
        aesKey
    };
}
/**
 * Parse QR code data
 */
export function parseQRCode(qrDataString) {
    const qrData = JSON.parse(qrDataString);
    // Validate required fields
    if (!qrData.type || !qrData.aesKey || !qrData.groupId || !qrData.threshold || !qrData.totalParties) {
        throw new Error('Invalid QR code data: missing required fields');
    }
    // Validate timestamp (not too old)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - qrData.timestamp > maxAge) {
        throw new Error('QR code has expired');
    }
    const result = {
        type: qrData.type,
        groupId: qrData.groupId,
        aesKey: qrData.aesKey,
        groupInfo: {
            groupId: qrData.groupId,
            totalParties: qrData.totalParties,
            threshold: qrData.threshold,
            timeout: qrData.timeout
        }
    };
    // Add protocol-specific info
    if (qrData.type === 'sign' && qrData.messageHash) {
        result.transactionInfo = {
            messageHash: qrData.messageHash
        };
    }
    if (qrData.type === 'rotation' && qrData.rotationType) {
        result.rotationInfo = {
            rotationType: qrData.rotationType
        };
    }
    return result;
}
/**
 * Validate QR code data structure
 */
export function validateQRCodeData(qrData) {
    return !!(qrData.type &&
        qrData.aesKey &&
        qrData.groupId &&
        qrData.threshold &&
        qrData.totalParties &&
        qrData.timestamp &&
        qrData.version);
}
/**
 * Check if QR code has expired
 */
export function isQRCodeExpired(qrData, maxAgeMinutes = 60) {
    const maxAge = maxAgeMinutes * 60 * 1000;
    return Date.now() - qrData.timestamp > maxAge;
}
