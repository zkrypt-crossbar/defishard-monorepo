import { Config, RegistrationResult, GroupResult, GroupInfo } from './types';

export class ApiClient {
  private config: Config;

  constructor(private relayerUrl: string) {
    this.config = { relayerUrl, websocketUrl: '' };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Config): void {
    this.config = config;
  }

  /**
   * Register with the relay server
   * POST /party/register
   */
  async register(): Promise<RegistrationResult> {
    // Always generate a fresh party ID to avoid conflicts
    const partyId = this.generatePartyId();
    
    const response = await fetch(`${this.config.relayerUrl}/party/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        party_id: partyId
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Registration failed: ${response.statusText} - ${errorData.error || ''}`);
    }

    const result = await response.json();
    
    // Map server response to SDK expected format
    const mappedResult = {
      success: true,
      message: result.message || "Registration successful",
      partyId: result.party_id,
      token: result.token
    };
    
    // Update config with received data
    this.config.partyId = mappedResult.partyId;
    this.config.apiKey = mappedResult.token;
    
    return mappedResult;
  }

  /**
   * Create a new group
   * POST /group/create
   */
  async createGroup(threshold: number, totalParties: number, timeoutMinutes: number): Promise<GroupResult> {
    if (!this.config.apiKey) {
      throw new Error('API key required for group operations');
    }

    // Always generate a fresh group ID to avoid conflicts
    const groupId = this.generateGroupId();

    const response = await fetch(`${this.config.relayerUrl}/group/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        group_id: groupId,
        n: totalParties,
        t: threshold,
        timeout: timeoutMinutes
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to create group: ${response.statusText} - ${errorData.error || ''}`);
    }

    const result = await response.json();
    
    // Map server response to SDK expected format
    const mappedResult = {
      success: true,
      message: result.message || "Group created successfully",
      group: {
        groupId: result.group.group_id,
        totalParties: result.group.n,
        threshold: result.group.t,
        timeout: result.group.timeout,
        createdAt: result.group.created_at,
        updatedAt: result.group.updated_at,
        createdBy: {
          id: result.group.created_by.id,
          partyId: result.group.created_by.party_id,
          token: result.group.created_by.token,
          createdAt: result.group.created_by.created_at
        },
        members: result.group.members.map((member: any) => ({
          partyId: member.party_id,
          index: member.index || 0
        })),
        status: result.group.status
      }
    };
    
    return mappedResult;
  }

  /**
   * Join an existing group
   * POST /group/join
   */
  async joinGroup(groupId: string): Promise<GroupResult> {
    if (!this.config.apiKey) {
      throw new Error('API key required for group operations');
    }

    const response = await fetch(`${this.config.relayerUrl}/group/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        group_id: groupId
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to join group: ${response.statusText} - ${errorData.error || ''}`);
    }

    const result = await response.json();
    
    // Map server response to SDK expected format
    // For join group, we need to get the full group info since the response doesn't include it
    const groupInfo = await this.getGroupInfo(groupId);
    
    const mappedResult = {
      success: true,
      message: result.message || "Joined group successfully",
      group: groupInfo
    };
    
    return mappedResult;
  }

  /**
   * Get group information
   * POST /group/info
   */
  async getGroupInfo(groupId: string): Promise<GroupInfo> {
    if (!this.config.apiKey) {
      throw new Error('API key required for group operations');
    }

    const response = await fetch(`${this.config.relayerUrl}/group/info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        group_id: groupId
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to get group info: ${response.statusText} - ${errorData.error || ''}`);
    }

    const result = await response.json();
    
    // Map server response to SDK expected format
    const mappedResult = {
      groupId: result.group_id,
      totalParties: result.n,
      threshold: result.t,
      timeout: result.timeout,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      createdBy: {
        id: result.created_by.id,
        partyId: result.created_by.party_id,
        token: result.created_by.token,
        createdAt: result.created_by.created_at
      },
      members: result.members.map((member: any, index: number) => ({
        partyId: member.party_id,
        index: index
      })),
      status: result.status
    };
    
    return mappedResult;
  }

  /**
   * Get party information
   * GET /party/info
   */
  async getPartyInfo(): Promise<any> {
    if (!this.config.apiKey) {
      throw new Error('API key required for party operations');
    }

    const response = await fetch(`${this.config.relayerUrl}/party/info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to get party info: ${response.statusText} - ${errorData.error || ''}`);
    }

    return response.json();
  }

  /**
   * Generate a random party ID in compressed public key format
   * Returns a 66-character hex string starting with "02" or "03"
   */
  private generatePartyId(): string {
    const array = new Uint8Array(33);
    crypto.getRandomValues(array);
    
    // Set the first byte to indicate compressed format (02 or 03)
    // Use 02 for even y-coordinate, 03 for odd y-coordinate
    array[0] = (array[1] % 2 === 0) ? 0x02 : 0x03;
    
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate a random group ID
   */
  private generateGroupId(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Get current API key
   */
  getApiKey(): string | undefined {
    return this.config.apiKey;
  }

  /**
   * Get current party ID
   */
  getPartyId(): string | undefined {
    return this.config.partyId;
  }
} 