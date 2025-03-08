export default {
    async fetch(request, env, ctx) {
        return handleRequest(request, env);
    },
};

async function handleRequest(request, env) {
    const url = new URL(request.url);
    
    // 处理 API 请求
    if (url.pathname.startsWith('/api/')) {
        return handleApiRequest(request, env);
    }

    // 处理静态文件
    try {
        // 根据路径返回对应的 HTML 文件
        if (url.pathname === '/admin') {
            return new Response(admin_html, {
                headers: { 'Content-Type': 'text/html' },
            });
        }
        
        // 默认返回首页
        return new Response(index_html, {
            headers: { 'Content-Type': 'text/html' },
        });
    } catch (e) {
        return new Response('Not Found', { status: 404 });
    }
}

async function handleApiRequest(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 处理登录
    if (path === '/api/login') {
        if (request.method === 'POST') {
            const { password } = await request.json();
            if (password === env.ADMIN_PASSWORD) {
                return new Response(JSON.stringify({ success: true }));
            }
            return new Response('未授权', { status: 401 });
        }
    }

    // 处理分类
    if (path === '/api/categories') {
        if (request.method === 'GET') {
            const categories = await env.WSZX_NAV.get('categories', { type: 'json' }) || [];
            return new Response(JSON.stringify(categories));
        }
        
        if (request.method === 'POST') {
            const category = await request.json();
            const categories = await env.WSZX_NAV.get('categories', { type: 'json' }) || [];
            category.id = Date.now().toString();
            category.order = Number(category.order) || 0;
            categories.push(category);
            categories.sort((a, b) => (b.order || 0) - (a.order || 0));
            await env.WSZX_NAV.put('categories', JSON.stringify(categories));
            return new Response(JSON.stringify({ success: true }));
        }
    }

    // 处理删除分类
    if (path.startsWith('/api/categories/') && request.method === 'DELETE') {
        const id = path.split('/').pop();
        const categories = await env.WSZX_NAV.get('categories', { type: 'json' }) || [];
        const newCategories = categories.filter(cat => cat.id !== id);
        await env.WSZX_NAV.put('categories', JSON.stringify(newCategories));
        return new Response(JSON.stringify({ success: true }));
    }

    // 处理链接
    if (path === '/api/links') {
        if (request.method === 'GET') {
            const links = await env.WSZX_NAV.get('links', { type: 'json' }) || [];
            return new Response(JSON.stringify(links));
        }
        
        if (request.method === 'POST') {
            const link = await request.json();
            const links = await env.WSZX_NAV.get('links', { type: 'json' }) || [];
            link.id = Date.now().toString();
            link.order = Number(link.order) || 0;
            links.push(link);
            links.sort((a, b) => (b.order || 0) - (a.order || 0));
            await env.WSZX_NAV.put('links', JSON.stringify(links));
            return new Response(JSON.stringify({ success: true }));
        }
    }

    // 处理删除链接
    if (path.startsWith('/api/links/') && request.method === 'DELETE') {
        const id = path.split('/').pop();
        const links = await env.WSZX_NAV.get('links', { type: 'json' }) || [];
        const newLinks = links.filter(link => link.id !== id);
        await env.WSZX_NAV.put('links', JSON.stringify(newLinks));
        return new Response(JSON.stringify({ success: true }));
    }

    // 处理更新分类
    if (path.startsWith('/api/categories/') && request.method === 'PUT') {
        const id = path.split('/').pop();
        const { name, order } = await request.json();
        const categories = await env.WSZX_NAV.get('categories', { type: 'json' }) || [];
        const index = categories.findIndex(cat => cat.id === id);
        if (index !== -1) {
            categories[index] = {
                ...categories[index],
                name: name || categories[index].name,
                order: order !== undefined ? Number(order) : categories[index].order
            };
            // 按 order 降序排序
            categories.sort((a, b) => (b.order || 0) - (a.order || 0));
            await env.WSZX_NAV.put('categories', JSON.stringify(categories));
            return new Response(JSON.stringify({ success: true }));
        }
    }

    // 处理更新链接
    if (path.startsWith('/api/links/') && request.method === 'PUT') {
        const id = path.split('/').pop();
        const updateData = await request.json();
        const links = await env.WSZX_NAV.get('links', { type: 'json' }) || [];
        const index = links.findIndex(link => link.id === id);
        if (index !== -1) {
            links[index] = { 
                ...links[index], 
                ...updateData,
                order: updateData.order !== undefined ? Number(updateData.order) : links[index].order
            };
            // 按 order 降序排序
            links.sort((a, b) => (b.order || 0) - (a.order || 0));
            await env.WSZX_NAV.put('links', JSON.stringify(links));
            return new Response(JSON.stringify({ success: true }));
        }
    }

    // 处理数据恢复
    if (path === '/api/restore' && request.method === 'POST') {
        const data = await request.json();
        await Promise.all([
            env.WSZX_NAV.put('categories', JSON.stringify(data.categories)),
            env.WSZX_NAV.put('links', JSON.stringify(data.links))
        ]);
        return new Response(JSON.stringify({ success: true }));
    }

    // 处理KV备份
    if (path === '/api/backup-kv' && request.method === 'POST') {
        const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
        const [categories, links] = await Promise.all([
            env.WSZX_NAV.get('categories', { type: 'json' }),
            env.WSZX_NAV.get('links', { type: 'json' })
        ]);
        
        const backupData = {
            categories,
            links,
            timestamp
        };

        // 获取现有备份列表
        const list = await env.WSZX_NAV.list({ prefix: 'backup_' });
        const backups = list.keys;

        // 如果已有5个备份，删除最早的一个
        if (backups.length >= 5) {
            // 按名称排序（实际上是按时间排序，因为名称包含时间戳）
            backups.sort((a, b) => a.name.localeCompare(b.name));
            // 删除最早的备份
            await env.WSZX_NAV.delete(backups[0].name);
        }
        
        await env.WSZX_NAV.put(`backup_${timestamp}`, JSON.stringify(backupData));
        return new Response(JSON.stringify({ success: true }));
    }

    // 添加自动备份触发器
    if (path === '/api/cron-backup' && request.method === 'POST') {
        const now = new Date();
        // 转换为北京时间
        const beijingTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
        const day = beijingTime.getDate();
        const hour = beijingTime.getHours();

        // 检查是否是1号或20号的凌晨3点
        if ((day === 1 || day === 20) && hour === 3) {
            // 执行备份
            const timestamp = beijingTime.toLocaleString('zh-CN');
            const [categories, links] = await Promise.all([
                env.WSZX_NAV.get('categories', { type: 'json' }),
                env.WSZX_NAV.get('links', { type: 'json' })
            ]);
            
            const backupData = {
                categories,
                links,
                timestamp,
                type: 'auto'  // 标记为自动备份
            };

            // 获取现有备份列表
            const list = await env.WSZX_NAV.list({ prefix: 'backup_' });
            const backups = list.keys;

            // 如果已有5个备份，删除最早的一个
            if (backups.length >= 5) {
                backups.sort((a, b) => a.name.localeCompare(b.name));
                await env.WSZX_NAV.delete(backups[0].name);
            }
            
            await env.WSZX_NAV.put(`backup_${timestamp}`, JSON.stringify(backupData));
            return new Response(JSON.stringify({ success: true }));
        }
    }

    // 获取KV备份列表
    if (path === '/api/backup-list' && request.method === 'GET') {
        const list = await env.WSZX_NAV.list({ prefix: 'backup_' });
        return new Response(JSON.stringify(list.keys));
    }

    // 从KV恢复备份
    if (path === '/api/restore-kv' && request.method === 'POST') {
        const { key } = await request.json();
        const backupData = await env.WSZX_NAV.get(key, { type: 'json' });
        if (backupData && backupData.categories && backupData.links) {
            await Promise.all([
                env.WSZX_NAV.put('categories', JSON.stringify(backupData.categories)),
                env.WSZX_NAV.put('links', JSON.stringify(backupData.links))
            ]);
            return new Response(JSON.stringify({ success: true }));
        }
        return new Response('Invalid backup data', { status: 400 });
    }

    // 处理分类重排序
    if (path === '/api/categories/reorder' && request.method === 'POST') {
        const { order } = await request.json();
        const categories = await env.WSZX_NAV.get('categories', { type: 'json' }) || [];
        
        // 根据新顺序重排分类
        const newCategories = order.map(id => 
            categories.find(cat => cat.id === id)
        ).filter(Boolean);  // 过滤掉可能的无效ID
        
        await env.WSZX_NAV.put('categories', JSON.stringify(newCategories));
        return new Response(JSON.stringify({ success: true }));
    }

    return new Response('Not Found', { status: 404 });
}

