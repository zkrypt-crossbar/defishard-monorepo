/**
 * Storage Interface
 * Common interface for all storage adapters across platforms
 */
export interface StorageInterface {
  /**
   * Get a value by key
   */
  get(key: string): Promise<string | null>;

  /**
   * Set a value by key
   */
  set(key: string, value: string): Promise<void>;

  /**
   * Remove a value by key
   */
  remove(key: string): Promise<void>;

  /**
   * Get all keys with the current prefix
   */
  getKeys(): Promise<string[]>;

  /**
   * Clear all data with the current prefix
   */
  clear?(): Promise<void>;

  /**
   * Set encryption password (optional, platform-dependent)
   */
  setPassword?(password: string): void;
}

/**
 * Base storage adapter with common functionality
 */
export abstract class BaseStorageAdapter implements StorageInterface {
  protected prefix: string;

  constructor(prefix: string = 'defishard_') {
    this.prefix = prefix;
  }

  abstract get(key: string): Promise<string | null>;
  abstract set(key: string, value: string): Promise<void>;
  abstract remove(key: string): Promise<void>;
  abstract getKeys(): Promise<string[]>;

  async clear(): Promise<void> {
    const keys = await this.getKeys();
    await Promise.all(keys.map(key => this.remove(key)));
  }

  protected getFullKey(key: string): string {
    return `${this.prefix}${key}`;
  }
}
