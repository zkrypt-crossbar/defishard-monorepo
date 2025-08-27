// Unified Party Script - Run keygen, sign, rotation, or clear storage
import { DeFiShArdSDK, LocalStorageAdapter } from '../../js/index.ts';
import { generateKeygenQRCode, generateRotationQRCode, parseQRCode } from '../../js/utils/qrcode.ts';

// @ts-ignore - Deno global is available at runtime
declare const Deno: any;

const RELAY_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';

// Parse command line arguments
const args = Deno.args;
const command = args[0];

if (!command) {
  console.log('🚀 DeFiShArd Multi-Terminal Test Runner\n');
  console.log('Usage: deno run --allow-net --allow-read --allow-write --unstable-sloppy-imports tests/e2e/party.ts <command> [role] [params]\n');
  console.log('Commands:');
  console.log('  keygen [creator|joiner]     - Run Distributed Key Generation');
  console.log('  sign [creator|joiner] <idx> - Run threshold signing (requires existing keyshares)');
  console.log('  rotation [leader|joiner] <idx> - Run key rotation (requires existing keyshares)');
  console.log('  clear                       - Clear all stored keyshares and data');
  console.log('  setup [threshold] [parties] - Generate encryption key for testing (default: 2 2)');
  console.log('\nExamples:');
  console.log('  deno run ... party.ts setup');
  console.log('  deno run ... party.ts setup 3 5');
  console.log('  deno run ... party.ts keygen creator');
  console.log('  deno run ... party.ts keygen joiner');
  console.log('  deno run ... party.ts sign creator 0');
  console.log('  deno run ... party.ts sign joiner 1');
  console.log('  deno run ... party.ts rotation leader 0');
  console.log('  deno run ... party.ts clear');
  Deno.exit(1);
}

const role = args[1] || 'joiner';
const index = args[2] ? parseInt(args[2]) : undefined;
const setupThreshold = args[1] ? parseInt(args[1]) : 2;
const setupParties = args[2] ? parseInt(args[2]) : 2;

switch (command.toLowerCase()) {
  case 'setup':
    await runSetup();
    break;
  case 'keygen':
    await runKeygen(role);
    break;
  case 'sign':
    if (index === undefined) {
      console.error('❌ Index parameter required for sign command');
      console.log('Usage: party.ts sign [creator|joiner] <index>');
      console.log('Example: party.ts sign creator 0');
      Deno.exit(1);
    }
    await runSigning(role, index!);
    break;
  case 'rotation':
    if (index === undefined) {
      console.error('❌ Index parameter required for rotation command');
      console.log('Usage: party.ts rotation [leader|joiner] <index>');
      console.log('Example: party.ts rotation leader 0');
      Deno.exit(1);
    }
    await runRotation(role, index!);
    break;
  case 'clear':
    await clearStorage();
    break;
  default:
    console.error(`❌ Unknown command: ${command}`);
    console.log('Use: setup, keygen, sign, rotation, or clear');
    Deno.exit(1);
}

// ============================================================================
// SETUP COMMAND
// ============================================================================
async function runSetup() {
  console.log('🚀 Setting up encryption key for multi-terminal test...\n');

  try {
    // Clean up any previous data first
    console.log('🧹 Cleaning up previous test data...');
    await cleanupStorage();
    
    console.log('📋 Generating QR code with encryption key...');
    const threshold = setupThreshold;
    const groupSize = setupParties;
    console.log(`📋 Configuration: ${threshold}-of-${groupSize} threshold scheme`);
    
    const tempGroupId = 'temp-group-id';
    const qrCodeResult = generateKeygenQRCode(
      tempGroupId,
      threshold,
      groupSize,
      60
    );
    
    console.log('✅ Generated QR code with embedded AES key');
    console.log(`\n🔐 ENCRYPTION KEY (base64): ${qrCodeResult.aesKey}`);

    const setupData = {
      groupId: tempGroupId,
      threshold,
      groupSize,
      aesKey: qrCodeResult.aesKey,
      qrData: qrCodeResult.qrData
    };

    await Deno.writeTextFile('tests/e2e/setup-data.json', JSON.stringify(setupData, null, 2));
    console.log('\n💾 Setup data saved to setup-data.json');
    console.log('\n✅ Setup complete! Now run: party.ts keygen creator');
    
  } catch (error: any) {
    console.error('❌ Setup failed:', error);
  }
}

