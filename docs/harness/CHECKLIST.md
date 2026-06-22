# 验证清单 — Agent 工作完成检查

在声称 feature/bug fix 完成之前，必须逐项确认。

---

## 代码正确性

- [ ] **语法检查**: 修改过的 JS 文件能用 `node --check` 通过
- [ ] **后端启动**: `cd project/backend && npm start` 能正常启动（无 uncaught exception）
- [ ] **健康检查**: `curl http://localhost:2001/api/health` 返回 `{"status":"ok"}`
- [ ] **MongoDB 连接**: 健康检查中 `db` 字段为 `connected`

## 作用域控制

- [ ] **未越界**: 只修改了 feature 对应的文件（见 feature_list.json 中的 files 字段）
- [ ] **未碰保护目录**: 没有修改 `doc/`、`后台管理员密码.md`、`.env`
- [ ] **主包体积**: 新功能没有放在主包（`pages/`）下，而是放在子包（`subpackages/`）下

## 文档同步

- [ ] **progress.md 已更新**: 记录了本次会话做了什么
- [ ] **feature_list.json 已更新**: feature 状态和 evidence 已更新
- [ ] **DECISIONS.md 已更新**: 如果有架构决策，已追加记录
- [ ] **done_check.sh 通过**: `bash docs/harness/done_check.sh` 返回 0

## 部署安全

- [ ] **不是直接推 master**: 工作分支是 yunfuwu（除非有明确理由）
- [ ] **.env 未暂存**: `git diff --cached --name-only` 中没有 `.env`
- [ ] **提交前检查**: 推送 yunfuwu 会触发 GitHub Actions 自动部署到生产

## 跨会话交接

- [ ] **session-handoff.md 已更新**: 记录了当前进度和下一步
- [ ] **仓库可重启**: 下一个会话可以直接 `npm start` + `curl /api/health` 继续工作

---

## 快速命令参考

```bash
# 语法检查
node --check project/backend/src/app.js

# 健康检查
curl http://localhost:2001/api/health

# 种子数据
curl -X POST http://localhost:2001/api/seed/all

# Doc 同步检查
bash docs/harness/done_check.sh

# 查看当前分支
git branch --show-current

# 查看最近提交
git log --oneline -5
```
