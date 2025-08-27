/**
 * DeFiShArd Extension Content Script
 * Handles web page integration and signing requests
 */

class DeFiShArdContentScript {
    constructor() {
        this.isInitialized = false;
        this.currentWallet = null;
        this.signingRequests = new Map();
        this.injectionPoint = null;
        
        this.initialize();
    }

    async initialize() {
        try {
            // Wait for page to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setup());
            } else {
                this.setup();
            }
        } catch (error) {
            console.error('Content script initialization failed:', error);
        }
    }

    setup() {
        this.setupMessageListener();
        this.setupPageIntegration();
        this.injectWalletProvider();
        this.isInitialized = true;
        
        console.log('DeFiShArd content script initialized');
    }

    setupMessageListener() {
        // Listen for messages from background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async response
        });
    }

    setupPageIntegration() {
        // Check if this is a web3-enabled page
        if (this.isWeb3Page()) {
            this.injectWeb3Integration();
        }
    }

    isWeb3Page() {
        const web3Indicators = [
            'ethereum',
            'web3',
            'metamask',
            'walletconnect',
            'uniswap',
            'opensea',
            'dapp'
        ];
        
        const pageText = document.body.innerText.toLowerCase();
        const pageUrl = window.location.href.toLowerCase();
        
        return web3Indicators.some(indicator => 
            pageText.includes(indicator) || pageUrl.includes(indicator)
        );
    }

    injectWeb3Integration() {
        // Create floating wallet button
        this.createFloatingWalletButton();
        
        // Listen for transaction requests
        this.listenForTransactionRequests();
    }

    createFloatingWalletButton() {
        const button = document.createElement('div');
        button.id = 'defishard-wallet-button';
        
        const iconDiv = document.createElement('div');
        iconDiv.className = 'defishard-wallet-icon';
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '24');
        svg.setAttribute('height', '24');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        
        const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path1.setAttribute('d', 'M12 2L2 7l10 5 10-5-10-5z');
        path1.setAttribute('stroke', 'currentColor');
        path1.setAttribute('stroke-width', '2');
        path1.setAttribute('stroke-linecap', 'round');
        path1.setAttribute('stroke-linejoin', 'round');
        
        const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path2.setAttribute('d', 'M2 17l10 5 10-5');
        path2.setAttribute('stroke', 'currentColor');
        path2.setAttribute('stroke-width', '2');
        path2.setAttribute('stroke-linecap', 'round');
        path2.setAttribute('stroke-linejoin', 'round');
        
        const path3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path3.setAttribute('d', 'M2 12l10 5 10-5');
        path3.setAttribute('stroke', 'currentColor');
        path3.setAttribute('stroke-width', '2');
        path3.setAttribute('stroke-linecap', 'round');
        path3.setAttribute('stroke-linejoin', 'round');
        
        svg.appendChild(path1);
        svg.appendChild(path2);
        svg.appendChild(path3);
        iconDiv.appendChild(svg);
        button.appendChild(iconDiv);
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #defishard-wallet-button {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 56px;
                height: 56px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 50%;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                cursor: pointer;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
                border: 2px solid white;
            }
            
            #defishard-wallet-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
            }
            
            #defishard-wallet-button .defishard-wallet-icon {
                color: white;
            }
            
            .defishard-signing-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .defishard-signing-content {
                background: white;
                border-radius: 12px;
                padding: 24px;
                max-width: 400px;
                width: 90%;
                text-align: center;
            }
            
            .defishard-signing-title {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 16px;
                color: #1a1a1a;
            }
            
            .defishard-signing-description {
                font-size: 14px;
                color: #666;
                margin-bottom: 20px;
                line-height: 1.5;
            }
            
            .defishard-signing-buttons {
                display: flex;
                gap: 12px;
                justify-content: center;
            }
            
            .defishard-btn {
                padding: 10px 20px;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .defishard-btn-primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            .defishard-btn-secondary {
                background: #f0f0f0;
                color: #666;
            }
            
            .defishard-btn:hover {
                transform: translateY(-1px);
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(button);
        
        // Add click handler
        button.addEventListener('click', () => {
            this.showWalletInterface();
        });
    }

    injectWalletProvider() {
        // Create DeFiShArd provider object directly in the page context
        // This avoids CSP violations by not using inline scripts
        
        // Create the provider object
        const provider = {
            isDeFiShArd: true,
            version: '1.0.0',
            
            request: async (request) => {
                return new Promise((resolve, reject) => {
                    const requestId = Date.now() + Math.random();
                    
                    // Send request to content script
                    window.postMessage({
                        type: 'DEFISHARD_REQUEST',
                        request: request,
                        id: requestId
                    }, '*');
                    
                    const handler = (event) => {
                        if (event.data.type === 'DEFISHARD_RESPONSE' && 
                            event.data.id === requestId) {
                            window.removeEventListener('message', handler);
                            if (event.data.error) {
                                reject(new Error(event.data.error));
                            } else {
                                resolve(event.data.result);
                            }
                        }
                    };
                    
                    window.addEventListener('message', handler);
                });
            },
            
            on: (eventName, callback) => {
                // Handle provider events
                console.log('DeFiShArd provider event:', eventName);
            },
            
            removeListener: (eventName, callback) => {
                // Remove event listeners
                console.log('DeFiShArd provider remove listener:', eventName);
            }
        };
        
        // Inject the provider into the page's window object
        // Use Object.defineProperty to avoid CSP issues
        Object.defineProperty(window, 'DeFiShArdProvider', {
            value: provider,
            writable: false,
            configurable: false
        });
        
        // Inject into window.ethereum if available
        if (window.ethereum) {
            window.ethereum.providers = window.ethereum.providers || [];
            window.ethereum.providers.push(provider);
        }
        
        console.log('DeFiShArd wallet provider injected successfully');
    }

    listenForTransactionRequests() {
        // Listen for transaction signing requests
        window.addEventListener('message', (event) => {
            if (event.data.type === 'DEFISHARD_REQUEST') {
                this.handleWalletRequest(event.data);
            }
        });
        
        // Listen for MetaMask-style requests
        window.addEventListener('ethereum#request', (event) => {
            this.handleEthereumRequest(event.detail);
        });
    }

    async handleWalletRequest(data) {
        const { request, id } = data;
        
        try {
            let result;
            
            switch (request.method) {
                case 'eth_requestAccounts':
                    result = await this.requestAccounts();
                    break;
                    
                case 'eth_accounts':
                    result = await this.getAccounts();
                    break;
                    
                case 'eth_sendTransaction':
                    result = await this.sendTransaction(request.params[0]);
                    break;
                    
                case 'personal_sign':
                    result = await this.personalSign(request.params[0], request.params[1]);
                    break;
                    
                case 'eth_signTypedData':
                    result = await this.signTypedData(request.params[0], request.params[1]);
                    break;
                    
                default:
                    throw new Error(`Unsupported method: ${request.method}`);
            }
            
            this.sendResponse(id, { result });
        } catch (error) {
            this.sendResponse(id, { error: error.message });
        }
    }

    async requestAccounts() {
        // Check if wallet is available
        const wallets = await this.getWallets();
        if (wallets.length === 0) {
            throw new Error('No DeFiShArd wallet found. Please create a wallet first.');
        }
        
        // Return the first wallet's address
        return [wallets[0].address];
    }

    async getAccounts() {
        const wallets = await this.getWallets();
        return wallets.map(wallet => wallet.address);
    }

    async sendTransaction(transaction) {
        const requestId = Date.now() + Math.random();
        
        // Show signing modal
        const modal = this.showSigningModal(
            'Sign Transaction',
            `Sign transaction to ${transaction.to || 'Unknown'}`,
            requestId
        );
        
        // Store request
        this.signingRequests.set(requestId, {
            type: 'transaction',
            transaction: transaction,
            modal: modal
        });
        
        // Send to background script
        const response = await chrome.runtime.sendMessage({
            type: 'SIGN_TRANSACTION',
            data: {
                requestId: requestId,
                transaction: transaction
            }
        });
        
        if (response.error) {
            throw new Error(response.error);
        }
        
        return response.signature;
    }

    async personalSign(message, address) {
        const requestId = Date.now() + Math.random();
        
        // Show signing modal
        const modal = this.showSigningModal(
            'Sign Message',
            `Sign message: ${message}`,
            requestId
        );
        
        // Store request
        this.signingRequests.set(requestId, {
            type: 'message',
            message: message,
            address: address,
            modal: modal
        });
        
        // Send to background script
        const response = await chrome.runtime.sendMessage({
            type: 'SIGN_MESSAGE',
            data: {
                requestId: requestId,
                message: message,
                address: address
            }
        });
        
        if (response.error) {
            throw new Error(response.error);
        }
        
        return response.signature;
    }

    async signTypedData(address, typedData) {
        const requestId = Date.now() + Math.random();
        
        // Show signing modal
        const modal = this.showSigningModal(
            'Sign Typed Data',
            `Sign typed data for ${address}`,
            requestId
        );
        
        // Store request
        this.signingRequests.set(requestId, {
            type: 'typedData',
            typedData: typedData,
            address: address,
            modal: modal
        });
        
        // Send to background script
        const response = await chrome.runtime.sendMessage({
            type: 'SIGN_TYPED_DATA',
            data: {
                requestId: requestId,
                typedData: typedData,
                address: address
            }
        });
        
        if (response.error) {
            throw new Error(response.error);
        }
        
        return response.signature;
    }

    showSigningModal(title, description, requestId) {
        const modal = document.createElement('div');
        modal.className = 'defishard-signing-modal';
        const content = document.createElement('div');
        content.className = 'defishard-signing-content';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'defishard-signing-title';
        titleDiv.textContent = title;
        
        const descriptionDiv = document.createElement('div');
        descriptionDiv.className = 'defishard-signing-description';
        descriptionDiv.textContent = description;
        
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'defishard-signing-buttons';
        
        const approveButton = document.createElement('button');
        approveButton.className = 'defishard-btn defishard-btn-primary';
        approveButton.textContent = 'Approve';
        approveButton.addEventListener('click', () => this.approveRequest(requestId));
        
        const rejectButton = document.createElement('button');
        rejectButton.className = 'defishard-btn defishard-btn-secondary';
        rejectButton.textContent = 'Reject';
        rejectButton.addEventListener('click', () => this.rejectRequest(requestId));
        
        buttonsDiv.appendChild(approveButton);
        buttonsDiv.appendChild(rejectButton);
        
        content.appendChild(titleDiv);
        content.appendChild(descriptionDiv);
        content.appendChild(buttonsDiv);
        modal.appendChild(content);
        
        document.body.appendChild(modal);
        
        return modal;
    }

    async approveRequest(requestId) {
        const request = this.signingRequests.get(requestId);
        if (!request) return;
        
        try {
            // Remove modal
            request.modal.remove();
            this.signingRequests.delete(requestId);
            
            // Send approval to background
            const response = await chrome.runtime.sendMessage({
                type: 'APPROVE_SIGNING',
                data: { requestId: requestId }
            });
            
            if (response.error) {
                throw new Error(response.error);
            }
            
        } catch (error) {
            console.error('Failed to approve request:', error);
        }
    }

    async rejectRequest(requestId) {
        const request = this.signingRequests.get(requestId);
        if (!request) return;
        
        // Remove modal
        request.modal.remove();
        this.signingRequests.delete(requestId);
        
        // Send rejection to background
        await chrome.runtime.sendMessage({
            type: 'REJECT_SIGNING',
            data: { requestId: requestId }
        });
    }

    sendResponse(id, data) {
        window.postMessage({
            type: 'DEFISHARD_RESPONSE',
            id: id,
            ...data
        }, '*');
    }

    async getWallets() {
        const response = await chrome.runtime.sendMessage({
            type: 'GET_EXISTING_WALLETS'
        });
        
        return response.wallets || [];
    }

    showWalletInterface() {
        // Open popup or navigate to wallet interface
        chrome.runtime.sendMessage({
            type: 'OPEN_WALLET_VIEW'
        });
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.type) {
                case 'SIGNING_COMPLETE':
                    this.handleSigningComplete(message.data);
                    break;
                    
                case 'SIGNING_ERROR':
                    this.handleSigningError(message.data);
                    break;
                    
                default:
                    console.log('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    handleSigningComplete(data) {
        const request = this.signingRequests.get(data.requestId);
        if (request) {
            request.modal.remove();
            this.signingRequests.delete(data.requestId);
        }
    }

    handleSigningError(data) {
        const request = this.signingRequests.get(data.requestId);
        if (request) {
            request.modal.remove();
            this.signingRequests.delete(data.requestId);
            
            // Show error notification
            this.showErrorNotification(data.error);
        }
    }

    showErrorNotification(error) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #fee;
            border: 1px solid #fcc;
            color: #c33;
            padding: 12px 16px;
            border-radius: 8px;
            z-index: 10002;
            max-width: 300px;
            font-size: 14px;
        `;
        notification.textContent = `DeFiShArd Error: ${error}`;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Initialize content script
const contentScript = new DeFiShArdContentScript();
