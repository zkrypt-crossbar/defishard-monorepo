#!/usr/bin/env node

/**
 * Main test runner for DefiShard SDK
 * Run with: node tests/test-runner.js
 */

const { execSync } = require('child_process');
const path = require('path');

class TestRunner {
  constructor() {
    this.results = [];
    this.totalTests = 0;
    this.passedTests = 0;
  }

  async runTestSuite(name, testFile) {
    console.log(`\n🧪 Running ${name}...`);
    
    try {
      const output = execSync(`node ${testFile}`, { 
        encoding: 'utf8',
        cwd: __dirname 
      });
      
      // Parse test results from output
      const lines = output.split('\n');
      const summaryLine = lines.find(line => line.includes('Success Rate:'));
      
      if (summaryLine) {
        const match = summaryLine.match(/Success Rate: ([\d.]+)%/);
        const successRate = parseFloat(match[1]);
        
        if (successRate === 100) {
          console.log(`✅ ${name}: All tests passed`);
          this.passedTests++;
        } else {
          console.log(`❌ ${name}: ${successRate}% success rate`);
        }
        
        this.totalTests++;
        this.results.push({ name, successRate, output });
      } else {
        console.log(`❌ ${name}: Could not parse results`);
        this.totalTests++;
        this.results.push({ name, successRate: 0, output });
      }
    } catch (error) {
      console.log(`❌ ${name}: Failed to run`);
      console.error(error.message);
      this.totalTests++;
      this.results.push({ name, successRate: 0, error: error.message });
    }
  }

  printSummary() {
    console.log('\n📊 Overall Test Summary:');
    console.log(`Total Test Suites: ${this.totalTests}`);
    console.log(`Passed: ${this.passedTests}`);
    console.log(`Failed: ${this.totalTests - this.passedTests}`);
    
    if (this.totalTests > 0) {
      const overallSuccessRate = ((this.passedTests / this.totalTests) * 100).toFixed(1);
      console.log(`Overall Success Rate: ${overallSuccessRate}%`);
    }
    
    if (this.results.some(r => r.successRate < 100)) {
      console.log('\n❌ Failed Test Suites:');
      this.results.filter(r => r.successRate < 100).forEach(result => {
        console.log(`  - ${result.name}: ${result.successRate}% success rate`);
      });
    }
  }
}

async function runAllTests() {
  const runner = new TestRunner();
  
  console.log('🚀 DefiShard SDK Test Suite');
  console.log('============================');
  
  // Run unit tests
  await runner.runTestSuite('Unit Tests - Storage', 'unit/storage.test.js');
  await runner.runTestSuite('Unit Tests - KeygenProcessor', 'unit/keygen-processor.test.js');
  await runner.runTestSuite('Unit Tests - SignProcessor', 'unit/sign-processor.test.js');
  
  // Run integration tests (if they exist)
  const fs = require('fs');
  const path = require('path');
  
  if (fs.existsSync(path.join(__dirname, 'integration/sdk-integration.test.js'))) {
    await runner.runTestSuite('Integration Tests', 'integration/sdk-integration.test.js');
  } else {
    console.log('⚠️  Basic integration tests not found, skipping...');
  }
  
  if (fs.existsSync(path.join(__dirname, 'integration/full-flow.test.js'))) {
    await runner.runTestSuite('Full Flow Integration Tests', 'integration/full-flow.test.js');
  } else if (fs.existsSync(path.join(__dirname, 'integration/full-flow-mock.test.js'))) {
    await runner.runTestSuite('Full Flow Integration Tests (Mock)', 'integration/full-flow-mock.test.js');
  } else {
    console.log('⚠️  Full flow integration tests not found, skipping...');
  }
  
  if (fs.existsSync(path.join(__dirname, 'integration/multi-party.test.js'))) {
    await runner.runTestSuite('Multi-Party Integration Tests', 'integration/multi-party.test.js');
  } else if (fs.existsSync(path.join(__dirname, 'integration/threshold-signing.test.js'))) {
    await runner.runTestSuite('Threshold Signing Integration Tests', 'integration/threshold-signing.test.js');
  } else {
    console.log('⚠️  Multi-party integration tests not found, skipping...');
  }
  
  // Run E2E tests (if they exist)
  if (fs.existsSync(path.join(__dirname, 'e2e/real-backend.test.js'))) {
    await runner.runTestSuite('Real E2E Tests', 'e2e/real-backend.test.js');
  } else if (fs.existsSync(path.join(__dirname, 'e2e/e2e.test.js'))) {
    await runner.runTestSuite('E2E Tests', 'e2e/e2e.test.js');
  } else {
    console.log('⚠️  E2E tests not found, skipping...');
  }
  
  runner.printSummary();
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { TestRunner, runAllTests }; 