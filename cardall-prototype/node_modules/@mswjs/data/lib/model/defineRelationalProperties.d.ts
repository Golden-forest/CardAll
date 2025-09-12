import { Database } from '../db/Database';
import { Entity, ModelDictionary, Value } from '../glossary';
import { RelationsList } from '../relations/Relation';
export declare function defineRelationalProperties(entity: Entity<any, any>, initialValues: Partial<Value<any, ModelDictionary>>, relations: RelationsList, dictionary: ModelDictionary, db: Database<any>): void;
