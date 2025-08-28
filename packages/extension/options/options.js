/**
 * DeFiShArd Extension Options Page
 * Handles settings configuration and management
 */

class OptionsManager {
    constructor() {
        this.defaultSettings = {
            relayerUrl: 'http://localhost:3000',
            websocketUrl: 'ws://localhost:3000',
            apiKey: '',
            autoLockTimeout: 15,
            debugMode: false,
            theme: 'light'
        };
        
        this.currentSettings = { ...this.defaultSettings };
        this.initialize();
    }

    async initialize() {
        await this.loadSettings();
        this.setupEventListeners();
        this.updateUI();
        this.checkConnectionStatus();
        console.log('✅ Options page initialized');
    }

    async loadSettings() {
        try {
            const stored = await chrome.storage.local.get([
                'relayerUrl', 'websocketUrl', 'apiKey', 
                'autoLockTimeout', 'debugMode', 'theme'
            ]);
            
            // Merge with defaults
            this.currentSettings = { ...this.defaultSettings, ...stored };
            console.log('📂 Settings loaded:', this.currentSettings);
        } catch (error) {
            console.error('❌ Failed to load settings:', error);
            this.showMessage('Failed to load settings', 'error');
        }
    }

    async saveSettings() {
        try {
            // Get values from form
            const newSettings = {
                relayerUrl: document.getElementById('relayer-url').value.trim(),
                websocketUrl: document.getElementById('websocket-url').value.trim(),
                apiKey: document.getElementById('api-key').value.trim(),
                autoLockTimeout: parseInt(document.getElementById('auto-lock').value),
                debugMode: document.getElementById('debug-mode').checked,
                theme: document.getElementById('theme').value
            };

            // Validate URLs
            if (!this.validateUrl(newSettings.relayerUrl)) {
                throw new Error('Invalid relayer URL');
            }
            if (!this.validateUrl(newSettings.websocketUrl, true)) {
                throw new Error('Invalid WebSocket URL');
            }

            // Save to storage
            await chrome.storage.local.set(newSettings);
            this.currentSettings = newSettings;

            // Notify background script of settings change
            try {
                await chrome.runtime.sendMessage({
                    type: 'SETTINGS_UPDATED',
                    settings: newSettings
                });
            } catch (error) {
                console.warn('⚠️ Could not notify background script:', error);
            }

            this.showMessage('Settings saved successfully!', 'success');
            console.log('✅ Settings saved:', newSettings);
            
            // Recheck connection with new settings
            setTimeout(() => this.checkConnectionStatus(), 1000);
            
        } catch (error) {
            console.error('❌ Failed to save settings:', error);
            this.showMessage(`Failed to save settings: ${error.message}`, 'error');
        }
    }

    validateUrl(url, isWebSocket = false) {
        try {
            const urlObj = new URL(url);
            if (isWebSocket) {
                return urlObj.protocol === 'ws:' || urlObj.protocol === 'wss:';
            } else {
                return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
            }
        } catch {
            return false;
        }
    }

    updateUI() {
        // Update form fields with current settings
        document.getElementById('relayer-url').value = this.currentSettings.relayerUrl;
        document.getElementById('websocket-url').value = this.currentSettings.websocketUrl;
        document.getElementById('api-key').value = this.currentSettings.apiKey;
        document.getElementById('auto-lock').value = this.currentSettings.autoLockTimeout;
        document.getElementById('debug-mode').checked = this.currentSettings.debugMode;
        document.getElementById('theme').value = this.currentSettings.theme;

        // Update extension version
        const manifest = chrome.runtime.getManifest();
        document.getElementById('extension-version').textContent = manifest.version;

        // Calculate storage usage
        this.updateStorageUsage();
    }

    async updateStorageUsage() {
        try {
            const usage = await chrome.storage.local.getBytesInUse();
            const usageKB = (usage / 1024).toFixed(2);
            document.getElementById('storage-usage').textContent = `${usageKB} KB`;
        } catch (error) {
            document.getElementById('storage-usage').textContent = 'Unknown';
        }
    }

