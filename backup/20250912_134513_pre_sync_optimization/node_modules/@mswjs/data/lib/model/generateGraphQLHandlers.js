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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
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
exports.generateGraphQLHandlers = exports.generateGraphQLSchema = exports.definitionToFields = exports.getQueryTypeByValueType = exports.comparatorTypes = exports.getGraphQLType = void 0;
var pluralize_1 = __importDefault(require("pluralize"));
var graphql_1 = require("graphql");
var msw_1 = require("msw");
var primaryKey_1 = require("../primaryKey");
var capitalize_1 = require("../utils/capitalize");
var boolean_1 = require("../comparators/boolean");
var string_1 = require("../comparators/string");
var number_1 = require("../comparators/number");
/**
 * Derive a GraphQL scalar type from a variable.
 */
function getGraphQLType(value) {
    var resolvedValue = typeof value === 'function' ? value() : value;
    switch (resolvedValue.constructor.name) {
        case 'Number':
            return graphql_1.GraphQLInt;
        case 'Boolean':
            return graphql_1.GraphQLBoolean;
        default:
            return graphql_1.GraphQLString;
    }
}
exports.getGraphQLType = getGraphQLType;
/**
 * Create a GraphQLInputObjectType from a given comparator function.
 */
function createComparatorGraphQLInputType(name, comparators, type) {
    return new graphql_1.GraphQLInputObjectType({
        name: name,
        fields: Object.keys(comparators).reduce(function (fields, comparatorFn) {
            var fieldType = ['between', 'notBetween', 'in', 'notIn'].includes(comparatorFn)
                ? new graphql_1.GraphQLList(type)
                : type;
            fields[comparatorFn] = { type: fieldType };
            return fields;
        }, {})
    });
}
exports.comparatorTypes = {
    IdQueryType: createComparatorGraphQLInputType('IdQueryType', string_1.stringComparators, graphql_1.GraphQLID),
    StringQueryType: createComparatorGraphQLInputType('StringQueryType', string_1.stringComparators, graphql_1.GraphQLString),
    IntQueryType: createComparatorGraphQLInputType('IntQueryType', number_1.numberComparators, graphql_1.GraphQLInt),
    BooleanQueryType: createComparatorGraphQLInputType('BooleanQueryType', boolean_1.booleanComparators, graphql_1.GraphQLBoolean)
};
function getQueryTypeByValueType(valueType) {
    switch (valueType.name) {
        case 'ID':
            return exports.comparatorTypes.IdQueryType;
        case 'Int':
            return exports.comparatorTypes.IntQueryType;
        case 'Boolean':
            return exports.comparatorTypes.BooleanQueryType;
        default:
            return exports.comparatorTypes.StringQueryType;
    }
}
exports.getQueryTypeByValueType = getQueryTypeByValueType;
function definitionToFields(definition) {
    return Object.entries(definition).reduce(function (types, _a) {
        var _b = __read(_a, 2), key = _b[0], value = _b[1];
        var valueType = value instanceof primaryKey_1.PrimaryKey ? graphql_1.GraphQLID : getGraphQLType(value);
        var queryType = getQueryTypeByValueType(valueType);
        // Fields describe an entity type.
        types.fields[key] = { type: valueType };
        // Input fields describe a type that can be used
        // as an input when creating entities (initial values).
        types.inputFields[key] = { type: valueType };
        // Query input fields describe a type that is used
        // as a "where" query, with its comparator function types.
        types.queryInputFields[key] = { type: queryType };
        return types;
    }, {
        fields: {},
        inputFields: {},
        queryInputFields: {}
    });
}
exports.definitionToFields = definitionToFields;
function generateGraphQLSchema(modelName, definition, model) {
    var _a, _b;
    var pluralModelName = pluralize_1["default"](modelName);
    var capitalModelName = capitalize_1.capitalize(modelName);
    var _c = definitionToFields(definition), fields = _c.fields, inputFields = _c.inputFields, queryInputFields = _c.queryInputFields;
    var EntityType = new graphql_1.GraphQLObjectType({
        name: capitalModelName,
        fields: fields
    });
    var EntityInputType = new graphql_1.GraphQLInputObjectType({
        name: capitalModelName + "Input",
        fields: inputFields
    });
    var EntityQueryInputType = new graphql_1.GraphQLInputObjectType({
        name: capitalModelName + "QueryInput",
        fields: queryInputFields
    });
    var paginationArgs = {
        take: { type: graphql_1.GraphQLInt },
        skip: { type: graphql_1.GraphQLInt },
        cursor: { type: graphql_1.GraphQLID }
    };
    var objectSchema = new graphql_1.GraphQLSchema({
        query: new graphql_1.GraphQLObjectType({
            name: 'Query',
            fields: (_a = {},
                // Get an entity by the primary key.
                _a[modelName] = {
                    type: EntityType,
                    args: {
                        where: { type: EntityQueryInputType }
                    },
                    resolve: function (_, args) {
                        return model.findFirst({ where: args.where });
                    }
                },
                // Get all entities.
                _a[pluralModelName] = {
                    type: new graphql_1.GraphQLList(EntityType),
                    args: __assign(__assign({}, paginationArgs), { where: { type: EntityQueryInputType } }),
                    resolve: function (_, args) {
                        var shouldQuery = Object.keys(args).length > 0;
                        return shouldQuery
                            ? model.findMany({
                                where: args.where,
                                skip: args.skip,
                                take: args.take,
                                cursor: args.cursor
                            })
                            : model.getAll();
                    }
                },
                _a)
        }),
        mutation: new graphql_1.GraphQLObjectType({
            name: 'Mutation',
            fields: (_b = {},
                // Create a new entity.
                _b["create" + capitalModelName] = {
                    type: EntityType,
                    args: {
                        data: { type: EntityInputType }
                    },
                    resolve: function (_, args) {
                        return model.create(args.data);
                    }
                },
                // Update an single entity.
                _b["update" + capitalModelName] = {
                    type: EntityType,
                    args: {
                        where: { type: EntityQueryInputType },
                        data: { type: EntityInputType }
                    },
                    resolve: function (_, args) {
                        return model.update({
                            where: args.where,
                            data: args.data
                        });
                    }
                },
                // Update multiple existing entities.
                _b["update" + capitalize_1.capitalize(pluralModelName)] = {
                    type: new graphql_1.GraphQLList(EntityType),
                    args: {
                        where: { type: EntityQueryInputType },
                        data: { type: EntityInputType }
                    },
                    resolve: function (_, args) {
                        return model.updateMany({
                            where: args.where,
                            data: args.data
                        });
                    }
                },
                // Delete a single entity.
                _b["delete" + capitalModelName] = {
                    type: EntityType,
                    args: {
                        where: { type: EntityQueryInputType }
                    },
                    resolve: function (_, args) {
                        return model["delete"]({ where: args.where });
                    }
                },
                // Delete multiple entities.
                _b["delete" + capitalize_1.capitalize(pluralModelName)] = {
                    type: new graphql_1.GraphQLList(EntityType),
                    args: {
                        where: { type: EntityQueryInputType }
                    },
                    resolve: function (_, args) {
                        return model.deleteMany({ where: args.where });
                    }
                },
                _b)
        })
    });
    return objectSchema;
}
exports.generateGraphQLSchema = generateGraphQLSchema;
function generateGraphQLHandlers(modelName, definition, model, baseUrl) {
    var _this = this;
    if (baseUrl === void 0) { baseUrl = ''; }
    var target = baseUrl ? msw_1.graphql.link(baseUrl) : msw_1.graphql;
    var objectSchema = generateGraphQLSchema(modelName, definition, model);
    return [
        target.operation(function (_a) {
            var query = _a.query, variables = _a.variables;
            return __awaiter(_this, void 0, void 0, function () {
                var result;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, graphql_1.graphql({
                                schema: objectSchema,
                                source: query,
                                variableValues: variables
                            })];
                        case 1:
                            result = _b.sent();
                            return [2 /*return*/, msw_1.HttpResponse.json(result)];
                    }
                });
            });
        }),
    ];
}
exports.generateGraphQLHandlers = generateGraphQLHandlers;
