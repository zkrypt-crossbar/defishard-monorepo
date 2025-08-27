#!/bin/bash

# DeFiShArd SDK Update Script
# This script builds the SDK and updates the web app bundle

set -e  # Exit on any error

echo "🚀 Starting DeFiShArd SDK update process..."

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK_DIR="$SCRIPT_DIR"
WEB_APP_DIR="$SCRIPT_DIR/../defishard-web-app"

echo "📁 SDK Directory: $SDK_DIR"
echo "📁 Web App Directory: $WEB_APP_DIR"

# Step 1: Build the SDK JavaScript files
echo "🔨 Step 1: Building SDK JavaScript files..."
cd "$SDK_DIR/js"
if ! npm run build:js; then
    echo "❌ Failed to build SDK JavaScript files"
    exit 1
fi
echo "✅ SDK JavaScript files built successfully"

# Step 2: Copy files to web app
echo "📋 Step 2: Copying files to web app..."
if [ ! -d "$WEB_APP_DIR/public/sdk" ]; then
    echo "❌ Web app SDK directory not found: $WEB_APP_DIR/public/sdk"
    exit 1
fi

cp -r ../dist/* "$WEB_APP_DIR/public/sdk/"
echo "✅ Files copied to web app"

# Step 3: Rebuild the web app bundle
echo "📦 Step 3: Rebuilding web app bundle..."
cd "$WEB_APP_DIR"
if ! npm run bundle-sdk; then
    echo "❌ Failed to rebuild web app bundle"
    exit 1
fi
echo "✅ Web app bundle rebuilt successfully"

# Step 4: Show summary
echo ""
echo "🎉 SDK update completed successfully!"
echo ""
echo "📋 Summary:"
echo "  ✅ SDK TypeScript compiled to JavaScript"
echo "  ✅ Files copied to web app"
echo "  ✅ Web app bundle rebuilt"
echo ""
echo "🔄 Next steps:"
echo "  • Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)"
echo "  • Or restart the web app if needed"
echo ""
echo "📁 Updated files:"
echo "  • $SDK_DIR/dist/ (compiled JavaScript)"
echo "  • $WEB_APP_DIR/public/sdk/ (copied files)"
echo "  • $WEB_APP_DIR/public/sdk/defishard-sdk.bundle.js (bundled)"
echo ""
