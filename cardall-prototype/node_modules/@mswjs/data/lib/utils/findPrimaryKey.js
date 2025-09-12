"use strict";
exports.__esModule = true;
exports.findPrimaryKey = void 0;
var primaryKey_1 = require("../primaryKey");
/**
 * Returns a primary key property name of the given model definition.
 */
function findPrimaryKey(definition) {
    for (var propertyName in definition) {
        var value = definition[propertyName];
        if (value instanceof primaryKey_1.PrimaryKey) {
            return propertyName;
        }
    }
}
exports.findPrimaryKey = findPrimaryKey;
