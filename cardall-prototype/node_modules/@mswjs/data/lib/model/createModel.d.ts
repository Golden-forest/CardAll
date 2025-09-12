import { Database } from '../db/Database';
import { Entity, ModelDefinition, ModelDictionary, Value } from '../glossary';
import { ParsedModelDefinition } from './parseModelDefinition';
export declare function createModel<Dictionary extends ModelDictionary, ModelName extends string>(modelName: ModelName, definition: ModelDefinition, dictionary: Dictionary, parsedModel: ParsedModelDefinition, initialValues: Partial<Value<Dictionary[ModelName], Dictionary>>, db: Database<Dictionary>): Entity<Dictionary, ModelName>;
