# QR Code + AES Encryption Implementation - Backend-Compatible Version

## Overview
This document provides the implementation specification for adding AES encryption to WebSocket messages using QR code-based key exchange while maintaining **full backend compatibility**.

## 🔐 **Core Design Principles (Backend-Compatible)**

### **Security Requirements:**
- ✅ **Mandatory Encryption**: All message content must be encrypted (no raw message support)
- ✅ **Backend Compatibility**: Maintain exact ProtocolMessage structure
- ✅ **Content-Level Encryption**: Only encrypt the `content` field, not the entire message
- ✅ **QR Code Key Exchange**: AES key exchanged via QR code (physical proximity)
- ✅ **Simple Key Generation**: Initiator generates random AES key
- ✅ **2-Minute Timeout**: QR code expires after 2 minutes
- ✅ **Server Message Handling**: Server messages (from_id = all zeros) are never encrypted/decrypted
- ✅ **Protocol-Specific QR Codes**: Different QR code structures for keygen, sign, and rotation
- 🔄 **Replay Protection**: Will be added in future version

### **Responsibility Separation:**
- **SDK Responsibility**: Generate QR data, parse QR data, handle content encryption/decryption
- **Application Responsibility**: Display QR code, scan QR code

## 📋 **Implementation Phases**

### **Phase 1: Content-Level Encryption Layer**
### **Phase 2: QR Code Data Generation/Parsing (Protocol-Specific)**
### **Phase 3: SDK Integration**
### **Phase 4: Testing & Documentation**

---

## 🔧 **Phase 1: Content-Level Encryption Layer**

### **1.1 Update WebSocketManager (`js/websocket.ts`)**

#### **Add AES Key Management:**
```typescript
export class WebSocketManager extends EventEmitter {
  private aesKey: CryptoKey | null = null;
  private readonly SERVER_ID = '00000000000000000000000000000000000000000000000000000000000000000000';

  /**
   * Set AES key for current session
   */
  async setAESKey(base64Key: string): Promise<void> {
    const keyBytes = AESUtils.base64ToArrayBuffer(base64Key);
    this.aesKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Check if message is from server
   */
  private isServerMessage(message: ProtocolMessage): boolean {
    return message.from_id === this.SERVER_ID;
  }

  /**
   * Check if encryption should be used for this message
   */
  private shouldEncryptMessage(message: ProtocolMessage): boolean {
    return this.aesKey && !this.isServerMessage(message);
  }

  /**
   * Encrypt message content
   */
  private async encryptContent(content: string): Promise<string> {
    if (!this.aesKey) {
      throw new Error('AES key not set. Please scan QR code first.');
    }

    // Encrypt the content string
    const encryptedData = await AESUtils.encrypt(content, this.aesKey, {
      metadata: { type: 'websocket_content' }
    });

    // Return the encrypted data as base64
    return AESUtils.arrayBufferToBase64(
      new TextEncoder().encode(JSON.stringify(encryptedData))
    );
  }

  /**
   * Decrypt message content
   */
  private async decryptContent(encryptedContent: string): Promise<string> {
    if (!this.aesKey) {
      throw new Error('AES key not set. Please scan QR code first.');
    }

    try {
      // Parse the encrypted data
      const encryptedDataString = new TextDecoder().decode(
        AESUtils.base64ToArrayBuffer(encryptedContent)
      );
      const encryptedData = JSON.parse(encryptedDataString);

      // Decrypt the content
      const decryptedString = await AESUtils.decryptToString(encryptedData, this.aesKey);
      return decryptedString;
    } catch (error) {
      throw new Error(`Failed to decrypt content: ${error}`);
    }
  }
}
```

#### **Update Message Sending:**
```typescript
async sendMessage(message: ProtocolMessage): Promise<void> {
  if (this.ws?.readyState === WebSocket.OPEN) {
    let processedMessage = { ...message };

    // Encrypt content if we have an AES key and message is not from server
    if (this.shouldEncryptMessage(message)) {
      processedMessage.content = await this.encryptContent(message.content);
      
      if (this.debug) {
        console.log(`[WebSocket] 🔐 Encrypted message content for ${message.from_id}`);
      }
    } else if (!this.isServerMessage(message) && !this.aesKey) {
      throw new Error('AES key not set. Please scan QR code first to enable encryption.');
    }

    // Send the message (structure unchanged)
    const jsonMessage = JSON.stringify(processedMessage);
    this.ws.send(jsonMessage);
  } else {
    // Queue message for later if not connected
    this.messageQueue.push(message);
  }
}
```

