#!/bin/bash

# Quick DeFiShArd Web App Deployment
# One-liner deployment script for remote server

echo "🚀 Quick DeFiShArd Web App Deployment"

# Check if in right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this from defishard-web-app directory"
    exit 1
fi

# Install, build, and deploy
echo "📦 Installing dependencies..."
npm install

echo "🔧 Building SDK bundle..."
npm run bundle-sdk

echo "🏗️ Building production app..."
npm run build

echo "📁 Setting up web server..."
sudo mkdir -p /var/www/defishard-web-app
sudo cp -r build/* /var/www/defishard-web-app/
sudo chown -R www-data:www-data /var/www/defishard-web-app
sudo chmod -R 755 /var/www/defishard-web-app

echo "🌐 Installing and configuring Nginx..."
sudo apt update -y && sudo apt install nginx -y
sudo cp nginx.conf /etc/nginx/sites-available/defishard-web-app
sudo ln -sf /etc/nginx/sites-available/defishard-web-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

echo "🔥 Configuring firewall..."
sudo ufw allow 'Nginx Full' 2>/dev/null || true
sudo ufw allow ssh 2>/dev/null || true

echo "✅ Deployment completed!"
echo "🌐 Access your app at: http://$(curl -s ifconfig.me 2>/dev/null || echo 'localhost')"
echo "📋 Don't forget to configure relayer URLs in the web app settings!"
