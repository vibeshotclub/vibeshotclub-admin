# Vibe Shot Club Admin

AI 生成图片提示词管理后台。

## 技术栈

- **框架**: Next.js 16 (App Router)
- **UI**: Ant Design (深色主题)
- **数据库**: Supabase (PostgreSQL)
- **存储**: Cloudflare R2
- **认证**: JWT Cookie

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env.local` 并填写：

```bash
cp .env.example .env.local
```

必填变量：
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase 项目 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase 匿名 Key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase Service Role Key
- `R2_ENDPOINT` - Cloudflare R2 端点
- `R2_ACCESS_KEY_ID` - R2 Access Key
- `R2_SECRET_ACCESS_KEY` - R2 Secret Key
- `R2_BUCKET_NAME` - R2 Bucket 名称
- `R2_PUBLIC_URL` - R2 公开访问 URL
- `ADMIN_PASSWORD` - 管理员登录密码
- `ADMIN_JWT_SECRET` - JWT 密钥 (使用 `openssl rand -base64 32` 生成)

### 3. 初始化数据库

链接到 Supabase 项目：

```bash
npx supabase link --project-ref <your-project-ref>
```

推送数据库迁移：

```bash
npm run db:push
```

### 4. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run start` | 启动生产服务器 |
| `npm run db:push` | 推送迁移到 Supabase |
| `npm run db:diff` | 比较本地和远程 Schema 差异 |
| `npm run db:migration:new <name>` | 创建新迁移文件 |

## 项目结构

```
src/
├── app/
│   ├── api/          # API 路由
│   ├── login/        # 登录页
│   ├── prompts/      # 提示词管理
│   ├── tags/         # 标签管理
│   └── page.tsx      # Dashboard
├── components/
│   └── admin/        # 后台组件
├── hooks/            # React Hooks
├── lib/              # 工具函数
└── types/            # TypeScript 类型

supabase/
└── migrations/       # 数据库迁移文件
```
