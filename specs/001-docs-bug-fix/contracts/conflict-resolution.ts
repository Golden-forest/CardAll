// Conflict Resolution Service Contract
// Defines the interface for conflict detection and resolution

export interface ConflictResolutionServiceContract {
  // Conflict Detection
  detectConflicts(data: ConflictData): Promise<ConflictDetectionResult>;
  detectVersionConflicts(localData: any, remoteData: any): Promise<Conflict[]>;
  detectTimestampConflicts(localData: any, remoteData: any): Promise<Conflict[]>;
  detectContentConflicts(localData: any, remoteData: any): Promise<Conflict[]>;

  // Rule Management
  getRules(): Promise<ConflictResolutionRule[]>;
  getRule(id: string): Promise<ConflictResolutionRule | null>;
  addRule(rule: Omit<ConflictResolutionRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;
  updateRule(id: string, updates: Partial<ConflictResolutionRule>): Promise<void>;
  deleteRule(id: string): Promise<void>;
  enableRule(id: string): Promise<void>;
  disableRule(id: string): Promise<void>;

  // Conflict Resolution
  resolveConflicts(conflicts: Conflict[], strategy: ResolutionStrategy): Promise<ResolutionResult>;
  autoResolveConflicts(conflicts: Conflict[]): Promise<ResolutionResult>;
  manualResolveConflicts(conflicts: Conflict[], resolutions: ManualResolution[]): Promise<ResolutionResult>;

  // Conflict History
  getConflictHistory(filter?: ConflictHistoryFilter): Promise<ConflictHistory[]>;
  getConflictStats(): Promise<ConflictStats>;
  clearConflictHistory(): Promise<void>;

  // Configuration
  getConfiguration(): Promise<ConflictResolutionConfig>;
  updateConfiguration(config: Partial<ConflictResolutionConfig>): Promise<void>;
  resetConfiguration(): Promise<void>;
}

export interface ConflictData {
  entityType: string;
  entityId: string;
  localData: any;
  remoteData: any;
  baseData?: any;
  context?: any;
}

export interface ConflictDetectionResult {
  conflicts: Conflict[];
  errors: ConflictDetectionError[];
  successfulRules: string[];
  executionTime: number;
}

export interface Conflict {
  id: string;
  type: ConflictType;
  entityType: string;
  entityId: string;
  field?: string;
  localValue: any;
  remoteValue: any;
  baseValue?: any;
  severity: ConflictSeverity;
  autoResolvable: boolean;
  detectedAt: Date;
  detectedBy: string;
  context: any;
}

export type ConflictType =
  | 'version'
  | 'timestamp'
  | 'content'
  | 'structure'
  | 'reference'
  | 'custom';

export type ConflictSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ConflictDetectionError {
  ruleName: string;
  error: string;
  timestamp: Date;
  context: any;
}

export interface ConflictResolutionRule {
  id: string;
  name: string;
  description: string;
  type: RuleType;
  priority: number;
  active: boolean;
  config: RuleConfig;
  conditions: RuleCondition[];
  actions: RuleAction[];
  createdAt: Date;
  updatedAt: Date;
}

export type RuleType = 'version' | 'timestamp' | 'content' | 'custom';

export interface RuleConfig {
  autoResolve: boolean;
  resolutionStrategy: ResolutionStrategy;
  conflictThreshold?: number;
  fields?: string[];
  customLogic?: string;
}

export interface RuleCondition {
  field?: string;
  operator: 'equals' | 'not-equals' | 'contains' | 'not-contains' | 'greater' | 'less';
  value: any;
  logical?: 'and' | 'or';
}

export interface RuleAction {
  type: 'resolve' | 'notify' | 'log' | 'custom';
  strategy?: ResolutionStrategy;
  targetField?: string;
  targetValue?: any;
  message?: string;
}

export interface ResolutionStrategy {
  type: ResolutionType;
  config: ResolutionConfig;
}

export type ResolutionType =
  | 'local-wins'
  | 'remote-wins'
  | 'newest-wins'
  | 'oldest-wins'
  | 'merge'
  | 'custom';

export interface ResolutionConfig {
  preferLocal?: boolean;
  preferRemote?: boolean;
  mergeStrategy?: 'smart' | 'simple' | 'field-by-field';
  customResolver?: string;
  conflictFields?: string[];
}

export interface ResolutionResult {
  resolved: Conflict[];
  unresolved: Conflict[];
  errors: ResolutionError[];
  resolutionTime: number;
  summary: ResolutionSummary;
}

export interface ResolutionError {
  conflictId: string;
  error: string;
  timestamp: Date;
  context: any;
}

export interface ResolutionSummary {
  totalConflicts: number;
  resolvedCount: number;
  unresolvedCount: number;
  autoResolved: number;
  manualResolved: number;
  resolutionType: Record<ResolutionType, number>;
}

export interface ManualResolution {
  conflictId: string;
  resolution: ResolutionType;
  value?: any;
  note?: string;
}

export interface ConflictHistory {
  id: string;
  conflictId: string;
  entityType: string;
  entityId: string;
  conflictType: ConflictType;
  resolutionType: ResolutionType;
  resolvedAt: Date;
  resolvedBy: 'auto' | 'manual';
  resolutionTime: number;
  success: boolean;
  error?: string;
}

export interface ConflictHistoryFilter {
  entityType?: string;
  conflictType?: ConflictType[];
  resolutionType?: ResolutionType[];
  dateRange?: { start?: Date; end?: Date };
  resolvedBy?: 'auto' | 'manual';
  success?: boolean;
}

export interface ConflictStats {
  totalConflicts: number;
  conflictsByType: Record<ConflictType, number>;
  conflictsByEntity: Record<string, number>;
  resolutionRates: {
    overall: number;
    auto: number;
    manual: number;
  };
  averageResolutionTime: number;
  topConflictFields: Array<{ field: string; count: number }>;
}

export interface ConflictResolutionConfig {
  autoResolve: boolean;
  defaultStrategy: ResolutionStrategy;
  maxConflictAge: number; // in milliseconds
  retentionPeriod: number; // in milliseconds
  notificationEnabled: boolean;
  loggingEnabled: boolean;
  performanceMonitoring: boolean;
  customRulesEnabled: boolean;
}