#!/bin/bash

# Remote Server Deployment Helper Script
# This script helps you deploy the web app to a remote server

set -e

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

echo "🚀 Remote Server Deployment Helper"
echo "=================================="

# Get server details
read -p "Enter server IP or domain: " SERVER_IP
read -p "Enter SSH username: " SSH_USER
read -p "Enter domain name (optional, press Enter to skip): " DOMAIN_NAME

# Build locally first
print_status "Building production app locally..."
./deploy.sh

if [ ! -d "build" ]; then
    print_error "Build failed! Please run ./deploy.sh first."
    exit 1
fi

print_success "Local build completed!"

# Create deployment package
print_status "Creating deployment package..."
DEPLOY_DIR="deploy-package-$(date +%Y%m%d_%H%M%S)"
mkdir -p $DEPLOY_DIR
cp -r build/* $DEPLOY_DIR/
cp nginx.conf $DEPLOY_DIR/

# Create server setup script
cat > $DEPLOY_DIR/setup-server.sh << 'EOF'
#!/bin/bash

# Server setup script
set -e

echo "Setting up DeFiShArd Web App on server..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install required software
sudo apt install nginx git curl -y

# Create web directory
sudo mkdir -p /var/www/defishard-web-app

# Copy files
sudo cp -r * /var/www/defishard-web-app/

# Set permissions
sudo chown -R www-data:www-data /var/www/defishard-web-app
sudo chmod -R 755 /var/www/defishard-web-app

# Configure nginx
sudo cp nginx.conf /etc/nginx/sites-available/defishard-web-app

# Enable site
sudo ln -sf /etc/nginx/sites-available/defishard-web-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and restart nginx
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# Configure firewall
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw --force enable

echo "Server setup completed!"
echo "Your web app should be accessible at: http://$(curl -s ifconfig.me)"
EOF

chmod +x $DEPLOY_DIR/setup-server.sh

print_success "Deployment package created: $DEPLOY_DIR"

# Upload to server
print_status "Uploading files to server..."
scp -r $DEPLOY_DIR $SSH_USER@$SERVER_IP:/tmp/

# Run setup on server
print_status "Setting up server..."
ssh $SSH_USER@$SERVER_IP "cd /tmp/$DEPLOY_DIR && ./setup-server.sh"

# SSL setup if domain provided
if [ ! -z "$DOMAIN_NAME" ]; then
    print_status "Setting up SSL certificate for $DOMAIN_NAME..."
    ssh $SSH_USER@$SERVER_IP "sudo apt install certbot python3-certbot-nginx -y"
    ssh $SSH_USER@$SERVER_IP "sudo certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos --email admin@$DOMAIN_NAME"
    print_success "SSL certificate installed!"
fi

# Cleanup
rm -rf $DEPLOY_DIR

print_success "Deployment completed!"
echo ""
echo "🌐 Your web app is now accessible at:"
if [ ! -z "$DOMAIN_NAME" ]; then
    echo "   https://$DOMAIN_NAME"
else
    echo "   http://$SERVER_IP"
fi
echo ""
echo "📋 Next steps:"
echo "1. Configure relayer URLs in the web app settings"
echo "2. Test keygen and signing flows"
echo "3. Set up monitoring and backups"
echo ""
print_warning "Remember to update the relayer URLs in the web app settings!"
