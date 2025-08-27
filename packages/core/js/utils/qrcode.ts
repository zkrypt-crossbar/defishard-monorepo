// QR Code utilities for DeFiShArd SDK
// Handles generation and parsing of QR codes with AES encryption keys

export interface QRCodeData {
  type: 'keygen' | 'sign' | 'rotation';
  aesKey: string;  // base64 encoded AES key
  groupId: string;
  threshold: number;
  totalParties: number;
  timeout?: number;
  messageHash?: string;  // for sign
  rotationType?: string; // for rotation
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
 * Generate AES key for QR code
 */
function generateAESKey(): { key: Uint8Array; base64: string } {
  const key = crypto.getRandomValues(new Uint8Array(32)); // 256-bit key
  const base64 = btoa(String.fromCharCode(...key));
  return { key, base64 };
}

/**
 * Generate QR code data for keygen session
 */
export function generateKeygenQRCode(
  groupId: string,
  threshold: number,
  totalParties: number,
  timeout: number = 60
): { qrData: string; aesKey: string } {
  const { base64: aesKey } = generateAESKey();
  
  const qrData: QRCodeData = {
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
export function generateSignQRCode(
  groupId: string,
  messageHash: string,
  threshold: number,
  totalParties: number,
  txId?: string,
  description?: string
): { qrData: string; aesKey: string } {
  const { base64: aesKey } = generateAESKey();
  
  const qrData: QRCodeData = {
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
export function generateRotationQRCode(
  groupId: string,
  rotationType: string,
  threshold: number,
  totalParties: number,
  timeout: number = 60
): { qrData: string; aesKey: string } {
  const { base64: aesKey } = generateAESKey();
  
  const qrData: QRCodeData = {
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
export function parseQRCode(qrDataString: string): QRCodeParseResult {
  const qrData: QRCodeData = JSON.parse(qrDataString);
  
  // Validate required fields
  if (!qrData.type || !qrData.aesKey || !qrData.groupId || !qrData.threshold || !qrData.totalParties) {
    throw new Error('Invalid QR code data: missing required fields');
  }
  
  // Validate timestamp (not too old)
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  if (Date.now() - qrData.timestamp > maxAge) {
    throw new Error('QR code has expired');
  }
  
  const result: QRCodeParseResult = {
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
export function validateQRCodeData(qrData: QRCodeData): boolean {
  return !!(
    qrData.type &&
    qrData.aesKey &&
    qrData.groupId &&
    qrData.threshold &&
    qrData.totalParties &&
    qrData.timestamp &&
    qrData.version
  );
}

/**
 * Check if QR code has expired
 */
export function isQRCodeExpired(qrData: QRCodeData, maxAgeMinutes: number = 60): boolean {
  const maxAge = maxAgeMinutes * 60 * 1000;
  return Date.now() - qrData.timestamp > maxAge;
}
