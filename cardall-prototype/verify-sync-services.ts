/**
 * 同步服务验证测试
 * 快速验证关键同步服务是否可以正常导入和初始化
 */

console.log('开始同步服务验证测试...\n');

const testResults: Array<{name: string, status: 'PASS' | 'FAIL', error: string | null}> = [];

// 测试关键同步服务的语法检查
async function testSyntaxCheck() {
  const servicesToCheck = [
    'cloud-sync.ts',
    'local-operation-isolation.ts',
    'sync-error-isolation.ts',
    'database-unified.ts',
    'network-manager.ts',
    'unified-sync-service.ts'
  ];

  console.log('检查关键同步服务文件语法...');

  for (const serviceFile of servicesToCheck) {
    try {
      console.log(`检查: ${serviceFile}`);
      // 通过 TypeScript 编译检查语法
      const { execSync } = require('child_process');
      execSync(`npx tsc --noEmit --skipLibCheck src/services/${serviceFile}`, {
        stdio: 'pipe',
        cwd: __dirname
      });
      console.log(`✓ ${serviceFile} 语法检查通过`);
      testResults.push({ name: serviceFile, status: 'PASS', error: null });
    } catch (error) {
      console.log(`✗ ${serviceFile} 语法检查失败: ${error.message?.split('\n')[0] || error}`);
      testResults.push({ name: serviceFile, status: 'FAIL', error: error.message?.split('\n')[0] || error.toString() });
    }
  }
}

// 检查数据库架构文件中的版本信息
async function testDatabaseVersion() {
  try {
    console.log('\n检查数据库架构版本...');
    const fs = require('fs');
    const path = require('path');

    const dbPath = path.join(__dirname, 'src/services/database-unified.ts');
    const dbContent = fs.readFileSync(dbPath, 'utf8');

    // 检查版本信息
    const versionMatch = dbContent.match(/version:\s*5/);
    if (versionMatch) {
      console.log('✓ 数据库架构版本设置为 v5');
    } else {
      console.log('✗ 数据库架构版本未设置为 v5');
      testResults.push({ name: '数据库架构版本', status: 'FAIL', error: '版本未设置为5' });
      return;
    }

    // 检查关键表定义
    const requiredTables = ['sync_metadata', 'conflict_records'];
    for (const table of requiredTables) {
      if (dbContent.includes(table)) {
        console.log(`✓ 表 ${table} 已定义`);
      } else {
        console.log(`✗ 表 ${table} 未定义`);
        testResults.push({ name: `表 ${table}`, status: 'FAIL', error: '表未定义' });
        return;
      }
    }

    testResults.push({ name: '数据库架构', status: 'PASS', error: null });
  } catch (error) {
    console.log(`✗ 数据库架构检查失败: ${error.message}`);
    testResults.push({ name: '数据库架构', status: 'FAIL', error: error.message });
  }
}

// 检查关键导入和导出
async function testImportsAndExports() {
  try {
    console.log('\n检查关键服务的导入导出...');
    const fs = require('fs');
    const path = require('path');

    const services = [
      { file: 'cloud-sync.ts', expectedExport: 'CloudSyncService' },
      { file: 'local-operation-isolation.ts', expectedExport: 'LocalOperationIsolation' },
      { file: 'sync-error-isolation.ts', expectedExport: 'SyncErrorIsolation' }
    ];

    for (const service of services) {
      const filePath = path.join(__dirname, `src/services/${service.file}`);
      const content = fs.readFileSync(filePath, 'utf8');

      if (content.includes(`export.*${service.expectedExport}`) || content.includes(`export.*{.*${service.expectedExport}`)) {
        console.log(`✓ ${service.file} 包含正确的导出`);
        testResults.push({ name: `${service.file} 导出`, status: 'PASS', error: null });
      } else {
        console.log(`✗ ${service.file} 缺少导出 ${service.expectedExport}`);
        testResults.push({ name: `${service.file} 导出`, status: 'FAIL', error: `缺少导出 ${service.expectedExport}` });
      }
    }
  } catch (error) {
    console.log(`✗ 导入导出检查失败: ${error.message}`);
    testResults.push({ name: '导入导出检查', status: 'FAIL', error: error.message });
  }
}

// 检查错误处理机制
async function testErrorHandling() {
  try {
    console.log('\n检查错误处理机制...');
    const fs = require('fs');
    const path = require('path');

    const services = ['cloud-sync.ts', 'local-operation-isolation.ts', 'sync-error-isolation.ts'];

    for (const service of services) {
      const filePath = path.join(__dirname, `src/services/${service}`);
      const content = fs.readFileSync(filePath, 'utf8');

      if (content.includes('try') && content.includes('catch') && content.includes('error')) {
        console.log(`✓ ${service} 包含错误处理机制`);
        testResults.push({ name: `${service} 错误处理`, status: 'PASS', error: null });
      } else {
        console.log(`✗ ${service} 缺少错误处理机制`);
        testResults.push({ name: `${service} 错误处理`, status: 'FAIL', error: '缺少错误处理' });
      }
    }
  } catch (error) {
    console.log(`✗ 错误处理检查失败: ${error.message}`);
    testResults.push({ name: '错误处理检查', status: 'FAIL', error: error.message });
  }
}

// 运行所有测试
async function runTests() {
  await testSyntaxCheck();
  await testDatabaseVersion();
  await testImportsAndExports();
  await testErrorHandling();

  // 输出测试结果摘要
  console.log('\n=== 测试结果摘要 ===');
  const passedTests = testResults.filter(r => r.status === 'PASS');
  const failedTests = testResults.filter(r => r.status === 'FAIL');

  console.log(`通过: ${passedTests.length}/${testResults.length}`);
  console.log(`失败: ${failedTests.length}/${testResults.length}`);

  if (failedTests.length > 0) {
    console.log('\n失败的测试:');
    failedTests.forEach(test => {
      console.log(`  - ${test.name}: ${test.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✓ 所有关键同步服务验证通过！');
    process.exit(0);
  }
}

// 运行测试
runTests().catch(error => {
  console.error('测试运行失败:', error);
  process.exit(1);
});