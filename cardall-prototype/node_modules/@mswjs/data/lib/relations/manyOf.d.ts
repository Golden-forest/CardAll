import { ManyOf, RelationAttributes } from './Relation';
export declare function manyOf<ModelName extends string>(to: ModelName, attributes?: Partial<RelationAttributes>): ManyOf<ModelName>;
