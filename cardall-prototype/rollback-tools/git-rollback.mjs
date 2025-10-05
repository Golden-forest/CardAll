#!/usr/bin/env node

/**
 * CardAll Git回滚工具
 * 专门处理Git相关的回滚操作
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__dirname);
const projectRoot = path.join(__dirname, '..');

class GitRollbackManager {
  constructor() {
    this.repoPath = projectRoot;
    this.branches = [];
    this.commits = [];
    this.stashes = [];
  }

  async log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
  }

  async execGitCommand(command, options = {}) {
    try {
      const result = execSync(command, {
        cwd: this.repoPath,
        encoding: 'utf8',
        ...options
      });
      return result.trim();
    } catch (error) {
      throw new Error(`Git命令执行失败: ${command} - ${error.message}`);
    }
  }

  async isGitRepository() {
    try {
      await this.execGitCommand('git rev-parse --git-dir');
      return true;
    } catch (error) {
      return false;
    }
  }

  async getCurrentBranch() {
    try {
      return await this.execGitCommand('git rev-parse --abbrev-ref HEAD');
    } catch (error) {
      await this.log('获取当前分支失败', 'error');
      return null;
    }
  }

  async getBranches() {
    try {
      const output = await this.execGitCommand('git branch -a');
      this.branches = output.split('\n').map(branch => {
        const isCurrent = branch.startsWith('*');
        const name = branch.replace(/^\*?\s*/, '').trim();
        return {
          name,
          isCurrent,
          isRemote: name.includes('origin/'),
          localName: name.replace('origin/', '')
        };
      });
      return this.branches;
    } catch (error) {
      await this.log('获取分支列表失败', 'error');
      return [];
    }
  }

  async getRecentCommits(limit = 20) {
    try {
      const output = await this.execGitCommand(`git log --oneline --decorate --graph -${limit}`);
      const lines = output.split('\n');

      this.commits = lines.map(line => {
        const match = line.match(/^(\*|\|\\s+|\s\\|\\s+)([a-f0-9]+)\s+(.*)$/);
        if (match) {
          return {
            hash: match[2],
            message: match[3],
            shortHash: match[2].substring(0, 8)
          };
        }
        return null;
      }).filter(Boolean);

      return this.commits;
    } catch (error) {
      await this.log('获取提交历史失败', 'error');
      return [];
    }
  }

  async getStashes() {
    try {
      const output = await this.execGitCommand('git stash list');
      this.stashes = output.split('\n').filter(line => line.trim()).map(line => {
        const match = line.match(/^stash@{(\d+)}:\s+(.+)$/);
        if (match) {
          return {
            index: parseInt(match[1]),
            description: match[2]
          };
        }
        return null;
      }).filter(Boolean);
      return this.stashes;
    } catch (error) {
      await this.log('获取stash列表失败', 'warning');
      return [];
    }
  }

  async getWorkingTreeStatus() {
    try {
      const status = await this.execGitCommand('git status --porcelain');
      const lines = status.split('\n').filter(line => line.trim());

      const result = {
        modified: [],
        added: [],
        deleted: [],
        untracked: [],
        renamed: [],
        isClean: lines.length === 0
      };

      lines.forEach(line => {
        const statusCode = line.substring(0, 2);
        const filePath = line.substring(3);

        switch (statusCode) {
          case ' M':
            result.modified.push(filePath);
            break;
          case 'A ':
          case 'M ':
            result.added.push(filePath);
            break;
          case 'D ':
            result.deleted.push(filePath);
            break;
          case '??':
            result.untracked.push(filePath);
            break;
          case 'R ':
            result.renamed.push(filePath);
            break;
        }
      });

      return result;
    } catch (error) {
      await this.log('获取工作树状态失败', 'error');
      return null;
    }
  }

  async createBranch(branchName, fromBranch = 'HEAD') {
    try {
      await this.log(`创建分支: ${branchName} from ${fromBranch}`);
      await this.execGitCommand(`git checkout -b ${branchName} ${fromBranch}`);
      await this.log(`分支创建成功: ${branchName}`);
      return true;
    } catch (error) {
      await this.log(`创建分支失败: ${error.message}`, 'error');
      return false;
    }
  }

  async switchBranch(branchName) {
    try {
      await this.log(`切换到分支: ${branchName}`);

      // 检查是否有未提交的更改
      const status = await this.getWorkingTreeStatus();
      if (!status.isClean) {
        await this.log('工作树有未提交的更改，尝试暂存', 'warning');
        await this.execGitCommand('git stash push -m "Auto-stash before branch switch"');
        await this.log('更改已暂存到stash');
      }

      await this.execGitCommand(`git checkout ${branchName}`);
      await this.log(`成功切换到分支: ${branchName}`);
      return true;
    } catch (error) {
      await this.log(`切换分支失败: ${error.message}`, 'error');
      return false;
    }
  }

  async resetToCommit(commitHash, mode = 'hard') {
    try {
      await this.log(`重置到提交: ${commitHash} (模式: ${mode})`);

      // 验证提交存在
      try {
        await this.execGitCommand(`git cat-file -t ${commitHash}`);
      } catch (error) {
        throw new Error(`提交不存在: ${commitHash}`);
      }

      // 创建备份分支
      const backupBranch = `backup-before-reset-${Date.now()}`;
      await this.execGitCommand(`git branch ${backupBranch}`);
      await this.log(`创建备份分支: ${backupBranch}`);

      // 执行重置
      await this.execGitCommand(`git reset --${mode} ${commitHash}`);
      await this.log(`成功重置到提交: ${commitHash}`);

      return {
        success: true,
        backupBranch,
        commitHash,
        mode
      };
    } catch (error) {
      await this.log(`重置失败: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  async revertCommit(commitHash) {
    try {
      await this.log(`撤销提交: ${commitHash}`);

      // 验证提交存在
      try {
        await this.execGitCommand(`git cat-file -t ${commitHash}`);
      } catch (error) {
        throw new Error(`提交不存在: ${commitHash}`);
      }

      // 执行撤销
      await this.execGitCommand(`git revert ${commitHash} --no-edit`);
      await this.log(`成功撤销提交: ${commitHash}`);

      return {
        success: true,
        commitHash
      };
    } catch (error) {
      await this.log(`撤销提交失败: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  async cleanWorkingTree(force = false) {
    try {
      await this.log('清理工作树');

      if (!force) {
        const status = await this.getWorkingTreeStatus();
        if (!status.isClean) {
          await this.log('工作树有未提交的更改，使用 --force 强制清理', 'warning');
          return {
            success: false,
            error: '工作树有未提交的更改，使用 --force 强制清理'
          };
        }
      }

      // 清理未跟踪的文件
      await this.execGitCommand('git clean -fd');

      // 重置所有更改
      await this.execGitCommand('git reset --hard HEAD');

      await this.log('工作树清理完成');

      return {
        success: true
      };
    } catch (error) {
      await this.log(`清理工作树失败: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  async stashCreate(message = 'Auto-stash') {
    try {
      await this.log(`创建stash: ${message}`);
      const output = await this.execGitCommand(`git stash push -m "${message}"`);

      // 提取stash ID
      const match = output.match(/Saved working directory and index state On (\w+): (.+)$/);
      if (match) {
        await this.log(`Stash创建成功: ${match[1]} - ${match[2]}`);
        return {
          success: true,
          branch: match[1],
          message: match[2]
        };
      }

      return { success: true };
    } catch (error) {
      await this.log(`创建stash失败: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  async stashApply(stashIndex = 0) {
    try {
      await this.log(`应用stash: stash@{${stashIndex}}`);
      await this.execGitCommand(`git stash apply stash@{${stashIndex}}`);
      await this.log(`Stash应用成功`);
      return { success: true };
    } catch (error) {
      await this.log(`应用stash失败: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  async stashPop(stashIndex = 0) {
    try {
      await this.log(`弹出stash: stash@{${stashIndex}}`);
      await this.execGitCommand(`git stash pop stash@{${stashIndex}}`);
      await this.log(`Stash弹出成功`);
      return { success: true };
    } catch (error) {
      await this.log(`弹出stash失败: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  async cherryPick(commitHash) {
    try {
      await this.log(`Cherry-pick提交: ${commitHash}`);

      // 验证提交存在
      try {
        await this.execGitCommand(`git cat-file -t ${commitHash}`);
      } catch (error) {
        throw new Error(`提交不存在: ${commitHash}`);
      }

      await this.execGitCommand(`git cherry-pick ${commitHash}`);
      await this.log(`Cherry-pick成功: ${commitHash}`);

      return {
        success: true,
        commitHash
      };
    } catch (error) {
      await this.log(`Cherry-pick失败: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  async printStatus() {
    console.log('\n' + '='.repeat(60));
    console.log('🌲 Git仓库状态');
    console.log('='.repeat(60));

    if (!(await this.isGitRepository())) {
      console.log('❌ 当前目录不是Git仓库');
      return;
    }

    const currentBranch = await this.getCurrentBranch();
    console.log(`📍 当前分支: ${currentBranch || '未知'}`);

    const status = await this.getWorkingTreeStatus();
    if (status) {
      console.log(`📊 工作树状态: ${status.isClean ? '干净' : '有更改'}`);

      if (!status.isClean) {
        if (status.modified.length > 0) console.log(`  📝 修改: ${status.modified.length} 个文件`);
        if (status.added.length > 0) console.log(`  ➕ 新增: ${status.added.length} 个文件`);
        if (status.deleted.length > 0) console.log(`  ➖ 删除: ${status.deleted.length} 个文件`);
        if (status.untracked.length > 0) console.log(`  ❓ 未跟踪: ${status.untracked.length} 个文件`);
      }
    }

    const branches = await this.getBranches();
    console.log(`\n🌿 分支信息: ${branches.length} 个分支`);
    branches.slice(0, 5).forEach(branch => {
      const icon = branch.isCurrent ? '📍' : branch.isRemote ? '🌐' : '📂';
      console.log(`  ${icon} ${branch.name}`);
    });

    const commits = await this.getRecentCommits(5);
    console.log(`\n📝 最近提交:`);
    commits.forEach((commit, index) => {
      console.log(`  ${index + 1}. ${commit.shortHash} - ${commit.message}`);
    });

    const stashes = await this.getStashes();
    if (stashes.length > 0) {
      console.log(`\n📦 Stash: ${stashes.length} 个`);
      stashes.forEach(stash => {
        console.log(`  📦 stash@{${stash.index}}: ${stash.description}`);
      });
    }

    console.log('='.repeat(60));
  }

  async interactiveMode() {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n🔄 CardAll Git回滚工具 - 交互模式');
    console.log('输入 "help" 查看可用命令，输入 "exit" 退出');

    while (true) {
      const answer = await new Promise(resolve => {
        rl.question('\ngit-rollback> ', resolve);
      });

      if (answer === 'exit' || answer === 'quit') {
        break;
      } else if (answer === 'help') {
        console.log(`
可用命令:
  status              - 显示Git状态
  branches            - 列出所有分支
  commits [n]         - 显示最近n个提交 (默认10)
  switch <branch>     - 切换到指定分支
  reset <commit>      - 重置到指定提交
  revert <commit>     - 撤销指定提交
  clean [--force]     - 清理工作树
  stash <message>     - 创建stash
  stash-apply [n]     - 应用stash
  stash-pop [n]       - 弹出stash
  cherry-pick <commit>- Cherry-pick提交
  help                - 显示帮助
  exit                - 退出
        `);
      } else if (answer === 'status') {
        await this.printStatus();
      } else if (answer === 'branches') {
        const branches = await this.getBranches();
        console.log('\n🌿 分支列表:');
        branches.forEach((branch, index) => {
          const icon = branch.isCurrent ? '📍' : branch.isRemote ? '🌐' : '📂';
          console.log(`  ${index + 1}. ${icon} ${branch.name}`);
        });
      } else if (answer.startsWith('commits')) {
        const limit = parseInt(answer.split(' ')[1]) || 10;
        const commits = await this.getRecentCommits(limit);
        console.log(`\n📝 最近 ${commits.length} 个提交:`);
        commits.forEach((commit, index) => {
          console.log(`  ${index + 1}. ${commit.shortHash} - ${commit.message}`);
        });
      } else if (answer.startsWith('switch ')) {
        const branchName = answer.substring(7);
        const result = await this.switchBranch(branchName);
        if (result) {
          console.log('✅ 分支切换成功');
        } else {
          console.log('❌ 分支切换失败');
        }
      } else if (answer.startsWith('reset ')) {
        const commitHash = answer.substring(6);
        const result = await this.resetToCommit(commitHash);
        if (result.success) {
          console.log(`✅ 重置成功，备份分支: ${result.backupBranch}`);
        } else {
          console.log(`❌ 重置失败: ${result.error}`);
        }
      } else if (answer.startsWith('revert ')) {
        const commitHash = answer.substring(7);
        const result = await this.revertCommit(commitHash);
        if (result.success) {
          console.log('✅ 提交撤销成功');
        } else {
          console.log(`❌ 撤销失败: ${result.error}`);
        }
      } else if (answer === 'clean') {
        const result = await this.cleanWorkingTree();
        if (result.success) {
          console.log('✅ 工作树清理成功');
        } else {
          console.log(`❌ 清理失败: ${result.error}`);
        }
      } else if (answer === 'clean --force') {
        const result = await this.cleanWorkingTree(true);
        if (result.success) {
          console.log('✅ 工作树强制清理成功');
        } else {
          console.log(`❌ 清理失败: ${result.error}`);
        }
      } else if (answer.startsWith('stash ')) {
        const message = answer.substring(6);
        const result = await this.stashCreate(message);
        if (result.success) {
          console.log('✅ Stash创建成功');
        } else {
          console.log(`❌ Stash创建失败: ${result.error}`);
        }
      } else if (answer.startsWith('stash-apply')) {
        const index = parseInt(answer.split(' ')[1]) || 0;
        const result = await this.stashApply(index);
        if (result.success) {
          console.log('✅ Stash应用成功');
        } else {
          console.log(`❌ Stash应用失败: ${result.error}`);
        }
      } else if (answer.startsWith('stash-pop')) {
        const index = parseInt(answer.split(' ')[1]) || 0;
        const result = await this.stashPop(index);
        if (result.success) {
          console.log('✅ Stash弹出成功');
        } else {
          console.log(`❌ Stash弹出失败: ${result.error}`);
        }
      } else if (answer.startsWith('cherry-pick ')) {
        const commitHash = answer.substring(12);
        const result = await this.cherryPick(commitHash);
        if (result.success) {
          console.log('✅ Cherry-pick成功');
        } else {
          console.log(`❌ Cherry-pick失败: ${result.error}`);
        }
      } else {
        console.log('未知命令，输入 "help" 查看可用命令');
      }
    }

    rl.close();
  }
}

// 主执行函数
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    const gitManager = new GitRollbackManager();

    if (!command) {
      await gitManager.printStatus();
      process.exit(0);
    }

    switch (command) {
      case 'interactive':
        await gitManager.interactiveMode();
        break;

      case 'status':
        await gitManager.printStatus();
        break;

      case 'branches':
        const branches = await gitManager.getBranches();
        console.log(JSON.stringify(branches, null, 2));
        break;

      case 'commits':
        const limit = parseInt(args[1]) || 20;
        const commits = await gitManager.getRecentCommits(limit);
        console.log(JSON.stringify(commits, null, 2));
        break;

      case 'switch':
        if (!args[1]) {
          console.error('请指定分支名称');
          process.exit(1);
        }
        const switchResult = await gitManager.switchBranch(args[1]);
        process.exit(switchResult ? 0 : 1);

      case 'reset':
        if (!args[1]) {
          console.error('请指定提交哈希');
          process.exit(1);
        }
        const resetResult = await gitManager.resetToCommit(args[1], args[2] || 'hard');
        console.log(JSON.stringify(resetResult, null, 2));
        process.exit(resetResult.success ? 0 : 1);

      case 'revert':
        if (!args[1]) {
          console.error('请指定提交哈希');
          process.exit(1);
        }
        const revertResult = await gitManager.revertCommit(args[1]);
        console.log(JSON.stringify(revertResult, null, 2));
        process.exit(revertResult.success ? 0 : 1);

      case 'clean':
        const cleanResult = await gitManager.cleanWorkingTree(args.includes('--force'));
        console.log(JSON.stringify(cleanResult, null, 2));
        process.exit(cleanResult.success ? 0 : 1);

      case 'stash':
        const message = args.slice(1).join(' ') || 'Auto-stash';
        const stashResult = await gitManager.stashCreate(message);
        console.log(JSON.stringify(stashResult, null, 2));
        process.exit(stashResult.success ? 0 : 1);

      case 'stash-apply':
        const applyIndex = parseInt(args[1]) || 0;
        const applyResult = await gitManager.stashApply(applyIndex);
        console.log(JSON.stringify(applyResult, null, 2));
        process.exit(applyResult.success ? 0 : 1);

      case 'stash-pop':
        const popIndex = parseInt(args[1]) || 0;
        const popResult = await gitManager.stashPop(popIndex);
        console.log(JSON.stringify(popResult, null, 2));
        process.exit(popResult.success ? 0 : 1);

      case 'cherry-pick':
        if (!args[1]) {
          console.error('请指定提交哈希');
          process.exit(1);
        }
        const cherryResult = await gitManager.cherryPick(args[1]);
        console.log(JSON.stringify(cherryResult, null, 2));
        process.exit(cherryResult.success ? 0 : 1);

      default:
        console.error('未知命令:', command);
        console.log('运行 "node git-rollback.mjs help" 查看帮助');
        process.exit(1);
    }
  } catch (error) {
    console.error('命令执行失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default GitRollbackManager;