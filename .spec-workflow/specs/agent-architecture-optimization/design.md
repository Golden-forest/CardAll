# Design Document

## 技术架构设计方案

### 架构概览

基于CardEverything项目的本地优先架构（IndexedDB + Supabase），本设计方案专注于修复冲突状态管理、优化智能解决策略、强化数据持久化机制和完善UI层集成。

## 核心问题技术分析

### 1. 冲突状态管理缺陷

**问题定位**:
- 文件: `unified-sync-service-base.ts:1353-1548`
- 根因: 冲突解决后状态更新机制不完整
- 影响: 已解决冲突仍显示为"待处理"

**技术解决方案**:
```typescript
// 增强的冲突状态管理
interface EnhancedSyncConflict extends SyncConflict {
  status: 'pending' | 'resolving' | 'resolved' | 'failed' | 'manual';
  resolvedAt?: Date;
  resolutionStrategy?: 'local' | 'cloud' | 'merge' | 'manual';
  autoResolved: boolean;
  requiresUserConfirmation: boolean;
  retryCount: number;
  lastAttempt?: Date;
}

// 完整的冲突解决生命周期
class ConflictStateManager {
  private conflicts: Map<string, EnhancedSyncConflict> = new Map();
  
  async resolveConflict(conflictId: string, strategy: ConflictResolutionStrategy): Promise<boolean> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) return false;
    
    // 更新状态为解决中
    conflict.status = 'resolving';
    conflict.lastAttempt = new Date();
    
    try {
      // 执行解决策略
      const result = await this.executeResolutionStrategy(conflict, strategy);
      
      if (result.success) {
        // 更新为已解决状态
        conflict.status = 'resolved';
        conflict.resolvedAt = new Date();
        conflict.resolutionStrategy = strategy.type;
        conflict.autoResolved = strategy.auto;
        
        // 从活跃冲突中移除
        this.conflicts.delete(conflictId);
        
        // 持久化状态
        await this.persistConflictState();
        
        return true;
      } else {
        // 解决失败
        conflict.status = 'failed';
        conflict.retryCount++;
        
        if (conflict.retryCount >= 3) {
          // 超过重试次数，标记为需要手动解决
          conflict.status = 'manual';
          conflict.requiresUserConfirmation = true;
        }
        
        return false;
      }
    } catch (error) {
      console.error(`Conflict resolution failed: ${error}`);
      conflict.status = 'failed';
      conflict.retryCount++;
      return false;
    }
  }
}
```

### 2. 智能解决策略优化

**问题定位**:
- 文件: `intelligent-conflict-resolver.ts:164-183`
- 根因: 置信度阈值0.7过高，导致大量简单冲突被误判

**技术解决方案**:
```typescript
// 优化的智能冲突解决策略
class OptimizedConflictResolver {
  private strategies: ConflictResolutionStrategy[] = [
    new TimestampStrategy(),
    new ContentDiffStrategy(),
    new HierarchyStrategy(),
    new SemanticAnalysisStrategy(),
    new UserPreferenceStrategy(),
    new FallbackStrategy()
  ];
  
  async resolveConflict(conflict: ConflictInfo): Promise<ConflictResolution> {
    // 第一轮：高置信度策略 (阈值: 0.7)
    for (const strategy of this.strategies.slice(0, 3)) {
      const result = await strategy.analyze(conflict);
      if (result.confidence >= 0.7) {
        return result;
      }
    }
    
    // 第二轮：中等置信度策略 (阈值: 0.5)
    for (const strategy of this.strategies.slice(0, 5)) {
      const result = await strategy.analyze(conflict);
      if (result.confidence >= 0.5) {
        return result;
      }
    }
    
    // 第三轮：时间戳降级策略
    const timestampResult = await this.timestampFallback(conflict);
    if (timestampResult.confidence >= 0.4) {
      return timestampResult;
    }
    
    // 最后：手动解决
    return {
      resolution: 'manual',
      confidence: 0,
      reasoning: '所有自动策略置信度不足，需要用户手动选择',
      requiresUserConfirmation: true,
      estimatedTime: 30
    };
  }
  
  private async timestampFallback(conflict: ConflictInfo): Promise<ConflictResolution> {
    const localTime = new Date(conflict.localData.updated_at || conflict.localData.created_at);
    const cloudTime = new Date(conflict.cloudData.updated_at || conflict.cloudData.created_at);
    
    const resolution = cloudTime > localTime ? 'cloud_wins' : 'local_wins';
    const confidence = 0.6; // 降级策略的置信度
    
    return {
      resolution,
      confidence,
      reasoning: `基于时间戳的降级解决策略 (${resolution})`,
      requiresUserConfirmation: false,
      estimatedTime: 2
    };
  }
}
```

