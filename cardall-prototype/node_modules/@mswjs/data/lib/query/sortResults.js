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
exports.sortResults = void 0;
var debug_1 = require("debug");
var get_1 = __importDefault(require("lodash/get"));
var log = debug_1.debug('sortResults');
function warnOnIneffectiveSortingKeys(sortCriteria) {
    var _a = __read(Object.keys(sortCriteria)), mainCriteria = _a[0], siblings = _a.slice(1);
    if (siblings.length > 0) {
        console.warn('Sorting by "%s" has no effect: already sorted by "%s".', siblings.join(','), mainCriteria);
    }
}
function flattenSortCriteria(orderBy, propertyPath) {
    if (propertyPath === void 0) { propertyPath = []; }
    log('flattenSortCriteria:', orderBy, propertyPath);
    return orderBy.reduce(function (criteria, properties) {
        warnOnIneffectiveSortingKeys(properties);
        // Multiple properties in a single criteria object are forbidden.
        // Use the list of criteria objects for multi-criteria sort.
        var property = Object.keys(properties)[0];
        var sortDirection = properties[property];
        var path = propertyPath.concat(property.toString());
        log({ property: property, sortDirection: sortDirection, path: path });
        // Recursively flatten order criteria when referencing
        // relational properties.
        var newCriteria = typeof sortDirection === 'object'
            ? flattenSortCriteria([sortDirection], path)
            : [[path, sortDirection]];
        log('pushing new criteria:', newCriteria);
        return criteria.concat(newCriteria);
    }, []);
}
/**
 * Sorts the given list of entities by a certain criteria.
 */
function sortResults(orderBy, data) {
    log('sorting data:', data);
    log('order by:', orderBy);
    var criteriaList = [].concat(orderBy);
    log('criteria list:', criteriaList);
    var criteria = flattenSortCriteria(criteriaList);
    log('flattened criteria:', JSON.stringify(criteria));
    data.sort(function (left, right) {
        var e_1, _a;
        try {
            for (var criteria_1 = __values(criteria), criteria_1_1 = criteria_1.next(); !criteria_1_1.done; criteria_1_1 = criteria_1.next()) {
                var _b = __read(criteria_1_1.value, 2), path = _b[0], sortDirection = _b[1];
                var leftValue = get_1["default"](left, path);
                var rightValue = get_1["default"](right, path);
                log('comparing value at "%s" (%s): "%s" / "%s"', path, sortDirection, leftValue, rightValue);
                if (leftValue > rightValue) {
                    return sortDirection === 'asc' ? 1 : -1;
                }
                if (leftValue < rightValue) {
                    return sortDirection === 'asc' ? -1 : 1;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (criteria_1_1 && !criteria_1_1.done && (_a = criteria_1["return"])) _a.call(criteria_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return 0;
    });
    log('sorted results:\n', data);
}
exports.sortResults = sortResults;
