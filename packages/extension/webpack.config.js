const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './extension-sdk-bundler.js',
  output: {
    path: path.resolve(__dirname, 'assets/sdk-bundle'),
    filename: 'defishard-sdk-extension.js',
    library: {
      name: 'DeFiShArdSDK',
      type: 'umd',
      export: 'default'
    },
    globalObject: 'globalThis',
    clean: true
  },
  resolve: {
    extensions: ['.js', '.ts'],
    fallback: {
      crypto: require.resolve('crypto-browserify'),
      buffer: require.resolve('buffer/'),
      stream: require.resolve('stream-browserify'),
      path: require.resolve('path-browserify'),
      events: require.resolve('events/'),
      util: require.resolve('util/'),
      fs: false,
      os: require.resolve('os-browserify/browser'),
      process: require.resolve('process/browser'),
      vm: require.resolve('vm-browserify'),
    },
    alias: {
      'node:events': 'events',
      'node:util': 'util',
      'node:buffer': 'buffer',
      'node:stream': 'stream-browserify',
      'node:path': 'path-browserify',
      'node:crypto': 'crypto-browserify',
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  chrome: '88'
                }
              }]
            ]
          }
        }
      },
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.wasm$/,
        type: 'asset/resource',
      },
    ]
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
    new webpack.NormalModuleReplacementPlugin(
      /^node:/,
      (resource) => {
        const mod = resource.request.replace(/^node:/, '');
        resource.request = mod;
      }
    ),
    // Copy REAL WASM files from monorepo core package
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, '../core/pkg/*.wasm'),
          to: path.resolve(__dirname, 'assets/sdk-bundle/[name][ext]')
        }
      ]
    }),
    // Define environment-specific constants
    new webpack.DefinePlugin({
      'process.env.EXTENSION_ENV': JSON.stringify('service-worker')
    }),
  ],
  experiments: {
    asyncWebAssembly: true,
  },
  optimization: {
    minimize: false // Keep readable for debugging
  },
  devtool: 'source-map'
};
