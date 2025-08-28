/**
 * Main Popup Entry Point
 * Initializes the refactored popup application
 */
import { stateManager } from '../core/StateManager.js';
import { eventBus, EVENTS } from '../core/EventBus.js';
import { mpcService } from '../services/MPCService.js';
import { walletController } from '../controllers/WalletController.js';
import { signingController } from '../controllers/SigningController.js';
import { rotationController } from '../controllers/RotationController.js';

class PopupApp {
    constructor() {
        this.isInitialized = false;
        this.currentView = 'welcome';
    }
    
    async initialize() {
        try {
            console.log('🚀 Initializing DeFiShArd Extension...');
            
            // Load persisted state
            await stateManager.loadState();
            
            // Initialize services
            await this.initializeServices();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize UI
            this.initializeUI();
            
            // Check initial state
            this.checkInitialState();
            
            this.isInitialized = true;
            console.log('✅ Extension initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize extension:', error);
            this.showError('Failed to initialize extension: ' + error.message);
        }
    }
    
    async initializeServices() {
        // Get configuration
        const config = await this.loadConfiguration();
        
        // Initialize MPC service
        try {
            await mpcService.initialize(config);
        } catch (error) {
            console.warn('⚠️ MPC service initialization failed:', error);
            // Continue with offline mode
        }
    }
    
    setupEventListeners() {
        // State change listeners
        stateManager.subscribe('currentView', (view) => {
            this.navigateToView(view);
        });
        
        stateManager.subscribe('loading', (loading) => {
            this.updateLoadingState(loading);
        });
        
        stateManager.subscribe('error', (error) => {
            if (error) {
                this.showError(error);
            }
        });
        
        // Wallet events
        eventBus.on(EVENTS.WALLET_CREATED, (wallet) => {
            this.onWalletCreated(wallet);
        });
        
        eventBus.on(EVENTS.WALLET_SELECTED, (wallet) => {
            this.onWalletSelected(wallet);
        });
        
        // Progress events
        eventBus.on(EVENTS.KEYGEN_PROGRESS, (progress) => {
            this.updateProgress('keygen', progress);
        });
        
        eventBus.on(EVENTS.SIGNING_PROGRESS, (progress) => {
            this.updateProgress('signing', progress);
        });
        
        eventBus.on(EVENTS.ROTATION_PROGRESS, (progress) => {
            this.updateProgress('rotation', progress);
        });
        
        // Notification events
        eventBus.on(EVENTS.NOTIFICATION_SHOWN, (notification) => {
            this.showNotification(notification);
        });
    }
    
    initializeUI() {
        // Set up navigation
        this.setupNavigation();
        
        // Set up forms
        this.setupForms();
        
        // Set up action buttons
        this.setupActionButtons();
        
        // Initialize components
        this.initializeComponents();
    }
    
    checkInitialState() {
        const wallets = stateManager.getState('wallets');
        const activeWallet = stateManager.getState('activeWallet');
        
        if (wallets && wallets.length > 0) {
            // Show wallet list
            stateManager.setState('currentView', 'wallet-list');
        } else {
            // Show welcome screen
            stateManager.setState('currentView', 'welcome');
        }
    }
    
    // UI Event Handlers
    