### 3. 数据持久化机制强化

**问题定位**:
- 文件: `unified-sync-service-base.ts:2332-2368`
- 根因: 状态恢复时缺少数据清理和验证

**技术解决方案**:
```typescript
// 增强的数据持久化管理
class EnhancedPersistenceManager {
  private readonly CONFLICT_TTL = 24 * 60 * 60 * 1000; // 24小时
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1小时
  
  async restoreSyncState(): Promise<SyncState> {
    try {
      // 恢复操作历史
      const history = await this.loadOperationHistory();
      
      // 恢复冲突状态（带清理）
      const conflicts = await this.loadAndCleanConflicts();
      
      // 验证状态一致性
      const isValid = await this.validateStateConsistency(history, conflicts);
      
      if (!isValid) {
        console.warn('State consistency validation failed, performing cleanup');
        await this.cleanupCorruptedState();
      }
      
      return {
        history,
        conflicts,
        lastSync: await this.loadLastSyncTime(),
        isValid
      };
    } catch (error) {
      console.error('Failed to restore sync state:', error);
      await this.emergencyCleanup();
      throw error;
    }
  }
  
  private async loadAndCleanConflicts(): Promise<EnhancedSyncConflict[]> {
    const stored = localStorage.getItem('unified_sync_conflicts');
    if (!stored) return [];
    
    try {
      const allConflicts = JSON.parse(stored);
      
      // 过滤和清理
      const validConflicts = allConflicts
        .map((conflict: any) => ({
          ...conflict,
          timestamp: new Date(conflict.timestamp)
        }))
        .filter((conflict: EnhancedSyncConflict) => {
          // 移除过期冲突
          const isExpired = Date.now() - conflict.timestamp.getTime() > this.CONFLICT_TTL;
          
          // 移除已解决冲突
          const isResolved = conflict.status === 'resolved';
          
          // 移除损坏数据
          const isValid = this.validateConflictStructure(conflict);
          
          return !isExpired && !isResolved && isValid;
        });
      
      // 保存清理后的状态
      if (validConflicts.length !== allConflicts.length) {
        await this.saveConflictState(validConflicts);
      }
      
      return validConflicts;
    } catch (error) {
      console.error('Failed to load conflicts:', error);
      return [];
    }
  }
  
  private async validateStateConsistency(
    history: OperationHistory[], 
    conflicts: EnhancedSyncConflict[]
  ): Promise<boolean> {
    // 验证操作历史完整性
    const historyValid = history.every(op => 
      op.id && op.timestamp && op.type && op.entity
    );
    
    // 验证冲突状态完整性
    const conflictsValid = conflicts.every(conflict =>
      conflict.id && 
      conflict.timestamp && 
      ['pending', 'resolving', 'resolved', 'failed', 'manual'].includes(conflict.status)
    );
    
    return historyValid && conflictsValid;
  }
}
```

### 4. UI层集成完善

**问题定位**:
- 文件: `use-conflicts.ts:15-130`
- 根因: 使用模拟数据而非真实服务数据

**技术解决方案**:
```typescript
// 真实的UI集成实现
export function useConflicts() {
  const [conflicts, setConflicts] = useState<EnhancedSyncConflict[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  
  // 使用真实的同步服务
  const { syncService } = useSyncService();
  
  // 实时监听冲突变化
  useEffect(() => {
    const unsubscribe = syncService.onConflict((conflict: EnhancedSyncConflict) => {
      setConflicts(prev => {
        const existing = prev.find(c => c.id === conflict.id);
        if (existing) {
          return prev.map(c => c.id === conflict.id ? conflict : c);
        } else {
          return [...prev, conflict];
        }
      });
    });
    
    // 加载现有冲突
    syncService.getConflicts().then(setConflicts);
    
    return unsubscribe;
  }, [syncService]);
  
  // 真实的冲突解决逻辑
  const resolveConflict = useCallback(async (
    conflictId: string, 
    resolution: ConflictResolution
  ): Promise<boolean> => {
    setIsResolving(true);
    
    try {
      // 调用真实的同步服务
      const success = await syncService.resolveConflict(conflictId, resolution);
      
      if (success) {
        // 更新UI状态
        setConflicts(prev => prev.map(conflict => 
          conflict.id === conflictId 
            ? { 
                ...conflict, 
                status: 'resolved' as const,
                resolvedAt: new Date(),
                resolution: resolution.type
              }
            : conflict
        ));
        
        setSelectedConflict(null);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      return false;
    } finally {
      setIsResolving(false);
    }
  }, [syncService]);
  
  return {
    conflicts: conflicts.filter(c => c.status !== 'resolved'),
    selectedConflict,
    setSelectedConflict,
    isResolving,
    resolveConflict,
    getConflictById: (id: string) => conflicts.find(c => c.id === id),
    hasConflicts: conflicts.some(c => c.status !== 'resolved')
  };
}
```