#### **Update Message Receiving:**
```typescript
this.ws.onmessage = async (event) => {
  try {
    const data = JSON.parse(event.data);
    
    // Handle both wrapped messages (type: 'message') and direct messages
    let protocolMessage: ProtocolMessage;
    if (data.type === 'message') {
      protocolMessage = data.message as ProtocolMessage;
    } else {
      protocolMessage = data as ProtocolMessage;
    }

    // Decrypt content if we have an AES key and message is not from server
    if (this.shouldEncryptMessage(protocolMessage)) {
      try {
        protocolMessage.content = await this.decryptContent(protocolMessage.content);
        
        if (this.debug) {
          console.log(`[WebSocket] 🔓 Decrypted message content from ${protocolMessage.from_id}`);
        }
      } catch (error) {
        console.error('Failed to decrypt message content:', error);
        this.emit('error', error);
        return;
      }
    } else if (!this.isServerMessage(protocolMessage) && !this.aesKey) {
      console.error('Received encrypted message but no AES key set. Please scan QR code first.');
      this.emit('error', new Error('No AES key set for decryption'));
      return;
    }
    
    // Emit the processed message
    this.emit('message', protocolMessage);
    
  } catch (error) {
    console.error('Failed to parse WebSocket message:', error);
    this.emit('error', error);
  }
};
```

---

## 📱 **Phase 2: QR Code Data Generation/Parsing (Protocol-Specific)**

### **2.1 Define QR Code Data Structures**

#### **Base QR Code Interface:**
```typescript
interface BaseQRCodeData {
  type: 'keygen' | 'sign' | 'rotation';
  aesKey: string;  // base64 encoded AES key
  timestamp: number;  // QR code creation timestamp
  version: string;  // QR code format version
}

interface KeygenQRCodeData extends BaseQRCodeData {
  type: 'keygen';
  groupInfo: {
    groupId: string;
    totalParties: number;
    threshold: number;
    timeout: number;  // timeout in minutes
  };
}

interface SignQRCodeData extends BaseQRCodeData {
  type: 'sign';
  groupInfo: {
    groupId: string;
    totalParties: number;
    threshold: number;
  };
  transactionInfo: {
    messageHash: string;  // hex string of message hash to sign
    txId?: string;  // optional transaction ID
    description?: string;  // optional transaction description
  };
}

interface RotationQRCodeData extends BaseQRCodeData {
  type: 'rotation';
  groupInfo: {
    groupId: string;
    totalParties: number;
    threshold: number;
    timeout: number;
  };
  rotationInfo: {
    rotationType: 'proactive' | 'reactive' | 'recovery';
    oldPublicKey?: string;  // hex string of current public key (for validation)
  };
}
```

### **2.2 Update SDK (`js/core/SDK.ts`)**

