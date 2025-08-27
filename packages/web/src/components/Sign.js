import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import sdkService from '../services/sdk-service';
import { useSDKEvents } from '../hooks/useSDKEvents';

import Header from './Header';

const Sign = () => {
	const location = useLocation();
	
	// Basic state
	const [partyId, setPartyId] = useState(null);
	const [groupId, setGroupId] = useState('');
	const [logs, setLogs] = useState([]);

	// Keyshare state
	const [keyshare, setKeyshare] = useState(null);
	
	// Signing state
	const [signStatus, setSignStatus] = useState('idle');
	const [signature, setSignature] = useState(null);
	const [message, setMessage] = useState('');
	const [signSetupData, setSignSetupData] = useState('');
	const [signQrCodeData, setSignQrCodeData] = useState(null);
	const [activeTab, setActiveTab] = useState('creator'); // 'creator' or 'joiner'
	
	// Function to clean up SDK state
	const cleanupSDKState = async () => {
		if (sdkService.sdk) {
			try {
				// Use SDK's disconnect method which properly cleans up ProtocolManager
				await sdkService.sdk.disconnect();
				addLog('🔌 SDK disconnected and cleaned up');
			} catch (error) {
				addLog(`⚠️ Error cleaning up: ${error.message}`);
			}
		}
	};

	// Existing keyshare management
	const [existingKeyshares, setExistingKeyshares] = useState([]);
	const [showKeyshareOptions, setShowKeyshareOptions] = useState(false);
	const [selectedKeyshare, setSelectedKeyshare] = useState(null);
	const [preloadHandled, setPreloadHandled] = useState(false);

	// Utility functions
	const addLog = (message) => {
		const timestamp = new Date().toLocaleTimeString();
		setLogs(prevLogs => [...prevLogs, `[${timestamp}] ${message}`]);
	};

	const copyToClipboard = (text, label) => {
		navigator.clipboard.writeText(text);
		addLog(`📋 ${label} copied to clipboard`);
	};

	// Use custom hook for SDK events
	useSDKEvents(addLog, null, setSignStatus, setKeyshare, setSignature);
	
	// Cleanup on component unmount
	useEffect(() => {
		return () => {
			// Cleanup SDK state when component unmounts
			if (sdkService.sdk) {
				try {
					sdkService.sdk.disconnect();
				} catch (error) {
					console.warn('Error during cleanup:', error);
				}
			}
		};
	}, []);

	// Initialize SDK and check for existing keyshares
	useEffect(() => {
		const checkExistingKeyshares = async () => {
			addLog('🔍 Checking for existing keyshares...');
			try {
				await sdkService.initialize({ debug: true });
				const storage = sdkService.sdk?.storage;
				if (storage) {
					const keys = await storage.getKeys();
					const keyshareKeys = keys.filter(key => key.includes('keyshare'));
					if (keyshareKeys.length > 0) {
						setExistingKeyshares(keyshareKeys);
						setShowKeyshareOptions(true);
					}
				}
			} catch (error) {
				addLog(`⚠️ Could not check for existing keyshares: ${error.message}`);
			}
		};
		checkExistingKeyshares();
	}, []);

	// If navigated from Home with a preloaded keyshare, seed state and SDK once
	useEffect(() => {
		const navState = location && location.state;
		if (!preloadHandled && navState && navState.keyshare) {
			const ks = navState.keyshare;
			setKeyshare(ks);
			if (ks.partyId) setPartyId(ks.partyId);
			if (ks.groupId) setGroupId(ks.groupId);
			if (sdkService.sdk && sdkService.sdk.config) {
				sdkService.sdk.config.partyId = ks.partyId;
				sdkService.sdk.config.groupId = ks.groupId;
				// Set API key if it exists in the keyshare
				if (ks.apiKey) {
					sdkService.sdk.config.apiKey = ks.apiKey;
					addLog(`🔑 API key set from preloaded keyshare: ${ks.apiKey.substring(0, 20)}...`);
				} else {
					addLog('⚠️ No API key found in preloaded keyshare - registration may be required');
				}
			}
			sdkService.isInitialized = true;
			sdkService.isKeygenCompleted = true;
			sdkService.partyId = ks.partyId;
			sdkService.groupId = ks.groupId;
			setShowKeyshareOptions(false);
			addLog(`✅ Loaded keyshare for party ${ks.partyId} in group ${ks.groupId}`);
			setPreloadHandled(true);
		}
	}, [location, preloadHandled]);

	// Signing helpers
	const validateSignQR = (data) => {
		if (!data) return false;
		const required = ['type', 'groupId', 'threshold', 'totalParties', 'messageHash', 'aesKey', 'timestamp'];
		for (const k of required) if (!(k in data)) return false;
		if (data.type !== 'sign') return false;
		// 60 min expiry by default
		const ageMs = Date.now() - (data.timestamp || 0);
		return ageMs >= 0 && ageMs <= 60 * 60 * 1000;
	};

	const startCreatorSigning = async () => {
		const startTime = Date.now();
		const flowTimeout = 60000; // 60 seconds timeout for entire flow
		
		try {
			if (!keyshare) {
				addLog('❌ No keyshare loaded. Load a keyshare before starting signing.');
				return;
			}
			if (!message.trim()) {
				addLog('❌ Please enter a message to sign.');
				return;
			}
			
			setSignStatus('starting');
			addLog('🚀 Starting creator signing session...');
			addLog(`📝 Message: "${message}"`);
			addLog(`🔢 Threshold: ${keyshare.threshold}-of-${keyshare.totalParties}`);
			
			// Ensure SDK is initialized
			if (!sdkService.isInitialized) {
				addLog('🔌 Initializing SDK...');
				await sdkService.initialize({ debug: true });
			}
			
			// Ensure we have an API key for signing
			if (!sdkService.sdk?.config?.apiKey) {
				addLog('🔑 No API key found - registering party to get API key...');
				try {
					await sdkService.registerParty();
					addLog('✅ Party registered and API key obtained');
				} catch (regError) {
					throw new Error(`Failed to register party for API key: ${regError.message}`);
				}
			} else {
				addLog(`🔑 Using existing API key: ${sdkService.sdk.config.apiKey.substring(0, 20)}...`);
				// Ensure API key is synced to all components
				sdkService.updateSDKConfig({ apiKey: sdkService.sdk.config.apiKey });
			}
			
			// Hash message (SHA-256)
			const encoder = new TextEncoder();
			const msgBytes = encoder.encode(message);
			const hashBuffer = await crypto.subtle.digest('SHA-256', msgBytes);
			const messageHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
			
			// AES key for session
			const aesKey = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
			const signingData = {
				type: 'sign',
				aesKey,
				groupId: keyshare.groupId,
				threshold: keyshare.threshold,
				totalParties: keyshare.totalParties,
				messageHash,
				timestamp: Date.now(),
				version: '1.0'
			};
			
			if (!validateSignQR(signingData)) {
				addLog('❌ Signing data failed validation.');
				setSignStatus('error');
				return;
			}
			
			// Set encryption key
			if (sdkService.sdk) {
				try {
					const aesKeyBytes = Uint8Array.from(atob(aesKey), c => c.charCodeAt(0));
					await sdkService.sdk.setEncryptionKey(aesKeyBytes);
					addLog('✅ Encryption key set for creator');
				} catch (e) {
					addLog(`⚠️ Could not set encryption key: ${e.message}`);
				}
			}
			
			setSignQrCodeData(JSON.stringify(signingData));
			addLog('✅ QR code generated');
			addLog('⏳ Waiting for other parties to join...');
			setSignStatus('waiting');
			
			// Start the actual signing process using the loaded keyshare
			if (sdkService.sdk) {
				// Debug: Check ProtocolManager config before signing
				console.log('🆔 [Sign] SDK config before signing:', sdkService.sdk.config);
				console.log('🆔 [Sign] ProtocolManager config before signing:', sdkService.sdk.protocolManager?.config);
				console.log('🆔 [Sign] API client config before signing:', sdkService.sdk.apiClient?.config);
				
				// Convert hex string back to Uint8Array
				const messageHashBytes = new Uint8Array(messageHash.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
				
				// Start signing with the loaded keyshare
				// Use rawKeyshare if available (WASM format), otherwise use the keyshare directly
				const keyshareToUse = keyshare.rawKeyshare || keyshare;
				console.log('🆔 [Sign] Keyshare format check:', {
					hasRawKeyshare: !!keyshare.rawKeyshare,
					keyshareType: typeof keyshareToUse,
					keyshareKeys: keyshareToUse ? Object.keys(keyshareToUse) : 'null'
				});
				
				// Start signing with timeout
				const signingTimeout = new Promise((_, reject) => {
					setTimeout(() => {
						reject(new Error(`Signing timeout after ${flowTimeout/1000} seconds`));
					}, flowTimeout - (Date.now() - startTime));
				});
				
				// Race between signing completion and timeout
				await Promise.race([
					sdkService.sdk.startSigning(messageHashBytes, keyshareToUse),
					signingTimeout
				]);
				
				addLog('✅ Signing completed!');
				setSignStatus('completed');
				
				const totalTime = Date.now() - startTime;
				addLog(`⚡ Total signing completed in ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`);
			} else {
				throw new Error('SDK not available');
			}
		} catch (err) {
			setSignStatus('error');
			addLog(`❌ Failed to start creator signing: ${err.message}`);
		}
	};

	const joinSigningSession = async () => {
		try {
			if (!signSetupData.trim()) {
				addLog('❌ Please paste signing session QR data first.');
				return;
			}
			const data = JSON.parse(signSetupData);
			if (!validateSignQR(data)) {
				addLog('❌ Invalid or expired signing session data.');
				return;
			}
			
			setSignStatus('starting');
			addLog('🚀 Starting signing process...');
			addLog(`🔢 Threshold: ${data.threshold}-of-${data.totalParties}`);
			
			// Ensure SDK is initialized
			if (!sdkService.isInitialized) {
				addLog('🔌 Initializing SDK...');
				await sdkService.initialize({ debug: true });
			}
			
			// Ensure we have an API key for signing
			if (!sdkService.sdk?.config?.apiKey) {
				addLog('🔑 No API key found - registering party to get API key...');
				try {
					await sdkService.registerParty();
					addLog('✅ Party registered and API key obtained');
				} catch (regError) {
					throw new Error(`Failed to register party for API key: ${regError.message}`);
				}
			} else {
				addLog(`🔑 Using existing API key: ${sdkService.sdk.config.apiKey.substring(0, 20)}...`);
				// Ensure API key is synced to all components
				sdkService.updateSDKConfig({ apiKey: sdkService.sdk.config.apiKey });
			}
			
			// Update SDK configuration with signing session data
			if (sdkService.sdk) {
				sdkService.updateSDKConfig({
					groupId: data.groupId,
					partyId: data.partyId || sdkService.sdk.config.partyId
				});
				addLog(`🔧 SDK configured for group: ${data.groupId}`);
			}
			
			// Set encryption key
			if (data.aesKey && sdkService.sdk) {
				try {
					const aesKeyBytes = Uint8Array.from(atob(data.aesKey), c => c.charCodeAt(0));
					await sdkService.sdk.setEncryptionKey(aesKeyBytes);
					addLog('✅ Encryption key set for signing session');
				} catch (e) {
					addLog(`⚠️ Could not set encryption key: ${e.message}`);
				}
			}
			
			// Start signing with the message hash from the QR code
			if (sdkService.sdk && keyshare) {
				try {
					// Get the message hash from the QR code data
					let messageHashBytes;
					if (data.messageHash) {
						addLog(`📝 Using message hash from QR code: ${data.messageHash.substring(0, 16)}...`);
						// Convert hex string to Uint8Array
						messageHashBytes = new Uint8Array(data.messageHash.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
					} else {
						// Fallback: create a dummy message hash (for testing)
						messageHashBytes = new Uint8Array(32);
						for (let i = 0; i < 32; i++) messageHashBytes[i] = 0;
						addLog('⚠️ No message hash in QR code - using dummy hash');
					}
					
					// Use rawKeyshare if available (WASM format), otherwise use the keyshare directly
					const keyshareToUse = keyshare.rawKeyshare || keyshare;
					console.log('🆔 [Sign] Joiner keyshare format check:', {
						hasRawKeyshare: !!keyshare.rawKeyshare,
						keyshareType: typeof keyshareToUse,
						keyshareKeys: keyshareToUse ? Object.keys(keyshareToUse) : 'null'
					});
					
					// Start signing (this will connect to WebSocket and prepare the sign processor)
					await sdkService.sdk.startSigning(messageHashBytes, keyshareToUse);
					addLog('✅ Signing started and WebSocket connected');
				} catch (signError) {
					addLog(`⚠️ Could not start signing: ${signError.message}`);
				}
			} else {
				addLog('⚠️ No keyshare loaded - cannot participate in signing');
			}
			
			setGroupId(data.groupId);
			
			addLog('✅ Signing process started');
			addLog('⏳ Participating in signing protocol...');
			setSignStatus('in-progress');
		} catch (err) {
			setSignStatus('error');
			addLog(`❌ Failed to start signing: ${err.message}`);
		}
	};



	const loadKeyshare = async () => {
		if (!selectedKeyshare) {
			addLog('❌ Please select a keyshare to load');
			return;
		}

		try {
			addLog('📂 Loading keyshare...');
			const storage = sdkService.sdk?.storage;
			if (storage) {
				const keyshareData = await storage.get(selectedKeyshare);
				if (keyshareData) {
					const parsedKeyshare = JSON.parse(keyshareData);
					setKeyshare(parsedKeyshare);
					setPartyId(parsedKeyshare.partyId);
					setGroupId(parsedKeyshare.groupId);
					
					if (sdkService.sdk && sdkService.sdk.config) {
						sdkService.sdk.config.partyId = parsedKeyshare.partyId;
						sdkService.sdk.config.groupId = parsedKeyshare.groupId;
						// Set API key if it exists in the keyshare
						if (parsedKeyshare.apiKey) {
							sdkService.sdk.config.apiKey = parsedKeyshare.apiKey;
							addLog(`🔑 API key set from keyshare: ${parsedKeyshare.apiKey.substring(0, 20)}...`);
						} else {
							addLog('⚠️ No API key found in keyshare - registering party to get new API key');
							try {
								await sdkService.registerParty();
								addLog('✅ Party registered and API key obtained');
							} catch (regError) {
								addLog(`❌ Failed to register party: ${regError.message}`);
							}
						}
					}
					sdkService.isInitialized = true;
					sdkService.isKeygenCompleted = true;
					sdkService.partyId = parsedKeyshare.partyId;
					sdkService.groupId = parsedKeyshare.groupId;
					
					setShowKeyshareOptions(false);
					addLog(`✅ Loaded keyshare for party ${parsedKeyshare.partyId} in group ${parsedKeyshare.groupId}`);
				} else {
					addLog('❌ Keyshare not found in storage');
				}
			}
		} catch (error) {
			addLog(`❌ Failed to load keyshare: ${error.message}`);
		}
	};

	const startNewSigning = async () => {
		addLog('🆕 Starting new signing session');
		
		// Clean up SDK state to prevent message conflicts
		await cleanupSDKState();
		
		// Keep the keyshare loaded but reset everything else
		setSignStatus('idle');
		setSignature(null);
		setMessage('');
		setSignSetupData('');
		setSignQrCodeData(null);
	};



	return (
		<div className="sign-container">
			<Header 
				title="DeFiShard SDK Test App"
				subtitle="Threshold signing with distributed keyshares"
			/>

			<div className="sign-content">
				{/* Keyshare Status */}
				<div className="keyshare-status">
					<div className="status-indicator">
						<span className={`status-dot ${keyshare ? 'loaded' : 'not-loaded'}`}></span>
						<span className="status-text">
							{keyshare ? (
								<>
									Keyshare Loaded (Party {keyshare.partyId}, Group {keyshare.groupId?.substring(0, 8)}...)
									{sdkService.sdk?.config?.apiKey ? (
										<span style={{ color: '#10b981', marginLeft: '8px' }}>• API Key Set</span>
									) : (
										<span style={{ color: '#ef4444', marginLeft: '8px' }}>• No API Key</span>
									)}
								</>
							) : (
								'No Keyshare Loaded'
							)}
						</span>
					</div>
				</div>

				{/* Keyshare Management Section */}
				<div className="keyshare-section">
					<div className="section-header">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
							<path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
							<path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
						</svg>
						<h3>Keyshare Management</h3>
					</div>
					
					{showKeyshareOptions ? (
						<div className="keyshare-options">
							<div className="keyshare-selection">
								<label>Select Keyshare:</label>
								<select 
									value={selectedKeyshare || ''} 
									onChange={(e) => setSelectedKeyshare(e.target.value)}
									className="keyshare-dropdown"
								>
									<option value="">Choose a keyshare...</option>
									{existingKeyshares.map((key, idx) => (
										<option key={idx} value={key}>
											{key.replace('keyshare_', '').substring(0, 20)}...
										</option>
									))}
								</select>
							</div>
							<div className="keyshare-actions">
								<button 
									className="load-keyshare-btn" 
									onClick={loadKeyshare}
									disabled={!selectedKeyshare}
								>
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
										<path d="M3 15v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
										<polyline points="7,10 12,15 17,10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
										<line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
									</svg>
									Load Keyshare
								</button>
							</div>
						</div>
					) : keyshare ? (
						<div className="keyshare-info">
							<div className="info-grid">
								<div className="info-item">
									<label>Party ID:</label>
									<span>{partyId?.substring(0, 20)}...</span>
								</div>
								<div className="info-item">
									<label>Group ID:</label>
									<span>{groupId?.substring(0, 20)}...</span>
								</div>
								<div className="info-item">
									<label>Threshold:</label>
									<span>{keyshare.threshold}-of-{keyshare.totalParties}</span>
								</div>
							</div>


						</div>
					) : (
						<div className="no-keyshare-state">
							<div className="no-keyshare-icon">🔑</div>
							<p>No keyshare loaded</p>
							<small>Load a keyshare to start signing</small>
						</div>
					)}
				</div>

				{/* Message Input */}
				{keyshare && (
					<div className="message-section">
						<div className="message-input">
							<label>Message to Sign:</label>
							<textarea 
								value={message} 
								onChange={(e) => setMessage(e.target.value)} 
								placeholder="Enter the message you want to sign..."
								className="message-textarea"
								rows="3" 
							/>
						</div>
					</div>
				)}

				{/* Tab Navigation */}
				{keyshare && (
					<div className="tab-navigation">
						<button 
							className={`tab-button ${activeTab === 'creator' ? 'active' : ''}`}
							onClick={async () => {
								if (activeTab !== 'creator') {
									await cleanupSDKState();
									setActiveTab('creator');
								}
							}}
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
								<path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
								<path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
							</svg>
							Creator
						</button>
						<button 
							className={`tab-button ${activeTab === 'joiner' ? 'active' : ''}`}
							onClick={async () => {
								if (activeTab !== 'joiner') {
									await cleanupSDKState();
									setActiveTab('joiner');
								}
							}}
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
								<circle cx="8.5" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
								<path d="M20 8v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
								<path d="M23 11h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
							</svg>
							Joiner
						</button>
					</div>
				)}

				{/* Creator Tab */}
				{keyshare && activeTab === 'creator' && (
					<div className="creator-section">
						<div className="section-header">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
								<path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
								<path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
							</svg>
							<h3>Creator - Generate QR Code</h3>
						</div>
						
						<div className="creator-content">
							{/* QR Code Section */}
							{signQrCodeData && (
								<div className="qr-content">
									<div className="qr-code">
										<QRCodeSVG value={signQrCodeData} size={200} />
									</div>
									<div className="qr-data">
										<label>QR Code Data:</label>
										<textarea
											value={signQrCodeData}
											readOnly
											className="qr-textarea"
											rows="4"
										/>
										<button 
											className="secondary-btn" 
											onClick={() => copyToClipboard(signQrCodeData, 'QR Code Data')}
										>
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
												<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
												<rect x="8" y="2" width="8" height="4" rx="1" ry="1" stroke="currentColor" strokeWidth="2"/>
											</svg>
											Copy Data
										</button>
									</div>
								</div>
							)}
							
							{/* Signing Button Section - Always Visible */}
							<div className="start-signing">
								<button 
									className="primary-btn" 
									onClick={startCreatorSigning}
									disabled={!message.trim() || signStatus === 'starting' || signStatus === 'waiting' || signStatus === 'in-progress' || signStatus === 'done'}
								>
									{signStatus === 'starting' ? (
										<>
											<span className="loading-spinner"></span>
											Starting...
										</>
									) : signStatus === 'in-progress' ? (
										<>
											<span className="loading-spinner"></span>
											Signing...
										</>
									) : signStatus === 'waiting' ? (
										<>
											<span className="loading-spinner"></span>
											Waiting for parties...
										</>
									) : signStatus === 'done' ? (
										<>
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
												<path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
												<path d="M21 12c-1 0-2-1-2-2s1-2 2-2 2 1 2 2-1 2-2 2z" stroke="currentColor" strokeWidth="2"/>
												<path d="M3 12c1 0 2-1 2-2s-1-2-2-2-2 1-2 2 1 2 2 2z" stroke="currentColor" strokeWidth="2"/>
												<path d="M12 3c0 1-1 2-2 2s-2-1-2-2 1-2 2-2 2 1 2 2z" stroke="currentColor" strokeWidth="2"/>
												<path d="M12 21c0-1 1-2 2-2s2 1 2 2-1 2-2 2-2-1-2-2z" stroke="currentColor" strokeWidth="2"/>
											</svg>
											Signing Complete
										</>
									) : (
										<>
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
												<path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
											</svg>
											{signQrCodeData ? 'Restart Signing Session' : 'Start Signing Session'}
										</>
									)}
								</button>
								<p className="help-text">
									{signStatus === 'done'
										? 'Signing completed successfully! Click "Start New Session" to sign another message.'
										: signQrCodeData 
											? 'QR code generated. Share with other parties and wait for them to join.'
											: 'This will generate a QR code and connect to the relay server to wait for other parties.'
									}
								</p>
							</div>
						</div>
					</div>
				)}

				{/* Joiner Tab */}
				{keyshare && activeTab === 'joiner' && (
					<div className="joiner-section">
						<div className="section-header">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
								<circle cx="8.5" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
								<path d="M20 8v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
								<path d="M23 11h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
							</svg>
							<h3>Joiner - Paste QR Code Data</h3>
						</div>
						
						<div className="joiner-content">
							<div className="qr-input">
								<label>QR Code Data:</label>
								<textarea
									value={signSetupData}
									onChange={(e) => setSignSetupData(e.target.value)}
									placeholder="Paste the QR code data from the signing session..."
									className="qr-textarea"
									rows="4"
								/>
							</div>
							
							<div className="join-actions">
								<button 
									className="primary-btn" 
									onClick={joinSigningSession}
									disabled={!signSetupData.trim() || signStatus === 'starting' || signStatus === 'waiting' || signStatus === 'in-progress' || signStatus === 'done'}
								>
									{signStatus === 'starting' ? (
										<>
											<span className="loading-spinner"></span>
											Joining...
										</>
									) : signStatus === 'in-progress' ? (
										<>
											<span className="loading-spinner"></span>
											Signing...
										</>
									) : signStatus === 'waiting' ? (
										<>
											<span className="loading-spinner"></span>
											Waiting for creator...
										</>
									) : signStatus === 'done' ? (
										<>
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
												<path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
												<path d="M21 12c-1 0-2-1-2-2s1-2 2-2 2 1 2 2-1 2-2 2z" stroke="currentColor" strokeWidth="2"/>
												<path d="M3 12c1 0 2-1 2-2s-1-2-2-2-2 1-2 2 1 2 2 2z" stroke="currentColor" strokeWidth="2"/>
												<path d="M12 3c0 1-1 2-2 2s-2-1-2-2 1-2 2-2 2 1 2 2z" stroke="currentColor" strokeWidth="2"/>
												<path d="M12 21c0-1 1-2 2-2s2 1 2 2-1 2-2 2-2-1-2-2z" stroke="currentColor" strokeWidth="2"/>
											</svg>
											Signing Complete
										</>
									) : (
										<>
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
												<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
												<circle cx="8.5" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
												<path d="M20 8v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
												<path d="M23 11h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
											</svg>
											Join & Sign Session
										</>
									)}
								</button>
								<p className="help-text">
									{signStatus === 'done'
										? 'Signing completed successfully! Click "Start New Session" to sign another message.'
										: signStatus === 'waiting' || signStatus === 'in-progress'
											? 'Connected to relay server. Waiting for signing process to complete.'
											: 'This will connect to the relay server and wait for the signing process to start.'
									}
								</p>
							</div>
						</div>
					</div>
				)}



				{/* Signature Result Section */}
				{signature && (
					<div className="signature-section">
						<div className="section-header">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
								<path d="M21 12c-1 0-2-1-2-2s1-2 2-2 2 1 2 2-1 2-2 2z" stroke="currentColor" strokeWidth="2"/>
								<path d="M3 12c1 0 2-1 2-2s-1-2-2-2-2 1-2 2 1 2 2 2z" stroke="currentColor" strokeWidth="2"/>
								<path d="M12 3c0 1-1 2-2 2s-2-1-2-2 1-2 2-2 2 1 2 2z" stroke="currentColor" strokeWidth="2"/>
								<path d="M12 21c0-1 1-2 2-2s2 1 2 2-1 2-2 2-2-1-2-2z" stroke="currentColor" strokeWidth="2"/>
							</svg>
							<h3>Signing Complete</h3>
						</div>
						
						<div className="signature-content">
							<div className="success-message">
								<div className="success-icon">✅</div>
								<h4>Signature Generated Successfully</h4>
								<p>The threshold signing process has completed. Your signature is ready.</p>
							</div>
							
							<div className="signature-display">
								<div className="signature-field">
									<label>Signature (R):</label>
									<div className="signature-value">
										<span>{signature.r || 'N/A'}</span>
										<button 
											className="copy-btn" 
											onClick={() => copyToClipboard(signature.r || '', 'Signature R')}
											title="Copy R value"
										>
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
												<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
												<rect x="8" y="2" width="8" height="4" rx="1" ry="1" stroke="currentColor" strokeWidth="2"/>
											</svg>
										</button>
									</div>
								</div>
								
								<div className="signature-field">
									<label>Signature (S):</label>
									<div className="signature-value">
										<span>{signature.s || 'N/A'}</span>
										<button 
											className="copy-btn" 
											onClick={() => copyToClipboard(signature.s || '', 'Signature S')}
											title="Copy S value"
										>
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
												<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
												<rect x="8" y="2" width="8" height="4" rx="1" ry="1" stroke="currentColor" strokeWidth="2"/>
											</svg>
										</button>
									</div>
								</div>
								
								<div className="signature-actions">
									<button 
										className="primary-btn" 
										onClick={() => copyToClipboard(JSON.stringify(signature, null, 2), 'Full Signature')}
									>
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
											<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
											<rect x="8" y="2" width="8" height="4" rx="1" ry="1" stroke="currentColor" strokeWidth="2"/>
										</svg>
										Copy Full Signature
									</button>
									
									<button 
										className="secondary-btn" 
										onClick={startNewSigning}
									>
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
											<path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
										</svg>
										Start New Session
									</button>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Logs Section */}
				<div className="logs-section">
					<div className="section-header">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
							<polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
							<line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
							<line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
							<polyline points="10,9 9,9 8,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
						</svg>
						<h3>Activity Logs</h3>
					</div>
					
					<div className="logs-content">
						<div className="logs-container">
							{logs.length === 0 ? (
								<div className="no-logs">
									<p>No activity yet</p>
									<small>Start signing to see logs</small>
								</div>
							) : (
								logs.map((log, index) => (
									<div key={index} className="log-entry">
										{log}
									</div>
								))
							)}
						</div>
						{logs.length > 0 && (
							<button 
								className="secondary-btn clear-logs-btn" 
								onClick={() => setLogs([])}
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
								</svg>
								Clear Logs
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default Sign;
