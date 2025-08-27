/**
 * Rotation Controller - Manages key rotation operations
 * Handles proactive and reactive key rotation for enhanced security
 */
import { eventBus, EVENTS } from '../core/EventBus.js';
import { stateManager } from '../core/StateManager.js';
import { mpcService } from '../services/MPCService.js';

export class RotationController {
    constructor() {
        this.rotationSchedule = new Map();
        this.setupEventListeners();
        this.initializeRotationScheduler();
    }
    
    /**
     * Initiate manual key rotation
     * @param {string} walletId - Wallet ID to rotate keys for
     * @param {Object} options - Rotation options
     */
    async rotateKeys(walletId, options = {}) {
        try {
            const wallets = stateManager.getState('wallets');
            const wallet = wallets.find(w => w.id === walletId);
            
            if (!wallet) {
                throw new Error('Wallet not found');
            }
            
            if (wallet.status === 'rotated') {
                throw new Error('Wallet keys have already been rotated');
            }
            
            // Validate rotation requirements
            this.validateRotationRequirements(wallet, options);
            
            // Set loading state
            stateManager.batchUpdate({
                loading: true,
                error: null,
                rotationStatus: 'preparing'
            });
            
            // Create rotation session
            const rotationSession = {
                id: this.generateRotationId(),
                walletId,
                reason: options.reason || 'manual',
                started: new Date().toISOString(),
                status: 'preparing'
            };
            
            // Check if emergency rotation
            if (options.emergency) {
                return await this.performEmergencyRotation(wallet, rotationSession, options);
            } else {
                return await this.performStandardRotation(wallet, rotationSession, options);
            }
            
        } catch (error) {
            console.error('Failed to rotate keys:', error);
            stateManager.batchUpdate({
                loading: false,
                error: error.message,
                rotationStatus: 'failed'
            });
            throw error;
        }
    }
    
    /**
     * Schedule automatic key rotation
     * @param {string} walletId - Wallet ID
     * @param {Object} schedule - Rotation schedule options
     */
    scheduleRotation(walletId, schedule) {
        const { interval, maxUsage, conditions } = schedule;
        
        const rotationPlan = {
            walletId,
            interval: interval || '90d', // Default 90 days
            maxUsage: maxUsage || 1000, // Max signatures before rotation
            conditions: conditions || [],
            created: new Date().toISOString(),
            nextRotation: this.calculateNextRotation(interval),
            status: 'scheduled'
        };
        
        this.rotationSchedule.set(walletId, rotationPlan);
        
        // Persist schedule
        this.persistRotationSchedule();
        
        eventBus.emit(EVENTS.NOTIFICATION_SHOWN, {
            type: 'info',
            message: `Automatic rotation scheduled for wallet`
        });
        
        return rotationPlan;
    }
    
    /**
     * Cancel scheduled rotation
     * @param {string} walletId - Wallet ID
     */
    cancelScheduledRotation(walletId) {
        if (this.rotationSchedule.has(walletId)) {
            this.rotationSchedule.delete(walletId);
            this.persistRotationSchedule();
            
            eventBus.emit(EVENTS.NOTIFICATION_SHOWN, {
                type: 'info',
                message: 'Automatic rotation cancelled'
            });
        }
    }
    
    /**
     * Check if wallet needs rotation
     * @param {string} walletId - Wallet ID
     * @returns {Object} Rotation recommendation
     */
    checkRotationNeeded(walletId) {
        const wallets = stateManager.getState('wallets');
        const wallet = wallets.find(w => w.id === walletId);
        
        if (!wallet) {
            return { needed: false, reason: 'Wallet not found' };
        }
        
        const schedule = this.rotationSchedule.get(walletId);
        const reasons = [];
        
        // Check time-based rotation
        if (schedule && schedule.nextRotation) {
            const nextRotation = new Date(schedule.nextRotation);
            if (new Date() >= nextRotation) {
                reasons.push('Scheduled rotation due');
            }
        }
        
        // Check usage-based rotation
        if (schedule && schedule.maxUsage) {
            const usage = this.getWalletUsage(wallet);
            if (usage >= schedule.maxUsage) {
                reasons.push(`Usage limit reached (${usage}/${schedule.maxUsage})`);
            }
        }
        
        // Check security conditions
        const securityCheck = this.checkSecurityConditions(wallet);
        if (securityCheck.rotationRecommended) {
            reasons.push(...securityCheck.reasons);
        }
        
        return {
            needed: reasons.length > 0,
            reasons,
            urgency: this.calculateUrgency(reasons),
            recommendation: this.getRotationRecommendation(reasons)
        };
    }
    
