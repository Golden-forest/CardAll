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
- 每个任务都分配了特定的智能体和MCP工具

## Path Conventions
- **Project structure**: `cardall-prototype/` at repository root
- **Source code**: `cardall-prototype/src/`
- **Tests**: `cardall-prototype/tests/`
- **Configuration**: `cardall-prototype/` root level

## 智能体分配说明

### 可用智能体类型
1. **project-manager** (项目管理) - 负责整体协调、版本控制、文档管理
2. **code-optimization-expert** (代码优化专家) - 负责代码清理、重构、性能优化
3. **test-engineer** (测试工程师) - 负责功能测试、性能测试、质量验证
4. **debug-specialist** (调试专家) - 负责问题诊断、错误修复、状态验证
5. **ui-ux-expert** (UI/UX专家) - 负责界面验证、用户体验优化

### MCP工具分配说明

#### 文件系统工具 (mcp__filesystem__)
- `read_text_file` - 读取文件内容
- `write_file` - 创建或写入文件
- `edit_file` - 编辑现有文件
- `search_files` - 搜索文件
- `directory_tree` - 查看目录结构
- `list_directory` - 列出目录内容
- `read_multiple_files` - 批量读取文件

#### Git和GitHub工具
- `Bash (git命令)` - Git版本控制操作
- `mcp__github__create_branch` - 创建GitHub分支
- `mcp__github__push_files` - 推送文件到GitHub
- `mcp__github__create_issue` - 创建GitHub Issue

#### Supabase工具 (mcp__supabase__)
- `list_projects` - 列出Supabase项目
- `list_tables` - 列出数据表
- `execute_sql` - 执行SQL操作
- `get_project` - 获取项目信息
- `search_docs` - 搜索Supabase文档

#### 浏览器自动化工具 (mcp__playwright__)
- `browser_navigate` - 页面导航
- `browser_click` - 点击操作
- `browser_type` - 文本输入
- `browser_fill_form` - 表单填写
- `browser_file_upload` - 文件上传
- `browser_snapshot` - 页面截图

#### 性能分析工具 (mcp__chrome-devtools__)
- `performance_start_trace` - 启动性能追踪
- `performance_stop_trace` - 停止性能追踪
- `take_screenshot` - 截图
- `evaluate_script` - 执行JavaScript

#### 通用工具
- `Bash` - 命令行操作
- `Grep` - 文本搜索
- `Glob` - 文件模式匹配
- `WebSearch` - 网络搜索
- `Read` - 读取文件
- `Edit` - 编辑文件
- `Write` - 写入文件

## Phase 3.1: Setup - 数据备份和环境准备
- [ ] T001 创建完整数据备份 - 导出所有现有数据到JSON文件
  - **智能体**: test-engineer (测试工程师) - 负责数据备份策略和验证
  - **MCP工具**: mcp__filesystem__write_file - 备份数据到本地文件
  - **MCP工具**: mcp__supabase__list_projects - 验证Supabase项目状态
- [ ] T002 [P] 备份当前代码分支 - 创建git分支备份当前状态
  - **智能体**: project-manager (项目管理) - 负责版本控制和分支管理
  - **MCP工具**: Bash (git命令) - 创建和管理git分支
- [ ] T003 [P] 检查当前项目状态 - 验证所有功能正常工作
  - **智能体**: debug-specialist (调试专家) - 负责项目状态检查和问题诊断
  - **MCP工具**: Bash (npm run dev) - 启动开发服务器
  - **MCP工具**: mcp__playwright__browser_snapshot - 验证UI界面正常

## Phase 3.2: 依赖清理 ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: 这些依赖清理任务必须在代码清理之前完成**
- [ ] T004 [P] 移除Supabase相关依赖 - 清理package.json中的@supabase包
  - **智能体**: code-optimization-expert (代码优化专家) - 负责依赖分析和清理
  - **MCP工具**: mcp__filesystem__read_text_file - 读取package.json
  - **MCP工具**: mcp__filesystem__edit_file - 编辑package.json
  - **MCP工具**: Bash (npm uninstall) - 卸载依赖包
