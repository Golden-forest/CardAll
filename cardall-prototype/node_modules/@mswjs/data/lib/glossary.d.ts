import { GraphQLSchema } from 'graphql';
import { GraphQLHandler, HttpHandler } from 'msw';
import { Database } from './db/Database';
import { NullableObject, NullableProperty } from './nullable';
import { PrimaryKey } from './primaryKey';
import { BulkQueryOptions, QueryOptions, QuerySelector, WeakQuerySelector } from './query/queryTypes';
import { OneOf, ManyOf } from './relations/Relation';
export declare const PRIMARY_KEY: unique symbol;
export declare const ENTITY_TYPE: unique symbol;
export declare const DATABASE_INSTANCE: unique symbol;
export declare type KeyType = string | number | symbol;
export declare type AnyObject = Record<KeyType, any>;
export declare type PrimaryKeyType = string | number;
export declare type PrimitiveValueType = string | number | boolean | Date;
export declare type ModelValueType = PrimitiveValueType | PrimitiveValueType[];
export declare type ModelValueTypeGetter = () => ModelValueType;
export declare type ModelDefinition = Record<string, ModelDefinitionValue>;
export declare type ModelDefinitionValue = PrimaryKey<any> | ModelValueTypeGetter | NullableProperty<any> | NullableObject<any> | OneOf<any, boolean> | ManyOf<any, boolean> | NestedModelDefinition;
export declare type NestedModelDefinition = {
    [propertyName: string]: ModelValueTypeGetter | NullableProperty<any> | NullableObject<any> | OneOf<any, boolean> | ManyOf<any, boolean> | NestedModelDefinition;
};
export declare type FactoryAPI<Dictionary extends Record<string, any>> = {
    [ModelName in keyof Dictionary]: ModelAPI<Dictionary, ModelName>;
} & {
    [DATABASE_INSTANCE]: Database<Dictionary>;
};
export declare type ModelDictionary = Record<KeyType, Limit<ModelDefinition>>;
export declare type Limit<Definition extends ModelDefinition> = {
    [Key in keyof Definition]: Definition[Key] extends ModelDefinitionValue ? Definition[Key] : {
        error: 'expected primary key, initial value, or relation';
    };
};
export interface InternalEntityProperties<ModelName extends KeyType> {
    readonly [ENTITY_TYPE]: ModelName;
    readonly [PRIMARY_KEY]: PrimaryKeyType;
}
export declare type Entity<Dictionary extends ModelDictionary, ModelName extends keyof Dictionary> = PublicEntity<Dictionary, ModelName> & InternalEntityProperties<ModelName>;
export declare type PublicEntity<Dictionary extends ModelDictionary, ModelName extends keyof Dictionary> = Value<Dictionary[ModelName], Dictionary>;
export declare type RequiredExactlyOne<ObjectType, KeysType extends keyof ObjectType = keyof ObjectType> = {
    [Key in KeysType]: Required<Pick<ObjectType, Key>> & Partial<Record<Exclude<KeysType, Key>, never>>;
}[KeysType] & Pick<ObjectType, Exclude<keyof ObjectType, KeysType>>;
export declare type DeepRequiredExactlyOne<Target extends AnyObject> = RequiredExactlyOne<{
    [Key in keyof Target]: Target[Key] extends AnyObject ? DeepRequiredExactlyOne<Target[Key]> : Target[Key];
}>;
export declare type InitialValues<Dictionary extends ModelDictionary, ModelName extends keyof Dictionary> = Partial<Value<Dictionary[ModelName], Dictionary>>;
export declare type StrictQueryReturnType<Options extends QueryOptions, ValueType extends unknown> = Options['strict'] extends true ? ValueType : ValueType | null;
export interface ModelAPI<Dictionary extends ModelDictionary, ModelName extends keyof Dictionary> {
    /**
     * Create a single entity for the model.
     */
    create(initialValues?: InitialValues<Dictionary, ModelName>): Entity<Dictionary, ModelName>;
    /**
     * Return the total number of entities.
     */
    count(query?: QueryOptions & QuerySelector<InitialValues<Dictionary, ModelName>>): number;
    /**
     * Find a first entity matching the query.
     */
    findFirst<Options extends QueryOptions>(query: Options & QuerySelector<InitialValues<Dictionary, ModelName>>): StrictQueryReturnType<Options, Entity<Dictionary, ModelName>>;
    /**
     * Find multiple entities.
     */
    findMany(query: QueryOptions & WeakQuerySelector<InitialValues<Dictionary, ModelName>> & BulkQueryOptions<InitialValues<Dictionary, ModelName>>): Entity<Dictionary, ModelName>[];
    /**
     * Return all entities of the current model.
     */
    getAll(): Entity<Dictionary, ModelName>[];
    /**
     * Update a single entity with the next data.
     */
    update<Options extends QueryOptions>(query: Options & QuerySelector<InitialValues<Dictionary, ModelName>> & {
        data: Partial<UpdateManyValue<Dictionary[ModelName], Dictionary>>;
    }): StrictQueryReturnType<Options, Entity<Dictionary, ModelName>>;
    /**
     * Update many entities with the next data.
     */
    updateMany<Options extends QueryOptions>(query: Options & QuerySelector<InitialValues<Dictionary, ModelName>> & {
        data: Partial<UpdateManyValue<Dictionary[ModelName], Dictionary>>;
    }): StrictQueryReturnType<Options, Entity<Dictionary, ModelName>[]>;
    /**
     * Delete a single entity.
     */
    delete<Options extends QueryOptions>(query: Options & QuerySelector<InitialValues<Dictionary, ModelName>>): StrictQueryReturnType<Options, Entity<Dictionary, ModelName>>;
    /**
     * Delete multiple entities.
     */
    deleteMany<Options extends QueryOptions>(query: Options & QuerySelector<InitialValues<Dictionary, ModelName>>): StrictQueryReturnType<Options, Entity<Dictionary, ModelName>[]>;
    /**
     * Generate request handlers of the given type based on the model definition.
     */
    toHandlers(type: 'rest', baseUrl?: string): HttpHandler[];
    /**
     * Generate request handlers of the given type based on the model definition.
     */
    toHandlers(type: 'graphql', baseUrl?: string): GraphQLHandler[];
    /**
     * Generate a graphql schema based on the model definition.
     */
    toGraphQLSchema(): GraphQLSchema;
}
export declare type UpdateManyValue<Target extends AnyObject, Dictionary extends ModelDictionary, ModelRoot extends AnyObject = Target> = Value<Target, Dictionary> | {
    [Key in keyof Target]?: Target[Key] extends PrimaryKey ? (prevValue: ReturnType<Target[Key]['getPrimaryKeyValue']>, entity: Value<Target, Dictionary>) => ReturnType<Target[Key]['getPrimaryKeyValue']> : Target[Key] extends ModelValueTypeGetter ? (prevValue: ReturnType<Target[Key]>, entity: Value<ModelRoot, Dictionary>) => ReturnType<Target[Key]> : Target[Key] extends OneOf<infer ModelName> ? (prevValue: PublicEntity<Dictionary, ModelName>, entity: Value<Target, Dictionary>) => PublicEntity<Dictionary, ModelName> : Target[Key] extends ManyOf<infer ModelName> ? (prevValue: PublicEntity<Dictionary, ModelName>[], entity: Value<Target, Dictionary>) => PublicEntity<Dictionary, ModelName>[] : Target[Key] extends AnyObject ? Partial<UpdateManyValue<Target[Key], Target, ModelRoot>> : (prevValue: ReturnType<Target[Key]>, entity: Value<Target, Dictionary>) => ReturnType<Target[Key]>;
};
export declare type Value<Target extends AnyObject, Dictionary extends ModelDictionary> = {
    [Key in keyof Target]: Target[Key] extends PrimaryKey<any> ? ReturnType<Target[Key]['getPrimaryKeyValue']> : Target[Key] extends NullableProperty<any> ? ReturnType<Target[Key]['getValue']> : Target[Key] extends NullableObject<any> ? Partial<Value<Target[Key]['objectDefinition'], Dictionary>> | null : Target[Key] extends OneOf<infer ModelName, infer Nullable> ? Nullable extends true ? PublicEntity<Dictionary, ModelName> | null : PublicEntity<Dictionary, ModelName> | undefined : Target[Key] extends ManyOf<infer ModelName, infer Nullable> ? Nullable extends true ? PublicEntity<Dictionary, ModelName>[] | null : PublicEntity<Dictionary, ModelName>[] : Target[Key] extends ModelValueTypeGetter ? ReturnType<Target[Key]> : Target[Key] extends AnyObject ? Partial<Value<Target[Key], Dictionary>> : ReturnType<Target[Key]>;
};
