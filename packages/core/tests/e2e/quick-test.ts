#!/usr/bin/env deno run --allow-all --unstable-sloppy-imports
/**
 * Quick Test Runner for DeFiShArd SDK
 * 
 * Simplified version that runs basic 2-of-2 test with minimal configuration
 */

async function quickTest() {
  console.log('🚀 DeFiShArd SDK Quick Test (2-of-2)\n');
  
  const startTime = Date.now();
  
  try {
    // Step 1: Clean and setup
    console.log('📋 Step 1: Clean and Setup...');
    await runCommand(['clear']);
    await runCommand(['setup']);
    
    // Step 2: Wait a moment for setup to complete
    await sleep(1000);
    
    // Step 3: Run keygen in parallel (all parties)
    console.log('\n📋 Step 2: Distributed Key Generation...');
    const keygenPromises = [
      runCommandAsync(['keygen', 'creator']),
      sleep(2000).then(() => runCommandAsync(['keygen', 'joiner']))
    ];
    await Promise.all(keygenPromises);
    
    // Step 4: Wait for keygen to settle
    await sleep(3000);
    
    // Step 5: Run signing in parallel (only threshold parties)
    console.log('\n📋 Step 3: Threshold Signing...');
    const signPromises = [
      runCommandAsync(['sign', 'creator', '0']),
      sleep(1000).then(() => runCommandAsync(['sign', 'joiner', '1']))
    ];
    await Promise.all(signPromises);
    
    // Step 6: Wait for signing to settle
    await sleep(3000);
    
    // Step 7: Run rotation in parallel (all parties)
    console.log('\n📋 Step 4: Key Rotation...');
    const rotationPromises = [
      runCommandAsync(['rotation', 'leader', '0']),
      sleep(1000).then(() => runCommandAsync(['rotation', 'joiner', '1']))
    ];
    await Promise.all(rotationPromises);
    
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n🎉 Quick test completed successfully in ${totalTime}s!`);
    
  } catch (error) {
    console.error('\n❌ Quick test failed:', error);
    Deno.exit(1);
  }
}

async function runCommand(args: string[]): Promise<void> {
  const cmd = new Deno.Command('deno', {
    args: [
      'run',
      '--allow-all',
      '--unstable-sloppy-imports', 
      'tests/e2e/party.ts',
      ...args
    ],
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const { code } = await cmd.output();
  
  if (code !== 0) {
    throw new Error(`Command 'party.ts ${args.join(' ')}' failed with exit code ${code}`);
  }
}

async function runCommandAsync(args: string[]): Promise<void> {
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
  
  // Stream output with command prefix
  const decoder = new TextDecoder();
  const prefix = `[${args.join(' ')}]`;
  
  // Read and display output
  const reader = process.stdout.getReader();
  let buffer = '';
  
  const readOutput = async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          console.log(`${prefix} ${line}`);
        }
      }
    }
    
    if (buffer.trim()) {
      console.log(`${prefix} ${buffer}`);
    }
  };

  const outputPromise = readOutput();
  const { code, stderr } = await process.output();
  await outputPromise;

  if (code !== 0) {
    const stderrText = decoder.decode(stderr);
    if (stderrText) {
      console.error(`${prefix} Error:`, stderrText);
    }
    throw new Error(`Command '${args.join(' ')}' failed with exit code ${code}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Handle Ctrl+C gracefully
Deno.addSignalListener('SIGINT', () => {
  console.log('\n👋 Quick test interrupted');
  Deno.exit(130);
});

if (import.meta.main) {
  await quickTest();
}
