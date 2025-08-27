import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import sdkService from '../services/sdk-service';
import { formatLongIdWithTooltip } from '../utils/formatUtils';
import { searchAllLocalStorageForKeyshares } from '../utils/keygenUtils';
import Header from './Header';

const Home = () => {
	const navigate = useNavigate();
	const [password, setPassword] = useState('');
	const [existingKeyshares, setExistingKeyshares] = useState([]);
	const [selectedKeyshare, setSelectedKeyshare] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		try {
			const keys = searchAllLocalStorageForKeyshares();
			setExistingKeyshares(keys);
			if (keys.length > 0) {
				setSelectedKeyshare(keys[0]);
			}
		} catch (_) {}
	}, []);

	const handleRunKeygen = () => {
		navigate('/keygen');
	};

	const handleLoadKeyshare = async () => {
		if (!selectedKeyshare) {
			setError('Please select a keyshare to load');
			return;
		}

		setLoading(true);
		setError('');
		try {
			if (password) {
				sdkService.setStoragePassword(password);
			}

			const actualKeyshareKey = selectedKeyshare.startsWith('defishard_') ? selectedKeyshare : `defishard_${selectedKeyshare}`;
			let raw = localStorage.getItem(actualKeyshareKey);
			if (!raw) raw = localStorage.getItem(selectedKeyshare);
			if (!raw) throw new Error('Keyshare not found in browser storage');

			const parsedKeyshare = JSON.parse(raw);
			sdkService.isInitialized = true;
			sdkService.isKeygenCompleted = true;
			sdkService.partyId = parsedKeyshare.partyId;
			sdkService.groupId = parsedKeyshare.groupId;
			if (sdkService.sdk && sdkService.sdk.config) {
				sdkService.sdk.config.partyId = parsedKeyshare.partyId;
				sdkService.sdk.config.groupId = parsedKeyshare.groupId;
			}
			navigate('/signing', { state: { keyshare: parsedKeyshare, keyshareKey: actualKeyshareKey } });
		} catch (e) {
			setError(e.message || 'Failed to load keyshare');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="home-container">
			<Header 
				title="DeFiShard SDK Test App" 
				subtitle="Web-based testing environment for DeFiShard MPC functionality with keyshare management and cryptographic operations."
			/>

			<div className="home-options">
				<div className="option-card">
					<div className="card-icon upload-icon"><img src="/icons/load.svg" alt="Load Keyshare" /></div>
					<h2>Load Keyshare</h2>
					<p>
						Load an existing MPC keyshare from your browser storage. Decrypt and initialize the keyshare for testing SDK operations.
					</p>
					<div className="features-list">
						<h4>Features:</h4>
						<ul>
							<li>Load from browser storage</li>
							<li>Password-based decryption</li>
							<li>Keyshare validation</li>
							<li>SDK initialization</li>
						</ul>
					</div>

					<div className="keyshare-selection">
						<h4>Select Keyshare:</h4>
						{existingKeyshares.length === 0 ? (
							<div className="no-keyshares-state">
								<div className="no-keyshares-icon">📭</div>
								<p>No keyshares found in storage</p>
								<small>Run keygen first to create a keyshare</small>
							</div>
						) : (
							<>
								<div className="dropdown-container">
									<select 
										value={selectedKeyshare} 
										onChange={(e) => setSelectedKeyshare(e.target.value)}
										className="keyshare-dropdown"
										disabled={loading}
									>
										{existingKeyshares.map((key, idx) => {
											const display = key.includes('defishard_') ? key.split('defishard_')[1] : key;
											return (
												<option key={idx} value={key}>
													{formatLongIdWithTooltip(display).text}
												</option>
											);
										})}
									</select>
									<div className="password-section">
										<input
											type="password"
											placeholder="Keyshare password (optional)"
											value={password}
											onChange={(e) => setPassword(e.target.value)}
											className="password-input"
											disabled={loading}
										/>
									</div>
									{error && <div className="error-message">{error}</div>}
								</div>
								<div className="card-cta">
									<button 
										className="load-keyshare-btn" 
										onClick={handleLoadKeyshare}
										disabled={loading || !selectedKeyshare}
									>
										{loading ? (
											<>
												<span className="loading-spinner"></span>
												Loading...
											</>
										) : (
											<>
																			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M3 15v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
								<polyline points="7,10 12,15 17,10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
								<line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
							</svg>
												Load Keyshare
											</>
										)}
									</button>
								</div>
							</>
						)}
					</div>

				</div>

				<div className="option-card">
					<div className="card-icon create-icon"><img src="/icons/create.svg" alt="Create Keyshare" /></div>
					<h2>Create New Keyshare</h2>
					<p>
						Generate a new MPC keyshare using the DeFiShard SDK. Perfect for testing keygen protocols and MPC operations.
					</p>
					<div className="features-list">
						<h4>Features:</h4>
						<ul>
							<li>MPC keygen</li>
							<li>Keyshare encryption</li>
							<li>Protocol testing</li>
						</ul>
					</div>
					<div className="card-cta">
						<button className="primary-btn" onClick={handleRunKeygen}>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
								<path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
								<path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
							</svg>
							Start Keygen
						</button>
					</div>
				</div>

			</div>

			<div className="info-section">
				<div className="info-icon">🔧</div>
				<div className="info-content">
					<h3>DeFiShard SDK Web Testing Environment</h3>
					<p>
						This web application provides a comprehensive testing environment for the DeFiShard SDK. 
						Use it to validate MPC protocols, test keyshare operations, and ensure proper integration 
						before deploying to production environments. All operations run locally in your browser.
					</p>
				</div>
			</div>
		</div>
	);
};

export default Home;
