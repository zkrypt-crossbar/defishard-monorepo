export interface QRCodeData {
    type: 'keygen' | 'sign' | 'rotation';
    aesKey: string;
    groupId: string;
    threshold: number;
    totalParties: number;
    timeout?: number;
    messageHash?: string;
    rotationType?: string;
    timestamp: number;
    version: string;
}
export interface QRCodeParseResult {
    type: string;
    groupId: string;
    aesKey: string;
    groupInfo: {
        groupId: string;
        totalParties: number;
        threshold: number;
        timeout?: number;
    };
    transactionInfo?: {
        messageHash: string;
        txId?: string;
        description?: string;
    };
    rotationInfo?: {
        rotationType: string;
    };
}
/**
 * Generate QR code data for keygen session
 */
export declare function generateKeygenQRCode(groupId: string, threshold: number, totalParties: number, timeout?: number): {
    qrData: string;
    aesKey: string;
};
/**
 * Generate QR code data for signing session
 */
export declare function generateSignQRCode(groupId: string, messageHash: string, threshold: number, totalParties: number, txId?: string, description?: string): {
    qrData: string;
    aesKey: string;
};
/**
 * Generate QR code data for key rotation session
 */
export declare function generateRotationQRCode(groupId: string, rotationType: string, threshold: number, totalParties: number, timeout?: number): {
    qrData: string;
    aesKey: string;
};
/**
 * Parse QR code data
 */
export declare function parseQRCode(qrDataString: string): QRCodeParseResult;
/**
 * Validate QR code data structure
 */
export declare function validateQRCodeData(qrData: QRCodeData): boolean;
/**
 * Check if QR code has expired
 */
export declare function isQRCodeExpired(qrData: QRCodeData, maxAgeMinutes?: number): boolean;
