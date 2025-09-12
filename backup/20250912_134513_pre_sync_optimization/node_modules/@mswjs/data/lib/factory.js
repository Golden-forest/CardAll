"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
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
exports.__esModule = true;
exports.factory = void 0;
var outvariant_1 = require("outvariant");
var glossary_1 = require("./glossary");
var first_1 = require("./utils/first");
var executeQuery_1 = require("./query/executeQuery");
var parseModelDefinition_1 = require("./model/parseModelDefinition");
var createModel_1 = require("./model/createModel");
var updateEntity_1 = require("./model/updateEntity");
var OperationError_1 = require("./errors/OperationError");
var Database_1 = require("./db/Database");
var generateRestHandlers_1 = require("./model/generateRestHandlers");
var generateGraphQLHandlers_1 = require("./model/generateGraphQLHandlers");
var sync_1 = require("./extensions/sync");
/**
 * Create a database with the given models.
 */
function factory(dictionary) {
    var _a;
    var db = new Database_1.Database(dictionary);
    // Initialize database extensions.
    sync_1.sync(db);
    return Object.entries(dictionary).reduce(function (acc, _a) {
        var _b = __read(_a, 2), modelName = _b[0], props = _b[1];
        acc[modelName] = createModelApi(dictionary, modelName, props, db);
        return acc;
    }, (_a = {},
        _a[glossary_1.DATABASE_INSTANCE] = db,
        _a));
}
exports.factory = factory;
function createModelApi(dictionary, modelName, definition, db) {
    var parsedModel = parseModelDefinition_1.parseModelDefinition(dictionary, modelName, definition);
    var primaryKey = parsedModel.primaryKey;
    var api = {
        create: function (initialValues) {
            if (initialValues === void 0) { initialValues = {}; }
            var entity = createModel_1.createModel(modelName, definition, dictionary, parsedModel, initialValues, db);
            var entityId = entity[entity[glossary_1.PRIMARY_KEY]];
            if (!entityId) {
                throw new OperationError_1.OperationError(OperationError_1.OperationErrorType.MissingPrimaryKey, outvariant_1.format('Failed to create a "%s" entity: expected the primary key "%s" to have a value, but got: %s', modelName, primaryKey, entityId));
            }
            // Prevent creation of multiple entities with the same primary key value.
            if (db.has(modelName, entityId)) {
                throw new OperationError_1.OperationError(OperationError_1.OperationErrorType.DuplicatePrimaryKey, outvariant_1.format('Failed to create a "%s" entity: an entity with the same primary key "%s" ("%s") already exists.', modelName, entityId, entity[glossary_1.PRIMARY_KEY]));
            }
            db.create(modelName, entity);
            return entity;
        },
        count: function (query) {
            if (!query) {
                return db.count(modelName);
            }
            var results = executeQuery_1.executeQuery(modelName, primaryKey, query, db);
            return results.length;
        },
        findFirst: function (query) {
            var results = executeQuery_1.executeQuery(modelName, primaryKey, query, db);
            var firstResult = first_1.first(results);
            if (query.strict && firstResult == null) {
                throw new OperationError_1.OperationError(OperationError_1.OperationErrorType.EntityNotFound, outvariant_1.format('Failed to execute "findFirst" on the "%s" model: no entity found matching the query "%j".', modelName, query.where));
            }
            return firstResult;
        },
        findMany: function (query) {
            var results = executeQuery_1.executeQuery(modelName, primaryKey, query, db);
            if (results.length === 0 && query.strict) {
                throw new OperationError_1.OperationError(OperationError_1.OperationErrorType.EntityNotFound, outvariant_1.format('Failed to execute "findMany" on the "%s" model: no entities found matching the query "%j".', modelName, query.where));
            }
            return results;
        },
        getAll: function () {
            return db.listEntities(modelName);
        },
        update: function (_a) {
            var strict = _a.strict, query = __rest(_a, ["strict"]);
            var results = executeQuery_1.executeQuery(modelName, primaryKey, query, db);
            var prevRecord = first_1.first(results);
            if (!prevRecord) {
                if (strict) {
                    throw new OperationError_1.OperationError(OperationError_1.OperationErrorType.EntityNotFound, outvariant_1.format('Failed to execute "update" on the "%s" model: no entity found matching the query "%j".', modelName, query.where));
                }
                return null;
            }
            var nextRecord = updateEntity_1.updateEntity(prevRecord, query.data, definition);
            if (nextRecord[prevRecord[glossary_1.PRIMARY_KEY]] !==
                prevRecord[prevRecord[glossary_1.PRIMARY_KEY]]) {
                if (db.has(modelName, nextRecord[prevRecord[glossary_1.PRIMARY_KEY]])) {
                    throw new OperationError_1.OperationError(OperationError_1.OperationErrorType.DuplicatePrimaryKey, outvariant_1.format('Failed to execute "update" on the "%s" model: the entity with a primary key "%s" ("%s") already exists.', modelName, nextRecord[prevRecord[glossary_1.PRIMARY_KEY]], primaryKey));
                }
            }
            db.update(modelName, prevRecord, nextRecord);
            return nextRecord;
        },
        updateMany: function (_a) {
            var strict = _a.strict, query = __rest(_a, ["strict"]);
            var records = executeQuery_1.executeQuery(modelName, primaryKey, query, db);
            var updatedRecords = [];
            if (records.length === 0) {
                if (strict) {
                    throw new OperationError_1.OperationError(OperationError_1.OperationErrorType.EntityNotFound, outvariant_1.format('Failed to execute "updateMany" on the "%s" model: no entities found matching the query "%j".', modelName, query.where));
                }
                return null;
            }
            records.forEach(function (prevRecord) {
                var nextRecord = updateEntity_1.updateEntity(prevRecord, query.data, definition);
                if (nextRecord[prevRecord[glossary_1.PRIMARY_KEY]] !==
                    prevRecord[prevRecord[glossary_1.PRIMARY_KEY]]) {
                    if (db.has(modelName, nextRecord[prevRecord[glossary_1.PRIMARY_KEY]])) {
                        throw new OperationError_1.OperationError(OperationError_1.OperationErrorType.DuplicatePrimaryKey, outvariant_1.format('Failed to execute "updateMany" on the "%s" model: the entity with a primary key "%s" ("%s") already exists.', modelName, nextRecord[prevRecord[glossary_1.PRIMARY_KEY]], primaryKey));
                    }
                }
                db.update(modelName, prevRecord, nextRecord);
                updatedRecords.push(nextRecord);
            });
            return updatedRecords;
        },
        "delete": function (_a) {
            var strict = _a.strict, query = __rest(_a, ["strict"]);
            var results = executeQuery_1.executeQuery(modelName, primaryKey, query, db);
            var record = first_1.first(results);
            if (!record) {
                if (strict) {
                    throw new OperationError_1.OperationError(OperationError_1.OperationErrorType.EntityNotFound, outvariant_1.format('Failed to execute "delete" on the "%s" model: no entity found matching the query "%o".', modelName, query.where));
                }
                return null;
            }
            db["delete"](modelName, record[record[glossary_1.PRIMARY_KEY]]);
            return record;
        },
        deleteMany: function (_a) {
            var strict = _a.strict, query = __rest(_a, ["strict"]);
            var records = executeQuery_1.executeQuery(modelName, primaryKey, query, db);
            if (records.length === 0) {
                if (strict) {
                    throw new OperationError_1.OperationError(OperationError_1.OperationErrorType.EntityNotFound, outvariant_1.format('Failed to execute "deleteMany" on the "%s" model: no entities found matching the query "%o".', modelName, query.where));
                }
                return null;
            }
            records.forEach(function (record) {
                db["delete"](modelName, record[record[glossary_1.PRIMARY_KEY]]);
            });
            return records;
        },
        toHandlers: function (type, baseUrl) {
            if (type === 'graphql') {
                return generateGraphQLHandlers_1.generateGraphQLHandlers(modelName, definition, api, baseUrl);
            }
            return generateRestHandlers_1.generateRestHandlers(modelName, definition, api, baseUrl);
        },
        toGraphQLSchema: function () {
            return generateGraphQLHandlers_1.generateGraphQLSchema(modelName, definition, api);
        }
    };
    return api;
}
