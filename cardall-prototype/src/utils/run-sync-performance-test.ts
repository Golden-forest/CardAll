/**
 * 同步性能测试运行器
 * 用于运行同步服务性能基准测试并生成报告
 */

import { runSyncPerformanceTest, generatePerformanceReport } from './sync-performance-benchmark'

// 自定义测试配置（可选）
const testConfig = {
  testIterations: 5, // 减少迭代次数以加快测试
  testDataSize: {
    cards: 50,    // 减少测试数据量
    folders: 10,
    tags: 20,
    images: 5
  },
  networkConditions: {
    latency: 100,   // 100ms延迟
    bandwidth: 10,  // 10Mbps带宽
    packetLoss: 0.01 // 1%丢包率
  },
  memoryThreshold: 100, // 100MB内存阈值
  timeout: 60000       // 60秒超时
}

// 主测试函数
async function main() {
  console.log('🚀 开始 CardAll 同步服务性能基准测试...')
  console.log('='.repeat(60))

  try {
    // 运行性能测试
    console.log('📊 正在运行性能测试...')
    const performanceReport = await runSyncPerformanceTest(testConfig)

    console.log('✅ 性能测试完成!')
    console.log('='.repeat(60))

    // 生成并显示报告
    console.log('📋 生成性能测试报告...')
    const reportText = await generatePerformanceReport(performanceReport)

    console.log(`\n${  '='.repeat(60)}`)
    console.log('📊 性能测试报告')
    console.log('='.repeat(60))
    console.log(reportText)

    // 保存报告到文件
    if (typeof window !== 'undefined' && 'document' in window) {
      const blob = new Blob([reportText], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sync-performance-report-${new Date().toISOString().split('T')[0]}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      console.log('\n💾 报告已保存到本地文件')
    }

    console.log('\n🎉 测试完成! 请查看上述性能改进结果。')

  } catch (error) {
    console.error('❌ 性能测试失败:', error)
    console.error('\n请检查以下可能的问题:')
    console.error('1. 确保所有同步服务依赖已正确安装')
    console.error('2. 检查网络连接是否正常')
    console.error('3. 确保测试环境有足够的内存和计算资源')
    console.error('4. 查看控制台错误日志以获取详细信息')

    process.exit(1)
  }
}

// 如果直接运行此脚本
if (typeof window === 'undefined') {
  // Node.js环境
  main().catch(error => {
    console.error('Test runner failed:', error)
    process.exit(1)
  })
} else {
  // 浏览器环境
  (window as any).runSyncPerformanceTest = main
  console.log('💡 在浏览器控制台中运行: runSyncPerformanceTest()')
}

export default main