    async checkConnectionStatus() {
        const statusEl = document.getElementById('connection-status');
        statusEl.textContent = 'Checking...';
        statusEl.className = 'status-checking';

        try {
            // Test connection to relayer with multiple endpoints
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            // Try multiple endpoints to check server health
            const endpoints = ['/health', '/status', '/'];
            let lastError;
            
            for (const endpoint of endpoints) {
                try {
                    const response = await fetch(`${this.currentSettings.relayerUrl}${endpoint}`, {
                        method: 'GET',
                        signal: controller.signal,
                        headers: {
                            'Accept': 'application/json, text/plain, */*'
                        }
                    });
                    
                    clearTimeout(timeoutId);

                    if (response.ok) {
                        // Try to get server info if possible
                        let serverInfo = '';
                        try {
                            const data = await response.json();
                            if (data.version) serverInfo = ` (v${data.version})`;
                            if (data.status === 'healthy') serverInfo += ' ✓';
                        } catch {
                            // Not JSON, that's fine
                        }
                        
                        statusEl.textContent = `Connected${serverInfo}`;
                        statusEl.className = 'status-connected';
                        return;
                    } else {
                        lastError = `HTTP ${response.status}`;
                    }
                } catch (err) {
                    lastError = err;
                    continue; // Try next endpoint
                }
            }
            
            // All endpoints failed
            throw lastError;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                statusEl.textContent = 'Timeout (8s)';
            } else if (typeof error === 'string') {
                statusEl.textContent = error;
            } else {
                statusEl.textContent = 'Disconnected';
            }
            statusEl.className = 'status-disconnected';
            console.log('Connection check failed:', error);
        }
    }

    resetSettings() {
        if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
            this.currentSettings = { ...this.defaultSettings };
            this.updateUI();
            this.showMessage('Settings reset to defaults', 'info');
        }
    }

    async clearAllData() {
        if (confirm('Are you sure you want to clear ALL extension data? This will remove all wallets, settings, and stored information. This cannot be undone.')) {
            if (confirm('This action is irreversible. Are you absolutely sure?')) {
                try {
                    await chrome.storage.local.clear();
                    this.showMessage('All data cleared successfully', 'success');
                    
                    // Reset to defaults
                    this.currentSettings = { ...this.defaultSettings };
                    this.updateUI();
                    
                } catch (error) {
                    console.error('❌ Failed to clear data:', error);
                    this.showMessage(`Failed to clear data: ${error.message}`, 'error');
                }
            }
        }
    }

    async exportData() {
        try {
            const allData = await chrome.storage.local.get();
            const exportData = {
                timestamp: new Date().toISOString(),
                version: chrome.runtime.getManifest().version,
                data: allData
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `defishard-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showMessage('Data exported successfully', 'success');
        } catch (error) {
            console.error('❌ Export failed:', error);
            this.showMessage(`Export failed: ${error.message}`, 'error');
        }
    }

    importData() {
        const input = document.getElementById('import-file-input');
        input.click();
    }

    async handleImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importData = JSON.parse(text);

            if (!importData.data || typeof importData.data !== 'object') {
                throw new Error('Invalid backup file format');
            }

            if (confirm('This will overwrite your current settings and data. Continue?')) {
                await chrome.storage.local.clear();
                await chrome.storage.local.set(importData.data);
                
                await this.loadSettings();
                this.updateUI();
                
                this.showMessage('Data imported successfully', 'success');
            }
        } catch (error) {
            console.error('❌ Import failed:', error);
            this.showMessage(`Import failed: ${error.message}`, 'error');
        }

        // Clear the input
        event.target.value = '';
    }

    setupEventListeners() {
        // Save settings button
        document.getElementById('save-settings-btn').addEventListener('click', () => {
            this.saveSettings();
        });

        // Reset settings button
        document.getElementById('reset-settings-btn').addEventListener('click', () => {
            this.resetSettings();
        });

        // Clear data button
        document.getElementById('clear-data-btn').addEventListener('click', () => {
            this.clearAllData();
        });

        // Export data button
        document.getElementById('export-data-btn').addEventListener('click', () => {
            this.exportData();
        });

        // Import data button
        document.getElementById('import-data-btn').addEventListener('click', () => {
            this.importData();
        });

        // Import file input
        document.getElementById('import-file-input').addEventListener('change', (e) => {
            this.handleImportFile(e);
        });

        // Auto-save on URL changes
        document.getElementById('relayer-url').addEventListener('blur', () => {
            this.autoSaveUrls();
        });
        
        document.getElementById('websocket-url').addEventListener('blur', () => {
            this.autoSaveUrls();
        });

        // Test connection button (add if needed)
        const testBtn = document.createElement('button');
        testBtn.className = 'btn btn-secondary';
        testBtn.textContent = 'Test Connection';
        testBtn.onclick = () => this.checkConnectionStatus();
        
        // Add test button after websocket URL field
        const websocketGroup = document.getElementById('websocket-url').parentNode;
        websocketGroup.appendChild(testBtn);

        // Setup preset buttons
        document.querySelectorAll('.btn-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const relayerUrl = btn.getAttribute('data-relayer');
                const wsUrl = btn.getAttribute('data-ws');
                
                document.getElementById('relayer-url').value = relayerUrl;
                document.getElementById('websocket-url').value = wsUrl;
                
                // Auto-save the preset
                this.currentSettings.relayerUrl = relayerUrl;
                this.currentSettings.websocketUrl = wsUrl;
                chrome.storage.local.set({
                    relayerUrl: relayerUrl,
                    websocketUrl: wsUrl
                });
                
                this.showMessage(`Switched to ${btn.textContent} server`, 'info');
                
                // Test connection after switching
                setTimeout(() => this.checkConnectionStatus(), 500);
            });
        });
    }

    async autoSaveUrls() {
        const relayerUrl = document.getElementById('relayer-url').value.trim();
        const websocketUrl = document.getElementById('websocket-url').value.trim();
        
        if (relayerUrl && this.validateUrl(relayerUrl)) {
            await chrome.storage.local.set({ relayerUrl });
            this.currentSettings.relayerUrl = relayerUrl;
        }
        
        if (websocketUrl && this.validateUrl(websocketUrl, true)) {
            await chrome.storage.local.set({ websocketUrl });
            this.currentSettings.websocketUrl = websocketUrl;
        }
    }

    showMessage(text, type = 'info') {
        // Remove existing messages
        const existingMsg = document.querySelector('.message');
        if (existingMsg) {
            existingMsg.remove();
        }

        // Create new message
        const message = document.createElement('div');
        message.className = `message message-${type}`;
        message.textContent = text;

        // Insert at top of main content
        const main = document.querySelector('.options-main');
        main.insertBefore(message, main.firstChild);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (message.parentNode) {
                message.remove();
            }
        }, 5000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new OptionsManager();
});