- [ ] T005 [P] 移除云端同步依赖 - 清理package.json中的sync相关包
  - **智能体**: code-optimization-expert (代码优化专家) - 负责依赖分析和清理
  - **MCP工具**: mcp__filesystem__edit_file - 编辑package.json
  - **MCP工具**: Bash (npm ls) - 验证依赖状态
- [ ] T006 [P] 更新环境变量配置 - 清理.env中的Supabase配置
  - **智能体**: code-optimization-expert (代码优化专家) - 负责配置清理
  - **MCP工具**: mcp__filesystem__read_text_file - 读取.env文件
  - **MCP工具**: mcp__filesystem__edit_file - 编辑.env文件
- [ ] T007 [P] 验证依赖清理成功 - 确保npm install无错误
  - **智能体**: debug-specialist (调试专家) - 负责构建验证和错误诊断
  - **MCP工具**: Bash (npm install) - 重新安装依赖
  - **MCP工具**: Bash (npm run build) - 验证构建无错误

## Phase 3.3: 云端代码清理 (ONLY after dependencies are cleaned)
- [ ] T008 [P] 删除同步组件 - 删除src/components/sync/目录
  - **智能体**: code-optimization-expert (代码优化专家) - 负责组件清理
  - **MCP工具**: mcp__filesystem__search_files - 查找sync相关文件
  - **MCP工具**: Bash (rm -rf) - 删除目录和文件
- [ ] T009 [P] 删除认证组件 - 删除src/components/auth/目录
  - **智能体**: code-optimization-expert (代码优化专家) - 负责组件清理
  - **MCP工具**: mcp__filesystem__directory_tree - 查看目录结构
  - **MCP工具**: Bash (rm -rf) - 删除认证相关文件
- [ ] T010 [P] 删除监控组件 - 删除src/components/monitor/目录
  - **智能体**: code-optimization-expert (代码优化专家) - 负责组件清理
  - **MCP工具**: mcp__filesystem__search_files - 查找monitor相关文件
- [ ] T011 [P] 删除云端服务 - 删除src/services/supabase.ts和相关服务
  - **智能体**: code-optimization-expert (代码优化专家) - 负责服务层清理
  - **MCP工具**: mcp__filesystem__search_files - 查找云端服务文件
  - **MCP工具**: Grep - 搜索代码引用
- [ ] T012 [P] 删除同步上下文 - 删除src/contexts/sync-context.tsx
  - **智能体**: code-optimization-expert (代码优化专家) - 负责Context清理
  - **MCP工具**: mcp__filesystem__read_text_file - 检查文件内容
- [ ] T013 [P] 删除认证上下文 - 删除src/contexts/auth-context.tsx
  - **智能体**: code-optimization-expert (代码优化专家) - 负责Context清理
  - **MCP工具**: mcp__filesystem__read_text_file - 检查文件内容
- [ ] T014 清理主应用组件 - 移除App.tsx中的云端相关代码
  - **智能体**: code-optimization-expert (代码优化专家) - 负责核心组件重构
  - **MCP工具**: mcp__filesystem__read_text_file - 读取App.tsx
  - **MCP工具**: mcp__filesystem__edit_file - 编辑App.tsx
- [ ] T015 清理卡片上下文 - 简化cardall-context.tsx，移除同步逻辑
  - **智能体**: code-optimization-expert (代码优化专家) - 负责状态管理重构
  - **MCP工具**: mcp__filesystem__read_text_file - 读取cardall-context.tsx
  - **MCP工具**: mcp__filesystem__edit_file - 编辑上下文代码
- [ ] T016 [P] 清理云端相关hooks - 删除src/hooks/中的同步相关hooks
  - **智能体**: code-optimization-expert (代码优化专家) - 负责Hooks清理
  - **MCP工具**: mcp__filesystem__search_files - 查找hooks文件
- [ ] T017 [P] 简化类型定义 - 移除types/中的云端相关类型
  - **智能体**: code-optimization-expert (代码优化专家) - 负责TypeScript类型清理
  - **MCP工具**: mcp__filesystem__read_multiple_files - 批量读取类型文件
  - **MCP工具**: mcp__filesystem__edit_file - 编辑类型定义

