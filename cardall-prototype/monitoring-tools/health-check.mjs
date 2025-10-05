#!/usr/bin/env node

/**
 * CardAll 系统健康检查工具
 * 全面检查应用的各个组件和功能状态
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

class HealthCheckManager {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      checks: {},
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        score: 0
      },
      issues: [],
      recommendations: []
    };
    this.checks = [
      'projectStructure',
      'dependencies',
      'buildSystem',
      'testSystem',
      'codeQuality',
      'security',
      'performance',
      'configuration',
      'documentation'
    ];
  }

  async log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
  }

  async runCheck(checkName, checkFunction) {
    try {
      await this.log(`执行检查: ${checkName}`);
      const startTime = Date.now();

      const result = await checkFunction();

      const duration = Date.now() - startTime;
      this.results.checks[checkName] = {
        ...result,
        duration,
        timestamp: new Date().toISOString()
      };

      await this.log(`检查完成: ${checkName} (${duration}ms) - ${result.status}`);

      return result;
    } catch (error) {
      await this.log(`检查失败: ${checkName} - ${error.message}`, 'error');

      this.results.checks[checkName] = {
        status: 'failed',
        message: error.message,
        duration: 0,
        timestamp: new Date().toISOString()
      };

      return { status: 'failed', message: error.message };
    }
  }

  async checkProjectStructure() {
    const requiredDirs = [
      'src/',
      'src/components/',
      'src/services/',
      'src/contexts/',
      'src/hooks/',
      'src/types/',
      'src/utils/',
      'tests/',
      'public/',
      'supabase/'
    ];

    const requiredFiles = [
      'package.json',
      'vite.config.ts',
      'tsconfig.json',
      'tailwind.config.ts',
      'jest.config.ts',
      'playwright.config.ts',
      '.env',
      'index.html'
    ];

    const issues = [];
    let passed = 0;
    let total = requiredDirs.length + requiredFiles.length;

    // 检查目录
    for (const dir of requiredDirs) {
      try {
        const dirPath = path.join(projectRoot, dir);
        await fs.access(dirPath);
        passed++;
      } catch (error) {
        issues.push(`缺少目录: ${dir}`);
      }
    }

    // 检查文件
    for (const file of requiredFiles) {
      try {
        const filePath = path.join(projectRoot, file);
        await fs.access(filePath);
        passed++;
      } catch (error) {
        issues.push(`缺少文件: ${file}`);
      }
    }

    // 检查关键组件文件
    const criticalComponents = [
      'src/main.tsx',
      'src/App.tsx',
      'src/contexts/cardall-context.tsx',
      'src/services/database-service.ts',
      'src/services/sync-service.ts'
    ];

    for (const component of criticalComponents) {
      try {
        const filePath = path.join(projectRoot, component);
        await fs.access(filePath);
        total++;
        passed++;
      } catch (error) {
        issues.push(`缺少关键组件: ${component}`);
      }
    }

    return {
      status: issues.length === 0 ? 'passed' : 'failed',
      message: issues.length === 0 ? '项目结构完整' : `发现 ${issues.length} 个结构问题`,
      details: {
        checked: total,
        passed,
        issues
      }
    };
  }

  async checkDependencies() {
    try {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

      // 检查关键依赖
      const criticalDeps = [
        'react',
        'react-dom',
        '@supabase/supabase-js',
        'dexie',
        'framer-motion',
        'vite',
        'typescript'
      ];

      const issues = [];
      let passed = 0;

      for (const dep of criticalDeps) {
        if (packageJson.dependencies && packageJson.dependencies[dep]) {
          passed++;
        } else if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
          passed++;
        } else {
          issues.push(`缺少关键依赖: ${dep}`);
        }
      }

      // 检查依赖冲突
      try {
        execSync('npm ls --depth=0', {
          cwd: projectRoot,
          stdio: 'pipe',
          encoding: 'utf8'
        });
      } catch (error) {
        issues.push('依赖检查失败，可能存在版本冲突');
      }

      return {
        status: issues.length === 0 ? 'passed' : 'warning',
        message: issues.length === 0 ? '依赖状态正常' : `发现 ${issues.length} 个依赖问题`,
        details: {
          dependencies: Object.keys(packageJson.dependencies || {}).length,
          devDependencies: Object.keys(packageJson.devDependencies || {}).length,
          issues
        }
      };
    } catch (error) {
      return {
        status: 'failed',
        message: `依赖检查失败: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  async checkBuildSystem() {
    try {
      // 检查Vite配置
      const viteConfigPath = path.join(projectRoot, 'vite.config.ts');
      await fs.access(viteConfigPath);

      // 尝试构建检查（语法验证）
      const buildCheck = execSync('npx vite build --mode development --dryRun', {
        cwd: projectRoot,
        stdio: 'pipe',
        encoding: 'utf8'
      });

      return {
        status: 'passed',
        message: '构建系统正常',
        details: {
          viteConfig: 'exists',
          buildCheck: 'passed'
        }
      };
    } catch (error) {
      return {
        status: 'failed',
        message: `构建系统检查失败: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  async checkTestSystem() {
    const testConfigs = [
      'jest.config.ts',
      'vitest.config.ts',
      'playwright.config.ts'
    ];

    const issues = [];
    let passed = 0;

    for (const config of testConfigs) {
      try {
        const configPath = path.join(projectRoot, config);
        await fs.access(configPath);
        passed++;
      } catch (error) {
        issues.push(`缺少测试配置: ${config}`);
      }
    }

    // 检查测试目录
    const testDirs = ['tests/', 'tests/unit/', 'tests/integration/', 'tests/e2e/'];
    for (const dir of testDirs) {
      try {
        const dirPath = path.join(projectRoot, dir);
        await fs.access(dirPath);
        passed++;
      } catch (error) {
        issues.push(`缺少测试目录: ${dir}`);
      }
    }

    return {
      status: issues.length === 0 ? 'passed' : 'warning',
      message: issues.length === 0 ? '测试系统完整' : `发现 ${issues.length} 个测试配置问题`,
      details: {
        configsFound: passed,
        issues
      }
    };
  }

  async checkCodeQuality() {
    try {
      const issues = [];

      // 检查ESLint配置
      try {
        const eslintConfigPath = path.join(projectRoot, '.eslintrc.json');
        await fs.access(eslintConfigPath);

        // 运行ESLint检查（但不修复）
        const eslintResult = execSync('npx eslint src --ext .ts,.tsx --format=json', {
          cwd: projectRoot,
          stdio: 'pipe',
          encoding: 'utf8'
        });

        const eslintResults = JSON.parse(eslintResult || '[]');
        if (eslintResults.length > 0) {
          const errorCount = eslintResults.reduce((sum, result) => sum + result.errorCount, 0);
          const warningCount = eslintResults.reduce((sum, result) => sum + result.warningCount, 0);

          if (errorCount > 0) {
            issues.push(`ESLint发现 ${errorCount} 个错误`);
          }
          if (warningCount > 0) {
            issues.push(`ESLint发现 ${warningCount} 个警告`);
          }
        }
      } catch (error) {
        issues.push('ESLint配置或执行失败');
      }

      // 检查TypeScript配置
      try {
        const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
        const tsconfig = JSON.parse(await fs.readFile(tsconfigPath, 'utf8'));

        if (!tsconfig.compilerOptions?.strict) {
          issues.push('TypeScript严格模式未启用');
        }
      } catch (error) {
        issues.push('TypeScript配置检查失败');
      }

      return {
        status: issues.length === 0 ? 'passed' : 'warning',
        message: issues.length === 0 ? '代码质量良好' : `发现 ${issues.length} 个代码质量问题`,
        details: { issues }
      };
    } catch (error) {
      return {
        status: 'failed',
        message: `代码质量检查失败: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  async checkSecurity() {
    const issues = [];
    const securityChecks = [];

    // 检查环境变量安全性
    try {
      const envPath = path.join(projectRoot, '.env');
      const envContent = await fs.readFile(envPath, 'utf8');

      if (envContent.includes('password') || envContent.includes('secret')) {
        issues.push('环境变量可能包含敏感信息');
      }

      // 检查是否有硬编码的密钥
      const srcFiles = await this.findFiles('src/', ['.ts', '.tsx', '.js', '.jsx']);
      for (const file of srcFiles) {
        const content = await fs.readFile(file, 'utf8');
        if (content.includes('sk-') || content.includes('AIza')) {
          issues.push(`文件可能包含硬编码密钥: ${path.relative(projectRoot, file)}`);
        }
      }
    } catch (error) {
      issues.push('安全检查部分失败');
    }

    // 检查依赖安全漏洞
    try {
      const auditResult = execSync('npm audit --json', {
        cwd: projectRoot,
        stdio: 'pipe',
        encoding: 'utf8'
      });

      const auditData = JSON.parse(auditResult);
      if (auditData.vulnerabilities && Object.keys(auditData.vulnerabilities).length > 0) {
        const vulnCount = Object.keys(auditData.vulnerabilities).length;
        issues.push(`发现 ${vulnCount} 个安全漏洞`);
      }
    } catch (error) {
      // npm audit 在有漏洞时会返回非零退出码
      try {
        const auditResult = execSync('npm audit --json', {
          cwd: projectRoot,
          stdio: 'pipe',
          encoding: 'utf8'
        });
        const auditData = JSON.parse(auditResult);
        if (auditData.vulnerabilities && Object.keys(auditData.vulnerabilities).length > 0) {
          const vulnCount = Object.keys(auditData.vulnerabilities).length;
          issues.push(`发现 ${vulnCount} 个安全漏洞`);
        }
      } catch (auditError) {
        // 忽略audit错误，继续其他检查
      }
    }

    return {
      status: issues.length === 0 ? 'passed' : 'warning',
      message: issues.length === 0 ? '安全检查通过' : `发现 ${issues.length} 个安全问题`,
      details: { issues }
    };
  }

  async checkPerformance() {
    const issues = [];
    const metrics = {};

    try {
      // 检查包大小
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

      const depCount = Object.keys(packageJson.dependencies || {}).length;
      const devDepCount = Object.keys(packageJson.devDependencies || {}).length;

      metrics.dependencies = depCount;
      metrics.devDependencies = devDepCount;

      if (depCount > 50) {
        issues.push('生产依赖过多，可能影响构建大小');
      }

      // 检查是否有性能配置
      const perfConfigs = ['vite.config.ts', 'webpack.config.js'];
      let hasPerfConfig = false;

      for (const config of perfConfigs) {
        try {
          const configPath = path.join(projectRoot, config);
          await fs.access(configPath);
          hasPerfConfig = true;
        } catch (error) {
          // 配置文件不存在，继续检查下一个
        }
      }

      if (!hasPerfConfig) {
        issues.push('缺少性能优化配置');
      }

      // 检查图片优化配置
      const hasImageOptimization = await this.checkFileContains(
        path.join(projectRoot, 'vite.config.ts'),
        ['image', 'optimize', 'sharp']
      );

      if (!hasImageOptimization) {
        issues.push('缺少图片优化配置');
      }

    } catch (error) {
      issues.push('性能检查失败');
    }

    return {
      status: issues.length === 0 ? 'passed' : 'warning',
      message: issues.length === 0 ? '性能配置良好' : `发现 ${issues.length} 个性能问题`,
      details: { issues, metrics }
    };
  }

  async checkConfiguration() {
    const issues = [];
    const configs = {};

    try {
      // 检查关键配置文件
      const configFiles = [
        { file: '.env', required: true },
        { file: 'vite.config.ts', required: true },
        { file: 'tsconfig.json', required: true },
        { file: 'tailwind.config.ts', required: true },
        { file: 'jest.config.ts', required: false }
      ];

      for (const { file, required } of configFiles) {
        try {
          const filePath = path.join(projectRoot, file);
          const content = await fs.readFile(filePath, 'utf8');
          configs[file] = {
            exists: true,
            size: content.length,
            checksum: createHash('md5').update(content).digest('hex')
          };
        } catch (error) {
          if (required) {
            issues.push(`缺少必需配置: ${file}`);
          } else {
            issues.push(`缺少可选配置: ${file}`);
          }
          configs[file] = { exists: false };
        }
      }

      // 检查Supabase配置
      const envPath = path.join(projectRoot, '.env');
      const envContent = await fs.readFile(envPath, 'utf8');

      const requiredEnvVars = [
        'VITE_SUPABASE_URL',
        'VITE_SUPABASE_ANON_KEY'
      ];

      for (const envVar of requiredEnvVars) {
        if (!envContent.includes(envVar)) {
          issues.push(`缺少环境变量: ${envVar}`);
        }
      }

    } catch (error) {
      issues.push(`配置检查失败: ${error.message}`);
    }

    return {
      status: issues.length === 0 ? 'passed' : 'warning',
      message: issues.length === 0 ? '配置完整' : `发现 ${issues.length} 个配置问题`,
      details: { issues, configs }
    };
  }

  async checkDocumentation() {
    const issues = [];
    const docs = {};

    try {
      // 检查文档文件
      const docFiles = [
        'README.md',
        'CLAUDE.md',
        'CHANGELOG.md',
        'docs/',
        '.github/README.md'
      ];

      for (const doc of docFiles) {
        try {
          const docPath = path.join(projectRoot, doc);
          const stat = await fs.stat(docPath);
          docs[doc] = {
            exists: true,
            size: stat.size,
            modified: stat.mtime.toISOString()
          };
        } catch (error) {
          docs[doc] = { exists: false };
          if (doc === 'README.md') {
            issues.push(`缺少重要文档: ${doc}`);
          }
        }
      }

      // 检查代码文档
      const srcFiles = await this.findFiles('src/', ['.ts', '.tsx']);
      let documentedFiles = 0;

      for (const file of srcFiles.slice(0, 20)) { // 检查前20个文件作为样本
        try {
          const content = await fs.readFile(file, 'utf8');
          if (content.includes('/**') && content.includes('*/')) {
            documentedFiles++;
          }
        } catch (error) {
          // 忽略文件读取错误
        }
      }

      const documentationRatio = (documentedFiles / Math.min(srcFiles.length, 20)) * 100;
      if (documentationRatio < 30) {
        issues.push('代码文档覆盖率较低');
      }

      docs.documentationRatio = documentationRatio;

    } catch (error) {
      issues.push(`文档检查失败: ${error.message}`);
    }

    return {
      status: issues.length === 0 ? 'passed' : 'warning',
      message: issues.length === 0 ? '文档完整' : `发现 ${issues.length} 个文档问题`,
      details: { issues, docs }
    };
  }

  async findFiles(dir, extensions) {
    const files = [];

    async function scanDirectory(currentDir) {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);

          if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          } else if (extensions.some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // 忽略无法访问的目录
      }
    }

    await scanDirectory(path.join(projectRoot, dir));
    return files;
  }

  async checkFileContains(filePath, patterns) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return patterns.some(pattern => content.toLowerCase().includes(pattern.toLowerCase()));
    } catch (error) {
      return false;
    }
  }

  async generateRecommendations() {
    const recommendations = [];

    // 基于检查结果生成建议
    for (const [checkName, result] of Object.entries(this.results.checks)) {
      if (result.status === 'failed' || result.status === 'warning') {
        switch (checkName) {
          case 'dependencies':
            recommendations.push('运行 npm install 确保所有依赖正确安装');
            recommendations.push('考虑使用 npm audit fix 修复安全漏洞');
            break;
          case 'codeQuality':
            recommendations.push('运行 npm run lint 修复代码质量问题');
            recommendations.push('启用TypeScript严格模式提高代码质量');
            break;
          case 'security':
            recommendations.push('定期运行 npm audit 检查安全漏洞');
            recommendations.push('避免在代码中硬编码敏感信息');
            break;
          case 'performance':
            recommendations.push('考虑代码分割和懒加载优化应用性能');
            recommendations.push('配置图片优化减少资源大小');
            break;
          case 'documentation':
            recommendations.push('完善代码文档提高可维护性');
            recommendations.push('更新README文档包含最新功能说明');
            break;
        }
      }
    }

    this.results.recommendations = recommendations;
    return recommendations;
  }

  calculateHealthScore() {
    const checks = Object.values(this.results.checks);
    const totalChecks = checks.length;

    if (totalChecks === 0) return 0;

    let score = 0;
    for (const check of checks) {
      switch (check.status) {
        case 'passed':
          score += 100;
          break;
        case 'warning':
          score += 70;
          break;
        case 'failed':
          score += 0;
          break;
      }
    }

    return Math.round(score / totalChecks);
  }

  async execute() {
    const startTime = Date.now();

    await this.log('开始CardAll系统健康检查');
    await this.log(`检查项目: ${projectRoot}`);

    // 运行所有检查
    for (const checkName of this.checks) {
      const checkFunction = this[`${checkName}Check`];
      if (checkFunction) {
        await this.runCheck(checkName, checkFunction.bind(this));
      }
    }

    // 生成建议
    await this.generateRecommendations();

    // 计算总分
    this.results.summary.score = this.calculateHealthScore();
    this.results.summary.total = this.checks.length;
    this.results.summary.passed = Object.values(this.results.checks).filter(c => c.status === 'passed').length;
    this.results.summary.failed = Object.values(this.results.checks).filter(c => c.status === 'failed').length;
    this.results.summary.warnings = Object.values(this.results.checks).filter(c => c.status === 'warning').length;

    const duration = Date.now() - startTime;
    this.results.duration = duration;

    await this.log(`健康检查完成，耗时: ${(duration / 1000).toFixed(2)} 秒`);
    await this.log(`健康评分: ${this.results.summary.score}/100`);
    await this.log(`通过: ${this.results.summary.passed}, 失败: ${this.results.summary.failed}, 警告: ${this.results.summary.warnings}`);

    return this.results;
  }

  async saveResults(outputPath) {
    try {
      const reportPath = outputPath || path.join(projectRoot, '.backups', `health-check-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

      // 确保输出目录存在
      await fs.mkdir(path.dirname(reportPath), { recursive: true });

      await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
      await this.log(`健康检查报告已保存: ${reportPath}`);

      return reportPath;
    } catch (error) {
      await this.log(`保存报告失败: ${error.message}`, 'error');
      return null;
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('🏥 CardAll 系统健康检查报告');
    console.log('='.repeat(60));
    console.log(`📅 检查时间: ${this.results.timestamp}`);
    console.log(`⏱️  检查耗时: ${(this.results.duration / 1000).toFixed(2)} 秒`);
    console.log(`🎯 健康评分: ${this.results.summary.score}/100`);
    console.log(`✅ 通过检查: ${this.results.summary.passed}`);
    console.log(`⚠️  警告: ${this.results.summary.warnings}`);
    console.log(`❌ 失败: ${this.results.summary.failed}`);

    console.log('\n📋 检查详情:');
    for (const [checkName, result] of Object.entries(this.results.checks)) {
      const status = result.status === 'passed' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      console.log(`  ${status} ${checkName}: ${result.message}`);
    }

    if (this.results.recommendations.length > 0) {
      console.log('\n💡 改进建议:');
      this.results.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    console.log('='.repeat(60));
  }
}

// 主执行函数
async function main() {
  try {
    const healthChecker = new HealthCheckManager();
    const results = await healthChecker.execute();

    // 保存报告
    await healthChecker.saveResults();

    // 打印摘要
    healthChecker.printSummary();

    // 根据健康评分决定退出码
    const score = results.summary.score;
    if (score >= 80) {
      console.log('\n🎉 系统健康状况良好！');
      process.exit(0);
    } else if (score >= 60) {
      console.log('\n⚠️  系统存在一些问题，建议修复');
      process.exit(1);
    } else {
      console.log('\n🚨 系统存在严重问题，需要立即修复');
      process.exit(2);
    }
  } catch (error) {
    console.error('健康检查过程发生错误:', error);
    process.exit(3);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default HealthCheckManager;