const index_html = `<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ws01导航</title>
    <link rel="shortcut icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>💠</text></svg>">
    <style>
        :root {
            --bg-color: #CFCFCF;  /* 背景色 */
            --content-bg: #EBEBEB;  /* 原#f5f5f5 */
            --card-bg: #E6E6FA;  /* 原#E6E6FA */
            --text-color: #1a1a1a;  /* 原#333 */
            --border-color: #6E6E6E;
            --hover-border: #c8c8fa;
            --title-color: #2c3e50;
            --divider-color: #ccc;
            --category-title-color: #333;
            --link-text-color: #666;
            --url-text-color: #666;
        }
        [data-theme="dark"] {
            --bg-color: #363636;  /* 原#666666 */
            --content-bg: #666666;  /* 原#4F4F4F */
            --card-bg: #363636;
            --text-color: #ffffff;
            --border-color: #aaa;  /* 边框，原#436EEED */
            --hover-border: #6495ED;  /* 原#6495ED */
            --title-color: #ffffff;
            --divider-color: #6495ED;  /* 原#6495ED */
            --category-title-color: #ffffff;
            --link-text-color: #ffffff;
            --url-text-color: #999999;
        }
        html, body {
            margin: 0;
            padding: 0;
            min-height: 100vh;
            background-color: var(--bg-color);
            color: var(--text-color);
            transition: all 0.3s ease;
        }
        #content {
            background-color: var(--content-bg);
            min-height: 100vh;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
        }
        body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 30px;
            position: relative;
            padding: 0 20px;
        }
        .header-right {
            position: absolute;
            right: 20px;
            display: flex;
            gap: 15px;
            align-items: center;
        }

        .theme-switch {
            background: none;
            border: 2px solid var(--border-color);
            color: var(--text-color);
            padding: 8px 16px;
            border-radius: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .theme-switch svg {
            width: 16px;
            height: 16px;
            stroke: var(--text-color);
        }
        .category-title {
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 1px dashed var(--divider-color);
            color: var(--category-title-color);
            font-size: 20px;
            text-align: left;
            font-weight: bold;
        }
        .nav-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(188px, 1fr));
            gap: 18px;
        }

        .content {
            flex: 1;
            background: #ffffff;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .nav-item {
            background: var(--card-bg);
            padding: 12px;
            border-radius: 8px;
            text-decoration: none;
            color: var(--text-color) !important;
            border: 2px solid var(--border-color);
            transition: all 0.3s ease;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .nav-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            border-color: var(--hover-border);
            background: var(--card-bg);
        }
        .nav-item p {
            margin: 0;
            color: var(--url-text-color);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .nav-item h3 {
            margin: 0 0 8px 0;
            font-size: 18px;
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--text-color);
        }
        .site-icon {
            width: 15px;
            height: 15px;
            object-fit: contain;
        }
        .default-icon {
            width: 16px;
            height: 16px;
            background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>');
            background-size: contain;
            display: inline-block;
        }

        @media (max-width: 768px) {
            .header {
                flex-direction: column;
                gap: 15px;
                margin-bottom: 20px;
                padding: 0;
            }
            .header-right {
                position: static;
                width: 100%;
                justify-content: center;
            }
            h1 {
                margin: 0;
                font-size: 24px;
            }
            .theme-switch {
                padding: 6px 12px;
                font-size: 16px;
            }
            .admin-link {
                padding: 6px 12px;
                font-size: 15px;
            }
            .nav-grid {
                grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
                gap: 12px;
            }

        .site-icon {
            width: 15px;
            height: 15px;
            object-fit: contain;
        }
        }

        @media (max-width: 480px) {
            .nav-grid {
                grid-template-columns: 1fr;
                gap: 8px;
            }
            .header-right {
                flex-wrap: wrap;
                gap: 8px;
            }
            .theme-switch, .admin-link {
                flex: 1;
                min-width: 120px;
                justify-content: center;
            }
            .nav-grid {
                grid-template-columns: repeat(auto-fill, minmax(152px, 1fr));
                gap: 6px;
            }

        .site-icon {
            width: 14px;
            height: 14px;
            object-fit: contain;
        }
        .nav-item h3 {
            font-size: 15px;
        }
        .default-icon {
            width: 14px;
            height: 14px;
        }
        }

        .footer {
            margin-top: auto;
            text-align: center;
            padding: 20px 0;
            font-size: 14px;
            color: var(--text-color);
            opacity: 0.8;
        }
        .footer a {
            color: var(--text-color);
            text-decoration: none;
            transition: opacity 0.3s ease;
        }
        .footer a:hover {
            opacity: 1;
            text-decoration: underline;
        }
        .admin-link {
            text-decoration: none;
            color: var(--text-color);
            padding: 8px 16px;
            border: 2px solid var(--border-color);
            border-radius: 20px;
            transition: all 0.3s ease;
        }
        .admin-link:hover {
            border-color: var(--hover-border);
        }
        .category {
            margin-bottom: 20px;
        }
        .category:last-child {
            margin-bottom: 15px;
        }
        .captcha-container {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 15px;
        }
        .captcha-code {
            background: #f0f0f0;
            padding: 8px 15px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 18px;
            user-select: none;
            cursor: pointer;
            letter-spacing: 3px;
            text-align: center;
            flex: 1;
            min-width: 80px;
        }
        [data-theme="dark"] .captcha-code {
            background: #2a2a2a;
            color: #fff;
        }
        .captcha-refresh {
            height: 38px;
            padding: 8px 15px;
            flex: 1;
            white-space: nowrap;
            min-width: 80px;
        }
        .captcha-input {
            height: 38px;
            padding: 8px;
            text-align: center;
            font-size: 16px;
            flex: 1;
            min-width: 80px;
        }
        .logout-btn {
            padding: 8px 16px;
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.3s;
            margin-right: 10px;
        }
        .logout-btn:hover {
            background: #c82333;
        }
        .link-item {
            background: var(--card-bg);
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 8px;
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
            min-height: 120px;
        }
        .link-info {
            display: flex;
            align-items: center;
            gap: 30px;
            flex: 1;
        }
        .link-order {
            min-width: 80px;
            color: var(--text-color);
            text-align: center;
        }
        .link-title {
            min-width: 250px;
            max-width: 250px;
            font-weight: bold;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .link-url {
            min-width: 350px;
            max-width: 350px;
            color: var(--url-text-color);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .link-category {
            min-width: 120px;
            max-width: 120px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .link-actions {
            display: flex;
            gap: 15px;
            min-width: 180px;
            justify-content: flex-end;
        }
        .link-actions button {
            min-width: 80px;
            padding: 6px 12px;
        }
        .link-item {
            background: var(--card-bg);
            padding: 15px;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px dashed var(--divider-color);
        }
        .link-item:last-child {
            border-bottom: none;
        }
        .link-item:hover {
            background: var(--card-bg);
            opacity: 0.95;
        }
        .link-info {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 20px;
        }
        .link-order {
            color: var(--text-color);
            min-width: 80px;
            text-align: center;
        }
        .link-title {
            font-weight: bold;
            min-width: 150px;
        }
        .link-url {
            color: var(--url-text-color);
            flex: 1;
        }
        .link-category {
            color: var(--text-color);
            min-width: 100px;
        }
        .link-actions {
            display: flex;
            gap: 10px;
            margin-left: 20px;
        }
        .link-actions button {
            min-width: 80px;
            padding: 6px 15px;
        }
        .link-meta {
            display: flex;
            gap: 15px;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 13px;
        }
        .link-meta span {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .link-actions {
            display: flex;
            gap: 6px;
        }
        .link-actions button {
            flex: 1;
            padding: 4px 8px;
            font-size: 12px;
        }
        .edit-mode input, .edit-mode textarea, .edit-mode select {
            margin-bottom: 10px;
        }
        .backup-actions {
            display: flex;
            gap: 10px;
        }
        .backup-dialog {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            min-width: 300px;
        }
        .backup-list {
            margin: 15px 0;
            max-height: 300px;
            overflow-y: auto;
        }
        .backup-item {
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .backup-item button {
            padding: 4px 8px;
            font-size: 12px;
        }
        .dialog-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 999;
        }
        .edit-actions {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .edit-actions select {
            width: 100px;
            margin-right: auto;
        }
        .edit-actions button {
            min-width: 60px;
            padding: 6px 12px;
            height: 32px;
            flex-shrink: 0;
        }
        .btn-group {
            display: flex;
            gap: 8px;
        }
        input, select, button {
            height: 32px;
            box-sizing: border-box;
        }
        .edit-mode {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 6px;
        }
        .edit-form-row-1 {
            display: grid;
            grid-template-columns: 1fr 2fr;
            gap: 12px;
            margin-bottom: 8px;
        }
        .edit-form-row-2 {
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
            margin-bottom: 8px;
        }
        .edit-form-row-3 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 8px;
        }
        .edit-actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }
        .edit-actions button {
            min-width: 60px;
            padding: 6px 12px;
            height: 32px;
            flex-shrink: 0;
        }
        .captcha-container {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 15px;
        }
        .captcha-code {
            background: #f0f0f0;
            padding: 8px 15px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 18px;
            user-select: none;
            letter-spacing: 3px;
            min-width: 80px;
            text-align: center;
        }
        [data-theme="dark"] .captcha-code {
            background: #2a2a2a;
            color: #fff;
        }
        .captcha-refresh {
            height: 38px;
            padding: 8px 15px;
            flex: 1;
            white-space: nowrap;
            min-width: 80px;
        }
        .captcha-input {
            flex: 1;
            height: 38px;
            padding: 8px;
            text-align: center;
            font-size: 16px;
        }
        .captcha-code {
            background: #f0f0f0;
            padding: 8px 15px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 18px;
            user-select: none;
            letter-spacing: 3px;
            min-width: 80px;
            text-align: center;
        }
        [data-theme="dark"] .captcha-code {
            background: #2a2a2a;
            color: #fff;
        }
        .captcha-refresh {
            height: 38px;
            padding: 8px 15px;
            flex: 1;
            white-space: nowrap;
            min-width: 80px;
        }
        .captcha-input {
            flex: 1;
            height: 38px;
            padding: 8px;
            text-align: center;
            font-size: 16px;
        }
        .captcha-code {
            background: #f0f0f0;
            padding: 8px 15px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 18px;
            user-select: none;
            letter-spacing: 3px;
            min-width: 80px;
            text-align: center;
        }
        [data-theme="dark"] .captcha-code {
            background: #2a2a2a;
            color: #fff;
        }
        .categories-list {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 20px !important;
            margin-top: 20px;
            width: 100%;
        }
        .category-item {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            position: relative;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .category-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            width: 100%;
        }
        .category-left {
            display: flex;
            align-items: center;
            gap: 15px;
            flex: 1;
        }
        .category-name {
            font-weight: bold;
            margin: 0;
            min-width: 120px;
            color: #333;
        }
        .category-info {
            color: #666;
            font-size: 14px;
        }
        .category-actions {
            display: flex;
            gap: 8px;
        }
        .link-form-row {
            display: flex;
            gap: 20px;
            align-items: center;
            margin-bottom: 15px;
            width: 100%;
        }
        #title, #description {
            min-width: 125px;
            max-width: 125px;
            flex: 1;
        }
        #url {
            min-width: 415px;
            max-width: 415px;
            flex: 1;
        }
        #categoryId {
            min-width: 120px;
            max-width: 120px;
        }
        #linkOrder {
            min-width: 80px;
            max-width: 80px;
            text-align: center;
        }
        .btn-add {
            min-width: 80px !important;
            max-width: 80px !important;
            width: 80px !important;
            padding: 6px 12px;
            flex: none !important;
        }
        .btn-danger {
            background: #dc3545 !important;  /* 红色背景 */
            color: white !important;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            padding: 8px 16px;
            transition: background-color 0.3s;
        }
        .btn-danger:hover {
            background: #c82333 !important;  /* 鼠标悬停时的深红色 */
        }
        .admin-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            align-items: center;
            margin-bottom: 20px;
        }
        .admin-actions .btn-primary {
            background: #007bff !important;
            color: white !important;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            padding: 8px 16px;
            transition: background-color 0.3s;
        }
        .admin-actions .btn-primary:hover {
            background: #0056b3 !important;
        }
        .admin-actions .btn-danger {
            background: #dc3545 !important;
            color: white !important;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            padding: 8px 16px;
            transition: background-color 0.3s;
        }
        .admin-actions .btn-danger:hover {
            background: #c82333 !important;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>ws01导航</h1>
        <div class="header-right">
            <button class="theme-switch" onclick="toggleTheme()">
                <svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="5"/>
                    <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
                <span>主题</span>
            </button>
            <a href="/admin" class="admin-link">登录</a>
        </div>
    </div>
    <div class="content" id="content"></div>
    <div class="footer">

            <span id="timeDate">载入天数...</span>
            <script language="javascript"> 
            var now = new Date();
            function createtime(){
                var grt= new Date("01/27/2025 00:00:00");/*---这里是网站的启用时间--*/
                now.setTime(now.getTime()+250);
                days = (now - grt ) / 1000 / 60 / 60 / 24;
                dnum = Math.floor(days);
                document.getElementById("timeDate").innerHTML = "稳定运行"+dnum+"天";
            }
            setInterval("createtime()",250); 
        </script> 

        <span <p>  | 本页总访问量 <span id="busuanzi_site_pv"></span> 次 | 开源于 GitHub <a href="https://github.com/wszx123/My-Nav" target="_blank">@wszx123</a></p></span>
        <script defer src="https://bsz.211119.xyz/js"></script>

    </div>
 
    <script>
        async function loadNavLinks() {
            const [linksResponse, categoriesResponse] = await Promise.all([
                fetch('/api/links'),
                fetch('/api/categories')
            ]);
            
            const links = await linksResponse.json();
            const categories = await categoriesResponse.json();
            const container = document.getElementById('content');
            container.innerHTML = '';
            
            // 按分类组织链接
            const linksByCategory = {};
            links.forEach(link => {
                if (!linksByCategory[link.categoryId]) {
                    linksByCategory[link.categoryId] = [];
                }
                linksByCategory[link.categoryId].push(link);
            });
            
            // 渲染分类和链接
            categories.forEach(category => {
                const categoryLinks = linksByCategory[category.id] || [];
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'category';
                categoryDiv.innerHTML = \`
                    <h2 class="category-title">\${category.name}</h2>
                    <div class="nav-grid">
                        \${categoryLinks.map(link => {
                            const hostname = new URL(link.url).hostname;
                            return \`
                                <a href="\${link.url}" class="nav-item" target="_blank">
                                    <h3>
                                        <img src="https://favicon.cccyun.cc/\${hostname}" 
                                             class="site-icon"
                                             onerror="this.onerror=null;this.src='https://icon.horse/icon/\${hostname}';this.onerror=function(){this.onerror=null;this.parentElement.innerHTML=this.parentElement.innerHTML.replace(this.outerHTML,'<span class=\\'default-icon\\'></span>')}">
                                        \${link.title}
                                    </h3>
                                    <p>\${hostname}</p>
                                </a>
                            \`;
                        }).join('')}
                    </div>
                \`;
                container.appendChild(categoryDiv);
            });
        }

        // 初始化主题
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeButton(savedTheme);

        function updateThemeButton(theme) {
            const themeBtn = document.querySelector('.theme-switch');
            if (!themeBtn) return;
            
            themeBtn.innerHTML = theme === 'dark' ? \`
                <svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                </svg>
                <span>主题</span>
            \` : \`
                <svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="5"/>
                    <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
                <span>主题</span>
            \`;
        }

        function toggleTheme() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeButton(newTheme);
        }

        loadNavLinks();

        let currentCaptcha = '';

        function generateCaptcha() {
            const min = 1000;
            const max = 9999;
            return Math.floor(Math.random() * (max - min + 1) + min).toString();
        }

        function refreshCaptcha() {
            currentCaptcha = generateCaptcha();
            const captchaElement = document.getElementById('captchaCode');
            if (captchaElement) {
                captchaElement.textContent = currentCaptcha;
            }
        }

        // 确保在 DOM 加载完成后初始化验证码
        document.addEventListener('DOMContentLoaded', function() {
            refreshCaptcha();
        });

        // 修改登录函数
        async function login() {
            const password = document.getElementById('password').value;
            const captcha = document.getElementById('captcha').value;
            
            if (!captcha) {
                alert('请输入验证码');
                return;
            }
            
            if (captcha !== currentCaptcha) {
                alert('验证码错误');
                refreshCaptcha();
                document.getElementById('captcha').value = '';
                return;
            }
            
            const response = await fetch('/api/login', {
                method: 'POST',
                body: JSON.stringify({ password })
            });
            
            if (response.ok) {
                document.getElementById('loginForm').style.display = 'none';
                document.getElementById('adminPanel').style.display = 'block';
                loadCategories();
                loadLinks();
            } else {
                alert('密码错误');
                refreshCaptcha();
                document.getElementById('captcha').value = '';
                document.getElementById('password').value = '';
            }
        }

        // 添加回车键登录支持
        document.getElementById('password').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                login();
            }
        });
        
        document.getElementById('captcha').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                login();
            }
        });

        // 添加登出函数
        function logout() {
            if (confirm('确定要退出登录吗？')) {
                document.getElementById('loginForm').style.display = 'block';
                document.getElementById('adminPanel').style.display = 'none';
                document.getElementById('password').value = '';
                document.getElementById('captcha').value = '';
                refreshCaptcha();
            }
        }
    </script>
</body>
</html>`;

