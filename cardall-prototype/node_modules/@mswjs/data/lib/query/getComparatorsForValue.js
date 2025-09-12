"use strict";
exports.__esModule = true;
exports.getComparatorsForValue = void 0;
var boolean_1 = require("../comparators/boolean");
var date_1 = require("../comparators/date");
var number_1 = require("../comparators/number");
var string_1 = require("../comparators/string");
function getComparatorsForValue(value) {
    switch (value.constructor.name) {
        case 'String':
            return string_1.stringComparators;
        case 'Number':
            return number_1.numberComparators;
        case 'Boolean':
            return boolean_1.booleanComparators;
        case 'Date':
            return date_1.dateComparators;
        default:
            throw new Error("Failed to find a comparator for the value \"" + JSON.stringify(value) + "\" of type \"" + value.constructor.name + "\".");
    }
}
exports.getComparatorsForValue = getComparatorsForValue;
