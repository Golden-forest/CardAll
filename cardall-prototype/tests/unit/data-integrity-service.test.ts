import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DataIntegrityService } from '../../src/services/data-integrity-service';
import type {
  ValidationResult,
  IntegrityCheck,
  DataRepair,
  IntegrityConfig
} from '../../src/services/data-integrity-service';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};

global.localStorage = mockLocalStorage as any;

describe('DataIntegrityService', () => {
  let integrityService: DataIntegrityService;
  let mockStorageAdapter: any;
  let mockConfig: IntegrityConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStorageAdapter = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      getKeys: vi.fn(),
      getSize: vi.fn(),
      backup: vi.fn(),
      restore: vi.fn(),
      validateData: vi.fn()
    };

    mockConfig = {
      autoCheck: true,
      checkInterval: 300000, // 5分钟
      strictMode: false,
      enableRepair: true,
      backupBeforeRepair: true,
      maxRepairAttempts: 3,
      checksumValidation: true,
      schemaValidation: true,
      repairStrategies: {
        missingData: 'restore',
        corruptData: 'delete',
        schemaMismatch: 'migrate',
        checksumMismatch: 'recalculate'
      }
    };

    integrityService = new DataIntegrityService(mockStorageAdapter, mockConfig);
  });

  afterEach(() => {
    integrityService.stopAutoCheck();
  });

  describe('初始化', () => {
    it('应该正确初始化数据完整性服务', () => {
      expect(integrityService).toBeInstanceOf(DataIntegrityService);
      expect(integrityService.isAutoCheckEnabled()).toBe(true);
    });

    it('应该使用默认配置创建实例', () => {
      const service = new DataIntegrityService(mockStorageAdapter);
      expect(service).toBeInstanceOf(DataIntegrityService);
    });
  });

  describe('数据验证', () => {
    it('应该验证单个数据项的完整性', async () => {
      const testData = {
        id: 'test-1',
        content: 'test content',
        checksum: 'abc123',
        timestamp: Date.now()
      };

      mockStorageAdapter.get.mockResolvedValue(testData);

      const result = await integrityService.validateData('test-1');

      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
      expect(result.key).toBe('test-1');
      expect(mockStorageAdapter.get).toHaveBeenCalledWith('test-1');
    });

    it('应该检测缺失的数据', async () => {
      mockStorageAdapter.get.mockResolvedValue(null);

      const result = await integrityService.validateData('missing-key');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Data not found');
    });

    it('应该检测损坏的数据', async () => {
      const corruptData = {
        id: 'test-1',
        content: 'test content',
        checksum: 'wrong-checksum',
        timestamp: Date.now()
      };

      mockStorageAdapter.get.mockResolvedValue(corruptData);

      const result = await integrityService.validateData('test-1');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Checksum mismatch');
    });

    it('应该批量验证数据', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const mockData = {
        'key1': { id: '1', content: 'content1', checksum: 'hash1' },
        'key2': { id: '2', content: 'content2', checksum: 'hash2' },
        'key3': null // 模拟缺失数据
      };

      mockStorageAdapter.get.mockImplementation((key: string) =>
        Promise.resolve(mockData[key as keyof typeof mockData])
      );

      const results = await integrityService.validateMultipleData(keys);

      expect(results).toHaveLength(3);
      expect(results.find(r => r.key === 'key1')?.isValid).toBe(true);
      expect(results.find(r => r.key === 'key3')?.isValid).toBe(false);
    });
  });

  describe('模式验证', () => {
    it('应该验证数据模式', () => {
      const data = {
        id: 'test-1',
        name: 'Test Item',
        value: 42,
        created: new Date().toISOString()
      };

      const schema = {
        type: 'object',
        required: ['id', 'name', 'value'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          value: { type: 'number' },
          created: { type: 'string' }
        }
      };

      const result = integrityService.validateSchema(data, schema);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测模式不匹配', () => {
      const data = {
        id: 'test-1',
        name: 'Test Item',
        value: 'not-a-number' // 错误类型
      };

      const schema = {
        type: 'object',
        required: ['id', 'name', 'value'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          value: { type: 'number' }
        }
      };

      const result = integrityService.validateSchema(data, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('value must be number');
    });

    it('应该检测缺失必需字段', () => {
      const data = {
        id: 'test-1',
        name: 'Test Item'
        // 缺少 value 字段
      };

      const schema = {
        type: 'object',
        required: ['id', 'name', 'value'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          value: { type: 'number' }
        }
      };

      const result = integrityService.validateSchema(data, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('value is required');
    });
  });

  describe('完整性检查', () => {
    it('应该执行完整的完整性检查', async () => {
      mockStorageAdapter.getKeys.mockResolvedValue(['key1', 'key2', 'key3']);
      mockStorageAdapter.get.mockImplementation((key: string) =>
        Promise.resolve({
          id: key,
          content: `content for ${key}`,
          checksum: `hash-${key}`
        })
      );

      const check = await integrityService.performIntegrityCheck();

      expect(check).toBeDefined();
      expect(check.startTime).toBeDefined();
      expect(check.endTime).toBeDefined();
      expect(check.results).toHaveLength(3);
      expect(check.summary.totalItems).toBe(3);
      expect(check.summary.validItems).toBe(3);
    });

    it('应该生成检查报告', async () => {
      mockStorageAdapter.getKeys.mockResolvedValue(['key1', 'key2']);
      mockStorageAdapter.get.mockImplementation((key: string) => {
        if (key === 'key1') {
          return { id: key, content: 'valid', checksum: 'correct' };
        } else {
          return null; // 模拟损坏数据
        }
      });

      const report = await integrityService.generateIntegrityReport();

      expect(report).toBeDefined();
      expect(report.overallHealth).toBe('warning'); // 部分有效
      expect(report.checks).toHaveLength(2);
      expect(report.recommendations).toContain(
        expect.stringContaining('repair corrupted data')
      );
    });
  });

  describe('数据修复', () => {
    it('应该修复缺失数据', async () => {
      const repairResult = await integrityService.repairData('missing-key');

      expect(repairResult).toBeDefined();
      expect(repairResult.key).toBe('missing-key');
      expect(repairResult.repaired).toBe(true);
      expect(repairResult.repairStrategy).toBe('restore');
    });

    it('应该修复损坏数据', async () => {
      const corruptData = {
        id: 'corrupt-key',
        content: 'corrupt content',
        checksum: 'wrong-checksum'
      };

      mockStorageAdapter.get.mockResolvedValue(corruptData);

      const repairResult = await integrityService.repairData('corrupt-key');

      expect(repairResult.repaired).toBe(true);
      expect(repairResult.repairStrategy).toBe('delete');
      expect(mockStorageAdapter.delete).toHaveBeenCalledWith('corrupt-key');
    });

    it('应该备份修复前的数据', async () => {
      const testData = {
        id: 'backup-test',
        content: 'original content',
        checksum: 'original-hash'
      };

      mockStorageAdapter.get.mockResolvedValue(testData);

      await integrityService.repairData('backup-test');

      expect(mockStorageAdapter.backup).toHaveBeenCalledWith('backup-test');
    });

    it('应该限制修复尝试次数', async () => {
      const failingKey = 'failing-key';

      // 模拟多次失败的修复尝试
      for (let i = 0; i < 5; i++) {
        await integrityService.repairData(failingKey);
      }

      const repairAttempts = integrityService.getRepairAttempts(failingKey);
      expect(repairAttempts).toBeLessThanOrEqual(3); // maxRepairAttempts
    });
  });

  describe('自动检查', () => {
    it('应该启动自动检查', async () => {
      await integrityService.startAutoCheck();
      expect(integrityService.isAutoCheckEnabled()).toBe(true);
    });

    it('应该停止自动检查', async () => {
      await integrityService.startAutoCheck();
      await integrityService.stopAutoCheck();
      expect(integrityService.isAutoCheckEnabled()).toBe(false);
    });

    it('应该按配置间隔执行自动检查', async () => {
      vi.useFakeTimers();

      mockStorageAdapter.getKeys.mockResolvedValue(['key1']);
      mockStorageAdapter.get.mockResolvedValue({ id: 'key1', content: 'test' });

      await integrityService.startAutoCheck();

      // 等待一个检查周期
      vi.advanceTimersByTime(300000);

      expect(mockStorageAdapter.getKeys).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('校验和验证', () => {
    it('应该计算数据校验和', () => {
      const data = { id: 'test', content: 'test content' };
      const checksum = integrityService.calculateChecksum(data);

      expect(checksum).toBeDefined();
      expect(typeof checksum).toBe('string');
      expect(checksum.length).toBeGreaterThan(0);
    });

    it('应该生成一致的校验和', () => {
      const data = { id: 'test', content: 'test content' };
      const checksum1 = integrityService.calculateChecksum(data);
      const checksum2 = integrityService.calculateChecksum(data);

      expect(checksum1).toBe(checksum2);
    });

    it('应该验证校验和匹配', () => {
      const data = { id: 'test', content: 'test content' };
      const checksum = integrityService.calculateChecksum(data);

      const isValid = integrityService.verifyChecksum(data, checksum);

      expect(isValid).toBe(true);
    });

    it('应该检测校验和不匹配', () => {
      const data = { id: 'test', content: 'test content' };
      const wrongChecksum = 'wrong-checksum';

      const isValid = integrityService.verifyChecksum(data, wrongChecksum);

      expect(isValid).toBe(false);
    });
  });

  describe('备份和恢复', () => {
    it('应该创建完整性备份', async () => {
      const backup = await integrityService.createIntegrityBackup();

      expect(backup).toBeDefined();
      expect(backup.timestamp).toBeDefined();
      expect(backup.data).toBeDefined();
      expect(backup.checksum).toBeDefined();
    });

    it('应该从备份恢复', async () => {
      const backupData = {
        timestamp: Date.now(),
        data: { 'key1': 'value1', 'key2': 'value2' },
        checksum: 'backup-checksum'
      };

      await integrityService.restoreFromBackup(backupData);

      expect(mockStorageAdapter.restore).toHaveBeenCalled();
    });

    it('应该验证备份完整性', () => {
      const validBackup = {
        timestamp: Date.now(),
        data: { 'key1': 'value1' },
        checksum: integrityService.calculateChecksum({ 'key1': 'value1' })
      };

      const isValid = integrityService.validateBackup(validBackup);

      expect(isValid).toBe(true);
    });
  });

  describe('统计和分析', () => {
    it('应该提供完整性统计', async () => {
      // 添加一些检查历史
      await integrityService.performIntegrityCheck();
      await integrityService.performIntegrityCheck();

      const stats = integrityService.getIntegrityStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalChecks).toBe(2);
      expect(stats.lastCheckTime).toBeDefined();
      expect(stats.overallHealth).toBeDefined();
    });

    it('应该分析数据损坏模式', async () => {
      // 模拟一些损坏数据
      mockStorageAdapter.getKeys.mockResolvedValue(['corrupt1', 'corrupt2']);
      mockStorageAdapter.get.mockResolvedValue(null); // 模拟损坏

      await integrityService.performIntegrityCheck();

      const patterns = integrityService.analyzeCorruptionPatterns();

      expect(patterns).toBeDefined();
      expect(patterns.commonIssues).toBeDefined();
      expect(patterns.suggestions).toBeDefined();
    });
  });

  describe('配置管理', () => {
    it('应该更新配置', () => {
      const newConfig = {
        ...mockConfig,
        strictMode: true,
        checkInterval: 600000
      };

      integrityService.updateConfig(newConfig);

      expect(integrityService['config'].strictMode).toBe(true);
      expect(integrityService['config'].checkInterval).toBe(600000);
    });

    it('应该验证配置有效性', () => {
      const invalidConfig = {
        ...mockConfig,
        checkInterval: -1, // 无效值
        maxRepairAttempts: -1
      };

      expect(() => {
        integrityService.updateConfig(invalidConfig);
      }).toThrow();
    });
  });

  describe('持久化', () => {
    it('应该保存完整性数据到localStorage', () => {
      integrityService.saveToStorage();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'data-integrity-data',
        expect.any(String)
      );
    });

    it('应该从localStorage加载数据', () => {
      const mockData = JSON.stringify({
        checkHistory: [
          {
            startTime: Date.now(),
            endTime: Date.now(),
            results: [{ key: 'test', isValid: true }]
          }
        ]
      });

      mockLocalStorage.getItem.mockReturnValue(mockData);

      integrityService.loadFromStorage();

      const stats = integrityService.getIntegrityStatistics();
      expect(stats.totalChecks).toBe(1);
    });

    it('应该处理加载损坏数据', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      expect(() => {
        integrityService.loadFromStorage();
      }).not.toThrow();
    });
  });

  describe('事件处理', () => {
    it('应该触发完整性检查事件', async () => {
      const eventHandler = vi.fn();
      integrityService.onIntegrityCheck(eventHandler);

      await integrityService.performIntegrityCheck();

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integrity_check_completed',
          checkResult: expect.any(Object)
        })
      );
    });

    it('应该触发数据修复事件', async () => {
      const eventHandler = vi.fn();
      integrityService.onDataRepair(eventHandler);

      await integrityService.repairData('test-key');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'data_repair_completed',
          repairResult: expect.any(Object)
        })
      );
    });

    it('应该触发错误事件', async () => {
      const eventHandler = vi.fn();
      integrityService.onError(eventHandler);

      mockStorageAdapter.getKeys.mockRejectedValue(new Error('Storage error'));

      await integrityService.performIntegrityCheck();

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integrity_check_error',
          error: expect.any(Error)
        })
      );
    });
  });

  describe('集成测试', () => {
    it('应该与存储适配器协同工作', async () => {
      mockStorageAdapter.getKeys.mockResolvedValue(['integration-test']);
      mockStorageAdapter.get.mockResolvedValue({
        id: 'integration-test',
        content: 'integration data',
        checksum: 'integration-checksum'
      });

      const check = await integrityService.performIntegrityCheck();

      expect(check.results).toHaveLength(1);
      expect(check.results[0].key).toBe('integration-test');
      expect(check.results[0].isValid).toBe(true);
    });

    it('应该处理存储适配器错误', async () => {
      mockStorageAdapter.getKeys.mockRejectedValue(new Error('Storage unavailable'));

      await expect(integrityService.performIntegrityCheck()).rejects.toThrow('Storage unavailable');
    });
  });

  describe('边缘情况', () => {
    it('应该处理空数据集', async () => {
      mockStorageAdapter.getKeys.mockResolvedValue([]);

      const check = await integrityService.performIntegrityCheck();

      expect(check.results).toHaveLength(0);
      expect(check.summary.totalItems).toBe(0);
    });

    it('应该处理非常大的数据集', async () => {
      // 模拟大量数据
      const keys = Array.from({ length: 1000 }, (_, i) => `key-${i}`);
      mockStorageAdapter.getKeys.mockResolvedValue(keys);
      mockStorageAdapter.get.mockResolvedValue({ id: 'test', content: 'test' });

      const check = await integrityService.performIntegrityCheck();

      expect(check.results).toHaveLength(1000);
      expect(check.summary.totalItems).toBe(1000);
    });

    it('应该处理并发检查', async () => {
      mockStorageAdapter.getKeys.mockResolvedValue(['key1', 'key2']);

      const check1 = integrityService.performIntegrityCheck();
      const check2 = integrityService.performIntegrityCheck();

      await Promise.all([check1, check2]);

      // 应该都能完成，不会冲突
    });
  });
});