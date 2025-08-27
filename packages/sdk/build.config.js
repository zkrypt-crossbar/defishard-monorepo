const { build } = require('esbuild');
const path = require('path');

const baseConfig = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: false,
  minify: true,
  target: 'es2020',
  external: [
    // External dependencies that should not be bundled
    '@react-native-async-storage/async-storage'
  ],
};

const targets = [
  // Web target - ES modules for modern browsers
  {
    ...baseConfig,
    format: 'esm',
    platform: 'browser',
    outfile: 'dist/web/index.js',
    define: {
      'process.env.PLATFORM': '"web"',
      'global': 'globalThis'
    },
  },
  
  // Extension target - IIFE for service workers
  {
    ...baseConfig,
    format: 'iife',
    platform: 'browser',
    globalName: 'DeFiShArdSDK',
    outfile: 'dist/extension/index.js',
    define: {
      'process.env.PLATFORM': '"extension"',
      'global': 'globalThis'
    },
    // Service workers need special handling
    banner: {
      js: '// DeFiShArd SDK for Browser Extensions\n',
    },
  },
  
  // Mobile target - CommonJS for React Native
  {
    ...baseConfig,
    format: 'cjs',
    platform: 'node',
    outfile: 'dist/mobile/index.js',
    external: [
      ...baseConfig.external,
      // React Native externals
      'react-native',
      'react',
    ],
    define: {
      'process.env.PLATFORM': '"mobile"',
    },
  },
  
  // Node.js target - for server-side usage
  {
    ...baseConfig,
    format: 'cjs',
    platform: 'node',
    outfile: 'dist/node/index.js',
    define: {
      'process.env.PLATFORM': '"node"',
    },
  },
];

async function buildAll() {
  console.log('🔨 Building DeFiShArd SDK for all platforms...');
  
  try {
    await Promise.all(
      targets.map(async (config) => {
        console.log(`📦 Building ${config.outfile}...`);
        await build(config);
        console.log(`✅ Built ${config.outfile}`);
      })
    );
    
    console.log('🎉 All builds completed successfully!');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run the build
buildAll();
