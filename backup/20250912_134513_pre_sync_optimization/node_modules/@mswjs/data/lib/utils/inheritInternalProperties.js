"use strict";
exports.__esModule = true;
exports.inheritInternalProperties = void 0;
var outvariant_1 = require("outvariant");
var glossary_1 = require("../glossary");
function inheritInternalProperties(target, source) {
    var _a;
    var entityType = source[glossary_1.ENTITY_TYPE];
    var primaryKey = source[glossary_1.PRIMARY_KEY];
    outvariant_1.invariant(entityType, 'Failed to inherit internal properties from (%j) to (%j): provided source entity has no entity type specified.', source, target);
    outvariant_1.invariant(primaryKey, 'Failed to inherit internal properties from (%j) to (%j): provided source entity has no primary key specified.', source, target);
    Object.defineProperties(target, (_a = {},
        _a[glossary_1.ENTITY_TYPE] = {
            enumerable: true,
            value: entityType
        },
        _a[glossary_1.PRIMARY_KEY] = {
            enumerable: true,
            value: primaryKey
        },
        _a));
}
exports.inheritInternalProperties = inheritInternalProperties;
