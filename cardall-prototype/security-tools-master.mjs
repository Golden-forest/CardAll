#!/usr/bin/env node

/**
 * CardAll 云端同步重构安全工具主控制器
 * 统一管理所有安全备份、监控和回滚工具
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

class SecurityToolsMaster {
  constructor() {
    this.sessionId = Date.now().toString();
    this.startTime = new Date().toISOString();
    this.tools = {
      backup: {
        'create-backup': 'backup-tools/create-backup.mjs',
        'backup-supabase': 'backup-tools/backup-supabase.mjs'
      },
      monitoring: {
        'health-check': 'monitoring-tools/health-check.mjs',
        'sync-monitor': 'monitoring-tools/sync-monitor.mjs',
        'refactor-monitor': 'monitoring-tools/refactor-monitor.mjs'
      },
      rollback: {
        'rollback-manager': 'rollback-tools/rollback-manager.mjs',
        'git-rollback': 'rollback-tools/git-rollback.mjs'
      },
      security: {
        'security-scan': 'security-audit/security-scan.mjs'
      }
    };
    this.workflow = {
      phase: 'preparation',
      steps: [],
      completed: [],
      failed: []
    };
  }

  async log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase().padEnd(5)}] [MASTER] ${message}`;
    console.log(logMessage);
  }

  async runTool(category, toolName, args = []) {
    try {
      const toolPath = this.tools[category][toolName];
      if (!toolPath) {
        throw new Error(`工具不存在: ${category}.${toolName}`);
      }

      const fullPath = path.join(projectRoot, toolPath);
      const command = `node ${fullPath} ${args.join(' ')}`;

      await this.log(`执行工具: ${category}.${toolName} ${args.join(' ')}`);

      const output = execSync(command, {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      });

      await this.log(`工具执行成功: ${category}.${toolName}`);
      return { success: true, output };
    } catch (error) {
      await this.log(`工具执行失败: ${category}.${toolName} - ${error.message}`, 'error');
      return { success: false, error: error.message, output: error.stdout };
    }
  }

  async ensureDirectories() {
    try {
      const directories = [
        '.backups',
        '.backups/restore-points',
        '.backups/refactor-snapshots',
        '.backups/refactor-logs',
        '.backups/security-reports'
      ];

      for (const dir of directories) {
        const dirPath = path.join(projectRoot, dir);
        await fs.mkdir(dirPath, { recursive: true });
      }

      await this.log('安全工具目录已准备就绪');
      return true;
    } catch (error) {
      await this.log(`创建目录失败: ${error.message}`, 'error');
      return false;
    }
  }

  async executePhase1() {
    try {
      await this.log('开始执行阶段1: 安全准备和监控建立');

      this.workflow.phase = 'phase1_preparation';
      const steps = [
        { name: '环境准备', action: () => this.ensureDirectories() },
        { name: '创建完整备份', action: () => this.runTool('backup', 'create-backup') },
        { name: '备份Supabase数据', action: () => this.runTool('backup', 'backup-supabase') },
        { name: '系统健康检查', action: () => this.runTool('monitoring', 'health-check') },
        { name: '同步服务监控', action: () => this.runTool('monitoring', 'sync-monitor') },
        { name: '安全扫描', action: () => this.runTool('security', 'security-scan') },
        { name: '创建重构基线', action: () => this.runTool('monitoring', 'refactor-monitor', ['monitor']) }
      ];

      for (const step of steps) {
        await this.log(`执行步骤: ${step.name}`);
        this.workflow.steps.push(step.name);

        try {
          const result = await step.action();
          if (result && result.success === false) {
            this.workflow.failed.push(step.name);
            await this.log(`步骤失败: ${step.name} - ${result.error}`, 'error');
            throw new Error(`关键步骤失败: ${step.name}`);
          } else {
            this.workflow.completed.push(step.name);
            await this.log(`步骤完成: ${step.name}`);
          }
        } catch (error) {
          this.workflow.failed.push(step.name);
          await this.log(`步骤异常: ${step.name} - ${error.message}`, 'error');
          throw error;
        }
      }

      await this.log('阶段1执行完成，所有安全措施已就位');
      return true;
    } catch (error) {
      await this.log(`阶段1执行失败: ${error.message}`, 'error');
      return false;
    }
  }

  async createRestorePoint(name) {
    try {
      await this.log(`创建恢复点: ${name}`);
      const result = await this.runTool('rollback', 'rollback-manager', ['create-restore-point', name]);
      return result.success;
    } catch (error) {
      await this.log(`创建恢复点失败: ${error.message}`, 'error');
      return false;
    }
  }

  async quickRollback() {
    try {
      await this.log('执行快速回滚');
      const result = await this.runTool('rollback', 'rollback-manager', ['quick-rollback']);
      return result.success;
    } catch (error) {
      await this.log(`快速回滚失败: ${error.message}`, 'error');
      return false;
    }
  }

  async emergencyRollback() {
    try {
      await this.log('🚨 执行紧急回滚');
      const result = await this.runTool('rollback', 'rollback-manager', ['emergency-rollback']);
      return result.success;
    } catch (error) {
      await this.log(`紧急回滚失败: ${error.message}`, 'error');
      return false;
    }
  }

  async printStatus() {
    console.log('\n' + '='.repeat(80));
    console.log('🛡️  CardAll 云端同步重构安全工具控制台');
    console.log('='.repeat(80));
    console.log(`🆔 会话ID: ${this.sessionId}`);
    console.log(`📅 开始时间: ${this.startTime}`);
    console.log(`🔄 当前阶段: ${this.workflow.phase}`);
    console.log(`✅ 已完成步骤: ${this.workflow.completed.length}`);
    console.log(`❌ 失败步骤: ${this.workflow.failed.length}`);

    if (this.workflow.steps.length > 0) {
      console.log('\n📋 工作流程状态:');
      this.workflow.steps.forEach((step, index) => {
        const status = this.workflow.completed.includes(step) ? '✅' :
                      this.workflow.failed.includes(step) ? '❌' : '⏳';
        console.log(`  ${index + 1}. ${status} ${step}`);
      });
    }

    console.log('\n🔧 可用工具:');
    for (const [category, tools] of Object.entries(this.tools)) {
      console.log(`  📂 ${category}:`);
      for (const [name, path] of Object.entries(tools)) {
        console.log(`    - ${name}`);
      }
    }

    console.log('\n⚡ 快速命令:');
    console.log('  npm run security:phase1          - 执行阶段1安全准备');
    console.log('  npm run security:backup          - 创建完整备份');
    console.log('  npm run security:health          - 系统健康检查');
    console.log('  npm run security:monitor         - 开始重构监控');
    console.log('  npm run security:rollback        - 快速回滚');
    console.log('  npm run security:emergency       - 紧急回滚');
    console.log('  npm run security:status          - 显示状态');

    console.log('='.repeat(80));
  }

  async saveSessionReport() {
    try {
      const reportPath = path.join(projectRoot, '.backups', `security-session-${this.sessionId}.json`);
      const report = {
        sessionId: this.sessionId,
        startTime: this.startTime,
        endTime: new Date().toISOString(),
        workflow: this.workflow,
        tools: Object.keys(this.tools).reduce((acc, category) => {
          acc[category] = Object.keys(this.tools[category]);
          return acc;
        }, {})
      };

      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      await this.log(`会话报告已保存: ${reportPath}`);
      return reportPath;
    } catch (error) {
      await this.log(`保存会话报告失败: ${error.message}`, 'error');
      return null;
    }
  }
}

// 主执行函数
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    const master = new SecurityToolsMaster();

    switch (command) {
      case 'phase1':
        console.log('🚀 开始CardAll云端同步重构阶段1: 安全准备');
        const success = await master.executePhase1();
        await master.printStatus();
        await master.saveSessionReport();

        if (success) {
          console.log('\n🎉 阶段1安全准备完成！现在可以安全地进行重构工作。');
          console.log('📝 建议定期运行监控命令确保系统稳定。');
          process.exit(0);
        } else {
          console.log('\n❌ 阶段1安全准备失败，请检查错误信息并重试。');
          process.exit(1);
        }

      case 'backup':
        await master.runTool('backup', 'create-backup');
        break;

      case 'backup-supabase':
        await master.runTool('backup', 'backup-supabase');
        break;

      case 'health':
        await master.runTool('monitoring', 'health-check');
        break;

      case 'monitor':
        await master.runTool('monitoring', 'sync-monitor');
        break;

      case 'refactor-monitor':
        const monitorArgs = args.slice(1);
        await master.runTool('monitoring', 'refactor-monitor', monitorArgs);
        break;

      case 'security-scan':
        await master.runTool('security', 'security-scan');
        break;

      case 'restore-point':
        const restorePointName = args[1] || `restore-point-${Date.now()}`;
        await master.createRestorePoint(restorePointName);
        break;

      case 'rollback':
        await master.quickRollback();
        break;

      case 'emergency':
        await master.emergencyRollback();
        break;

      case 'status':
        await master.printStatus();
        break;

      case 'git':
        const gitArgs = args.slice(1);
        await master.runTool('rollback', 'git-rollback', gitArgs);
        break;

      default:
        console.log('CardAll 云端同步重构安全工具主控制器');
        console.log('用法: node security-tools-master.mjs <command> [options]');
        console.log('');
        console.log('主要命令:');
        console.log('  phase1                  - 执行阶段1完整安全准备');
        console.log('  backup                  - 创建项目备份');
        console.log('  backup-supabase         - 备份Supabase数据');
        console.log('  health                  - 系统健康检查');
        console.log('  monitor                 - 同步服务监控');
        console.log('  refactor-monitor [args] - 重构监控工具');
        console.log('  security-scan          - 安全扫描');
        console.log('  restore-point [name]   - 创建恢复点');
        console.log('  rollback               - 快速回滚');
        console.log('  emergency               - 紧急回滚');
        console.log('  status                 - 显示当前状态');
        console.log('  git [args]             - Git回滚工具');
        console.log('');
        console.log('示例:');
        console.log('  node security-tools-master.mjs phase1');
        console.log('  node security-tools-master.mjs backup');
        console.log('  node security-tools-master.mjs health');
        console.log('  node security-tools-master.mjs restore-point "before-changes"');
        process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('命令执行失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default SecurityToolsMaster;