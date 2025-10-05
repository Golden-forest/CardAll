// Database Service Contract
// Defines the interface for database operations

export interface DatabaseServiceContract {
  // Connection Management
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getVersion(): Promise<number>;

  // Health Check
  checkHealth(): Promise<DatabaseHealth>;
  repair(): Promise<RepairResult>;
  backup(): Promise<BackupResult>;
  restore(backupId: string): Promise<RestoreResult>;

  // Table Operations
  createTable(name: string, schema: TableSchema): Promise<void>;
  dropTable(name: string): Promise<void>;
  getTableSchema(name: string): Promise<TableSchema>;
  listTables(): Promise<string[]>;

  // CRUD Operations
  create<T>(tableName: string, data: T): Promise<string>;
  read<T>(tableName: string, id: string): Promise<T | null>;
  update<T>(tableName: string, id: string, data: Partial<T>): Promise<void>;
  delete(tableName: string, id: string): Promise<void>;

  // Query Operations
  query<T>(tableName: string, options?: QueryOptions): Promise<T[]>;
  count(tableName: string, filter?: QueryFilter): Promise<number>;
  aggregate(tableName: string, operations: AggregateOperation[]): Promise<any>;

  // Transaction Management
  beginTransaction(): Promise<Transaction>;
  commitTransaction(transactionId: string): Promise<void>;
  rollbackTransaction(transactionId: string): Promise<void>;

  // Error Handling
  getErrors(filter?: ErrorFilter): Promise<DatabaseErrorRecord[]>;
  clearErrors(): Promise<void>;

  // Performance Monitoring
  getPerformanceMetrics(): Promise<PerformanceMetrics>;
  clearPerformanceMetrics(): Promise<void>;
}

export interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  overallScore: number;
  recommendations: string[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  timestamp: Date;
  metrics: any;
}

export interface RepairResult {
  success: boolean;
  actions: RepairAction[];
  issuesFixed: number;
  issuesRemaining: number;
  duration: number;
}

export interface RepairAction {
  action: string;
  target: string;
  success: boolean;
  message: string;
  duration: number;
}

export interface BackupResult {
  success: boolean;
  backupId: string;
  size: number;
  timestamp: Date;
  checksum: string;
}

export interface RestoreResult {
  success: boolean;
  backupId: string;
  recordsRestored: number;
  duration: number;
  errors: string[];
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  indexes: IndexSchema[];
  primaryKey: string[];
  foreignKeys: ForeignKeySchema[];
}

export interface ColumnSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  nullable: boolean;
  unique: boolean;
  defaultValue?: any;
  validation?: ValidationRule[];
}

export interface ValidationRule {
  type: 'min' | 'max' | 'pattern' | 'required' | 'custom';
  value: any;
  message: string;
}

export interface IndexSchema {
  name: string;
  columns: string[];
  unique: boolean;
  multiEntry?: boolean;
}

export interface ForeignKeySchema {
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete: 'cascade' | 'restrict' | 'set-null';
  onUpdate: 'cascade' | 'restrict';
}

export interface QueryOptions {
  filter?: QueryFilter;
  sort?: SortOption[];
  limit?: number;
  offset?: number;
  include?: IncludeOption[];
}

export interface QueryFilter {
  and?: QueryFilter[];
  or?: QueryFilter[];
  [key: string]: any;
}

export interface SortOption {
  column: string;
  direction: 'asc' | 'desc';
}

export interface IncludeOption {
  relation: string;
  filter?: QueryFilter;
  limit?: number;
}

export interface AggregateOperation {
  operation: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'group';
  column?: string;
  groupBy?: string[];
  having?: QueryFilter;
}

export interface Transaction {
  id: string;
  status: 'active' | 'committed' | 'rolled-back';
  createdAt: Date;
  operations: TransactionOperation[];
}

export interface TransactionOperation {
  type: 'create' | 'update' | 'delete';
  tableName: string;
  data: any;
  timestamp: Date;
}

export interface DatabaseErrorRecord {
  id: string;
  code: string;
  message: string;
  stack?: string;
  type: DatabaseErrorType;
  severity: ErrorSeverity;
  tableName?: string;
  operation?: string;
  timestamp: Date;
  context: any;
}

export type DatabaseErrorType =
  | 'connection'
  | 'schema'
  | 'quota'
  | 'corruption'
  | 'timeout'
  | 'constraint'
  | 'transaction'
  | 'unknown';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface PerformanceMetrics {
  queryTime: QueryTimeMetrics;
  operationCount: OperationCountMetrics;
  memoryUsage: MemoryMetrics;
  databaseSize: DatabaseSizeMetrics;
  timestamp: Date;
}

export interface QueryTimeMetrics {
  average: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
}

export interface OperationCountMetrics {
  reads: number;
  writes: number;
  deletes: number;
  total: number;
}

export interface MemoryMetrics {
  used: number;
  available: number;
  total: number;
  percentage: number;
}

export interface DatabaseSizeMetrics {
  total: number;
  tables: Record<string, number>;
  indexes: number;
}