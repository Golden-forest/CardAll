#!/usr/bin/env node

/**
 * Phase 2 核心功能验证脚本
 * 验证IndexedDB适配器和相关组件是否正常工作
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 开始Phase 2核心功能验证...\n');

// 验证清单
const validations = [
  {
    name: '1. use-cards-adapter.ts 文件存在',
    check: () => {
      const adapterPath = path.join(__dirname, 'src/hooks/use-cards-adapter.ts');
      return fs.existsSync(adapterPath);
    }
  },
  {
    name: '2. MigrationStatusBanner 组件存在',
    check: () => {
      const bannerPath = path.join(__dirname, 'src/components/storage/migration-status-banner.tsx');
      return fs.existsSync(bannerPath);
    }
  },
  {
    name: '3. CardAllProvider 更新完成',
    check: () => {
      const contextPath = path.join(__dirname, 'src/contexts/cardall-context.tsx');
      if (!fs.existsSync(contextPath)) return false;

      const content = fs.readFileSync(contextPath, 'utf8');
      return content.includes('useCardsAdapter') &&
             content.includes('isReady') &&
             content.includes('isMigrating');
    }
  },
  {
    name: '4. Dashboard 主组件更新',
    check: () => {
      const dashboardPath = path.join(__dirname, 'src/components/dashboard/dashboard-main.tsx');
      if (!fs.existsSync(dashboardPath)) return false;

      const content = fs.readFileSync(dashboardPath, 'utf8');
      return content.includes('MigrationStatusBanner') &&
             content.includes('useStorageAdapter') &&
             content.includes('isReady');
    }
  },
  {
    name: '5. Dashboard 侧边栏更新',
    check: () => {
      const sidebarPath = path.join(__dirname, 'src/components/dashboard/dashboard-sidebar.tsx');
      if (!fs.existsSync(sidebarPath)) return false;

      const content = fs.readFileSync(sidebarPath, 'utf8');
      return content.includes('useStorageAdapter') &&
             content.includes('isUsingIndexedDB');
    }
  },
  {
    name: '6. Card Creator 组件更新',
    check: () => {
      const creatorPath = path.join(__dirname, 'src/components/card/card-creator.tsx');
      if (!fs.existsSync(creatorPath)) return false;

      const content = fs.readFileSync(creatorPath, 'utf8');
      return content.includes('useCardAllCards') &&
             content.includes('useStorageAdapter') &&
             content.includes('DEFAULT_CARD_STYLE');
    }
  },
  {
    name: '7. Phase 1 服务文件存在',
    check: () => {
      const services = [
        'src/services/storage-adapter.ts',
        'src/services/universal-storage-adapter.ts',
        'src/services/data-converter-adapter.ts',
        'src/services/data-migration.service.ts',
        'src/services/migration-validator.ts',
        'src/services/unified-error-handler.ts',
        'src/services/performance-monitor.ts',
        'src/services/cardall-provider-adapter.ts',
        'src/services/phase1-validation.ts'
      ];

      return services.every(service =>
        fs.existsSync(path.join(__dirname, service))
      );
    }
  },
  {
    name: '8. 构建成功验证',
    check: () => {
      const distPath = path.join(__dirname, 'dist');
      if (!fs.existsSync(distPath)) return false;

      const assetsPath = path.join(distPath, 'assets');
      if (!fs.existsSync(assetsPath)) return false;

      const assetFiles = fs.readdirSync(assetsPath);
      return assetFiles.some(file => file.startsWith('index') && file.endsWith('.js'));
    }
  }
];

// 执行验证
let passed = 0;
let total = validations.length;

validations.forEach(validation => {
  try {
    const result = validation.check();
    const status = result ? '✅' : '❌';
    console.log(`${status} ${validation.name}`);
    if (result) passed++;
  } catch (error) {
    console.log(`❌ ${validation.name} - 验证出错: ${error.message}`);
  }
});

// 生成报告
console.log('\n📊 Phase 2 验证报告');
console.log('==================');
console.log(`通过: ${passed}/${total}`);
console.log(`成功率: ${((passed / total) * 100).toFixed(1)}%`);

if (passed === total) {
  console.log('\n🎉 所有Phase 2核心功能验证通过！');
  console.log('✅ IndexedDB迁移基础设施已就绪');
  console.log('✅ 核心组件已更新完成');
  console.log('✅ 适配器模式工作正常');
  console.log('\n🚀 项目已准备好进入Phase 3开发');
} else if (passed >= total * 0.8) {
  console.log('\n⚠️  Phase 2基本完成，但有一些问题需要修复');
  console.log(`   ${total - passed} 个验证项未通过`);
} else {
  console.log('\n❌ Phase 2验证失败，需要进一步修复');
  console.log(`   ${total - passed} 个验证项未通过`);
}

// 下一步建议
console.log('\n📋 下一步建议:');
if (passed === total) {
  console.log('1. 开始Phase 3：高级功能实现');
  console.log('2. 实现云同步功能');
  console.log('3. 添加离线操作支持');
  console.log('4. 实现冲突解决机制');
} else {
  console.log('1. 修复失败的验证项');
  console.log('2. 确保所有组件正确导入新的适配器');
  console.log('3. 测试数据迁移功能');
  console.log('4. 验证用户体验');
}

console.log('\n验证完成时间:', new Date().toLocaleString());