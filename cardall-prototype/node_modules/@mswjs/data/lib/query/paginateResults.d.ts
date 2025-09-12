import { Entity } from '../glossary';
import { BulkQueryOptions, WeakQuerySelector } from './queryTypes';
export declare function paginateResults(query: WeakQuerySelector<any> & BulkQueryOptions<any>, data: Entity<any, any>[]): Entity<any, any>[];
