# anki-svc

本站复习功能的本地调度服务：把 Anki 的 v3 调度器包成几个 JSON 接口。

**题目内容不经过这里。** 题干、答案、代码高亮、PDF 截图仍然由站点从 `data/study` 渲染；
本服务只回答三件事：下一张卡是哪张、四个按钮叫什么、还剩多少。

## 装一次

```bash
python3 -m venv anki-svc/.venv
anki-svc/.venv/bin/pip install anki
npm run anki:import          # data/study → collection（42 专题 / 2521 题）
```

## 每天用

```bash
npm run dev      # 终端 1：站点 :3000
npm run anki     # 终端 2：调度服务 :8765
```

打开 `http://localhost:3000/study`，hero 下方会出现「开始复习」。
`Ctrl-C` 结束服务时会自动做快照并推到 `dev-anki` 仓库。

## 数据在哪

| 位置 | 内容 |
| --- | --- |
| `anki-svc/data/collection.anki2` | 学习状态（Anki collection），独立 git 仓库 `dev-anki` |
| `anki-svc/data/backups/` | 本地快照，保留最近 30 份（不入库） |
| `anki-svc/.token` | 服务 token，首次启动自动生成，站点侧自动读取 |

备份 / 恢复：

```bash
# 立刻快照
curl -X POST -H "X-Review-Token: $(cat anki-svc/.token)" http://127.0.0.1:8765/sync

# 恢复某一份（先停掉两个进程）
cp anki-svc/data/backups/collection-2026-11-06-112730.anki2 anki-svc/data/collection.anki2
```

## 只在电脑上用

默认就是这套配置：服务只监听 `127.0.0.1`，站点在 `localhost:3000`，不涉及内网穿透、公网端口或 VPN。

> 站点部署到公网服务器时不用做任何开关：服务器上没有 `anki-svc/.token`，
> `/api/review/*` 一律返回 503，`/study` 的复习入口也不会渲染。

## 接口

除 `/health` 外都要 `X-Review-Token`；来源 IP 只允许回环地址（`127.0.0.0/8`）。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 存活检查 |
| GET | `/queue?limit=1` | 取卡 + 四个按钮文案 + 三类计数 |
| POST | `/answer` | `{card_id, rating}`（1 忘记 / 2 模糊 / 3 记得 / 4 简单），响应里直接带下一张卡，前端一次往返 |
| POST | `/undo` | 撤销上一张 |
| GET | `/stats` | 今日、连续天数、累计、365 天热力图数据 |
| GET/POST | `/config` | 读 / 改 `new_per_day`、`rev_per_day` |
| POST | `/sync` | 手动快照 + git 推送 |

改每日上限（也可以直接用 Anki 桌面版的 Deck Options）：

```bash
T=$(cat anki-svc/.token)
curl -X POST -H "X-Review-Token: $T" -H 'Content-Type: application/json' \
  -d '{"new_per_day": 100, "rev_per_day": 300}' http://127.0.0.1:8765/config
```

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `REVIEW_PORT` | `8765` | 监听端口 |
| `REVIEW_HOSTS` | `127.0.0.1` | 逗号分隔；一般不用改 |
| `REVIEW_DECK` | `Java面试` | 复习哪个父 deck |
