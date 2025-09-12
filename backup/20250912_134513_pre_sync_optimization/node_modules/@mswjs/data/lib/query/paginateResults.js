"use strict";
exports.__esModule = true;
exports.paginateResults = void 0;
var glossary_1 = require("../glossary");
function getEndIndex(start, end) {
    return end ? start + end : undefined;
}
function paginateResults(query, data) {
    if (query.cursor) {
        var cursorIndex = data.findIndex(function (entity) {
            return entity[entity[glossary_1.PRIMARY_KEY]] === query.cursor;
        });
        if (cursorIndex === -1) {
            return [];
        }
        return data.slice(cursorIndex + 1, getEndIndex(cursorIndex + 1, query.take));
    }
    var start = query.skip || 0;
    return data.slice(start, getEndIndex(start, query.take));
}
exports.paginateResults = paginateResults;
