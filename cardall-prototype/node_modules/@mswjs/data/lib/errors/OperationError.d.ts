export declare enum OperationErrorType {
    MissingPrimaryKey = "MissingPrimaryKey",
    DuplicatePrimaryKey = "DuplicatePrimaryKey",
    EntityNotFound = "EntityNotFound"
}
export declare class OperationError<ErrorType = OperationErrorType> extends Error {
    type: ErrorType;
    constructor(type: ErrorType, message?: string);
}
