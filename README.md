# My Nav - 简单的导航网站系统

一个基于 Cloudflare Workers 的轻量级导航网站系统。
2025年3月9日：更新站点统计和其它小调整，基本不修改了。
2025年1月11日：小调整和主题改变

## 特性

- 🚀 基于 Cloudflare Workers，无需服务器
- 📱 响应式设计，支持移动端
- 🌓 支持亮色/暗色主题切换
- 🔒 安全的管理后台
  - 密码 + 验证码双重验证
  - 分类管理（支持排序）
  - 链接管理（支持排序）
- 💾 完善的数据备份功能
  - 手动备份到 KV 存储
  - 自动定时备份（每月1号和20号凌晨3点）
  - 本地备份导出
  - 备份数据恢复
  - 最多保留5个备份，自动清理
- 🎨 美观的界面设计
  - 清晰的卡片式布局
  - 合理的信息展示
  - 直观的操作按钮

## 部署步骤

1. Fork 本项目到你的 GitHub 账号

2. 注册 Cloudflare 账号，创建一个 Workers 项目

3. 在 Cloudflare 中创建 KV 命名空间：
   - 创建一个名为 `WSZX_NAV` 的 KV 命名空间
   - 记录下 KV 命名空间的 ID

4. 修改 `wrangler.toml` 配置：
   ```toml
   name = "my-nav"  # 你的项目名称
   main = "index.js"
   compatibility_date = "2024-01-01"

   kv_namespaces = [
     { binding = "WSZX_NAV", id = "你的KV命名空间ID" }
   ]

   [vars]
   ADMIN_PASSWORD = "设置你的管理密码"

   [triggers]
   crons = ["0 3 1,20 * *"]  # 自动备份时间设置
   ```

5. 安装 Wrangler CLI：
   ```bash
   npm install -g wrangler
   ```

6. 部署项目：
   ```bash
   wrangler deploy
   ```

## 使用说明

1. 访问你的 Workers 域名即可看到导航首页
2. 访问 `/admin` 路径进入管理后台
3. 使用配置的管理密码和验证码登录
4. 在管理后台可以：
   - 管理分类和链接
   - 调整显示顺序
   - 备份/恢复数据
   - 导出数据到本地
   - 一键打开前端预览

## 数据备份说明

- 自动备份：每月1号和20号的北京时间凌晨3点自动备份
- 备份限制：最多保留5个备份，超出时自动删除最早的备份
- 备份方式：
  - 手动备份到 KV
  - 导出到本地文件
  - 从 KV 或本地文件恢复

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License 
