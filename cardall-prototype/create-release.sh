#!/bin/bash

# CardAll v1.0.0 Release Creation Script
echo "🚀 创建 CardAll v1.0.0 Release..."

# 读取发布说明
RELEASE_NOTES=$(cat RELEASE_NOTES_v1.0.0.md)

# 使用GitHub CLI创建Release (如果安装了gh)
if command -v gh &> /dev/null; then
    echo "📝 使用GitHub CLI创建Release..."
    gh release create v1.0.0 \
        --title "CardAll v1.0.0 - 正式发布版" \
        --notes "$RELEASE_NOTES" \
        --target release/v1.0.0 \
        --latest
    echo "✅ GitHub Release 创建成功!"
else
    echo "❌ GitHub CLI (gh) 未安装"
    echo "请手动在GitHub上创建Release:"
    echo "1. 访问 https://github.com/Golden-forest/CardAll/releases/new"
    echo "2. 选择 release/v1.0.0 分支"
    echo "3. 标签填写 v1.0.0"
    echo "4. 标题填写: CardAll v1.0.0 - 正式发布版"
    echo "5. 复制粘贴 RELEASE_NOTES_v1.0.0.md 的内容到描述中"
    echo "6. 点击 'Publish release'"
fi

echo "🎉 Release创建流程完成!"