#!/usr/bin/env node

/**
 * CardAll 同步服务监控工具
 * 实时监控云端同步服务的状态和性能
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Supabase配置
const supabaseUrl = 'https://elwnpejlwkgdacaugvvd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsd25wZWpsd2tnZGFjYXVndnZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMzkxNTAsImV4cCI6MjA2ODkxNTE1MH0.XhVGgO2nf8uS1gC0V6jTMP0p0xN5KKV47t2rK2ncK90';

class SyncMonitor {
  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.metrics = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      connectivity: {
        status: 'unknown',
        latency: 0,
        lastCheck: null
      },
      database: {
        status: 'unknown',
        tables: {},
        totalRecords: 0,
        lastSync: null
      },
      performance: {
        queryTimes: [],
        errorRate: 0,
        totalQueries: 0,
        errors: 0
      },
      alerts: [],
      summary: {
        status: 'unknown',
        score: 0,
        issues: 0
      }
    };
    this.thresholds = {
      maxLatency: 1000, // 1秒
      maxErrorRate: 0.05, // 5%
      maxQueryTime: 5000 // 5秒
    };
  }

  async log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
  }

  async measureQueryTime(queryFunction, queryName) {
    const startTime = Date.now();
    try {
      const result = await queryFunction();
      const duration = Date.now() - startTime;

      this.metrics.performance.queryTimes.push({
        name: queryName,
        duration,
        timestamp: new Date().toISOString(),
        success: true
      });

      this.metrics.performance.totalQueries++;

      return { result, duration };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.metrics.performance.queryTimes.push({
        name: queryName,
        duration,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });

      this.metrics.performance.totalQueries++;
      this.metrics.performance.errors++;

      throw error;
    }
  }

  async checkConnectivity() {
    try {
      await this.log('检查Supabase连接...');

      const { result, duration } = await this.measureQueryTime(
        () => this.supabase.from('_').select('*').limit(1),
        'connectivity_test'
      );

      this.metrics.connectivity = {
        status: 'connected',
        latency: duration,
        lastCheck: new Date().toISOString()
      };

      await this.log(`连接成功，延迟: ${duration}ms`);

      if (duration > this.thresholds.maxLatency) {
        this.addAlert('high_latency', `连接延迟过高: ${duration}ms`, 'warning');
      }

      return true;
    } catch (error) {
      this.metrics.connectivity = {
        status: 'disconnected',
        latency: 0,
        lastCheck: new Date().toISOString(),
        error: error.message
      };

      this.addAlert('connection_failed', `连接失败: ${error.message}`, 'error');
      await this.log(`连接失败: ${error.message}`, 'error');
      return false;
    }
  }

  async checkDatabaseStatus() {
    try {
      await this.log('检查数据库状态...');

      // 检查主要表的存在性和数据量
      const tables = ['cards', 'folders', 'tags', 'images', 'users'];
      let totalRecords = 0;

      for (const tableName of tables) {
        try {
          const { result, duration } = await this.measureQueryTime(
            () => this.supabase.from(tableName).select('count', { count: 'exact', head: true }),
            `table_count_${tableName}`
          );

          const count = result.count || 0;
          totalRecords += count;

          this.metrics.database.tables[tableName] = {
            status: 'available',
            recordCount: count,
            lastCheck: new Date().toISOString(),
            queryTime: duration
          };

          await this.log(`表 ${tableName}: ${count} 条记录 (${duration}ms)`);

          if (duration > this.thresholds.maxQueryTime) {
            this.addAlert('slow_query', `表 ${tableName} 查询缓慢: ${duration}ms`, 'warning');
          }

        } catch (error) {
          this.metrics.database.tables[tableName] = {
            status: 'error',
            error: error.message,
            lastCheck: new Date().toISOString()
          };

          this.addAlert('table_error', `表 ${tableName} 访问失败: ${error.message}`, 'error');
          await this.log(`表 ${tableName} 检查失败: ${error.message}`, 'error');
        }
      }

      this.metrics.database.totalRecords = totalRecords;
      this.metrics.database.lastSync = new Date().toISOString();

      // 检查最近的数据活动
      await this.checkRecentActivity();

      await this.log(`数据库状态检查完成，总记录数: ${totalRecords}`);
      return true;
    } catch (error) {
      this.addAlert('database_check_failed', `数据库状态检查失败: ${error.message}`, 'error');
      await this.log(`数据库状态检查失败: ${error.message}`, 'error');
      return false;
    }
  }

  async checkRecentActivity() {
    try {
      // 检查最近24小时的活动
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { result: cardsActivity } = await this.measureQueryTime(
        () => this.supabase
          .from('cards')
          .select('id, updated_at')
          .gte('updated_at', oneDayAgo)
          .limit(10),
        'recent_cards_activity'
      );

      const { result: foldersActivity } = await this.measureQueryTime(
        () => this.supabase
          .from('folders')
          .select('id, updated_at')
          .gte('updated_at', oneDayAgo)
          .limit(10),
        'recent_folders_activity'
      );

      this.metrics.database.recentActivity = {
        cardsUpdated: cardsActivity?.length || 0,
        foldersUpdated: foldersActivity?.length || 0,
        checkTime: new Date().toISOString()
      };

      await this.log(`最近24小时活动: ${cardsActivity?.length || 0} 个卡片, ${foldersActivity?.length || 0} 个文件夹更新`);

    } catch (error) {
      await this.log(`检查最近活动失败: ${error.message}`, 'warning');
    }
  }

  async checkSyncIntegrity() {
    try {
      await this.log('检查同步完整性...');

      // 检查数据一致性
      const integrityChecks = [];

      // 检查卡片和文件夹的关联
      const { result: orphanedCards } = await this.measureQueryTime(
        () => this.supabase
          .from('cards')
          .select('id, folder_id')
          .is('folder_id', null)
          .limit(10),
        'orphaned_cards_check'
      );

      if (orphanedCards && orphanedCards.length > 0) {
        integrityChecks.push({
          type: 'orphaned_cards',
          count: orphanedCards.length,
          severity: 'warning'
        });
        this.addAlert('orphaned_cards', `发现 ${orphanedCards.length} 个孤立卡片`, 'warning');
      }

      // 检查重复数据
      const { result: duplicateCards } = await this.measureQueryTime(
        () => this.supabase
          .from('cards')
          .select('title')
          .group('title')
          .having('count(*) > 1')
          .limit(5),
        'duplicate_cards_check'
      );

      if (duplicateCards && duplicateCards.length > 0) {
        integrityChecks.push({
          type: 'duplicate_cards',
          count: duplicateCards.length,
          severity: 'warning'
        });
        this.addAlert('duplicate_cards', `发现 ${duplicateCards.length} 组重复卡片`, 'warning');
      }

      this.metrics.database.integrity = {
        checks: integrityChecks,
        lastCheck: new Date().toISOString(),
        status: integrityChecks.length === 0 ? 'passed' : 'warning'
      };

      await this.log(`同步完整性检查完成，发现 ${integrityChecks.length} 个问题`);
      return integrityChecks.length === 0;
    } catch (error) {
      this.addAlert('integrity_check_failed', `同步完整性检查失败: ${error.message}`, 'error');
      await this.log(`同步完整性检查失败: ${error.message}`, 'error');
      return false;
    }
  }

  async checkPerformanceMetrics() {
    try {
      await this.log('分析性能指标...');

      const queryTimes = this.metrics.performance.queryTimes;

      if (queryTimes.length === 0) {
        await this.log('没有性能数据可供分析');
        return;
      }

      // 计算统计数据
      const successfulQueries = queryTimes.filter(q => q.success);
      const failedQueries = queryTimes.filter(q => !q.success);

      const durations = successfulQueries.map(q => q.duration);
      const avgQueryTime = durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : 0;

      const maxQueryTime = durations.length > 0 ? Math.max(...durations) : 0;
      const errorRate = queryTimes.length > 0 ? failedQueries.length / queryTimes.length : 0;

      this.metrics.performance.summary = {
        totalQueries: queryTimes.length,
        successfulQueries: successfulQueries.length,
        failedQueries: failedQueries.length,
        averageQueryTime: Math.round(avgQueryTime),
        maxQueryTime,
        errorRate: Math.round(errorRate * 100) / 100
      };

      await this.log(`性能分析: 平均查询时间 ${avgQueryTime.toFixed(2)}ms, 错误率 ${(errorRate * 100).toFixed(2)}%`);

      // 检查性能阈值
      if (avgQueryTime > this.thresholds.maxQueryTime) {
        this.addAlert('slow_performance', `平均查询时间过长: ${avgQueryTime.toFixed(2)}ms`, 'warning');
      }

      if (errorRate > this.thresholds.maxErrorRate) {
        this.addAlert('high_error_rate', `错误率过高: ${(errorRate * 100).toFixed(2)}%`, 'error');
      }

      return {
        averageQueryTime,
        maxQueryTime,
        errorRate
      };
    } catch (error) {
      this.addAlert('performance_analysis_failed', `性能分析失败: ${error.message}`, 'error');
      await this.log(`性能分析失败: ${error.message}`, 'error');
      return null;
    }
  }

  addAlert(type, message, severity = 'info') {
    this.metrics.alerts.push({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type,
      message,
      severity,
      timestamp: new Date().toISOString()
    });

    // 限制警告数量
    if (this.metrics.alerts.length > 50) {
      this.metrics.alerts = this.metrics.alerts.slice(-50);
    }
  }

  calculateOverallScore() {
    let score = 100;

    // 连接性评分 (30%)
    if (this.metrics.connectivity.status === 'disconnected') {
      score -= 30;
    } else if (this.metrics.connectivity.latency > this.thresholds.maxLatency) {
      score -= 15;
    }

    // 数据库状态评分 (40%)
    const tableCount = Object.keys(this.metrics.database.tables).length;
    const availableTables = Object.values(this.metrics.database.tables)
      .filter(table => table.status === 'available').length;

    if (tableCount > 0) {
      const databaseScore = (availableTables / tableCount) * 40;
      score -= (40 - databaseScore);
    }

    // 性能评分 (20%)
    const errorRate = this.metrics.performance.summary?.errorRate || 0;
    if (errorRate > this.thresholds.maxErrorRate) {
      score -= 20;
    } else {
      score -= errorRate * 100; // 错误率转换为分数
    }

    // 警告扣分 (10%)
    const criticalAlerts = this.metrics.alerts.filter(alert => alert.severity === 'error').length;
    const warningAlerts = this.metrics.alerts.filter(alert => alert.severity === 'warning').length;

    score -= criticalAlerts * 10;
    score -= warningAlerts * 5;

    return Math.max(0, Math.round(score));
  }

  async generateReport() {
    const score = this.calculateOverallScore();

    this.metrics.summary = {
      status: score >= 80 ? 'healthy' : score >= 60 ? 'warning' : 'critical',
      score,
      issues: this.metrics.alerts.filter(alert => alert.severity === 'error').length,
      warnings: this.metrics.alerts.filter(alert => alert.severity === 'warning').length,
      lastCheck: new Date().toISOString()
    };

    // 生成建议
    this.metrics.recommendations = this.generateRecommendations();

    return this.metrics;
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.metrics.connectivity.status === 'disconnected') {
      recommendations.push('检查网络连接和Supabase配置');
    } else if (this.metrics.connectivity.latency > this.thresholds.maxLatency) {
      recommendations.push('优化网络连接或考虑使用CDN');
    }

    const errorRate = this.metrics.performance.summary?.errorRate || 0;
    if (errorRate > this.thresholds.maxErrorRate) {
      recommendations.push('检查查询逻辑和数据库索引优化');
    }

    const avgQueryTime = this.metrics.performance.summary?.averageQueryTime || 0;
    if (avgQueryTime > this.thresholds.maxQueryTime) {
      recommendations.push('优化数据库查询和添加必要的索引');
    }

    if (this.metrics.alerts.some(alert => alert.type.includes('integrity'))) {
      recommendations.push('运行数据完整性检查和修复');
    }

    if (this.metrics.database.totalRecords === 0) {
      recommendations.push('检查数据库是否包含数据，或是否为新部署');
    }

    return recommendations;
  }

  async execute() {
    const startTime = Date.now();

    await this.log('开始CardAll同步服务监控');
    await this.log(`监控目标: ${supabaseUrl}`);

    try {
      // 执行各项检查
      await this.checkConnectivity();
      await this.checkDatabaseStatus();
      await this.checkSyncIntegrity();
      await this.checkPerformanceMetrics();

      // 生成报告
      await this.generateReport();

      const duration = Date.now() - startTime;
      this.metrics.duration = duration;

      await this.log(`监控完成，耗时: ${(duration / 1000).toFixed(2)} 秒`);
      await this.log(`综合评分: ${this.metrics.summary.score}/100 (${this.metrics.summary.status})`);

      return this.metrics;
    } catch (error) {
      await this.log(`监控过程发生错误: ${error.message}`, 'error');
      this.addAlert('monitoring_failed', `监控失败: ${error.message}`, 'error');
      throw error;
    }
  }

  async saveReport(outputPath) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const defaultPath = path.join(projectRoot, '.backups', `sync-monitor-${timestamp}.json`);
      const reportPath = outputPath || defaultPath;

      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(this.metrics, null, 2));

      await this.log(`监控报告已保存: ${reportPath}`);
      return reportPath;
    } catch (error) {
      await this.log(`保存报告失败: ${error.message}`, 'error');
      return null;
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('🔄 CardAll 同步服务监控报告');
    console.log('='.repeat(60));
    console.log(`📅 监控时间: ${this.metrics.timestamp}`);
    console.log(`🎯 综合评分: ${this.metrics.summary.score}/100`);
    console.log(`📊 状态: ${this.metrics.summary.status.toUpperCase()}`);
    console.log(`⏱️  耗时: ${(this.metrics.duration / 1000).toFixed(2)} 秒`);

    console.log('\n🔗 连接状态:');
    const connectivity = this.metrics.connectivity;
    const statusIcon = connectivity.status === 'connected' ? '✅' : '❌';
    console.log(`  ${statusIcon} 状态: ${connectivity.status}`);
    if (connectivity.status === 'connected') {
      console.log(`  📶 延迟: ${connectivity.latency}ms`);
    }

    console.log('\n💾 数据库状态:');
    const db = this.metrics.database;
    console.log(`  📊 总记录数: ${db.totalRecords}`);
    console.log(`  📋 表数量: ${Object.keys(db.tables).length}`);

    for (const [tableName, tableInfo] of Object.entries(db.tables)) {
      const icon = tableInfo.status === 'available' ? '✅' : '❌';
      console.log(`  ${icon} ${tableName}: ${tableInfo.recordCount || 0} 条记录`);
    }

    if (this.metrics.performance.summary) {
      console.log('\n⚡ 性能指标:');
      const perf = this.metrics.performance.summary;
      console.log(`  📈 总查询数: ${perf.totalQueries}`);
      console.log(`  ✅ 成功查询: ${perf.successfulQueries}`);
      console.log(`  ❌ 失败查询: ${perf.failedQueries}`);
      console.log(`  ⏱️  平均查询时间: ${perf.averageQueryTime}ms`);
      console.log(`  📊 错误率: ${(perf.errorRate * 100).toFixed(2)}%`);
    }

    if (this.metrics.alerts.length > 0) {
      console.log('\n🚨 警告和错误:');
      this.metrics.alerts.slice(-5).forEach(alert => {
        const icon = alert.severity === 'error' ? '❌' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`  ${icon} ${alert.message}`);
      });
    }

    if (this.metrics.recommendations && this.metrics.recommendations.length > 0) {
      console.log('\n💡 改进建议:');
      this.metrics.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    console.log('='.repeat(60));
  }
}

// 主执行函数
async function main() {
  try {
    const monitor = new SyncMonitor();
    const results = await monitor.execute();

    // 保存报告
    await monitor.saveReport();

    // 打印摘要
    monitor.printSummary();

    // 根据监控结果决定退出码
    const score = results.summary.score;
    const criticalIssues = results.alerts.filter(alert => alert.severity === 'error').length;

    if (score >= 80 && criticalIssues === 0) {
      console.log('\n🎉 同步服务运行正常！');
      process.exit(0);
    } else if (score >= 60 && criticalIssues === 0) {
      console.log('\n⚠️  同步服务存在一些性能问题');
      process.exit(1);
    } else {
      console.log('\n🚨 同步服务存在严重问题，需要立即处理');
      process.exit(2);
    }
  } catch (error) {
    console.error('同步监控过程发生错误:', error);
    process.exit(3);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default SyncMonitor;