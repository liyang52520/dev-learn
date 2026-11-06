# anki-svc

复习子系统的数据与导入脚本。**调度逻辑已经并入 FastAPI 后端进程**，这里不再有独立服务，
也没有 `8765` 端口与 `X-Review-Token`。

题目内容不经过 Anki：题干、答案、代码高亮、PDF 截图仍由后端从 `backend/data/study` 渲染；
Anki 只回答三件事：下一张卡是哪张、四个按钮叫什么、还剩多少。

## 目录

| 位置 | 内容 |
| --- | --- |
| `backend/anki-svc/import.py` | 把 `backend/data/study/*.json` 导入 `collection.anki2`（42 专题 / 2521 题） |
| `backend/anki-svc/data/collection.anki2` | 学习状态，独立 git 仓库 `dev-anki`（不入库） |
| `backend/anki-svc/data/backups/` | 一致性快照 `*.colpkg`，保留最近 30 份（不入库） |
| `backend/app/features/review/` | 调度、快照、统计与接口实现 |

## 装一次

```bash
python3 -m venv backend/anki-svc/.venv
backend/anki-svc/.venv/bin/pip install -r backend/anki-svc/requirements.txt
backend/anki-svc/.venv/bin/python backend/anki-svc/import.py
```

`backend/anki-svc/data/` 必须自己是一个 git 仓库。若未初始化，后端会跳过 git 同步并在日志里说明，
不会误把站点代码提交进 `dev-anki`。

## 每天用

```bash
python backend/scripts/dev.py     # 开发：uvicorn :8000 + vite :5173
```

生产只有一个进程：

```bash
cd backend && .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

打开 `/study`，hero 下方出现「开始复习」；`Ctrl-C` 退出时会做快照并在有改动时推送 `dev-anki`。

## 快照与恢复

- 自动：每 10 分钟一次（`create_backup` 生成的 `.colpkg`，一致性由 Anki 保证），保留 30 份。
- 手动：后台「学习设置 → 立即快照并推送」，或 `POST /api/admin/study/sync`。
- 恢复：先停掉后端，再把某份 `.colpkg` 用 Anki 桌面版导入，或解包替换 `collection.anki2`。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/review/queue?limit=1` | 取卡 + 四个按钮文案 + 三类计数 |
| POST | `/api/review/answer` | `{cardId, rating}`（1 忘记 / 2 模糊 / 3 记得 / 4 简单），响应直接带下一张卡 |
| POST | `/api/review/undo` | 撤销上一张 |
| GET | `/api/review/stats` | 今日、连续天数、累计、365 天热力图 |
| GET | `/api/review/lapses` | 遗忘记录 |
| GET | `/api/review/card-answer?qid=` | 按题目 id 取原文答案 HTML |
| GET/POST | `/api/admin/study/config` | 读 / 改每日上限（需登录） |
| POST | `/api/admin/study/sync` | 手动快照 + git 推送（需登录） |

写操作校验 `Origin` 同源；后台接口还要求登录态。

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | `yg-admin` | 后台密码 |
| `APP_SECRET` | 本地固定值 | cookie 签名密钥，部署时务必改 |
| `LOGIN_MAX_FAILURES` / `LOGIN_LOCK_SECONDS` | `8` / `120` | 登录失败锁定 |
