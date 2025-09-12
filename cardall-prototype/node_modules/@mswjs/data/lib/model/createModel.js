"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
exports.createModel = void 0;
var debug_1 = require("debug");
var outvariant_1 = require("outvariant");
var get_1 = __importDefault(require("lodash/get"));
var set_1 = __importDefault(require("lodash/set"));
var isFunction_1 = __importDefault(require("lodash/isFunction"));
var glossary_1 = require("../glossary");
var defineRelationalProperties_1 = require("./defineRelationalProperties");
var primaryKey_1 = require("../primaryKey");
var Relation_1 = require("../relations/Relation");
var nullable_1 = require("../nullable");
var isModelValueType_1 = require("../utils/isModelValueType");
var getDefinition_1 = require("./getDefinition");
var log = debug_1.debug('createModel');
function createModel(modelName, definition, dictionary, parsedModel, initialValues, db) {
    var _a;
    var primaryKey = parsedModel.primaryKey, properties = parsedModel.properties, relations = parsedModel.relations;
    log("creating a \"" + modelName + "\" entity (primary key: \"" + primaryKey + "\")", definition, parsedModel, relations, initialValues);
    var internalProperties = (_a = {},
        _a[glossary_1.ENTITY_TYPE] = modelName,
        _a[glossary_1.PRIMARY_KEY] = primaryKey,
        _a);
    var publicProperties = properties.reduce(function (properties, propertyName) {
        var initialValue = get_1["default"](initialValues, propertyName);
        var propertyDefinition = getDefinition_1.getDefinition(definition, propertyName);
        // Ignore relational properties at this stage.
        if (propertyDefinition instanceof Relation_1.Relation) {
            return properties;
        }
        if (propertyDefinition instanceof primaryKey_1.PrimaryKey) {
            set_1["default"](properties, propertyName, initialValue || propertyDefinition.getPrimaryKeyValue());
            return properties;
        }
        if (propertyDefinition instanceof nullable_1.NullableProperty) {
            var value = initialValue === null || isModelValueType_1.isModelValueType(initialValue)
                ? initialValue
                : propertyDefinition.getValue();
            set_1["default"](properties, propertyName, value);
            return properties;
        }
        if (propertyDefinition instanceof nullable_1.NullableObject) {
            if (initialValue === null ||
                (propertyDefinition.defaultsToNull && initialValue === undefined)) {
                // this is for all the cases we want to override the inner values of
                // the nullable object and just set it to be null. it happens when:
                // 1. the initial value of the nullable object is null
                // 2. the initial value of the nullable object is not defined and the definition defaults to null
                set_1["default"](properties, propertyName, null);
            }
            return properties;
        }
        outvariant_1.invariant(initialValue !== null, 'Failed to create a "%s" entity: a non-nullable property "%s" cannot be instantiated with null. Use the "nullable" function when defining this property to support nullable value.', modelName, propertyName.join('.'));
        if (isModelValueType_1.isModelValueType(initialValue)) {
            log('"%s" has a plain initial value:', modelName + "." + propertyName, initialValue);
            set_1["default"](properties, propertyName, initialValue);
            return properties;
        }
        if (isFunction_1["default"](propertyDefinition)) {
            set_1["default"](properties, propertyName, propertyDefinition());
            return properties;
        }
        return properties;
    }, {});
    var entity = Object.assign({}, publicProperties, internalProperties);
    defineRelationalProperties_1.defineRelationalProperties(entity, initialValues, relations, dictionary, db);
    log('created "%s" entity:', modelName, entity);
    return entity;
}
exports.createModel = createModel;
