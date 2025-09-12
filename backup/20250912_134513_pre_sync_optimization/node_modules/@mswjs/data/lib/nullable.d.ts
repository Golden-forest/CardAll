import { ModelValueType, NestedModelDefinition } from './glossary';
import { ManyOf, OneOf, Relation, RelationKind } from './relations/Relation';
export declare class NullableObject<ValueType extends NestedModelDefinition> {
    objectDefinition: ValueType;
    defaultsToNull: boolean;
    constructor(definition: ValueType, defaultsToNull: boolean);
}
export declare type NullableGetter<ValueType extends ModelValueType> = () => ValueType | null;
export declare class NullableProperty<ValueType extends ModelValueType> {
    getValue: NullableGetter<ValueType>;
    constructor(getter: NullableGetter<ValueType>);
}
export declare function nullable<ValueType extends NestedModelDefinition>(value: ValueType, options?: {
    defaultsToNull?: boolean;
}): NullableObject<ValueType>;
export declare function nullable<ValueType extends ModelValueType>(value: NullableGetter<ValueType>, options?: {
    defaultsToNull?: boolean;
}): NullableProperty<ValueType>;
export declare function nullable<ValueType extends Relation<any, any, any, {
    nullable: false;
}>>(value: ValueType, options?: {
    defaultsToNull?: boolean;
}): ValueType extends Relation<infer Kind, infer Key, any, {
    nullable: false;
}> ? Kind extends RelationKind.ManyOf ? ManyOf<Key, true> : OneOf<Key, true> : never;
