import { PrimaryKeyType } from './glossary';
export declare type PrimaryKeyGetter<ValueType extends PrimaryKeyType> = () => ValueType;
export declare class PrimaryKey<ValueType extends PrimaryKeyType = string> {
    getPrimaryKeyValue: PrimaryKeyGetter<ValueType>;
    constructor(getter: PrimaryKeyGetter<ValueType>);
}
export declare function primaryKey<ValueType extends PrimaryKeyType>(getter: PrimaryKeyGetter<ValueType>): PrimaryKey<ValueType>;
