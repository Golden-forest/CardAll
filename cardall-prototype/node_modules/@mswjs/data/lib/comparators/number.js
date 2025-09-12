"use strict";
exports.__esModule = true;
exports.numberComparators = void 0;
var numberInRange_1 = require("../utils/numberInRange");
exports.numberComparators = {
    equals: function (expected, actual) {
        return actual === expected;
    },
    notEquals: function (expected, actual) {
        return !exports.numberComparators.equals(expected, actual);
    },
    between: function (expected, actual) {
        return numberInRange_1.numberInRange(expected[0], expected[1], actual);
    },
    notBetween: function (expected, actual) {
        return !exports.numberComparators.between(expected, actual);
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
        return !exports.numberComparators["in"](expected, actual);
    }
};
