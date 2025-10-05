# Tasks: 认证服务修复与架构简化

**Input**: 深度分析报告和智能体协同计划
**Prerequisites**: plan.md, 同步系统分析报告
**Scope**: 修复认证服务注入失败，简化架构，删除冗余文件，恢复云端同步功能

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: tech stack (React + TypeScript + Supabase + Dexie)
   → Extract: project structure (web application with cardall-prototype)
2. Load sync system analysis from previous investigation
   → Extract critical issues (P0, P1 priority problems)
   → Extract file deletion candidates
3. Generate tasks by priority and dependency:
   → Emergency fixes (P0 issues)
   → Architecture simplification
   → System optimization
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Critical fixes before architecture changes
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph based on analysis
7. Create parallel execution examples for smart agents
8. Validate task completeness:
   → All critical sync issues addressed
   → All deletion candidates categorized
   → Architecture simplification complete
9. Return: SUCCESS (tasks ready for smart agent execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **智能体分配**: 每个任务分配给合适的专业智能体

## 智能体分配说明
- **认证服务专家**: 处理认证相关问题和用户ID获取
- **架构简化师**: 负责文件删除和架构重构
- **网络同步优化师**: 处理网络条件和同步队列
- **数据一致性专家**: 处理冲突解决和数据完整性

## Phase 1: 紧急修复 (第1-2天) - 可完全并行执行

### 认证服务修复组
- [ ] T001 [P] 修复 unified-sync-service.ts:58 行的 authService 注入问题
  - **智能体**: 认证服务专家
  - **文件**: cardall-prototype/src/services/unified-sync-service.ts
  - **操作**: 确保authService正确初始化和注入

- [ ] T002 [P] 稳定 database.ts:202-226 行的用户ID获取机制
  - **智能体**: 认证服务专家
  - **文件**: cardall-prototype/src/services/database.ts
  - **操作**: 修复认证状态检查，确保用户ID稳定获取

- [ ] T003 [P] 优化Supabase认证服务集成配置
  - **智能体**: 认证服务专家
  - **文件**: cardall-prototype/src/services/auth.ts
  - **操作**: 确保认证服务正确配置，支持同步操作

### 网络同步优化组
- [ ] T004 [P] 调整 network-manager.ts 中的质量阈值设置
  - **智能体**: 网络同步优化师
  - **文件**: cardall-prototype/src/services/network-manager.ts
  - **操作**: 放宽网络质量要求，提高同步机会

- [ ] T005 [P] 简化网络同步条件检查逻辑
  - **智能体**: 网络同步优化师
  - **文件**: cardall-prototype/src/services/network-manager.ts
  - **操作**: 简化canSync逻辑，减少过度严格的检查

- [ ] T006 [P] 优化同步队列的处理机制
  - **智能体**: 网络同步优化师
  - **文件**: cardall-prototype/src/services/sync-queue-manager.ts
  - **操作**: 改进队列处理逻辑，优化批处理大小

### 数据一致性基础组
- [ ] T007 [P] 修复 conflict-resolver.ts 中的策略选择机制
  - **智能体**: 数据一致性专家
  - **文件**: cardall-prototype/src/services/conflict-resolver.ts
  - **操作**: 优化冲突解决策略选择，提高自动解决成功率

- [ ] T008 [P] 增强本地数据库与云端数据的一致性
  - **智能体**: 数据一致性专家
  - **文件**: cardall-prototype/src/services/database-sync-adapter.ts
  - **操作**: 改进数据同步适配器，确保数据一致性

## Phase 2: 架构简化 (第3-5天) - 智能体2主导，其他辅助

### 文件分析和删除准备
- [ ] T009 识别冗余同步服务文件并分类风险级别
  - **智能体**: 架构简化师
  - **输出**: 冗余文件清单（低/中/高风险分类）
  - **操作**: 分析100+个同步相关文件，制定删除策略

- [ ] T010 分析服务间依赖关系，确保安全删除
  - **智能体**: 架构简化师
  - **文件**: cardall-prototype/src/services/ 下的所有同步服务
  - **操作**: 绘制依赖图，识别可安全删除的文件

### 架构重构执行
- [ ] T011 合并多个"统一"同步服务
  - **智能体**: 架构简化师
  - **文件**:
    - cardall-prototype/src/services/unified-sync-service.ts
    - cardall-prototype/src/services/optimized-cloud-sync.ts
    - cardall-prototype/src/services/sync-service.ts
  - **操作**: 将多个统一服务合并为一个核心服务

- [ ] T012 删除低风险冗余文件
  - **智能体**: 架构简化师
  - **目标**: 根据T009的分析结果删除低风险文件
  - **预期删除**: 20-30个冗余文件

- [ ] T013 适配认证服务以配合简化架构
  - **智能体**: 认证服务专家
  - **文件**: 统一同步服务相关文件
  - **操作**: 确保认证服务在简化架构中正常工作

- [ ] T014 调整网络管理器以适应简化架构
  - **智能体**: 网络同步优化师
  - **文件**: cardall-prototype/src/services/network-manager.ts
  - **操作**: 网络管理器适配新架构，保持功能完整

- [ ] T015 更新冲突解决器以配合新架构
  - **智能体**: 数据一致性专家
  - **文件**: cardall-prototype/src/services/conflict-resolver.ts
  - **操作**: 冲突解决器适配简化架构

### 中等风险文件清理
- [ ] T016 谨慎删除中等风险文件并验证功能
  - **智能体**: 架构简化师
  - **目标**: 删除中等风险文件，确保功能不受影响
  - **预期删除**: 10-15个中等风险文件

## Phase 3: 系统优化 (第6-8天) - 协同工作

### 系统集成和优化
- [ ] T017 完善错误处理和重试机制
  - **智能体**: 网络同步优化师
  - **文件**: 所有同步服务文件
  - **操作**: 统一错误处理，改进重试策略

- [ ] T018 优化性能和缓存策略
  - **智能体**: 数据一致性专家
  - **文件**: 数据库服务和缓存相关文件
  - **操作**: 优化数据访问性能，改进缓存策略

- [ ] T019 增强监控和诊断能力
  - **智能体**: 架构简化师
  - **文件**: 日志和监控相关文件
  - **操作**: 添加同步状态监控，改进诊断工具

- [ ] T020 端到端同步功能验证
  - **智能体**: 所有智能体协同
  - **操作**: 验证云端同步功能完全恢复

### 文档和清理
- [ ] T021 更新项目文档以反映架构变化
  - **智能体**: 架构简化师
  - **文件**: README.md, 技术文档
  - **操作**: 更新架构说明，同步服务文档

- [ ] T022 最终清理和代码优化
  - **智能体**: 所有智能体协同
  - **操作**: 代码格式化，注释完善，最终优化

## Dependencies
- Phase 1 任务 (T001-T008) 可完全并行执行
- Phase 2 中的 T009 必须在 T011-T016 之前完成
- T011 必须在 T013-T015 之前完成
- Phase 3 中的所有任务可在 Phase 2 完成后并行执行

## Parallel Execution Examples

### Phase 1 并行执行示例 (智能体同时开始工作)
```
# 认证服务专家执行:
Task: "修复 unified-sync-service.ts:58 行的 authService 注入问题"
Task: "稳定 database.ts:202-226 行的用户ID获取机制"
Task: "优化Supabase认证服务集成配置"

# 网络同步优化师同时执行:
Task: "调整 network-manager.ts 中的质量阈值设置"
Task: "简化网络同步条件检查逻辑"
Task: "优化同步队列的处理机制"

# 数据一致性专家同时执行:
Task: "修复 conflict-resolver.ts 中的策略选择机制"
Task: "增强本地数据库与云端数据的一致性"
```

### Phase 2 架构简化执行流程
```
# 架构简化师主导:
T009: 识别冗余同步服务文件并分类风险级别
T010: 分析服务间依赖关系
T011: 合并多个统一同步服务
T012: 删除低风险冗余文件
T016: 谨慎删除中等风险文件

# 其他智能体配合:
T013: 适配认证服务以配合简化架构 (在T011后)
T014: 调整网络管理器以适应简化架构 (在T011后)
T015: 更新冲突解决器以配合新架构 (在T011后)
```

## Success Criteria
- 认证服务初始化成功率: 100%
- 云端同步操作成功率: >95%
- 代码文件数量减少: 30-40%
- 构建时间改善: 15-20%
- 用户报告的同步问题: 减少95%

## Notes
- [P] tasks = 不同智能体，可并行执行
- 每个智能体专注特定领域，避免互相干扰
- 阶段1任务完全并行，最大化效率
- 严格按依赖顺序执行，确保系统稳定
- 每个任务后进行功能验证，确保修复有效

## Task Generation Rules
*Applied during main() execution*

1. **From Critical Issues**:
   - P0 issues → Phase 1 emergency tasks [P]
   - P1 issues → Phase 1 optimization tasks [P]

2. **From Architecture Analysis**:
   - Redundant files → deletion tasks
   - Service consolidation → refactoring tasks

3. **From Smart Agent Capabilities**:
   - Each specialist → domain-specific tasks
   - Parallel execution → maximum efficiency

4. **Ordering**:
   - Emergency fixes before architecture changes
   - Analysis before deletion
   - Core changes before optimization
   - Integration before validation

## Validation Checklist
*GATE: Checked by main() before returning*

- [ ] All critical sync issues addressed in tasks
- [ ] File deletion candidates categorized by risk
- [ ] Smart agent assignments clearly defined
- [ ] Parallel tasks truly independent (different agents/files)
- [ ] Each task specifies exact file path and expected outcome
- [ ] Dependencies clearly defined and logical
- [ ] Success criteria measurable and achievable