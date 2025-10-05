# Implementation Plan: CardAll 降级重构 - 本地离线版本

**Branch**: `006-` | **Date**: 2025-01-19 | **Spec**: [link](spec.md)
**Input**: Feature specification from `/specs/006-/spec.md`

## 项目背景与目标

**降级原因**: 现有云端同步功能存在持续bug，无法稳定工作
**降级策略**: 移除所有云端同步功能，保留本地功能，建立稳定的基础版本
**未来规划**: 在本地版本稳定后，重新设计和实现云端同步功能

## 用户明确需求
- 网站功能已完整实现，不需要重新开发
- 仅需删除云端同步相关部分
- 清理Supabase配置
- 开发完成后进行功能测试
- 上传到GitHub仓库

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context with user's specific requirements
3. Fill the Constitution Check section
4. Evaluate Constitution Check section below
5. Execute Phase 0 → research.md
6. Execute Phase 1 → contracts, data-model.md, quickstart.md
7. Re-evaluate Constitution Check section
8. Update Progress Tracking: Post-Design Constitution Check
9. STOP - Ready for /tasks command
```

## Summary
从现有的功能完整的CardAll项目中移除所有云端同步功能，创建一个稳定的本地离线版本。重点在于代码清理和功能验证，而非新功能开发。

## Technical Context
**Language/Version**: TypeScript 5.0+, React 18 (现有项目)
**Primary Dependencies**: Vite 5, Dexie (IndexedDB), Radix UI, Tiptap (保留现有依赖)
**Storage**: IndexedDB (本地浏览器数据库，移除Supabase)
**Testing**: Vitest + Playwright + Jest (保留现有测试)
**Target Platform**: Web (WASM), PWA (保留现有平台)
**Project Type**: web (frontend application - 现有项目)
**Performance Goals**: 保持现有性能，移除云端延迟
**Constraints**: 完全离线运行，移除网络依赖，清理Supabase配置
**Scale/Scope**: 单用户本地应用，基于现有代码库

**用户明确输入**: 重新规划，我网站的功能已经都实现了，不需要重新写，现在只是需要将云端同步相关的部分删除，同时使用supabase-mcp将supabase中的相关配置也清楚干净，在开发完离线的版本后我要重新开发云端同步的功能。要弄清楚这次开发的目的，目的是因为我的云端同步功能始终没有办法实现，开发来开发去始终存在bug。所以我希望先降级实现，后面再添加云端同步的功能。开发完成后帮我测试一下各功能情况。最后通过github-mcp帮我上传到我的github中

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**核心原则**:
- 简化优先：移除有问题的复杂功能
- 稳定性优先：确保基础功能稳定可靠
- 保留现有功能：不重新开发，只清理和修复
- 测试驱动：确保移除后功能正常

## Project Structure

### Documentation (this feature)
```
specs/006-/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
cardall-prototype/ (现有项目结构)
├── src/
│   ├── components/          # 保留所有UI组件
│   │   ├── card/           # 卡片相关组件 (保留)
│   │   ├── folder/         # 文件夹管理 (保留)
│   │   ├── styles/         # 样式相关组件 (保留)
│   │   ├── screenshot/     # 截图功能 (保留)
│   │   ├── ui/             # UI基础组件 (保留)
│   │   ├── sync/           # 删除所有同步组件
│   │   ├── auth/           # 删除所有认证组件
│   │   └── monitor/        # 删除监控组件
│   ├── services/           # 大幅简化，移除云端服务
│   │   ├── database.ts     # 改为本地数据库服务
│   │   ├── image-processor.ts (保留)
│   │   └── [删除所有sync-, auth-, supabase-, cloud-相关服务]
│   ├── contexts/           # 移除云端相关context
│   │   ├── cardall-context.tsx (简化，移除同步)
│   │   ├── theme-context.tsx (保留)
│   │   ├── sync-context.tsx (删除)
│   │   └── auth-context.tsx (删除)
│   ├── hooks/              # 移除云端同步相关hooks
│   ├── types/              # 简化类型定义
│   └── utils/              # 保留本地工具函数
├── tests/                  # 保留测试，移除云端相关测试
├── public/                 # 静态资源 (保留)
└── package.json            # 清理依赖
```

**Structure Decision**: 基于现有项目结构，选择性删除云端相关文件和代码

## Phase 0: Outline & Research
1. **分析现有代码结构**:
   - 识别所有云端同步相关文件
   - 分析现有本地功能实现
   - 确定需要保留的核心功能

2. **研究清理策略**:
   - Supabase依赖清理方法
   - 本地存储替换方案
   - 代码重构最小化原则

3. **Consolidate findings** in `research.md`:
   - 云端代码清理清单
   - 本地功能保留清单
   - 风险评估和缓解策略

**Output**: research.md with cleanup strategy

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **本地化设计调整** → `data-model.md`:
   - 保留现有实体，移除同步字段
   - 调整数据关系，移除云端依赖
   - 确保本地数据完整性

2. **生成清理清单** from existing code:
   - 文件删除清单
   - 代码修改清单
   - 依赖清理清单

3. **生成测试验证计划**:
   - 功能回归测试清单
   - 本地存储验证测试
   - 性能对比测试

4. **制定Supabase清理计划**:
   - 配置文件清理
   - 环境变量清理
   - 数据库表清理（通过supabase-mcp）

5. **制定GitHub上传计划**:
   - 版本标记策略
   - 发布说明准备
   - 文档更新计划

**Output**: data-model.md, cleanup checklists, test plans

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- 基于现有代码库分析生成清理任务
- 每个云端相关文件/目录 → 清理任务 [P]
- 每个核心功能 → 验证测试任务
- 每个依赖清理 → 更新任务
- Supabase清理 → 专门任务
- GitHub上传 → 发布任务

**Ordering Strategy**:
- 先清理代码，再验证功能
- 先本地测试，再清理远程配置
- 先功能验证，再发布上传

**Estimated Output**: 20-25 focused cleanup and validation tasks

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute cleanup tasks)  
**Phase 5**: Validation (run tests, functionality verification)  
**Phase 6**: Supabase cleanup (using supabase-mcp)  
**Phase 7**: GitHub upload (using github-mcp)

## Complexity Tracking
| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 大规模代码清理 | 现有云端功能深度耦合且存在bug | 保留有问题的代码会持续影响用户体验和开发效率 |

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed
- [ ] Phase 6: Supabase cleanup complete
- [ ] Phase 7: GitHub upload complete

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
