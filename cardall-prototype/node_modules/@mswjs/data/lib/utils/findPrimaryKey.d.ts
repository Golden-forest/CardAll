import { ModelDefinition, PrimaryKeyType } from '../glossary';
/**
 * Returns a primary key property name of the given model definition.
 */
export declare function findPrimaryKey(definition: ModelDefinition): PrimaryKeyType | undefined;
