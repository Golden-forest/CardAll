// Sync Service Contract
// Defines the interface for sync operations

export interface SyncServiceContract {
  // Queue Management
  getQueueState(): Promise<SyncQueueState>;
  startSync(): Promise<void>;
  stopSync(): Promise<void>;
  pauseSync(): Promise<void>;
  resumeSync(): Promise<void>;

  // Operation Management
  addOperation(operation: Omit<SyncOperation, 'id' | 'createdAt' | 'status'>): Promise<string>;
  updateOperation(id: string, updates: Partial<SyncOperation>): Promise<void>;
  deleteOperation(id: string): Promise<void>;
  getOperations(filter?: SyncOperationFilter): Promise<SyncOperation[]>;

  // Error Handling
  getErrors(filter?: ErrorFilter): Promise<SyncError[]>;
  clearErrors(): Promise<void>;
  retryOperation(id: string): Promise<void>;

  // Conflict Resolution
  getConflictRules(): Promise<ConflictResolutionRule[]>;
  addConflictRule(rule: Omit<ConflictResolutionRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;
  updateConflictRule(id: string, updates: Partial<ConflictResolutionRule>): Promise<void>;
  deleteConflictRule(id: string): Promise<void>;

  // Database Health
  getDatabaseHealth(): Promise<DatabaseConnectionStatus>;
  checkDatabaseConnection(): Promise<boolean>;
  repairDatabase(): Promise<boolean>;
}

export interface SyncOperationFilter {
  status?: SyncOperation['status'][];
  entityType?: SyncOperation['entityType'][];
  priority?: { min?: number; max?: number };
  dateRange?: { start?: Date; end?: Date };
}

export interface ErrorFilter {
  type?: SyncError['type'][];
  severity?: SyncError['severity'][];
  retryable?: boolean;
  dateRange?: { start?: Date; end?: Date };
}

// Type definitions matching the data model
export type SyncQueueState = {
  id: string;
  status: 'idle' | 'processing' | 'error' | 'recovering' | 'failed';
  currentOperation: string | null;
  errorCount: number;
  lastError: SyncError | null;
  retryCount: number;
  maxRetries: number;
  nextRetryTime: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SyncOperation = {
  id: string;
  type: 'create' | 'update' | 'delete' | 'sync';
  entityType: 'card' | 'folder' | 'tag' | 'image';
  entityId: string;
  data: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  processedAt: Date | null;
  error: SyncError | null;
};

export type SyncError = {
  id: string;
  code: string;
  message: string;
  stack?: string;
  type: 'network' | 'database' | 'validation' | 'conflict' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
  timestamp: Date;
  context: any;
};

export type ConflictResolutionRule = {
  id: string;
  name: string;
  description: string;
  type: 'version' | 'timestamp' | 'content' | 'custom';
  priority: number;
  active: boolean;
  config: any;
  createdAt: Date;
  updatedAt: Date;
};

export type DatabaseConnectionStatus = {
  isConnected: boolean;
  version: number;
  lastChecked: Date;
  health: 'healthy' | 'degraded' | 'unhealthy';
  error: DatabaseError | null;
  performance: {
    readTime: number;
    writeTime: number;
    queryTime: number;
  };
};

export type DatabaseError = {
  code: string;
  message: string;
  stack?: string;
  type: 'connection' | 'schema' | 'quota' | 'corruption' | 'timeout';
  retryable: boolean;
  timestamp: Date;
};