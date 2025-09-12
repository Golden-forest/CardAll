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
exports.__esModule = true;
exports.nullable = exports.NullableProperty = exports.NullableObject = void 0;
var Relation_1 = require("./relations/Relation");
var NullableObject = /** @class */ (function () {
    function NullableObject(definition, defaultsToNull) {
        this.objectDefinition = definition;
        this.defaultsToNull = defaultsToNull;
    }
    return NullableObject;
}());
exports.NullableObject = NullableObject;
var NullableProperty = /** @class */ (function () {
    function NullableProperty(getter) {
        this.getValue = getter;
    }
    return NullableProperty;
}());
exports.NullableProperty = NullableProperty;
function nullable(value, options) {
    if (value instanceof Relation_1.Relation) {
        return new Relation_1.Relation({
            kind: value.kind,
            to: value.target.modelName,
            attributes: __assign(__assign({}, value.attributes), { nullable: true })
        });
    }
    if (typeof value === 'object') {
        return new NullableObject(value, !!(options === null || options === void 0 ? void 0 : options.defaultsToNull));
    }
    if (typeof value === 'function') {
        return new NullableProperty(value);
    }
}
exports.nullable = nullable;
