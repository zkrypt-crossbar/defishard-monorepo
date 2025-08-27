# 🚀 Quick DeFiShArd Web App Deployment

## ⚡ Fastest Deployment Options

### Option 1: Netlify (Recommended - 5 minutes)
1. Go to [netlify.com](https://netlify.com) and sign up
2. Click "New site from Git"
3. Connect your GitHub repository
4. Set build command: `npm run build`
5. Set publish directory: `build`
6. Click "Deploy site"

### Option 2: Vercel (5 minutes)
1. Go to [vercel.com](https://vercel.com) and sign up
2. Click "New Project"
3. Import your GitHub repository
4. Framework preset: Create React App
5. Click "Deploy"

### Option 3: Docker (10 minutes)
```bash
# Build and run locally
docker build -t defishard-web-app .
docker run -p 3000:80 defishard-web-app

# Access at http://localhost:3000
```

### Option 4: Manual Build (5 minutes)
```bash
# Run the deployment script
./deploy.sh

# The build/ directory contains your production files
# Upload to any web server
```

---

## 🔧 Prerequisites Check

Run this to check if you're ready:
```bash
node --version  # Should be v16 or higher
npm --version   # Should be v6 or higher
```

---

## 📋 What You Need After Deployment

1. **Relay Server URL**: Your relay server address
2. **WebSocket URL**: Your relay server WebSocket address
3. **Domain**: Your web app domain (optional but recommended)

---

## ⚙️ Configuration After Deployment

1. Open your deployed web app
2. Go to Settings page
3. Update Relayer Configuration:
   - Relayer URL: `https://your-relay-server.com`
   - WebSocket URL: `wss://your-relay-server.com`
4. Click "Save"

---

## 🧪 Test Your Deployment

1. **Health Check**: Visit `your-domain.com/health.html`
2. **Settings**: Check if relayer URLs are saved
3. **Keygen**: Try creating a new group
4. **Signing**: Try signing a message

---

## 🚨 Common Issues

### Build Fails
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

### SDK Bundle Missing
```bash
# Rebuild SDK
npm run bundle-sdk
```

### CORS Errors
- Ensure your relay server allows your web app domain
- Check that URLs match exactly (http vs https)

### WebSocket Connection Fails
- Verify WebSocket URL starts with `wss://` (not `ws://`)
- Check relay server is running and accessible

---

## 📞 Need Help?

1. Check browser console for errors
2. Verify relay server is running
3. Test with a simple keygen flow
4. Check network connectivity

---

## 🎯 Success Checklist

- [ ] Web app loads without errors
- [ ] Settings page shows relayer configuration
- [ ] Keygen flow works end-to-end
- [ ] Signing flow works end-to-end
- [ ] No CORS errors in console
- [ ] WebSocket connects successfully