    /**
     * Get rotation history for a wallet
     * @param {string} walletId - Wallet ID
     * @returns {Array} Rotation history
     */
    getRotationHistory(walletId) {
        const wallets = stateManager.getState('wallets');
        
        // Find all wallets in the rotation chain
        const rotationChain = [];
        let currentWallet = wallets.find(w => w.id === walletId);
        
        while (currentWallet) {
            rotationChain.push({
                id: currentWallet.id,
                name: currentWallet.name,
                created: currentWallet.created,
                rotatedFrom: currentWallet.rotatedFrom,
                publicKey: this.formatPublicKey(currentWallet.publicKey),
                status: currentWallet.status || 'active'
            });
            
            // Find the previous wallet in chain
            if (currentWallet.rotatedFrom) {
                currentWallet = wallets.find(w => w.id === currentWallet.rotatedFrom);
            } else {
                break;
            }
        }
        
        return rotationChain.reverse(); // Show oldest first
    }
    
    /**
     * Export rotation audit log
     * @param {string} walletId - Wallet ID
     * @returns {Object} Audit log data
     */
    exportRotationAudit(walletId) {
        const history = this.getRotationHistory(walletId);
        const schedule = this.rotationSchedule.get(walletId);
        
        return {
            walletId,
            rotationHistory: history,
            currentSchedule: schedule,
            recommendations: this.checkRotationNeeded(walletId),
            exportedAt: new Date().toISOString()
        };
    }
    
    // Private methods
    
    async performStandardRotation(wallet, session, options) {
        try {
            session.status = 'coordinating';
            
            // Coordinate with other parties
            eventBus.emit(EVENTS.ROTATION_STARTED, {
                walletId: wallet.id,
                type: 'standard'
            });
            
            // Perform MPC key rotation
            const rotatedWallet = await mpcService.rotateKeys(wallet);
            
            session.status = 'completed';
            session.completed = new Date().toISOString();
            session.newWalletId = rotatedWallet.id;
            
            // Update rotation schedule if exists
            if (this.rotationSchedule.has(wallet.id)) {
                const schedule = this.rotationSchedule.get(wallet.id);
                schedule.nextRotation = this.calculateNextRotation(schedule.interval);
                this.rotationSchedule.set(rotatedWallet.id, schedule);
                this.rotationSchedule.delete(wallet.id);
            }
            
            stateManager.batchUpdate({
                loading: false,
                rotationStatus: 'completed'
            });
            
            eventBus.emit(EVENTS.NOTIFICATION_SHOWN, {
                type: 'success',
                message: `Keys rotated successfully for wallet "${wallet.name}"`
            });
            
            return rotatedWallet;
            
        } catch (error) {
            session.status = 'failed';
            session.error = error.message;
            throw error;
        }
    }
    
    async performEmergencyRotation(wallet, session, options) {
        try {
            session.status = 'emergency_rotation';
            session.emergency = true;
            session.compromiseDetails = options.compromiseDetails;
            
            // Emergency rotation might use different parameters
            eventBus.emit(EVENTS.ROTATION_STARTED, {
                walletId: wallet.id,
                type: 'emergency',
                reason: options.reason
            });
            
            // Mark original wallet as compromised
            const wallets = stateManager.getState('wallets');
            const updatedWallets = wallets.map(w => 
                w.id === wallet.id 
                    ? { ...w, status: 'compromised', compromisedAt: new Date().toISOString() }
                    : w
            );
            stateManager.setState('wallets', updatedWallets);
            
            // Perform emergency rotation with higher priority
            const rotatedWallet = await mpcService.rotateKeys({
                ...wallet,
                status: 'compromised'
            });
            
            session.status = 'completed';
            session.completed = new Date().toISOString();
            session.newWalletId = rotatedWallet.id;
            
            stateManager.batchUpdate({
                loading: false,
                rotationStatus: 'completed'
            });
            
            eventBus.emit(EVENTS.NOTIFICATION_SHOWN, {
                type: 'warning',
                message: `Emergency rotation completed. Old keys marked as compromised.`
            });
            
            return rotatedWallet;
            
        } catch (error) {
            session.status = 'failed';
            session.error = error.message;
            throw error;
        }
    }
    
    initializeRotationScheduler() {
        // Load existing schedules
        this.loadRotationSchedule();
        
        // Set up periodic check (every hour)
        setInterval(() => {
            this.checkScheduledRotations();
        }, 60 * 60 * 1000);
    }
    
    async checkScheduledRotations() {
        for (const [walletId, schedule] of this.rotationSchedule) {
            const check = this.checkRotationNeeded(walletId);
            
            if (check.needed && check.urgency === 'high') {
                // Auto-rotate if high urgency
                try {
                    await this.rotateKeys(walletId, {
                        reason: 'automatic',
                        autoTriggered: true
                    });
                } catch (error) {
                    console.error(`Automatic rotation failed for wallet ${walletId}:`, error);
                }
            } else if (check.needed) {
                // Notify user
                eventBus.emit(EVENTS.NOTIFICATION_SHOWN, {
                    type: 'warning',
                    message: `Wallet rotation recommended: ${check.reasons[0]}`
                });
            }
        }
    }
    
