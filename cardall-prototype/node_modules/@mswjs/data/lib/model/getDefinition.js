"use strict";
exports.__esModule = true;
exports.getDefinition = void 0;
var nullable_1 = require("../nullable");
var isObject_1 = require("../utils/isObject");
var lodash_1 = require("lodash");
function getDefinition(definition, propertyName) {
    return propertyName.reduce(function (reducedDefinition, property) {
        var value = reducedDefinition[property];
        if (value instanceof nullable_1.NullableProperty) {
            return value;
        }
        if (value instanceof nullable_1.NullableObject) {
            // in case the propertyName array includes NullableObject, we get
            // the NullableObject definition and continue the reduce loop
            if (property !== propertyName.at(-1)) {
                return value.objectDefinition;
            }
            // in case the propertyName array ends with NullableObject, we just return it and if
            // it should get the value of null, it will override its inner properties
            return value;
        }
        // getter functions and nested objects
        if (lodash_1.isFunction(value) || isObject_1.isObject(value)) {
            return value;
        }
        return;
    }, definition);
}
exports.getDefinition = getDefinition;
