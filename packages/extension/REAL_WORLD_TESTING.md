# DeFiShArd Extension - Real World Testing Guide

## 🎯 Overview

This guide explains how to test the DeFiShArd extension with the web app for real MPC key generation.

## 🚀 Prerequisites

### 1. **Relay Server Running**
```bash
# In mpc-relayer directory
cd ../mpc-relayer
go run cmd/relayer-server/main.go
```

### 2. **Web App Running**
```bash
# In defishard-web-app directory
cd ../defishard-web-app
npm start
```

### 3. **Extension Loaded**
- Load extension in Chrome: `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked"
- Select `defishard-extension` folder

## 🧪 Testing Scenarios

### **Scenario 1: Extension as Creator, Web App as Joiner**

#### **Step 1: Start Extension**
1. Click extension icon
2. Enter wallet name (e.g., "Test Wallet")
3. Click "Create Wallet"
4. Extension will:
   - Register party with relay server
   - Create group
   - Generate QR code

#### **Step 2: Join with Web App**
1. Open web app in browser
2. Click "Join Keygen"
3. Scan QR code from extension
4. Web app will join the group

#### **Step 3: Monitor Progress**
- Extension should show "2/2 parties joined"
- Keygen should start automatically
- Monitor console for progress

### **Scenario 2: Web App as Creator, Extension as Joiner**

#### **Step 1: Start Web App**
1. Open web app
2. Click "Create Keygen"
3. Enter wallet name
4. Web app generates QR code

#### **Step 2: Join with Extension**
1. Click extension icon
2. Click "Join Existing Wallet"
3. Scan QR code from web app
4. Extension joins group

#### **Step 3: Monitor Progress**
- Both should show "2/2 parties joined"
- Keygen starts automatically
- Check console for progress

## 📋 Test Checklist

### **Pre-Test Setup**
- [ ] Relay server running on `localhost:3000`
- [ ] Web app running on `localhost:3001`
- [ ] Extension loaded in Chrome
- [ ] No console errors in extension
- [ ] No console errors in web app

### **Extension Functionality**
- [ ] Extension loads without errors
- [ ] Popup opens correctly
- [ ] Form validation works
- [ ] QR code generation works
- [ ] Party registration works
- [ ] Group creation works
- [ ] WebSocket connection works
- [ ] Message sending/receiving works
- [ ] Keygen process completes
- [ ] Keyshare stored correctly

### **Integration Testing**
- [ ] Extension can create group
- [ ] Web app can join extension's group
- [ ] Web app can create group
- [ ] Extension can join web app's group
- [ ] Messages exchange correctly
- [ ] Keygen completes successfully
- [ ] Both parties get valid keyshares

## 🔍 What to Monitor

### **Console Logs**
- Extension background script logs
- Web app console logs
- Relay server logs

### **Network Activity**
- WebSocket connections
- HTTP requests to relay server
- Message exchanges

### **Storage**
- Extension storage for keyshares
- Web app storage for keyshares

## 🚨 Common Issues & Solutions

### **WebSocket Connection Failed**
- **Check:** Relay server running
- **Check:** Correct WebSocket URL format
- **Check:** API token valid

### **Party Registration Failed**
- **Check:** Relay server running
- **Check:** Network connectivity
- **Check:** Party ID format

### **Group Creation Failed**
- **Check:** Party registered successfully
- **Check:** Group ID format
- **Check:** Relay server logs

### **Keygen Timeout**
- **Check:** Both parties joined
- **Check:** WebSocket messages flowing
- **Check:** WASM operations working

### **Message Processing Errors**
- **Check:** Message format correct
- **Check:** Encryption/decryption working
- **Check:** WASM integration

## 📊 Success Indicators

### **✅ Extension Working**
- QR code generated successfully
- Party registered with relay server
- Group created successfully
- WebSocket connected
- Messages sent/received
- Keygen completed
- Keyshare stored

### **✅ Integration Working**
- Both parties can join each other's groups
- Messages exchange correctly
- Keygen completes for both parties
- Keyshares are valid and match

## 🎯 Testing Goals

1. **Verify Extension Works Independently**
   - Can create groups
   - Can join groups
   - Can complete keygen

2. **Verify Integration with Web App**
   - Cross-party communication
   - Message synchronization
   - Keygen completion

3. **Verify Real MPC Process**
   - Distributed key generation
   - Keyshare validation
   - Security properties

## 📝 Test Results

After testing, document:

- **Extension Creator Test:** ✅/❌
- **Extension Joiner Test:** ✅/❌
- **WebSocket Communication:** ✅/❌
- **Message Processing:** ✅/❌
- **Keygen Completion:** ✅/❌
- **Keyshare Storage:** ✅/❌
- **Integration Success:** ✅/❌

## 🚀 Next Steps

Once testing is successful:

1. **Performance Testing**
   - Keygen time measurement
   - Memory usage monitoring
   - Network efficiency

2. **Error Scenario Testing**
   - Network disconnection
   - Party timeout
   - Invalid messages

3. **Security Testing**
   - Keyshare validation
   - Message integrity
   - Cryptographic correctness

## 💡 Tips

- **Start Simple:** Test basic functionality first
- **Monitor Logs:** Keep console open for debugging
- **Test Both Directions:** Extension as creator and joiner
- **Verify Keyshares:** Ensure both parties get valid results
- **Document Issues:** Note any problems for fixing

Good luck with the testing! 🎉