## 系统架构设计

### 核心组件架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    UI Layer                                    │
├─────────────────────────────────────────────────────────────────┤
│  Conflict Resolution UI  │  Sync Status Display  │  Settings  │
└─────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────┐
│                 Service Layer                                   │
├─────────────────────────────────────────────────────────────────┤
│  Unified Sync Service  │  Conflict Manager  │  Security Service │
└─────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────┐
│                Data Layer                                       │
├─────────────────────────────────────────────────────────────────┤
│      IndexedDB (Local)     │        Supabase (Cloud)           │
└─────────────────────────────────────────────────────────────────┘
```

### 智能体分工架构

#### 1. Sync-System-Expert (主导)
- **职责**: 冲突状态管理、同步策略优化
- **关键组件**: ConflictStateManager, OptimizedConflictResolver
- **交付物**: 完整的冲突解决机制

#### 2. Debug-Specialist (核心支持)
- **职责**: 问题诊断、日志分析、性能监控
- **关键组件**: ConflictDiagnostics, PerformanceMonitor
- **交付物**: 诊断工具和监控体系

#### 3. Database-Architect (关键支持)
- **职责**: 数据持久化、状态管理、数据一致性
- **关键组件**: EnhancedPersistenceManager, StateValidator
- **交付物**: 健壮的数据存储机制

#### 4. UI-UX-Expert (界面支持)
- **职责**: 用户界面集成、交互体验优化
- **关键组件**: ConflictResolutionUI, SyncStatusDisplay
- **交付物**: 用户友好的操作界面

### 技术实现路径

#### Phase 1: 冲突状态管理修复 (Week 1)
1. 重构ConflictStateManager类
2. 实现完整的冲突生命周期管理
3. 集成状态持久化和恢复机制
4. 创建冲突诊断工具

#### Phase 2: 智能解决策略优化 (Week 1-2)
1. 优化OptimizedConflictResolver算法
2. 实现多级置信度策略
3. 添加时间戳降级机制
4. 集成性能监控

#### Phase 3: 数据持久化强化 (Week 2)
1. 实现EnhancedPersistenceManager
2. 添加状态清理和验证机制
3. 实现数据一致性检查
4. 创建备份和恢复机制

#### Phase 4: UI层集成完善 (Week 2-3)
1. 重构useConflicts hook
2. 实现真实的同步服务集成
3. 优化冲突解决界面
4. 添加用户反馈机制

### 质量保证措施

#### 测试策略
- **单元测试**: 覆盖所有核心组件和算法
- **集成测试**: 验证组件间协作
- **端到端测试**: 完整用户场景验证
- **性能测试**: 同步性能和内存使用测试

#### 监控指标
- **冲突解决成功率**: > 95%
- **自动解决率**: > 90%
- **数据一致性**: 100%
- **响应时间**: < 1秒

#### 回滚策略
- 每个阶段都有完整的备份
- 渐进式部署，可快速回滚
- 实时监控，异常自动回滚

### 风险控制

#### 技术风险
- **数据丢失风险**: 实施前完整备份
- **性能退化风险**: 基准测试和性能监控
- **兼容性风险**: 充分的回归测试

#### 缓解措施
- 分阶段实施，每个阶段独立验证
- 完整的测试覆盖
- 实时监控和报警机制

## 总结

本设计方案提供了完整的技术解决方案，通过系统性的架构优化和代码重构，能够彻底解决当前卡片冲突和数据持久化问题。方案采用渐进式实施策略，确保项目的稳定性和可维护性。