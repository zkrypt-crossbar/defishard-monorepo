#!/usr/bin/env deno run --allow-all --unstable-sloppy-imports
/**
 * Automated Test Runner for DeFiShArd SDK
 * 
 * This script automatically runs the complete flow:
 * 1. Setup -> 2. Keygen -> 3. Sign -> 4. Rotation
 * 
 * Usage:
 *   deno run --allow-all --unstable-sloppy-imports tests/e2e/auto-test.ts [options]
 * 
 * Options:
 *   --threshold=N    Set threshold (default: 2)
 *   --parties=N      Set total parties (default: 2) 
 *   --timeout=N      Set timeout in seconds (default: 60)
 *   --skip-setup     Skip setup step (use existing setup-data.json)
 *   --skip-keygen    Skip keygen step (use existing keyshares)
 *   --skip-sign      Skip signing step
 *   --skip-rotation  Skip rotation step
 *   --only=STEP      Only run specific step (setup|keygen|sign|rotation)
 *   --clean          Clean storage before starting
 *   --help           Show this help
 */

import { DeFiShArdSDK } from '../../js/index.ts';

// Default configuration
const DEFAULT_CONFIG = {
  threshold: 2,
  totalParties: 2,
  timeout: 60,
  delay: 2000, // Delay between party starts (ms)
  maxWaitTime: 120000, // Max wait time for completion (ms)
};

// Parse command line arguments
const args = Deno.args;
const config = { ...DEFAULT_CONFIG };
const flags = {
  skipSetup: false,
  skipKeygen: false,
  skipSign: false,
  skipRotation: false,
  only: null as string | null,
  clean: false,
  help: false,
};

// Parse arguments
for (const arg of args) {
  if (arg.startsWith('--threshold=')) {
    config.threshold = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('--parties=')) {
    config.totalParties = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('--timeout=')) {
    config.timeout = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('--only=')) {
    flags.only = arg.split('=')[1];
  } else if (arg === '--skip-setup') {
    flags.skipSetup = true;
  } else if (arg === '--skip-keygen') {
    flags.skipKeygen = true;
  } else if (arg === '--skip-sign') {
    flags.skipSign = true;
  } else if (arg === '--skip-rotation') {
    flags.skipRotation = true;
  } else if (arg === '--clean') {
    flags.clean = true;
  } else if (arg === '--help') {
    flags.help = true;
  }
}

if (flags.help) {
  console.log(`
🚀 DeFiShArd SDK Automated Test Runner

Usage:
  deno run --allow-all --unstable-sloppy-imports tests/e2e/auto-test.ts [options]

Options:
  --threshold=N    Set threshold (default: ${DEFAULT_CONFIG.threshold})
  --parties=N      Set total parties (default: ${DEFAULT_CONFIG.totalParties}) 
  --timeout=N      Set timeout in seconds (default: ${DEFAULT_CONFIG.timeout})
  --skip-setup     Skip setup step (use existing setup-data.json)
  --skip-keygen    Skip keygen step (use existing keyshares)
  --skip-sign      Skip signing step
  --skip-rotation  Skip rotation step
  --only=STEP      Only run specific step (setup|keygen|sign|rotation)
  --clean          Clean storage before starting
  --help           Show this help

Examples:
  # Full test with default 2-of-2 setup
  auto-test.ts

  # 3-of-5 threshold test
  auto-test.ts --threshold=3 --parties=5

  # Only run signing test (requires existing keyshares)
  auto-test.ts --only=sign

  # Skip setup and keygen, only test sign + rotation
  auto-test.ts --skip-setup --skip-keygen

  # Clean start with 2-of-3 setup
  auto-test.ts --clean --threshold=2 --parties=3
`);
  Deno.exit(0);
}

// Validate configuration
if (config.threshold > config.totalParties) {
  console.error('❌ Threshold cannot be greater than total parties');
  Deno.exit(1);
}

if (config.threshold < 1 || config.totalParties < 1) {
  console.error('❌ Threshold and total parties must be at least 1');
  Deno.exit(1);
}

// Main test runner
async function main() {
  console.log('🚀 DeFiShArd SDK Automated Test Runner\n');
  console.log(`📋 Configuration:`);
  console.log(`   Threshold: ${config.threshold}`);
  console.log(`   Total Parties: ${config.totalParties}`);
  console.log(`   Timeout: ${config.timeout}s`);
  console.log(`   Only: ${flags.only || 'all steps'}`);
  console.log();

  try {
    const startTime = Date.now();

    // Step 1: Always clean storage first
    await runStep('Clean Storage', () => runCommand(['clear']));

    // Step 2: Setup (if not skipped and not only-mode or only=setup)
    if (!flags.skipSetup && (!flags.only || flags.only === 'setup')) {
      await runStep('Setup', () => runCommand(['setup', config.threshold.toString(), config.totalParties.toString()]));
    }

    // Step 3: Keygen (if not skipped and not only-mode or only=keygen)  
    if (!flags.skipKeygen && (!flags.only || flags.only === 'keygen')) {
      await runStep('Distributed Key Generation', () => runParallelCommands('keygen'));
    }

    // Step 4: Signing (if not skipped and not only-mode or only=sign)
    if (!flags.skipSign && (!flags.only || flags.only === 'sign')) {
      await runStep('Threshold Signing', () => runParallelCommands('sign'));
    }

    // Step 5: Key Rotation (if not skipped and not only-mode or only=rotation)
    if (!flags.skipRotation && (!flags.only || flags.only === 'rotation')) {
      await runStep('Key Rotation', () => runParallelCommands('rotation'));
    }

    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n🎉 All tests completed successfully in ${totalTime}s!`);
    console.log('✅ SDK is working correctly across all protocols');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    Deno.exit(1);
  }
}

/**
 * Run a test step with timing and error handling
 */
async function runStep(stepName: string, stepFn: () => Promise<void>): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 Step: ${stepName}`);
  console.log(`${'='.repeat(60)}`);
  
  const stepStart = Date.now();
  
  try {
    await stepFn();
    const stepTime = Math.round((Date.now() - stepStart) / 1000);
    console.log(`\n✅ ${stepName} completed in ${stepTime}s`);
  } catch (error) {
    const stepTime = Math.round((Date.now() - stepStart) / 1000);
    console.error(`\n❌ ${stepName} failed after ${stepTime}s:`, error);
    throw error;
  }
}

