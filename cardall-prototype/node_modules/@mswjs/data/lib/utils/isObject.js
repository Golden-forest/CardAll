"use strict";
exports.__esModule = true;
exports.isObject = void 0;
/**
 * Returns true if the given value is a plain Object.
 */
function isObject(value) {
    return (value != null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date));
}
exports.isObject = isObject;