    validateRotationRequirements(wallet, options) {
        if (!wallet.keyshare) {
            throw new Error('Cannot rotate keys: keyshare not available');
        }
        
        if (wallet.threshold < 2) {
            throw new Error('Cannot rotate single-party wallet');
        }
        
        // Check if enough parties are available for rotation
        // This would need to be implemented based on your MPC protocol
    }
    
    checkSecurityConditions(wallet) {
        const reasons = [];
        
        // Check wallet age
        const walletAge = Date.now() - new Date(wallet.created).getTime();
        const maxAge = 180 * 24 * 60 * 60 * 1000; // 180 days
        
        if (walletAge > maxAge) {
            reasons.push('Wallet is older than 180 days');
        }
        
        // Check usage patterns
        const usage = this.getWalletUsage(wallet);
        if (usage > 500) {
            reasons.push('High usage wallet (security recommendation)');
        }
        
        return {
            rotationRecommended: reasons.length > 0,
            reasons
        };
    }
    
    calculateUrgency(reasons) {
        if (reasons.some(r => r.includes('compromised') || r.includes('emergency'))) {
            return 'critical';
        }
        if (reasons.some(r => r.includes('limit reached') || r.includes('overdue'))) {
            return 'high';
        }
        if (reasons.length > 1) {
            return 'medium';
        }
        return 'low';
    }
    
    getRotationRecommendation(reasons) {
        if (reasons.length === 0) {
            return 'No rotation needed';
        }
        
        const urgency = this.calculateUrgency(reasons);
        
        switch (urgency) {
            case 'critical':
                return 'Immediate rotation required';
            case 'high':
                return 'Rotation recommended within 24 hours';
            case 'medium':
                return 'Rotation recommended within 1 week';
            default:
                return 'Consider rotation at next convenient time';
        }
    }
    
    calculateNextRotation(interval) {
        const now = new Date();
        const match = interval.match(/^(\d+)([dwmy])$/);
        
        if (!match) {
            throw new Error('Invalid interval format');
        }
        
        const [, amount, unit] = match;
        const value = parseInt(amount);
        
        switch (unit) {
            case 'd':
                return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
            case 'w':
                return new Date(now.getTime() + value * 7 * 24 * 60 * 60 * 1000);
            case 'm':
                return new Date(now.getFullYear(), now.getMonth() + value, now.getDate());
            case 'y':
                return new Date(now.getFullYear() + value, now.getMonth(), now.getDate());
            default:
                throw new Error('Invalid interval unit');
        }
    }
    
    getWalletUsage(wallet) {
        // This would typically come from a usage tracking system
        // For now, return a mock value
        return 0;
    }
    
    async persistRotationSchedule() {
        try {
            const scheduleData = Object.fromEntries(this.rotationSchedule);
            if (typeof chrome !== 'undefined' && chrome.storage) {
                await chrome.storage.local.set({ rotationSchedule: scheduleData });
            }
        } catch (error) {
            console.error('Failed to persist rotation schedule:', error);
        }
    }
    
    async loadRotationSchedule() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get('rotationSchedule');
                if (result.rotationSchedule) {
                    this.rotationSchedule = new Map(Object.entries(result.rotationSchedule));
                }
            }
        } catch (error) {
            console.error('Failed to load rotation schedule:', error);
        }
    }
    
    setupEventListeners() {
        eventBus.on(EVENTS.ROTATION_PROGRESS, (progress) => {
            eventBus.emit(EVENTS.NOTIFICATION_SHOWN, {
                type: 'progress',
                message: `Key rotation progress: ${progress.percentage || 0}%`,
                progress: progress.percentage
            });
        });
        
        eventBus.on(EVENTS.ROTATION_COMPLETED, (wallet) => {
            eventBus.emit(EVENTS.NOTIFICATION_SHOWN, {
                type: 'success',
                message: `Keys rotated successfully for "${wallet.name}"`
            });
        });
        
        eventBus.on(EVENTS.ROTATION_FAILED, (error) => {
            eventBus.emit(EVENTS.NOTIFICATION_SHOWN, {
                type: 'error',
                message: `Key rotation failed: ${error.message}`
            });
        });
    }
    
    formatPublicKey(publicKey) {
        if (!publicKey) return '';
        return `${publicKey.slice(0, 8)}...${publicKey.slice(-8)}`;
    }
    
    generateRotationId() {
        return `rotate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Export singleton instance
export const rotationController = new RotationController();
