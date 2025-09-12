import { QuerySelector } from './queryTypes';
/**
 * Compile a query expression into a function that accepts an actual entity
 * and returns a query execution result (whether the entity satisfies the query).
 */
export declare function compileQuery<Data extends Record<string, any>>(query: QuerySelector<any>): (data: Data) => boolean;
