import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './components/Home';
import Keygen from './components/Keygen';
import Sign from './components/Sign';
import Settings from './components/Settings';
import './styles.css';

function App() {
  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <div className="app">
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/keygen" element={<Keygen />} />
            <Route path="/signing" element={<Sign />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/rotation" element={<div className="rotation-placeholder"><h2>🔄 Key Rotation</h2><p>Key rotation functionality will be implemented here...</p></div>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        
        <footer className="app-footer">
          <p>DeFiShArd SDK Web Application - For testing and development purposes</p>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
