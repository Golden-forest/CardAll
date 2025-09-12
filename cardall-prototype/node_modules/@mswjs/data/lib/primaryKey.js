"use strict";
exports.__esModule = true;
exports.primaryKey = exports.PrimaryKey = void 0;
var PrimaryKey = /** @class */ (function () {
    function PrimaryKey(getter) {
        this.getPrimaryKeyValue = getter;
    }
    return PrimaryKey;
}());
exports.PrimaryKey = PrimaryKey;
function primaryKey(getter) {
    return new PrimaryKey(getter);
}
exports.primaryKey = primaryKey;
