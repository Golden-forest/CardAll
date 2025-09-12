import { OneOf, RelationAttributes } from './Relation';
export declare function oneOf<ModelName extends string>(to: ModelName, attributes?: Partial<RelationAttributes>): OneOf<ModelName>;
