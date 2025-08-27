# DeFiShArd Web App

A modern React-based web application for distributed key generation and threshold signing using MPC (Multi-Party Computation) technology.

## 🚀 Features

- **Distributed Key Generation**: Create cryptographic keys across multiple parties
- **Threshold Signing**: Sign messages with threshold-based security
- **Real-time Communication**: WebSocket-based protocol for MPC operations
- **Modern UI**: Clean, responsive interface built with React
- **Secure Storage**: Local storage for keyshares and configuration
- **Cross-platform**: Works on any modern web browser

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **DeFiShArd Relay Server** (for MPC operations)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Cramiumlabs/defishard-web-app.git
   cd defishard-web-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build SDK bundle**
   ```bash
   npm run bundle-sdk
   ```

4. **Start development server**
   ```bash
   npm start
   ```

The app will be available at `http://localhost:3000`

## 🏗️ Build for Production

```bash
# Build the production app
npm run build

# Or use the deployment script
./deploy.sh
```

## 🚀 Deployment

### Quick Deployment Options

#### Option 1: Netlify (5 minutes)
1. Go to [netlify.com](https://netlify.com) and sign up
2. Click "New site from Git"
3. Connect your GitHub repository
4. Set build command: `npm run build`
5. Set publish directory: `build`
6. Click "Deploy site"

#### Option 2: Vercel (5 minutes)
1. Go to [vercel.com](https://vercel.com) and sign up
2. Click "New Project"
3. Import your GitHub repository
4. Framework preset: Create React App
5. Click "Deploy"

#### Option 3: Remote Server
```bash
# One-command deployment
./deploy-simple.sh username@your-server-ip

# With domain and SSL
./deploy-simple.sh username@your-server-ip yourdomain.com
```

#### Option 4: Docker
```bash
# Build and run
docker build -t defishard-web-app .
docker run -p 3000:80 defishard-web-app
```

For detailed deployment instructions, see:
- [Quick Deployment Guide](QUICK_DEPLOY.md)
- [Remote Server Deployment](REMOTE_SERVER_DEPLOYMENT.md)
- [Complete Deployment Guide](DEPLOYMENT.md)

## ⚙️ Configuration

### Relayer Server Setup

After deployment, configure your relay server URLs:

1. Open the web app
2. Go to **Settings** page
3. Update **Relayer Configuration**:
   - **Relayer URL**: `https://your-relay-server.com`
   - **WebSocket URL**: `wss://your-relay-server.com`
4. Click **Save**

### Environment Variables

Create `.env.production` for production settings:
```env
REACT_APP_RELAYER_URL=https://your-relay-server.com
REACT_APP_WEBSOCKET_URL=wss://your-relay-server.com
REACT_APP_ENVIRONMENT=production
```

## 🧪 Testing

### Local Testing
```bash
# Start development server
npm start

# Run tests
npm test

# Build and test locally
npm run build
npx serve -s build
```

### Health Check
After deployment, test the health endpoint:
```bash
curl https://your-domain.com/health.html
# Should return: OK
```

## 📁 Project Structure

```
defishard-web-app/
├── public/                 # Static files
│   ├── sdk/               # SDK bundle and WASM files
│   └── index.html         # Main HTML file
├── src/                   # React source code
│   ├── components/        # React components
│   ├── services/          # SDK service and storage
│   ├── utils/             # Utility functions
│   └── App.js             # Main app component
├── build/                 # Production build (generated)
├── deploy.sh              # Deployment script
├── deploy-simple.sh       # One-command deployment
├── Dockerfile             # Docker configuration
└── nginx.conf             # Nginx configuration
```

## 🔧 Development

### Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm run bundle-sdk` - Build SDK bundle
- `npm run dev` - Build SDK and start dev server
- `npm test` - Run tests
- `./deploy.sh` - Interactive deployment
- `./deploy-simple.sh` - One-command deployment

### SDK Integration

The web app integrates with the DeFiShArd SDK for MPC operations:

- **Key Generation**: Distributed key generation across parties
- **Threshold Signing**: Secure message signing with threshold requirements
- **Real-time Communication**: WebSocket-based protocol management
- **Secure Storage**: Local storage for keyshares and configuration

## 🔒 Security

- **HTTPS Required**: Always use HTTPS in production
- **CORS Configuration**: Configure CORS on your relay server
- **Content Security Policy**: Implemented in nginx configuration
- **Rate Limiting**: Configured on relay server
- **Secure Storage**: Keyshares stored locally with encryption

## 📊 Monitoring

### Performance Monitoring
- Browser dev tools for client-side performance
- Network tab for API response times
- WebSocket connection stability monitoring

### Server Monitoring
- Nginx access and error logs
- Health check endpoint monitoring
- SSL certificate renewal monitoring

## 🚨 Troubleshooting

### Common Issues

1. **Build Fails**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **SDK Bundle Missing**
   ```bash
   npm run bundle-sdk
   ```

3. **CORS Errors**
   - Ensure relay server allows your domain
   - Check URL protocols (http vs https)

4. **WebSocket Connection Fails**
   - Verify WebSocket URL starts with `wss://`
   - Check relay server is running

### Debug Commands
```bash
# Check build output
ls -la build/

# Test locally
npm run build
npx serve -s build

# Check SDK bundle
ls -la public/sdk/
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For support and questions:
1. Check the troubleshooting section
2. Review the deployment guides
3. Check browser console for errors
4. Verify relay server connectivity

## 🔗 Related Projects

- [DeFiShArd Relay Server](https://github.com/Cramiumlabs/mpc-relayer)
- [DeFiShArd SDK](https://github.com/Cramiumlabs/defishard-sdk)
- [DeFiShArd Desktop App](https://github.com/Cramiumlabs/defishard-desktop-app)