#### **Add Protocol-Specific QR Code Methods:**
```typescript
export class DeFiShArdSDK extends EventEmitter {
  private readonly SERVER_ID = '00000000000000000000000000000000000000000000000000000000000000000000';

  /**
   * Generate QR code data for keygen session
   */
  async generateKeygenQRCodeData(threshold: number, totalParties: number, timeoutMinutes: number = 60): Promise<string> {
    // Generate timestamp for this session
    const timestamp = Date.now();
    
    // Generate AES key (simple random generation)
    const aesKey = crypto.getRandomValues(new Uint8Array(32));
    const aesKeyBase64 = AESUtils.arrayBufferToBase64(aesKey.buffer);
    
    // Create group if needed
    let groupId = this.config.groupId;
    if (!groupId) {
      const groupResult = await this.createGroup(threshold, totalParties, timeoutMinutes);
      groupId = groupResult.group.groupId;
      this.config.groupId = groupId;
    }
    
    // Build QR code data for keygen
    const qrData: KeygenQRCodeData = {
      type: 'keygen',
      aesKey: aesKeyBase64,
      timestamp: timestamp,
      version: '1.0',
      groupInfo: {
        groupId: groupId,
        totalParties: totalParties,
        threshold: threshold,
        timeout: timeoutMinutes
      }
    };
    
    // Set the key in WebSocketManager
    await this.websocketManager.setAESKey(aesKeyBase64);
    
    return JSON.stringify(qrData);
  }

  /**
   * Generate QR code data for signing session
   */
  async generateSignQRCodeData(messageHash: Uint8Array, txId?: string, description?: string): Promise<string> {
    // Validate that we have a group
    if (!this.config.groupId) {
      throw new Error('No group configured. Please join or create a group first.');
    }

    // Get group info for validation
    const groupInfo = await this.apiClient.getGroupInfo(this.config.groupId);
    
    // Generate timestamp for this session
    const timestamp = Date.now();
    
    // Generate AES key (simple random generation)
    const aesKey = crypto.getRandomValues(new Uint8Array(32));
    const aesKeyBase64 = AESUtils.arrayBufferToBase64(aesKey.buffer);
    
    // Build QR code data for signing
    const qrData: SignQRCodeData = {
      type: 'sign',
      aesKey: aesKeyBase64,
      timestamp: timestamp,
      version: '1.0',
      groupInfo: {
        groupId: this.config.groupId,
        totalParties: groupInfo.totalParties,
        threshold: groupInfo.threshold
      },
      transactionInfo: {
        messageHash: AESUtils.uint8ArrayToHex(messageHash),
        txId: txId,
        description: description
      }
    };
    
    // Set the key in WebSocketManager
    await this.websocketManager.setAESKey(aesKeyBase64);
    
    return JSON.stringify(qrData);
  }

  /**
   * Generate QR code data for key rotation session
   */
  async generateRotationQRCodeData(rotationType: 'proactive' | 'reactive' | 'recovery' = 'proactive', timeoutMinutes: number = 60): Promise<string> {
    // Validate that we have a group
    if (!this.config.groupId) {
      throw new Error('No group configured. Please join or create a group first.');
    }

    // Get group info for validation
    const groupInfo = await this.apiClient.getGroupInfo(this.config.groupId);
    
    // Generate timestamp for this session
    const timestamp = Date.now();
    
    // Generate AES key (simple random generation)
    const aesKey = crypto.getRandomValues(new Uint8Array(32));
    const aesKeyBase64 = AESUtils.arrayBufferToBase64(aesKey.buffer);
    
    // Build QR code data for rotation
    const qrData: RotationQRCodeData = {
      type: 'rotation',
      aesKey: aesKeyBase64,
      timestamp: timestamp,
      version: '1.0',
      groupInfo: {
        groupId: this.config.groupId,
        totalParties: groupInfo.totalParties,
        threshold: groupInfo.threshold,
        timeout: timeoutMinutes
      },
      rotationInfo: {
        rotationType: rotationType
      }
    };
    
    // Set the key in WebSocketManager
    await this.websocketManager.setAESKey(aesKeyBase64);
    
    return JSON.stringify(qrData);
  }

  /**
   * Parse QR code data and set up session
   */
  async parseQRCodeData(qrCodeString: string): Promise<{ 
    type: string, 
    groupId: string, 
    groupInfo?: any, 
    transactionInfo?: any, 
    rotationInfo?: any 
  }> {
    const qrData = JSON.parse(qrCodeString) as BaseQRCodeData;
    
    // Validate QR data structure
    if (!qrData.type || !qrData.aesKey || !qrData.timestamp || !qrData.version) {
      throw new Error('Invalid QR code data structure');
    }
    
    // Validate timestamp (QR code not too old)
    const currentTime = Date.now();
    const qrAge = currentTime - qrData.timestamp;
    if (qrAge > 120000) { // 2 minutes max age
      throw new Error(`QR code too old. Age: ${qrAge}ms, max allowed: 120000ms`);
    }
    
    // Set the AES key in WebSocketManager
    await this.websocketManager.setAESKey(qrData.aesKey);
    
    // Handle protocol-specific validation and setup
    switch (qrData.type) {
      case 'keygen': {
        const keygenData = qrData as KeygenQRCodeData;
        
        // Validate group info
        if (!keygenData.groupInfo || !keygenData.groupInfo.groupId) {
          throw new Error('Invalid keygen QR code: missing group info');
        }
        
        // Join the group
        await this.joinGroup(keygenData.groupInfo.groupId);
        
        // Validate group parameters
        const groupInfo = await this.apiClient.getGroupInfo(keygenData.groupInfo.groupId);
        if (groupInfo.totalParties !== keygenData.groupInfo.totalParties ||
            groupInfo.threshold !== keygenData.groupInfo.threshold) {
          throw new Error(`Group parameters mismatch. Expected: ${keygenData.groupInfo.totalParties}/${keygenData.groupInfo.threshold}, Got: ${groupInfo.totalParties}/${groupInfo.threshold}`);
        }
        
        return {
          type: keygenData.type,
          groupId: keygenData.groupInfo.groupId,
          groupInfo: keygenData.groupInfo
        };
      }
      
      case 'sign': {
        const signData = qrData as SignQRCodeData;
        
        // Validate group info
        if (!signData.groupInfo || !signData.groupInfo.groupId) {
          throw new Error('Invalid sign QR code: missing group info');
        }
        
        // Join the group
        await this.joinGroup(signData.groupInfo.groupId);
        
        // Validate group parameters
        const groupInfo = await this.apiClient.getGroupInfo(signData.groupInfo.groupId);
        if (groupInfo.totalParties !== signData.groupInfo.totalParties ||
            groupInfo.threshold !== signData.groupInfo.threshold) {
          throw new Error(`Group parameters mismatch. Expected: ${signData.groupInfo.totalParties}/${signData.groupInfo.threshold}, Got: ${groupInfo.totalParties}/${groupInfo.threshold}`);
        }
        
        return {
          type: signData.type,
          groupId: signData.groupInfo.groupId,
          groupInfo: signData.groupInfo,
          transactionInfo: signData.transactionInfo
        };
      }
      
      case 'rotation': {
        const rotationData = qrData as RotationQRCodeData;
        
        // Validate group info
        if (!rotationData.groupInfo || !rotationData.groupInfo.groupId) {
          throw new Error('Invalid rotation QR code: missing group info');
        }
        
        // Join the group
        await this.joinGroup(rotationData.groupInfo.groupId);
        
        // Validate group parameters
        const groupInfo = await this.apiClient.getGroupInfo(rotationData.groupInfo.groupId);
        if (groupInfo.totalParties !== rotationData.groupInfo.totalParties ||
            groupInfo.threshold !== rotationData.groupInfo.threshold) {
          throw new Error(`Group parameters mismatch. Expected: ${rotationData.groupInfo.totalParties}/${rotationData.groupInfo.threshold}, Got: ${groupInfo.totalParties}/${groupInfo.threshold}`);
        }
        
        return {
          type: rotationData.type,
          groupId: rotationData.groupInfo.groupId,
          groupInfo: rotationData.groupInfo,
          rotationInfo: rotationData.rotationInfo
        };
      }
      
      default:
        throw new Error(`Unsupported QR code type: ${qrData.type}`);
    }
  }

  /**
   * Set AES key directly (for testing or manual setup)
   */
  async setAESKey(base64Key: string): Promise<void> {
    await this.websocketManager.setAESKey(base64Key);
  }

  /**
   * Check if message is from server
   */
  private isServerMessage(message: ProtocolMessage): boolean {
    return message.from_id === this.SERVER_ID;
  }
}
```

