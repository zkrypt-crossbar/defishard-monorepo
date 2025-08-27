let wasm;

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_export_2.set(idx, obj);
    return idx;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

let WASM_VECTOR_LEN = 0;

const cachedTextEncoder = (typeof TextEncoder !== 'undefined' ? new TextEncoder('utf-8') : { encode: () => { throw Error('TextEncoder not available') } } );

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_export_2.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

function passArrayJsValueToWasm0(array, malloc) {
    const ptr = malloc(array.length * 4, 4) >>> 0;
    for (let i = 0; i < array.length; i++) {
        const add = addToExternrefTable0(array[i]);
        getDataViewMemory0().setUint32(ptr + 4 * i, add, true);
    }
    WASM_VECTOR_LEN = array.length;
    return ptr;
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_export_2.get(mem.getUint32(i, true)));
    }
    wasm.__externref_drop_slice(ptr, len);
    return result;
}

const KeygenSessionFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_keygensession_free(ptr >>> 0, 1));

export class KeygenSession {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(KeygenSession.prototype);
        obj.__wbg_ptr = ptr;
        KeygenSessionFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        KeygenSessionFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_keygensession_free(ptr, 0);
    }
    /**
     * @param {number} participants
     * @param {number} threshold
     * @param {number} party_id
     * @param {Uint8Array} group_id
     * @param {Uint8Array | null | undefined} seed
     * @param {boolean} is_distributed
     */
    constructor(participants, threshold, party_id, group_id, seed, is_distributed) {
        const ptr0 = passArray8ToWasm0(group_id, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(seed) ? 0 : passArray8ToWasm0(seed, wasm.__wbindgen_malloc);
        var len1 = WASM_VECTOR_LEN;
        const ret = wasm.keygensession_new(participants, threshold, party_id, ptr0, len0, ptr1, len1, is_distributed);
        this.__wbg_ptr = ret >>> 0;
        KeygenSessionFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {Uint8Array}
     */
    toBytes() {
        const ret = wasm.keygensession_toBytes(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @param {Uint8Array} bytes
     * @returns {KeygenSession}
     */
    static fromBytes(bytes) {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.keygensession_fromBytes(ptr0, len0);
        return KeygenSession.__wrap(ret);
    }
    /**
     * @param {Keyshare} oldshare
     * @param {Uint8Array | null | undefined} seed
     * @param {boolean} is_distributed
     * @returns {KeygenSession}
     */
    static initKeyRotation(oldshare, seed, is_distributed) {
        _assertClass(oldshare, Keyshare);
        var ptr0 = isLikeNone(seed) ? 0 : passArray8ToWasm0(seed, wasm.__wbindgen_malloc);
        var len0 = WASM_VECTOR_LEN;
        const ret = wasm.keygensession_initKeyRotation(oldshare.__wbg_ptr, ptr0, len0, is_distributed);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return KeygenSession.__wrap(ret[0]);
    }
    /**
     * @param {Keyshare} oldshare
     * @param {Uint8Array} lost_shares
     * @param {Uint8Array | null | undefined} seed
     * @param {boolean} is_distributed
     * @returns {KeygenSession}
     */
    static initKeyRecovery(oldshare, lost_shares, seed, is_distributed) {
        _assertClass(oldshare, Keyshare);
        const ptr0 = passArray8ToWasm0(lost_shares, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(seed) ? 0 : passArray8ToWasm0(seed, wasm.__wbindgen_malloc);
        var len1 = WASM_VECTOR_LEN;
        const ret = wasm.keygensession_initKeyRecovery(oldshare.__wbg_ptr, ptr0, len0, ptr1, len1, is_distributed);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return KeygenSession.__wrap(ret[0]);
    }
    /**
     * @param {number} participants
     * @param {number} threshold
     * @param {number} party_id
     * @param {Uint8Array} group_id
     * @param {Uint8Array} pk
     * @param {Uint8Array} lost_shares
     * @param {Uint8Array | null | undefined} seed
     * @param {boolean} is_distributed
     * @returns {KeygenSession}
     */
    static initLostShareRecovery(participants, threshold, party_id, group_id, pk, lost_shares, seed, is_distributed) {
        const ptr0 = passArray8ToWasm0(group_id, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(pk, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(lost_shares, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        var ptr3 = isLikeNone(seed) ? 0 : passArray8ToWasm0(seed, wasm.__wbindgen_malloc);
        var len3 = WASM_VECTOR_LEN;
        const ret = wasm.keygensession_initLostShareRecovery(participants, threshold, party_id, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, is_distributed);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return KeygenSession.__wrap(ret[0]);
    }
    /**
     * @returns {Error | undefined}
     */
    error() {
        const ret = wasm.keygensession_error(this.__wbg_ptr);
        return ret;
    }
    /**
     * Finish key generation session and return resulting key share.
     * This nethod consumes the session and deallocates it in any
     * case, even if the session is not finished and key share is
     * not avialable or an error occured before.
     * @returns {Keyshare}
     */
    keyshare() {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.keygensession_keyshare(ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Keyshare.__wrap(ret[0]);
    }
    /**
     * @returns {Message}
     */
    createFirstMessage() {
        const ret = wasm.keygensession_createFirstMessage(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Message.__wrap(ret[0]);
    }
    /**
     * @returns {Uint8Array}
     */
    calculateChainCodeCommitment() {
        const ret = wasm.keygensession_calculateChainCodeCommitment(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @param {Message[]} msgs
     * @param {Uint8Array | null} [seed]
     * @returns {Message[]}
     */
    handleMessages(msgs, seed) {
        const ptr0 = passArrayJsValueToWasm0(msgs, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(seed) ? 0 : passArray8ToWasm0(seed, wasm.__wbindgen_malloc);
        var len1 = WASM_VECTOR_LEN;
        const ret = wasm.keygensession_handleMessages(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v3 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v3;
    }
}

const KeyshareFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_keyshare_free(ptr >>> 0, 1));

export class Keyshare {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Keyshare.prototype);
        obj.__wbg_ptr = ptr;
        KeyshareFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        KeyshareFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_keyshare_free(ptr, 0);
    }
    /**
     * Create an instance of keyshare from passed array of bytes.
     * @param {Uint8Array} bytes
     * @returns {Keyshare}
     */
    static fromBytes(bytes) {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.keyshare_fromBytes(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Keyshare.__wrap(ret[0]);
    }
    /**
     * Serialize keyshare into array of bytes.
     * @returns {Uint8Array}
     */
    toBytes() {
        const ret = wasm.keyshare_toBytes(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {Uint8Array}
     */
    get publicKey() {
        const ret = wasm.keyshare_publicKey(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get participants() {
        const ret = wasm.keyshare_participants(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get threshold() {
        const ret = wasm.keyshare_threshold(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get partyId() {
        const ret = wasm.keyshare_partyId(this.__wbg_ptr);
        return ret;
    }
    /**
     * Depricated method, the method does nothing.
     * It exists for backward compatibility only
     * @param {Keyshare} _oldshare
     */
    finishKeyRotation(_oldshare) {
        _assertClass(_oldshare, Keyshare);
        var ptr0 = _oldshare.__destroy_into_raw();
        wasm.keyshare_finishKeyRotation(this.__wbg_ptr, ptr0);
    }
}

const MessageFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_message_free(ptr >>> 0, 1));

export class Message {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Message.prototype);
        obj.__wbg_ptr = ptr;
        MessageFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    static __unwrap(jsValue) {
        if (!(jsValue instanceof Message)) {
            return 0;
        }
        return jsValue.__destroy_into_raw();
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MessageFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_message_free(ptr, 0);
    }
    /**
     * Source party ID
     * @returns {number}
     */
    get from_id() {
        const ret = wasm.__wbg_get_message_from_id(this.__wbg_ptr);
        return ret;
    }
    /**
     * Source party ID
     * @param {number} arg0
     */
    set from_id(arg0) {
        wasm.__wbg_set_message_from_id(this.__wbg_ptr, arg0);
    }
    /**
     * Destination party ID or undefined for broadcast messages
     * @returns {number | undefined}
     */
    get to_id() {
        const ret = wasm.__wbg_get_message_to_id(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret;
    }
    /**
     * Destination party ID or undefined for broadcast messages
     * @param {number | null} [arg0]
     */
    set to_id(arg0) {
        wasm.__wbg_set_message_to_id(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0);
    }
    /**
     * Payload
     * @returns {Uint8Array}
     */
    get payload() {
        const ret = wasm.message_payload(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {Uint8Array} payload
     * @param {number} from
     * @param {number | null} [to]
     */
    constructor(payload, from, to) {
        const ret = wasm.message_create(payload, from, isLikeNone(to) ? 0xFFFFFF : to);
        this.__wbg_ptr = ret >>> 0;
        MessageFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {Message}
     */
    clone() {
        const ret = wasm.message_clone(this.__wbg_ptr);
        return Message.__wrap(ret);
    }
}

const SignSessionFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_signsession_free(ptr >>> 0, 1));

export class SignSession {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(SignSession.prototype);
        obj.__wbg_ptr = ptr;
        SignSessionFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SignSessionFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_signsession_free(ptr, 0);
    }
    /**
     * Create a new session.
     * @param {Keyshare} keyshare
     * @param {string} chain_path
     * @param {Uint8Array | null} [seed]
     */
    constructor(keyshare, chain_path, seed) {
        _assertClass(keyshare, Keyshare);
        var ptr0 = keyshare.__destroy_into_raw();
        const ptr1 = passStringToWasm0(chain_path, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        var ptr2 = isLikeNone(seed) ? 0 : passArray8ToWasm0(seed, wasm.__wbindgen_malloc);
        var len2 = WASM_VECTOR_LEN;
        const ret = wasm.signsession_new(ptr0, ptr1, len1, ptr2, len2);
        this.__wbg_ptr = ret >>> 0;
        SignSessionFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Serialize session into array of bytes.
     * @returns {Uint8Array}
     */
    toBytes() {
        const ret = wasm.signsession_toBytes(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * Deserialize session from array of bytes.
     * @param {Uint8Array} bytes
     * @returns {SignSession}
     */
    static fromBytes(bytes) {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.signsession_fromBytes(ptr0, len0);
        return SignSession.__wrap(ret);
    }
    /**
     * Return an error message, if any.
     * @returns {Error | undefined}
     */
    error() {
        const ret = wasm.signsession_error(this.__wbg_ptr);
        return ret;
    }
    /**
     * Create a fist message and change session state from Init to WaitMg1.
     * @param {Uint8Array} message_hash
     * @returns {Message}
     */
    createFirstMessage(message_hash) {
        const ptr0 = passArray8ToWasm0(message_hash, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.signsession_createFirstMessage(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Message.__wrap(ret[0]);
    }
    /**
     * Handle a batch of messages.
     * Decode, process and return an array messages to send to other parties.
     * @param {Message[]} msgs
     * @param {Uint8Array | null} [seed]
     * @returns {Message[]}
     */
    handleMessages(msgs, seed) {
        const ptr0 = passArrayJsValueToWasm0(msgs, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(seed) ? 0 : passArray8ToWasm0(seed, wasm.__wbindgen_malloc);
        var len1 = WASM_VECTOR_LEN;
        const ret = wasm.signsession_handleMessages(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v3 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v3;
    }
    /**
     * The session contains a "pre-signature".
     * Returns a last message.
     * @param {Uint8Array} message_hash
     * @returns {Message}
     */
    lastMessage(message_hash) {
        const ptr0 = passArray8ToWasm0(message_hash, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.signsession_lastMessage(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Message.__wrap(ret[0]);
    }
    /**
     * Combine last messages and return signature as [R, S].
     * R, S are 32 byte UintArray.
     *
     * This method consumes the session and deallocates all
     * internal data.
     * @param {Message[]} msgs
     * @returns {Array<any>}
     */
    combine(msgs) {
        const ptr = this.__destroy_into_raw();
        const ptr0 = passArrayJsValueToWasm0(msgs, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.signsession_combine(ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                if (module.headers.get('Content-Type') != 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg_buffer_609cc3eee51ed158 = function(arg0) {
        const ret = arg0.buffer;
        return ret;
    };
    imports.wbg.__wbg_call_672a4d21634d4a24 = function() { return handleError(function (arg0, arg1) {
        const ret = arg0.call(arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_call_7cccdd69e0791ae2 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = arg0.call(arg1, arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_crypto_ed58b8e10a292839 = function(arg0) {
        const ret = arg0.crypto;
        return ret;
    };
    imports.wbg.__wbg_getRandomValues_bcb4912f16000dc4 = function() { return handleError(function (arg0, arg1) {
        arg0.getRandomValues(arg1);
    }, arguments) };
    imports.wbg.__wbg_length_a446193dc22c12f8 = function(arg0) {
        const ret = arg0.length;
        return ret;
    };
    imports.wbg.__wbg_message_new = function(arg0) {
        const ret = Message.__wrap(arg0);
        return ret;
    };
    imports.wbg.__wbg_message_unwrap = function(arg0) {
        const ret = Message.__unwrap(arg0);
        return ret;
    };
    imports.wbg.__wbg_msCrypto_0a36e2ec3a343d26 = function(arg0) {
        const ret = arg0.msCrypto;
        return ret;
    };
    imports.wbg.__wbg_new_a12002a7f91c75be = function(arg0) {
        const ret = new Uint8Array(arg0);
        return ret;
    };
    imports.wbg.__wbg_new_c68d7209be747379 = function(arg0, arg1) {
        const ret = new Error(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbg_newnoargs_105ed471475aaf50 = function(arg0, arg1) {
        const ret = new Function(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbg_newwithbyteoffsetandlength_d97e637ebe145a9a = function(arg0, arg1, arg2) {
        const ret = new Uint8Array(arg0, arg1 >>> 0, arg2 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_newwithlength_a381634e90c276d4 = function(arg0) {
        const ret = new Uint8Array(arg0 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_newwithlength_c4c419ef0bc8a1f8 = function(arg0) {
        const ret = new Array(arg0 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_node_02999533c4ea02e3 = function(arg0) {
        const ret = arg0.node;
        return ret;
    };
    imports.wbg.__wbg_process_5c1d670bc53614b8 = function(arg0) {
        const ret = arg0.process;
        return ret;
    };
    imports.wbg.__wbg_randomFillSync_ab2cfe79ebbf2740 = function() { return handleError(function (arg0, arg1) {
        arg0.randomFillSync(arg1);
    }, arguments) };
    imports.wbg.__wbg_require_79b1e9274cde3c87 = function() { return handleError(function () {
        const ret = module.require;
        return ret;
    }, arguments) };
    imports.wbg.__wbg_set_37837023f3d740e8 = function(arg0, arg1, arg2) {
        arg0[arg1 >>> 0] = arg2;
    };
    imports.wbg.__wbg_set_65595bdd868b3009 = function(arg0, arg1, arg2) {
        arg0.set(arg1, arg2 >>> 0);
    };
    imports.wbg.__wbg_set_bb8cecf6a62b9f46 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = Reflect.set(arg0, arg1, arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_static_accessor_GLOBAL_88a902d13a557d07 = function() {
        const ret = typeof global === 'undefined' ? null : global;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0 = function() {
        const ret = typeof globalThis === 'undefined' ? null : globalThis;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_SELF_37c5d418e4bf5819 = function() {
        const ret = typeof self === 'undefined' ? null : self;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_WINDOW_5de37043a91a9c40 = function() {
        const ret = typeof window === 'undefined' ? null : window;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_subarray_aa9065fa9dc5df96 = function(arg0, arg1, arg2) {
        const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_versions_c71aa1626a93e0a1 = function(arg0) {
        const ret = arg0.versions;
        return ret;
    };
    imports.wbg.__wbindgen_debug_string = function(arg0, arg1) {
        const ret = debugString(arg1);
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_export_2;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
        ;
    };
    imports.wbg.__wbindgen_is_function = function(arg0) {
        const ret = typeof(arg0) === 'function';
        return ret;
    };
    imports.wbg.__wbindgen_is_object = function(arg0) {
        const val = arg0;
        const ret = typeof(val) === 'object' && val !== null;
        return ret;
    };
    imports.wbg.__wbindgen_is_string = function(arg0) {
        const ret = typeof(arg0) === 'string';
        return ret;
    };
    imports.wbg.__wbindgen_is_undefined = function(arg0) {
        const ret = arg0 === undefined;
        return ret;
    };
    imports.wbg.__wbindgen_memory = function() {
        const ret = wasm.memory;
        return ret;
    };
    imports.wbg.__wbindgen_number_new = function(arg0) {
        const ret = arg0;
        return ret;
    };
    imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
        const ret = getStringFromWasm0(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };

    return imports;
}

function __wbg_init_memory(imports, memory) {

}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();

    __wbg_init_memory(imports);

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('dkls_wasm_ll_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    __wbg_init_memory(imports);

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
