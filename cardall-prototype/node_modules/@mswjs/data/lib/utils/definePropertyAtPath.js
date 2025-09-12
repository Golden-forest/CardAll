"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
exports.definePropertyAtPath = void 0;
var has_1 = __importDefault(require("lodash/has"));
var set_1 = __importDefault(require("lodash/set"));
var get_1 = __importDefault(require("lodash/get"));
/**
 * Abstraction over `Object.defineProperty` that supports
 * property paths (nested properties).
 *
 * @example
 * const target = {}
 * definePropertyAtPath(target, 'a.b.c', { get(): { return 2 }})
 * console.log(target.a.b.c) // 2
 */
function definePropertyAtPath(target, propertyPath, attributes) {
    var propertyName = propertyPath[propertyPath.length - 1];
    var parentPath = propertyPath.slice(0, -1);
    if (parentPath.length && !has_1["default"](target, parentPath)) {
        set_1["default"](target, parentPath, {});
    }
    var parent = parentPath.length ? get_1["default"](target, parentPath) : target;
    Object.defineProperty(parent, propertyName, attributes);
}
exports.definePropertyAtPath = definePropertyAtPath;
