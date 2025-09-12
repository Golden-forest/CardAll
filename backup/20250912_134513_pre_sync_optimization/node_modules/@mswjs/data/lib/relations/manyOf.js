"use strict";
exports.__esModule = true;
exports.manyOf = void 0;
var Relation_1 = require("./Relation");
function manyOf(to, attributes) {
    return new Relation_1.Relation({
        to: to,
        kind: Relation_1.RelationKind.ManyOf,
        attributes: attributes
    });
}
exports.manyOf = manyOf;