---

## 🔗 **Phase 3: SDK Integration**

### **3.1 Update ProtocolManager (`js/core/ProtocolManager.ts`)**

#### **Add AES Key Management:**
```typescript
export class ProtocolManager extends EventEmitter {
  private readonly SERVER_ID = '00000000000000000000000000000000000000000000000000000000000000000000';

  /**
   * Set AES key for current session
   */
  async setAESKey(base64Key: string): Promise<void> {
    await this.websocketManager.setAESKey(base64Key);
  }

  /**
   * Check if message is from server
   */
  private isServerMessage(message: ProtocolMessage): boolean {
    return message.from_id === this.SERVER_ID;
  }

  /**
   * Handle incoming WebSocket messages
   * Routes messages to the appropriate processor automatically
   */
  async handleMessage(protocolMessage: ProtocolMessage): Promise<void> {
    try {
      // Handle server messages (like 'start' messages) - these are never encrypted
      if (this.isServerMessage(protocolMessage)) {
        if (this.debug) {
          console.log(`[ProtocolManager] 🔍 Received server message: ${protocolMessage.content}`);
        }
        
        // Route server messages to the appropriate processor
        if (this.keygenProcessor && !this.keygenProcessor.isKeygenComplete()) {
          const responses = await this.keygenProcessor.processMessage(protocolMessage);
          for (const response of responses) {
            await this.websocketManager.sendMessage(response);
          }
        } else if (this.signProcessor && this.signProcessor.isActive()) {
          const responses = await this.signProcessor.processMessage(protocolMessage);
          // Responses are sent via round-complete event handler
        }
        return;
      }

      // Ignore old END messages (round 5) from previous sessions when currentRound = -1
      if (protocolMessage.round === 5 && this.keygenProcessor && this.keygenProcessor.getCurrentRound() === -1) {
        return;
      }

      // Reconnect if not connected (for round-based connection management)
      if (!this.websocketManager.isConnected()) {
        if (this.config.groupId && this.config.apiKey) {
          // Determine protocol based on active processor
          const protocol = this.keygenProcessor ? 'keygen' : 'sign';
          await this.websocketManager.connect(
            this.config.groupId,
            protocol,
            this.config.apiKey
          );
        }
      }

      // Route message to the appropriate processor
      // Keygen processor handles rounds 0-4 and END messages (round 5)
      // Sign processor handles rounds 0-4 for signing
      if (this.keygenProcessor && !this.keygenProcessor.isKeygenComplete()) {
        // Process message through keygen processor
        const responses = await this.keygenProcessor.processMessage(protocolMessage);
        
        // Send any response messages automatically
        for (const response of responses) {
          await this.websocketManager.sendMessage(response);
        }
      } else if (this.signProcessor && this.signProcessor.isActive()) {
        // Route signing messages (rounds 0-5) to sign processor
        if (protocolMessage.round <= 5) {
          // Process message through sign processor
          const responses = await this.signProcessor.processMessage(protocolMessage);
          // Messages are sent via the round-complete event handler, not here
        }
      } else {
        // No active processor to handle message
      }
    } catch (error) {
      this.emit('error', new Error(`Failed to handle message: ${error}`));
      throw error;
    }
  }
}
```

