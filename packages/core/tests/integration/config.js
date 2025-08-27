/**
 * Configuration for integration tests
 * Supports different environments (test, staging, production)
 */

const ENV = process.env.NODE_ENV || 'test';

const CONFIG = {
  // Test environment (default)
  test: {
    relayerUrl: 'https://test.relayer.defishard.com',
    websocketUrl: 'wss://test.relayer.defishard.com',
    apiKey: 'test-api-key',
    timeout: 30000,
    retryAttempts: 3,
    totalParties: 3,
    threshold: 2
  },
  
  // Staging environment
  staging: {
    relayerUrl: 'https://staging.relayer.defishard.com',
    websocketUrl: 'wss://staging.relayer.defishard.com',
    apiKey: process.env.STAGING_API_KEY || 'staging-api-key',
    timeout: 60000,
    retryAttempts: 5,
    totalParties: 3,
    threshold: 2
  },
  
  // Production environment
  production: {
    relayerUrl: 'https://relayer.defishard.com',
    websocketUrl: 'wss://relayer.defishard.com',
    apiKey: process.env.PRODUCTION_API_KEY,
    timeout: 120000,
    retryAttempts: 10,
    totalParties: 5,
    threshold: 3
  }
};

// Get configuration for current environment
function getConfig() {
  const envConfig = CONFIG[ENV];
  
  if (!envConfig) {
    throw new Error(`Unknown environment: ${ENV}`);
  }
  
  // Override with environment variables if provided
  return {
    relayerUrl: process.env.TEST_RELAYER_URL || envConfig.relayerUrl,
    websocketUrl: process.env.TEST_WEBSOCKET_URL || envConfig.websocketUrl,
    apiKey: process.env.TEST_API_KEY || envConfig.apiKey,
    timeout: parseInt(process.env.TEST_TIMEOUT) || envConfig.timeout,
    retryAttempts: parseInt(process.env.TEST_RETRY_ATTEMPTS) || envConfig.retryAttempts,
    totalParties: parseInt(process.env.TEST_TOTAL_PARTIES) || envConfig.totalParties,
    threshold: parseInt(process.env.TEST_THRESHOLD) || envConfig.threshold,
    environment: ENV
  };
}

// Validate configuration
function validateConfig(config) {
  const required = ['relayerUrl', 'websocketUrl', 'apiKey'];
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
  
  if (config.totalParties < config.threshold) {
    throw new Error('Total parties must be greater than or equal to threshold');
  }
  
  if (config.threshold < 2) {
    throw new Error('Threshold must be at least 2');
  }
  
  return true;
}

// Print configuration (without sensitive data)
function printConfig(config) {
  console.log('🔧 Integration Test Configuration:');
  console.log(`   Environment: ${config.environment}`);
  console.log(`   Relayer URL: ${config.relayerUrl}`);
  console.log(`   WebSocket URL: ${config.websocketUrl}`);
  console.log(`   Total Parties: ${config.totalParties}`);
  console.log(`   Threshold: ${config.threshold}`);
  console.log(`   Timeout: ${config.timeout}ms`);
  console.log(`   Retry Attempts: ${config.retryAttempts}`);
  console.log('');
}

module.exports = {
  getConfig,
  validateConfig,
  printConfig,
  ENV
}; 