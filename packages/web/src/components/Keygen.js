import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import sdkService from '../services/sdk-service';
import { useSDKEvents } from '../hooks/useSDKEvents';
import {
	generateQRCodeData,
	parseQRCodeData,
	waitForPartiesReady
} from '../utils/keygenUtils';
import Header from './Header';

const Keygen = () => {
	const navigate = useNavigate();
	
	// Basic state
	const [partyId, setPartyId] = useState(null);
	const [groupId, setGroupId] = useState('');
	const [groupInfo, setGroupInfo] = useState(null);
	const [logs, setLogs] = useState([]);

	// Keygen state
	const [keygenStatus, setKeygenStatus] = useState('idle');
	const [keyshare, setKeyshare] = useState(null);
	const [activeTab, setActiveTab] = useState('creator'); // 'creator' or 'joiner'
	
	// Group configuration
	const [threshold, setThreshold] = useState(2);
	const [totalParties, setTotalParties] = useState(2);
	
	// Password for keyshare encryption
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [passwordSet, setPasswordSet] = useState(false);
	
	// QR code data
	const [qrCodeData, setQrCodeData] = useState(null);
	const [setupData, setSetupData] = useState('');
	
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
	useSDKEvents(addLog, setKeygenStatus, null, setKeyshare, null);
	
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

	// Initialize SDK
	useEffect(() => {
		const initializeSDK = async () => {
			addLog('🔧 Initializing SDK...');
			try {
				await sdkService.initialize({ debug: true });
				addLog('✅ SDK initialized');
			} catch (error) {
				addLog(`⚠️ Could not initialize SDK: ${error.message}`);
			}
		};
		initializeSDK();
	}, []);

	// Navigate to signing page when keygen completes
	useEffect(() => {
		if (keygenStatus === 'completed' && keyshare) {
			addLog('🎉 Key generation completed! Navigating to signing page...');
			navigate('/signing', { state: { keyshare } });
		}
	}, [keygenStatus, keyshare, navigate]);

	const startCreatorKeygen = async () => {
		const startTime = Date.now();
		const flowTimeout = 60000; // 60 seconds timeout for entire flow
		
		try {
			if (!passwordSet && password) {
				addLog('❌ Please set the password first.');
				return;
			}
			
			setKeygenStatus('starting');
			addLog('🚀 Starting creator key generation...');
			addLog(`🔢 Threshold: ${threshold}-of-${totalParties}`);
			
			// Ensure SDK is initialized (uses Settings-configured URLs)
			if (!sdkService.isInitialized) {
				addLog('🔌 Initializing SDK...');
				await sdkService.initialize({ debug: true });
			}
			
			// Register party if needed (required before group creation)
			if (!partyId) {
				addLog('👤 Registering party...');
				const registration = await sdkService.registerParty();
				const newPartyId = typeof registration === 'object' ? (registration.party_id || registration.partyId) : registration;
				setPartyId(newPartyId);
				addLog(`✅ Party registered: ${newPartyId}`);
			}
			
			// Create group (requires registered party)
			addLog(`📋 Creating new group (${threshold}-of-${totalParties})...`);
			const groupInfo = await sdkService.createGroup(threshold, totalParties, 60);
			setGroupInfo(groupInfo);
			setGroupId(groupInfo.group.groupId);
			addLog(`✅ Group created: ${groupInfo.group.groupId}`);
			
			// Generate QR code
			try {
				const generatedQRData = await generateQRCodeData(groupInfo, partyId, addLog);
				if (generatedQRData) {
					setQrCodeData(generatedQRData);
					addLog('✅ QR code generated');
					
					// Set encryption key
					const parsedQR = JSON.parse(generatedQRData);
					if (parsedQR.aesKey) {
						const aesKeyBytes = Uint8Array.from(atob(parsedQR.aesKey), c => c.charCodeAt(0));
						await sdkService.sdk.setEncryptionKey(aesKeyBytes);
						addLog('✅ Encryption key set for creator');
					}
				}
			} catch (error) {
				addLog(`❌ QR code generation failed: ${error.message}`);
				setKeygenStatus('error');
				return;
			}
			
			// Wait for all parties to join (optimized)
			addLog('⏳ Waiting for all parties to join...');
			await waitForPartiesReady(groupInfo.group.groupId, totalParties, addLog);
			addLog('✅ All parties have joined!');
			
			// Start key generation with timeout
			addLog('🚀 Starting distributed key generation...');
			
			// Create a timeout promise for the entire keygen process
			const keygenTimeout = new Promise((_, reject) => {
				setTimeout(() => {
					reject(new Error(`Key generation timeout after ${flowTimeout/1000} seconds`));
				}, flowTimeout - (Date.now() - startTime));
			});
			
			// Race between keygen completion and timeout
			await Promise.race([
				sdkService.startKeygen(true),
				keygenTimeout
			]);
			
			addLog('✅ Key generation completed!');
			setKeygenStatus('completed');
			
			const totalTime = Date.now() - startTime;
			addLog(`⚡ Total keygen completed in ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`);
		} catch (error) {
			setKeygenStatus('error');
			addLog(`❌ Creator key generation failed: ${error.message}`);
		}
	};

	const joinKeygenSession = async () => {
		const startTime = Date.now();
		const flowTimeout = 60000; // 60 seconds timeout for entire flow
		
		try {
			if (!setupData.trim()) {
				addLog('❌ Please paste QR code data first.');
				return;
			}
			
			setKeygenStatus('starting');
			addLog('🚀 Starting joiner key generation...');
			
			// Parse QR code data
			const parsedQR = await parseQRCodeData(setupData, addLog);
			if (!parsedQR) {
				addLog('❌ Invalid QR code data.');
				setKeygenStatus('error');
				return;
			}
			
			// Ensure SDK is initialized (uses Settings-configured URLs)
			if (!sdkService.isInitialized) {
				addLog('🔌 Initializing SDK...');
				await sdkService.initialize({ debug: true });
			}
			
			// Register party if needed
			if (!partyId) {
				addLog('👤 Registering party...');
				const registration = await sdkService.registerParty();
				const newPartyId = typeof registration === 'object' ? (registration.party_id || registration.partyId) : registration;
				setPartyId(newPartyId);
				addLog(`✅ Party registered: ${newPartyId}`);
			}
			
			// Join group
			addLog('🔗 Joining existing group...');
			await sdkService.joinGroup(parsedQR.groupId);
			setGroupId(parsedQR.groupId);
			addLog(`✅ Joined group: ${parsedQR.groupId}`);
			
			// Set encryption key
			if (parsedQR.aesKey) {
				try {
					const aesKeyBytes = Uint8Array.from(atob(parsedQR.aesKey), c => c.charCodeAt(0));
					await sdkService.sdk.setEncryptionKey(aesKeyBytes);
					addLog('✅ Encryption key set for joiner');
				} catch (error) {
					addLog(`⚠️ Could not set encryption key: ${error.message}`);
				}
			}
			
			// Wait for group to be ready (optimized)
			addLog('⏳ Waiting for group to be ready...');
			await waitForPartiesReady(parsedQR.groupId, parsedQR.totalParties, addLog);
			addLog('✅ Group is ready!');
			
			// Start key generation with timeout
			addLog('🚀 Starting distributed key generation...');
			
			// Create a timeout promise for the entire keygen process
			const keygenTimeout = new Promise((_, reject) => {
				setTimeout(() => {
					reject(new Error(`Key generation timeout after ${flowTimeout/1000} seconds`));
				}, flowTimeout - (Date.now() - startTime));
			});
			
			// Race between keygen completion and timeout
			await Promise.race([
				sdkService.startKeygen(false),
				keygenTimeout
			]);
			
			addLog('✅ Key generation completed!');
			setKeygenStatus('completed');
			
			const totalTime = Date.now() - startTime;
			addLog(`⚡ Total keygen completed in ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`);
		} catch (error) {
			setKeygenStatus('error');
			addLog(`❌ Joiner key generation failed: ${error.message}`);
		}
	};

	const startNewKeygen = async () => {
		addLog('🆕 Starting new keygen session');
		
		// Clean up SDK state to prevent conflicts
		await cleanupSDKState();
		
		// Reset keygen-specific state
		setKeygenStatus('idle');
		setKeyshare(null);
		setQrCodeData(null);
		setSetupData('');
		setGroupInfo(null);
		setGroupId('');
	};

	return (
		<div className="keygen-container">
			<Header 
				title="DeFiShard SDK Test App"
				subtitle="Generate distributed keys for threshold signing"
			/>

			<div className="keygen-content">
				{/* Group Configuration Section */}
				<div className="config-section">
					<div className="section-header">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" strokeWidth="2"/>
							<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="2"/>
						</svg>
						<h3>Group Configuration</h3>
					</div>
					
					<div className="config-grid">
						<div className="config-item">
							<label>Threshold</label>
							<input 
								type="number" 
								value={threshold} 
								onChange={(e) => setThreshold(parseInt(e.target.value))}
								min="2" 
								max="10"
								className="config-input"
							/>
						</div>
						<div className="config-item">
							<label>Total Parties</label>
							<input 
								type="number" 
								value={totalParties} 
								onChange={(e) => setTotalParties(parseInt(e.target.value))}
								min="2" 
								max="10"
								className="config-input"
							/>
						</div>
					</div>

					{/* Password Section */}
					<div className="password-section">
						<div className="section-header">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
								<circle cx="12" cy="16" r="1" stroke="currentColor" strokeWidth="2"/>
								<path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2"/>
							</svg>
							<h4>Keyshare Password (Optional)</h4>
							{passwordSet && (
								<div className="password-status">
									<span className="password-status-dot active"></span>
									<span className="password-status-text">Configured</span>
								</div>
							)}
						</div>
						<div className="password-inputs">
							<input
								type="password"
								placeholder="Enter password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="password-input"
							/>
							<input
								type="password"
								placeholder="Confirm password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								className="password-input"
							/>
							<button 
								onClick={() => {
									setPasswordSet(true);
									addLog('🔐 Password configured (will be applied during keygen)');
								}}
								disabled={!password || password !== confirmPassword}
								className="set-password-btn"
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
								</svg>
								Set Password
							</button>
						</div>
					</div>
				</div>

				{/* Tab Navigation */}
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

				{/* Creator Tab */}
				{activeTab === 'creator' && (
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
							{qrCodeData && (
								<div className="qr-content">
									<div className="qr-code">
										<QRCodeSVG value={qrCodeData} size={200} />
									</div>
									<div className="qr-data">
										<label>QR Code Data:</label>
										<textarea
											value={qrCodeData}
											readOnly
											className="qr-textarea"
											rows="4"
										/>
										<button 
											className="secondary-btn" 
											onClick={() => copyToClipboard(qrCodeData, 'QR Code Data')}
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
							
							{/* Keygen Button Section - Always Visible */}
							<div className="start-keygen">
								<button 
									className="primary-btn" 
									onClick={startCreatorKeygen}
									disabled={keygenStatus === 'starting' || keygenStatus === 'in-progress' || keygenStatus === 'completed'}
								>
									{keygenStatus === 'starting' ? (
										<>
											<span className="loading-spinner"></span>
											Starting...
										</>
									) : keygenStatus === 'in-progress' ? (
										<>
											<span className="loading-spinner"></span>
											Key Generation in Progress...
										</>
									) : keygenStatus === 'completed' ? (
										<>
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
												<path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
											</svg>
											Key Generation Complete
										</>
									) : (
										<>
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
												<path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
												<path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
												<path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
											</svg>
											{qrCodeData ? 'Start Key Generation' : 'Create Group & Generate QR'}
										</>
									)}
								</button>
								<p className="help-text">
									{keygenStatus === 'completed'
										? 'Key generation completed successfully! Proceed to signing.'
										: qrCodeData 
											? 'QR code generated. Share with other parties and start key generation.'
											: 'This will create a new group, generate a QR code, and start the key generation process.'
									}
								</p>
							</div>
						</div>
					</div>
				)}

				{/* Joiner Tab */}
				{activeTab === 'joiner' && (
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
									value={setupData}
									onChange={(e) => setSetupData(e.target.value)}
									placeholder="Paste the QR code data from the creator..."
									className="qr-textarea"
									rows="4"
								/>
							</div>

							<div className="join-actions">
								<button 
									className="primary-btn" 
									onClick={joinKeygenSession}
									disabled={!setupData.trim() || keygenStatus === 'starting' || keygenStatus === 'in-progress' || keygenStatus === 'completed'}
								>
									{keygenStatus === 'starting' ? (
										<>
											<span className="loading-spinner"></span>
											Joining...
										</>
									) : keygenStatus === 'in-progress' ? (
										<>
											<span className="loading-spinner"></span>
											Key Generation in Progress...
										</>
									) : keygenStatus === 'completed' ? (
										<>
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
												<path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
											</svg>
											Key Generation Complete
										</>
									) : (
										<>
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
												<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
												<circle cx="8.5" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
												<path d="M20 8v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
												<path d="M23 11h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
											</svg>
											Join & Start Key Generation
										</>
									)}
								</button>
								<p className="help-text">
									{keygenStatus === 'completed'
										? 'Key generation completed successfully! You will be redirected to signing in 5 seconds.'
										: keygenStatus === 'in-progress'
											? 'Connected to relay server. Participating in key generation process.'
											: 'This will join the group and participate in the key generation process.'
									}
								</p>
							</div>
						</div>
					</div>
				)}

				{/* Keyshare Result Section */}
				{keygenStatus === 'completed' && keyshare && (
					<div className="keyshare-section">
						<div className="section-header">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
							</svg>
							<h3>Key Generation Complete</h3>
						</div>
						
						<div className="keyshare-content">
							<div className="success-message">
								<div className="success-icon">✅</div>
								<h4>Keyshare Generated Successfully</h4>
								<p>The distributed key generation process has completed. Your keyshare is ready.</p>
							</div>
							
							<div className="keyshare-display">
								<div className="keyshare-field">
									<label>Public Key:</label>
									<div className="keyshare-value">
										<span>{keyshare.publicKey ? keyshare.publicKey.substring(0, 20) + '...' : 'N/A'}</span>
										<button 
											className="copy-btn" 
											onClick={() => copyToClipboard(keyshare.publicKey || '', 'Public Key')}
											title="Copy Public Key"
										>
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
												<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
												<rect x="8" y="2" width="8" height="4" rx="1" ry="1" stroke="currentColor" strokeWidth="2"/>
											</svg>
										</button>
									</div>
								</div>
								
								<div className="keyshare-field">
									<label>Party ID:</label>
									<div className="keyshare-value">
										<span>{keyshare.partyId ? keyshare.partyId.substring(0, 20) + '...' : 'N/A'}</span>
										<button 
											className="copy-btn" 
											onClick={() => copyToClipboard(keyshare.partyId || '', 'Party ID')}
											title="Copy Party ID"
										>
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
												<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
												<rect x="8" y="2" width="8" height="4" rx="1" ry="1" stroke="currentColor" strokeWidth="2"/>
											</svg>
										</button>
									</div>
								</div>
								
								<div className="keyshare-field">
									<label>Group ID:</label>
									<div className="keyshare-value">
										<span>{keyshare.groupId ? keyshare.groupId.substring(0, 20) + '...' : 'N/A'}</span>
										<button 
											className="copy-btn" 
											onClick={() => copyToClipboard(keyshare.groupId || '', 'Group ID')}
											title="Copy Group ID"
										>
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
												<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
												<rect x="8" y="2" width="8" height="4" rx="1" ry="1" stroke="currentColor" strokeWidth="2"/>
											</svg>
										</button>
									</div>
								</div>
								
								<div className="keyshare-actions">
									<button 
										className="primary-btn" 
										onClick={() => copyToClipboard(JSON.stringify(keyshare, null, 2), 'Full Keyshare')}
									>
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
											<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
											<rect x="8" y="2" width="8" height="4" rx="1" ry="1" stroke="currentColor" strokeWidth="2"/>
										</svg>
										Copy Full Keyshare
									</button>
									
									<button 
										className="secondary-btn" 
										onClick={startNewKeygen}
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
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2"/>
							<polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
							<line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2"/>
							<line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2"/>
							<polyline points="10,9 9,9 8,9" stroke="currentColor" strokeWidth="2"/>
						</svg>
						<h3>Activity Logs</h3>
					</div>
					
					<div className="logs-content">
						<div className="logs-container">
							{logs.length === 0 ? (
								<div className="no-logs">
									<p>No activity yet</p>
									<small>Start key generation to see logs</small>
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

export default Keygen;
