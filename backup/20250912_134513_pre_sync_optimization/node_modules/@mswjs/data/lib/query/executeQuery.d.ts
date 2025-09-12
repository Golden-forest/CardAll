import { Entity, PrimaryKeyType } from '../glossary';
import { BulkQueryOptions, WeakQuerySelector } from './queryTypes';
import { Database } from '../db/Database';
/**
 * Execute a given query against a model in the database.
 * Returns the list of records that satisfy the query.
 */
export declare function executeQuery(modelName: string, primaryKey: PrimaryKeyType, query: WeakQuerySelector<any> & BulkQueryOptions<any>, db: Database<any>): Entity<any, any>[];
