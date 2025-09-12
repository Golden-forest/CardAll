"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
exports.generateRestHandlers = exports.parseQueryParams = exports.withErrors = exports.getResponseStatusByErrorType = exports.createUrlBuilder = void 0;
var pluralize_1 = __importDefault(require("pluralize"));
var msw_1 = require("msw");
var OperationError_1 = require("../errors/OperationError");
var findPrimaryKey_1 = require("../utils/findPrimaryKey");
var HTTPErrorType;
(function (HTTPErrorType) {
    HTTPErrorType[HTTPErrorType["BadRequest"] = 0] = "BadRequest";
})(HTTPErrorType || (HTTPErrorType = {}));
var ErrorType = __assign(__assign({}, HTTPErrorType), OperationError_1.OperationErrorType);
var HTTPError = /** @class */ (function (_super) {
    __extends(HTTPError, _super);
    function HTTPError(type, message) {
        var _this = _super.call(this, type, message) || this;
        _this.name = 'HTTPError';
        return _this;
    }
    return HTTPError;
}(OperationError_1.OperationError));
function createUrlBuilder(baseUrl) {
    return function (path) {
        // For the previous implementation trailing slash didn't matter, we must keep it this way for backward compatibility
        var normalizedBaseUrl = baseUrl && baseUrl.slice(-1) === '/'
            ? baseUrl.slice(0, -1)
            : baseUrl || '';
        return normalizedBaseUrl + "/" + path;
    };
}
exports.createUrlBuilder = createUrlBuilder;
function getResponseStatusByErrorType(error) {
    switch (error.type) {
        case ErrorType.EntityNotFound:
            return 404;
        case ErrorType.DuplicatePrimaryKey:
            return 409;
        case ErrorType.BadRequest:
            return 400;
        default:
            return 500;
    }
}
exports.getResponseStatusByErrorType = getResponseStatusByErrorType;
function withErrors(resolver) {
    var _this = this;
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return __awaiter(_this, void 0, void 0, function () {
            var response, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, resolver.apply(void 0, __spreadArray([], __read(args)))];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response];
                    case 2:
                        error_1 = _a.sent();
                        if (error_1 instanceof Error) {
                            return [2 /*return*/, msw_1.HttpResponse.json({ message: error_1.message }, {
                                    status: getResponseStatusByErrorType(error_1)
                                })];
                        }
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
}
exports.withErrors = withErrors;
function parseQueryParams(modelName, definition, searchParams) {
    var paginationKeys = ['cursor', 'skip', 'take'];
    var cursor = searchParams.get('cursor');
    var rawSkip = searchParams.get('skip');
    var rawTake = searchParams.get('take');
    var filters = {};
    var skip = rawSkip == null ? rawSkip : parseInt(rawSkip, 10);
    var take = rawTake == null ? rawTake : parseInt(rawTake, 10);
    searchParams.forEach(function (value, key) {
        if (paginationKeys.includes(key)) {
            return;
        }
        if (definition[key]) {
            filters[key] = {
                equals: value
            };
        }
        else {
            throw new HTTPError(HTTPErrorType.BadRequest, "Failed to query the \"" + modelName + "\" model: unknown property \"" + key + "\".");
        }
    });
    return {
        cursor: cursor,
        skip: skip,
        take: take,
        filters: filters
    };
}
exports.parseQueryParams = parseQueryParams;
function generateRestHandlers(modelName, modelDefinition, model, baseUrl) {
    var _this = this;
    if (baseUrl === void 0) { baseUrl = ''; }
    var primaryKey = findPrimaryKey_1.findPrimaryKey(modelDefinition);
    var primaryKeyValue = modelDefinition[primaryKey].getPrimaryKeyValue();
    var modelPath = pluralize_1["default"](modelName);
    var buildUrl = createUrlBuilder(baseUrl);
    function extractPrimaryKey(params) {
        var parameterValue = params[primaryKey];
        return typeof primaryKeyValue === 'number'
            ? Number(parameterValue)
            : parameterValue;
    }
    return [
        msw_1.http.get(buildUrl(modelPath), withErrors(function (_a) {
            var request = _a.request;
            var url = new URL(request.url);
            var _b = parseQueryParams(modelName, modelDefinition, url.searchParams), skip = _b.skip, take = _b.take, cursor = _b.cursor, filters = _b.filters;
            var options = { where: filters };
            if (take || skip) {
                options = Object.assign(options, { take: take, skip: skip });
            }
            if (take || cursor) {
                options = Object.assign(options, { take: take, cursor: cursor });
            }
            var records = model.findMany(options);
            return msw_1.HttpResponse.json(records);
        })),
        msw_1.http.get(buildUrl(modelPath + "/:" + primaryKey), withErrors(function (_a) {
            var _b;
            var params = _a.params;
            var id = extractPrimaryKey(params);
            var where = (_b = {},
                _b[primaryKey] = {
                    equals: id
                },
                _b);
            var entity = model.findFirst({
                strict: true,
                where: where
            });
            return msw_1.HttpResponse.json(entity);
        })),
        msw_1.http.post(buildUrl(modelPath), withErrors(function (_a) {
            var request = _a.request;
            return __awaiter(_this, void 0, void 0, function () {
                var definition, createdEntity;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, request.json()];
                        case 1:
                            definition = _b.sent();
                            createdEntity = model.create(definition);
                            return [2 /*return*/, msw_1.HttpResponse.json(createdEntity, { status: 201 })];
                    }
                });
            });
        })),
        msw_1.http.put(buildUrl(modelPath + "/:" + primaryKey), withErrors(function (_a) {
            var request = _a.request, params = _a.params;
            return __awaiter(_this, void 0, void 0, function () {
                var id, where, updatedEntity, _b, _c;
                var _d, _e;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0:
                            id = extractPrimaryKey(params);
                            where = (_d = {},
                                _d[primaryKey] = {
                                    equals: id
                                },
                                _d);
                            _c = (_b = model).update;
                            _e = {
                                strict: true,
                                where: where
                            };
                            return [4 /*yield*/, request.json()];
                        case 1:
                            updatedEntity = _c.apply(_b, [(_e.data = _f.sent(),
                                    _e)]);
                            return [2 /*return*/, msw_1.HttpResponse.json(updatedEntity)];
                    }
                });
            });
        })),
        msw_1.http["delete"](buildUrl(modelPath + "/:" + primaryKey), withErrors(function (_a) {
            var _b;
            var params = _a.params;
            var id = extractPrimaryKey(params);
            var where = (_b = {},
                _b[primaryKey] = {
                    equals: id
                },
                _b);
            var deletedEntity = model["delete"]({
                strict: true,
                where: where
            });
            return msw_1.HttpResponse.json(deletedEntity);
        })),
    ];
}
exports.generateRestHandlers = generateRestHandlers;
