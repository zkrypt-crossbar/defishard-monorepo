# DeFiShArd Web App Deployment Guide

## 🚀 Quick Deployment Options

### Option 1: Static Hosting (Recommended)
Deploy to static hosting services like Netlify, Vercel, or GitHub Pages.

### Option 2: Traditional Web Server
Deploy to a traditional web server (Apache, Nginx).

### Option 3: Docker Container
Deploy as a Docker container.

---

## 📋 Prerequisites

1. **Node.js** (v16 or higher)
2. **npm** or **yarn**
3. **Git** (for version control)
4. **Web server** (Apache, Nginx) or **static hosting account**

---

## 🔧 Build Process

### Step 1: Install Dependencies
```bash
cd defishard-web-app
npm install
```

### Step 2: Build SDK Bundle
```bash
npm run bundle-sdk
```

### Step 3: Build Production App
```bash
npm run build
```

This creates a `build/` directory with optimized production files.

---

## 🌐 Deployment Methods

### Method 1: Netlify (Easiest)

1. **Sign up** at [netlify.com](https://netlify.com)
2. **Connect your GitHub repository**
3. **Configure build settings:**
   - Build command: `npm run build`
   - Publish directory: `build`
4. **Deploy!**

### Method 2: Vercel

1. **Sign up** at [vercel.com](https://vercel.com)
2. **Import your GitHub repository**
3. **Configure build settings:**
   - Framework preset: Create React App
   - Build command: `npm run build`
   - Output directory: `build`
4. **Deploy!**

### Method 3: GitHub Pages

1. **Add to package.json:**
```json
{
  "homepage": "https://yourusername.github.io/your-repo-name",
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d build"
  }
}
```

2. **Install gh-pages:**
```bash
npm install --save-dev gh-pages
```

3. **Deploy:**
```bash
npm run deploy
```

### Method 4: Traditional Web Server

#### Apache Configuration
```apache
# /etc/apache2/sites-available/defishard-web-app.conf
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /var/www/defishard-web-app/build
    
    <Directory /var/www/defishard-web-app/build>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    # Handle React Router
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^(.*)$ /index.html [QSA,L]
</VirtualHost>
```

#### Nginx Configuration
```nginx
# /etc/nginx/sites-available/defishard-web-app
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/defishard-web-app/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Method 5: Docker Deployment

#### Dockerfile
```dockerfile
# Dockerfile
FROM node:16-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run bundle-sdk
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### nginx.conf
```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;
        
        location / {
            try_files $uri $uri/ /index.html;
        }
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

#### Build and Run Docker
```bash
# Build image
docker build -t defishard-web-app .

# Run container
docker run -p 80:80 defishard-web-app
```

---

## ⚙️ Environment Configuration

### Production Environment Variables
Create `.env.production` file:
```env
REACT_APP_RELAYER_URL=https://your-relayer-server.com
REACT_APP_WEBSOCKET_URL=wss://your-relayer-server.com
REACT_APP_ENVIRONMENT=production
```

### Update Relayer URLs
After deployment, update the relayer URLs in the web app settings to point to your production relay server.

---

## 🔒 Security Considerations

1. **HTTPS**: Always use HTTPS in production
2. **CORS**: Configure CORS on your relay server
3. **Content Security Policy**: Add CSP headers
4. **Rate Limiting**: Implement rate limiting on your relay server

---

## 📊 Monitoring

### Health Check Endpoint
Add a simple health check to your web app:
```javascript
// public/health.html
<!DOCTYPE html>
<html>
<head><title>Health Check</title></head>
<body>OK</body>
</html>
```

### Performance Monitoring
- Use browser dev tools to monitor performance
- Check network tab for API response times
- Monitor WebSocket connection stability

---

## 🚨 Troubleshooting

### Common Issues

1. **Build Fails**
   - Check Node.js version (v16+)
   - Clear node_modules and reinstall
   - Check for missing dependencies

2. **SDK Bundle Issues**
   - Ensure WASM files are copied correctly
   - Check webpack configuration
   - Verify file paths

3. **Routing Issues**
   - Ensure server is configured for SPA routing
   - Check that all routes redirect to index.html

4. **CORS Errors**
   - Configure CORS on your relay server
   - Check that URLs match exactly

### Debug Commands
```bash
# Check build output
ls -la build/

# Test locally
npm run build
npx serve -s build

# Check bundle
ls -la public/sdk/
```

---

## 📞 Support

If you encounter issues:
1. Check the browser console for errors
2. Verify relay server connectivity
3. Test with a simple HTML file first
4. Check network connectivity and firewall settings