## Phase 3.4: 数据模型调整
- [ ] T018 [P] 清理Card实体 - 移除Card接口中的云端字段
  - **智能体**: code-optimization-expert (代码优化专家) - 负责数据模型重构
  - **MCP工具**: mcp__filesystem__read_text_file - 读取types/card.ts
  - **MCP工具**: mcp__filesystem__edit_file - 编辑Card接口定义
- [ ] T019 [P] 清理Image实体 - 移除Image接口中的云端字段
  - **智能体**: code-optimization-expert (代码优化专家) - 负责数据模型重构
  - **MCP工具**: mcp__filesystem__read_text_file - 读取图片相关类型
  - **MCP工具**: mcp__filesystem__edit_file - 编辑Image接口
- [ ] T020 调整数据库服务 - 修改src/services/database.ts，移除云端逻辑
  - **智能体**: code-optimization-expert (代码优化专家) - 负责数据库服务重构
  - **MCP工具**: mcp__filesystem__read_text_file - 读取database.ts
  - **MCP工具**: mcp__filesystem__edit_file - 重构数据库服务逻辑
- [ ] T021 [P] 清理测试文件 - 移除云端相关测试用例
  - **智能体**: test-engineer (测试工程师) - 负责测试用例清理
  - **MCP工具**: Grep - 搜索云端相关测试
  - **MCP工具**: Bash (rm) - 删除无用测试文件

## Phase 3.5: 本地功能增强
- [ ] T022 添加本地备份功能 - 实现自动备份到IndexedDB
  - **智能体**: code-optimization-expert (代码优化专家) - 负责备份功能实现
  - **MCP工具**: mcp__filesystem__write_file - 创建备份服务文件
  - **MCP工具**: mcp__filesystem__read_text_file - 读取现有数据库服务
- [ ] T023 添加数据导出功能 - 实现导出为JSON文件
  - **智能体**: code-optimization-expert (代码优化专家) - 负责导出功能实现
  - **MCP工具**: mcp__filesystem__write_file - 创建导出服务
  - **MCP工具**: mcp__filesystem__read_text_file - 查看现有导出逻辑
- [ ] T024 添加数据导入功能 - 实现从JSON文件导入
  - **智能体**: code-optimization-expert (代码优化专家) - 负责导入功能实现
  - **MCP工具**: mcp__filesystem__write_file - 创建导入服务
  - **MCP工具**: mcp__filesystem__read_text_file - 查看现有导入逻辑
- [ ] T025 添加数据完整性检查 - 实现本地数据验证
  - **智能体**: debug-specialist (调试专家) - 负责数据完整性验证
  - **MCP工具**: mcp__filesystem__write_file - 创建验证服务
  - **MCP工具**: mcp__filesystem__read_text_file - 查看现有验证逻辑

## Phase 3.6: 验证和测试
- [ ] T026 [P] 卡片管理功能测试 - 验证卡片CRUD操作正常
  - **智能体**: test-engineer (测试工程师) - 负责核心功能测试
  - **MCP工具**: mcp__playwright__browser_navigate - 导航到应用
  - **MCP工具**: mcp__playwright__browser_click - 测试卡片操作
- [ ] T027 [P] 文件夹管理功能测试 - 验证文件夹操作正常
  - **智能体**: test-engineer (测试工程师) - 负责文件夹功能测试
  - **MCP工具**: mcp__playwright__browser_snapshot - 验证文件夹界面
  - **MCP工具**: mcp__playwright__browser_fill_form - 测试文件夹创建
- [ ] T028 [P] 标签系统功能测试 - 验证标签管理正常
  - **智能体**: test-engineer (测试工程师) - 负责标签功能测试
  - **MCP工具**: mcp__playwright__browser_click - 测试标签操作
- [ ] T029 [P] 图片上传功能测试 - 验证图片处理正常
  - **智能体**: test-engineer (测试工程师) - 负责图片功能测试
  - **MCP工具**: mcp__playwright__browser_file_upload - 测试图片上传
- [ ] T030 [P] 搜索功能测试 - 验证搜索和过滤正常
  - **智能体**: test-engineer (测试工程师) - 负责搜索功能测试
  - **MCP工具**: mcp__playwright__browser_type - 测试搜索输入
