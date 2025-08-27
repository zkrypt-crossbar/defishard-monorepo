#!/bin/bash

# DeFiShArd Web App Deployment Script
# This script builds and prepares the web app for deployment

set -e  # Exit on any error

echo "🚀 Starting DeFiShArd Web App Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the defishard-web-app directory."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    print_error "Node.js version 16 or higher is required. Current version: $(node --version)"
    exit 1
fi

print_success "Node.js version: $(node --version)"

# Clean previous builds
print_status "Cleaning previous builds..."
rm -rf build/
rm -rf public/sdk/defishard-sdk.bundle.js

# Install dependencies
print_status "Installing dependencies..."
npm install

# Build SDK bundle
print_status "Building SDK bundle..."
npm run bundle-sdk

# Check if SDK bundle was created
if [ ! -f "public/sdk/defishard-sdk.bundle.js" ]; then
    print_error "SDK bundle was not created successfully!"
    exit 1
fi

print_success "SDK bundle created successfully"

# Build production app
print_status "Building production app..."
npm run build

# Check if build was successful
if [ ! -d "build" ]; then
    print_error "Build failed! build/ directory not found."
    exit 1
fi

print_success "Production build completed successfully!"

# Show build statistics
BUILD_SIZE=$(du -sh build/ | cut -f1)
print_status "Build size: $BUILD_SIZE"

# List important files
print_status "Important files in build/:"
ls -la build/ | head -10

# Check for environment variables
if [ -f ".env.production" ]; then
    print_success "Production environment file found"
else
    print_warning "No .env.production file found. You may need to configure production URLs."
fi

# Deployment options
echo ""
print_status "Deployment options:"
echo "1. Static hosting (Netlify, Vercel, GitHub Pages)"
echo "2. Traditional web server (Apache, Nginx)"
echo "3. Docker container"
echo "4. Manual deployment"
echo ""

read -p "Choose deployment method (1-4): " choice

case $choice in
    1)
        print_status "For static hosting deployment:"
        echo "1. Upload the 'build/' directory to your hosting service"
        echo "2. Configure your hosting service to serve from 'build/'"
        echo "3. Set up custom domain if needed"
        echo "4. Update relayer URLs in the web app settings"
        ;;
    2)
        print_status "For traditional web server deployment:"
        echo "1. Copy the 'build/' directory to your web server"
        echo "2. Configure your web server (see DEPLOYMENT.md for examples)"
        echo "3. Set up SSL certificate for HTTPS"
        echo "4. Update relayer URLs in the web app settings"
        ;;
    3)
        print_status "For Docker deployment:"
        echo "1. Build Docker image: docker build -t defishard-web-app ."
        echo "2. Run container: docker run -p 80:80 defishard-web-app"
        echo "3. Update relayer URLs in the web app settings"
        ;;
    4)
        print_status "For manual deployment:"
        echo "1. The 'build/' directory contains your production files"
        echo "2. Copy these files to your web server"
        echo "3. Configure your web server to serve these files"
        echo "4. Update relayer URLs in the web app settings"
        ;;
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

echo ""
print_success "Build process completed successfully!"
print_status "Next steps:"
echo "1. Deploy the 'build/' directory to your chosen platform"
echo "2. Configure your relay server URLs in the web app settings"
echo "3. Test the deployment thoroughly"
echo "4. Monitor performance and logs"

echo ""
print_warning "Remember to update the relayer URLs in the web app settings after deployment!"
