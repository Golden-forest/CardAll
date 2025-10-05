# Tasks: CardAll 降级重构 - 本地离线版本

**Input**: Design documents from `/specs/006-/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✅ Extract: tech stack (TypeScript, React, Vite), libraries (Dexie, Radix UI), structure (cardall-prototype/)
2. Load optional design documents:
   → ✅ data-model.md: Extract entities (Card, Folder, Tag, Image, Settings) → model cleanup tasks
   → ✅ contracts/: local-storage-api.yaml → contract test task [P]
   → ✅ research.md: Extract cleanup decisions → setup tasks
3. Generate tasks by category:
   → Setup: 数据备份, 依赖清理, 环境准备
   → Tests: 功能回归测试, 本地存储验证测试
   → Core: 云端代码清理, 数据模型调整, 服务层重构
   → Integration: IndexedDB验证, 组件集成测试
   → Polish: 性能测试, 文档更新, GitHub上传
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → ✅ All contracts have tests
   → ✅ All entities have model cleanup tasks
   → ✅ All cleanup tasks identified
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Project structure**: `cardall-prototype/` at repository root
- **Source code**: `cardall-prototype/src/`
- **Tests**: `cardall-prototype/tests/`
- **Configuration**: `cardall-prototype/` root level

## Phase 3.1: Setup - 数据备份和环境准备
- [ ] T001 创建完整数据备份 - 导出所有现有数据到JSON文件
- [ ] T002 [P] 备份当前代码分支 - 创建git分支备份当前状态
- [ ] T003 [P] 检查当前项目状态 - 验证所有功能正常工作

## Phase 3.2: 依赖清理 ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: 这些依赖清理任务必须在代码清理之前完成**
- [ ] T004 [P] 移除Supabase相关依赖 - 清理package.json中的@supabase包
- [ ] T005 [P] 移除云端同步依赖 - 清理package.json中的sync相关包
- [ ] T006 [P] 更新环境变量配置 - 清理.env中的Supabase配置
- [ ] T007 [P] 验证依赖清理成功 - 确保npm install无错误

## Phase 3.3: 云端代码清理 (ONLY after dependencies are cleaned)
- [ ] T008 [P] 删除同步组件 - 删除src/components/sync/目录
- [ ] T009 [P] 删除认证组件 - 删除src/components/auth/目录
- [ ] T010 [P] 删除监控组件 - 删除src/components/monitor/目录
- [ ] T011 [P] 删除云端服务 - 删除src/services/supabase.ts和相关服务
- [ ] T012 [P] 删除同步上下文 - 删除src/contexts/sync-context.tsx
- [ ] T013 [P] 删除认证上下文 - 删除src/contexts/auth-context.tsx
- [ ] T014 清理主应用组件 - 移除App.tsx中的云端相关代码
- [ ] T015 清理卡片上下文 - 简化cardall-context.tsx，移除同步逻辑
- [ ] T016 [P] 清理云端相关hooks - 删除src/hooks/中的同步相关hooks
- [ ] T017 [P] 简化类型定义 - 移除types/中的云端相关类型

## Phase 3.4: 数据模型调整
- [ ] T018 [P] 清理Card实体 - 移除Card接口中的云端字段
- [ ] T019 [P] 清理Image实体 - 移除Image接口中的云端字段
- [ ] T020 调整数据库服务 - 修改src/services/database.ts，移除云端逻辑
- [ ] T021 [P] 清理测试文件 - 移除云端相关测试用例

## Phase 3.5: 本地功能增强
- [ ] T022 添加本地备份功能 - 实现自动备份到IndexedDB
- [ ] T023 添加数据导出功能 - 实现导出为JSON文件
- [ ] T024 添加数据导入功能 - 实现从JSON文件导入
- [ ] T025 添加数据完整性检查 - 实现本地数据验证

## Phase 3.6: 验证和测试
- [ ] T026 [P] 卡片管理功能测试 - 验证卡片CRUD操作正常
- [ ] T027 [P] 文件夹管理功能测试 - 验证文件夹操作正常
- [ ] T028 [P] 标签系统功能测试 - 验证标签管理正常
- [ ] T029 [P] 图片上传功能测试 - 验证图片处理正常
- [ ] T030 [P] 搜索功能测试 - 验证搜索和过滤正常
- [ ] T031 本地存储性能测试 - 验证IndexedDB性能
- [ ] T032 数据导入导出测试 - 验证备份恢复功能

## Phase 3.7: Supabase配置清理
- [ ] T033 使用supabase-mcp清理数据库表 - 清理云端数据表
- [ ] T034 使用supabase-mcp清理存储桶 - 清理云端存储
- [ ] T035 使用supabase-mcp清理API密钥 - 撤销访问凭据

## Phase 3.8: 发布准备
- [ ] T036 更新项目文档 - 修改README.md，更新功能说明
- [ ] T037 更新版本信息 - 设置新版本号v1.0.0-local
- [ ] T038 [P] 运行完整测试套件 - 确保所有测试通过
- [ ] T039 [P] 性能基准测试 - 对比清理前后性能
- [ ] T040 生成变更日志 - 记录所有清理变更

## Phase 3.9: GitHub上传
- [ ] T041 [P] 提交所有变更到git - 创建本地提交
- [ ] T042 使用github-mcp创建发布分支 - 准备发布版本
- [ ] T043 使用github-mcp上传到GitHub - 推送到远程仓库
- [ ] T044 [P] 创建GitHub Release - 生成发布说明

## Dependencies
- 依赖清理 (T004-T007) before 代码清理 (T008-T017)
- 代码清理 before 数据模型调整 (T018-T021)
- 功能增强 before 验证测试 (T026-T032)
- 本地验证 before Supabase清理 (T033-T035)
- 所有测试通过 before GitHub上传 (T041-T044)

## Parallel Example
```
# 第一组：可以并行运行的依赖清理任务
Task: "移除Supabase相关依赖 - 清理package.json中的@supabase包"
Task: "移除云端同步依赖 - 清理package.json中的sync相关包"
Task: "更新环境变量配置 - 清理.env中的Supabase配置"
Task: "验证依赖清理成功 - 确保npm install无错误"

