#!/usr/bin/env node

/**
 * CardAll 安全扫描工具
 * 在重构前后进行安全扫描，确保代码和配置的安全性
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__dirname);
const projectRoot = path.join(__dirname, '..');

class SecurityScanner {
  constructor() {
    this.scanId = Date.now().toString();
    this.startTime = new Date().toISOString();
    this.results = {
      scanId: this.scanId,
      timestamp: this.startTime,
      checks: {},
      vulnerabilities: [],
      risks: [],
      recommendations: [],
      summary: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        total: 0
      }
    };
    this.config = {
      sensitivePatterns: [
        /password/i,
        /secret/i,
        /token/i,
        /api[_-]?key/i,
        /private[_-]?key/i,
        /auth[_-]?token/i,
        /access[_-]?token/i,
        /sk-[a-zA-Z0-9]+/, // OpenAI API keys
        /AIza[A-Za-z0-9_-]{35}/, // Google API keys
        /ghp_[a-zA-Z0-9]{36}/, // GitHub personal access tokens
        /sbp_[a-zA-Z0-9]{40}/, // Supabase service role keys
      ],
      excludePaths: [
        'node_modules/',
        '.git/',
        'dist/',
        'coverage/',
        'test-results/',
        '.backups/'
      ],
      fileExtensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.env', '.md']
    };
  }

  async log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
  }

  async scanFiles() {
    try {
      await this.log('开始文件安全扫描');

      const files = [];
      const scannedPaths = [];

      async function scanDirectory(dirPath, relativePath = '') {
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const relative = path.join(relativePath, entry.name);

            // 检查排除路径
            if (this.config.excludePatterns.some(pattern => relative.includes(pattern))) {
              continue;
            }

            if (entry.isDirectory()) {
              await scanDirectory.call(this, fullPath, relative);
            } else {
              // 检查文件扩展名
              const ext = path.extname(entry.name);
              if (this.config.fileExtensions.includes(ext)) {
                files.push({
                  path: relative,
                  fullPath,
                  extension: ext,
                  size: (await fs.stat(fullPath)).size
                });
              }
            }
          }
        } catch (error) {
          await this.log(`扫描目录失败 ${dirPath}: ${error.message}`, 'warning');
        }
      }

      await scanDirectory.call(this, projectRoot);

      await this.log(`发现 ${files.length} 个文件需要扫描`);
      return files;
    } catch (error) {
      await this.log(`文件扫描失败: ${error.message}`, 'error');
      return [];
    }
  }

  async checkSensitiveData() {
    try {
      await this.log('检查敏感数据泄露');

      const check = {
        name: 'sensitive_data',
        status: 'running',
        issues: [],
        scanned: 0,
        startTime: new Date().toISOString()
      };

      const files = await this.scanFiles();

      for (const file of files) {
        try {
          const content = await fs.readFile(file.fullPath, 'utf8');
          check.scanned++;

          // 检查敏感模式
          for (const pattern of this.config.sensitivePatterns) {
            const matches = content.match(pattern);
            if (matches) {
              for (const match of matches) {
                // 检查是否在注释中或明显的非敏感上下文中
                const lineIndex = content.split('\n').findIndex(line => line.includes(match));
                const line = content.split('\n')[lineIndex];

                if (!this.isInComment(line) && !this.isInExample(line)) {
                  check.issues.push({
                    type: 'sensitive_data',
                    severity: this.calculateSeverity(match, file.path),
                    file: file.path,
                    line: lineIndex + 1,
                    match: this.maskSensitiveData(match),
                    context: this.extractContext(content, lineIndex)
                  });
                }
              }
            }
          }

          // 特殊检查：硬编码的URL和端点
          const urlMatches = content.match(/https?:\/\/[^\s'"]+/g);
          if (urlMatches) {
            for (const url of urlMatches) {
              if (!this.isKnownSafeUrl(url)) {
                check.issues.push({
                  type: 'hardcoded_url',
                  severity: 'medium',
                  file: file.path,
                  match: url,
                  recommendation: '考虑将URL移到环境变量中'
                });
              }
            }
          }

        } catch (error) {
          await this.log(`读取文件失败 ${file.path}: ${error.message}`, 'warning');
        }
      }

      check.status = check.issues.length === 0 ? 'passed' : 'failed';
      check.endTime = new Date().toISOString();
      check.duration = Date.now() - new Date(check.startTime).getTime();

      this.results.checks.sensitive_data = check;
      await this.log(`敏感数据检查完成，发现 ${check.issues.length} 个问题`);

      return check;
    } catch (error) {
      await this.log(`敏感数据检查失败: ${error.message}`, 'error');
      return {
        name: 'sensitive_data',
        status: 'error',
        error: error.message
      };
    }
  }

  isInComment(line) {
    return line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('/*');
  }

  isInExample(line) {
    return line.includes('example') || line.includes('Example') || line.includes('sample') || line.includes('Sample');
  }

  isKnownSafeUrl(url) {
    const safeUrls = [
      'localhost',
      '127.0.0.1',
      'supabase.co',
      'npmjs.com',
      'github.com',
      'fonts.googleapis.com',
      'fonts.gstatic.com'
    ];

    return safeUrls.some(safe => url.includes(safe));
  }

  calculateSeverity(match, filePath) {
    // 根据匹配内容和文件路径确定严重程度
    if (match.includes('password') || match.includes('secret')) {
      return 'critical';
    } else if (match.includes('key') || match.includes('token')) {
      return filePath.includes('env') ? 'high' : 'medium';
    } else {
      return 'low';
    }
  }

  maskSensitiveData(match) {
    if (match.length <= 8) {
      return '*'.repeat(match.length);
    }
    return match.substring(0, 4) + '*'.repeat(match.length - 8) + match.substring(match.length - 4);
  }

  extractContext(content, lineIndex, contextLines = 2) {
    const lines = content.split('\n');
    const start = Math.max(0, lineIndex - contextLines);
    const end = Math.min(lines.length, lineIndex + contextLines + 1);
    return lines.slice(start, end).join('\n');
  }

  async checkDependencies() {
    try {
      await this.log('检查依赖安全性');

      const check = {
        name: 'dependencies',
        status: 'running',
        vulnerabilities: [],
        startTime: new Date().toISOString()
      };

      try {
        // 运行npm audit
        const auditResult = execSync('npm audit --json', {
          cwd: projectRoot,
          stdio: 'pipe',
          encoding: 'utf8'
        });

        const auditData = JSON.parse(auditResult);

        if (auditData.vulnerabilities) {
          for (const [packageName, vuln] of Object.entries(auditData.vulnerabilities)) {
            check.vulnerabilities.push({
              package: packageName,
              severity: vuln.severity,
              title: vuln.title,
              url: vuln.url,
              fixAvailable: vuln.fixAvailable
            });
          }
        }

        check.status = check.vulnerabilities.length === 0 ? 'passed' : 'warning';
      } catch (error) {
        // npm audit 在有漏洞时返回非零退出码
        try {
          const auditResult = execSync('npm audit --json', {
            cwd: projectRoot,
            stdio: 'pipe',
            encoding: 'utf8'
          });

          const auditData = JSON.parse(auditResult);

          if (auditData.vulnerabilities) {
            for (const [packageName, vuln] of Object.entries(auditData.vulnerabilities)) {
              check.vulnerabilities.push({
                package: packageName,
                severity: vuln.severity,
                title: vuln.title,
                url: vuln.url,
                fixAvailable: vuln.fixAvailable
              });
            }
          }

          check.status = check.vulnerabilities.length === 0 ? 'passed' : 'warning';
        } catch (auditError) {
          check.status = 'error';
          check.error = auditError.message;
        }
      }

      check.endTime = new Date().toISOString();
      check.duration = Date.now() - new Date(check.startTime).getTime();

      this.results.checks.dependencies = check;
      await this.log(`依赖安全检查完成，发现 ${check.vulnerabilities.length} 个漏洞`);

      return check;
    } catch (error) {
      await this.log(`依赖安全检查失败: ${error.message}`, 'error');
      return {
        name: 'dependencies',
        status: 'error',
        error: error.message
      };
    }
  }

  async checkCodeQuality() {
    try {
      await this.log('检查代码质量和安全最佳实践');

      const check = {
        name: 'code_quality',
        status: 'running',
        issues: [],
        scanned: 0,
        startTime: new Date().toISOString()
      };

      const files = await this.scanFiles();

      for (const file of files) {
        if (!['.ts', '.tsx', '.js', '.jsx'].includes(file.extension)) {
          continue;
        }

        try {
          const content = await fs.readFile(file.fullPath, 'utf8');
          check.scanned++;

          // 检查eval()使用
          if (content.includes('eval(')) {
            check.issues.push({
              type: 'dangerous_function',
              severity: 'high',
              file: file.path,
              function: 'eval',
              recommendation: '避免使用eval()函数'
            });
          }

          // 检查innerHTML使用
          if (content.includes('innerHTML')) {
            check.issues.push({
              type: 'xss_risk',
              severity: 'medium',
              file: file.path,
              function: 'innerHTML',
              recommendation: '使用textContent或安全的DOM操作方法'
            });
          }

          // 检查debugger语句
          if (content.includes('debugger')) {
            check.issues.push({
              type: 'debug_code',
              severity: 'low',
              file: file.path,
              function: 'debugger',
              recommendation: '移除生产代码中的debugger语句'
            });
          }

          // 检查console.log
          const consoleMatches = content.match(/console\.(log|error|warn|info)/g);
          if (consoleMatches && consoleMatches.length > 5) {
            check.issues.push({
              type: 'excessive_logging',
              severity: 'low',
              file: file.path,
              count: consoleMatches.length,
              recommendation: '减少生产代码中的日志输出'
            });
          }

        } catch (error) {
          await this.log(`分析文件失败 ${file.path}: ${error.message}`, 'warning');
        }
      }

      check.status = check.issues.length === 0 ? 'passed' : 'warning';
      check.endTime = new Date().toISOString();
      check.duration = Date.now() - new Date(check.startTime).getTime();

      this.results.checks.code_quality = check;
      await this.log(`代码质量检查完成，发现 ${check.issues.length} 个问题`);

      return check;
    } catch (error) {
      await this.log(`代码质量检查失败: ${error.message}`, 'error');
      return {
        name: 'code_quality',
        status: 'error',
        error: error.message
      };
    }
  }

  async checkConfiguration() {
    try {
      await this.log('检查配置安全性');

      const check = {
        name: 'configuration',
        status: 'running',
        issues: [],
        startTime: new Date().toISOString()
      };

      // 检查环境配置
      try {
        const envPath = path.join(projectRoot, '.env');
        const envContent = await fs.readFile(envPath, 'utf8');

        // 检查是否有生产环境配置
        if (envContent.includes('production') || envContent.includes('prod')) {
          check.issues.push({
            type: 'production_config',
            severity: 'medium',
            file: '.env',
            recommendation: '确保生产环境配置安全'
          });
        }

        // 检查是否使用了默认密钥
        if (envContent.includes('your-secret-key') || envContent.includes('change-me')) {
          check.issues.push({
            type: 'default_credentials',
            severity: 'high',
            file: '.env',
            recommendation: '更改默认密钥和凭据'
          });
        }

      } catch (error) {
        check.issues.push({
          type: 'missing_env',
          severity: 'warning',
          message: '无法读取.env文件',
          recommendation: '确保环境配置文件存在且可读'
        });
      }

      // 检查构建配置
      const configFiles = ['vite.config.ts', 'webpack.config.js', 'rollup.config.js'];
      for (const configFile of configFiles) {
        try {
          const configPath = path.join(projectRoot, configFile);
          const configContent = await fs.readFile(configPath, 'utf8');

          // 检查是否暴露了敏感信息
          if (configContent.includes('process.env') && !configContent.includes('VITE_')) {
            check.issues.push({
              type: 'config_exposure',
              severity: 'medium',
              file: configFile,
              recommendation: '确保只暴露必要的环境变量'
            });
          }

        } catch (error) {
          // 配置文件可能不存在，这是正常的
        }
      }

      check.status = check.issues.length === 0 ? 'passed' : 'warning';
      check.endTime = new Date().toISOString();
      check.duration = Date.now() - new Date(check.startTime).getTime();

      this.results.checks.configuration = check;
      await this.log(`配置安全检查完成，发现 ${check.issues.length} 个问题`);

      return check;
    } catch (error) {
      await this.log(`配置安全检查失败: ${error.message}`, 'error');
      return {
        name: 'configuration',
        status: 'error',
        error: error.message
      };
    }
  }

  async checkPermissions() {
    try {
      await this.log('检查文件权限');

      const check = {
        name: 'permissions',
        status: 'running',
        issues: [],
        startTime: new Date().toISOString()
      };

      // 检查关键文件的权限
      const criticalFiles = [
        '.env',
        'package.json',
        'src/**/*.ts',
        'src/**/*.tsx'
      ];

      for (const pattern of criticalFiles) {
        try {
          if (pattern.includes('*')) {
            // 处理通配符
            const files = await this.scanFiles();
            const matchingFiles = files.filter(file => {
              const regex = new RegExp(pattern.replace('*', '.*'));
              return regex.test(file.path);
            });

            for (const file of matchingFiles) {
              await this.checkFilePermissions(file.fullPath, check);
            }
          } else {
            await this.checkFilePermissions(path.join(projectRoot, pattern), check);
          }
        } catch (error) {
          await this.log(`检查权限失败 ${pattern}: ${error.message}`, 'warning');
        }
      }

      check.status = check.issues.length === 0 ? 'passed' : 'warning';
      check.endTime = new Date().toISOString();
      check.duration = Date.now() - new Date(check.startTime).getTime();

      this.results.checks.permissions = check;
      await this.log(`权限检查完成，发现 ${check.issues.length} 个问题`);

      return check;
    } catch (error) {
      await this.log(`权限检查失败: ${error.message}`, 'error');
      return {
        name: 'permissions',
        status: 'error',
        error: error.message
      };
    }
  }

  async checkFilePermissions(filePath, check) {
    try {
      const stats = await fs.stat(filePath);
      const mode = stats.mode;

      // 检查是否对其他用户可写
      if (mode & 0o002) {
        check.issues.push({
          type: 'excessive_permissions',
          severity: 'medium',
          file: path.relative(projectRoot, filePath),
          permission: mode.toString(8),
          recommendation: '限制文件权限，避免其他用户写入'
        });
      }

      // 检查是否为可执行文件（对于非脚本文件）
      const ext = path.extname(filePath);
      if (!['.sh', '.bat', '.mjs', '.js'].includes(ext) && (mode & 0o111)) {
        check.issues.push({
          type: 'unnecessary_executable',
          severity: 'low',
          file: path.relative(projectRoot, filePath),
          permission: mode.toString(8),
          recommendation: '移除不必要的可执行权限'
        });
      }
    } catch (error) {
      await this.log(`检查文件权限失败 ${filePath}: ${error.message}`, 'warning');
    }
  }

  calculateSeverityLevel(severity) {
    switch (severity) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  generateRecommendations() {
    const recommendations = [];

    // 基于检查结果生成建议
    Object.values(this.results.checks).forEach(check => {
      if (check.issues) {
        check.issues.forEach(issue => {
          if (issue.recommendation && !recommendations.includes(issue.recommendation)) {
            recommendations.push(issue.recommendation);
          }
        });
      }
    });

    // 通用建议
    if (this.results.summary.critical > 0) {
      recommendations.unshift('立即修复所有严重安全漏洞');
    }

    if (this.results.summary.high > 0) {
      recommendations.unshift('尽快修复高风险安全问题');
    }

    if (recommendations.length === 0) {
      recommendations.push('继续遵循安全最佳实践');
    }

    this.results.recommendations = recommendations;
    return recommendations;
  }

  async executeScan() {
    try {
      await this.log('开始安全扫描');

      // 执行所有检查
      await this.checkSensitiveData();
      await this.checkDependencies();
      await this.checkCodeQuality();
      await this.checkConfiguration();
      await this.checkPermissions();

      // 汇总结果
      for (const check of Object.values(this.results.checks)) {
        if (check.issues) {
          check.issues.forEach(issue => {
            const severity = this.calculateSeverityLevel(issue.severity);
            switch (severity) {
              case 4: this.results.summary.critical++; break;
              case 3: this.results.summary.high++; break;
              case 2: this.results.summary.medium++; break;
              case 1: this.results.summary.low++; break;
            }
            this.results.summary.total++;
          });
        }

        if (check.vulnerabilities) {
          check.vulnerabilities.forEach(vuln => {
            const severity = this.calculateSeverityLevel(vuln.severity);
            switch (severity) {
              case 4: this.results.summary.critical++; break;
              case 3: this.results.summary.high++; break;
              case 2: this.results.summary.medium++; break;
              case 1: this.results.summary.low++; break;
            }
            this.results.summary.total++;
          });
        }
      }

      // 生成建议
      this.generateRecommendations();

      // 计算总体评分
      const maxScore = 100;
      const criticalDeduction = this.results.summary.critical * 25;
      const highDeduction = this.results.summary.high * 15;
      const mediumDeduction = this.results.summary.medium * 8;
      const lowDeduction = this.results.summary.low * 3;

      this.results.securityScore = Math.max(0, maxScore - criticalDeduction - highDeduction - mediumDeduction - lowDeduction);

      await this.log(`安全扫描完成，评分: ${this.results.securityScore}/100`);
      await this.log(`发现问题: ${this.results.summary.total} (严重: ${this.results.summary.critical}, 高: ${this.results.summary.high}, 中: ${this.results.summary.medium}, 低: ${this.results.summary.low})`);

      return this.results;
    } catch (error) {
      await this.log(`安全扫描失败: ${error.message}`, 'error');
      throw error;
    }
  }

  async saveReport() {
    try {
      const reportDir = path.join(projectRoot, '.backups', 'security-reports');
      await fs.mkdir(reportDir, { recursive: true });

      const reportPath = path.join(reportDir, `security-scan-${this.scanId}.json`);
      await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));

      await this.log(`安全报告已保存: ${reportPath}`);
      return reportPath;
    } catch (error) {
      await this.log(`保存报告失败: ${error.message}`, 'error');
      return null;
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('🔒 CardAll 安全扫描报告');
    console.log('='.repeat(80));
    console.log(`🆔 扫描ID: ${this.scanId}`);
    console.log(`📅 扫描时间: ${this.startTime}`);
    console.log(`🎯 安全评分: ${this.results.securityScore}/100`);
    console.log(`📊 问题总数: ${this.results.summary.total}`);
    console.log(`  🚨 严重: ${this.results.summary.critical}`);
    console.log(`  ⚠️  高风险: ${this.results.summary.high}`);
    console.log(`  ⚡ 中风险: ${this.results.summary.medium}`);
    console.log(`  💡 低风险: ${this.results.summary.low}`);

    console.log('\n📋 检查结果:');
    for (const [checkName, check] of Object.entries(this.results.checks)) {
      const status = check.status === 'passed' ? '✅' : check.status === 'warning' ? '⚠️' : check.status === 'failed' ? '❌' : '❓';
      const issues = check.issues?.length || check.vulnerabilities?.length || 0;
      console.log(`  ${status} ${checkName}: ${issues} 个问题`);
    }

    if (this.results.recommendations.length > 0) {
      console.log('\n💡 安全建议:');
      this.results.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    if (this.results.summary.total > 0) {
      console.log('\n⚠️  注意事项:');
      if (this.results.summary.critical > 0) {
        console.log('  🚨 发现严重安全问题，需要立即处理');
      }
      if (this.results.summary.high > 0) {
        console.log('  🔴 发现高风险问题，建议优先处理');
      }
      console.log('  📋 详细信息请查看完整报告');
    } else {
      console.log('\n🎉 恭喜！未发现明显安全问题');
    }

    console.log('='.repeat(80));
  }
}

// 主执行函数
async function main() {
  try {
    const scanner = new SecurityScanner();
    const results = await scanner.executeScan();

    // 保存报告
    await scanner.saveReport();

    // 打印摘要
    scanner.printSummary();

    // 根据安全评分决定退出码
    if (results.summary.critical > 0) {
      console.log('\n🚨 发现严重安全问题，需要立即修复！');
      process.exit(3);
    } else if (results.summary.high > 0) {
      console.log('\n⚠️  发现高风险安全问题，建议尽快修复');
      process.exit(2);
    } else if (results.summary.medium > 0) {
      console.log('\n💡 发现一些安全问题，建议在适当时机修复');
      process.exit(1);
    } else {
      console.log('\n✅ 安全扫描通过，未发现严重问题');
      process.exit(0);
    }
  } catch (error) {
    console.error('安全扫描失败:', error.message);
    process.exit(4);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default SecurityScanner;