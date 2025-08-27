const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './sdk-bundler.js',
  output: {
    path: path.resolve(__dirname, 'public/sdk'),
    filename: 'defishard-sdk.bundle.js',
    library: 'DeFiShArdSDK',
    libraryTarget: 'window',
  },
  mode: 'development',
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
            presets: ['@babel/preset-env']
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
    ],
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
  ],
  experiments: {
    asyncWebAssembly: true,
  }
};