// ============================================================================
// KEYGEN COMMAND
// ============================================================================
async function runKeygen(role: string) {
  const isCreator = role.toLowerCase() === 'creator';
  const partyName = isCreator ? 'creator' : `joiner-${Math.floor(Math.random() * 1000)}`;
  
  console.log(`🚀 Starting DKG as ${partyName}...\n`);

  try {
    // Read setup data
    const setupData = await readSetupData();
    
    // Create SDK instance
    const { sdk, setupData: updatedSetupData } = await initializeSDK(partyName, setupData);
    
    if (isCreator) {
      // Creator creates group
      console.log('\n📋 Creating group...');
      const group = await sdk.createGroup(setupData.threshold, setupData.groupSize, 60);
      console.log(`✅ Created group: ${group.group.groupId}`);

      // Update setup data with real group ID
      updatedSetupData.groupId = group.group.groupId;
      const qrData = JSON.parse(updatedSetupData.qrData);
      qrData.groupId = group.group.groupId;
      qrData.timestamp = Date.now();
      updatedSetupData.qrData = JSON.stringify(qrData);
      
      await Deno.writeTextFile('tests/e2e/setup-data.json', JSON.stringify(updatedSetupData, null, 2));
      console.log('✅ Updated setup data with real group ID');
      
      // Wait for others to join
      await waitForParties(sdk, group.group.groupId, setupData.groupSize, 'Creator');
    } else {
      // Joiner joins group
      const parsedQR = parseQRCode(updatedSetupData.qrData);
      console.log('\n📋 Joining group...');
      await sdk.joinGroup(parsedQR.groupId);
      console.log(`✅ ${partyName} joined group`);
      
      // Wait for group to fill
      await waitForParties(sdk, parsedQR.groupId, setupData.groupSize, partyName);
    }

    // Set up keygen event listener
    sdk.on('keygen-complete', async (keyShare: any) => {
      console.log(`\n🎉 ${partyName}: DKG completed with encryption!`);
      console.log(`🔑 Public Key: ${Array.from(keyShare.publicKey as Uint8Array).map(b => b.toString(16).padStart(2, '0')).join('')}`);
      console.log(`📋 Party ID: ${keyShare.partyId}, Participants: ${keyShare.participants}, Threshold: ${keyShare.threshold}`);
      
      console.log(`\n✅ ${partyName}: Keyshare saved to storage`);
      console.log(`💡 Next: Run 'party.ts sign ${role}' for threshold signing`);
      // Small pause before the next phase if the test chains steps manually
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    sdk.on('error', (error: any) => {
      console.error(`❌ ${partyName} error:`, error);
    });

    // Start DKG
    console.log(`\n📋 Starting DKG as ${partyName}...`);
    await sdk.startKeygen(isCreator);
    console.log(`✅ ${partyName}: DKG started`);

  } catch (error: any) {
    console.error(`❌ ${partyName} failed:`, error);
  }
}

// ============================================================================
// SIGNING COMMAND
// ============================================================================
async function runSigning(role: string, index: number) {
  const isCreator = role.toLowerCase() === 'creator';
  const partyName = isCreator ? 'signer-creator' : `signer-joiner-${Math.floor(Math.random() * 1000)}`;
  
  console.log(`🚀 Starting threshold signing as ${partyName}...\n`);

  try {
    // Check for existing keyshares
    const storage = new LocalStorageAdapter('defishard_');
    const allKeys = await storage.getKeys();
    const keyshareKeys = allKeys.filter((key: string) => key.includes('keyshare_'));
    
    if (keyshareKeys.length === 0) {
      console.error('❌ No keyshares found. Run DKG first: party.ts keygen creator');
      Deno.exit(1);
    }
    
    console.log(`✅ Found ${keyshareKeys.length} keyshare(s) in storage`);
    
    // Find keyshare for this specific party
    let keyshareData = null;
    let matchingKey = null;
    
    // Show available keyshares for debugging
    console.log('📋 Available keyshares:');
    for (const key of keyshareKeys) {
      console.log(`   - ${key}`);
    }
    
    // Simple selection: find keyshare with the specified index
    matchingKey = keyshareKeys.find((key: string) => key.endsWith(`_${index}`)) || null;
    
    if (!matchingKey) {
      console.error(`❌ No keyshare found with index ${index}`);
      console.log('Available indices:', keyshareKeys.map((key: string) => key.split('_').pop()).join(', '));
      Deno.exit(1);
    }
    
    console.log(`📋 Using keyshare with index ${index}: ${matchingKey}`);
    
    if (matchingKey) {
      keyshareData = await storage.get(matchingKey);
    }
    
    if (!keyshareData) {
      console.error('❌ Could not load keyshare data');
      Deno.exit(1);
    }
    
    const keyshare = JSON.parse(keyshareData!);
    console.log(`📋 Using keyshare: ${matchingKey} -> Group ${keyshare.groupId}, Party ID ${keyshare.partyId}`);

    // Use stored API key with original group ID (same as rotation)
    const setupData = await readSetupData();
    const signingStorage = new LocalStorageAdapter('defishard_');
    const sdk = new DeFiShArdSDK({
      relayerUrl: RELAY_URL,
      websocketUrl: WS_URL,
      debug: true,
      storage: signingStorage
    });

    console.log(`📋 Initializing ${partyName}...`);
    await sdk.initialize();
    
    // Use stored API key and group ID from keyshare (same as rotation)
    console.log(`📋 Using stored API key: ${keyshare.apiKey?.substring(0, 20)}...`);
    console.log(`📋 Using original group: ${keyshare.groupId}`);
    
    // Update SDK config properly (propagates to ApiClient and ProtocolManager)
    (sdk as any).config.apiKey = keyshare.apiKey;
    (sdk as any).config.groupId = keyshare.groupId;
    (sdk as any).config.partyId = keyshare.partyId;
    
    // Update API client and protocol manager with new config
    (sdk as any).apiClient.updateConfig((sdk as any).config);
    (sdk as any).protocolManager.updateConfig((sdk as any).config);

    // Set encryption key
    const aesKeyBytes = Uint8Array.from(atob(setupData.aesKey), c => c.charCodeAt(0));
    await sdk.setEncryptionKey(aesKeyBytes);
    console.log('✅ Encryption key set');
    
    // Set up signing event listener
    sdk.on('sign-complete', async (signature: any) => {
      console.log(`\n🎉 ${partyName}: Threshold signing completed!`);
      console.log(`✍️ Signature R: ${Array.from(signature[0] as Uint8Array).map(b => b.toString(16).padStart(2, '0')).join('')}`);
      console.log(`✍️ Signature S: ${Array.from(signature[1] as Uint8Array).map(b => b.toString(16).padStart(2, '0')).join('')}`);
      console.log(`\n✅ ${partyName}: Signing complete!`);
      // Small pause before rotation when tests chain phases
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    sdk.on('error', (error: any) => {
      console.error(`❌ ${partyName} signing error:`, error);
    });

    // Start signing with explicit keyshare (real app approach)
    console.log(`\n📋 Starting threshold signing as ${partyName}...`);
    const messageHash = new Uint8Array(32);
    for (let i = 0; i < 32; i++) messageHash[i] = i; // Deterministic message
    
    console.log(`📝 Message hash: ${Array.from(messageHash).map(b => b.toString(16).padStart(2, '0')).join('')}`);
    await sdk.startSigning(messageHash, keyshare);
    console.log(`✅ ${partyName}: Signing started`);

  } catch (error: any) {
    console.error(`❌ ${partyName} signing failed:`, error);
  }
}

// ============================================================================
// ROTATION COMMAND
// ============================================================================
async function runRotation(role: string, index: number) {
  const isLeader = role.toLowerCase() === 'leader';
  const partyName = isLeader ? 'rotation-leader' : `rotation-joiner-${Math.floor(Math.random() * 1000)}`;
  
  console.log(`🚀 Starting key rotation as ${partyName}...\n`);

  try {
    // Check for existing keyshares
    const storage = new LocalStorageAdapter('defishard_');
    const allKeys = await storage.getKeys();
    const keyshareKeys = allKeys.filter((key: string) => key.includes('keyshare_'));
    
    if (keyshareKeys.length === 0) {
      console.error('❌ No keyshares found. Run DKG first: party.ts keygen creator');
      Deno.exit(1);
    }
    
    console.log(`✅ Found ${keyshareKeys.length} keyshare(s) in storage`);
    
    // Find keyshare for this specific party
    let keyshareData = null;
    let matchingKey = null;
    
    // Show available keyshares for debugging
    console.log('📋 Available keyshares:');
    for (const key of keyshareKeys) {
      console.log(`   - ${key}`);
    }
    
    // Simple selection: find keyshare with the specified index
    matchingKey = keyshareKeys.find((key: string) => key.endsWith(`_${index}`)) || null;
    
    if (!matchingKey) {
      console.error(`❌ No keyshare found with index ${index}`);
      console.log('Available indices:', keyshareKeys.map((key: string) => key.split('_').pop()).join(', '));
      Deno.exit(1);
    }
    
    console.log(`📋 Using keyshare with index ${index}: ${matchingKey}`);
    
    if (matchingKey) {
      keyshareData = await storage.get(matchingKey);
    }
    
    if (!keyshareData) {
      console.error('❌ Could not load keyshare data');
      Deno.exit(1);
    }
    
    const originalKeyshare = JSON.parse(keyshareData);
    console.log(`📋 Will rotate keyshare: ${matchingKey} -> Group ${originalKeyshare.groupId}, Party ID ${originalKeyshare.partyId}`);

    // Convert JSON keyshare to WASM Keyshare instance
    const wasmModule = await import('../../pkg/dkls_wasm_ll.js');
    await wasmModule.default(); // Initialize WASM module
    const wasmKeyshare = wasmModule.Keyshare.fromBytes(new Uint8Array(originalKeyshare.serialized));
    console.log(`📋 Converted JSON keyshare to WASM Keyshare instance`);

    // Use stored API key with original group ID (no need to register)
    const setupData = await readSetupData();
    const rotationStorage = new LocalStorageAdapter('defishard_');
    const sdk = new DeFiShArdSDK({
      relayerUrl: RELAY_URL,
      websocketUrl: WS_URL,
      debug: true,
      storage: rotationStorage
    });

    console.log(`📋 Initializing ${partyName}...`);
    await sdk.initialize();
    
    // Use stored API key and group ID from keyshare
    console.log(`📋 Using stored API key: ${originalKeyshare.apiKey?.substring(0, 20)}...`);
    console.log(`📋 Using original group: ${originalKeyshare.groupId}`);
    
    // Update SDK config properly (propagates to ApiClient and ProtocolManager)
    (sdk as any).config.apiKey = originalKeyshare.apiKey;
    (sdk as any).config.groupId = originalKeyshare.groupId;
    (sdk as any).config.partyId = originalKeyshare.partyId;
    
    // Update API client and protocol manager with new config
    (sdk as any).apiClient.updateConfig((sdk as any).config);
    (sdk as any).protocolManager.updateConfig((sdk as any).config);

    // Set encryption key
    const aesKeyBytes = Uint8Array.from(atob(setupData.aesKey), c => c.charCodeAt(0));
    await sdk.setEncryptionKey(aesKeyBytes);
    console.log('✅ Encryption key set');

    // Set up rotation event listener
    sdk.on('keygen-complete', async (newKeyShare: any) => {
      console.log(`\n🎉 ${partyName}: Key rotation completed!`);
      console.log(`✅ ${partyName}: New keyshare saved.`);
      // Small pause at the end of rotation
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    sdk.on('error', (error: any) => {
      console.error(`❌ ${partyName} rotation error:`, error);
    });

    // Start rotation in original group with stored API key
    console.log(`\n📋 Starting key rotation as ${partyName}...`);
    await sdk.startKeyRotation(wasmKeyshare);
    console.log(`✅ ${partyName}: Rotation started`);

  } catch (error: any) {
    console.error(`❌ ${partyName} rotation failed:`, error);
  }
}

// ============================================================================
// CLEAR STORAGE COMMAND
// ============================================================================
async function clearStorage() {
  console.log('🧹 Clearing all stored data...\n');
  
  try {
    await cleanupStorage();
    console.log('\n🎯 Storage cleared! Ready for fresh testing.');
    console.log('💡 Run: party.ts setup (to begin fresh)');
  } catch (error: any) {
    console.error('❌ Failed to clear storage:', error);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
async function readSetupData() {
  try {
    const setupText = await Deno.readTextFile('tests/e2e/setup-data.json');
    return JSON.parse(setupText);
  } catch (error) {
    console.error('❌ Could not read setup-data.json. Run: party.ts setup');
    Deno.exit(1);
  }
}

async function initializeSDK(partyName: string, setupData: any, shouldJoinGroup = true) {
  const storage = new LocalStorageAdapter('defishard_');
  const sdk = new DeFiShArdSDK({
    relayerUrl: RELAY_URL,
    websocketUrl: WS_URL,
    debug: true,
    storage: storage
  });

  console.log(`📋 Initializing ${partyName}...`);
  await sdk.initialize();
  const result = await sdk.register();
  console.log(`✅ ${partyName} registered: ${result.partyId}`);

  // Set encryption key
  const aesKeyBytes = Uint8Array.from(atob(setupData.aesKey), c => c.charCodeAt(0));
  await sdk.setEncryptionKey(aesKeyBytes);
  console.log('✅ Encryption key set');

  return { sdk, setupData };
}

async function waitForParties(sdk: DeFiShArdSDK, groupId: string, expectedCount: number, partyName: string): Promise<void> {
  console.log(`\n⏳ ${partyName}: Waiting for ${expectedCount} parties...`);
  
  while (true) {
    try {
      const groupInfo = await (sdk as any).apiClient.getGroupInfo(groupId);
      const memberCount = groupInfo.members ? groupInfo.members.length : 0;
      
      console.log(`📊 ${partyName}: ${memberCount}/${expectedCount} parties joined`);
      
      if (memberCount >= expectedCount) {
        console.log(`✅ ${partyName}: All parties ready!`);
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.log(`⚠️ ${partyName}: Checking group status...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

/**
 * Simple localStorage cleanup function
 */
async function cleanupStorage(): Promise<void> {
  // Show localStorage info before clearing
  if (typeof localStorage !== 'undefined') {
    const keys = Object.keys(localStorage);
    const defishardKeys = keys.filter(key => key.startsWith('defishard_'));
    
    // Calculate storage usage
    let totalSize = 0;
    let defishardSize = 0;
    
    keys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        const size = new Blob([value]).size;
        totalSize += size;
        if (key.startsWith('defishard_')) {
          defishardSize += size;
        }
      }
    });
    
    console.log(`📊 localStorage Status:`);
    console.log(`   Total items: ${keys.length}`);
    console.log(`   DeFiShArd items: ${defishardKeys.length}`);
    console.log(`   Total size: ${formatBytes(totalSize)}`);
    console.log(`   DeFiShArd size: ${formatBytes(defishardSize)}`);
    
    // Clear localStorage completely
    let cleared = 0;
    
    keys.forEach(key => {
      if (key.startsWith('defishard_')) {
        localStorage.removeItem(key);
        cleared++;
      }
    });
    
    if (cleared > 0) {
      console.log(`✅ Cleared ${cleared} items from localStorage`);
    } else {
      console.log(`📋 No localStorage items to clear`);
    }
  }

  // Clear setup files
  const filesToClear = [
    'tests/e2e/setup-data.json',
    'tests/e2e/signing-data.json', 
    'tests/e2e/rotation-data.json',
    'tests/e2e/test-data.json',
    'tests/e2e/keyshare-data.json',
    'tests/e2e/group-data.json'
  ];

  for (const file of filesToClear) {
    try {
      await Deno.remove(file);
      console.log(`✅ Removed ${file}`);
    } catch {
      // File doesn't exist, ignore
    }
  }

  // Clear backup files
  const backupPatterns = [
    'tests/e2e/*.bak',
    'tests/e2e/*~',
    'tests/e2e/*.tmp',
    'tests/e2e/*.backup'
  ];

  for (const pattern of backupPatterns) {
    try {
      for await (const entry of Deno.readDir('tests/e2e')) {
        if (entry.isFile) {
          const filename = entry.name;
          if (filename.endsWith('.bak') || filename.endsWith('~') || 
              filename.endsWith('.tmp') || filename.endsWith('.backup')) {
            const filePath = `tests/e2e/${filename}`;
            await Deno.remove(filePath);
            console.log(`✅ Removed backup file: ${filePath}`);
          }
        }
      }
    } catch {
      // Directory doesn't exist or no backup files, ignore
    }
  }

  console.log('✅ Storage cleanup complete');
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Handle Ctrl+C gracefully
Deno.addSignalListener('SIGINT', () => {
  console.log('\n👋 Party shutting down...');
  Deno.exit(0);
});