    setupNavigation() {
        // Welcome screen buttons
        document.getElementById('create-wallet-btn')?.addEventListener('click', () => {
            stateManager.setState('currentView', 'create-wallet');
        });
        
        document.getElementById('join-wallet-btn')?.addEventListener('click', () => {
            stateManager.setState('currentView', 'join-wallet');
        });
        
        // Back buttons
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.navigateBack();
            });
        });
        
        // Settings button
        document.getElementById('settings-btn')?.addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });
    }
    
    setupForms() {
        // Create wallet form
        const createForm = document.getElementById('create-wallet-form');
        if (createForm) {
            createForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleCreateWallet(new FormData(createForm));
            });
        }
        
        // Join wallet form
        const joinForm = document.getElementById('join-wallet-form');
        if (joinForm) {
            joinForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleJoinWallet(new FormData(joinForm));
            });
        }
        
        // Sign message form
        const signForm = document.getElementById('sign-message-form');
        if (signForm) {
            signForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleSignMessage(new FormData(signForm));
            });
        }
    }
    
    setupActionButtons() {
        // Wallet actions
        document.getElementById('rotate-keys-btn')?.addEventListener('click', async () => {
            const activeWallet = stateManager.getState('activeWallet');
            if (activeWallet) {
                await this.handleKeyRotation(activeWallet.id);
            }
        });
        
        // Emergency rotation
        document.getElementById('emergency-rotate-btn')?.addEventListener('click', async () => {
            const activeWallet = stateManager.getState('activeWallet');
            if (activeWallet) {
                await this.handleEmergencyRotation(activeWallet.id);
            }
        });
    }
    
    // Form Handlers
    
    async handleCreateWallet(formData) {
        try {
            const options = {
                name: formData.get('wallet-name'),
                threshold: parseInt(formData.get('threshold')),
                totalParties: parseInt(formData.get('total-parties')),
                timeoutMinutes: parseInt(formData.get('timeout')) || 60
            };
            
            const groupInfo = await walletController.createWallet(options);
            
            // Show QR code for others to join
            this.showGroupQRCode(groupInfo);
            
        } catch (error) {
            this.showError('Failed to create wallet: ' + error.message);
        }
    }
    
    async handleJoinWallet(formData) {
        try {
            const invitationData = formData.get('invitation-data');
            
            const groupInfo = await walletController.joinWallet(invitationData);
            
            // Show joining status
            stateManager.setState('currentView', 'joining');
            
        } catch (error) {
            this.showError('Failed to join wallet: ' + error.message);
        }
    }
    
    async handleSignMessage(formData) {
        try {
            const message = formData.get('message');
            const options = {
                format: formData.get('format') || 'text'
            };
            
            const result = await signingController.signMessage(message, options);
            
            this.showSigningResult(result);
            
        } catch (error) {
            this.showError('Failed to sign message: ' + error.message);
        }
    }
    
    async handleKeyRotation(walletId) {
        try {
            const result = await rotationController.rotateKeys(walletId, {
                reason: 'manual'
            });
            
            this.showRotationResult(result);
            
        } catch (error) {
            this.showError('Failed to rotate keys: ' + error.message);
        }
    }
    
    async handleEmergencyRotation(walletId) {
        try {
            const reason = prompt('Please describe the security concern:');
            if (!reason) return;
            
            const result = await rotationController.rotateKeys(walletId, {
                reason: 'emergency',
                emergency: true,
                compromiseDetails: reason
            });
            
            this.showRotationResult(result);
            
        } catch (error) {
            this.showError('Failed to perform emergency rotation: ' + error.message);
        }
    }
    
    // UI Update Methods
    
    navigateToView(view) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        
        // Show target screen
        const targetScreen = document.getElementById(`${view}-screen`);
        if (targetScreen) {
            targetScreen.classList.remove('hidden');
            this.currentView = view;
        }
    }
    
    navigateBack() {
        // Simple back navigation logic
        const backMap = {
            'create-wallet': 'welcome',
            'join-wallet': 'welcome',
            'signing': 'wallet-list',
            'rotation': 'wallet-list'
        };
        
        const backView = backMap[this.currentView] || 'welcome';
        stateManager.setState('currentView', backView);
    }
    
    updateLoadingState(loading) {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = loading ? 'flex' : 'none';
        }
    }
    
    updateProgress(type, progress) {
        const progressBar = document.getElementById(`${type}-progress`);
        const progressText = document.getElementById(`${type}-progress-text`);
        
        if (progressBar) {
            progressBar.style.width = `${progress.percentage || 0}%`;
        }
        
        if (progressText) {
            progressText.textContent = progress.message || `${progress.percentage || 0}%`;
        }
    }
    
    showNotification(notification) {
        // Simple notification system
        const notificationEl = document.createElement('div');
        notificationEl.className = `notification notification-${notification.type}`;
        notificationEl.textContent = notification.message;
        
        document.body.appendChild(notificationEl);
        
        setTimeout(() => {
            notificationEl.remove();
        }, 5000);
    }
    
    showError(message) {
        this.showNotification({
            type: 'error',
            message
        });
    }
    
    // Event Handlers
    
    onWalletCreated(wallet) {
        // Update wallet list
        this.refreshWalletList();
        
        // Navigate to success screen
        stateManager.setState('currentView', 'wallet-created');
    }
    
    onWalletSelected(wallet) {
        // Update UI to show selected wallet
        this.refreshWalletList();
    }
    
    refreshWalletList() {
        const walletList = walletController.getWalletList();
        this.renderWalletList(walletList);
    }
    
    renderWalletList(wallets) {
        const container = document.getElementById('wallet-list-container');
        if (!container) return;
        
        container.innerHTML = wallets.map(wallet => `
            <div class="wallet-item ${wallet.isActive ? 'active' : ''}" data-wallet-id="${wallet.id}">
                <div class="wallet-info">
                    <h3>${wallet.name}</h3>
                    <p class="wallet-key">${wallet.formattedPublicKey}</p>
                    <p class="wallet-meta">${wallet.threshold}-of-${wallet.totalParties} • ${wallet.timeAgo}</p>
                </div>
                <div class="wallet-actions">
                    <button class="btn-secondary select-wallet-btn">Select</button>
                    <button class="btn-secondary wallet-menu-btn">⋮</button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners
        container.querySelectorAll('.select-wallet-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const walletId = e.target.closest('.wallet-item').dataset.walletId;
                walletController.selectWallet(walletId);
            });
        });
    }
    
    // Utility Methods
    
    async loadConfiguration() {
        // Load configuration from storage or use defaults
        return {
            relayerUrl: 'http://localhost:3000',
            websocketUrl: 'ws://localhost:3000',
            debug: false
        };
    }
    
    initializeComponents() {
        // Initialize any complex UI components
        // This could include QR code components, progress bars, etc.
    }
    
    showGroupQRCode(groupInfo) {
        // Display QR code for group joining
        stateManager.setState('currentView', 'group-qr');
        
        // Generate QR code with group information
        const qrData = JSON.stringify({
            groupId: groupInfo.groupId,
            threshold: groupInfo.threshold,
            totalParties: groupInfo.totalParties,
            relayerUrl: groupInfo.relayerUrl
        });
        
        // Use your existing QR code generation logic
        this.generateQRCode(qrData);
    }
    
    generateQRCode(data) {
        // Use the existing QR code generation from the refactored code
        const qrContainer = document.getElementById('qr-container');
        if (!qrContainer) return;
        
        // Clear existing QR code
        qrContainer.innerHTML = '';
        
        if (typeof qrcode !== 'undefined') {
            const qr = qrcode(0, 'M');
            qr.addData(data);
            qr.make();
            
            // Create SVG QR code
            const moduleCount = qr.getModuleCount();
            const cellSize = 4;
            const margin = 20;
            const qrSize = moduleCount * cellSize + margin * 2;
            
            const qrSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            qrSvg.setAttribute('width', qrSize.toString());
            qrSvg.setAttribute('height', qrSize.toString());
            qrSvg.setAttribute('viewBox', `0 0 ${qrSize} ${qrSize}`);
            
            // Create background
            const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bg.setAttribute('width', qrSize.toString());
            bg.setAttribute('height', qrSize.toString());
            bg.setAttribute('fill', '#ffffff');
            qrSvg.appendChild(bg);
            
            // Create QR modules
            for (let row = 0; row < moduleCount; row++) {
                for (let col = 0; col < moduleCount; col++) {
                    if (qr.isDark(row, col)) {
                        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                        rect.setAttribute('x', (col * cellSize + margin).toString());
                        rect.setAttribute('y', (row * cellSize + margin).toString());
                        rect.setAttribute('width', cellSize.toString());
                        rect.setAttribute('height', cellSize.toString());
                        rect.setAttribute('fill', '#000000');
                        qrSvg.appendChild(rect);
                    }
                }
            }
            
            qrContainer.appendChild(qrSvg);
        }
    }
    
    showSigningResult(result) {
        // Display signing result
        const resultContainer = document.getElementById('signing-result');
        if (resultContainer) {
            resultContainer.innerHTML = `
                <h3>Message Signed Successfully</h3>
                <div class="signature-details">
                    <p><strong>Signature:</strong> ${result.signature}</p>
                    <p><strong>Public Key:</strong> ${result.publicKey}</p>
                    <p><strong>Timestamp:</strong> ${new Date(result.timestamp).toLocaleString()}</p>
                </div>
            `;
        }
        
        stateManager.setState('currentView', 'signing-result');
    }
    
    showRotationResult(result) {
        // Display rotation result
        const resultContainer = document.getElementById('rotation-result');
        if (resultContainer) {
            resultContainer.innerHTML = `
                <h3>Key Rotation Completed</h3>
                <div class="rotation-details">
                    <p><strong>New Wallet:</strong> ${result.name}</p>
                    <p><strong>New Public Key:</strong> ${result.publicKey}</p>
                    <p><strong>Rotation Time:</strong> ${new Date(result.created).toLocaleString()}</p>
                </div>
            `;
        }
        
        stateManager.setState('currentView', 'rotation-result');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new PopupApp();
    app.initialize();
});
