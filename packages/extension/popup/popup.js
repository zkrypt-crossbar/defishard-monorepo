/**
 * DeFiShard Extension Popup
 * Handles the main UI interactions and wallet creation flow
 */

class DeFiShardPopup {
    constructor() {
        this.currentStep = 1;
        this.walletConfig = {
            name: '',
            threshold: 2,        // Fixed 2-of-2 wallet
            totalParties: 2,     // Fixed 2-of-2 wallet  
            password: ''
        };
        this.groupInfo = null;
        this.qrCodeData = null;
        this.keygenInProgress = false;
        this.groupCreationInProgress = false;
        this.startTime = null;
        
        this.initialize();
    }
    
    // Create a simple QR-like pattern for visual representation
    createSimpleQRPattern(data) {
        // Create a 20x20 grid for the QR pattern
        const size = 20;
        const pattern = Array(size).fill().map(() => Array(size).fill(false));
        
        // Create a simple hash-based pattern from the data
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            hash = ((hash << 5) - hash + data.charCodeAt(i)) & 0xffffffff;
        }
        
        // Use the hash to create a pseudo-random pattern
        let rand = Math.abs(hash);
        for (let i = 2; i < size - 2; i++) {
            for (let j = 2; j < size - 2; j++) {
                // Skip corner areas for QR identifiers
                if ((i < 7 && j < 7) || (i < 7 && j >= size - 7) || (i >= size - 7 && j < 7)) {
                    continue;
                }
                
                rand = (rand * 1103515245 + 12345) & 0x7fffffff;
                pattern[i][j] = (rand % 3) === 0; // Roughly 33% fill rate
            }
        }
        
