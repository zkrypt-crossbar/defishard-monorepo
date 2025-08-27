import { Config, RegistrationResult, GroupResult, GroupInfo } from './types';
export declare class ApiClient {
    private relayerUrl;
    private config;
    constructor(relayerUrl: string);
    /**
     * Update configuration
     */
    updateConfig(config: Config): void;
    /**
     * Register with the relay server
     * POST /party/register
     */
    register(): Promise<RegistrationResult>;
    /**
     * Create a new group
     * POST /group/create
     */
    createGroup(threshold: number, totalParties: number, timeoutMinutes: number): Promise<GroupResult>;
    /**
     * Join an existing group
     * POST /group/join
     */
    joinGroup(groupId: string): Promise<GroupResult>;
    /**
     * Get group information
     * POST /group/info
     */
    getGroupInfo(groupId: string): Promise<GroupInfo>;
    /**
     * Get party information
     * GET /party/info
     */
    getPartyInfo(): Promise<any>;
    /**
     * Generate a random party ID in compressed public key format
     * Returns a 66-character hex string starting with "02" or "03"
     */
    private generatePartyId;
    /**
     * Generate a random group ID
     */
    private generateGroupId;
    /**
     * Get current API key
     */
    getApiKey(): string | undefined;
    /**
     * Get current party ID
     */
    getPartyId(): string | undefined;
}
