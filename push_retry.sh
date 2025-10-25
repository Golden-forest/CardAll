#!/bin/bash
echo "开始推送重试机制..."
for i in {1..5}; do
    echo "尝试推送 ($i/5)..."
    if git push origin main; then
        echo "✅ 推送成功！"
        exit 0
    else
        echo "❌ 推送失败，等待30秒后重试..."
        sleep 30
    fi
done
echo "❌ 5次尝试都失败了，请检查网络连接"
exit 1