const admin_html = `<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Nav - 管理后台</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        h1, h2 {
            text-align: center;
            margin-bottom: 30px;
        }
        .form-group {
            margin-bottom: 15px;
        }
        input, textarea, select {
            width: 100%;
            padding: 8px;
            margin-top: 5px;
        }
        button {
            padding: 10px 20px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        .links-list, .categories-list {
            margin-top: 30px;
        }
        .link-item, .category-item {
            background: #f5f5f5;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 8px;
        }
        #loginForm {
            text-align: center;
            max-width: 300px;
            margin: 0 auto;
        }
        #loginForm button {
            margin-top: 10px;
            width: 100%;
        }
        #addLinkForm button, #addCategoryForm button {
            display: block;
            width: 100%;
            margin-top: 20px;
        }
        .section {
            margin-bottom: 40px;
            padding: 30px;
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .section-header {
            display: grid;
            grid-template-columns: auto minmax(200px, 400px) 1fr auto;
            gap: 20px;
            align-items: center;
            margin-bottom: 20px;
        }
        .section-header h2 {
            margin: 0;
        }
        .category-form-row {
            display: grid;
            grid-template-columns: 2fr 80px auto;
            gap: 15px;
            align-items: center;
            max-width: 600px;
        }
        .category-form-row input {
            height: 36px;
            box-sizing: border-box;
        }
        .category-form-row button {
            min-width: 100px;
            height: 36px;
            margin: 0;
        }
        .btn-add {
            background: #2c3e50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            height: 36px;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .btn-edit {
            background: #e2e8f0;
            color: #2d3748;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            min-width: 32px !important;
            padding: 3px 8px;
        }
        .btn-delete {
            background: #878787;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            min-width: 32px !important;
            padding: 3px 8px;
        }
        .categories-list {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 20px !important;
            margin-top: 20px;
            width: 100%;
        }
        .category-item {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            position: relative;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .category-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            width: 100%;
        }
        .category-left {
            display: flex;
            align-items: center;
            gap: 15px;
            flex: 1;
        }
        .category-name {
            font-weight: bold;
            margin: 0;
            min-width: 120px;
            color: #333;
        }
        .category-info {
            color: #666;
            font-size: 14px;
        }
        .category-actions {
            display: flex;
            gap: 8px;
        }
        .link-form-row {
            display: flex;
            gap: 20px;
            align-items: center;
            margin-bottom: 15px;
            width: 100%;
        }
        #title, #description {
            min-width: 125px;
            max-width: 125px;
            flex: 1;
        }
        #url {
            min-width: 415px;
            max-width: 415px;
            flex: 1;
        }
        #categoryId {
            min-width: 120px;
            max-width: 120px;
        }
        #linkOrder {
            min-width: 80px;
            max-width: 80px;
            text-align: center;
        }
        .btn-add {
            min-width: 80px !important;
            max-width: 80px !important;
            width: 80px !important;
            padding: 6px 12px;
            flex: none !important;
        }
        .links-list {
            display: flex;
            flex-direction: column;
            gap: 0;
            margin-top: 20px;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            overflow: hidden;
        }
        .link-item {
            background: var(--card-bg);
            padding: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            border-bottom: 2px dashed var(--divider-color);
        }
        .link-item:last-child {
            border-bottom: none;
        }
        .link-item:hover {
            background: var(--card-bg);
            opacity: 0.95;
        }
        .link-info {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 30px;
        }
        .link-order {
            min-width: 80px;
            color: var(--text-color);
            text-align: center;
        }
        .link-title {
            min-width: 250px;
            max-width: 250px;
            font-weight: bold;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .link-url {
            min-width: 350px;
            max-width: 350px;
            color: var(--url-text-color);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .link-category {
            min-width: 120px;
            max-width: 120px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .link-actions {
            display: flex;
            gap: 15px;
            min-width: 180px;
            justify-content: flex-end;
        }
        .link-actions button {
            min-width: 80px;
            padding: 6px 12px;
        }
        .link-meta {
            display: flex;
            gap: 15px;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 13px;
        }
        .link-meta span {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .link-actions {
            display: flex;
            gap: 6px;
        }
        .link-actions button {
            flex: 1;
            padding: 4px 8px;
            font-size: 12px;
        }
        .edit-mode input, .edit-mode textarea, .edit-mode select {
            margin-bottom: 10px;
        }
        .backup-actions {
            display: flex;
            gap: 10px;
        }
        .backup-dialog {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            min-width: 300px;
        }
        .backup-list {
            margin: 15px 0;
            max-height: 300px;
            overflow-y: auto;
        }
        .backup-item {
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .backup-item button {
            padding: 4px 8px;
            font-size: 12px;
        }
        .dialog-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 999;
        }
        .edit-actions {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .edit-actions select {
            width: 100px;
            margin-right: auto;
        }
        .edit-actions button {
            min-width: 60px;
            padding: 6px 12px;
            height: 32px;
            flex-shrink: 0;
        }
        .btn-group {
            display: flex;
            gap: 8px;
        }
        input, select, button {
            height: 32px;
            box-sizing: border-box;
        }
        .edit-mode {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 6px;
        }
        .edit-form-row-1 {
            display: grid;
            grid-template-columns: 1fr 2fr;
            gap: 12px;
            margin-bottom: 8px;
        }
        .edit-form-row-2 {
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
            margin-bottom: 8px;
        }
        .edit-form-row-3 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 8px;
        }
        .edit-actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }
        .edit-actions button {
            min-width: 60px;
            padding: 6px 12px;
            height: 32px;
            flex-shrink: 0;
        }
        .captcha-container {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 15px;
        }
        .captcha-code {
            background: #f0f0f0;
            padding: 8px 15px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 18px;
            user-select: none;
            letter-spacing: 3px;
            min-width: 80px;
            text-align: center;
        }
        [data-theme="dark"] .captcha-code {
            background: #2a2a2a;
            color: #fff;
        }
        .captcha-refresh {
            height: 38px;
            padding: 8px 15px;
            flex: 1;
            white-space: nowrap;
            min-width: 80px;
        }
        .captcha-input {
            flex: 1;
            height: 38px;
            padding: 8px;
            text-align: center;
            font-size: 16px;
        }
        .captcha-code {
            background: #f0f0f0;
            padding: 8px 15px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 18px;
            user-select: none;
            letter-spacing: 3px;
            min-width: 80px;
            text-align: center;
        }
        [data-theme="dark"] .captcha-code {
            background: #2a2a2a;
            color: #fff;
        }
        .captcha-refresh {
            height: 38px;
            padding: 8px 15px;
            flex: 1;
            white-space: nowrap;
            min-width: 80px;
        }
        .captcha-input {
            flex: 1;
            height: 38px;
            padding: 8px;
            text-align: center;
            font-size: 16px;
        }
        .captcha-code {
            background: #f0f0f0;
            padding: 8px 15px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 18px;
            user-select: none;
            letter-spacing: 3px;
            min-width: 80px;
            text-align: center;
        }
        [data-theme="dark"] .captcha-code {
            background: #2a2a2a;
            color: #fff;
        }
        .categories-list {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 20px !important;
            margin-top: 20px;
            width: 100%;
        }
        .category-item {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            position: relative;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .category-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            width: 100%;
        }
        .category-left {
            display: flex;
            align-items: center;
            gap: 15px;
            flex: 1;
        }
        .category-name {
            font-weight: bold;
            margin: 0;
            min-width: 120px;
            color: #333;
        }
        .category-info {
            color: #666;
            font-size: 14px;
        }
        .category-actions {
            display: flex;
            gap: 8px;
        }
        .link-form-row {
            display: flex;
            gap: 20px;
            align-items: center;
            margin-bottom: 15px;
            width: 100%;
        }
        #title, #description {
            min-width: 125px;
            max-width: 125px;
            flex: 1;
        }
        #url {
            min-width: 415px;
            max-width: 415px;
            flex: 1;
        }
        #categoryId {
            min-width: 120px;
            max-width: 120px;
        }
        #linkOrder {
            min-width: 80px;
            max-width: 80px;
            text-align: center;
        }
        .btn-add {
            min-width: 80px !important;
            max-width: 80px !important;
            width: 80px !important;
            padding: 6px 12px;
            flex: none !important;
        }
        .btn-danger {
            background: #dc3545 !important;  /* 红色背景 */
            color: white !important;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            padding: 8px 16px;
            transition: background-color 0.3s;
        }
        .btn-danger:hover {
            background: #c82333 !important;  /* 鼠标悬停时的深红色 */
        }
        .admin-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            align-items: center;
            margin-bottom: 20px;
        }
        .admin-actions .btn-primary {
            background: #007bff !important;
            color: white !important;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            padding: 8px 16px;
            transition: background-color 0.3s;
        }
        .admin-actions .btn-primary:hover {
            background: #0056b3 !important;
        }
        .admin-actions .btn-danger {
            background: #dc3545 !important;
            color: white !important;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            padding: 8px 16px;
            transition: background-color 0.3s;
        }
        .admin-actions .btn-danger:hover {
            background: #c82333 !important;
        }
    </style>
</head>
<body>
    <h1>导航管理</h1>
    <div id="loginForm">
        <div class="form-group">
            <input type="password" id="password" placeholder="请输入管理密码" required>
        </div>
        <div class="captcha-container">
            <input type="text" id="captcha" class="captcha-input" placeholder="验证码" required maxlength="4">
            <div class="captcha-code" id="captchaCode" onclick="refreshCaptcha()" style="cursor: pointer;" title="点击刷新验证码"></div>
        </div>
        <button onclick="login()">登录</button>
    </div>
    
    <div id="adminPanel" style="display: none;">
        <div class="admin-actions">
            <button onclick="backupToKV()" class="btn-primary">备份到KV</button>
            <button onclick="backupToLocal()" class="btn-primary">导出备份</button>
            <button onclick="showRestoreDialog()" class="btn-danger">恢复备份</button>
            <button onclick="logout()" class="btn-danger">退出登录</button>
            <a href="/" target="_blank" class="btn-primary">打开前端</a>
        </div>

        <div class="section">
            <div class="section-header">
                <h2>分类管理</h2>
                <form id="addCategoryForm" style="margin: 0;">
                    <div class="category-form-row">
                        <input type="text" id="categoryName" placeholder="分类名称" required>
                        <input type="number" id="categoryOrder" placeholder="排序">
                        <button type="submit" class="btn-add">添加分类</button>
                    </div>
                </form>
    
