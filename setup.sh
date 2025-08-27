#!/bin/bash

set -e

echo "🚀 Setting up DeFiShArd Monorepo..."

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install dependencies for all packages
echo "📦 Installing package dependencies..."
npm run install-all

# Build the Rust core
echo "🦀 Building Rust core..."
cd packages/core
if command -v cargo &> /dev/null; then
    cargo build --release
    echo "✅ Rust core built successfully"
else
    echo "⚠️  Cargo not found. Please install Rust to build the core."
fi
cd ../..

# Build WASM bindings
echo "🕸️  Building WASM bindings..."
cd packages/core
if command -v wasm-pack &> /dev/null; then
    wasm-pack build --target web --out-dir ../sdk/pkg
    echo "✅ WASM bindings built successfully"
else
    echo "⚠️  wasm-pack not found. Please install wasm-pack to build WASM bindings."
fi
cd ../..

# Build the cross-platform SDK
echo "🛠️  Building SDK for all platforms..."
cd packages/sdk
npm run build
echo "✅ SDK built for all platforms"
cd ../..

# Build the extension
echo "🔧 Building extension..."
cd packages/extension
npm run build
echo "✅ Extension built successfully"
cd ../..

echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "  • Extension: Load packages/extension as unpacked extension in Chrome"
echo "  • Web App: cd packages/web && npm run dev"
echo "  • Mobile: cd packages/mobile && npm run android/ios"
echo ""
echo "To rebuild everything: npm run build:all"
