# Editf

> AI 驱动的多模态创作平台 · 集成图片生成、视频创作、AI 编辑与一站式对话工作流

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwind-css)](https://tailwindcss.com)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-green)](https://orm.drizzle.team)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Editf 是一个面向创作者、设计团队和内容工作者的全栈 AI 创作平台。项目基于 **Next.js 16 (App Router) + React 19 + TypeScript + Drizzle ORM** 构建，支持中英双语，提供一站式的图像 / 视频生成与编辑、积分与订阅管理、推广返利、邮件订阅、Newsletter、Prompt 灵感库、后台统计与运营工具。

---

## 目录

- [项目亮点](#项目亮点)
- [技术栈](#技术栈)
- [系统架构](#系统架构)
- [目录结构](#目录结构)
- [环境要求](#环境要求)
- [本地启动](#本地启动)
- [关键脚本](#关键脚本)
- [环境变量](#环境变量)
- [数据库与迁移](#数据库与迁移)
- [国际化 (i18n)](#国际化-i18n)
- [AI 能力矩阵](#ai-能力矩阵)
  - [图片生成 / 编辑](#图片生成--编辑)
  - [视频生成](#视频生成)
  - [对话式创作工作流](#对话式创作工作流)
- [Prompt 灵感库](#prompt-灵感库)
- [积分与订阅体系](#积分与订阅体系)
- [支付与 Webhook](#支付与-webhook)
- [推广 / 推荐 / Affiliate 系统](#推广--推荐--affiliate-系统)
- [后台管理 (Admin)](#后台管理-admin)
- [后台任务 (Trigger.dev)](#后台任务-triggerdev)
- [邮件与 Newsletter](#邮件与-newsletter)
- [API 路由一览](#api-路由一览)
- [部署建议](#部署建议)
- [常见问题](#常见问题)
- [许可证](#许可证)

---

## 项目亮点

- **多模型 AI 创作**：基于 `Kie.ai` 接入 Nano Banana、GPT Image、Seedream、Seedance、Veo 3.1、Wan 2.7、HappyHorse、Kling、Gemini Omni、MiniMax H3 等十余种图文与视频模型，统一由 Kie.ai 进行配额与回执管理。
- **多模式视频生成**：支持文生视频、图生视频、首尾帧、多模态参考、视频编辑等多种模式，覆盖 1-15 秒、480p / 720p / 1080p / 4K 多种分辨率。
- **统一对话工作流**：基于 `chat_sessions` / `chat_messages` 表实现多会话管理，结合 Pusher 实时推送 Webhook 回执结果。
- **资产自动搬运**：通过 Trigger.dev 后台任务将生成结果（图片 / 视频）转存到 Cloudflare R2，生成永久可访问的 CDN 链接。
- **完善的积分 / 订阅体系**：注册赠送、每日登录、推荐奖励、订阅赠送、Stripe 一次性 / 循环扣款、自动清零赠送积分。
- **Affiliate + Referral 双轨返利**：独立的 30% 首单佣金体系（冻结 / 解冻 / 提现）与“邀请有礼”推荐体系。
- **管理后台与统计**：包含用户列表、积分调整、过期订阅清理、付费 / 订阅 / Newsletter / 推广等运营指标 Dashboard。
- **邮件、Newsletter 与法务页面**：集成 Resend 邮件服务，提供订阅、退订、订阅成功邮件、注册验证、密码重置等完整流程。
- **可观测与告警友好**：开发模式详细日志、生产模式静默，签名校验、频率限制、幂等记录等安全措施齐备。
- **Tailwind + shadcn/ui**：基于 Radix UI + lucide 图标 + Tailwind CSS 自定义赛博朋克配色，UI 现代、暗色为默认主题。

---

## 技术栈

| 分类 | 选型 |
| --- | --- |
| 前端框架 | [Next.js 16 (App Router)](https://nextjs.org) + React 19 |
| 编程语言 | TypeScript 5 (允许 JS)、ES2022 |
| 样式 | Tailwind CSS 3.4 + tailwindcss-animate + 自定义 Cyber 配色 |
| 组件库 | [shadcn/ui](https://ui.shadcn.com) (Radix UI) + lucide-react + react-icons |
| 表单 / 校验 | react-hook-form + zod + @hookform/resolvers |
| 国际化 | [next-intl 4](https://next-intl-docs.vercel.app) (`en` / `zh`) |
| 鉴权 | [NextAuth 4](https://next-auth.js.org) (Credentials + Google + GitHub) |
| ORM | [Drizzle ORM](https://orm.drizzle.team) + drizzle-kit |
| 数据库 | PostgreSQL (默认 Neon serverless) |
| 支付 | [Stripe](https://stripe.com) (订阅、积分包、Webhook) |
| 邮件 | [Resend](https://resend.com) |
| 实时 | [Pusher](https://pusher.com) (Server + Client) |
| 后台任务 | [Trigger.dev v4](https://trigger.dev) |
| 对象存储 | Cloudflare R2 (S3 兼容) via `@aws-sdk/client-s3` |
| AI 模型 | Kie.ai (OpenAI 兼容 / 自定义 endpoint) |
| 其他 | bcryptjs、nanoid、uuid、date-fns、recharts、vaul、embla-carousel-react、cmdk、react-day-picker、react-resizable-panels、sonner 等 |

---

## 系统架构

```text
┌──────────────────────────────────────────────────────────────────────┐
│                         Browser (React 19)                          │
│  - Next.js App Router (RSC + Client Components)                     │
│  - next-intl 客户端 + 服务端                                       │
│  - Pusher-js 实时订阅                                              │
└──────────────────────────────────────────────────────────────────────┘
                ▲ HTTP/SSE                ▼ REST
┌──────────────────────────────────────────────────────────────────────┐
│                        Next.js 16 服务端                            │
│  - NextAuth (Google / GitHub / Credentials)                        │
│  - Route Handlers: /api/*                                          │
│  - 业务模块: lib/auth · lib/points · lib/payments                  │
│  - AI 路由: /api/ai/kie/* · /api/ai/fal/*                          │
└──────────────────────────────────────────────────────────────────────┘
       │                            │                       │
       │ Drizzle ORM                │ Stripe SDK            │ fetch
       ▼                            ▼                       ▼
┌──────────────────┐      ┌──────────────────┐     ┌──────────────────┐
│   Neon Postgres  │      │   Stripe API     │     │  AI 提供方       │
│   (PostgreSQL)   │      │   (订阅/支付)    │     │  Kie.ai · fal.ai │
└──────────────────┘      └──────────────────┘     └──────────────────┘
                                                          │
                                                          ▼ 回调 Webhook
                                          ┌────────────────────────────┐
                                          │ /api/ai/kie/webhook        │
                                          │ /api/ai/kie/video-webhook  │
                                          │ /api/ai/kie/veo-webhook    │
                                          └────────────────────────────┘
                                                          │
                                                          ▼ 触发
                                          ┌────────────────────────────┐
                                          │   Trigger.dev 任务         │
                                          │ save-images-to-r2          │
                                          │ save-videos-to-r2          │
                                          └────────────────────────────┘
                                                          │
                                                          ▼
                                          ┌────────────────────────────┐
                                          │   Cloudflare R2 (S3)       │
                                          │   + Pusher 实时推送        │
                                          │   + Resend 邮件通知        │
                                          └────────────────────────────┘
```

---

## 目录结构

```text
editf/
├── app/                              # Next.js App Router 入口
│   ├── [locale]/                     # 多语言路由（en / zh）
│   │   ├── page.tsx                  # 首页（落地页）
│   │   ├── auth/                     # 登录 / 注册 / 找回密码 / 验证邮件
│   │   ├── chat/                     # 对话工作流（含 sessionId 子路由）
│   │   ├── dashboard/                # 支付成功页
│   │   ├── editor/                   # AI 编辑器
│   │   ├── projects/                 # 我的作品（生成历史）
│   │   ├── prompts/                  # Prompt 灵感库（公开浏览）
│   │   ├── pricing/                  # 套餐对比
│   │   ├── profile/                  # 个人中心
│   │   ├── admin/                    # 管理后台（需 admin 角色，单页 6 Tab）
│   │   │   └── page.tsx              #     入口（渲染 AdminDashboard）
│   │   ├── privacy/ · terms/ · cookies/ · unauthorized/ · newsletter/
│   │   └── layout.tsx                # 多语言 Layout（next-intl provider）
│   ├── api/                          # 服务端 API 路由
│   │   ├── auth/                     # NextAuth + 自定义注册 / 重置密码
│   │   ├── ai/                       # AI 能力入口（kie、fal）
│   │   ├── chat/                     # 会话 / 消息
│   │   ├── stripe/                   # Checkout / Webhook / Customer Portal
│   │   ├── user/                     # 个人 / 积分 / 订阅 / 历史
│   │   ├── points/                   # 积分扣减 / 流水
│   │   ├── affiliate/                # 推广返利（cookie + 佣金 + 提现）
│   │   ├── referral/                 # 邀请推荐（积分奖励）
│   │   ├── newsletter/               # 邮件订阅（含退订）
│   │   ├── prompts/                  # Prompt 库：C 端 GET / 后台 POST/PUT/DELETE
│   │   ├── upload/                   # 通用 base64 上传 → R2
│   │   └── admin/                    # 后台管理（详见 [后台管理 (Admin)](#后台管理-admin)）
│   ├── layout.tsx                    # 根 Layout（Theme + Session Provider）
│   ├── globals.css                   # Tailwind 全局样式
│   └── page.tsx · sitemap.ts
│
├── components/                       # 客户端组件库
│   ├── ui/                           # shadcn 基础组件
│   ├── landing/                      # 首页 / 落地页模块
│   ├── auth/ · admin/ · dashboard/   # 业务模块
│   ├── chat-interface.tsx            # 对话主界面（核心组件）
│   ├── chat-sidebar.tsx              # 会话侧边栏
│   ├── chat-layout-client.tsx        # 对话布局包装
│   ├── projects-content.tsx          # 作品列表
│   ├── operate.tsx                   # 编辑器
│   ├── admin/                        # 后台 6 大模块
│   │   ├── admin-dashboard.tsx       #   主容器（Tab 切换 + 概览 + 用户）
│   │   ├── admin-prompts.tsx         #   Prompt 管理（CRUD）
│   │   ├── user-stats.tsx            #   用户概览小卡片
│   │   ├── affiliate-management.tsx  #   推广审核
│   │   └── referral-management.tsx   #   推荐记录
│   ├── newsletter/                   # Newsletter 订阅组件
│   │   └── newsletter-stats.tsx      #   后台 Newsletter Tab
│   ├── navbar.tsx · footer.tsx · sidebar.tsx · pricing-section.tsx
│   ├── faq-section.tsx · hero-section.tsx · testimonials.tsx
│   └── ...
│
├── lib/                              # 核心业务逻辑
│   ├── auth.ts                       # NextAuth 配置（Credentials + OAuth）
│   ├── auth-utils.ts                 # getCurrentUser / isAdmin / requireAdmin
│   ├── db.ts                         # Drizzle + Neon 客户端
│   ├── schema.ts                     # 全量数据表定义
│   ├── stripe.ts                     # Stripe 客户端 + 套餐 / 价格配置
│   ├── payments.ts                   # 支付记录 CRUD / 统计
│   ├── points.ts                     # 积分增减 / 历史 / 类型
│   ├── points-manager.ts             # 积分使用 / 余额查询 / 过期清理
│   ├── referral.ts                   # 邀请推荐体系
│   ├── affiliate.ts                  # 推广返利（佣金 / 提现 / 关系）
│   ├── email.ts                      # Resend 邮件模板
│   ├── models-config.ts              # 图片 / 视频模型矩阵
│   ├── utils.ts · url.ts
│   └── ...
│
├── src/trigger/                      # Trigger.dev 后台任务
│   ├── save-images-to-r2.ts
│   └── save-videos-to-r2.ts
│
├── messages/                         # next-intl 文案
│   ├── en.json
│   └── zh.json
│
├── hooks/                            # 自定义 React Hooks
├── i18n/                             # next-intl 请求配置
├── drizzle/                          # Drizzle 迁移 SQL 与快照
├── public/                           # 静态资源
├── trigger.config.ts                 # Trigger.dev 任务配置
├── drizzle.config.ts                 # Drizzle Kit 配置
├── next.config.mjs · postcss.config.mjs
├── tailwind.config.ts                # 自定义 Tailwind 主题
├── tsconfig.json · components.json   # shadcn 配置
├── middleware.ts                     # next-intl 中间件
└── package.json
```

---

## 环境要求

- **Node.js**: >= 18.18（推荐 20 LTS）
- **包管理器**: 推荐 `npm`（仓库自带 `package-lock.json`，同时存在 `pnpm-lock.yaml` 兼容）
- **PostgreSQL**: >= 14（推荐 Neon serverless 或本地 Postgres）
- **外部服务账号**（按需启用）：
  - [Neon](https://neon.tech) / 任意 Postgres
  - [Stripe](https://stripe.com)
  - [Resend](https://resend.com)
  - [Pusher](https://pusher.com)
  - [Trigger.dev](https://trigger.dev)
  - [Cloudflare R2](https://cloudflare.com)（或任意 S3 兼容存储）
  - [Kie.ai](https://kie.ai)、[fal.ai](https://fal.ai)
  - Google / GitHub OAuth Client（如需社交登录）

---

## 本地启动

### 1. 安装依赖

```bash
npm install
```

> 仓库根目录已存在 `.npmrc` 设置 `legacy-peer-deps=true`，如使用其他包管理器请保持一致。

### 2. 准备环境变量

复制或创建 `.env.local`（生产环境请用平台 Secret 管理）：

```bash
cp .env.local .env.local.example  # 按需留档
# 然后按下一节内容补全密钥
```

### 3. 数据库初始化

```bash
# 生成 SQL（可选）
npm run db:generate

# 推送 schema（开发推荐）
npm run db:push

# 在生产环境执行迁移
npm run db:migrate
```

### 4. 启动开发服务

```bash
# 同时启动 Next.js 开发服务（端口 3000）
npm run dev

# 另一个终端：启动 Trigger.dev 本地开发（用于 R2 搬运任务）
npm run trigger:dev
```

打开 [http://localhost:3000](http://localhost:3000)，会自动跳转到 `/en` 或 `/zh`。

> `npm run dev` 内部会先执行 `npx kill-port 3000`，确保端口干净。

### 5. 生产构建

```bash
npm run build
npm run start
```

---

## 关键脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 杀掉 3000 端口并启动 `next dev` |
| `npm run build` | `next build` 生产构建 |
| `npm run start` | 启动生产服务 |
| `npm run lint` | `next lint` |
| `npm run db:generate` | 由 Drizzle Schema 生成 SQL 迁移 |
| `npm run db:migrate` | 应用迁移到数据库 |
| `npm run db:push` | 直接推送 schema 到数据库（开发） |
| `npm run db:studio` | 启动 Drizzle Studio（可视化数据库） |
| `npm run trigger:dev` | 启动 Trigger.dev 本地开发（运行后台任务） |

---

## 环境变量

> 以下变量为开发所需最小集合；生产请使用平台提供的 Secret 管理（Vercel 环境变量、AWS Secrets Manager 等）。

### 数据库 & 应用

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串（Neon 推荐） |
| `NEXTAUTH_URL` | NextAuth 公网回调地址 |
| `NEXTAUTH_SECRET` | NextAuth 加密密钥 |
| `NEXT_PUBLIC_BASE_URL` | 当前站点公网 URL（用于 SEO、邮件链接） |
| `NEXT_PUBLIC_APP_URL` | 同上（用于 Stripe 跳转等） |

### NextAuth OAuth

| 变量 | 说明 |
| --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google 登录 |
| `GITHUB_ID` / `GITHUB_SECRET` | GitHub 登录 |

### 邮件 (Resend)

| 变量 | 说明 |
| --- | --- |
| `RESEND_API_KEY` | Resend 密钥 |
| `RESEND_FROM_EMAIL` | 发件人邮箱 |
| `RESEND_BRAND_NAME` | 品牌名 |
| `RESEND_ADMIN_EMAIL` | 管理员邮箱 |

### Stripe

| 变量 | 说明 |
| --- | --- |
| `STRIPE_SECRET_KEY` | 服务端密钥 |
| `STRIPE_WEBHOOK_SECRET` | Webhook 签名校验密钥 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | 客户端公钥 |
| `STRIPE_TRIAL_PRICE_ID` | Trial 7 天价格 ID |
| `STRIPE_PRO_PRICE_ID` | Pro 月度价格 ID |
| `STRIPE_ANNUAL_PRICE_ID` | 年度价格 ID |
| `STRIPE_POINTS_STARTER_PRICE_ID` | 入门积分包 |
| `STRIPE_POINTS_POPULAR_PRICE_ID` | 热门积分包 |
| `STRIPE_POINTS_PREMIUM_PRICE_ID` | 高级积分包 |

### AI 提供方

| 变量 | 说明 |
| --- | --- |
| `KIE_API_KEY` | Kie.ai |
| `KIE_WEBHOOK_URL` | 图片 / 编辑 webhook 回调（公网可达） |
| `KIE_VIDEO_WEBHOOK_URL` | 视频 webhook 回调（公网可达） |
| `KIE_VEO_WEBHOOK_URL` | Veo 3.1 webhook 回调 |
| `KIE_WEBHOOK_HMAC_KEY` | Kie.ai Webhook HMAC 验签密钥 |

### 实时推送 (Pusher)

| 变量 | 说明 |
| --- | --- |
| `PUSHER_APP_ID` | App ID |
| `PUSHER_SECRET` | 服务端密钥 |
| `PUSHER_CLUSTER` | 集群 |
| `NEXT_PUBLIC_PUSHER_KEY` | 客户端 Key |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | 客户端集群 |

### 对象存储 (Cloudflare R2)

| 变量 | 说明 |
| --- | --- |
| `R2_ACCESS_KEY` | R2 Access Key |
| `R2_SECRET_KEY` | R2 Secret Key |
| `R2_ENDPOINT` | R2 S3 Endpoint |
| `R2_BUCKET` | Bucket 名称 |
| `R2_REGION` | 区域（通常 `auto`） |
| `R2_PUBLIC_URL` | 公开访问域名（CNAME） |
| `R2_PATH_PREFIX` | 可选：路径前缀（如 `/editf/`） |

### 后台任务 (Trigger.dev)

| 变量 | 说明 |
| --- | --- |
| `TRIGGER_ACCESS_TOKEN` | Trigger.dev CLI Token（用于本地开发） |

> 完整定义可参考仓库内的 `.env.local` 模板。

---

## 数据库与迁移

- ORM 配置文件：`drizzle.config.ts`
- Schema 定义：`lib/schema.ts`
- 迁移 SQL：`drizzle/*.sql`
- 数据库表概览：
  - `users` · `accounts` · `sessions` · `verificationTokens` · `emailVerificationTokens`
  - `newsletterSubscriptions` · `pointsHistory` · `stripePayments`
  - `referrals` · `referralHistory`
  - `affiliateProfiles` · `affiliateRelations` · `affiliateEarnings` · `affiliateWithdrawals`
  - `generationHistory` · `chatSessions` · `chatMessages` · `prompts`

```bash
# 重新生成迁移
npm run db:generate

# 本地推送（覆盖式）
npm run db:push

# 在生产环境执行迁移
npm run db:migrate

# 浏览数据
npm run db:studio
```

> ⚠️ `db:push` 会直接覆盖数据库，请勿在生产环境使用。

---

## 国际化 (i18n)

- 中间件：`middleware.ts` 强制 `/en` 或 `/zh` 路径前缀。
- 路由：`app/[locale]/...`
- 文案：`messages/en.json`、`messages/zh.json`
- 客户端 Provider：`NextIntlClientProvider`（`app/[locale]/layout.tsx`）
- 请求配置：`i18n/request.js`（按 locale 动态加载 messages）

新增文案步骤：

1. 在 `messages/en.json` 与 `messages/zh.json` 添加键值。
2. 在组件中通过 `useTranslations()`（客户端）或 `getTranslations()`（服务端）调用。
3. 若涉及新路由，请同时在 `middleware.ts` 的 `matcher` 中确认未被排除。

---

## AI 能力矩阵

> 详细模型参数、比例、分辨率、时长请见 `lib/models-config.ts`。

### 图片生成 / 编辑

- **入口**：
  - `/api/ai/kie/generate` — Kie.ai（多模型）
  - `/api/ai/kie/edit` — Kie.ai 编辑
- **模型**：`nanoBananaPro`、`nanoBanana2`、`nanoBanana2Lite`、`gptImage1_5`、`gptImage2`、`seedream5Lite`、`seedream5Pro`
- **模式**：文生图、图生图（编辑）、多比例（1:1 ~ 21:9）、1K / 2K / 4K 分辨率
- **积分消耗**：在路由内根据模型与分辨率计算（如 `seedream5Pro basic=10 / high=25`）

### 视频生成

- **入口**：
  - `/api/ai/kie/seedance`（Seedance 2.0 / Fast / Mini）
  - `/api/ai/kie/veo`（Veo 3.1 Quality / Fast / Lite）
  - `/api/ai/kie/wan`（Wan 2.7）
  - `/api/ai/kie/happyhorse` · `/api/ai/kie/happyhorse11`
  - `/api/ai/kie/kling30` · `/api/ai/kie/kling-v3-turbo`
  - `/api/ai/kie/gemini-omni-video`
  - `/api/ai/kie/minimax-h3`（MiniMax H3，文生/图生/首尾帧/参考生，2K=50积分）
- **支持模式**：`text2video` / `image2video` / `firstlast2video` / `reference2video` / `videoEdit`（按模型不同）
- **时长**：1-15 秒（按模型不同允许值不同）
- **分辨率**：480p / 720p / 1080p / 4K，以及 Kling 的 `Standard` / `Pro` / `4K`
- **音频**：部分模型支持自动音频生成
- **积分消耗**：以秒 × 分辨率计价，Veo 系列固定计费（Lite=50 / Fast=100 / Quality=400），MiniMax H3 固定 50 积分（2K，参考生 5 图以上 +15 积分/图）

### 对话式创作工作流

- **数据模型**：`chatSessions` / `chatMessages`
- **主组件**：`components/chat-interface.tsx`、`components/chat-sidebar.tsx`、`components/chat-layout-client.tsx`
- **API**：`/api/chat/sessions`、`/api/chat/messages`、`/api/chat/sessions/[id]`
- **实时通道**：Pusher 私有通道 `user-<userId>` 监听 `kie-result` 事件
- **触发器**：
  - 用户发送消息 → 创建 user + assistant（pending）消息 → 创建 `generationHistory` 记录
  - 调用 `/api/ai/kie/{generate|edit}` → 同步调用 Kie.ai（可带 `KIE_WEBHOOK_URL`）
  - 异步触发 `save-images-to-r2` / `save-videos-to-r2` 任务
  - Kie.ai 回调 → 更新数据库 + Pusher 推送 → 前端即时刷新

---

## Prompt 灵感库

> 面向 C 端用户的 Prompt 模板库，支持图片 / 视频两种类型，多分类与精选位；后台可对 Prompt 进行 CRUD。

### 1. 数据模型（`prompts` 表）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `text` | `nanoid()` 主键 |
| `type` | `text` | `image` / `video` |
| `mode` | `text` | `generate` / `edit` / `videoEdit` 等 |
| `prompt` | `text` | 提示词正文 |
| `categories` | `text` | JSON 字符串，例 `["portrait","landscape"]` |
| `thumbnailUrl` | `text` | 缩略图 R2 链接 |
| `videoDuration` | `integer` | 视频类专有（秒） |
| `videoResolution` | `text` | 视频类专有（480p/720p/1080p/4K） |
| `previewModel` | `text` | 关联的 AI 模型 key |
| `previewAspectRatio` | `text` | 关联的比例（16:9 / 9:16 / 1:1 ...） |
| `previewResolution` | `text` | 关联的分辨率 |
| `isActive` | `boolean` | C 端是否可见 |
| `isFeatured` | `boolean` | 是否精选（首页优先展示） |
| `sortOrder` | `integer` | 排序权重（越大越靠前） |
| `createdAt` / `updatedAt` | `timestamp` | 创建与更新时间 |

> ⚠️ `categories` 是 JSON 字符串，**没有单独的分类表**。查询使用 `LIKE %cat%`，多个分类为 OR 关系。

### 2. C 端 API

| 方法 | 路径 | 权限 | 行为 |
| --- | --- | --- | --- |
| `GET` | `/api/prompts?type=&categories=&featured=true&page=1&pageSize=20` | 公开 | 仅返回 `isActive=true`；按 `isFeatured desc, sortOrder desc, createdAt desc` 排序 |
| `GET` | `/api/prompts/[id]` | 公开 | 单条详情 |
| `POST` | `/api/prompts/upload` | 公开 | `base64` → R2，返回可访问 URL（用作缩略图） |

#### 查询参数

| 参数 | 取值 | 示例 |
| --- | --- | --- |
| `type` | `image` / `video` / `all` | `type=image` |
| `categories` | 逗号分隔的分类名（OR 关系） | `categories=portrait,landscape` |
| `featured` | `true` 仅精选 | `featured=true` |
| `page` / `pageSize` | 分页 | `page=2&pageSize=20` |

返回结构：

```json
{
  "data": [
    {
      "id": "abc123",
      "type": "image",
      "prompt": "A cinematic portrait...",
      "categories": ["portrait", "cinematic"],
      "thumbnailUrl": "https://cdn.example.com/...",
      "isFeatured": true,
      "sortOrder": 100
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "total": 86, "totalPages": 5 }
}
```

### 3. 后台 Prompt 管理 API

| 方法 | 路径 | 权限 | 行为 |
| --- | --- | --- | --- |
| `GET` | `/api/admin/prompts?type=&categories=&page=1&pageSize=20` | `isAdmin` | **包含 `isActive=false` 的全部 Prompt**，分页 |
| `POST` | `/api/prompts` | `isAdmin` | 创建；自动生成 `id = nanoid()` |
| `PUT` | `/api/prompts/[id]` | `isAdmin` | 局部更新（仅更新传入字段） |
| `DELETE` | `/api/prompts/[id]` | `isAdmin` | 硬删除（不可恢复，建议改为 `isActive=false`） |

#### 创建 / 更新字段

```json
{
  "type": "image",
  "mode": "generate",
  "prompt": "A cinematic portrait of a young woman...",
  "categories": ["portrait", "cinematic"],
  "thumbnailUrl": "https://cdn.example.com/editf/prompts/abc.webp",
  "previewModel": "nanoBananaPro",
  "previewAspectRatio": "3:4",
  "previewResolution": "2K",
  "isActive": true,
  "isFeatured": true,
  "sortOrder": 100
}
```

视频类型额外字段：

```json
{
  "type": "video",
  "videoDuration": 5,
  "videoResolution": "1080p",
  "previewModel": "seedance2",
  "previewAspectRatio": "16:9"
}
```

### 4. 完整使用流程（C 端）

1. 用户进入 `/[locale]/prompts`
2. 顶部筛选 `type` 与多选 `categories`
3. 点击 Prompt 卡片 → 调用 `components/chat-interface.tsx` 注入 Prompt 逻辑
4. 自动写入：消息框内容、`previewModel`、`previewAspectRatio`、`previewResolution`
5. 用户可直接点击发送，复用 `prompt` 作为消息正文

### 5. 完整运营流程（后台）

1. 进入后台 `#prompts` Tab（`components/admin/admin-prompts.tsx`）
2. 调用 `/api/prompts/upload` 上传缩略图（base64），得到 `thumbnailUrl`
3. 填写表单：标题 / 分类 / 模型 / 比例 / 分辨率
4. 设置 `isActive` / `isFeatured` / `sortOrder`
5. 提交 → `POST /api/prompts`（创建）或 `PUT /api/prompts/[id]`（更新）

### 6. 分类管理

由于分类存储在 Prompt 行的 JSON 字段中，没有独立表，运营流程：

- **新增分类**：在下拉框中输入新名称，创建 Prompt 时自动落入该 Prompt 的 `categories`
- **合并分类**：跨多条 Prompt 改写 `categories` 字段
- **删除分类**：将所有含此分类的 Prompt 的 `categories` 改写为不含它的数组
- **筛选**：`?categories=portrait,landscape` 命中任意一个即可（OR 关系）

### 7. 字段语义速查

| 字段 | 影响 | 建议 |
| --- | --- | --- |
| `isActive` | C 端可见性 | 默认 `true`；下线改为 `false`（推荐） |
| `isFeatured` | 首页精选位 | 同 `type` 下建议不超过 6 条 |
| `sortOrder` | 同分区排序 | 建议间隔 10（100、90、80）便于插入 |
| `previewModel` | 自动选模型 | 应与 `components/chat-interface.tsx` 中模型 key 保持一致 |
| `previewAspectRatio` | 自动选比例 | 应是模型支持的比例之一 |
| `previewResolution` | 自动选分辨率 | 应是模型支持的分辨率之一 |

---

> 实现细节见 `lib/points.ts`、`lib/points-manager.ts`、`lib/stripe.ts`、`lib/payments.ts`。

### 积分类型

- `purchased` — 购买的积分（永不过期，优先扣除顺序最低）
- `gifted` — 订阅赠送的积分（订阅到期或取消时清零，优先消耗）

### 关键规则

- 注册赠送 `POINTS_CONFIG.REGISTER_BONUS = 20`
- 每日登录奖励 `DAILY_LOGIN_BONUS = 10`
- 推荐奖励 `REFERRAL_BONUS = 200`
- 使用积分时优先消耗 `gifted`，不足部分消耗 `purchased`
- 订阅到期自动清零 `giftedPoints`（同步在 `/api/user/subscription` 与 `/api/user/points` 检测）

### 套餐

| 套餐 | 价格 | 周期 | 赠送积分 |
| --- | --- | --- | --- |
| Trial | $4.99 | 7 天（一次性） | 500 |
| Pro | $15.9 (原价 $19.9) | 月度 | 2000 |
| Annual | $159 (原价 $240) | 年度 | 25000 |
| Enterprise | 联系销售 | 自定义 | 0 |

> 详见 `lib/stripe.ts` 的 `SUBSCRIPTION_PRODUCTS` 与 `POINTS_PRODUCTS`。

### 积分包

| 套餐 | 积分 | 价格 |
| --- | --- | --- |
| Starter | 500 | $8 |
| Popular | 1000 | $15 |
| Premium | 15000 | $150 |

---

## 支付与 Webhook

- Stripe Checkout：`/api/stripe/checkout`、`/api/stripe/create-checkout-session`
- 订阅升级/降级保护：禁止 Annual → Pro 降级；Trial 仅允许购买一次
- Webhook：`/api/stripe/webhook` 处理
  - `payment_intent.succeeded` — 积分购买
  - `checkout.session.completed` — 订阅创建 / Trial 一次性支付 / 积分购买
  - `customer.subscription.updated` — 续费（保持累加到期时间）
  - `customer.subscription.deleted` — 取消（清零赠送积分）
  - `invoice.payment_failed` — 标记 `past_due`
  - `charge.refunded` — Affiliate 佣金回滚
- 客户门户：`/api/stripe/customer-portal`

> Webhook 事件均通过 `webhookEventId` 与 `checkoutSessionId` 做幂等性检查；处理失败会返回 500 让 Stripe 重试。

---

## 推广 / 推荐 / Affiliate 系统

项目同时维护两套并行的体系，互不冲突：

### 1. Referral（邀请推荐）

面向 C 端用户的「邀请有礼」机制，目标是拉新。

#### 数据模型

| 表 | 关键字段 | 说明 |
| --- | --- | --- |
| `referrals` | `referrerId`, `referredId`, `referralCode`, `status` | 一条记录代表一对邀请关系 |
| `referralHistory` | `referrerId`, `referredId`, `action`, `pointsAwarded`, `description` | 邀请奖励流水 |
| `users` | `referralCode`, `referredBy` | 用户自身携带的邀请码与邀请人 |

#### 完整流程

1. 用户 A 访问 `https://site.com/?ref=ALICE` 注册
2. 注册接口把 `ALICE` 写入 `users.referredBy`，同时生成 `referrals` 记录
3. **注册完成时**注册双方各得 `REGISTER_REFERRAL_BONUS`（双方奖励，可配置）
4. **被邀请者首次订阅时**触发 `subscription_reward`：邀请者额外获得积分（`REFERRAL_BONUS = 200`）或延长订阅天数
5. 所有奖励写入 `referralHistory`，`action` 字段标识：`register_reward` / `subscription_reward`

#### 关键 API

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| `GET` | `/api/referral/stats` | 当前用户的邀请概览（邀请人数、转化、累计奖励） |
| `GET` | `/api/referral/rewards` | 当前用户的奖励明细 |
| `GET` | `/api/referral/records` | 当前用户的邀请记录列表（被邀请者、状态、奖励） |
| `PUT` | `/api/referral/update-code` | 修改自己的邀请码（需唯一性校验） |
| `GET` | `/api/user/referral` | 个人中心的 Referral 数据 |

#### 字段含义

- `status`：`pending`（被邀请者尚未付费）/ `active`（已转化）/ `expired`（邀请码过期）
- `pointsAwarded`：本次动作发放的积分

### 2. Affiliate（推广返利）

面向 KOL / 经销商的「30% 返佣」机制，独立 Cookie 跟踪。

#### 数据模型

| 表 | 关键字段 | 说明 |
| --- | --- | --- |
| `affiliateProfiles` | `userId`, `affiliateCode`, `payoutMethod` | 推广者档案与收款方式 |
| `affiliateRelations` | `affiliateUserId`, `referredUserId`, `createdAt` | 推广者与被推广人的关系 |
| `affiliateEarnings` | `affiliateUserId`, `relatedUserId`, `amount`, `status`, `releaseAt` | 佣金流水（pending → released） |
| `affiliateWithdrawals` | `affiliateUserId`, `amount`, `method`, `status` | 提现记录 |

#### 完整流程

1. 用户访问 `https://site.com/?aff=BOB123`，`lib/utils.ts` 的 `setAffiliateCookie()` 写入 30 天 `SameSite=Lax` Cookie
2. 注册时读取 Cookie，创建 `affiliateRelations` 记录
3. 被推广者首次付费（订阅或积分包）→ 触发 `affiliateEarnings` 写入，`amount = order_amount × 30%`
4. 佣金默认 `status='pending'` 且 `releaseAt = now() + 7 days`（7 天冻结期，防退款套利）
5. 冻结期过后定时（或下次查询时）状态置 `released`，可申请提现
6. 用户在 `/profile` 发起提现 → `/api/affiliate/withdraw` → 写入 `affiliateWithdrawals`，管理员审核 → 标记 `COMPLETED`

#### 退款回滚

Stripe 回调 `charge.refunded` 时：

- 找到对应的 `affiliateEarnings`（按 `relatedUserId` + `createdAt` 匹配）
- 若 `status='pending'`：直接删除
- 若 `status='released'`：从用户余额扣回（`giftedPoints` 或新增负向流水）

#### 关键 API

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| `GET` | `/api/affiliate/stats` | 当前推广者总览（佣金余额、已提现、待释放） |
| `GET` | `/api/affiliate/relations` | 推广关系列表 |
| `GET` | `/api/affiliate/earnings` | 佣金明细（pending / released） |
| `GET` | `/api/affiliate/withdrawals` | 提现记录 |
| `POST` | `/api/affiliate/withdraw` | 发起提现请求 |
| `PUT` | `/api/affiliate/update-code` | 修改推广码 |

#### 后台审核

后台 `#affiliate` Tab（`components/admin/affiliate-management.tsx`）展示：

- 推广者列表（总佣金、待释放、已提现、关系数）
- 提现待审核列表（按 `status='PENDING'` 过滤）
- 佣金异常波动告警（按周环比）

### 3. Referral vs Affiliate 对比

| 维度 | Referral | Affiliate |
| --- | --- | --- |
| 适用人群 | 所有 C 端用户 | KOL / 经销商（需开通） |
| 跟踪机制 | `?ref=` URL 参数 + `referredBy` 字段 | 30 天 Cookie（`?aff=`） |
| 奖励形式 | 双方积分 + 延长订阅 | 现金佣金（PayPal / 支付宝） |
| 结算时点 | 注册 / 订阅即发 | 冻结 7 天后释放 |
| 退款回滚 | 简单（扣除积分） | 复杂（涉及已提现余额） |
| 主要 API | `/api/referral/*` | `/api/affiliate/*` |

> 一个用户可以同时是被 Referral 和被 Affiliate 推广的对象，两条流水独立记账。

### 4. 安全注意

| 风险 | 现状 | 建议 |
| --- | --- | --- |
| 自邀请（自己邀请自己） | 通过 IP + UA + 邮箱相似度启发式校验 | 上线前增加严格的反作弊规则 |
| Affiliate Cookie 劫持 | 默认 `SameSite=Lax` | 如需子域名追踪可改为 `SameSite=None; Secure` |
| 佣金套现 | 7 天冻结期 | 可按客单价分层调整冻结期 |

---

## 后台管理 (Admin)

> 入口：`/[locale]/admin`。所有接口均通过 `lib/auth-utils.ts` 的 `isAdmin()` 守卫，仅 `users.role = 'admin'` 可访问。

### 1. 启用首位管理员

部署后第一次访问后台前，需要先把某个用户标记为管理员：

```bash
# 方式 A：GET 接口（最方便）
curl "https://your-domain/api/admin/set-admin?email=admin@example.com"

# 方式 B：POST 接口
curl -X POST https://your-domain/api/admin/set-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com"}'
```

> ⚠️ 该接口**未做权限校验**，仅供首次初始化使用。请在初始化后立即配置好 `NEXTAUTH_SECRET`、限制管理后台入口或在网关层做访问控制（或将 `set-admin` 路由文件移出生产部署）。

### 2. 模块总览

后台分为 6 个 Tab（`AdminSection` 类型在 `components/admin/admin-dashboard.tsx`）：

| Tab | 组件 | 后端 API | 职责 |
| --- | --- | --- | --- |
| **概览（overview）** | `admin-dashboard.tsx` | `/api/admin/statistics?type=overview\|trends` | 12 项核心指标 + 30 天趋势图 |
| **用户管理（users）** | `admin-dashboard.tsx` | `/api/admin/users`、`/api/admin/users/[userId]` | 用户检索、积分调整、订阅管理、角色变更 |
| **Newsletter（newsletter）** | `components/newsletter/newsletter-stats.tsx` | `/api/newsletter/*` | 邮件订阅者统计与列表 |
| **推荐（referral）** | `components/admin/referral-management.tsx` | `/api/admin/referrals` | Referral 邀请关系与奖励记录 |
| **推广（affiliate）** | `components/admin/affiliate-management.tsx` | `/api/admin/affiliates` | 推广者、佣金、提现审核 |
| **Prompt 管理（prompts）** | `components/admin/admin-prompts.tsx` | `/api/admin/prompts`、`/api/prompts` | Prompt 灵感库 CRUD |

Tab 状态通过 URL hash（`#users`、`#prompts` 等）+ `localStorage` 同步，刷新或切换语言后保持。

### 3. 概览 Dashboard

`GET /api/admin/statistics?type=overview` 返回 12 项原子指标：

```text
{
  totalUsers,                  // 注册用户总数
  subscribedUsers,             // 当前有效订阅（active 且 period_end > NOW）
  subscriptionRevenue,         // 订阅总收入（美分）
  pointsPurchaseRevenue,       // 积分包总收入（美分）
  totalPoints,                 // 全站积分池总和
  totalReferrals,              // 推荐关系总数
  referralSubscribedCount,     // 推荐转化订阅数
  referralRewardPoints,        // 累计发放的推荐奖励积分
  affiliateCount,              // 推广关系数
  affiliateTotalEarnings,      // 累计佣金（美分）
  affiliateTotalWithdrawals,   // 累计成功提现（美分）
  newsletterSubscribers        // 活跃 Newsletter 订阅者
}
```

`GET /api/admin/statistics?type=trends&days=30` 返回 3 条曲线（按天）：

- `registrationTrends` — 注册人数
- `subscriptionTrends` — 订阅开通数 + 收入
- `revenueTrends` — 总收入（订阅 + 积分包）

> 后端会先生成完整的日期序列再回填数据，避免曲线出现断层。

### 4. 用户管理

#### 4.1 列表 / 筛选 / 搜索

`GET /api/admin/users?action=list&page=1&limit=10&search=&role=&emailVerified=&subscriptionStatus=`

支持筛选项：

| 参数 | 含义 | 示例 |
| --- | --- | --- |
| `search` | 邮箱 / 姓名模糊匹配 | `search=alice` |
| `role` | `user` / `admin` | `role=admin` |
| `emailVerified` | `true` / `false` | `emailVerified=true` |
| `subscriptionStatus` | `active` / `cancelled` / `past_due` / `paused` / `none` | `subscriptionStatus=active` |

返回结构：

```json
{
  "users": [
    {
      "id": "...", "email": "...", "name": "...",
      "role": "user", "emailVerified": "2025-01-01T00:00:00Z",
      "points": 1200, "purchasedPoints": 200, "giftedPoints": 1000,
      "subscriptionStatus": "active", "subscriptionPlan": "pro",
      "subscriptionCurrentPeriodEnd": "2025-12-31T00:00:00Z",
      "createdAt": "...", "updatedAt": "..."
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 123, "totalPages": 13 }
}
```

#### 4.2 自动清理过期订阅

返回列表前，后端会扫描该分页内所有用户，若发现 `subscriptionStatus='active'` 且 `subscriptionCurrentPeriodEnd < NOW()`，则：

1. 把 `subscriptionStatus` / `subscriptionPlan` 置空
2. 若 `giftedPoints > 0` 则扣减并清零（`points` 同步减少）
3. 写入 `pointsHistory` 记录：`action='subscription_expired'`

因此管理员看到的列表**永远是最新状态**。

#### 4.3 单用户操作

`PUT /api/admin/users/[userId]` 通过 `action` 字段分发：

##### `action=updateRole`

```json
{ "userId": "abc", "action": "updateRole", "role": "admin" }
```
仅允许 `user` ↔ `admin`，非法值返回 400。

##### `action=adjustPoints`

```json
{
  "userId": "abc",
  "action": "adjustPoints",
  "points": 500,           // 正数=增加；负数=扣除
  "pointsType": "purchased", // "purchased" | "gifted"
  "description": "客户补偿"
}
```

校验规则：

- `pointsType=gifted` 且 `points>0` 时，**必须**用户当前有有效订阅（`subscriptionCurrentPeriodEnd > NOW`），否则 400。
- `pointsType=gifted` 且 `points<0` 时，扣除量不能超过当前 `giftedPoints`。
- `points<0` 时，结果 `points` 不能为负数。
- 写入 `pointsHistory`：`action='manual'`，描述默认 `管理员增加/扣除购买/赠送积分`。

##### `action=updateSubscription`

```json
{
  "userId": "abc",
  "action": "updateSubscription",
  "subscriptionStatus": "active",
  "subscriptionPlan": "pro",
  "subscriptionEndDate": "2026-12-31T23:59:59Z"
}
```

当 `subscriptionStatus='active'` 且 `subscriptionPlan ∈ {trial, pro, annual}` 时，会自动调用 `getSubscriptionGiftedPoints()` 赠送积分（500 / 2000 / 25000）并写入 `pointsHistory`（`action='subscription_gift'`）。

#### 4.4 概览统计

`GET /api/admin/users?action=stats` 返回 6 个汇总：

```text
totalUsers, verifiedUsers, adminUsers, subscribedUsers, totalPoints, totalPayments
```

### 5. Newsletter / Referral / Affiliate 管理

后台对应 3 个 Tab（`components/newsletter/newsletter-stats.tsx`、`components/admin/referral-management.tsx`、`components/admin/affiliate-management.tsx`）：

| Tab | 数据源 | 常用操作 |
| --- | --- | --- |
| `#newsletter` | `newsletterSubscriptions` | 列表查看、来源分布、退订记录 |
| `#referral` | `referrals` + `referralHistory` | 邀请关系列表、奖励发放、对账 |
| `#affiliate` | `affiliateProfiles` + `affiliateEarnings` + `affiliateWithdrawals` | 推广者概览、佣金明细、提现审核 |

> 详细 API、流程与字段语义见 [Prompt 灵感库](#prompt-灵感库) / [推广 / 推荐 / Affiliate 系统](#推广--推荐--affiliate-系统) / [邮件与 Newsletter](#邮件与-newsletter)。

### 6. 安全注意

| 风险 | 现状 | 建议 |
| --- | --- | --- |
| `/api/admin/set-admin` 无鉴权 | 依赖部署时的人工约束 | 上线前移除该路由，或在网关层限制 IP |
| 后台修改无操作日志 | 仅依赖 `pointsHistory` / 业务表自带的 `updatedAt` | 建议增加 `adminAuditLogs` 表 |
| 用户积分可手动增减 | 由前端操作 | 重要操作建议加二次确认 + 邮件通知用户 |
| Prompt 硬删除 | 不可恢复 | 建议改为 `isActive=false` 软删除 |
| Affiliate Cookie 劫持 | 默认 `SameSite=Lax` | 如需子域名追踪可改为 `SameSite=None; Secure` |
| Referral 自邀请 | 启发式校验 | 上线前增加严格的反作弊规则 |

---

## 后台任务 (Trigger.dev)

`trigger.config.ts` 注册项目为 `proj_cunixneebkjyauyjhcko`，最大时长 300s，自动重试。

| 任务 ID | 入参 | 作用 |
| --- | --- | --- |
| `save-images-to-r2` | `{ imageUrls, recordId, userId, chatMessageId? }` | 串行下载图片 → 上传 R2 → 更新 `generationHistory` / `chatMessages` 为 `completed` |
| `save-videos-to-r2` | `{ videoUrls, recordId, userId, chatMessageId? }` | 串行下载视频 → 上传 R2 → 更新数据库（视频任务优先串行避免带宽抖动） |

启动方式：

```bash
npm run trigger:dev   # 本地任务运行器
```

部署到 Trigger.dev 平台时，请通过官方 CLI 登录并 deploy。

---

## 邮件与 Newsletter

邮件服务统一接入 [Resend](https://resend.com)，覆盖注册验证、密码重置、订阅成功、积分购买成功、Newsletter 等模板。

### 1. 邮件模板（`lib/email.ts`）

| 模板 | 触发场景 | 关键变量 |
| --- | --- | --- |
| 注册验证 | 用户邮箱注册 / OAuth 注册 | `verificationUrl`, `userName`, `locale` |
| 重发验证 | 用户主动重发 | 同上 |
| 密码重置 | `POST /api/auth/forgot-password` | `resetUrl`, `userName` |
| 订阅成功 | Stripe `checkout.session.completed` (subscription) | `planName`, `giftedPoints`, `endDate` |
| 积分购买成功 | Stripe 积分包支付成功 | `points`, `amount`, `productName` |
| Newsletter 订阅确认 | 用户在落地页订阅 | `confirmationUrl`, `locale` |

### 2. Newsletter 数据模型（`newsletterSubscriptions` 表）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `uuid` | 主键 |
| `email` | `text` | 邮箱（唯一） |
| `locale` | `text` | 订阅时的语言（`en` / `zh`），用于邮件本地化 |
| `isActive` | `boolean` | 是否激活（取消订阅后置 `false`） |
| `unsubscribeToken` | `text` | 退订链接 token（UUID） |
| `source` | `text` | 来源标识（落地页 / footer / 文章末尾等） |
| `createdAt` / `updatedAt` | `timestamp` | 时间戳 |
| `subscribedAt` | `timestamp` | 实际订阅时间 |
| `unsubscribedAt` | `timestamp` | 取消订阅时间 |

### 3. Newsletter API

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| `POST` | `/api/newsletter/subscribe` | 接收 `email` + `locale` + `source`，生成 `unsubscribeToken`；重复邮箱自动 `isActive=true`；触发欢迎邮件 |
| `POST` | `/api/newsletter/unsubscribe` | 接收 `email` 或 `token`，置 `isActive=false`，写 `unsubscribedAt` |

> 退订链接通常拼接在每封邮件底部，格式：`{NEXT_PUBLIC_BASE_URL}/newsletter/unsubscribe?token=xxx`。

### 4. 频率限制

- `POST /api/newsletter/subscribe`：同一 IP / 邮箱 1 分钟内最多 3 次（默认）
- 触发限制时返回 `429`，由 `lib/email.ts` 中的 `rateLimiter` 维护

### 5. 邮件语言策略

邮件语言按以下优先级选择：

1. 用户注册时填写的 `locale`（写入 `users.locale`）
2. Newsletter 订阅时传入的 `locale`
3. 兜底为 `en`

### 6. 后台 Newsletter Tab

`components/newsletter/newsletter-stats.tsx` 提供：

- 订阅者总数 / 7 天新增 / 30 天新增
- 退订数 / 净增长
- 来源分布（按 `source` 字段）
- 订阅者列表（按时间倒序，分页，支持搜索邮箱）

后端调用 `/api/admin/statistics?type=overview` 中的 `newsletterSubscribers` 字段获取总数。

---

## API 路由一览

> 完整路由请见 `app/api/**/route.ts`。下面是按模块划分的概览：

### 鉴权 & 用户

- `POST /api/auth/register` — 邮箱注册（含推荐 / Affiliate Cookie 处理）
- `GET  /api/auth/verify-email?token=` — 邮箱验证
- `POST /api/auth/resend-verification` — 重发验证邮件
- `POST /api/auth/forgot-password` · `POST /api/auth/reset-password`
- `POST /api/auth/oauth-referral` · `POST /api/auth/oauth-affiliate`
- `GET/POST /api/auth/[...nextauth]` — NextAuth
- `GET/PUT /api/user/profile` · `GET /api/user/connected-accounts`
- `PUT /api/user/change-password`
- `GET /api/user/points` · `GET /api/user/points-detail` · `POST /api/user/points/deduct`
- `GET /api/user/subscription` · `GET /api/user/payments`
- `GET /api/user/generation-history` · `GET /api/user/referral`

### 对话与作品

- `GET/POST /api/chat/sessions` · `GET/DELETE /api/chat/sessions/[id]`
- `GET/POST /api/chat/messages`
- `GET /api/prompts` · `GET /api/prompts/[id]` · `POST /api/prompts/upload`（C 端，可选 `featured` / `categories` / `type` 筛选）
- `POST /api/prompts` · `PUT /api/prompts/[id]` · `DELETE /api/prompts/[id]`（**需要管理员**；见 [Prompt 灵感库](#prompt-灵感库)）

### AI 生成

- `POST /api/ai/kie/generate` · `POST /api/ai/kie/edit`
- `POST /api/ai/kie/seedance` · `POST /api/ai/kie/veo` · `POST /api/ai/kie/wan`
- `POST /api/ai/kie/happyhorse` · `POST /api/ai/kie/happyhorse11`
- `POST /api/ai/kie/kling30` · `POST /api/ai/kie/kling-v3-turbo`
- `POST /api/ai/kie/gemini-omni-video` · `POST /api/ai/kie/minimax-h3`
- `POST /api/ai/kie/download-url`
- `POST /api/ai/kie/webhook` · `POST /api/ai/kie/video-webhook` · `POST /api/ai/kie/veo-webhook`

### 支付

- `POST /api/stripe/checkout` · `POST /api/stripe/create-checkout-session`
- `POST /api/stripe/customer-portal`
- `POST /api/stripe/webhook`

### 推广 / 推荐

- `GET /api/affiliate/stats` · `GET /api/affiliate/relations`
- `GET /api/affiliate/earnings` · `GET /api/affiliate/withdrawals`
- `POST /api/affiliate/withdraw` · `PUT /api/affiliate/update-code`
- `GET /api/referral/stats` · `GET /api/referral/rewards`
- `GET /api/referral/records` · `PUT /api/referral/update-code`

### Newsletter

- `POST /api/newsletter/subscribe` · `POST /api/newsletter/unsubscribe`

### 管理后台

- `GET/PUT /api/admin/users?action=stats|list` · `GET/PUT /api/admin/users/[userId]`
- `GET /api/admin/statistics?type=overview|trends&days=30`
- `GET /api/admin/prompts?type=&categories=&page=1`（后台专用，**包含已禁用的 Prompt**）
- `GET /api/admin/affiliates` · `GET /api/admin/referrals`
- `GET/POST /api/admin/set-admin?email=...`（**仅供初始化用，无鉴权**）

### 通用上传

- `POST /api/upload` — base64 → R2，自动尝试多个公开 URL

---

## 部署建议

### 推荐架构

- **Web**：Vercel（Next.js 16 原生支持），或自托管 Node 20 + 反向代理（Nginx / Caddy）
- **数据库**：Neon serverless / Supabase / RDS
- **后台任务**：Trigger.dev Cloud
- **对象存储**：Cloudflare R2（或自建 MinIO）
- **实时**：Pusher Cloud

### 部署前检查清单

1. **环境变量**：所有上述密钥都已写入部署平台的 Secret 中。
2. **Webhook 公网回调**：在 Kie.ai 后台配置 `KIE_WEBHOOK_URL` 等三个 URL 指向生产域名 + 路径。
3. **Stripe Webhook**：在 Stripe 控制台注册 `https://your-domain/api/stripe/webhook`。
4. **数据库迁移**：使用 `npm run db:migrate`（不要 `db:push`）。
5. **管理员账号**：上线后手动将首个用户的 `users.role` 设为 `admin`。
6. **CORS & Cookie**：
   - `NEXTAUTH_URL`、`NEXT_PUBLIC_BASE_URL` 必须使用 HTTPS 域名。
   - NextAuth Cookie 默认 `Secure`，本地开发需关闭或在浏览器允许不安全 Cookie。
7. **Trigger.dev 部署**：通过 `npx trigger.dev@latest deploy` 推送项目到云端。
8. **R2 桶权限**：确保服务端有 `PutObject` 权限，`R2_PUBLIC_URL` 配置的 CDN 已开启公开读。
9. **Next.js 配置**：`next.config.mjs` 已关闭 `images.unoptimized`，如需优化远程图片请调整。
10. **TypeScript**：`typescript.ignoreBuildErrors = true`（默认开启），建议在 CI 中另开 `tsc --noEmit` 兜底。

---

## 常见问题

<details>
<summary><strong>启动后看不到中文/英文切换？</strong></summary>

访问 `/en` 或 `/zh` 显式路径；中间件 `middleware.ts` 强制 `localePrefix: 'always'`。

</details>

<details>
<summary><strong>为什么积分扣了但图片未生成？</strong></summary>

- 检查 `KIE_API_KEY` 是否有效。
- 检查 Stripe / Kie.ai 后台是否触发了退款。
- 查看 `generationHistory.status` 是否被 Webhook 写为 `error`。
- 触发器任务失败时 `imageUrls` 仍是临时链接，`save-images-to-r2` 可重跑。

</details>

<details>
<summary><strong>WebHook 验签失败？</strong></summary>

- Stripe：检查 `STRIPE_WEBHOOK_SECRET` 与 Stripe 控制台签名密钥一致。
- Kie.ai：需要同时配置 `KIE_WEBHOOK_HMAC_KEY` 并保证本地时区一致。算法：`HMAC-SHA256(taskId.timestamp, secret)`。

</details>

<details>
<summary><strong>想新增一个 AI 模型？</strong></summary>

1. 在 `lib/models-config.ts` 注册模型与约束。
2. 在 `app/api/ai/kie/*` 新建路由（或在 `generate` 中加入映射）。
3. 在 `components/chat-interface.tsx` 等 UI 中暴露选项。
4. 在 `messages/{en,zh}.json` 添加文案。

</details>

<details>
<summary><strong>如何调试 Trigger.dev 任务？</strong></summary>

`npm run trigger:dev` 会在本地启动 worker 并打印日志；也可以在 Trigger.dev 控制台的 Runs 页面查看历史。

</details>

<details>
<summary><strong>如何成为第一位管理员？</strong></summary>

部署完成后访问 `GET /api/admin/set-admin?email=your@email.com`（需先注册该邮箱账号）。该接口无鉴权，**仅供初始化使用**，上线后请通过网关限制访问或删除路由文件。

</details>

<details>
<summary><strong>后台修改用户积分有审计吗？</strong></summary>

当前仅写入 `pointsHistory`（`action='manual'`），没有独立的 `adminAuditLogs` 表。重要操作建议在 `lib/audit.ts` 自建审计模块，或升级前增加 `pointsHistory` 的 `operatorId` 字段。

</details>

<details>
<summary><strong>如何让 Prompt 在 C 端首页展示？</strong></summary>

后台创建 / 编辑 Prompt 时，把 `isFeatured` 勾选为 `true`，并设置 `isActive=true` 与合适的 `sortOrder`（建议 100、90、80 间隔）。首页 `/?featured=true` 接口会优先返回这些记录。

</details>

<details>
<summary><strong>Prompt 分类怎么管理？</strong></summary>

分类不存于独立表，而是 Prompt 行的 JSON 字段。新增：在创建表单下拉中输入新名称。合并：跨多条 Prompt 改写 `categories`。筛选：`?categories=a,b` 为 OR 关系。

</details>

<details>
<summary><strong>Affiliate 佣金被退款时怎么处理？</strong></summary>

Stripe 回调 `charge.refunded` 时：

- 若佣金 `status='pending'`：直接删除
- 若 `status='released'`：从推广者余额扣回，写一条负向 `affiliateEarnings`

详见 [推广 / 推荐 / Affiliate 系统](#4-安全注意)。

</details>

<details>
<summary><strong>如何调整 Newsletter 邮件语言？</strong></summary>

邮件语言优先级：1) `users.locale`（注册时） → 2) 订阅时传入的 `locale` → 3) 兜底 `en`。要修改用户语言请直接更新 `users.locale` 字段。

</details>

---

## 许可证

本项目基于 **MIT License** 完全开源发布。

```
MIT License

Copyright (c) Editf Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- 欢迎自由使用、修改、分发与商用，请保留原作者版权声明。
- 第三方依赖遵循各自的许可协议。