---

## 🧪 **Phase 4: Testing & Documentation**

### **4.1 Update Existing Tests**

#### **Update `tests/e2e/threshold-signing-test.ts`:**
```typescript
async function testThresholdSigning() {
  // ... existing setup ...

  // Party A generates keygen QR code data
  console.log('\n📱 Step 4: Party A generating keygen QR code data...');
  const qrDataString = await parties[0].generateKeygenQRCodeData(2, 3, 60);
  console.log(`[Party A] ✅ Generated keygen QR code data: ${qrDataString.substring(0, 50)}...`);

  // Party B parses QR code data
  console.log('\n📱 Step 5: Party B parsing QR code data...');
  const sessionInfo = await parties[1].parseQRCodeData(qrDataString);
  console.log(`[Party B] ✅ Parsed QR code data: ${sessionInfo.type} for group ${sessionInfo.groupId}`);

  // ... rest of test ...
}
```

### **4.2 Create New Encryption Tests**

#### **Create `tests/e2e/encryption-test.ts`:**
```typescript
import { DeFiShArdSDK, LocalStorageAdapter } from '../../js/index';

async function testEncryption() {
  console.log('🔐 Testing WebSocket Content Encryption...');

  const config = {
    relayerUrl: 'http://localhost:8080',
    websocketUrl: 'ws://localhost:8080',
    storage: new LocalStorageAdapter('test-encryption'),
    debug: true
  };

  const partyA = new DeFiShArdSDK(config);
  const partyB = new DeFiShArdSDK(config);

  try {
    // Initialize and register parties
    await partyA.initialize();
    await partyB.initialize();
    await partyA.register();
    await partyB.register();

    // Test QR code generation and parsing
    const qrDataString = await partyA.generateKeygenQRCodeData(2, 3, 60);
    const sessionInfo = await partyB.parseQRCodeData(qrDataString);

    console.log('✅ QR code generation/parsing successful');
    console.log('✅ Session info:', sessionInfo);

    // Test WebSocket encryption
    await partyA.startKeygen();
    await partyB.startKeygen();

    console.log('✅ WebSocket encryption test completed');

  } catch (error) {
    console.error('❌ Encryption test failed:', error);
    throw error;
  } finally {
    await partyA.disconnect();
    await partyB.disconnect();
  }
}

// Run test
testEncryption().catch(console.error);
```

---

## 📋 **Implementation Checklist**

### **Phase 1: Content-Level Encryption Layer**
- [ ] Update `WebSocketManager` with AES key management
- [ ] Add `isServerMessage()` method to identify server messages
- [ ] Add `shouldEncryptMessage()` method
- [ ] Add `encryptContent()` method
- [ ] Add `decryptContent()` method
- [ ] Update `sendMessage()` to encrypt content (fail if no key)
- [ ] Update `handleIncomingMessage()` to decrypt content (fail if no key)
- [ ] Maintain exact ProtocolMessage structure

