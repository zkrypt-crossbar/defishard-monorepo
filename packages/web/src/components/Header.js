import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Header = ({ title = 'DeFiShard SDK Test App', subtitle, showNavigation = true }) => {
	const navigate = useNavigate();
	const location = useLocation();

	const isActive = (path) => location.pathname === path;

	return (
		<div className="home-header">
			<div className="header-content">
				<div className="header-left">
					<div className="home-icon">
						<img src="/icons/defishard-logo.svg" alt="DeFiShard Logo" />
					</div>
					<div className="header-text">
						<h1>{title}</h1>
						{subtitle && <p className="home-subtitle">{subtitle}</p>}
					</div>
				</div>
				
				{showNavigation && (
					<div className="header-navigation">
						<button 
							className={`nav-btn ${isActive('/') ? 'active' : ''}`}
							onClick={() => navigate('/')}
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
								<polyline points="9,22 9,12 15,12 15,22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
							</svg>
							Home
						</button>
						<button 
							className={`nav-btn ${isActive('/keygen') ? 'active' : ''}`}
							onClick={() => navigate('/keygen')}
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
							</svg>
							Keygen
						</button>
						<button 
							className={`nav-btn ${isActive('/signing') ? 'active' : ''}`}
							onClick={() => navigate('/signing')}
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
							</svg>
							Sign
						</button>
						<button 
							className={`nav-btn ${isActive('/settings') ? 'active' : ''}`}
							onClick={() => navigate('/settings')}
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
								<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="2"/>
							</svg>
							Settings
						</button>
					</div>
				)}
			</div>
		</div>
	);
};

export default Header;
