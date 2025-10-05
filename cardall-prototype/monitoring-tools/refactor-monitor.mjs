#!/usr/bin/env node

/**
 * CardAll 重构过程监控工具
 * 专门用于监控云端同步重构过程的完整性和安全性
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

class RefactorMonitor {
  constructor() {
    this.sessionId = Date.now().toString();
    this.startTime = new Date().toISOString();
    this.baseline = null;
    this.current = {
      files: {},
      metrics: {},
      issues: [],
      changes: []
    };
    this.milestones = [];
    this.checkpoints = [];
    this.alerts = [];
    this.config = {
      monitorPaths: [
        'src/',
        'tests/',
        'package.json',
        'vite.config.ts',
        'tsconfig.json'
      ],
      criticalFiles: [
        'src/main.tsx',
        'src/App.tsx',
        'src/contexts/cardall-context.tsx',
        'src/services/database-service.ts',
        'src/services/sync-service.ts'
      ],
      excludePatterns: [
        'node_modules/',
        'dist/',
        '.git/',
        'coverage/',
        'test-results/'
      ]
    };
  }

  async log(message, type = 'info', data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      sessionId: this.sessionId,
      type,
      message,
      data
    };

    console.log(`[${timestamp}] [${type.toUpperCase().padEnd(5)}] ${message}`);

    // 记录到监控日志
    await this.appendLog(logEntry);

    // 根据类型添加警告
    if (type === 'error' || type === 'warning') {
      this.alerts.push({
        id: Date.now().toString(),
        type,
        message,
        timestamp,
        data
      });
    }
  }

  async appendLog(logEntry) {
    try {
      const logDir = path.join(projectRoot, '.backups', 'refactor-logs');
      await fs.mkdir(logDir, { recursive: true });

      const logFile = path.join(logDir, `refactor-${this.sessionId}.log`);
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(logFile, logLine);
    } catch (error) {
      console.error('写入日志失败:', error.message);
    }
  }

  async calculateFileChecksum(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return createHash('sha256').update(content).digest('hex');
    } catch (error) {
      return null;
    }
  }

  async scanFiles(scanPath = projectRoot) {
    const files = {};

    async function scanDirectory(dirPath, relativePath = '') {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          const relative = path.join(relativePath, entry.name);

          // 检查排除模式
          if (this.config.excludePatterns.some(pattern => relative.includes(pattern))) {
            continue;
          }

          if (entry.isDirectory()) {
            await scanDirectory(fullPath, relative);
          } else {
            // 只监控指定路径中的文件
            if (this.config.monitorPaths.some(monitorPath => relative.startsWith(monitorPath))) {
              try {
                const stat = await fs.stat(fullPath);
                const checksum = await this.calculateFileChecksum(fullPath);

                files[relative] = {
                  path: relative,
                  fullPath,
                  size: stat.size,
                  modified: stat.mtime.toISOString(),
                  checksum,
                  isCritical: this.config.criticalFiles.includes(relative)
                };
              } catch (error) {
                await this.log(`扫描文件失败 ${relative}: ${error.message}`, 'warning');
              }
            }
          }
        }
      } catch (error) {
        await this.log(`扫描目录失败 ${dirPath}: ${error.message}`, 'error');
      }
    }

    await scanDirectory.call(this, scanPath);
    return files;
  }

  async createBaseline() {
    try {
      await this.log('创建重构基线');

      const baseline = {
        sessionId: this.sessionId,
        timestamp: this.startTime,
        gitCommit: null,
        files: await this.scanFiles(),
        metrics: await this.calculateMetrics(),
        status: 'baseline_created'
      };

      // 获取Git提交信息
      try {
        baseline.gitCommit = execSync('git rev-parse HEAD', {
          cwd: projectRoot,
          encoding: 'utf8'
        }).trim();
      } catch (error) {
        await this.log('无法获取Git提交信息', 'warning');
      }

      this.baseline = baseline;
      this.current = JSON.parse(JSON.stringify(baseline)); // 深拷贝

      // 保存基线
      await this.saveSnapshot('baseline', baseline);

      await this.log(`基线创建完成，包含 ${Object.keys(baseline.files).length} 个文件`);
      return baseline;
    } catch (error) {
      await this.log(`创建基线失败: ${error.message}`, 'error');
      throw error;
    }
  }

  async calculateMetrics() {
    try {
      const metrics = {
        fileCount: 0,
        totalSize: 0,
        criticalFileCount: 0,
        languageDistribution: {},
        complexity: {
          functions: 0,
          classes: 0,
          imports: 0
        },
        testCoverage: {
          testFiles: 0,
          sourceFiles: 0,
          coverage: 0
        }
      };

      // 分析文件
      for (const [filePath, fileInfo] of Object.entries(this.current.files)) {
        metrics.fileCount++;
        metrics.totalSize += fileInfo.size;

        if (fileInfo.isCritical) {
          metrics.criticalFileCount++;
        }

        // 语言分布
        const ext = path.extname(filePath);
        metrics.languageDistribution[ext] = (metrics.languageDistribution[ext] || 0) + 1;

        // 复杂度分析（简单版本）
        if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
          try {
            const content = await fs.readFile(fileInfo.fullPath, 'utf8');

            // 计算函数数量
            const functionMatches = content.match(/function\s+\w+|const\s+\w+\s*=\s*\(/g);
            metrics.complexity.functions += functionMatches ? functionMatches.length : 0;

            // 计算类数量
            const classMatches = content.match(/class\s+\w+/g);
            metrics.complexity.classes += classMatches ? classMatches.length : 0;

            // 计算导入数量
            const importMatches = content.match(/import\s+.*from/g);
            metrics.complexity.imports += importMatches ? importMatches.length : 0;
          } catch (error) {
            // 忽略文件读取错误
          }
        }
      }

      // 测试覆盖率估算
      metrics.testCoverage.testFiles = Object.keys(this.current.files).filter(file =>
        file.includes('test') || file.includes('spec')
      ).length;

      metrics.testCoverage.sourceFiles = Object.keys(this.current.files).filter(file =>
        file.startsWith('src/') && (file.endsWith('.ts') || file.endsWith('.tsx'))
      ).length;

      if (metrics.testCoverage.sourceFiles > 0) {
        metrics.testCoverage.coverage =
          (metrics.testCoverage.testFiles / metrics.testCoverage.sourceFiles) * 100;
      }

      return metrics;
    } catch (error) {
      await this.log(`计算指标失败: ${error.message}`, 'error');
      return {};
    }
  }

  async saveSnapshot(name, data) {
    try {
      const snapshotDir = path.join(projectRoot, '.backups', 'refactor-snapshots');
      await fs.mkdir(snapshotDir, { recursive: true });

      const snapshotFile = path.join(snapshotDir, `${this.sessionId}-${name}.json`);
      await fs.writeFile(snapshotFile, JSON.stringify(data, null, 2));

      await this.log(`快照已保存: ${name}`);
      return snapshotFile;
    } catch (error) {
      await this.log(`保存快照失败 ${name}: ${error.message}`, 'error');
      return null;
    }
  }

  async compareWithBaseline() {
    if (!this.baseline) {
      await this.log('没有基线数据可供比较', 'warning');
      return null;
    }

    try {
      await this.log('与基线进行比较');

      const comparison = {
        timestamp: new Date().toISOString(),
        baselineTime: this.baseline.timestamp,
        changes: {
          added: [],
          modified: [],
          deleted: [],
          moved: []
        },
        metrics: {
          fileCountChange: 0,
          sizeChange: 0,
          criticalChanges: 0
        },
        issues: []
      };

      const baselineFiles = this.baseline.files;
      const currentFiles = this.current.files;

      // 查找新增文件
      for (const [filePath, fileInfo] of Object.entries(currentFiles)) {
        if (!baselineFiles[filePath]) {
          comparison.changes.added.push({
            path: filePath,
            size: fileInfo.size,
            isCritical: fileInfo.isCritical
          });
        }
      }

      // 查找删除文件
      for (const [filePath, fileInfo] of Object.entries(baselineFiles)) {
        if (!currentFiles[filePath]) {
          comparison.changes.deleted.push({
            path: filePath,
            size: fileInfo.size,
            wasCritical: fileInfo.isCritical
          });
        }
      }

      // 查找修改文件
      for (const [filePath, currentInfo] of Object.entries(currentFiles)) {
        const baselineInfo = baselineFiles[filePath];
        if (baselineInfo && baselineInfo.checksum !== currentInfo.checksum) {
          comparison.changes.modified.push({
            path: filePath,
            sizeChange: currentInfo.size - baselineInfo.size,
            isCritical: currentInfo.isCritical,
            baselineModified: baselineInfo.modified,
            currentModified: currentInfo.modified
          });

          if (currentInfo.isCritical) {
            comparison.metrics.criticalChanges++;
          }
        }
      }

      // 计算指标变化
      comparison.metrics.fileCountChange =
        Object.keys(currentFiles).length - Object.keys(baselineFiles).length;
      comparison.metrics.sizeChange =
        Object.values(currentFiles).reduce((sum, f) => sum + f.size, 0) -
        Object.values(baselineFiles).reduce((sum, f) => sum + f.size, 0);

      // 检查问题
      if (comparison.metrics.criticalChanges > 0) {
        comparison.issues.push({
          type: 'critical_changes',
          message: `发现 ${comparison.metrics.criticalChanges} 个关键文件变更`,
          severity: 'warning'
        });
      }

      if (comparison.changes.deleted.some(f => f.wasCritical)) {
        comparison.issues.push({
          type: 'critical_deleted',
          message: '关键文件被删除',
          severity: 'error'
        });
      }

      if (comparison.metrics.fileCountChange < -10) {
        comparison.issues.push({
          type: 'mass_deletion',
          message: `大量文件被删除: ${Math.abs(comparison.metrics.fileCountChange)} 个文件`,
          severity: 'warning'
        });
      }

      await this.saveSnapshot('comparison', comparison);
      await this.log(`比较完成，发现 ${comparison.changes.modified.length} 个修改，${comparison.changes.added.length} 个新增，${comparison.changes.deleted.length} 个删除`);

      return comparison;
    } catch (error) {
      await this.log(`比较失败: ${error.message}`, 'error');
      return null;
    }
  }

  async createCheckpoint(name, description = '') {
    try {
      await this.log(`创建检查点: ${name}`);

      this.current.files = await this.scanFiles();
      this.current.metrics = await this.calculateMetrics();

      const checkpoint = {
        id: Date.now().toString(),
        name,
        description,
        timestamp: new Date().toISOString(),
        files: this.current.files,
        metrics: this.current.metrics,
        comparison: await this.compareWithBaseline(),
        alerts: [...this.alerts]
      };

      this.checkpoints.push(checkpoint);
      await this.saveSnapshot(`checkpoint-${name}`, checkpoint);

      await this.log(`检查点创建成功: ${name}`);
      return checkpoint;
    } catch (error) {
      await this.log(`创建检查点失败: ${error.message}`, 'error');
      throw error;
    }
  }

  async recordMilestone(type, description, data = null) {
    try {
      const milestone = {
        id: Date.now().toString(),
        type,
        description,
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        data,
        checkpointCount: this.checkpoints.length
      };

      this.milestones.push(milestone);
      await this.log(`里程碑记录: ${type} - ${description}`, 'info', data);

      // 保存里程碑
      await this.saveSnapshot(`milestone-${type}`, milestone);

      return milestone;
    } catch (error) {
      await this.log(`记录里程碑失败: ${error.message}`, 'error');
      throw error;
    }
  }

  async validateIntegrity() {
    try {
      await this.log('验证系统完整性');

      const validation = {
        timestamp: new Date().toISOString(),
        checks: {
          criticalFiles: { status: 'unknown', issues: [] },
          dependencies: { status: 'unknown', issues: [] },
          buildSystem: { status: 'unknown', issues: [] },
          testSystem: { status: 'unknown', issues: [] }
        },
        overall: { status: 'unknown', score: 0, issues: [] }
      };

      // 检查关键文件
      for (const criticalFile of this.config.criticalFiles) {
        try {
          await fs.access(path.join(projectRoot, criticalFile));
        } catch (error) {
          validation.checks.criticalFiles.issues.push({
            type: 'missing_file',
            file: criticalFile,
            severity: 'error'
          });
        }
      }

      validation.checks.criticalFiles.status =
        validation.checks.criticalFiles.issues.length === 0 ? 'passed' : 'failed';

      // 检查依赖
      try {
        execSync('npm ls --depth=0', {
          cwd: projectRoot,
          stdio: 'pipe',
          encoding: 'utf8'
        });
        validation.checks.dependencies.status = 'passed';
      } catch (error) {
        validation.checks.dependencies.status = 'failed';
        validation.checks.dependencies.issues.push({
          type: 'dependency_error',
          message: error.message,
          severity: 'error'
        });
      }

      // 检查构建系统
      try {
        execSync('npx vite build --mode development', {
          cwd: projectRoot,
          stdio: 'pipe',
          encoding: 'utf8'
        });
        validation.checks.buildSystem.status = 'passed';
      } catch (error) {
        validation.checks.buildSystem.status = 'failed';
        validation.checks.buildSystem.issues.push({
          type: 'build_error',
          message: error.message,
          severity: 'error'
        });
      }

      // 检查测试系统
      try {
        execSync('npm run test:unit', {
          cwd: projectRoot,
          stdio: 'pipe',
          encoding: 'utf8'
        });
        validation.checks.testSystem.status = 'passed';
      } catch (error) {
        validation.checks.testSystem.status = 'warning';
        validation.checks.testSystem.issues.push({
          type: 'test_warning',
          message: '测试执行有问题',
          severity: 'warning'
        });
      }

      // 计算总体评分
      let score = 100;
      let totalIssues = 0;

      for (const [checkName, check] of Object.entries(validation.checks)) {
        if (check.status === 'failed') {
          score -= 25;
        } else if (check.status === 'warning') {
          score -= 10;
        }

        totalIssues += check.issues.filter(issue => issue.severity === 'error').length;
        totalIssues += check.issues.filter(issue => issue.severity === 'warning').length * 0.5;
      }

      validation.overall = {
        status: score >= 80 ? 'healthy' : score >= 60 ? 'warning' : 'critical',
        score: Math.max(0, Math.round(score)),
        issues: totalIssues
      };

      await this.saveSnapshot('integrity-validation', validation);
      await this.log(`完整性验证完成，评分: ${validation.overall.score}/100 (${validation.overall.status})`);

      return validation;
    } catch (error) {
      await this.log(`完整性验证失败: ${error.message}`, 'error');
      return null;
    }
  }

  async generateReport() {
    try {
      await this.log('生成重构监控报告');

      const report = {
        sessionId: this.sessionId,
        startTime: this.startTime,
        endTime: new Date().toISOString(),
        duration: Date.now() - new Date(this.startTime).getTime(),
        summary: {
          checkpoints: this.checkpoints.length,
          milestones: this.milestones.length,
          alerts: this.alerts.length,
          criticalChanges: 0
        },
        timeline: [
          { type: 'session_start', timestamp: this.startTime },
          ...this.milestones.map(m => ({ type: 'milestone', ...m })),
          ...this.checkpoints.map(c => ({ type: 'checkpoint', ...c })),
          { type: 'session_end', timestamp: new Date().toISOString() }
        ],
        metrics: {
          baseline: this.baseline?.metrics,
          current: this.current.metrics,
          changes: null
        },
        issues: this.alerts.filter(alert => alert.type === 'error' || alert.type === 'warning'),
        recommendations: []
      };

      // 计算指标变化
      if (this.baseline && this.current.metrics) {
        report.metrics.changes = {
          fileCountChange: this.current.metrics.fileCount - this.baseline.metrics.fileCount,
          sizeChange: this.current.metrics.totalSize - this.baseline.metrics.totalSize,
          functionCountChange: this.current.metrics.complexity.functions - this.baseline.metrics.complexity.functions
        };
      }

      // 生成建议
      if (report.summary.alerts > 0) {
        report.recommendations.push('审查所有警告和错误，确保系统稳定性');
      }

      if (report.summary.checkpoints < 3) {
        report.recommendations.push('增加检查点频率，提高重构安全性');
      }

      if (this.checkpoints.length > 0) {
        const lastComparison = this.checkpoints[this.checkpoints.length - 1].comparison;
        if (lastComparison && lastComparison.metrics.criticalChanges > 5) {
          report.recommendations.push('关键文件变更较多，建议进行额外测试');
        }
      }

      // 保存报告
      const reportPath = await this.saveSnapshot('final-report', report);
      await this.log(`报告生成完成: ${reportPath}`);

      return report;
    } catch (error) {
      await this.log(`生成报告失败: ${error.message}`, 'error');
      throw error;
    }
  }

  async printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 CardAll 重构监控报告');
    console.log('='.repeat(80));
    console.log(`🆔 会话ID: ${this.sessionId}`);
    console.log(`📅 开始时间: ${this.startTime}`);
    console.log(`⏰ 运行时长: ${Math.round((Date.now() - new Date(this.startTime).getTime()) / 1000 / 60)} 分钟`);
    console.log(`📊 检查点: ${this.checkpoints.length}`);
    console.log(`🎯 里程碑: ${this.milestones.length}`);
    console.log(`🚨 警告/错误: ${this.alerts.length}`);

    if (this.baseline && this.current.metrics) {
      console.log('\n📈 指标变化:');
      console.log(`  📁 文件数量: ${this.baseline.metrics.fileCount} → ${this.current.metrics.fileCount}`);
      console.log(`  📏 总大小: ${Math.round(this.baseline.metrics.totalSize / 1024)}KB → ${Math.round(this.current.metrics.totalSize / 1024)}KB`);
      console.log(`  🔧 函数数量: ${this.baseline.metrics.complexity.functions} → ${this.current.metrics.complexity.functions}`);
    }

    if (this.checkpoints.length > 0) {
      console.log('\n📍 最近检查点:');
      this.checkpoints.slice(-3).forEach((checkpoint, index) => {
        console.log(`  ${index + 1}. ${checkpoint.name} (${checkpoint.timestamp})`);
      });
    }

    if (this.milestones.length > 0) {
      console.log('\n🎯 里程碑:');
      this.milestones.forEach((milestone, index) => {
        console.log(`  ${index + 1}. ${milestone.type}: ${milestone.description}`);
      });
    }

    if (this.alerts.length > 0) {
      console.log('\n🚨 警告和错误:');
      this.alerts.slice(-5).forEach(alert => {
        const icon = alert.type === 'error' ? '❌' : '⚠️';
        console.log(`  ${icon} ${alert.message}`);
      });
    }

    console.log('='.repeat(80));
  }
}

// 主执行函数
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    const monitor = new RefactorMonitor();

    switch (command) {
      case 'baseline':
        await monitor.createBaseline();
        break;

      case 'checkpoint':
        const name = args[1] || `checkpoint-${Date.now()}`;
        const description = args.slice(2).join(' ') || '';
        await monitor.createCheckpoint(name, description);
        break;

      case 'milestone':
        const type = args[1] || 'custom';
        const desc = args.slice(2).join(' ') || '';
        await monitor.recordMilestone(type, desc);
        break;

      case 'validate':
        await monitor.validateIntegrity();
        break;

      case 'compare':
        await monitor.compareWithBaseline();
        break;

      case 'report':
        await monitor.generateReport();
        await monitor.printSummary();
        break;

      case 'status':
        await monitor.printSummary();
        break;

      case 'monitor':
        // 完整监控流程
        await monitor.createBaseline();
        await monitor.recordMilestone('session_start', '重构监控会话开始');
        await monitor.printSummary();
        console.log('\n📝 提示: 使用以下命令继续监控:');
        console.log('  node refactor-monitor.mjs checkpoint <名称>');
        console.log('  node refactor-monitor.mjs milestone <类型> <描述>');
        console.log('  node refactor-monitor.mjs validate');
        console.log('  node refactor-monitor.mjs report');
        break;

      default:
        console.log('CardAll 重构监控工具');
        console.log('用法: node refactor-monitor.mjs <command> [options]');
        console.log('');
        console.log('可用命令:');
        console.log('  baseline                    - 创建重构基线');
        console.log('  checkpoint <name> [desc]   - 创建检查点');
        console.log('  milestone <type> [desc]    - 记录里程碑');
        console.log('  validate                   - 验证系统完整性');
        console.log('  compare                    - 与基线比较');
        console.log('  report                     - 生成完整报告');
        console.log('  status                     - 显示当前状态');
        console.log('  monitor                    - 开始监控会话');
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

export default RefactorMonitor;