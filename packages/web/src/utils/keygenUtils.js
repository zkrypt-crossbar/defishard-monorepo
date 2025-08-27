import sdkService from '../services/sdk-service';



export const searchAllLocalStorageForKeyshares = () => {
  const keyshareKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes('keyshare')) {
      keyshareKeys.push(key);
    }
  }
  return keyshareKeys;
};

export const generateQRCodeData = async (groupInfoParam, partyId, addLog) => {
  if (!groupInfoParam) return null;
  
  try {
    addLog('📱 Generating QR code data...');
    
    const aesKey = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    
    const qrData = {
      type: 'keygen',
      groupId: groupInfoParam.group.groupId,
      threshold: groupInfoParam.group.threshold,
      totalParties: groupInfoParam.group.totalParties,
      timeout: 60,
      timestamp: Date.now(),
      version: '1.0',
      aesKey: aesKey,
      metadata: {
        threshold: groupInfoParam.group.threshold,
        totalParties: groupInfoParam.group.totalParties,
        timeout: 60,
        sessionName: `Keygen Session ${new Date().toLocaleString()}`,
        creator: partyId
      }
    };
    
    const qrCodeString = JSON.stringify(qrData);
    addLog('✅ QR code data generated successfully');
    addLog(`📱 QR code size: ${qrCodeString.length} characters`);
    
    return qrCodeString;
  } catch (error) {
    addLog(`❌ QR code generation failed: ${error.message}`);
    return null;
  }
};

export const parseQRCodeData = async (qrCodeString, addLog) => {
  try {
    const parsed = JSON.parse(qrCodeString);
    
    if (!parsed.groupId || !parsed.threshold || !parsed.totalParties) {
      throw new Error('Invalid QR code format - missing required fields');
    }
    
    addLog(`📱 QR Code parsed successfully: ${parsed.type} session`);
    addLog(`📱 Group ID: ${parsed.groupId}`);
    addLog(`📱 Threshold: ${parsed.threshold}`);
    addLog(`📱 Total Parties: ${parsed.totalParties}`);
    
    return {
      type: parsed.type,
      groupId: parsed.groupId,
      threshold: parsed.threshold,
      totalParties: parsed.totalParties,
      aesKey: parsed.aesKey,
      metadata: parsed.metadata,
      isValid: true,
      age: Date.now() - parsed.timestamp
    };
  } catch (error) {
    addLog(`❌ QR Code parsing failed: ${error.message}`);
    throw error;
  }
};

export const waitForAllParties = async (groupId, expectedCount, addLog) => {
  addLog(`⏳ Waiting for ${expectedCount} parties to join group ${groupId}...`);
  
  if (!groupId || groupId.trim() === '') {
    addLog('❌ Error: Group ID is empty or undefined');
    throw new Error('Group ID is required but was empty or undefined');
  }
  
  let retryCount = 0;
  const maxRetries = 120; // 60 seconds max (120 * 500ms) - matches overall flow timeout
  const baseDelay = 200; // Reduced from 500ms to 200ms for faster detection
  
  while (retryCount < maxRetries) {
    try {
      if (!sdkService.sdk || !sdkService.sdk.apiClient) {
        addLog('❌ SDK or API client not available');
        break;
      }
      
      try {
        const groupInfo = await sdkService.sdk.apiClient.getGroupInfo(groupId);
        const memberCount = groupInfo.members ? groupInfo.members.length : 0;
        
        addLog(`📊 ${memberCount}/${expectedCount} parties joined`);
        
        if (memberCount >= expectedCount) {
          addLog('✅ All parties ready!');
          return true; // Return immediately when condition is met
        }
      } catch (sdkError) {
        addLog(`⚠️ SDK API failed, trying direct API call: ${sdkError.message}`);
        
        const apiKey = sdkService.getApiKey();
        if (!apiKey) {
          addLog('❌ No API key available for group info request');
          break;
        }
        
        const response = await fetch(`${sdkService.relayerUrl}/group/info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({ group_id: groupId })
        });

        if (response.ok) {
          const groupInfo = await response.json();
          const memberCount = groupInfo.members ? groupInfo.members.length : 0;
          
          addLog(`📊 ${memberCount}/${expectedCount} parties joined`);
          
          if (memberCount >= expectedCount) {
            addLog('✅ All parties ready!');
            return true; // Return immediately when condition is met
          }
        } else {
          const errorText = await response.text();
          addLog(`❌ Group info request failed: ${response.status} - ${errorText}`);
        }
      }
      
      // Exponential backoff: start with 200ms, increase by 5% each retry
      const delay = Math.min(baseDelay * Math.pow(1.05, retryCount), 500);
      await new Promise(resolve => setTimeout(resolve, delay));
      retryCount++;
    } catch (error) {
      addLog(`⚠️ Checking group status... (${error.message})`);
      const delay = Math.min(baseDelay * Math.pow(1.05, retryCount), 500);
      await new Promise(resolve => setTimeout(resolve, delay));
      retryCount++;
    }
  }
  
  // If we reach here, we've exceeded max retries
  addLog(`❌ Timeout: Waited ${maxRetries * baseDelay / 1000} seconds for parties to join`);
  throw new Error(`Flow timeout: Waited ${maxRetries * baseDelay / 1000} seconds for parties to join group ${groupId}`);
};



/**
 * Wait for parties to be ready using optimized polling
 * @param {string} groupId - Group ID
 * @param {number} expectedCount - Expected number of parties
 * @param {Function} addLog - Logging function
 * @returns {Promise} - Resolves when all parties are ready
 */
export const waitForPartiesReady = async (groupId, expectedCount, addLog) => {
  addLog(`⏳ Waiting for ${expectedCount} parties to be ready in group ${groupId}...`);
  
  // Use fast polling directly (no event-based waiting since SDK doesn't emit parties-ready)
  return await waitForAllParties(groupId, expectedCount, addLog);
};