# 第二组：可以并行运行的组件删除任务
Task: "删除同步组件 - 删除src/components/sync/目录"
Task: "删除认证组件 - 删除src/components/auth/目录"
Task: "删除监控组件 - 删除src/components/monitor/目录"
Task: "删除云端服务 - 删除src/services/supabase.ts和相关服务"

# 第三组：可以并行运行的功能测试任务
Task: "卡片管理功能测试 - 验证卡片CRUD操作正常"
Task: "文件夹管理功能测试 - 验证文件夹操作正常"
Task: "标签系统功能测试 - 验证标签管理正常"
Task: "图片上传功能测试 - 验证图片处理正常"
Task: "搜索功能测试 - 验证搜索和过滤正常"
```

## 特殊说明

### 清理原则
1. **保留核心功能**: 所有UI和本地功能保持不变
2. **最小化变更**: 只移除云端相关代码，不重写功能
3. **渐进式清理**: 分阶段清理，每阶段验证功能正常
4. **数据安全**: 每个重要步骤前都要备份数据

### 风险控制
1. **数据备份**: T001必须首先完成，确保数据安全
2. **分支备份**: T002创建代码备份点，支持快速回滚
3. **功能验证**: T003确保清理前功能正常，建立基准
4. **分阶段验证**: 每个阶段完成后都要测试核心功能

### 成功标准
1. **功能完整**: 所有本地功能正常工作
2. **性能稳定**: 应用启动和运行性能良好
3. **数据安全**: 本地数据完整，备份功能正常
4. **代码清洁**: 移除所有云端相关代码和依赖

## 验证清单
- [x] 所有清理任务已识别
- [x] 依赖关系已建立
- [x] 并行任务已标记
- [x] 风险控制措施已制定
- [x] 成功标准已定义

---
**任务状态**: 准备就绪，可以开始执行
**预计时间**: 3-5天
**风险等级**: 中等 (有完整备份和回滚策略)
