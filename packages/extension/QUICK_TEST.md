# Quick Test Guide - Fixed Extension

## 🎯 What Was Fixed

**Problem:** Service worker registration failed with "window is not defined"
**Solution:** Temporarily disabled WASM loading and used mock implementation

## 🚀 Quick Test Steps

### 1. **Load Extension**
1. Open Chrome: `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `defishard-extension` folder
5. **Should see:** Extension loads without errors ✅

### 2. **Test Popup**
1. Click extension icon
2. **Should see:** Popup opens correctly ✅
3. Enter wallet name (e.g., "Test Wallet")
4. Click "Create Wallet"
5. **Should see:** 
   - Party registration works ✅
   - Group creation works ✅
   - QR code generated ✅

### 3. **Test with Web App**
1. Start relay server: `cd ../mpc-relayer && go run cmd/relayer-server/main.go`
2. Start web app: `cd ../defishard-web-app && npm start`
3. **Extension as Creator:**
   - Extension creates group and QR code
   - Web app scans QR and joins
   - **Should see:** Mock keygen process runs ✅

## 📋 Expected Behavior

### ✅ **What Should Work:**
- Extension loads without errors
- Popup interface works
- Party registration with relay server
- Group creation
- QR code generation
- WebSocket connection setup
- Mock keygen process (for testing)

### ⚠️ **What's Mocked:**
- WASM cryptographic operations
- Real keygen computation
- Keyshare generation

### 🔄 **Next Steps:**
Once basic functionality works:
1. Re-enable real WASM (after fixing service worker compatibility)
2. Test with real cryptographic operations
3. Verify keyshare generation

## 🎉 Success Criteria

Extension is **ready for real testing** when:
- [ ] Loads without service worker errors
- [ ] Popup opens and works
- [ ] Can create groups
- [ ] Can generate QR codes
- [ ] Can connect to relay server
- [ ] Mock keygen process runs

**Try loading the extension now!** 🚀

