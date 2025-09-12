"use strict";
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
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
exports.__esModule = true;
exports.parseModelDefinition = void 0;
var debug_1 = require("debug");
var outvariant_1 = require("outvariant");
var primaryKey_1 = require("../primaryKey");
var isObject_1 = require("../utils/isObject");
var Relation_1 = require("../relations/Relation");
var nullable_1 = require("../nullable");
var log = debug_1.debug('parseModelDefinition');
/**
 * Recursively parses a given model definition into properties and relations.
 */
function deepParseModelDefinition(dictionary, modelName, definition, parentPath, result) {
    var e_1, _a;
    if (result === void 0) { result = {
        primaryKey: undefined,
        properties: [],
        relations: []
    }; }
    if (parentPath) {
        log('parsing a nested model definition for "%s" property at "%s"', parentPath, modelName, definition);
    }
    try {
        for (var _b = __values(Object.entries(definition)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var _d = __read(_c.value, 2), propertyName = _d[0], value = _d[1];
            var propertyPath = parentPath
                ? __spreadArray(__spreadArray([], __read(parentPath)), [propertyName]) : [propertyName];
            // Primary key.
            if (value instanceof primaryKey_1.PrimaryKey) {
                outvariant_1.invariant(!result.primaryKey, 'Failed to parse a model definition for "%s": cannot have both properties "%s" and "%s" as a primary key.', modelName, result.primaryKey, propertyName);
                outvariant_1.invariant(!parentPath, 'Failed to parse a model definition for "%s" property of "%s": cannot have a primary key in a nested object.', parentPath === null || parentPath === void 0 ? void 0 : parentPath.join('.'), modelName);
                result.primaryKey = propertyName;
                result.properties.push([propertyName]);
                continue;
            }
            if (value instanceof nullable_1.NullableProperty) {
                // Add nullable properties to the same list as regular properties
                result.properties.push(propertyPath);
                continue;
            }
            if (value instanceof nullable_1.NullableObject) {
                deepParseModelDefinition(dictionary, modelName, value.objectDefinition, propertyPath, result);
                // after the recursion calls we want to set the nullable object itself to be part of the properties
                // because in case it will get the value of null we want to override its inner values
                result.properties.push(propertyPath);
                continue;
            }
            // Relations.
            if (value instanceof Relation_1.Relation) {
                // Store the relations in a separate object.
                result.relations.push({ propertyPath: propertyPath, relation: value });
                continue;
            }
            // Nested objects.
            if (isObject_1.isObject(value)) {
                deepParseModelDefinition(dictionary, modelName, value, propertyPath, result);
                continue;
            }
            // Regular properties.
            result.properties.push(propertyPath);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b["return"])) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return result;
}
function parseModelDefinition(dictionary, modelName, definition) {
    log('parsing model definition for "%s" entity', modelName, definition);
    var result = deepParseModelDefinition(dictionary, modelName, definition);
    outvariant_1.invariant(result.primaryKey, 'Failed to parse a model definition for "%s": model is missing a primary key. Did you forget to mark one of its properties using the "primaryKey" function?', modelName);
    return result;
}
exports.parseModelDefinition = parseModelDefinition;
