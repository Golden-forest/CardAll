"use strict";
exports.__esModule = true;
exports.dateComparators = void 0;
var date_fns_1 = require("date-fns");
exports.dateComparators = {
    equals: function (expected, actual) {
        return date_fns_1.compareAsc(expected, actual) === 0;
    },
    notEquals: function (expected, actual) {
        return date_fns_1.compareAsc(expected, actual) !== 0;
    },
    gt: function (expected, actual) {
        return date_fns_1.compareAsc(actual, expected) === 1;
    },
    gte: function (expected, actual) {
        return [0, 1].includes(date_fns_1.compareAsc(actual, expected));
    },
    lt: function (expected, actual) {
        return date_fns_1.compareAsc(actual, expected) === -1;
    },
    lte: function (expected, actual) {
        return [-1, 0].includes(date_fns_1.compareAsc(actual, expected));
    }
};
