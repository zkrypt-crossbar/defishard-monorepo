/**
 * Mobile SDK Service
 * React Native service wrapper for DeFiShArd SDK
 */
import { createMobileSDK, DeFiShArdSDK } from '@defishard/sdk';

export class MobileSDKService {
  private sdk: DeFiShArdSDK | null = null;
  private isInitialized = false;

  /**
   * Initialize the SDK for mobile
   */
  async initialize(config: {
    relayerUrl: string;
    websocketUrl: string;
    debug?: boolean;
  }): Promise<void> {
    if (this.isInitialized) {
      console.log('SDK already initialized');
      return;
    }

    console.log('Initializing Mobile SDK...');
    
    try {
      this.sdk = createMobileSDK({
        relayerUrl: config.relayerUrl,
        websocketUrl: config.websocketUrl,
        debug: config.debug || false,
      });

      await this.sdk.initialize();
      this.isInitialized = true;
      
      console.log('Mobile SDK initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Mobile SDK:', error);
      throw error;
    }
  }

  /**
   * Register party
   */
  async registerParty() {
    this.ensureInitialized();
    return this.sdk!.register();
  }

  /**
   * Create group
   */
  async createGroup(threshold: number, totalParties: number, timeoutMinutes: number = 60) {
    this.ensureInitialized();
    return this.sdk!.createGroup(threshold, totalParties, timeoutMinutes);
  }

  /**
   * Join group
   */
  async joinGroup(groupId: string) {
    this.ensureInitialized();
    return this.sdk!.joinGroup(groupId);
  }

  /**
   * Start keygen
   */
  async startKeygen(isCreator: boolean = false) {
    this.ensureInitialized();
    return this.sdk!.startKeygen(isCreator);
  }

  /**
   * Sign message
   */
  async signMessage(message: string) {
    this.ensureInitialized();
    return this.sdk!.startSigning(message);
  }

  /**
   * Add event listener
   */
  on(event: string, handler: Function) {
    this.ensureInitialized();
    this.sdk!.on(event, handler);
  }

  /**
   * Remove event listener
   */
  off(event: string, handler: Function) {
    this.ensureInitialized();
    this.sdk!.off(event, handler);
  }

  /**
   * Get current state
   */
  getState() {
    if (!this.sdk) {
      return { isInitialized: false };
    }
    
    return {
      isInitialized: this.isInitialized,
      // Add more state properties as needed
    };
  }

  private ensureInitialized() {
    if (!this.isInitialized || !this.sdk) {
      throw new Error('SDK not initialized. Call initialize() first.');
    }
  }
}

// Export singleton instance
export const mobileSDKService = new MobileSDKService();
