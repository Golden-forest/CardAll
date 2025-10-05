#!/usr/bin/env node

/**
 * CardAll 回滚管理器
 * 提供完整的代码、配置和数据回滚功能
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

class RollbackManager {
  constructor() {
    this.backupDir = path.join(projectRoot, '.backups');
    this.rollbackHistory = [];
    this.currentSession = {
      id: Date.now().toString(),
      startTime: new Date().toISOString(),
      operations: [],
      status: 'initialized'
    };
  }

  async log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] [SESSION:${this.currentSession.id}] ${message}`;
    console.log(logMessage);

    // 记录到会话日志
    this.currentSession.operations.push({
      timestamp,
      type,
      message,
      operation: this.currentSession.operations.length + 1
    });
  }

  async createRestorePoint(name = 'auto-restore-point') {
    try {
      await this.log(`创建恢复点: ${name}`);

      const restorePoint = {
        id: Date.now().toString(),
        name,
        timestamp: new Date().toISOString(),
        gitCommit: null,
        files: {},
        configs: {},
        status: 'creating'
      };

      // 获取当前Git提交
      try {
        restorePoint.gitCommit = execSync('git rev-parse HEAD', {
          cwd: projectRoot,
          encoding: 'utf8'
        }).trim();
      } catch (error) {
        await this.log('无法获取Git提交信息', 'warning');
      }

      // 备份关键配置文件
      const criticalFiles = [
        '.env',
        'package.json',
        'vite.config.ts',
        'tsconfig.json',
        'tailwind.config.ts',
        'jest.config.ts'
      ];

      for (const file of criticalFiles) {
        try {
          const filePath = path.join(projectRoot, file);
          const content = await fs.readFile(filePath, 'utf8');
          restorePoint.files[file] = {
            content,
            checksum: this.calculateChecksum(content),
            modified: (await fs.stat(filePath)).mtime.toISOString()
          };
        } catch (error) {
          await this.log(`无法备份文件 ${file}: ${error.message}`, 'warning');
        }
      }

      // 保存恢复点
      const restorePointsDir = path.join(this.backupDir, 'restore-points');
      await fs.mkdir(restorePointsDir, { recursive: true });

      const restorePointFile = path.join(restorePointsDir, `${restorePoint.id}-${name.replace(/[^a-zA-Z0-9]/g, '-')}.json`);
      await fs.writeFile(restorePointFile, JSON.stringify(restorePoint, null, 2));

      restorePoint.status = 'created';
      restorePoint.file = restorePointFile;

      await this.log(`恢复点创建成功: ${restorePoint.id}`);
      return restorePoint;
    } catch (error) {
      await this.log(`创建恢复点失败: ${error.message}`, 'error');
      throw error;
    }
  }

  calculateChecksum(content) {
    const { createHash } = require('crypto');
    return createHash('sha256').update(content).digest('hex');
  }

  async listRestorePoints() {
    try {
      const restorePointsDir = path.join(this.backupDir, 'restore-points');

      try {
        await fs.access(restorePointsDir);
      } catch (error) {
        await this.log('恢复点目录不存在', 'warning');
        return [];
      }

      const files = await fs.readdir(restorePointsDir);
      const restorePoints = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(restorePointsDir, file);
            const content = await fs.readFile(filePath, 'utf8');
            const restorePoint = JSON.parse(content);
            restorePoints.push(restorePoint);
          } catch (error) {
            await this.log(`读取恢复点文件失败 ${file}: ${error.message}`, 'warning');
          }
        }
      }

      // 按时间排序，最新的在前
      restorePoints.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return restorePoints;
    } catch (error) {
      await this.log(`列出恢复点失败: ${error.message}`, 'error');
      return [];
    }
  }

  async rollbackToRestorePoint(restorePointId, options = {}) {
    try {
      await this.log(`开始回滚到恢复点: ${restorePointId}`);

      // 查找恢复点
      const restorePoints = await this.listRestorePoints();
      const restorePoint = restorePoints.find(rp => rp.id === restorePointId);

      if (!restorePoint) {
        throw new Error(`恢复点不存在: ${restorePointId}`);
      }

      await this.log(`找到恢复点: ${restorePoint.name} (${restorePoint.timestamp})`);

      const rollbackPlan = {
        gitRollback: options.includeGit !== false,
        filesRollback: options.includeFiles !== false,
        configRollback: options.includeConfig !== false,
        createBackup: options.createBackup !== false
      };

      await this.log(`回滚计划: ${JSON.stringify(rollbackPlan, null, 2)}`);

      // 创建回滚前的备份
      if (rollbackPlan.createBackup) {
        await this.createRestorePoint(`pre-rollback-${Date.now()}`);
      }

      let successCount = 0;
      let errorCount = 0;

      // Git回滚
      if (rollbackPlan.gitRollback && restorePoint.gitCommit) {
        try {
          await this.log(`执行Git回滚到提交: ${restorePoint.gitCommit}`);
          execSync(`git reset --hard ${restorePoint.gitCommit}`, {
            cwd: projectRoot,
            stdio: 'inherit'
          });
          successCount++;
          await this.log('Git回滚成功');
        } catch (error) {
          errorCount++;
          await this.log(`Git回滚失败: ${error.message}`, 'error');
        }
      }

      // 文件回滚
      if (rollbackPlan.filesRollback) {
        for (const [fileName, fileInfo] of Object.entries(restorePoint.files)) {
          try {
            const filePath = path.join(projectRoot, fileName);
            await fs.writeFile(filePath, fileInfo.content);
            await this.log(`恢复文件: ${fileName}`);
            successCount++;
          } catch (error) {
            errorCount++;
            await this.log(`恢复文件失败 ${fileName}: ${error.message}`, 'error');
          }
        }
      }

      // 记录回滚结果
      const rollbackResult = {
        restorePointId,
        restorePointName: restorePoint.name,
        timestamp: new Date().toISOString(),
        plan: rollbackPlan,
        results: {
          successCount,
          errorCount,
          totalOperations: Object.keys(restorePoint.files).length + (rollbackPlan.gitRollback ? 1 : 0)
        },
        status: errorCount === 0 ? 'success' : 'partial'
      };

      // 保存回滚历史
      this.rollbackHistory.push(rollbackResult);
      await this.saveRollbackHistory();

      await this.log(`回滚完成: ${successCount} 成功, ${errorCount} 失败`);

      return rollbackResult;
    } catch (error) {
      await this.log(`回滚失败: ${error.message}`, 'error');
      throw error;
    }
  }

  async quickRollback(options = {}) {
    try {
      await this.log('执行快速回滚');

      // 获取最近的恢复点
      const restorePoints = await this.listRestorePoints();
      if (restorePoints.length === 0) {
        throw new Error('没有可用的恢复点');
      }

      const latestRestorePoint = restorePoints[0];
      await this.log(`使用最近的恢复点: ${latestRestorePoint.name}`);

      return await this.rollbackToRestorePoint(latestRestorePoint.id, options);
    } catch (error) {
      await this.log(`快速回滚失败: ${error.message}`, 'error');
      throw error;
    }
  }

  async emergencyRollback() {
    try {
      await this.log('🚨 执行紧急回滚程序');

      // 创建紧急恢复点
      await this.createRestorePoint('emergency-rollback-backup');

      // 重置所有未提交的更改
      try {
        await this.log('重置Git未提交的更改');
        execSync('git reset --hard HEAD', {
          cwd: projectRoot,
          stdio: 'inherit'
        });
        execSync('git clean -fd', {
          cwd: projectRoot,
          stdio: 'inherit'
        });
      } catch (error) {
        await this.log('Git重置失败，继续手动恢复', 'warning');
      }

      // 恢复关键配置文件到默认状态
      const defaultConfigs = {
        '.env': `# Supabase Configuration
VITE_SUPABASE_URL=https://elwnpejlwkgdacaugvvd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsd25wZWpsd2tnZGFjYXVndnZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMzkxNTAsImV4cCI6MjA2ODkxNTE1MH0.XhVGgO2nf8uS1gC0V6jTMP0p0xN5KKV47t2rK2ncK90
VITE_SUPABASE_ACCESS_TOKEN=sbp_e95c8cedf56ad231cb00db4c2696b029c20cefda

# Application Configuration
VITE_APP_NAME=CardAll
VITE_APP_VERSION=1.0.0
VITE_APP_ENVIRONMENT=development
`
      };

      for (const [fileName, content] of Object.entries(defaultConfigs)) {
        try {
          const filePath = path.join(projectRoot, fileName);
          await fs.writeFile(filePath, content);
          await this.log(`恢复默认配置: ${fileName}`);
        } catch (error) {
          await this.log(`恢复配置失败 ${fileName}: ${error.message}`, 'error');
        }
      }

      // 重新安装依赖
      try {
        await this.log('重新安装依赖');
        execSync('npm install', {
          cwd: projectRoot,
          stdio: 'inherit'
        });
      } catch (error) {
        await this.log('依赖安装失败，请手动运行 npm install', 'error');
      }

      await this.log('紧急回滚完成');
      return { status: 'success', message: '紧急回滚完成，建议验证系统功能' };
    } catch (error) {
      await this.log(`紧急回滚失败: ${error.message}`, 'error');
      throw error;
    }
  }

  async saveRollbackHistory() {
    try {
      const historyFile = path.join(this.backupDir, 'rollback-history.json');
      await fs.mkdir(path.dirname(historyFile), { recursive: true });
      await fs.writeFile(historyFile, JSON.stringify(this.rollbackHistory, null, 2));
    } catch (error) {
      await this.log(`保存回滚历史失败: ${error.message}`, 'warning');
    }
  }

  async loadRollbackHistory() {
    try {
      const historyFile = path.join(this.backupDir, 'rollback-history.json');
      const content = await fs.readFile(historyFile, 'utf8');
      this.rollbackHistory = JSON.parse(content);
    } catch (error) {
      this.rollbackHistory = [];
    }
  }

  async verifySystemState() {
    try {
      await this.log('验证系统状态');

      const verification = {
        timestamp: new Date().toISOString(),
        checks: {},
        status: 'unknown'
      };

      // 检查Git状态
      try {
        const gitStatus = execSync('git status --porcelain', {
          cwd: projectRoot,
          encoding: 'utf8'
        });
        verification.checks.git = {
          status: 'clean',
          changes: gitStatus.split('\n').filter(line => line.trim()).length
        };
      } catch (error) {
        verification.checks.git = {
          status: 'error',
          error: error.message
        };
      }

      // 检查关键文件
      const criticalFiles = ['.env', 'package.json', 'src/main.tsx'];
      verification.checks.files = {
        present: 0,
        missing: []
      };

      for (const file of criticalFiles) {
        try {
          await fs.access(path.join(projectRoot, file));
          verification.checks.files.present++;
        } catch (error) {
          verification.checks.files.missing.push(file);
        }
      }

      // 检查依赖
      try {
        execSync('npm ls --depth=0', {
          cwd: projectRoot,
          stdio: 'pipe',
          encoding: 'utf8'
        });
        verification.checks.dependencies = {
          status: 'ok'
        };
      } catch (error) {
        verification.checks.dependencies = {
          status: 'error',
          error: error.message
        };
      }

      // 检查构建
      try {
        execSync('npx vite build --mode development', {
          cwd: projectRoot,
          stdio: 'pipe',
          encoding: 'utf8'
        });
        verification.checks.build = {
          status: 'ok'
        };
      } catch (error) {
        verification.checks.build = {
          status: 'error',
          error: error.message
        };
      }

      // 综合状态
      const errors = Object.values(verification.checks).filter(check => check.status === 'error').length;
      const warnings = Object.values(verification.checks).filter(check =>
        check.status === 'warning' || (check.changes && check.changes > 0)
      ).length;

      if (errors === 0 && warnings === 0) {
        verification.status = 'healthy';
      } else if (errors === 0) {
        verification.status = 'warning';
      } else {
        verification.status = 'error';
      }

      await this.log(`系统验证完成: ${verification.status} (${errors} 错误, ${warnings} 警告)`);
      return verification;
    } catch (error) {
      await this.log(`系统验证失败: ${error.message}`, 'error');
      return {
        timestamp: new Date().toISOString(),
        status: 'error',
        error: error.message
      };
    }
  }

  async createRollbackScript() {
    const script = `#!/usr/bin/env node

/**
 * CardAll 快速回滚脚本
 * 用于紧急情况下的快速系统恢复
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const projectRoot = path.resolve(__dirname, '..');

async function emergencyRollback() {
  console.log('🚨 执行紧急回滚...');

  try {
    // 1. 重置Git状态
    console.log('重置Git状态...');
    try {
      execSync('git reset --hard HEAD', { cwd: projectRoot, stdio: 'inherit' });
      execSync('git clean -fd', { cwd: projectRoot, stdio: 'inherit' });
      console.log('✅ Git状态重置完成');
    } catch (error) {
      console.warn('⚠️  Git重置失败:', error.message);
    }

    // 2. 恢复环境配置
    console.log('恢复环境配置...');
    const defaultEnv = \`# Supabase Configuration
VITE_SUPABASE_URL=https://elwnpejlwkgdacaugvvd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsd25wZWpsd2tnZGFjYXVndnZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMzkxNTAsImV4cCI6MjA2ODkxNTE1MH0.XhVGgO2nf8uS1gC0V6jTMP0p0xN5KKV47t2rK2ncK90
VITE_SUPABASE_ACCESS_TOKEN=sbp_e95c8cedf56ad231cb00db4c2696b029c20cefda

# Application Configuration
VITE_APP_NAME=CardAll
VITE_APP_VERSION=1.0.0
VITE_APP_ENVIRONMENT=development
\`;

    await fs.writeFile(path.join(projectRoot, '.env'), defaultEnv);
    console.log('✅ 环境配置恢复完成');

    // 3. 重新安装依赖
    console.log('重新安装依赖...');
    try {
      execSync('npm install', { cwd: projectRoot, stdio: 'inherit' });
      console.log('✅ 依赖安装完成');
    } catch (error) {
      console.error('❌ 依赖安装失败:', error.message);
      console.log('请手动运行: npm install');
    }

    // 4. 验证系统
    console.log('验证系统状态...');
    try {
      execSync('npm run build', { cwd: projectRoot, stdio: 'pipe' });
      console.log('✅ 系统验证通过');
    } catch (error) {
      console.warn('⚠️  系统验证失败，请检查配置');
    }

    console.log('\\n🎉 紧急回滚完成！');
    console.log('建议运行以下命令验证系统:');
    console.log('  npm run dev');
    console.log('  npm run test');

  } catch (error) {
    console.error('❌ 紧急回滚失败:', error.message);
    process.exit(1);
  }
}

// 询问确认
const readline = await import('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('确定要执行紧急回滚吗？这将重置所有未提交的更改。(y/N): ', async (answer) => {
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    await emergencyRollback();
  } else {
    console.log('紧急回滚已取消');
  }
  rl.close();
});
`;

    const scriptPath = path.join(__dirname, 'emergency-rollback.mjs');
    await fs.writeFile(scriptPath, script);

    // 在Windows上创建批处理文件
    if (process.platform === 'win32') {
      const batchScript = `@echo off
echo 🚨 执行紧急回滚...
node emergency-rollback.mjs
pause
`;
      await fs.writeFile(path.join(__dirname, 'emergency-rollback.bat'), batchScript);
    }

    await this.log('紧急回滚脚本已创建');
    return scriptPath;
  }

  async printStatus() {
    console.log('\n' + '='.repeat(60));
    console.log('🔄 CardAll 回滚管理器状态');
    console.log('='.repeat(60));
    console.log(`📅 当前时间: ${new Date().toISOString()}`);
    console.log(`🆔 会话ID: ${this.currentSession.id}`);
    console.log(`⏰ 会话开始: ${this.currentSession.startTime}`);
    console.log(`📊 会话状态: ${this.currentSession.status}`);
    console.log(`📝 操作数量: ${this.currentSession.operations.length}`);

    // 显示恢复点
    const restorePoints = await this.listRestorePoints();
    console.log(`\n📂 可用恢复点: ${restorePoints.length}`);
    restorePoints.slice(0, 5).forEach((rp, index) => {
      console.log(`  ${index + 1}. ${rp.name} (${rp.timestamp}) - ${rp.id}`);
    });

    // 显示回滚历史
    console.log(`\n📜 回滚历史: ${this.rollbackHistory.length} 条记录`);
    this.rollbackHistory.slice(-3).forEach((history, index) => {
      console.log(`  ${index + 1}. ${history.restorePointName} (${history.timestamp}) - ${history.status}`);
    });

    console.log('='.repeat(60));
  }

  async execute(command, options = {}) {
    try {
      await this.log(`执行命令: ${command}`);

      switch (command) {
        case 'create-restore-point':
          return await this.createRestorePoint(options.name);

        case 'list-restore-points':
          return await this.listRestorePoints();

        case 'rollback':
          return await this.rollbackToRestorePoint(options.restorePointId, options);

        case 'quick-rollback':
          return await this.quickRollback(options);

        case 'emergency-rollback':
          return await this.emergencyRollback();

        case 'verify':
          return await this.verifySystemState();

        case 'status':
          await this.printStatus();
          return this.currentSession;

        case 'create-script':
          return await this.createRollbackScript();

        default:
          throw new Error(`未知命令: ${command}`);
      }
    } catch (error) {
      await this.log(`命令执行失败: ${error.message}`, 'error');
      throw error;
    }
  }
}

// 主执行函数
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log('CardAll 回滚管理器');
    console.log('用法: node rollback-manager.mjs <command> [options]');
    console.log('');
    console.log('可用命令:');
    console.log('  create-restore-point [name]  - 创建恢复点');
    console.log('  list-restore-points         - 列出所有恢复点');
    console.log('  rollback <restore-point-id> - 回滚到指定恢复点');
    console.log('  quick-rollback               - 快速回滚到最近恢复点');
    console.log('  emergency-rollback           - 紧急回滚');
    console.log('  verify                       - 验证系统状态');
    console.log('  status                       - 显示当前状态');
    console.log('  create-script                - 创建紧急回滚脚本');
    process.exit(1);
  }

  try {
    const rollbackManager = new RollbackManager();
    await rollbackManager.loadRollbackHistory();

    const options = {};
    if (command === 'rollback' && args[1]) {
      options.restorePointId = args[1];
    } else if (command === 'create-restore-point' && args[1]) {
      options.name = args[1];
    }

    const result = await rollbackManager.execute(command, options);

    if (result && typeof result === 'object') {
      console.log('\n操作结果:', JSON.stringify(result, null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error('操作失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default RollbackManager;