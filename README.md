# 饭局星球 — 微信小程序

每一桌聚餐，都是一颗独特的星球。

饭局星球是一款解决多人聚餐决策痛点的微信小程序，提供"吃什么"随机转盘、"谁买单"趣味游戏、聚餐记录本、关系图鉴、打卡地图和聚餐相册等功能，让每一次聚餐都充满乐趣和回忆。

## 项目配置

| 配置项 | 值 |
|--------|-----|
| **前端框架** | 微信原生小程序 |
| **后端框架** | Node.js + Express |
| **数据库** | MongoDB (Mongoose) |
| **后端端口** | 2001 |
| **数据库名** | fanjuxingqiu |

## 端口分配

| 服务 | 端口 | 说明 |
|------|------|------|
| 后端 API 服务 | 2001 | Node.js + Express（API + 管理后台一体化） |

## 项目结构

```
fanjuxingqiu-crow/
├── doc/                            # 项目文档
│   ├── 饭局星球_PRD_agent.md       # 产品需求文档
│   ├── v1.1_design.md              # v1.1 设计文档
│   └── v1.1_plan.md                # v1.1 实现计划
├── database/
│   └── init.mongodb.js             # MongoDB 初始化脚本
├── project/
│   ├── frontend/
│   │   ├── miniapp/                # 微信小程序前端
│   │   │   ├── pages/              # 页面（吃什么/谁买单/记录本/地图/我的）
│   │   │   ├── images/             # Tab 图标资源
│   │   │   └── utils/              # 工具函数
│   │   └── admin/                  # 管理后台前端（纯 HTML + CSS + JS）
│   └── backend/
│       └── src/
│           ├── config/             # 后端配置
│           ├── middleware/         # 中间件（管理员认证）
│           ├── models/             # Mongoose 数据模型
│           └── routes/             # API 路由
├── .gitignore                      # Git 忽略规则
└── 后台管理员密码.md               # 管理员登录凭据
```

## 功能模块

| 模块 | 状态 | 说明 |
|------|------|------|
| 吃什么 | ✅ | 随机转盘 + 口味筛选 + 氛围标签 + 多人投票 |
| 谁买单 | ✅ | 随机抽签 + 鳄鱼牙齿 + 海盗插刀 + AA记账 |
| 关系图鉴 | ✅ | Canvas 关系网络 + 10 种称号系统 |
| 聚餐记录本 | ✅ | 分步表单 + 列表 + 统计面板 + 饭搭子选择 |
| 打卡地图 | ✅ | 城市足迹 + 美食气泡 + 排行榜 + 成就系统 |
| 聚餐相册 | ✅ | 卡片网格 + AI 回忆文字 + 分享海报生成 |
| 饭搭子 | ✅ | 联系人管理（后端存储 + 头像上传） |
| 微信登录 | ✅ | wx.login + JWT + Mock 降级模式 |
| 管理后台 | ✅ | Web 端 /admin（数据概览/记录/用户管理） |

## 快速启动

### 环境要求

- Node.js 18+
- MongoDB 6.0+
- 微信开发者工具（最新版）

### 数据库初始化

```bash
mongosh < database/init.mongodb.js
```

### 后端启动

```bash
cd project/backend
npm install
npm start
# 服务运行在 http://localhost:2001
```

### 前端启动

在微信开发者工具中打开 `project/frontend/miniapp` 目录，导入项目即可预览。

### 管理后台

访问 `http://localhost:2001/admin`，使用管理员账号登录（默认账号密码见 `后台管理员密码.md`）。

### 验证后端

```bash
curl http://localhost:2001/api/health
# 返回: {"status":"ok","service":"饭局星球 API","version":"1.0.0"}
```

### 种子数据

一键导入示例数据，立刻体验完整功能：

```bash
curl -X POST http://localhost:2001/api/seed/all
```

或在小程序「我的」→「导入示例数据」按钮（支持离线模式）。

## 技术栈

| 层级 | 技术 | 备注 |
|------|------|------|
| 前端框架 | 微信原生小程序 | — |
| 后端服务 | Node.js + Express | 端口 2001 |
| 数据库 | MongoDB (Mongoose) | 库名: fanjuxingqiu |
| 管理后台 | 纯 HTML + CSS + JS | 路径 /admin |
| 认证 | JWT (jsonwebtoken) | 小程序 + 管理后台共用密钥 |
| 安全 | helmet + express-rate-limit | — |
| 文件上传 | multer | 最多 9 张，单张 ≤ 5MB |

## 开发计划

### v1.1 已完成

- [x] 关系图鉴修复（双重关联：participants + creatorId）
- [x] 偏好记忆优化推荐（加权转盘 + 隐式学习 + 显式口味设置）
- [x] 照片上传（multer，最多 9 张，单张 ≤ 5MB）
- [x] 饭搭子头像上传（multer，支持相机/相册选择）
- [x] 分享海报生成（4 种智能样式：海报/单图/拼图/九宫格）
- [x] 完整称号系统（10 种称号规则，前后端同步）
- [x] 打卡地图成就系统（11 项成就 + 进度墙）

### v1.0 MVP

- [x] 项目骨架搭建
- [x] 吃什么 — 随机转盘（单人模式）
- [x] 谁买单 — 随机抽签 + 鳄鱼牙齿 + 海盗插刀
- [x] 聚餐记录本 — 新建/查看/统计
- [x] 打卡地图 — 基础版
- [x] 聚餐相册 — 基础版
- [x] 微信登录 + JWT 认证
- [x] 管理后台 — 数据概览/记录管理/用户管理