/**
 * Run a single party.ts command
 */
async function runCommand(args: string[]): Promise<void> {
  console.log(`\n🚀 Running: party.ts ${args.join(' ')}`);
  
  const cmd = new Deno.Command('deno', {
    args: [
      'run',
      '--allow-all',
      '--unstable-sloppy-imports',
      'tests/e2e/party.ts',
      ...args
    ],
    stdout: 'piped',
    stderr: 'piped',
  });

  const process = cmd.spawn();
  const { code, stdout, stderr } = await process.output();

  const stdoutText = new TextDecoder().decode(stdout);
  const stderrText = new TextDecoder().decode(stderr);

  if (stdoutText) {
    console.log(stdoutText);
  }

  if (code !== 0) {
    if (stderrText) {
      console.error('Error output:', stderrText);
    }
    throw new Error(`Command failed with exit code ${code}`);
  }
}

/**
 * Run multiple party commands in parallel (creator + joiners)
 */
async function runParallelCommands(operation: 'keygen' | 'sign' | 'rotation'): Promise<void> {
  const commands: string[][] = [];
  
  // For signing, only use threshold number of parties
  // For keygen and rotation, use all parties
  const partyCount = (operation === 'sign') ? config.threshold : config.totalParties;
  
  // Create commands for each party
  for (let i = 0; i < partyCount; i++) {
    const role = i === 0 ? 'creator' : 'joiner';
    const args = [operation, role];
    
    // Add index for sign and rotation operations
    if (operation === 'sign' || operation === 'rotation') {
      args.push(i.toString());
    }
    
    commands.push(args);
  }

  console.log(`\n🚀 Starting ${partyCount} parties for ${operation}...`);
  
  // Start all parties in parallel with staggered delays
  const processes: Promise<void>[] = [];
  
  for (let i = 0; i < commands.length; i++) {
    const delay = i * config.delay; // Stagger starts
    
    const processPromise = (async () => {
      if (delay > 0) {
        console.log(`⏳ Waiting ${delay}ms before starting party ${i}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      console.log(`\n📋 Starting Party ${i} (${commands[i][1]}): party.ts ${commands[i].join(' ')}`);
      await runPartyCommand(commands[i], i);
    })();
    
    processes.push(processPromise);
  }

  // Wait for all parties to complete with timeout
  await Promise.race([
    Promise.all(processes),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${config.maxWaitTime}ms`));
      }, config.maxWaitTime);
    })
  ]);

  console.log(`\n✅ All ${partyCount} parties completed ${operation}`);
}

/**
 * Run a single party command with proper output handling
 */
async function runPartyCommand(args: string[], partyIndex: number): Promise<void> {
  const cmd = new Deno.Command('deno', {
    args: [
      'run',
      '--allow-all', 
      '--unstable-sloppy-imports',
      'tests/e2e/party.ts',
      ...args
    ],
    stdout: 'piped',
    stderr: 'piped',
  });

  const process = cmd.spawn();
  
  // Stream output with party prefix
  const decoder = new TextDecoder();
  const partyPrefix = `[Party-${partyIndex}]`;
  
  // Read both stdout and stderr concurrently
  const readStream = async (stream: ReadableStream<Uint8Array>, isError: boolean = false) => {
    const reader = stream.getReader();
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            if (isError) {
              console.error(`${partyPrefix} ERROR: ${line}`);
            } else {
              console.log(`${partyPrefix} ${line}`);
            }
          }
        }
      }
      
      // Print any remaining buffer
      if (buffer.trim()) {
        if (isError) {
          console.error(`${partyPrefix} ERROR: ${buffer}`);
        } else {
          console.log(`${partyPrefix} ${buffer}`);
        }
      }
    } finally {
      reader.releaseLock();
    }
  };

  // Start reading both streams
  const stdoutPromise = readStream(process.stdout, false);
  const stderrPromise = readStream(process.stderr, true);
  
  // Wait for process completion and stream reading
  const [status] = await Promise.all([
    process.status,
    stdoutPromise,
    stderrPromise
  ]);

  if (status.code !== 0) {
    throw new Error(`Party ${partyIndex} failed with exit code ${status.code}`);
  }
}

/**
 * Handle graceful shutdown
 */
Deno.addSignalListener('SIGINT', () => {
  console.log('\n\n👋 Auto-test interrupted. Cleaning up...');
  Deno.exit(130);
});

// Run the main function
if (import.meta.main) {
  await main();
}
