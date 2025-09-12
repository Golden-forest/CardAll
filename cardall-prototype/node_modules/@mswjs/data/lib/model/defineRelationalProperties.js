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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
exports.defineRelationalProperties = void 0;
var debug_1 = require("debug");
var get_1 = __importDefault(require("lodash/get"));
var outvariant_1 = require("outvariant");
var glossary_1 = require("../glossary");
var Relation_1 = require("../relations/Relation");
var log = debug_1.debug('defineRelationalProperties');
function defineRelationalProperties(entity, initialValues, relations, dictionary, db) {
    var e_1, _a;
    log('defining relational properties...', { entity: entity, initialValues: initialValues, relations: relations });
    try {
        for (var relations_1 = __values(relations), relations_1_1 = relations_1.next(); !relations_1_1.done; relations_1_1 = relations_1.next()) {
            var _b = relations_1_1.value, propertyPath = _b.propertyPath, relation = _b.relation;
            outvariant_1.invariant(dictionary[relation.target.modelName], 'Failed to define a "%s" relational property to "%s" on "%s": cannot find a model by the name "%s".', relation.kind, propertyPath.join('.'), entity[glossary_1.ENTITY_TYPE], relation.target.modelName);
            var references = get_1["default"](initialValues, propertyPath);
            outvariant_1.invariant(references !== null || relation.attributes.nullable, 'Failed to define a "%s" relationship to "%s" at "%s.%s" (%s: "%s"): cannot set a non-nullable relationship to null.', relation.kind, relation.target.modelName, entity[glossary_1.ENTITY_TYPE], propertyPath.join('.'), entity[glossary_1.PRIMARY_KEY], entity[entity[glossary_1.PRIMARY_KEY]]);
            log("setting relational property \"" + entity[glossary_1.ENTITY_TYPE] + "." + propertyPath.join('.') + "\" with references: %j", references, relation);
            relation.apply(entity, propertyPath, dictionary, db);
            if (references) {
                log('has references, applying a getter...');
                relation.resolveWith(entity, references);
                continue;
            }
            if (relation.attributes.nullable) {
                log('has no references but is nullable, applying a getter to null...');
                relation.resolveWith(entity, null);
                continue;
            }
            if (relation.kind === Relation_1.RelationKind.ManyOf) {
                log('has no references but is a non-nullable "manyOf" relationship, applying a getter to []...');
                relation.resolveWith(entity, []);
                continue;
            }
            log('has no relations, skipping the getter...');
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (relations_1_1 && !relations_1_1.done && (_a = relations_1["return"])) _a.call(relations_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
}
exports.defineRelationalProperties = defineRelationalProperties;
