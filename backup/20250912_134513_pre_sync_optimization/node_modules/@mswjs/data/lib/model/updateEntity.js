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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
exports.updateEntity = void 0;
var debug_1 = require("debug");
var get_1 = __importDefault(require("lodash/get"));
var set_1 = __importDefault(require("lodash/set"));
var outvariant_1 = require("outvariant");
var Relation_1 = require("../relations/Relation");
var glossary_1 = require("../glossary");
var isObject_1 = require("../utils/isObject");
var inheritInternalProperties_1 = require("../utils/inheritInternalProperties");
var nullable_1 = require("../nullable");
var spread_1 = require("../utils/spread");
var getDefinition_1 = require("./getDefinition");
var log = debug_1.debug('updateEntity');
/**
 * Update an entity with the given next data.
 */
function updateEntity(entity, data, definition) {
    log('updating entity:\n%j\nwith data:\n%j', entity, data);
    log('model definition:', definition);
    var nextEntity = spread_1.spread(entity);
    inheritInternalProperties_1.inheritInternalProperties(nextEntity, entity);
    var updateRecursively = function (data, parentPath) {
        var e_1, _a;
        if (parentPath === void 0) { parentPath = []; }
        log('updating path "%s" to:', parentPath, data);
        var _loop_1 = function (propertyName, value) {
            var propertyPath = parentPath.concat(propertyName);
            var prevValue = get_1["default"](nextEntity, propertyPath);
            log('previous value for "%s":', propertyPath, prevValue);
            var nextValue = typeof value === 'function' ? value(prevValue, entity) : value;
            log('next value for "%s":', propertyPath, nextValue);
            var propertyDefinition = getDefinition_1.getDefinition(definition, propertyPath);
            log('property definition for "%s":', propertyPath, propertyDefinition);
            if (propertyDefinition == null) {
                log('skipping an unknown property "%s" on "%s"...', propertyName, entity[glossary_1.ENTITY_TYPE]);
                return "continue";
            }
            if (propertyDefinition instanceof Relation_1.Relation) {
                log('property "%s" is a "%s" relationship to "%s"', propertyPath, propertyDefinition.kind, propertyDefinition.target.modelName);
                var location_1 = nextEntity[glossary_1.ENTITY_TYPE] + "." + propertyPath.join('.');
                if (nextValue == null) {
                    // Forbid updating a non-nullable relationship to null.
                    outvariant_1.invariant(propertyDefinition.attributes.nullable, 'Failed to update a "%s" relationship to "%s" at "%s" (%s: "%s"): cannot update a non-nullable relationship to null.', propertyDefinition.kind, propertyDefinition.target.modelName, location_1, nextEntity[glossary_1.PRIMARY_KEY], nextEntity[nextEntity[glossary_1.PRIMARY_KEY]]);
                    log('re-defining the "%s" relationship on "%s" to: null', propertyName, nextEntity[glossary_1.ENTITY_TYPE]);
                    propertyDefinition.resolveWith(nextEntity, null);
                    return "continue";
                }
                if (propertyDefinition.kind === Relation_1.RelationKind.ManyOf) {
                    // Forbid updating a "MANY_OF" relation to a non-array value.
                    outvariant_1.invariant(Array.isArray(nextValue), 'Failed to update a "%s" relationship to "%s" at "%s" (%s: "%s"): expected the next value to be an array of entities but got %j.', propertyDefinition.kind, propertyDefinition.target.modelName, location_1, nextEntity[glossary_1.PRIMARY_KEY], nextEntity[nextEntity[glossary_1.PRIMARY_KEY]], nextValue);
                    nextValue.forEach(function (ref, index) {
                        // Forbid providing a compatible plain object in any array members.
                        outvariant_1.invariant(ref[glossary_1.ENTITY_TYPE], 'Failed to update a "%s" relationship to "%s" at "%s" (%s: "%s"): expected the next value at index %d to be an entity but got %j.', propertyDefinition.kind, propertyDefinition.target.modelName, location_1, nextEntity[glossary_1.PRIMARY_KEY], nextEntity[nextEntity[glossary_1.PRIMARY_KEY]], index, ref);
                        // Forbid referencing a different model in any array members.
                        outvariant_1.invariant(ref[glossary_1.ENTITY_TYPE] === propertyDefinition.target.modelName, 'Failed to update a "%s" relationship to "%s" at "%s" (%s: "%s"): expected the next value at index %d to reference a "%s" but got "%s".', propertyDefinition.kind, propertyDefinition.target.modelName, location_1, nextEntity[glossary_1.PRIMARY_KEY], nextEntity[nextEntity[glossary_1.PRIMARY_KEY]], index, propertyDefinition.target.modelName, ref[glossary_1.ENTITY_TYPE]);
                    });
                    propertyDefinition.resolveWith(nextEntity, nextValue);
                    return "continue";
                }
                // Forbid updating a relationship with a compatible plain object.
                outvariant_1.invariant(nextValue[glossary_1.ENTITY_TYPE], 'Failed to update a "%s" relationship to "%s" at "%s" (%s: "%s"): expected the next value to be an entity but got %j.', propertyDefinition.kind, propertyDefinition.target.modelName, location_1, nextEntity[glossary_1.PRIMARY_KEY], nextEntity[nextEntity[glossary_1.PRIMARY_KEY]], nextValue);
                // Forbid updating a relationship to an entity of a different model.
                outvariant_1.invariant(nextValue[glossary_1.ENTITY_TYPE] == propertyDefinition.target.modelName, 'Failed to update a "%s" relationship to "%s" at "%s" (%s: "%s"): expected the next value to reference a "%s" but got "%s" (%s: "%s").', propertyDefinition.kind, propertyDefinition.target.modelName, location_1, nextEntity[glossary_1.PRIMARY_KEY], nextEntity[nextEntity[glossary_1.PRIMARY_KEY]], propertyDefinition.target.modelName, nextValue[glossary_1.ENTITY_TYPE], nextValue[glossary_1.PRIMARY_KEY], nextValue[nextValue[glossary_1.PRIMARY_KEY]]);
                // Re-define the relationship only if its next value references a different entity
                // than before. That means a new compatible entity was created as the next value.
                if ((prevValue === null || prevValue === void 0 ? void 0 : prevValue[prevValue === null || prevValue === void 0 ? void 0 : prevValue[glossary_1.PRIMARY_KEY]]) !==
                    nextValue[nextValue[glossary_1.PRIMARY_KEY]]) {
                    log('next referenced "%s" (%s: "%s") differs from the previous (%s: "%s"), re-defining the relationship...', propertyDefinition.target.modelName, nextValue[glossary_1.PRIMARY_KEY]);
                    propertyDefinition.resolveWith(nextEntity, nextValue);
                }
                return "continue";
            }
            // Support updating nested objects.
            if (isObject_1.isObject(nextValue)) {
                log('next value at "%s" is an object: %j, recursively updating...', propertyPath, nextValue);
                updateRecursively(nextValue, propertyPath);
                return "continue";
            }
            outvariant_1.invariant(nextValue !== null ||
                propertyDefinition instanceof nullable_1.NullableProperty ||
                propertyDefinition instanceof nullable_1.NullableObject, 'Failed to update "%s" on "%s": cannot set a non-nullable property to null.', propertyName, entity[glossary_1.ENTITY_TYPE]);
            log('updating a plain property "%s" to:', propertyPath, nextValue);
            set_1["default"](nextEntity, propertyPath, nextValue);
        };
        try {
            for (var _b = __values(Object.entries(data)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), propertyName = _d[0], value = _d[1];
                _loop_1(propertyName, value);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b["return"])) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
    };
    updateRecursively(data);
    log('successfully updated to:', nextEntity);
    return nextEntity;
}
exports.updateEntity = updateEntity;
