import { Entity } from 'src/glossary';
import { OrderBy } from './queryTypes';
/**
 * Sorts the given list of entities by a certain criteria.
 */
export declare function sortResults<EntityType extends Entity<any, any>>(orderBy: OrderBy<EntityType> | OrderBy<EntityType>[], data: Entity<any, any>[]): void;
