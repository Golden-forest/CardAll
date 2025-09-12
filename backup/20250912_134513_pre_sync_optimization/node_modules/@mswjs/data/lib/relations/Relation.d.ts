import { Database } from '../db/Database';
import { Entity, KeyType, ModelDictionary, PrimaryKeyType, Value } from '../glossary';
export declare enum RelationKind {
    OneOf = "ONE_OF",
    ManyOf = "MANY_OF"
}
export interface RelationAttributes {
    nullable: boolean;
    unique: boolean;
}
export interface RelationSource {
    modelName: string;
    primaryKey: PrimaryKeyType;
    propertyPath: string[];
}
export interface RelationDefinition<Kind extends RelationKind, ModelName extends KeyType, Attributes extends Partial<RelationAttributes>> {
    to: ModelName;
    kind: Kind;
    attributes?: Attributes;
}
export declare type LazyRelation<Kind extends RelationKind, ModelName extends KeyType, Dictionary extends ModelDictionary> = (modelName: ModelName, propertyPath: string, dictionary: Dictionary, db: Database<Dictionary>) => Relation<Kind, ModelName, Dictionary, any>;
export declare type OneOf<ModelName extends KeyType, Nullable extends boolean = false> = Relation<RelationKind.OneOf, ModelName, any, {
    nullable: Nullable;
}>;
export declare type ManyOf<ModelName extends KeyType, Nullable extends boolean = false> = Relation<RelationKind.ManyOf, ModelName, any, {
    nullable: Nullable;
}>;
export declare type RelationsList = Array<{
    propertyPath: string[];
    relation: Relation<any, any, any, any>;
}>;
export declare class Relation<Kind extends RelationKind, ModelName extends KeyType, Dictionary extends ModelDictionary, Attributes extends Partial<RelationAttributes>, ReferenceType = Kind extends RelationKind.OneOf ? Value<Dictionary[ModelName], Dictionary> : Value<Dictionary[ModelName], Dictionary>[]> {
    kind: Kind;
    attributes: RelationAttributes;
    source: RelationSource;
    target: {
        modelName: string;
        primaryKey: PrimaryKeyType;
    };
    private dictionary;
    private db;
    constructor(definition: RelationDefinition<Kind, ModelName, Attributes>);
    /**
     * Applies the relation to the given entity.
     * Creates a connection between the relation's target and source.
     * Does not define the proxy property getter.
     */
    apply(entity: Entity<any, any>, propertyPath: string[], dictionary: Dictionary, db: Database<Dictionary>): void;
    /**
     * Updates the relation references (values) to resolve the relation with.
     */
    resolveWith(entity: Entity<Dictionary, string>, refs: ReferenceType | null): void;
    private setValueResolver;
}
