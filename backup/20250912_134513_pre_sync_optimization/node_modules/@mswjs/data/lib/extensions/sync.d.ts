import { Database, DatabaseEventsMap } from '../db/Database';
export declare type DatabaseMessageEventData = {
    operationType: 'create';
    payload: DatabaseEventsMap['create'];
} | {
    operationType: 'update';
    payload: DatabaseEventsMap['update'];
} | {
    operationType: 'delete';
    payload: DatabaseEventsMap['delete'];
};
/**
 * Synchronizes database operations across multiple clients.
 */
export declare function sync(db: Database<any>): void;