- [ ] T031 本地存储性能测试 - 验证IndexedDB性能
  - **智能体**: test-engineer (测试工程师) - 负责性能测试
  - **MCP工具**: mcp__chrome-devtools__performance_start_trace - 启动性能监控
- [ ] T032 数据导入导出测试 - 验证备份恢复功能
  - **智能体**: test-engineer (测试工程师) - 负责数据管理测试
  - **MCP工具**: mcp__playwright__browser_file_upload - 测试文件导入

## Phase 3.7: Supabase配置清理
- [ ] T033 使用supabase-mcp清理数据库表 - 清理云端数据表
  - **智能体**: project-manager (项目管理) - 负责云端资源清理
  - **MCP工具**: mcp__supabase__list_tables - 列出所有数据表
  - **MCP工具**: mcp__supabase__execute_sql - 执行删除表操作
- [ ] T034 使用supabase-mcp清理存储桶 - 清理云端存储
  - **智能体**: project-manager (项目管理) - 负责存储资源清理
  - **MCP工具**: mcp__supabase__list_projects - 查看项目存储
  - **MCP工具**: WebSearch - 查找Supabase存储清理API
- [ ] T035 使用supabase-mcp清理API密钥 - 撤销访问凭据
  - **智能体**: project-manager (项目管理) - 负责安全清理
  - **MCP工具**: mcp__supabase__get_project - 获取项目配置
  - **MCP工具**: mcp__supabase__search_docs - 查找API密钥管理文档

## Phase 3.8: 发布准备
- [ ] T036 更新项目文档 - 修改README.md，更新功能说明
  - **智能体**: project-manager (项目管理) - 负责文档更新
  - **MCP工具**: mcp__filesystem__read_text_file - 读取README.md
  - **MCP工具**: mcp__filesystem__edit_file - 更新文档内容
- [ ] T037 更新版本信息 - 设置新版本号v1.0.0-local
  - **智能体**: project-manager (项目管理) - 负责版本管理
  - **MCP工具**: mcp__filesystem__read_text_file - 读取package.json版本
  - **MCP工具**: mcp__filesystem__edit_file - 更新版本号
- [ ] T038 [P] 运行完整测试套件 - 确保所有测试通过
  - **智能体**: test-engineer (测试工程师) - 负责测试执行
  - **MCP工具**: Bash (npm run test) - 运行单元测试
  - **MCP工具**: Bash (npm run test:e2e) - 运行端到端测试
- [ ] T039 [P] 性能基准测试 - 对比清理前后性能
  - **智能体**: test-engineer (测试工程师) - 负责性能测试
  - **MCP工具**: mcp__chrome-devtools__performance_start_trace - 启动性能分析
  - **MCP工具**: mcp__chrome-devtools__performance_stop_trace - 停止分析并获取结果
- [ ] T040 生成变更日志 - 记录所有清理变更
  - **智能体**: project-manager (项目管理) - 负责变更记录
  - **MCP工具**: mcp__filesystem__write_file - 创建CHANGELOG.md
  - **MCP工具**: Bash (git log) - 获取提交历史

## Phase 3.9: GitHub上传
- [ ] T041 [P] 提交所有变更到git - 创建本地提交
  - **智能体**: project-manager (项目管理) - 负责Git提交管理
  - **MCP工具**: Bash (git add .) - 添加所有变更
  - **MCP工具**: Bash (git commit) - 创建提交
- [ ] T042 使用github-mcp创建发布分支 - 准备发布版本
  - **智能体**: project-manager (项目管理) - 负责分支管理
  - **MCP工具**: mcp__github__create_branch - 创建发布分支
  - **MCP工具**: Bash (git checkout) - 切换到发布分支
- [ ] T043 使用github-mcp上传到GitHub - 推送到远程仓库
  - **智能体**: project-manager (项目管理) - 负责代码上传
  - **MCP工具**: mcp__github__push_files - 推送文件到GitHub
  - **MCP工具**: Bash (git push) - 推送分支到远程
- [ ] T044 [P] 创建GitHub Release - 生成发布说明
  - **智能体**: project-manager (项目管理) - 负责版本发布
  - **MCP工具**: mcp__github__create_issue - 创建发布记录
  - **MCP工具**: mcp__filesystem__write_file - 生成发布说明文档

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
