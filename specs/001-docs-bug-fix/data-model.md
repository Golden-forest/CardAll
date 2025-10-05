# Data Model: CardAll Bug Fix Plan

**Date**: 2025-10-01
**Feature**: CardAll Bug Fix Plan
**Phase**: Phase 1 - Design & Contracts

## Entity Definitions

### 1. Sync Queue State

```typescript
interface SyncQueueState {
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
}
```

### 2. Sync Operation

```typescript
interface SyncOperation {
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
}
```

### 3. Sync Error

```typescript
interface SyncError {
  id: string;
  code: string;
  message: string;
  stack?: string;
  type: 'network' | 'database' | 'validation' | 'conflict' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
  timestamp: Date;
  context: any;
}
```

### 4. Conflict Resolution Rule

```typescript
interface ConflictResolutionRule {
  id: string;
  name: string;
  description: string;
  type: 'version' | 'timestamp' | 'content' | 'custom';
  priority: number;
  active: boolean;
  config: any;
  createdAt: Date;
  updatedAt: Date;
}
```

### 5. Database Connection Status

```typescript
interface DatabaseConnectionStatus {
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
}
```

### 6. Database Error

```typescript
interface DatabaseError {
  code: string;
  message: string;
  stack?: string;
  type: 'connection' | 'schema' | 'quota' | 'corruption' | 'timeout';
  retryable: boolean;
  timestamp: Date;
}
```

## Entity Relationships

### Sync Queue → Sync Operations
- One-to-many relationship
- Queue manages multiple operations
- Operations belong to exactly one queue

### Sync Operation → Sync Error
- One-to-many relationship
- Operations can have multiple errors
- Errors are logged for each operation attempt

### Conflict Resolution Rule → Sync Operation
- Many-to-many relationship
- Rules can be applied to multiple operations
- Operations can use multiple rules

### Database → Sync Queue State
- One-to-one relationship
- Database maintains single queue state
- State reflects current synchronization status

## State Transitions

### Sync Queue State Machine

```
idle → processing → completed → idle
       ↓
      error → recovering → processing
       ↓
      failed
```

**Valid Transitions**:
- `idle` → `processing` (when starting sync)
- `processing` → `completed` (when sync successful)
- `processing` → `error` (when sync fails)
- `error` → `recovering` (when starting recovery)
- `recovering` → `processing` (when recovery successful)
- `error` → `failed` (when max retries exceeded)

### Sync Operation Lifecycle

```
pending → processing → completed
          ↓
         failed → retry → processing
```

**Valid Transitions**:
- `pending` → `processing` (when operation starts)
- `processing` → `completed` (when operation successful)
- `processing` → `failed` (when operation fails)
- `failed` → `pending` (when retrying)

## Validation Rules

### Sync Queue Validation
- Status must be valid enum value
- Error count cannot exceed max retries
- Retry count must be non-negative
- Next retry time must be future when set

### Sync Operation Validation
- Entity type must be valid enum value
- Operation type must be valid enum value
- Priority must be between 1 and 10
- Retry count cannot exceed max retries

### Error Validation
- Error code must be non-empty string
- Error type must be valid enum value
- Severity must be valid enum value
- Timestamp must be valid date

### Database Connection Validation
- Version must be positive integer
- Performance times must be positive numbers
- Health status must be valid enum value

## Indexing Strategy

### SyncQueueState
- Primary key: `id`
- Secondary index: `status` (for filtering by state)
- Secondary index: `updatedAt` (for sorting)

### SyncOperation
- Primary key: `id`
- Secondary index: `status` (for filtering by state)
- Secondary index: `entityType` (for filtering by type)
- Secondary index: `priority` (for ordering)
- Secondary index: `createdAt` (for chronological ordering)

### SyncError
- Primary key: `id`
- Secondary index: `type` (for filtering by error type)
- Secondary index: `severity` (for filtering by severity)
- Secondary index: `timestamp` (for time-based queries)

## Data Migration Requirements

### Version 1 → Version 2 (Bug Fix Schema)
- Add `SyncQueueState` table
- Add `SyncOperation` table
- Add `SyncError` table
- Add `ConflictResolutionRule` table
- Migrate existing sync data to new schema
- Add indexes for performance optimization

### Version 2 → Version 3 (Enhanced Error Handling)
- Add error classification fields
- Add retry logic fields
- Add performance monitoring fields
- Update existing records with default values

## Security Considerations

### Data Protection
- Error logs should not contain sensitive information
- User data should be encrypted in IndexedDB
- Database access should be restricted to authenticated users

### Access Control
- Sync operations should be user-scoped
- Error logs should be user-isolated
- Database operations should be permission-controlled

## Performance Considerations

### Query Optimization
- Use appropriate indexes for common queries
- Implement query pagination for large datasets
- Cache frequently accessed data

### Storage Optimization
- Implement data compression for large objects
- Use efficient data types
- Implement data retention policies

## Testing Considerations

### Unit Testing
- Test entity validation
- Test state transitions
- Test relationship integrity

### Integration Testing
- Test database operations
- Test error scenarios
- Test performance characteristics

---

**Data Model Complete** - Ready for contract generation and task planning