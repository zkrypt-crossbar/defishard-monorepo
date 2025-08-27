#!/bin/bash

# DeFiShArd Web App - Server Deployment Script
# Run this script on your remote server after cloning the repository

set -e  # Exit on any error

echo "🚀 DeFiShArd Web App - Server Deployment"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js v16 or higher first."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    print_error "Node.js version 16 or higher is required. Current version: $(node --version)"
    exit 1
fi

print_success "Node.js version: $(node --version)"

# Step 1: Install dependencies
print_status "Installing dependencies..."
npm install
print_success "Dependencies installed"

# Step 2: Build SDK bundle
print_status "Building SDK bundle..."
npm run bundle-sdk

# Check if SDK bundle was created
if [ ! -f "public/sdk/defishard-sdk.bundle.js" ]; then
    print_error "SDK bundle was not created successfully!"
    exit 1
fi
print_success "SDK bundle created"

# Step 3: Build production app
print_status "Building production app..."
npm run build

# Check if build was successful
if [ ! -d "build" ]; then
    print_error "Build failed! build/ directory not found."
    exit 1
fi
print_success "Production build completed"

# Step 4: Set up web server directory
print_status "Setting up web server directory..."
sudo mkdir -p /var/www/defishard-web-app
sudo cp -r build/* /var/www/defishard-web-app/
sudo chown -R www-data:www-data /var/www/defishard-web-app
sudo chmod -R 755 /var/www/defishard-web-app
print_success "Web directory configured"

# Step 5: Install and configure Nginx
print_status "Installing and configuring Nginx..."

# Update package list
sudo apt update -y

# Install nginx
sudo apt install nginx -y

# Copy nginx configuration
sudo cp nginx.conf /etc/nginx/sites-available/defishard-web-app

# Enable the site
sudo ln -sf /etc/nginx/sites-available/defishard-web-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
if sudo nginx -t; then
    print_success "Nginx configuration is valid"
else
    print_error "Nginx configuration test failed!"
    exit 1
fi

# Restart nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
print_success "Nginx configured and started"

# Step 6: Configure firewall
print_status "Configuring firewall..."
sudo ufw allow 'Nginx Full' 2>/dev/null || true
sudo ufw allow ssh 2>/dev/null || true
sudo ufw --force enable 2>/dev/null || true
print_success "Firewall configured"

# Step 7: Test deployment
print_status "Testing deployment..."

# Check nginx status
if sudo systemctl is-active --quiet nginx; then
    print_success "Nginx is running"
else
    print_error "Nginx is not running!"
    exit 1
fi

# Test health endpoint
if curl -s http://localhost/health.html | grep -q "OK"; then
    print_success "Health check passed"
else
    print_warning "Health check failed (this might be normal if health.html doesn't exist)"
fi

# Get server IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")

print_success "Deployment completed successfully!"
echo ""
echo "🌐 Your web app is now accessible at:"
echo "   http://$SERVER_IP"
echo ""
echo "📋 Next steps:"
echo "1. Open your browser and go to http://$SERVER_IP"
echo "2. Go to Settings page"
echo "3. Configure your relay server URLs:"
echo "   - Relayer URL: https://your-relay-server.com"
echo "   - WebSocket URL: wss://your-relay-server.com"
echo "4. Test keygen and signing flows"
echo ""
print_warning "Remember to configure the relayer URLs in the web app settings!"

# Optional: SSL setup
read -p "Do you want to set up SSL with Let's Encrypt? (y/n): " setup_ssl

if [[ $setup_ssl =~ ^[Yy]$ ]]; then
    read -p "Enter your domain name: " domain_name
    
    if [ ! -z "$domain_name" ]; then
        print_status "Setting up SSL certificate for $domain_name..."
        
        # Install certbot
        sudo apt install certbot python3-certbot-nginx -y
        
        # Get SSL certificate
        if sudo certbot --nginx -d "$domain_name" --non-interactive --agree-tos --email "admin@$domain_name"; then
            print_success "SSL certificate installed successfully!"
            echo "🌐 Your web app is now accessible at: https://$domain_name"
        else
            print_warning "SSL certificate installation failed. You can try manually later."
        fi
    else
        print_warning "No domain provided. SSL setup skipped."
    fi
fi

echo ""
print_success "Deployment script completed!"
