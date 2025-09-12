import { ModelDefinition, PrimaryKeyType, ModelDictionary } from '../glossary';
import { RelationsList } from '../relations/Relation';
export interface ParsedModelDefinition {
    primaryKey: PrimaryKeyType;
    properties: Array<string[]>;
    relations: RelationsList;
}
export declare function parseModelDefinition<Dictionary extends ModelDictionary>(dictionary: Dictionary, modelName: string, definition: ModelDefinition): ParsedModelDefinition;