        return pattern;
    }
    
    // Add QR code corner identifiers
    addQRCorners(svg) {
        const corners = [
            { x: 10, y: 10 },      // Top-left
            { x: 130, y: 10 },     // Top-right
            { x: 10, y: 130 }      // Bottom-left
        ];
        
        corners.forEach(corner => {
            // Outer square
            const outer = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            outer.setAttribute('x', corner.x.toString());
            outer.setAttribute('y', corner.y.toString());
            outer.setAttribute('width', '48');
            outer.setAttribute('height', '48');
            outer.setAttribute('fill', '#000000');
            svg.appendChild(outer);
            
            // Inner white square
            const inner = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            inner.setAttribute('x', (corner.x + 8).toString());
            inner.setAttribute('y', (corner.y + 8).toString());
            inner.setAttribute('width', '32');
            inner.setAttribute('height', '32');
            inner.setAttribute('fill', '#ffffff');
            svg.appendChild(inner);
            
            // Center black square
            const center = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            center.setAttribute('x', (corner.x + 16).toString());
            center.setAttribute('y', (corner.y + 16).toString());
            center.setAttribute('width', '16');
            center.setAttribute('height', '16');
            center.setAttribute('fill', '#000000');
            svg.appendChild(center);
        });
    }

    async initialize() {
        this.setupEventListeners();
        this.updateConnectionStatus();
        await this.checkExistingWallets();
        await this.testBackgroundConnection();
        this.setupBackgroundMessageListeners();
    }
    
    async testBackgroundConnection() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' });
            console.log('✅ Background connection test:', response);
            
            if (response && response.success) {
                console.log('✅ Background script is working!');
            }
        } catch (error) {
            console.error('❌ Background connection failed:', error);
        }
    }

    setupBackgroundMessageListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('Popup received message from background:', message);
            
            if (message.type === 'GROUP_MEMBER_UPDATE') {
                this.updateGroupStatusUI(message.data.currentMembers, message.data.requiredMembers);
            } else if (message.type === 'ALL_PARTIES_JOINED') {
                this.groupInfo = message.data.groupInfo; // Store full group info
                // Automatically start keygen when all parties join
                this.startKeyGeneration();
            } else if (message.type === 'KEYGEN_STARTED') {
                this.showKeygenProgressUI(message.data.message);
            } else if (message.type === 'KEYGEN_PROGRESS') {
                this.showKeygenProgressUI(message.data.message, message.data.progress);
            } else if (message.type === 'KEYGEN_COMPLETED') {
                this.showKeygenCompleteUI(message.data.message, message.data.keyshare);
            } else if (message.type === 'KEYGEN_ERROR') {
                this.showKeygenErrorUI(message.data.error);
            }
            
            sendResponse({ success: true }); // Acknowledge message
            return true;
        });
    }

    updateGroupStatusUI(currentMembers, requiredMembers) {
        const counterEl = document.querySelector('.counter-text');
        if (counterEl) {
            counterEl.textContent = `${currentMembers}/${requiredMembers} parties connected`;
        }
        console.log(`👥 Group status update: ${currentMembers}/${requiredMembers} members`);
    }

    showKeygenProgressUI(message, progress = null) {
        console.log('🔑 Keygen progress:', message, progress);
        
        // Update the UI to show keygen in progress
        const container = document.querySelector('.qr-section');
        if (container) {
            container.innerHTML = `
                <div class="keygen-progress">
                    <h3>🔑 Key Generation</h3>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress || 0}%"></div>
                    </div>
                    <p class="progress-text">${message}</p>
                    ${progress ? `<p class="progress-percent">${Math.round(progress)}%</p>` : ''}
                </div>
            `;
        }
    }

    showKeygenCompleteUI(message, keyshare) {
        console.log('✅ Keygen complete:', message, keyshare);
        
        // Transition to the success screen
        this.showSuccessScreen(keyshare);
    }

    showSuccessScreen(keyshare) {
        console.log('🎉 Showing success screen with keyshare:', keyshare);
        
        // Hide all other screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        
        // Show success screen
        const successScreen = document.getElementById('success-screen');
        successScreen.classList.remove('hidden');
        
        // Populate wallet information
        const walletName = this.walletConfig?.name || 'DeFiShard Wallet';
        const securityLevel = `${keyshare.threshold || 2}-of-${keyshare.totalParties || 2}`;
        const publicKey = keyshare.publicKey ? String(keyshare.publicKey).substring(0, 42) + '...' : 'N/A';
        
        document.getElementById('final-wallet-name').textContent = walletName;
        document.getElementById('final-security-level').textContent = securityLevel;
        document.getElementById('final-public-key').textContent = publicKey;
        
        // Set up button event listeners
        this.setupSuccessScreenButtons();
    }

    setupSuccessScreenButtons() {
        // Remove existing event listeners by cloning elements
        const viewWalletBtn = document.getElementById('view-wallet-btn');
        const createAnotherBtn = document.getElementById('create-another-btn');
        
        if (viewWalletBtn) {
            const newViewBtn = viewWalletBtn.cloneNode(true);
            viewWalletBtn.parentNode.replaceChild(newViewBtn, viewWalletBtn);
            newViewBtn.addEventListener('click', () => {
                console.log('👁️ View wallet clicked');
                this.showWalletView();
            });
        }
        
        if (createAnotherBtn) {
            const newCreateBtn = createAnotherBtn.cloneNode(true);
            createAnotherBtn.parentNode.replaceChild(newCreateBtn, createAnotherBtn);
            newCreateBtn.addEventListener('click', () => {
                console.log('➕ Create another wallet clicked');
                this.resetAndShowWelcome();
            });
        }
    }

    showWalletView() {
        // For now, just show an alert - this can be expanded later
        alert('Wallet view functionality will be implemented in a future update. Your wallet has been created successfully!');
        console.log('📱 Wallet view - to be implemented');
    }

    showKeygenErrorUI(error) {
        console.error('❌ Keygen error:', error);
        
        // Update the UI to show error
        const container = document.querySelector('.qr-section');
        if (container) {
            container.innerHTML = `
                <div class="keygen-error">
                    <h3>❌ Key Generation Failed</h3>
                    <p class="error-message">${error}</p>
                    <button id="retry-keygen-btn" class="btn btn-primary">Try Again</button>
                </div>
            `;
            
            // Add event listener for retry button
            document.getElementById('retry-keygen-btn')?.addEventListener('click', () => {
                this.showWalletCreation();
            });
        }
    }

    async startGroupMonitoring() {
        if (!this.groupInfo || !this.groupInfo.groupId) {
            console.error('Cannot start group monitoring: Group info not available.');
            this.showError('Failed to start group monitoring: Group info missing.');
            return;
        }
        
        console.log('Sending START_GROUP_MONITORING to background...');
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'START_GROUP_MONITORING',
                data: {
                    groupId: this.groupInfo.groupId,
                    totalParties: this.walletConfig.totalParties,
                    threshold: this.walletConfig.threshold
                }
            });
            
            if (!response.success) {
                throw new Error(response.error || 'Unknown error starting group monitoring');
            }
            
            console.log('✅ Group monitoring started by background:', response.message);
            this.showWaitingForPartiesUI(); // Update UI to show waiting state
            
        } catch (error) {
            console.error('❌ Failed to start group monitoring:', error);
            this.showError('Failed to start group monitoring: ' + error.message);
        }
    }

    showWaitingForPartiesUI() {
        // Clean design - no additional UI needed, status is already shown in the main section
        console.log('👥 Waiting for parties UI - using clean design');
    }

    setupEventListeners() {
        // Welcome screen
        document.getElementById('create-wallet-btn').addEventListener('click', () => {
            this.showWalletCreation();
        });

        // Step 1: Configuration
        document.getElementById('wallet-name').addEventListener('input', (e) => {
            this.walletConfig.name = e.target.value;
            this.validateStep1();
        });

        document.getElementById('wallet-password').addEventListener('input', (e) => {
            this.walletConfig.password = e.target.value;
            this.validateStep1();
        });

        document.getElementById('confirm-password').addEventListener('input', () => {
            this.validateStep1();
        });

        // Navigation buttons
        // Back button removed for simplified flow

        document.getElementById('next-to-share').addEventListener('click', () => {
            // Prevent multiple clicks during group creation
            if (this.groupCreationInProgress) {
                console.log('⚠️ Group creation in progress, ignoring button click');
                return;
            }
            this.showStep2();
        });



        // Back button and start keygen button removed for simplified flow

        // Copy button
        document.getElementById('copy-data-btn').addEventListener('click', () => {
            this.copyWalletData();
        });

        // Success screen
        document.getElementById('view-wallet-btn').addEventListener('click', () => {
            this.viewWallet();
        });

        document.getElementById('create-another-btn').addEventListener('click', () => {
            this.resetAndShowWelcome();
        });

        // Footer buttons removed for simplified UI
    }

    // Screen Management
    showWelcome() {
        this.hideAllScreens();
        document.getElementById('welcome-screen').classList.remove('hidden');
        this.currentStep = 1;
    }

    showWalletCreation() {
        this.hideAllScreens();
        document.getElementById('wallet-creation-screen').classList.remove('hidden');
        this.showStep1();
    }

    showStep1() {
        this.hideAllStepContent();
        document.getElementById('step-1-content').classList.remove('hidden');
        // Step indicator removed
        this.currentStep = 1;
    }

    showStep2() {
        this.hideAllStepContent();
        document.getElementById('step-2-content').classList.remove('hidden');
        // Step indicator removed
        this.currentStep = 2;
        // Automatically start the background process: register party → create group → generate QR code
        this.createGroupAndGenerateQR();
    }

    showStep3() {
        this.hideAllStepContent();
        document.getElementById('step-3-content').classList.remove('hidden');
        // Step indicator removed
        this.currentStep = 3;
    }

    showSuccess() {
        this.hideAllScreens();
        document.getElementById('success-screen').classList.remove('hidden');
        this.updateFinalWalletInfo();
    }

    hideAllScreens() {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => screen.classList.add('hidden'));
    }

    hideAllStepContent() {
        const stepContents = document.querySelectorAll('.step-content');
        stepContents.forEach(content => content.classList.add('hidden'));
    }

    // Step indicator removed for simplified UI

    // Form Validation and Preview
    validateStep1() {
        const walletName = this.walletConfig.name.trim();
        const password = document.getElementById('wallet-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        let isValid = walletName.length > 0;
        
        // If password is entered, confirm password must match
        if (password.length > 0) {
            isValid = isValid && (password === confirmPassword);
        }
        
        const nextButton = document.getElementById('next-to-share');
        nextButton.disabled = !isValid;
        
        // Show password mismatch warning
        const confirmInput = document.getElementById('confirm-password');
        if (password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword) {
            confirmInput.style.borderColor = '#ff4444';
        } else {
            confirmInput.style.borderColor = '';
        }
    }

    // Wallet preview removed for simplified UI

    // Group Creation and QR Code Generation
    async createGroupAndGenerateQR() {
        // Prevent multiple simultaneous group creations
        if (this.groupCreationInProgress) {
            console.log('⚠️ Group creation already in progress, ignoring duplicate request');
            return;
        }
        
        this.groupCreationInProgress = true;
        console.log('🔒 Group creation started, locked to prevent duplicates');
        
        try {
            // Show loading state
            const qrContainer = document.getElementById('qr-container');
            while (qrContainer.firstChild) {
                qrContainer.removeChild(qrContainer.firstChild);
            }
            
            const placeholder = document.createElement('div');
            placeholder.className = 'qr-placeholder';
            
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'loading-spinner');
            svg.setAttribute('width', '48');
            svg.setAttribute('height', '48');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83');
            path.setAttribute('stroke', 'currentColor');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('stroke-linejoin', 'round');
            
            const text = document.createElement('p');
            text.textContent = 'Creating group and generating QR code...';
            
            svg.appendChild(path);
            placeholder.appendChild(svg);
            placeholder.appendChild(text);
            qrContainer.appendChild(placeholder);

            // Step 1: Create group via background script
            console.log('Step 1: Creating group...');
            const groupResult = await this.createGroup();
            console.log('Group result received:', groupResult);
            console.log('Group result type:', typeof groupResult);
            console.log('Group result success:', groupResult?.success);
            console.log('Group result group:', groupResult?.group);
            
            if (!groupResult) {
                throw new Error('No response received from background script');
            }
            
            if (!groupResult.success) {
                throw new Error(groupResult.error || 'Failed to create group');
            }

            this.groupInfo = groupResult.group;
            console.log('Group info set:', this.groupInfo);
            
            // Step 2: Generate QR code data with real group info
            console.log('Step 2: Generating QR code data...');
            this.qrCodeData = this.createQRCodeData();
            console.log('QR code data created:', this.qrCodeData);
            
            // Store QR data for background script to access the AES key
            await chrome.storage.local.set({ currentQRData: this.qrCodeData });
            console.log('✅ QR data stored for background script encryption');
            
            // Immediately set encryption key on SDK for secure WebSocket communication
            const qrData = JSON.parse(this.qrCodeData);
            if (qrData.aesKey) {
                try {
                    await chrome.runtime.sendMessage({
                        type: 'SET_QR_ENCRYPTION_KEY',
                        data: { aesKey: qrData.aesKey }
                    });
                    console.log('✅ Encryption key set on SDK');
                } catch (keyError) {
                    console.error('❌ Failed to set encryption key on SDK:', keyError);
                }
            }
            
            // Step 3: Generate QR code image
            console.log('Step 3: Generating QR code image...');
            await this.generateQRCodeImage();
            
            // QR data is ready for copying via the copy button
            
            // Start monitoring for other parties to join
            this.startGroupMonitoring();
            
        } catch (error) {
            console.error('Group creation and QR code generation failed:', error);
            this.showError('Failed to create group and generate QR code: ' + error.message);
        } finally {
            // Always unlock group creation
            this.groupCreationInProgress = false;
            console.log('🔓 Group creation unlocked');
        }
    }

    createQRCodeData() {
        // Generate AES key for encryption (same as web app)
        const aesKey = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
        
        const qrData = {
            type: 'keygen',
            groupId: this.groupInfo.groupId,
            threshold: this.groupInfo.threshold,
            totalParties: this.groupInfo.totalParties,
            timeout: 60,
            timestamp: Date.now(),
            version: '1.0',
            aesKey: aesKey,
            metadata: {
                threshold: this.groupInfo.threshold,
                totalParties: this.groupInfo.totalParties,
                timeout: 60,
                sessionName: `Keygen Session ${new Date().toLocaleString()}`,
                creator: this.groupInfo.creator?.partyId || 'extension',
                walletName: this.walletConfig.name
            }
        };
        
        console.log('QR code data structure:', qrData);
        return JSON.stringify(qrData);
    }

    async generateQRCodeImage() {
        try {
            console.log('🔧 Generating real QR code image...');
            const qrData = this.qrCodeData;
            
            if (!qrData) {
                console.error('❌ No QR code data available for generation');
                throw new Error('No QR data available');
            }
            
            console.log('📋 QR data length:', qrData.length);
            console.log('📋 QR data preview:', qrData.substring(0, 100) + (qrData.length > 100 ? '...' : ''));
            
            const qrContainer = document.getElementById('qr-container');
            while (qrContainer.firstChild) {
                qrContainer.removeChild(qrContainer.firstChild);
            }

            // Create minimal container for QR code that fits our design
            const containerDiv = document.createElement('div');
            containerDiv.style.display = 'flex';
            containerDiv.style.justifyContent = 'center';
            containerDiv.style.alignItems = 'center';
            containerDiv.style.width = '100%';
            containerDiv.style.height = '100%';
            
            // Generate real QR code using the qrcode library
            if (typeof qrcode !== 'undefined') {
                console.log('📱 Using qrcode library to generate QR code');
                
                // Create QR code instance
                const qr = qrcode(0, 'M'); // Type 0 (auto), error correction level M
                qr.addData(qrData);
                qr.make();
                
                // Get the QR code size - optimized for our extra-large scannable container
                const moduleCount = qr.getModuleCount();
                const containerSize = 252; // Fit inside our 300px container with padding
                const cellSize = Math.floor(containerSize / moduleCount);
                const actualQrSize = moduleCount * cellSize;
                const margin = Math.floor((containerSize - actualQrSize) / 2);
                
                // Create SVG for the QR code
                const qrSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                qrSvg.setAttribute('width', containerSize.toString());
                qrSvg.setAttribute('height', containerSize.toString());
                qrSvg.setAttribute('viewBox', `0 0 ${containerSize} ${containerSize}`);
                qrSvg.style.display = 'block';
                qrSvg.style.margin = '0 auto';
                qrSvg.style.maxWidth = '100%';
                qrSvg.style.maxHeight = '100%';
                
                // Create white background
                const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                bg.setAttribute('width', containerSize.toString());
                bg.setAttribute('height', containerSize.toString());
                bg.setAttribute('fill', '#ffffff');
                qrSvg.appendChild(bg);
                
                // Create QR code modules
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
                
                containerDiv.appendChild(qrSvg);
                console.log('✅ Real QR code generated successfully');
            } else {
                console.warn('⚠️ QR code library not available, creating placeholder');
                
                // Fallback: Create simple QR code placeholder using SVG
                const qrSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                qrSvg.setAttribute('width', '252');
                qrSvg.setAttribute('height', '252');
                qrSvg.setAttribute('viewBox', '0 0 252 252');
                qrSvg.style.display = 'block';
                qrSvg.style.margin = '0 auto';
                qrSvg.style.maxWidth = '100%';
                qrSvg.style.maxHeight = '100%';
                
                // Create a simple QR-like pattern
                const qrPattern = this.createSimpleQRPattern(qrData);
                
                // Create background
                const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                bg.setAttribute('width', '252');
                bg.setAttribute('height', '252');
                bg.setAttribute('fill', '#ffffff');
                bg.setAttribute('stroke', '#000000');
                bg.setAttribute('stroke-width', '1');
                qrSvg.appendChild(bg);
                
                // Create pattern
                for (let i = 0; i < qrPattern.length; i++) {
                    for (let j = 0; j < qrPattern[i].length; j++) {
                        if (qrPattern[i][j]) {
                            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                            rect.setAttribute('x', (j * 10 + 12).toString());
                            rect.setAttribute('y', (i * 10 + 12).toString());
                            rect.setAttribute('width', '10');
                            rect.setAttribute('height', '10');
                            rect.setAttribute('fill', '#000000');
                            qrSvg.appendChild(rect);
                        }
                    }
                }
                
                // Add QR identifier corners
                this.addQRCorners(qrSvg);
                
                containerDiv.appendChild(qrSvg);
                console.log('✅ Fallback QR code pattern generated successfully');
            }
            
            // Just append the clean container with the QR code
            qrContainer.appendChild(containerDiv);

        } catch (error) {
            console.error('QR code image generation failed:', error);
            // Fallback to simple text display
            const qrContainer = document.getElementById('qr-container');
            while (qrContainer.firstChild) {
                qrContainer.removeChild(qrContainer.firstChild);
            }
            
            const fallbackDiv = document.createElement('div');
            fallbackDiv.style.textAlign = 'center';
            fallbackDiv.style.padding = '20px';
            
            const errorMsg = document.createElement('p');
            errorMsg.style.color = '#dc3545';
            errorMsg.style.marginBottom = '16px';
            errorMsg.textContent = '⚠️ QR Code generation failed. Use the text data below:';
            
            const label = document.createElement('p');
            label.style.fontSize = '12px';
            label.style.color = '#666';
            label.style.marginBottom = '10px';
            label.textContent = 'QR Code Data:';
            
            const textarea = document.createElement('textarea');
            textarea.readOnly = true;
            textarea.style.width = '100%';
            textarea.style.height = '100px';
            textarea.style.fontSize = '10px';
            textarea.style.padding = '8px';
            textarea.style.border = '1px solid #ccc';
            textarea.style.borderRadius = '4px';
            textarea.value = this.qrCodeData;
            
            fallbackDiv.appendChild(errorMsg);
            fallbackDiv.appendChild(label);
            fallbackDiv.appendChild(textarea);
            qrContainer.appendChild(fallbackDiv);
        }
    }



    // Wait for Parties to Join
    async waitForPartiesToJoin() {
        try {
            console.log('Starting to wait for parties to join...');
            
            // Update UI to show waiting state
            const qrContainer = document.getElementById('qr-container');
            while (qrContainer.firstChild) {
                qrContainer.removeChild(qrContainer.firstChild);
            }
            // Regenerate the QR code for the waiting state
            await this.generateQRCodeImage();
            
            // Start polling for group info
            await this.pollGroupInfo();
            
        } catch (error) {
            console.error('Error waiting for parties to join:', error);
            this.showError('Failed to wait for parties: ' + error.message);
        }
    }

    async pollGroupInfo() {
        const maxRetries = 120; // 60 seconds max (120 * 500ms)
        const baseDelay = 200; // Start with 200ms
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
            try {
                console.log(`Polling group info (attempt ${retryCount + 1}/${maxRetries})`);
                
                // Get group info from background script
                const response = await chrome.runtime.sendMessage({
                    type: 'GET_GROUP_INFO',
                    data: { groupId: this.groupInfo.groupId }
                });
                
                if (response && response.success) {
                    const memberCount = response.groupInfo.members ? response.groupInfo.members.length : 0;
                    const expectedCount = this.groupInfo.totalParties;
                    
                    console.log(`Group status: ${memberCount}/${expectedCount} parties joined`);
                    
                    // Update status display
                    const statusElement = document.getElementById('party-status');
                    if (statusElement) {
                        statusElement.textContent = `${memberCount}/${expectedCount} parties joined`;
                    }
                    
                    if (memberCount >= expectedCount) {
                        console.log('All parties have joined!');
                        this.onAllPartiesJoined();
                        return;
                    }
                } else {
                    console.log('Failed to get group info:', response?.error);
                }
                
                // Wait before next poll
                const delay = Math.min(baseDelay * Math.pow(1.05, retryCount), 500);
                await new Promise(resolve => setTimeout(resolve, delay));
                retryCount++;
                
            } catch (error) {
                console.error('Error polling group info:', error);
                const delay = Math.min(baseDelay * Math.pow(1.05, retryCount), 500);
                await new Promise(resolve => setTimeout(resolve, delay));
                retryCount++;
            }
        }
        
        // Timeout reached
        throw new Error('Timeout waiting for parties to join');
    }

    onAllPartiesJoined() {
        console.log('All parties joined - automatically starting key generation');
        
        // Update UI to show starting keygen state
        const qrContainer = document.getElementById('qr-container');
        while (qrContainer.firstChild) {
            qrContainer.removeChild(qrContainer.firstChild);
        }
        
        const containerDiv = document.createElement('div');
        containerDiv.style.textAlign = 'center';
        containerDiv.style.padding = '20px';
        
        const qrBox = document.createElement('div');
        qrBox.style.background = '#f8f9fa';
        qrBox.style.border = '2px solid #e9ecef';
        qrBox.style.borderRadius = '12px';
        qrBox.style.padding = '20px';
        qrBox.style.marginBottom = '16px';
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '120');
        svg.setAttribute('height', '120');
        svg.setAttribute('viewBox', '0 0 120 120');
        svg.style.margin = '0 auto';
        svg.style.display = 'block';
        
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', '120');
        rect.setAttribute('height', '120');
        rect.setAttribute('fill', '#ffffff');
        
        const text1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text1.setAttribute('x', '60');
        text1.setAttribute('y', '60');
        text1.setAttribute('text-anchor', 'middle');
        text1.setAttribute('dy', '.3em');
        text1.setAttribute('font-family', 'monospace');
        text1.setAttribute('font-size', '8');
        text1.setAttribute('fill', '#666');
        text1.textContent = 'QR Code';
        
        const text2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text2.setAttribute('x', '60');
        text2.setAttribute('y', '75');
        text2.setAttribute('text-anchor', 'middle');
        text2.setAttribute('dy', '.3em');
        text2.setAttribute('font-family', 'monospace');
        text2.setAttribute('font-size', '6');
        text2.setAttribute('fill', '#999');
        text2.textContent = 'Scan with DeFiShArd';
        
        svg.appendChild(rect);
        svg.appendChild(text1);
        svg.appendChild(text2);
        qrBox.appendChild(svg);
        
        const label = document.createElement('p');
        label.style.fontSize = '14px';
        label.style.color = '#666';
        label.style.marginBottom = '12px';
        label.style.fontWeight = '500';
        label.textContent = 'QR Code Data (Copy & Paste):';
        
        const dataBox = document.createElement('div');
        dataBox.style.background = '#f8f9fa';
        dataBox.style.border = '1px solid #e9ecef';
        dataBox.style.borderRadius = '8px';
        dataBox.style.padding = '12px';
        dataBox.style.textAlign = 'left';
        
        const dataText = document.createElement('div');
        dataText.style.fontFamily = 'monospace';
        dataText.style.fontSize = '10px';
        dataText.style.color = '#333';
        dataText.style.wordBreak = 'break-all';
        dataText.style.lineHeight = '1.4';
        dataText.textContent = this.qrCodeData;
        
        dataBox.appendChild(dataText);
        
        const statusBox = document.createElement('div');
        statusBox.style.marginTop = '16px';
        statusBox.style.padding = '12px';
        statusBox.style.background = '#fff3cd';
        statusBox.style.border = '1px solid #ffc107';
        statusBox.style.borderRadius = '8px';
        
        const statusTitle = document.createElement('p');
        statusTitle.style.fontSize = '14px';
        statusTitle.style.color = '#856404';
        statusTitle.style.margin = '0';
        statusTitle.style.fontWeight = '500';
        statusTitle.textContent = '🚀 Starting distributed key generation...';
        
        const statusText = document.createElement('p');
        statusText.style.fontSize = '12px';
        statusText.style.color = '#666';
        statusText.style.margin = '8px 0 0 0';
        statusText.id = 'keygen-status';
        statusText.textContent = 'Connecting to relay server...';
        
        statusBox.appendChild(statusTitle);
        statusBox.appendChild(statusText);
        
        containerDiv.appendChild(qrBox);
        containerDiv.appendChild(label);
        containerDiv.appendChild(dataBox);
        containerDiv.appendChild(statusBox);
        qrContainer.appendChild(containerDiv);
        
        // Automatically start key generation (like web app)
        this.startKeyGeneration();
    }

    // Key Generation Process
    async startKeyGeneration() {
        try {
            console.log('🔑 Starting key generation process...');
            console.log('Group info available:', this.groupInfo);
            
            // Check if groupInfo is available
            if (!this.groupInfo) {
                throw new Error('Group information is not available. Please create a group first.');
            }
            
            // Transition to the keygen progress screen
            this.showStep3();
            
            // Start the actual key generation
            const result = await this.performKeyGeneration();
            
            if (result.success) {
                console.log('✅ Key generation completed successfully!');
                // The success screen will be shown via the KEYGEN_COMPLETED message
            } else {
                console.error('❌ Key generation failed:', result.error);
                this.showKeygenErrorUI(result.error);
            }
            
        } catch (error) {
            console.error('❌ Error starting key generation:', error);
            this.showKeygenErrorUI(error.message);
        }
    }

    updateKeygenStatus(message) {
        const statusElement = document.getElementById('keygen-status');
        if (statusElement) {
            statusElement.textContent = message;
        }
        console.log('Keygen status:', message);
    }

    async performKeyGeneration() {
        try {
            console.log('Performing key generation with group info:', this.groupInfo);
            
            // Check if groupInfo is available
            if (!this.groupInfo) {
                throw new Error('Group information is not available. Please create a group first.');
            }
            
            // Send message to background script to start keygen
            const response = await chrome.runtime.sendMessage({
                type: 'START_KEYGEN',
                data: {
                    groupId: this.groupInfo.groupId,
                    threshold: this.groupInfo.threshold || this.walletConfig?.threshold || 2,
                    totalParties: this.groupInfo.totalParties || this.walletConfig?.totalParties || 2,
                    password: this.walletConfig?.password || '',
                    walletName: this.walletConfig?.name || 'DeFiShard Wallet'
                }
            });

            if (response.error) {
                throw new Error(response.error);
            }

            return { success: true, keyshare: response.keyshare };

        } catch (error) {
            console.error('Error in performKeyGeneration:', error);
            return { success: false, error: error.message };
        }
    }

    // Progress Updates
    updateProgress(progress, text) {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        progressFill.style.width = `${progress}%`;
        progressText.textContent = text;
    }

    updateKeygenStatus(round, connections, security) {
        document.getElementById('status-round').querySelector('.status-text').textContent = 
            `Round ${round}/4: ${this.getRoundDescription(round)}`;
        
        document.getElementById('status-connections').querySelector('.status-text').textContent = 
            `${connections}/${this.walletConfig.totalParties} devices connected`;
        
        document.getElementById('status-security').querySelector('.status-text').textContent = 
            security || 'Verifying cryptographic operations';
    }

    getRoundDescription(round) {
        const descriptions = {
            0: 'Initializing',
            1: 'Exchanging commitments',
            2: 'Sharing secrets',
            3: 'Computing shares',
            4: 'Finalizing keys',
            5: 'Complete'
        };
        return descriptions[round] || 'Processing';
    }

    updateTimer() {
        if (!this.startTime) return;
        
        const elapsed = Date.now() - this.startTime;
        const estimatedTotal = 60000; // 60 seconds
        const remaining = Math.max(0, estimatedTotal - elapsed);
        
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        
        document.getElementById('timer-value').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Connection Status
    async updateConnectionStatus() {
        // Connection status UI removed for simplified interface
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_CONNECTION_STATUS' });
            // Just log the status, no UI updates needed
            console.log('Connection status:', response.connected ? 'Connected' : 'Disconnected');
        } catch (error) {
            console.error('Failed to get connection status:', error);
        }
    }

    // Background Script Communication
    async createGroup() {
        console.log('Creating group with relay server...');
        const messageData = {
            threshold: this.walletConfig.threshold,
            totalParties: this.walletConfig.totalParties,
            timeoutMinutes: 60
        };
        console.log('Sending CREATE_GROUP message with data:', messageData);
        
        const response = await chrome.runtime.sendMessage({
            type: 'CREATE_GROUP',
            data: messageData
        });

        console.log('Group creation response:', response);
        console.log('Response type:', typeof response);
        console.log('Response success:', response?.success);
        
        if (!response) {
            throw new Error('No response received from background script');
        }
        
        return response;
    }

    // Success Screen
    updateFinalWalletInfo() {
        document.getElementById('final-wallet-name').textContent = this.walletConfig.name;
        document.getElementById('final-security-level').textContent = 
            `${this.walletConfig.threshold}-of-${this.walletConfig.totalParties}`;
        
        // Get public key from keyshare (this would come from the keygen result)
        document.getElementById('final-public-key').textContent = 
            '0x' + '...'.repeat(20); // Placeholder
    }

    // Utility Methods
    resetKeygenState() {
        this.keygenInProgress = false;
        this.startTime = null;
    }

    resetAndShowWelcome() {
        this.walletConfig = {
            name: '',
            threshold: 2,
            totalParties: 2,
            password: ''
        };
        this.groupInfo = null;
        this.qrCodeData = null;
        this.keygenInProgress = false;
        this.startTime = null;
        
        // Reset form
        document.getElementById('wallet-name').value = '';
        document.getElementById('wallet-password').value = '';
        document.getElementById('confirm-password').value = '';
        
        this.updatePreview();
        this.validateStep1();
        this.showWelcome();
    }

    async checkExistingWallets() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_EXISTING_WALLETS' });
            console.log('Existing wallets response:', response);
            
            if (response && response.wallets && response.wallets.length > 0) {
                // Show existing wallets option
                this.showExistingWalletsOption(response.wallets);
            }
        } catch (error) {
            console.error('Failed to check existing wallets:', error);
        }
    }

    showExistingWalletsOption(wallets) {
        // Add option to load existing wallet
        const welcomeContent = document.querySelector('.welcome-content');
        const existingWalletBtn = document.createElement('button');
        existingWalletBtn.className = 'secondary-btn';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '20');
        svg.setAttribute('height', '20');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M3 15v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        
        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', '7,10 12,15 17,10');
        polyline.setAttribute('stroke', 'currentColor');
        polyline.setAttribute('stroke-width', '2');
        polyline.setAttribute('stroke-linecap', 'round');
        polyline.setAttribute('stroke-linejoin', 'round');
        
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '12');
        line.setAttribute('y1', '15');
        line.setAttribute('x2', '12');
        line.setAttribute('y2', '3');
        line.setAttribute('stroke', 'currentColor');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('stroke-linejoin', 'round');
        
        svg.appendChild(path);
        svg.appendChild(polyline);
        svg.appendChild(line);
        
        const text = document.createTextNode(` Load Existing Wallet (${wallets.length})`);
        
        existingWalletBtn.appendChild(svg);
        existingWalletBtn.appendChild(text);
        existingWalletBtn.addEventListener('click', () => {
            this.loadExistingWallet(wallets);
        });
        
        welcomeContent.appendChild(existingWalletBtn);
    }

    loadExistingWallet(wallets) {
        // Open wallet selection modal or navigate to wallet list
        chrome.runtime.sendMessage({ type: 'OPEN_WALLET_LIST' });
    }

    // Error Handling
    showError(message) {
        // Create error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        const errorContent = document.createElement('div');
        errorContent.style.background = '#fee';
        errorContent.style.border = '1px solid #fcc';
        errorContent.style.color = '#c33';
        errorContent.style.padding = '12px';
        errorContent.style.borderRadius = '8px';
        errorContent.style.margin = '16px';
        
        const strong = document.createElement('strong');
        strong.textContent = 'Error: ';
        
        const messageText = document.createTextNode(message);
        
        errorContent.appendChild(strong);
        errorContent.appendChild(messageText);
        errorDiv.appendChild(errorContent);
        
        document.body.appendChild(errorDiv);
        
        // Remove after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    // Navigation Methods
    viewWallet() {
        chrome.runtime.sendMessage({ type: 'OPEN_WALLET_VIEW' });
    }

    // Settings and help methods removed for simplified UI
    
    async copyWalletData() {
        try {
            if (!this.qrCodeData) {
                console.log('No QR data to copy yet');
                return;
            }
            
            await navigator.clipboard.writeText(this.qrCodeData);
            
            // Visual feedback
            const copyBtn = document.getElementById('copy-data-btn');
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Copied!
            `;
            copyBtn.style.backgroundColor = '#10b981';
            
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
                copyBtn.style.backgroundColor = '';
            }, 2000);
            
            console.log('✅ QR data copied to clipboard');
        } catch (error) {
            console.error('❌ Failed to copy QR data:', error);
            
            // Visual feedback for error
            const copyBtn = document.getElementById('copy-data-btn');
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Failed
            `;
            copyBtn.style.backgroundColor = '#ef4444';
            
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
                copyBtn.style.backgroundColor = '';
            }, 2000);
        }
    }

    // Timer updates
    startTimerUpdates() {
        this.timerInterval = setInterval(() => {
            this.updateTimer();
        }, 1000);
    }

    stopTimerUpdates() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
}

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.defishardPopup = new DeFiShardPopup();
});

// Handle messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!window.defishardPopup) return;

    switch (message.type) {
        case 'KEYGEN_PROGRESS':
            window.defishardPopup.updateProgress(message.progress, message.text);
            break;
            
        case 'KEYGEN_STATUS':
            window.defishardPopup.updateKeygenStatus(
                message.round, 
                message.connections, 
                message.security
            );
            break;
            
        case 'KEYGEN_COMPLETE':
            window.defishardPopup.stopTimerUpdates();
            window.defishardPopup.showSuccess();
            break;
            
        case 'KEYGEN_ERROR':
            window.defishardPopup.stopTimerUpdates();
            window.defishardPopup.showError(message.error);
            window.defishardPopup.resetKeygenState();
            break;
            
        case 'CONNECTION_UPDATE':
            window.defishardPopup.updateConnectionStatus();
            break;
            
        case 'SERVICE_WORKER_ERROR':
            console.error('🚨 Service Worker Error:', message.error);
            console.error('Stack:', message.stack);
            window.defishardPopup.showError('Service Worker Error: ' + message.error);
            break;
    }
});
