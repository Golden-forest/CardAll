import { DateQuery, NumberQuery, StringQuery, BooleanQuery, QueryToComparator } from './queryTypes';
export declare function getComparatorsForValue(value: string | number): QueryToComparator<StringQuery | NumberQuery | BooleanQuery | DateQuery>;
