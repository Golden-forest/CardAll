"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
exports.__esModule = true;
exports.spread = void 0;
var isObject_1 = require("./isObject");
/**
 * Clones the given object, preserving its setters/getters.
 */
function spread(source) {
    var e_1, _a;
    var target = {};
    var descriptors = Object.getOwnPropertyDescriptors(source);
    try {
        for (var _b = __values(Object.entries(descriptors)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var _d = __read(_c.value, 2), propertyName = _d[0], descriptor = _d[1];
            // Spread nested objects, preserving their descriptors.
            if (isObject_1.isObject(descriptor.value)) {
                Object.defineProperty(target, propertyName, __assign(__assign({}, descriptor), { value: spread(descriptor.value) }));
                continue;
            }
            Object.defineProperty(target, propertyName, descriptor);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b["return"])) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return target;
}
exports.spread = spread;
