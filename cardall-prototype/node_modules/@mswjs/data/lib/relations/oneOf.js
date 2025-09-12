"use strict";
exports.__esModule = true;
exports.oneOf = void 0;
var Relation_1 = require("./Relation");
function oneOf(to, attributes) {
    return new Relation_1.Relation({
        to: to,
        kind: Relation_1.RelationKind.OneOf,
        attributes: attributes
    });
}
exports.oneOf = oneOf;
