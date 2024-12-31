# My Nav - 简单的导航网站系统

一个基于 Cloudflare Workers 的轻量级导航网站系统。

## 特性

- 🚀 基于 Cloudflare Workers，无需服务器
- 📱 响应式设计，支持移动端
- 🌓 支持亮色/暗色主题切换
- 🔒 安全的管理后台
- 💾 支持数据备份和恢复
- 🕒 自动备份功能
- 📊 访问统计
- 🖼️ 自动获取网站图标

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
3. 使用配置的管理密码登录
4. 在管理后台可以：
   - 管理分类和链接
   - 调整显示顺序
   - 备份/恢复数据
   - 导出数据到本地

## 自动备份

系统会在每月1号和20号的北京时间凌晨3点自动备份数据，最多保留5个备份。

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License 
