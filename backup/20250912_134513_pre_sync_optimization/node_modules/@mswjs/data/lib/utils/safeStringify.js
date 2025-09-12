"use strict";
exports.__esModule = true;
exports.safeStringify = void 0;
var glossary_1 = require("../glossary");
function safeStringify(value) {
    var seen = new WeakSet();
    return JSON.stringify(value, function (_, value) {
        if (typeof value !== 'object' || value === null) {
            return value;
        }
        if (seen.has(value)) {
            var type = value[glossary_1.ENTITY_TYPE];
            var primaryKey = value[glossary_1.PRIMARY_KEY];
            return type && primaryKey
                ? "Entity(type: " + type + ", " + primaryKey + ": " + value[primaryKey] + ")"
                : '[Circular Reference]';
        }
        seen.add(value);
        return value;
    });
}
exports.safeStringify = safeStringify;
