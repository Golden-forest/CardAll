"use strict";
exports.__esModule = true;
exports.drop = void 0;
function drop(factoryApi) {
    Object.values(factoryApi).forEach(function (model) {
        model.deleteMany({ where: {} });
    });
}
exports.drop = drop;
