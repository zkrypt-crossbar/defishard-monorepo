import { useEffect, useRef, useCallback } from 'react';
import sdkService from '../services/sdk-service';

export const useSDKEvents = (addLog, setKeygenStatus, setSignStatus, setKeyshare, setSignature) => {
  // Use refs to store the latest function references
  const addLogRef = useRef(addLog);
  const setKeygenStatusRef = useRef(setKeygenStatus);
  const setSignStatusRef = useRef(setSignStatus);
  const setKeyshareRef = useRef(setKeyshare);
  const setSignatureRef = useRef(setSignature);

  // Update refs when props change
  addLogRef.current = addLog;
  setKeygenStatusRef.current = setKeygenStatus;
  setSignStatusRef.current = setSignStatus;
  setKeyshareRef.current = setKeyshare;
  setSignatureRef.current = setSignature;

  // Create stable event handlers using useCallback
  const handleKeygenStart = useCallback(() => {
    addLogRef.current('🎯 Keygen started');
    addLogRef.current(`🎯 Event received by party: ${sdkService.partyId}`);
    setKeygenStatusRef.current('in-progress');
  }, []);

  const handleKeygenRound = useCallback((data) => {
    addLogRef.current(`🔄 Keygen round ${data.index}/${data.total}`);
    addLogRef.current(`🎯 Round event received by party: ${sdkService.partyId}`);
  }, []);

  const handleKeygenComplete = useCallback(async (data) => {
    addLogRef.current('🎉 Keygen completed successfully!');
    addLogRef.current(`🔑 Public Key: ${data.publicKey || 'Generated'}`);
    addLogRef.current(`📋 Party ID: ${data.partyId}`);
    addLogRef.current(`👥 Participants: ${data.participants || 'All parties'}`);
    addLogRef.current(`🎯 Threshold: ${data.threshold}`);
    addLogRef.current('💾 Keyshare saved to storage automatically');
    addLogRef.current(`🎯 Event received by: ${data.partyId === sdkService.partyId ? 'Current party' : 'Other party'}`);
    
    setKeygenStatusRef.current('completed');
    setKeyshareRef.current(data);
  }, []);

  const handleSignStart = useCallback(() => {
    addLogRef.current('✍️ Signing started');
    setSignStatusRef.current('in-progress');
  }, []);

  const handleSignRound = useCallback((data) => {
    addLogRef.current(`✍️ Signing round ${data.index}/${data.total}`);
  }, []);

  const handleSignComplete = useCallback((data) => {
    addLogRef.current('✅ Signing completed successfully!');
    addLogRef.current(`📝 Message: ${data.message}`);
    addLogRef.current(`🔏 Signature: ${data.signature}`);
    setSignStatusRef.current('done');
    setSignatureRef.current(data);
  }, []);

  const handleError = useCallback((error) => {
    addLogRef.current(`❌ Error: ${error.message || JSON.stringify(error)}`);
  }, []);

  const handleDisconnect = useCallback(() => {
    addLogRef.current('🔌 WebSocket disconnected');
  }, []);

  const handleReconnect = useCallback(() => {
    addLogRef.current('🔌 WebSocket reconnected');
  }, []);

  useEffect(() => {
    // Register event handlers
    sdkService.on('keygen:start', handleKeygenStart);
    sdkService.on('keygen:round', handleKeygenRound);
    sdkService.on('keygen:complete', handleKeygenComplete);
    sdkService.on('sign:start', handleSignStart);
    sdkService.on('sign:round', handleSignRound);
    sdkService.on('sign:complete', handleSignComplete);
    sdkService.on('error', handleError);
    sdkService.on('disconnect', handleDisconnect);
    sdkService.on('reconnect', handleReconnect);

    return () => {
      sdkService.off('keygen:start', handleKeygenStart);
      sdkService.off('keygen:round', handleKeygenRound);
      sdkService.off('keygen:complete', handleKeygenComplete);
      sdkService.off('sign:start', handleSignStart);
      sdkService.off('sign:round', handleSignRound);
      sdkService.off('sign:complete', handleSignComplete);
      sdkService.off('error', handleError);
      sdkService.off('disconnect', handleDisconnect);
      sdkService.off('reconnect', handleReconnect);
    };
  }, [handleKeygenStart, handleKeygenRound, handleKeygenComplete, handleSignStart, handleSignRound, handleSignComplete, handleError, handleDisconnect, handleReconnect]);
};
