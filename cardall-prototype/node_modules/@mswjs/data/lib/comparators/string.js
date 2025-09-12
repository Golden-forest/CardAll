"use strict";
exports.__esModule = true;
exports.stringComparators = void 0;
exports.stringComparators = {
    equals: function (expected, actual) {
        return expected === actual;
    },
    notEquals: function (expected, actual) {
        return !exports.stringComparators.equals(expected, actual);
    },
    contains: function (expected, actual) {
        return actual.includes(expected);
    },
    notContains: function (expected, actual) {
        return !exports.stringComparators.contains(expected, actual);
    },
    gt: function (expected, actual) {
        return actual > expected;
    },
    gte: function (expected, actual) {
        return actual >= expected;
    },
    lt: function (expected, actual) {
        return actual < expected;
    },
    lte: function (expected, actual) {
        return actual <= expected;
    },
    "in": function (expected, actual) {
        return expected.includes(actual);
    },
    notIn: function (expected, actual) {
        return !exports.stringComparators["in"](expected, actual);
    }
};