### **Phase 2: QR Code Data Generation/Parsing**
- [ ] Define protocol-specific QR code interfaces
- [ ] Add `generateKeygenQRCodeData()` to SDK
- [ ] Add `generateSignQRCodeData()` to SDK
- [ ] Add `generateRotationQRCodeData()` to SDK
- [ ] Add `parseQRCodeData()` to SDK with protocol-specific validation
- [ ] Add `setAESKey()` to SDK
- [ ] Add timestamp validation (2-minute timeout)
- [ ] Handle group creation and validation for keygen
- [ ] Handle group validation for sign and rotation

### **Phase 3: SDK Integration**
- [ ] Update `ProtocolManager` with AES key methods
- [ ] Add server message handling in `ProtocolManager`
- [ ] No changes to registration flow

### **Phase 4: Testing & Documentation**
- [ ] Update existing tests to include QR code setup
- [ ] Create new encryption-specific tests
- [ ] Test server message handling
- [ ] Test timeout scenarios
- [ ] Test group validation for each protocol
- [ ] Update README with encryption usage examples

---

## 🔒 **Security Considerations**

### **Encryption Strength:**
- **AES-256-GCM**: Symmetric encryption for message content
- **Content-Level**: Only encrypts the `content` field, not the entire message

### **Key Management:**
- **AES Key**: Generated per session, shared via QR code
- **In-Memory Storage**: Keys stored in memory only for security

### **Backend Compatibility:**
- **Message Structure**: Exact ProtocolMessage structure maintained
- **Content Field**: Only the `content` field is encrypted
- **Server Messages**: Server messages (from_id = all zeros) are never encrypted/decrypted
- **No Breaking Changes**: Backend doesn't need to change

### **Protocol-Specific Validation:**
- **Keygen**: Validates group parameters (n, t, timeout)
- **Sign**: Validates group parameters and transaction info
- **Rotation**: Validates group parameters and rotation type

---

## 🚀 **Usage Examples**

### **Keygen Usage:**
```typescript
// Party A (Initiator)
const sdkA = new DeFiShArdSDK(config);
await sdkA.initialize();
await sdkA.register();

// Generate keygen QR code data (automatically creates group if needed)
const qrDataString = await sdkA.generateKeygenQRCodeData(2, 3, 60);
// Display QR code to user
await app.showQRCode(qrDataString);

// Start keygen (waits for Party B)
await sdkA.startKeygen();

// Party B (Participant)
const sdkB = new DeFiShArdSDK(config);
await sdkB.initialize();
await sdkB.register();

// Scan QR code - this handles group join AND encryption setup
const qrDataString = await app.scanQRCode();
const sessionInfo = await sdkB.parseQRCodeData(qrDataString);

// Automatically join group and start keygen
await sdkB.startKeygen();
```

### **Sign Usage:**
```typescript
// Party A generates sign QR code with message hash
const messageHash = new Uint8Array(32);
crypto.getRandomValues(messageHash);
const qrDataString = await sdkA.generateSignQRCodeData(messageHash, 'tx123', 'Transfer 100 ETH');
await app.showQRCode(qrDataString);

// Party B scans and parses
const qrDataString = await app.scanQRCode();
const sessionInfo = await sdkB.parseQRCodeData(qrDataString);

// Both parties start signing
await sdkA.startSigning(messageHash);
await sdkB.startSigning(messageHash);
```

### **Rotation Usage:**
```typescript
// Party A generates rotation QR code
const qrDataString = await sdkA.generateRotationQRCodeData('proactive', 60);
await app.showQRCode(qrDataString);

// Party B scans and parses
const qrDataString = await app.scanQRCode();
const sessionInfo = await sdkB.parseQRCodeData(qrDataString);

// Both parties start rotation
await sdkA.startKeyRotation(oldKeyshare, true);
await sdkB.startKeyRotation(oldKeyshare, true);
```

---

## ✅ **Benefits of This Approach**

1. **✅ Backend Compatible**: No changes needed on server side
2. **✅ Secure**: All message content is encrypted (except server messages)
3. **✅ Simple**: Mandatory encryption with clear error handling
4. **✅ Protocol-Specific**: Different QR codes for different use cases
5. **✅ User-Friendly**: QR code-based key exchange with clear validation
6. **✅ Server Message Support**: Proper handling of server start messages
7. **✅ Future-Proof**: Can add optional encryption later if needed
8. **✅ Clean Implementation**: Minimal changes to existing code
9. **✅ Comprehensive Validation**: Group parameters validated for each protocol

This approach ensures full backend compatibility while providing strong encryption for all message content, with protocol-specific QR codes that handle the unique requirements of keygen, sign, and rotation operations. 
