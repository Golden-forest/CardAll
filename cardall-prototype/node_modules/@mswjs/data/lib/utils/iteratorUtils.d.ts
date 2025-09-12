import { PrimaryKeyType } from '../glossary';
export declare function forEach<K extends PrimaryKeyType, V>(fn: (key: K, value: V) => any, map: Map<K, V>): void;
export declare function filter<K extends PrimaryKeyType, V>(predicate: (key: K, value: V) => boolean, map: Map<K, V>): Map<K, V>;
