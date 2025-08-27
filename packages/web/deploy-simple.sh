#!/bin/bash

# Simple One-Command Remote Deployment
# Usage: ./deploy-simple.sh username@server-ip [domain]

if [ $# -lt 1 ]; then
    echo "Usage: $0 username@server-ip [domain]"
    echo "Example: $0 user@192.168.1.100"
    echo "Example: $0 user@myserver.com mydomain.com"
    exit 1
fi

SERVER=$1
DOMAIN=$2

echo "🚀 Deploying DeFiShArd Web App to $SERVER..."

# Build locally
echo "📦 Building production app..."
./deploy.sh

# Create temporary deployment directory
TEMP_DIR=$(mktemp -d)
cp -r build/* $TEMP_DIR/
cp nginx.conf $TEMP_DIR/

# Upload to server
echo "📤 Uploading to server..."
scp -r $TEMP_DIR/* $SERVER:/tmp/webapp/

# Setup on server
echo "🔧 Setting up server..."
ssh $SERVER "
sudo apt update -y
sudo apt install nginx -y
sudo mkdir -p /var/www/defishard-web-app
sudo cp -r /tmp/webapp/* /var/www/defishard-web-app/
sudo chown -R www-data:www-data /var/www/defishard-web-app
sudo chmod -R 755 /var/www/defishard-web-app
sudo cp /tmp/webapp/nginx.conf /etc/nginx/sites-available/defishard-web-app
sudo ln -sf /etc/nginx/sites-available/defishard-web-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
sudo ufw allow 'Nginx Full' 2>/dev/null || true
"

# SSL setup if domain provided
if [ ! -z "$DOMAIN" ]; then
    echo "🔒 Setting up SSL for $DOMAIN..."
    ssh $SERVER "
    sudo apt install certbot python3-certbot-nginx -y
    sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
    "
fi

# Cleanup
rm -rf $TEMP_DIR
ssh $SERVER "rm -rf /tmp/webapp"

echo "✅ Deployment completed!"
if [ ! -z "$DOMAIN" ]; then
    echo "🌐 Access your app at: https://$DOMAIN"
else
    echo "🌐 Access your app at: http://$(echo $SERVER | cut -d@ -f2)"
fi
echo "📋 Don't forget to configure relayer URLs in the web app settings!"
