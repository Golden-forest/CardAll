import { FactoryAPI, ModelDictionary } from './glossary';
/**
 * Create a database with the given models.
 */
export declare function factory<Dictionary extends ModelDictionary>(dictionary: Dictionary): FactoryAPI<Dictionary>;
