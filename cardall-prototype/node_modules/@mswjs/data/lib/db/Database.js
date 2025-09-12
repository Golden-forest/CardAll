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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
exports.Database = exports.SERIALIZED_INTERNAL_PROPERTIES_KEY = void 0;
var md5_1 = __importDefault(require("md5"));
var outvariant_1 = require("outvariant");
var strict_event_emitter_1 = require("strict-event-emitter");
var glossary_1 = require("../glossary");
exports.SERIALIZED_INTERNAL_PROPERTIES_KEY = 'SERIALIZED_INTERNAL_PROPERTIES';
var callOrder = 0;
var Database = /** @class */ (function () {
    function Database(dictionary) {
        this.events = new strict_event_emitter_1.Emitter();
        this.models = Object.keys(dictionary).reduce(function (acc, modelName) {
            acc[modelName] = new Map();
            return acc;
        }, {});
        callOrder++;
        this.id = this.generateId();
    }
    /**
     * Generates a unique MD5 hash based on the database
     * module location and invocation order. Used to reproducibly
     * identify a database instance among sibling instances.
     */
    Database.prototype.generateId = function () {
        var stack = new Error().stack;
        var callFrame = stack === null || stack === void 0 ? void 0 : stack.split('\n')[4];
        var salt = callOrder + "-" + (callFrame === null || callFrame === void 0 ? void 0 : callFrame.trim());
        return md5_1["default"](salt);
    };
    Database.prototype.serializeEntity = function (entity) {
        var _a;
        return __assign(__assign({}, entity), (_a = {}, _a[exports.SERIALIZED_INTERNAL_PROPERTIES_KEY] = {
            entityType: entity[glossary_1.ENTITY_TYPE],
            primaryKey: entity[glossary_1.PRIMARY_KEY]
        }, _a));
    };
    Database.prototype.getModel = function (name) {
        return this.models[name];
    };
    Database.prototype.create = function (modelName, entity, customPrimaryKey) {
        outvariant_1.invariant(entity[glossary_1.ENTITY_TYPE], 'Failed to create a new "%s" record: provided entity has no type. %j', modelName, entity);
        outvariant_1.invariant(entity[glossary_1.PRIMARY_KEY], 'Failed to create a new "%s" record: provided entity has no primary key. %j', modelName, entity);
        var primaryKey = customPrimaryKey || entity[entity[glossary_1.PRIMARY_KEY]];
        this.events.emit('create', this.id, modelName, this.serializeEntity(entity), customPrimaryKey);
        return this.getModel(modelName).set(primaryKey, entity);
    };
    Database.prototype.update = function (modelName, prevEntity, nextEntity) {
        var prevPrimaryKey = prevEntity[prevEntity[glossary_1.PRIMARY_KEY]];
        var nextPrimaryKey = nextEntity[prevEntity[glossary_1.PRIMARY_KEY]];
        if (nextPrimaryKey !== prevPrimaryKey) {
            this["delete"](modelName, prevPrimaryKey);
        }
        this.getModel(modelName).set(nextPrimaryKey, nextEntity);
        // this.create(modelName, nextEntity, nextPrimaryKey)
        this.events.emit('update', this.id, modelName, this.serializeEntity(prevEntity), this.serializeEntity(nextEntity));
    };
    Database.prototype["delete"] = function (modelName, primaryKey) {
        this.getModel(modelName)["delete"](primaryKey);
        this.events.emit('delete', this.id, modelName, primaryKey);
    };
    Database.prototype.has = function (modelName, primaryKey) {
        return this.getModel(modelName).has(primaryKey);
    };
    Database.prototype.count = function (modelName) {
        return this.getModel(modelName).size;
    };
    Database.prototype.listEntities = function (modelName) {
        return Array.from(this.getModel(modelName).values());
    };
    return Database;
}());
exports.Database = Database;
