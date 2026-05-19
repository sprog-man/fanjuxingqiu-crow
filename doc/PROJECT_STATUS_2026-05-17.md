# 饭局星球 · 项目工作状态存档

> 存档日期：2026-05-17 18:30  
> 分支：`youhua`（领先 origin/youhua 1 commit，未 push）  
> 最近提交：`441c3c3` — 存档 fanjuxingqiu-crow 2026-05-17 18:21  

---

## 一、本轮完成的工作（2026-05-17 会话）

### 1. 关系图鉴模块重写（基于 `relation_atlas_design.md`）

**涉及文件：**
- `project/frontend/miniapp/subpackages/mine/relation.js` — 全量重写（356行）
- `project/frontend/miniapp/subpackages/mine/relation.wxml` — 全量重写（250行）
- `project/frontend/miniapp/subpackages/mine/relation.wxss` — 全量重写（441行）

**实现内容：**
- 双 Tab 切换：**关系概览** + **称号图鉴**
- 关系概览页：我的信息卡（当前最高称号）、三格统计条（饭搭子数/聚餐次数/解锁称号）、2列好友卡片网格
- 锁定状态：聚餐次数 < 2 的好友卡片显示灰色遮罩 + 🔒 +「再聚 N 次解锁」
- 好友详情页：Hero Card（头像/星级/称号）、四格统计（共同聚餐/同游城市/共同消费/TA买单）、最近聚餐时间线（最多5条）、一起吃过的菜（按菜系分4色）、同游城市（琥珀色标签）
- 称号图鉴页：10种称号按稀有度分3组展示（传说·史诗/稀有/进阶·普通），未解锁显示「???」+条件
- 解锁弹窗动画：底部滑入 300ms + 图标缩放 400ms（延迟200ms）+ 星级逐颗点亮 150ms/颗
- 称号计算严格按设计文档优先级覆盖（灵魂饭搭最高）
- 亲密度进度条按 40%/80% 分段变色
- 菜品标签按菜系分类：川渝（珊瑚）、日韩（薄荷）、西式（紫）、其他（蓝）
- 数据加载优先请求后端 API，失败降级本地存储计算

---

### 2. 饭搭子模块改造

**涉及文件（7个）：**

| 文件 | 改动 |
|------|------|
| `project/backend/src/models/user.js` | 新增 `phone` 字段 |
| `project/backend/src/models/buddy.js` | 重构为 `targetUserId`(ref:User) + `remark` 结构 |
| `project/backend/src/routes/buddy.js` | 重写：新增 `GET /search?q=` 搜索用户；创建改为按 targetUserId；更新仅允许改备注；移除头像上传 |
| `project/frontend/miniapp/app.js` | 新增 `apiSearchUsers`；更新 `apiSaveBuddy` 发送 targetUserId+remark；移除 `apiUploadBuddyAvatar` |
| `project/frontend/miniapp/subpackages/mine/buddies.js` | 重写：搜索用户→选中→添加备注 三步流程 |
| `project/frontend/miniapp/subpackages/mine/buddies.wxml` | 重写：搜索输入+结果列表+选中确认+备注输入+列表显示原昵称/备注/手机号 |
| `project/frontend/miniapp/subpackages/mine/buddies.wxss` | 重写：搜索列表样式、选中用户卡片、备注输入区 |

**核心改动：**
- **添加前提**：必须搜索 `users` 集合中已存在的用户，不能手动输入
- **自动获取**：从数据库自动拉取头像、昵称、手机号
- **去掉了编辑功能**：用户不能修改饭搭子的头像、姓名、手机号
- **只保留备注**：用户只能设置/修改备注名（remark）
- **同名用户**：搜索结果以列表展示（头像+昵称+手机号），用户手动点选

---

## 二、待验证 / 已知问题

| 问题 | 状态 | 说明 |
|------|------|------|
| 关系图鉴 WXML 方法调用 | ✅ 已修复 | `.slice()` 不支持在 WXML `{{}}` 中使用，已改为 JS 预计算 |
| 手机号自动获取 | ⏳ 待实现 | `User.phone` 已存在、接口已返回，但无授权获取流程 |
| 旧 Buddy 数据兼容 | ⚠️ 注意 | Buddy 模型从 `name/phone/avatar` 改为 `targetUserId/remark`，旧数据需重新添加 |
| 关系图鉴 Canvas 旧代码 | ✅ 已移除 | Canvas 网络可视化已替换为卡片 UI |

---

## 三、当前项目概况

### 技术栈 & 配置

| 配置项 | 值 |
|--------|-----|
| 后端端口 | 2001 |
| 数据库 | MongoDB / fanjuxingqiu |
| 前端框架 | 微信原生小程序 |
| 后端框架 | Node.js + Express |
| Git 分支 | `youhua` |

### 数据库状态（2026-05-17 备份）

| 集合 | 记录数 |
|------|--------|
| gatherings | 23 |
| users | 4 |
| buddies | 0 |
| dishes | 78 |
| cuisines | 6 |
| aarecords | 9 |

### 功能模块一览

| 模块 | 状态 | 说明 |
|------|------|------|
| 吃什么（Tarot） | ✅ | 12 分类塔罗牌 + 3D 翻牌动画 |
| 谁买单 | ✅ | 抽签 + 鳄鱼牙齿 + 海盗插刀 + AA 记账 |
| 记录本 | ✅ | 列表 + 统计 + 筛选 |
| 地图 | ✅ | 城市足迹 + 气泡 + 排行榜 + 成就 |
| 我的 | ✅ | 关系图鉴（新）+ 饭搭子（新）+ 相册 |
| 管理后台 | ✅ | 路径 /admin |
| 多人房间 | ✅ | WebSocket 实时互动 |

---

## 四、数据库备份

- 备份时间：2026-05-17 18:30
- 备份路径：`database/backup/2026-05-17/`
- 命令：`NODE_PATH=project/backend/node_modules node utils/backup-db.js`
- 总计：120 条记录

---

## 五、下一步建议

1. **实现手机号获取**：「我的」页面添加"绑定手机号"按钮（`open-type="getPhoneNumber"`），后端解密存储
2. **关系图鉴 v1.2**：羁绊成长轨迹（历史时间线）、保存记录时触发称号解锁动画
3. **补充种子用户**：向 `users` 集合添加更多测试用户，方便饭搭子搜索验证
4. **关系图鉴 API 增强**：按设计文档补 `/relation/detail`、`/recalculate`、`/title/atlas` 接口
5. **新用户引导**：登录时引导完善资料
6. **推送到远程仓库**：当前 `youhua` 领先 origin 1 commit，可执行 `git push`
