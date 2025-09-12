"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
exports.OperationError = exports.OperationErrorType = void 0;
var OperationErrorType;
(function (OperationErrorType) {
    OperationErrorType["MissingPrimaryKey"] = "MissingPrimaryKey";
    OperationErrorType["DuplicatePrimaryKey"] = "DuplicatePrimaryKey";
    OperationErrorType["EntityNotFound"] = "EntityNotFound";
})(OperationErrorType = exports.OperationErrorType || (exports.OperationErrorType = {}));
var OperationError = /** @class */ (function (_super) {
    __extends(OperationError, _super);
    function OperationError(type, message) {
        var _this = _super.call(this, message) || this;
        _this.name = 'OperationError';
        _this.type = type;
        return _this;
    }
    return OperationError;
}(Error));
exports.OperationError = OperationError;
