# 🖥️ Remote Server Deployment Guide

## 📋 Prerequisites

### Server Requirements
- **Linux server** (Ubuntu 20.04+ recommended)
- **SSH access** to the server
- **Domain name** (optional but recommended)
- **SSL certificate** (Let's Encrypt recommended)

### Local Requirements
- **SSH client** (built into macOS/Linux, PuTTY for Windows)
- **SCP/SFTP client** (FileZilla, WinSCP, or command line)
- **Git** (for version control)

---

## 🚀 Step-by-Step Deployment

### Step 1: Prepare Your Local Build

```bash
# On your local machine
cd defishard-web-app

# Build the production app
./deploy.sh

# Verify build was successful
ls -la build/
```

### Step 2: Connect to Your Remote Server

```bash
# SSH into your server
ssh username@your-server-ip

# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required software
sudo apt install nginx git curl -y
```

### Step 3: Set Up Web Server Directory

```bash
# Create web directory
sudo mkdir -p /var/www/defishard-web-app

# Set proper permissions
sudo chown -R $USER:$USER /var/www/defishard-web-app
sudo chmod -R 755 /var/www/defishard-web-app
```

### Step 4: Upload Files to Server

#### Option A: Using SCP (Command Line)
```bash
# From your local machine
scp -r build/* username@your-server-ip:/var/www/defishard-web-app/
```

#### Option B: Using SFTP Client
1. Connect to your server via SFTP
2. Navigate to `/var/www/defishard-web-app/`
3. Upload all files from your local `build/` directory

#### Option C: Using Git (Recommended)
```bash
# On your server
cd /var/www/
sudo git clone https://github.com/your-username/defishard-web-app.git
cd defishard-web-app
sudo npm install
sudo npm run bundle-sdk
sudo npm run build
sudo cp -r build/* /var/www/defishard-web-app/
```

### Step 5: Configure Nginx

```bash
# Create nginx configuration
sudo nano /etc/nginx/sites-available/defishard-web-app
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    root /var/www/defishard-web-app;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Handle React Router
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Cache WASM files
    location ~* \.wasm$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Content-Type application/wasm;
        access_log off;
    }

    # Health check
    location /health.html {
        access_log off;
        return 200 "OK";
        add_header Content-Type text/plain;
    }

    # Security: deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

### Step 6: Enable the Site

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/defishard-web-app /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx

# Enable nginx to start on boot
sudo systemctl enable nginx
```

### Step 7: Set Up SSL Certificate (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

### Step 8: Configure Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Allow SSH (if not already allowed)
sudo ufw allow ssh

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## 🔧 Advanced Configuration

### Custom Domain Setup

1. **DNS Configuration**
   ```
   Type: A
   Name: @
   Value: your-server-ip
   
   Type: A
   Name: www
   Value: your-server-ip
   ```

2. **Wait for DNS propagation** (can take up to 48 hours)

### Performance Optimization

```nginx
# Add to nginx configuration
# Gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

# Client caching
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Security Hardening

```bash
# Install fail2ban
sudo apt install fail2ban -y

# Configure fail2ban for nginx
sudo nano /etc/fail2ban/jail.local
```

Add:
```ini
[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3
bantime = 3600
```

---

## 📊 Monitoring and Maintenance

### Health Check
```bash
# Test your deployment
curl http://your-domain.com/health.html
# Should return: OK
```

### Log Monitoring
```bash
# View nginx access logs
sudo tail -f /var/log/nginx/access.log

# View nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Performance Monitoring
```bash
# Check nginx status
sudo systemctl status nginx

# Check disk usage
df -h

# Check memory usage
free -h
```

### Backup Strategy
```bash
# Create backup script
sudo nano /root/backup-webapp.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/backup/webapp"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup web app files
tar -czf $BACKUP_DIR/webapp_$DATE.tar.gz /var/www/defishard-web-app/

# Backup nginx configuration
cp /etc/nginx/sites-available/defishard-web-app $BACKUP_DIR/nginx_config_$DATE

# Keep only last 7 backups
find $BACKUP_DIR -name "webapp_*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "nginx_config_*" -mtime +7 -delete
```

```bash
# Make executable and add to cron
chmod +x /root/backup-webapp.sh
crontab -e
# Add: 0 2 * * * /root/backup-webapp.sh
```

---

## 🔄 Update Process

### Automated Update Script
```bash
# Create update script
sudo nano /root/update-webapp.sh
```

```bash
#!/bin/bash
cd /var/www/defishard-web-app
git pull origin main
npm install
npm run bundle-sdk
npm run build
sudo cp -r build/* /var/www/defishard-web-app/
sudo systemctl reload nginx
echo "Web app updated successfully!"
```

```bash
# Make executable
chmod +x /root/update-webapp.sh
```

### Manual Update
```bash
# SSH into server
ssh username@your-server-ip

# Navigate to app directory
cd /var/www/defishard-web-app

# Pull latest changes
git pull origin main

# Rebuild
npm install
npm run bundle-sdk
npm run build

# Copy new files
sudo cp -r build/* /var/www/defishard-web-app/

# Reload nginx
sudo systemctl reload nginx
```

---

## 🚨 Troubleshooting

### Common Issues

1. **Permission Denied**
   ```bash
   sudo chown -R www-data:www-data /var/www/defishard-web-app
   sudo chmod -R 755 /var/www/defishard-web-app
   ```

2. **Nginx Won't Start**
   ```bash
   sudo nginx -t  # Test configuration
   sudo systemctl status nginx  # Check status
   sudo journalctl -u nginx  # View logs
   ```

3. **SSL Certificate Issues**
   ```bash
   sudo certbot --nginx -d your-domain.com
   sudo certbot renew --dry-run
   ```

4. **File Upload Issues**
   ```bash
   # Check file permissions
   ls -la /var/www/defishard-web-app/
   
   # Check nginx user
   ps aux | grep nginx
   ```

### Debug Commands
```bash
# Check nginx configuration
sudo nginx -t

# Check nginx status
sudo systemctl status nginx

# View nginx logs
sudo tail -f /var/log/nginx/error.log

# Check port usage
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443

# Test website
curl -I http://your-domain.com
```

---

## ✅ Deployment Checklist

- [ ] Server has required software (nginx, git, curl)
- [ ] Web directory created with proper permissions
- [ ] Files uploaded successfully
- [ ] Nginx configuration created and enabled
- [ ] SSL certificate installed (if using domain)
- [ ] Firewall configured
- [ ] Health check passes
- [ ] Web app loads without errors
- [ ] Relayer URLs configured in web app settings
- [ ] Keygen and signing flows work
- [ ] Monitoring and backup scripts set up

---

## 📞 Support

If you encounter issues:
1. Check nginx error logs
2. Verify file permissions
3. Test with a simple HTML file
4. Check firewall and DNS settings
5. Verify SSL certificate (if using HTTPS)
