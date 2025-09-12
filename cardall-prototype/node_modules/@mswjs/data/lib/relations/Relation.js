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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
exports.Relation = exports.RelationKind = void 0;
var debug_1 = require("debug");
var set_1 = __importDefault(require("lodash/set"));
var get_1 = __importDefault(require("lodash/get"));
var outvariant_1 = require("outvariant");
var glossary_1 = require("../glossary");
var executeQuery_1 = require("../query/executeQuery");
var definePropertyAtPath_1 = require("../utils/definePropertyAtPath");
var findPrimaryKey_1 = require("../utils/findPrimaryKey");
var first_1 = require("../utils/first");
var log = debug_1.debug('relation');
var RelationKind;
(function (RelationKind) {
    RelationKind["OneOf"] = "ONE_OF";
    RelationKind["ManyOf"] = "MANY_OF";
})(RelationKind = exports.RelationKind || (exports.RelationKind = {}));
var DEFAULT_RELATION_ATTRIBUTES = {
    nullable: false,
    unique: false
};
var Relation = /** @class */ (function () {
    function Relation(definition) {
        this.source = null;
        // These lazy properties are set after calling the ".apply()" method.
        this.dictionary = null;
        this.db = null;
        this.kind = definition.kind;
        this.attributes = __assign(__assign({}, DEFAULT_RELATION_ATTRIBUTES), (definition.attributes || {}));
        this.target = {
            modelName: definition.to.toString(),
            // @ts-expect-error Null is an intermediate value.
            primaryKey: null
        };
        log('constructing a "%s" relation to "%s" with attributes: %o', this.kind, definition.to, this.attributes);
    }
    /**
     * Applies the relation to the given entity.
     * Creates a connection between the relation's target and source.
     * Does not define the proxy property getter.
     */
    Relation.prototype.apply = function (entity, propertyPath, dictionary, db) {
        this.dictionary = dictionary;
        this.db = db;
        var sourceModelName = entity[glossary_1.ENTITY_TYPE];
        var sourcePrimaryKey = entity[glossary_1.PRIMARY_KEY];
        this.source = {
            modelName: sourceModelName,
            propertyPath: propertyPath,
            primaryKey: sourcePrimaryKey
        };
        // Get the referenced model's primary key name.
        var targetPrimaryKey = findPrimaryKey_1.findPrimaryKey(this.dictionary[this.target.modelName]);
        outvariant_1.invariant(targetPrimaryKey, 'Failed to create a "%s" relation to "%s": referenced model does not exist or has no primary key.', this.kind, this.target.modelName);
        this.target.primaryKey = targetPrimaryKey;
    };
    /**
     * Updates the relation references (values) to resolve the relation with.
     */
    Relation.prototype.resolveWith = function (entity, refs) {
        var _a, _b;
        var _this = this;
        var _c, _d;
        var exception = function (predicate, reason) {
            var positionals = [];
            for (var _i = 2; _i < arguments.length; _i++) {
                positionals[_i - 2] = arguments[_i];
            }
            outvariant_1.invariant.apply(void 0, __spreadArray([predicate, "Failed to resolve a \"%s\" relationship to \"%s\" at \"%s.%s\" (%s: \"%s\"): " + reason, _this.kind,
                _this.target.modelName,
                _this.source.modelName,
                _this.source.propertyPath,
                _this.source.primaryKey,
                entity[_this.source.primaryKey]], __read(positionals)));
        };
        outvariant_1.invariant(this.source, 'Failed to resolve a "%s" relational property to "%s": relation has not been applied (source: %s).', this.kind, this.target.modelName, this.source);
        log('resolving a "%s" relational property to "%s" on "%s.%s" ("%s"):', this.kind, this.target.modelName, this.source.modelName, this.source.propertyPath, entity[this.source.primaryKey], refs);
        log('entity of this relation:', entity);
        // Support null as the next relation value for nullable relations.
        if (refs === null) {
            exception(this.attributes.nullable, 'cannot resolve a non-nullable relationship with null.');
            log('this relation resolves with null');
            // Override the relational property of the entity to return null.
            this.setValueResolver(entity, function () {
                return null;
            });
            return;
        }
        exception(this.target.primaryKey, 'referenced model has no primary key set.');
        var referencesList = [].concat(refs);
        var records = this.db.getModel(this.target.modelName);
        log('records in the referenced model:', records.keys());
        // Forbid referencing entities from a model different than the one
        // defined in the
        referencesList.forEach(function (ref) {
            var refModelName = ref[glossary_1.ENTITY_TYPE];
            var refPrimaryKey = ref[glossary_1.PRIMARY_KEY];
            var refId = ref[_this.target.primaryKey];
            exception(refModelName, 'expected a referenced entity to be "%s" but got %o', _this.target.modelName, ref);
            exception(refModelName === _this.target.modelName, 'expected a referenced entity to be "%s" but got "%s" (%s: "%s").', _this.target.modelName, refModelName, refPrimaryKey, ref[refPrimaryKey]);
            // Forbid referencing non-existing entities.
            // This guards against assigning a compatible plain object
            // as the relational value.
            exception(records.has(refId), 'referenced entity "%s" (%s: "%s") does not exist.', refModelName, _this.target.primaryKey, refId);
        });
        // Ensure that unique relations don't reference
        // entities that are already referenced by other entities.
        if (this.attributes.unique) {
            log('validating a unique "%s" relation to "%s" on "%s.%s"...', this.kind, this.target.modelName, this.source.modelName, this.source.propertyPath);
            // Get the list of entities of the same entity type
            // that reference the same relational values.
            var extraneousEntities = executeQuery_1.executeQuery(this.source.modelName, this.source.primaryKey, {
                where: set_1["default"]((_a = {},
                    // Omit the current entity when querying
                    // the list of other entities that reference
                    // the same value.
                    _a[this.source.primaryKey] = {
                        notEquals: entity[this.source.primaryKey]
                    },
                    _a), this.source.propertyPath, (_b = {},
                    _b[this.target.primaryKey] = {
                        "in": referencesList.map(function (entity) {
                            return entity[_this.target.primaryKey];
                        })
                    },
                    _b))
            }, this.db);
            log('found other %s referencing the same %s:', this.source.modelName, this.target.modelName, extraneousEntities);
            if (extraneousEntities.length > 0) {
                var extraneousReferences_1 = extraneousEntities.flatMap(function (extraneous) {
                    var references = [].concat(get_1["default"](extraneous, _this.source.propertyPath));
                    return references.map(function (entity) { return entity[_this.target.primaryKey]; });
                });
                var firstInvalidReference = referencesList.find(function (entity) {
                    return extraneousReferences_1.includes(entity[_this.target.primaryKey]);
                });
                exception(false, 'the referenced "%s" (%s: "%s") belongs to another "%s" (%s: "%s").', this.target.modelName, this.target.primaryKey, firstInvalidReference === null || firstInvalidReference === void 0 ? void 0 : firstInvalidReference[this.target.primaryKey], this.source.modelName, (_c = extraneousEntities[0]) === null || _c === void 0 ? void 0 : _c[glossary_1.PRIMARY_KEY], (_d = extraneousEntities[0]) === null || _d === void 0 ? void 0 : _d[this.source.primaryKey]);
            }
        }
        this.setValueResolver(entity, function () {
            var queryResult = referencesList.reduce(function (result, ref) {
                var _a;
                return result.concat(executeQuery_1.executeQuery(_this.target.modelName, _this.target.primaryKey, {
                    where: (_a = {},
                        _a[_this.target.primaryKey] = {
                            equals: ref[_this.target.primaryKey]
                        },
                        _a)
                }, _this.db));
            }, []);
            return _this.kind === RelationKind.OneOf ? first_1.first(queryResult) : queryResult;
        });
    };
    Relation.prototype.setValueResolver = function (entity, resolver) {
        var _this = this;
        log('setting value resolver at "%s" on: %j', this.source.propertyPath, entity);
        outvariant_1.invariant(entity[glossary_1.ENTITY_TYPE], 'Failed to set a value resolver on a "%s" relationship to "%s" at "%s.%s": provided object (%j) is not an entity.', this.kind, this.target.modelName, this.source.modelName, this.source.propertyPath.join('.'), entity);
        definePropertyAtPath_1.definePropertyAtPath(entity, this.source.propertyPath, {
            // Mark the property as enumerable so it gets listed
            // when iterating over the entity's properties.
            enumerable: true,
            // Mark the property as configurable so it could be re-defined
            // when updating it during the entity update ("update"/"updateMany").
            configurable: true,
            get: function () {
                log('GET "%s.%s" on "%s" ("%s")', _this.source.modelName, _this.source.propertyPath, _this.source.modelName, entity[_this.source.primaryKey], _this);
                var nextValue = resolver();
                log('resolved "%s" relation at "%s.%s" ("%s") to:', _this.kind, _this.source.modelName, _this.source.propertyPath, entity[_this.source.primaryKey], nextValue);
                return nextValue;
            }
        });
    };
    return Relation;
}());
exports.Relation = Relation;
