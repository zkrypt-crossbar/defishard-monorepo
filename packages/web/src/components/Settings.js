import React, { useState, useEffect } from 'react';
import sdkService from '../services/sdk-service';
import { searchAllLocalStorageForKeyshares } from '../utils/keygenUtils';
import { formatLongIdWithTooltip } from '../utils/formatUtils';
import Header from './Header';

const Settings = () => {
	const [keyshares, setKeyshares] = useState([]);
	const [loading, setLoading] = useState(true);
	const [selectedKeyshare, setSelectedKeyshare] = useState(null);
	const [logs, setLogs] = useState([]);
	const [relayerUrl, setRelayerUrl] = useState('');
	const [wsUrl, setWsUrl] = useState('');
	const [testing, setTesting] = useState(false);
	const [saving, setSaving] = useState(false);
	const [healthStatus, setHealthStatus] = useState(null);

	const addLog = (message) => {
		const timestamp = new Date().toLocaleTimeString();
		setLogs(prevLogs => [...prevLogs, `[${timestamp}] ${message}`]);
	};

	const copyToClipboard = (text, label) => {
		navigator.clipboard.writeText(text);
		addLog(`📋 ${label} copied to clipboard`);
	};

	const loadAllKeyshares = async () => {
		try {
			setLoading(true);
			addLog('🔍 Loading all keyshares...');
			
			// Use the same method as Home page to find keyshares
			const keyshareKeys = searchAllLocalStorageForKeyshares();
			addLog(`🔍 Found ${keyshareKeys.length} keyshare keys in localStorage`);
			
			const keyshareData = [];
			for (const key of keyshareKeys) {
				try {
					const raw = localStorage.getItem(key);
					if (raw) {
						const parsed = JSON.parse(raw);
						keyshareData.push({
							key,
							...parsed
						});
						addLog(`✅ Loaded keyshare: ${key}`);
					}
				} catch (error) {
					addLog(`⚠️ Failed to load keyshare ${key}: ${error.message}`);
				}
			}
			
			setKeyshares(keyshareData);
			addLog(`✅ Successfully loaded ${keyshareData.length} keyshares`);
		} catch (error) {
			addLog(`❌ Failed to load keyshares: ${error.message}`);
		} finally {
			setLoading(false);
		}
	};

	const loadRelayerConfig = () => {
		const cfg = sdkService.getRelayerConfig();
		setRelayerUrl(cfg.relayerUrl || 'http://localhost:3000');
		setWsUrl(cfg.websocketUrl || 'ws://localhost:3000');
		addLog(`⚙️ Loaded relayer config: ${cfg.relayerUrl} / ${cfg.websocketUrl}`);
	};

	const saveRelayerConfig = async () => {
		setSaving(true);
		try {
			addLog(`⚙️ Applying relayer config: ${relayerUrl} / ${wsUrl}`);
			await sdkService.setRelayerConfig({ relayerUrl, websocketUrl: wsUrl });
			addLog(`✅ Relayer config saved and SDK re-initialized`);
		} catch (error) {
			addLog(`❌ Failed to apply relayer config: ${error.message}`);
		} finally {
			setSaving(false);
		}
	};

	const testRelayer = async () => {
		setTesting(true);
		setHealthStatus(null);
		try {
			// Use the current relayer URL from the input field
			const res = await sdkService.testRelayerHealth(relayerUrl);
			setHealthStatus(res);
			addLog(`🧪 Health check ${res.ok ? 'OK' : 'FAILED'} (status ${res.status || 'n/a'})`);
		} catch (e) {
			addLog(`❌ Health check error: ${e.message}`);
		} finally {
			setTesting(false);
		}
	};

	const deleteKeyshare = async (key) => {
		try {
			localStorage.removeItem(key);
			addLog(`🗑️ Deleted keyshare: ${key}`);
			// Reload the list
			await loadAllKeyshares();
		} catch (error) {
			addLog(`❌ Failed to delete keyshare: ${error.message}`);
		}
	};

	const clearAllKeyshares = async () => {
		const keyshareKeys = searchAllLocalStorageForKeyshares();
		if (keyshareKeys.length === 0) {
			addLog('ℹ️ No keyshares to clear');
			return;
		}

		const confirmed = window.confirm(
			`Are you sure you want to delete ALL ${keyshareKeys.length} keyshares?\n\n` +
			'This action cannot be undone and will permanently remove all keyshares from your browser storage.'
		);

		if (!confirmed) {
			addLog('❌ Clear all keyshares cancelled by user');
			return;
		}

		try {
			let deletedCount = 0;
			for (const key of keyshareKeys) {
				localStorage.removeItem(key);
				deletedCount++;
				addLog(`🗑️ Deleted keyshare: ${key}`);
			}
			
			addLog(`✅ Successfully deleted ${deletedCount} keyshares`);
			// Reload the list (should be empty now)
			await loadAllKeyshares();
		} catch (error) {
			addLog(`❌ Failed to clear all keyshares: ${error.message}`);
		}
	};

	const viewKeyshareDetails = (keyshare) => {
		setSelectedKeyshare(keyshare);
		addLog(`📋 Viewing details for keyshare: ${keyshare.key}`);
	};

	const closeKeyshareDetails = () => {
		setSelectedKeyshare(null);
	};

	useEffect(() => {
		loadAllKeyshares();
		loadRelayerConfig();
	}, [loadAllKeyshares, loadRelayerConfig]);

	return (
		<div className="settings-container">
			<Header 
				title="DeFiShard SDK Settings"
				subtitle="Manage keyshares and configuration"
			/>

			<div className="settings-content">
				{/* Relayer Configuration Section */}
				<div className="relayer-config-section">
					<div className="section-header">
						<div className="section-header-left">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M12 8v8m-4-4h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
							</svg>
							<h3>Relayer Configuration</h3>
						</div>
						<div className="section-header-actions">
							<button className="refresh-btn" onClick={loadRelayerConfig} disabled={loading}>Reload</button>
							<button className="clear-all-btn" onClick={saveRelayerConfig} disabled={loading || saving}>
								{saving ? (
									<>
										<span className="loading-spinner"></span>
										Saving...
									</>
								) : (
									'Save'
								)}
							</button>
							<button className="test-btn" onClick={testRelayer} disabled={testing}>
								{testing ? (
									<>
										<span className="loading-spinner"></span>
										Testing...
									</>
								) : (
									'Test'
								)}
							</button>
						</div>
					</div>

					<div className="relayer-grid">
						<label>Relayer URL</label>
						<input
							type="text"
							value={relayerUrl}
							onChange={e => setRelayerUrl(e.target.value)}
							placeholder="http://localhost:3000"
						/>
						<label>WebSocket URL</label>
						<input
							type="text"
							value={wsUrl}
							onChange={e => setWsUrl(e.target.value)}
							placeholder="ws://localhost:3000"
						/>
					</div>

					{healthStatus && (
						<div className={`health-status ${healthStatus.ok ? 'ok' : 'fail'}`}>
							Health: {healthStatus.ok ? 'OK' : 'FAIL'} {healthStatus.status ? `(HTTP ${healthStatus.status})` : ''}
							{healthStatus.error && <div className="error">{healthStatus.error}</div>}
						</div>
					)}
				</div>
				{/* Keyshare Management Section */}
				<div className="keyshare-management-section">
					<div className="section-header">
						<div className="section-header-left">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
							</svg>
							<h3>Keyshare Management</h3>
						</div>
						<div className="section-header-actions">
							<button 
								className="refresh-btn" 
								onClick={loadAllKeyshares}
								disabled={loading}
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M1 4v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
									<path d="M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
									<path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
								</svg>
								Refresh
							</button>
							<button 
								className="clear-all-btn" 
								onClick={clearAllKeyshares}
								disabled={loading || keyshares.length === 0}
								title="Delete all keyshares"
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
									<polyline points="3,6 5,6 21,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
									<path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
									<line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
									<line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
								</svg>
								Clear All
							</button>
						</div>
					</div>

					{loading ? (
						<div className="loading-state">
							<div className="loading-spinner"></div>
							<p>Loading keyshares...</p>
						</div>
					) : keyshares.length === 0 ? (
						<div className="no-keyshares-state">
							<div className="no-keyshares-icon">📭</div>
							<p>No keyshares found</p>
							<small>Generate or import keyshares to see them here</small>
						</div>
					) : (
						<div className="keyshares-grid">
							{keyshares.map((keyshare, index) => (
								<div key={index} className="keyshare-card">
									<div className="keyshare-header">
										<div className="keyshare-info">
											<h4>Keyshare {index + 1}</h4>
											<p className="keyshare-key" title={keyshare.key}>
												{formatLongIdWithTooltip(keyshare.key, 24).text}
											</p>
										</div>
										<div className="keyshare-actions">
											<button 
												className="view-btn"
												onClick={() => viewKeyshareDetails(keyshare)}
												title="View Details"
											>
												<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
													<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
													<circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
												</svg>
											</button>
											<button 
												className="delete-btn"
												onClick={() => deleteKeyshare(keyshare.key)}
												title="Delete Keyshare"
											>
												<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
													<polyline points="3,6 5,6 21,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
													<path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
												</svg>
											</button>
										</div>
									</div>
									<div className="keyshare-summary">
										<div className="summary-item">
											<label>Party ID:</label>
											<span title={keyshare.partyId}>
												{formatLongIdWithTooltip(keyshare.partyId, 16).text}
											</span>
										</div>
										<div className="summary-item">
											<label>Group ID:</label>
											<span title={keyshare.groupId}>
												{formatLongIdWithTooltip(keyshare.groupId, 16).text}
											</span>
										</div>
										<div className="summary-item">
											<label>Threshold:</label>
											<span>{keyshare.threshold}-of-{keyshare.totalParties}</span>
										</div>
										<div className="summary-item">
											<label>API Key:</label>
											<span className={keyshare.apiKey ? 'has-api-key' : 'no-api-key'}>
												{keyshare.apiKey ? 'Set' : 'Not Set'}
											</span>
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Keyshare Details Modal */}
				{selectedKeyshare && (
					<div className="modal-overlay" onClick={closeKeyshareDetails}>
						<div className="modal-content" onClick={(e) => e.stopPropagation()}>
							<div className="modal-header">
								<h3>Keyshare Details</h3>
								<button className="close-btn" onClick={closeKeyshareDetails}>
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
										<line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
										<line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
									</svg>
								</button>
							</div>
							<div className="modal-body">
								<div className="detail-grid">
									<div className="detail-item">
										<label>Storage Key:</label>
										<div className="detail-value">
											<span className="formatted-id" title={selectedKeyshare.key}>
												{formatLongIdWithTooltip(selectedKeyshare.key, 32).text}
											</span>
											<button 
												className="copy-btn-small"
												onClick={() => copyToClipboard(selectedKeyshare.key, 'Storage Key')}
											>
												<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
													<rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
													<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2"/>
												</svg>
											</button>
										</div>
									</div>
									<div className="detail-item">
										<label>Party ID:</label>
										<div className="detail-value">
											<span className="formatted-id" title={selectedKeyshare.partyId}>
												{formatLongIdWithTooltip(selectedKeyshare.partyId, 32).text}
											</span>
											<button 
												className="copy-btn-small"
												onClick={() => copyToClipboard(selectedKeyshare.partyId, 'Party ID')}
											>
												<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
													<rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
													<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2"/>
												</svg>
											</button>
										</div>
									</div>
									<div className="detail-item">
										<label>Group ID:</label>
										<div className="detail-value">
											<span className="formatted-id" title={selectedKeyshare.groupId}>
												{formatLongIdWithTooltip(selectedKeyshare.groupId, 32).text}
											</span>
											<button 
												className="copy-btn-small"
												onClick={() => copyToClipboard(selectedKeyshare.groupId, 'Group ID')}
											>
												<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
													<rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
													<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2"/>
												</svg>
											</button>
										</div>
									</div>
									<div className="detail-item">
										<label>Threshold:</label>
										<span>{selectedKeyshare.threshold}-of-{selectedKeyshare.totalParties}</span>
									</div>
									<div className="detail-item">
										<label>Total Parties:</label>
										<span>{selectedKeyshare.totalParties}</span>
									</div>
									<div className="detail-item">
										<label>API Key:</label>
										<div className="detail-value">
											{selectedKeyshare.apiKey ? (
												<>
													<span className="formatted-id" title={selectedKeyshare.apiKey}>
														{formatLongIdWithTooltip(selectedKeyshare.apiKey, 32).text}
													</span>
													<button 
														className="copy-btn-small"
														onClick={() => copyToClipboard(selectedKeyshare.apiKey, 'API Key')}
													>
														<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
															<rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
															<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2"/>
														</svg>
													</button>
												</>
											) : (
												<span className="no-api-key">Not Set</span>
											)}
										</div>
									</div>
									{selectedKeyshare.publicKey && (
										<div className="detail-item">
											<label>Public Key:</label>
											<div className="detail-value">
												<span className="formatted-id" title={selectedKeyshare.publicKey}>
													{formatLongIdWithTooltip(selectedKeyshare.publicKey, 32).text}
												</span>
												<button 
													className="copy-btn-small"
													onClick={() => copyToClipboard(selectedKeyshare.publicKey, 'Public Key')}
												>
													<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
														<rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
														<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2"/>
													</svg>
												</button>
											</div>
										</div>
									)}
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
						<button 
							className="clear-btn" 
							onClick={() => setLogs([])}
							disabled={logs.length === 0}
						>
							Clear Logs
						</button>
					</div>
					<div className="logs-container">
						{logs.length === 0 ? (
							<p className="no-logs">No activity logs yet</p>
						) : (
							logs.map((log, index) => (
								<div key={index} className="log-entry">
									{log}
								</div>
							))
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default Settings;
