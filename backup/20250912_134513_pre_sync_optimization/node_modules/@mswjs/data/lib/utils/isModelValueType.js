"use strict";
exports.__esModule = true;
exports.isModelValueType = void 0;
var isObject_1 = require("./isObject");
function isPrimitiveValueType(value) {
    var _a;
    return (typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        isObject_1.isObject(value) ||
        ((_a = value === null || value === void 0 ? void 0 : value.constructor) === null || _a === void 0 ? void 0 : _a.name) === 'Date');
}
function isModelValueType(value) {
    return isPrimitiveValueType(value) || Array.isArray(value);
}
exports.isModelValueType = isModelValueType;
