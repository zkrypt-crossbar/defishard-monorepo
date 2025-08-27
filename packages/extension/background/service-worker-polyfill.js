/**
 * Service Worker Polyfill for Browser APIs
 * Provides minimal DOM and browser API implementations for service workers
 */

console.log('🔧 Loading service worker polyfills...');

// Document polyfill
if (typeof document === 'undefined') {
    const mockElement = {
        style: {},
        addEventListener: () => {},
        removeEventListener: () => {},
        setAttribute: () => {},
        getAttribute: () => null,
        appendChild: () => {},
        removeChild: () => {},
        innerHTML: '',
        textContent: '',
        nodeType: 1,
        parentNode: null,
        children: [],
        firstChild: null,
        lastChild: null,
        nextSibling: null,
        previousSibling: null
    };

    globalThis.document = {
        createElement: (tag) => ({
            ...mockElement,
            tagName: tag.toUpperCase(),
            nodeName: tag.toUpperCase()
        }),
        createTextNode: (text) => ({
            ...mockElement,
            nodeType: 3,
            textContent: text,
            nodeValue: text
        }),
        getElementById: () => null,
        getElementsByTagName: () => [],
        getElementsByClassName: () => [],
        querySelector: () => null,
        querySelectorAll: () => [],
        head: mockElement,
        body: mockElement,
        documentElement: mockElement,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
        createEvent: () => ({
            initEvent: () => {},
            preventDefault: () => {},
            stopPropagation: () => {}
        }),
        readyState: 'complete',
        location: {
            href: 'chrome-extension://service-worker',
            origin: 'chrome-extension:',
            protocol: 'chrome-extension:',
            host: '',
            hostname: '',
            pathname: '/service-worker',
            search: '',
            hash: ''
        }
    };
    console.log('✅ Document polyfill created');
}

// Window polyfill
if (typeof window === 'undefined') {
    globalThis.window = globalThis;
    globalThis.window.document = globalThis.document;
    globalThis.window.location = globalThis.document.location;
    globalThis.window.addEventListener = () => {};
    globalThis.window.removeEventListener = () => {};
    globalThis.window.dispatchEvent = () => true;
    globalThis.window.getComputedStyle = () => ({});
    globalThis.window.requestAnimationFrame = (callback) => setTimeout(callback, 16);
    globalThis.window.cancelAnimationFrame = clearTimeout;
    console.log('✅ Window polyfill created');
}

// Navigator polyfill
if (typeof navigator === 'undefined') {
    globalThis.navigator = {
        userAgent: 'Mozilla/5.0 (Chrome Extension Service Worker)',
        language: 'en-US',
        languages: ['en-US', 'en'],
        platform: 'Chrome Extension',
        onLine: true,
        cookieEnabled: false,
        doNotTrack: '1'
    };
    console.log('✅ Navigator polyfill created');
}

// Location polyfill
if (typeof location === 'undefined') {
    globalThis.location = globalThis.document.location;
    console.log('✅ Location polyfill created');
}

// localStorage polyfill (use chrome.storage.local)
if (typeof localStorage === 'undefined') {
    globalThis.localStorage = {
        getItem: (key) => {
            // This is synchronous but chrome.storage is async - will need proper handling
            console.warn('localStorage.getItem called in service worker - this is a polyfill');
            return null;
        },
        setItem: (key, value) => {
            console.warn('localStorage.setItem called in service worker - this is a polyfill');
        },
        removeItem: (key) => {
            console.warn('localStorage.removeItem called in service worker - this is a polyfill');
        },
        clear: () => {
            console.warn('localStorage.clear called in service worker - this is a polyfill');
        },
        length: 0,
        key: () => null
    };
    console.log('✅ localStorage polyfill created');
}

// sessionStorage polyfill
if (typeof sessionStorage === 'undefined') {
    globalThis.sessionStorage = globalThis.localStorage;
    console.log('✅ sessionStorage polyfill created');
}

// XMLHttpRequest polyfill (use fetch instead)
if (typeof XMLHttpRequest === 'undefined') {
    globalThis.XMLHttpRequest = function() {
        console.warn('XMLHttpRequest used in service worker - consider using fetch() instead');
        return {
            open: () => {},
            send: () => {},
            setRequestHeader: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            abort: () => {},
            readyState: 0,
            status: 0,
            statusText: '',
            responseText: '',
            response: null
        };
    };
    console.log('✅ XMLHttpRequest polyfill created');
}

console.log('✅ Service worker polyfills loaded successfully');
