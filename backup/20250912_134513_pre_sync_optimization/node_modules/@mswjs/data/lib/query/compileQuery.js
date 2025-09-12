"use strict";
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
exports.compileQuery = void 0;
var debug_1 = require("debug");
var outvariant_1 = require("outvariant");
var getComparatorsForValue_1 = require("./getComparatorsForValue");
var isObject_1 = require("../utils/isObject");
var log = debug_1.debug('compileQuery');
/**
 * Compile a query expression into a function that accepts an actual entity
 * and returns a query execution result (whether the entity satisfies the query).
 */
function compileQuery(query) {
    log('%j', query);
    return function (data) {
        return Object.entries(query.where)
            .map(function (_a) {
            var _b = __read(_a, 2), property = _b[0], queryChunk = _b[1];
            var actualValue = data[property];
            log('executing query chunk on "%s":\n\n%j\n\non data:\n\n%j\n', property, queryChunk, data);
            log('actual value for "%s":', property, actualValue);
            if (!queryChunk) {
                return true;
            }
            // If an entity doesn't have any value for the property
            // is being queried for, treat it as non-matching.
            if (actualValue == null) {
                return false;
            }
            return Object.entries(queryChunk).reduce(function (acc, _a) {
                var _b = __read(_a, 2), comparatorName = _b[0], expectedValue = _b[1];
                if (!acc) {
                    return acc;
                }
                if (Array.isArray(actualValue)) {
                    log('actual value is array, checking if at least one item matches...', {
                        comparatorName: comparatorName,
                        expectedValue: expectedValue
                    });
                    /**
                     * @fixme Can assume `some`? Why not `every`?
                     */
                    return actualValue.some(function (value) {
                        return compileQuery({ where: queryChunk })(value);
                    });
                }
                // When the actual value is a resolved relational property reference,
                // execute the current query chunk on the referenced entity.
                if (actualValue.__type || isObject_1.isObject(actualValue)) {
                    return compileQuery({ where: queryChunk })(actualValue);
                }
                var comparatorSet = getComparatorsForValue_1.getComparatorsForValue(actualValue);
                log('comparators', comparatorSet);
                var comparatorFn = comparatorSet[comparatorName];
                log('using comparator function for "%s":', comparatorName, comparatorFn);
                outvariant_1.invariant(comparatorFn, 'Failed to compile the query "%j": no comparator found for the chunk "%s". Please check the validity of the query.', query, comparatorName);
                return comparatorFn(expectedValue, actualValue);
            }, true);
        })
            .every(Boolean);
    };
}
exports.compileQuery = compileQuery;
