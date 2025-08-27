// Error types
export var ErrorType;
(function (ErrorType) {
    ErrorType["NETWORK_ERROR"] = "NETWORK_ERROR";
    ErrorType["PROTOCOL_ERROR"] = "PROTOCOL_ERROR";
    ErrorType["AUTHENTICATION_ERROR"] = "AUTHENTICATION_ERROR";
    ErrorType["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorType["STORAGE_ERROR"] = "STORAGE_ERROR";
    ErrorType["WASM_ERROR"] = "WASM_ERROR";
})(ErrorType || (ErrorType = {}));
