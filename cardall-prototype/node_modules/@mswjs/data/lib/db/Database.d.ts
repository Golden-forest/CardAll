import { Emitter } from 'strict-event-emitter';
import { Entity, KeyType, ModelDictionary, PrimaryKeyType } from '../glossary';
export declare const SERIALIZED_INTERNAL_PROPERTIES_KEY = "SERIALIZED_INTERNAL_PROPERTIES";
declare type Models<Dictionary extends ModelDictionary> = Record<keyof Dictionary, Map<PrimaryKeyType, Entity<Dictionary, any>>>;
export interface SerializedInternalEntityProperties {
    entityType: string;
    primaryKey: PrimaryKeyType;
}
export interface SerializedEntity extends Entity<any, any> {
    [SERIALIZED_INTERNAL_PROPERTIES_KEY]: SerializedInternalEntityProperties;
}
export declare type DatabaseEventsMap = {
    create: [
        sourceId: string,
        modelName: KeyType,
        entity: SerializedEntity,
        customPrimaryKey?: PrimaryKeyType
    ];
    update: [
        sourceId: string,
        modelName: KeyType,
        prevEntity: SerializedEntity,
        nextEntity: SerializedEntity
    ];
    delete: [sourceId: string, modelName: KeyType, primaryKey: PrimaryKeyType];
};
export declare class Database<Dictionary extends ModelDictionary> {
    id: string;
    events: Emitter<DatabaseEventsMap>;
    private models;
    constructor(dictionary: Dictionary);
    /**
     * Generates a unique MD5 hash based on the database
     * module location and invocation order. Used to reproducibly
     * identify a database instance among sibling instances.
     */
    private generateId;
    private serializeEntity;
    getModel<ModelName extends keyof Dictionary>(name: ModelName): Models<Dictionary>[ModelName];
    create<ModelName extends keyof Dictionary>(modelName: ModelName, entity: Entity<Dictionary, ModelName>, customPrimaryKey?: PrimaryKeyType): Map<PrimaryKeyType, Entity<Dictionary, ModelName>>;
    update<ModelName extends keyof Dictionary>(modelName: ModelName, prevEntity: Entity<Dictionary, ModelName>, nextEntity: Entity<Dictionary, ModelName>): void;
    delete<ModelName extends keyof Dictionary>(modelName: ModelName, primaryKey: PrimaryKeyType): void;
    has<ModelName extends keyof Dictionary>(modelName: ModelName, primaryKey: PrimaryKeyType): boolean;
    count<ModelName extends string>(modelName: ModelName): number;
    listEntities<ModelName extends keyof Dictionary>(modelName: ModelName): Entity<Dictionary, ModelName>[];
}
export {};
