/**
 * Clones the given object, preserving its setters/getters.
 */
export declare function spread<ObjectType extends Record<string | number | symbol, unknown>>(source: ObjectType): ObjectType;
