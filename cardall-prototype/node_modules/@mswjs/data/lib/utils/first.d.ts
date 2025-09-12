/**
 * Return the first element in the given array.
 */
export declare function first<ArrayType extends any[]>(arr: ArrayType): ArrayType extends Array<infer ValueType> ? ValueType | null : never;
