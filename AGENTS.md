# AGENTS.md — dev-learn 协作说明

> 本文件面向在本仓库工作的 AI 助手与新加入的人类协作者。
>
> `dev-learn` 是「YG's Blog」个人站与「Java 面试宝典」学习站的合并体：左边写博客，右边做题库，全部由仓库里的文件驱动。
>
> **一句话：内容都在文件里，改文件就是改站点；两条内容线的最高标准分别是「让读者弄懂」和「原文可查」。**

## 怎么用这份文件

| 你要做的事 | 直接读 |
| --- | --- |
| 结构 / 命令 / 后台 / 代码约定；复习子系统 | 第一章（复习另见 `backend/data/README.md`） |
| 写、改博客文章 | 先读 [`skills/blog-writing/SKILL.md`](skills/blog-writing/SKILL.md)，第二章只是索引 |
| 维护题库、加专题 | 先读 [`skills/study-bank/SKILL.md`](skills/study-bank/SKILL.md)，第三章只是索引 |
| 接手任务、交付自检 | 第四章 |

> **分工**：本文件管项目结构、代码约定与协作流程；博客与题库的完整细则在 `skills/*/SKILL.md`，两处冲突时以 `skills/` 为准。

---

## 一、这是一个什么项目

`dev-learn` 是「YG's Blog」个人站与「Java 面试宝典」学习站的合并体，一套文件驱动的前后端分离站点：

- **博客**：`backend/data/blog/posts/*.md` 写文章；首页、归档、标签、分类、文章页由 React 渲染。
- **学习**：`backend/data/study/*.json` 存专题与题目，配套 `backend/data/study/` 下 8000 多张 PDF 原文截图。
- **后台**：`/admin` 自带本地 CMS，可新建、编辑、预览、发布文章并上传图片。
- **复习**：可选的 Anki 调度，已并入后端进程，学习状态放在 `backend/data/anki/`。

没有数据库、没有外部 CMS、没有 Node 服务端。**仓库里的文件就是数据库**：改 Markdown 就是发文章，改 JSON 就是改题库，`git` 就是版本管理与发布记录。

### 1.1 架构

```
生产：浏览器 ──▶ FastAPI :8000（单进程、单 worker）
                  ├─ /api/*      JSON 接口
                  ├─ /assets/*   frontend/dist 构建产物
                  ├─ /disguise   伪装学习页（DeepSeek 复刻静态页）
                  ├─ /images、/study  原始静态资产
                  └─ 其他路径    返回 index.html（SPA 回退）

开发：浏览器 ──▶ Vite :5173 ──代理 /api、/images、/study──▶ FastAPI :8000
```

- 前后端同源：生产同端口，开发走 Vite 代理，因此**不配置 CORS**。
- uvicorn 固定 1 个 worker：Anki collection 与进程内缓存都不支持多进程。
- 首屏是空 HTML，正文由浏览器渲染；这是分离架构已接受的代价。

### 1.2 技术栈

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 后端 | Python 3.13 + FastAPI + uvicorn | 只返回 JSON；文件读写与渲染都在这里 |
| 内容解析 | `python-frontmatter` | 读写 Markdown front matter |
| Markdown | `markdown-it-py` + `mdit-py-plugins` | GFM、公式占位、Pyments 高亮 |
| 图片 | Pillow | 读宽高、校验上传 |
| 复习 | `anki` 包（同进程） | 调度、快照、统计 |
| 前端 | Vite + React 19 + React Router 7 | 全部页面与路由 |
| 服务端状态 | TanStack Query | key 按 feature 定义，不做全局 store |
| 编辑器 | CodeMirror 6 | 后台 Markdown 编辑 |
| 公式 | KaTeX（浏览器） | 后端只输出 `[data-tex]` 占位 |
| 样式 | CSS 变量 + 分区文件 | 暗色覆盖变量，不写两套颜色 |
| 质量门槛 | ruff / mypy / pytest；tsc / eslint / vitest / vite build | 无 CI，提交前本地跑 |

### 1.3 目录结构

```
dev-learn/
├── backend/
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py                 # 只做装配
│   │   ├── serving.py              # 静态资产与 SPA 回退
│   │   ├── core/                   # config / paths / errors / security / logging / pagination
│   │   ├── rendering/              # markdown / plugins / toc / highlight / answers / images
│   │   ├── features/
│   │   │   ├── posts/              # 文章列表、详情、后台 CRUD、frontmatter
│   │   │   ├── blog/               # archive / tags / categories
│   │   │   ├── study/              # 专题、题目、导航、证据
│   │   │   ├── search/             # 文章 + 题目混合检索
│   │   │   ├── auth/               # 登录、登出、登录态
│   │   │   ├── media/              # 图片上传
│   │   │   └── review/             # 复习调度、快照、统计
│   │   └── tests/                  # 跨模块测试
│   ├── data/                       # 独立仓库 dev-anki（见其 README）
│   │   ├── blog/
│   │   │   ├── posts|drafts/       # 已发布文章 / 草稿
│   │   │   └── assets/images/      # 文章图片（uploads/ 为后台上传）
│   │   ├── study/                  # index.json + 专题 JSON + PDF 截图
│   │   └── anki/                   # collection.anki2 + 快照（backups/ 不入库）
│   ├── scripts/
│   │   ├── dev.py                  # 一条命令起前后端
│   │   └── check_structure.py      # 结构规则检查
├── frontend/
│   ├── public/images/              # 头像、站点图标等固定资源
│   ├── public/disguise/            # 伪装学习页（DeepSeek 复刻静态页，构建时原样复制）
│   ├── src/
│   │   ├── app/                    # App.tsx 路由表、providers、layout、404
│   │   ├── features/               # posts / blog / study / search / review / admin
│   │   ├── shared/                 # api/client、通用组件、hooks、styles
│   │   └── types/                  # api.d.ts（OpenAPI 生成）、models.ts（别名）
│   ├── vite.config.ts
│   └── package.json
├── skills/
│   ├── blog-writing/               # 博客写作细则
│   └── study-bank/                 # 题库细则 + scripts/{extract-study.cjs, enhance-answers/}
├── .gitignore
└── AGENTS.md
```

### 1.4 路由地图

前端路由（`frontend/src/app/App.tsx`）：

| 路由 | 说明 |
| --- | --- |
| `/` | 首页；`?page=2` 翻页，每页 8 篇已发布文章 |
| `/posts/:slug` | 文章页：目录、阅读进度、代码复制、上一篇/下一篇 |
| `/blog/archive`、`/blog/tags`、`/blog/tags/:tag`、`/blog/categories`、`/blog/categories/:category` | 归档、标签云与筛选、分类云与筛选 |
| `/study`、`/study/:topic`、`/study/:topic/:qid` | 专题总览、专题首页（跳第一题）、三栏题目页 |
| `/review` | 复习页（专注布局，不套 Header/Footer） |
| `/admin`、`/admin/login`、`/admin/study`、`/admin/backup` | 文章列表、登录、学习设置（`?tab=stats\|bank\|settings`）、数据备份 |
| `/admin/edit/:type/:slug`、`/admin/preview/:type/:slug` | 编辑器、整页预览（`type` 只能是 `posts`/`drafts`） |

站点是单人使用，**除 `/admin/login` 外所有页面都要登录**：未登录访问任意路由会跳 `/admin/login`，
登录后回到原地址；顶部栏右侧的设置按钮可进入后台各页或退出登录。

`/disguise/` 是独立于 React 的伪装学习页：`frontend/public/disguise/` 里的 DeepSeek 复刻静态页
（真实页面 DOM/CSS + 自写 `app.js`、`data.js`），构建时原样复制到 `dist/disguise`，由 `serving.py`
以 `StaticFiles(html=True)` 挂载，因此生产刷新仍停留在该页。左侧会话是假标题，中间是真实刷题会话：
登录后打开会先拉 `/api/review/queue`，附件填入真实到期卡片的题面，发送时取 `/api/review/card-answer`
渲染答案，四个评分按钮提交 `/api/review/answer`（写入 Anki）并自动换到下一张卡；评分后按钮保留选中态、
附件才能切下一题。未登录或接口不可用时退回 `data.js` 的本地题目。点顶部分享按钮退出伪装回到 `/review`；
顶部栏设置菜单里的「伪装学习页」可直接进入。
该静态路径不受后端登录守卫拦截，但接口仍需要登录态。

后端接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/posts?page=&limit=` | 分页列表，不含正文 |
| GET | `/api/posts/{slug}` | `{meta, html, toc, prev, next}` |
| GET | `/api/blog/archive`、`/tags`、`/tags/{tag}`、`/categories`、`/categories/{category}` | 归档与筛选 |
| GET | `/api/search?q=` | 文章 + 题目混合结果（≤16 条） |
| GET | `/api/study`、`/api/study/{topic}`、`/api/study/{topic}/{qid}` | 专题列表、专题导航、题目详情 |
| GET/POST | `/api/review/*` | 队列、评分、撤销、埋藏/暂停/标记、统计、遗忘记录 |
| GET/POST | `/api/admin/backup/*` | 备份状态、推送本机、合并远端分支、冲突解决、覆盖本机、安全引用与恢复 |
| POST | `/api/admin/auth/login`、`/logout`；GET `/me` | 登录态 |
| GET/POST | `/api/admin/posts`、`/api/admin/post`、`/preview`、`/publish`、`/upload` | 后台读写 |
| GET/POST | `/api/admin/study/config` | 学习设置 |
| GET/POST/PUT/DELETE | `/api/admin/study/bank/*` | 题库列表筛选、题目详情、新增/编辑/删除、证据截图上传 |
| GET | `/api/admin/study/overview` | 统计页深度指标（成熟度、活跃天数、到期预测、专题进度） |
| GET | `/api/health` | 存活检查 |

### 1.5 数据流

**博客**：`backend/data/blog/posts/*.md` → `features/posts/repository.py`（frontmatter 解析、目录缓存）→ `features/posts/service.py`（排序、分页、上一篇/下一篇）→ `rendering/markdown.py`（Markdown → HTML + TOC）→ JSON → 前端 `HtmlContent`（KaTeX 渲染 + 代码复制事件委托）。

**题库**：`backend/data/study/index.json` → 专题列表；`backend/data/study/<id>.json` → 题目与答案 Markdown；`rendering/answers.py` 把答案 Markdown 渲染成 HTML（代码围栏 → `.code-block`、表格 → `.table-wrap`、图片 → 带图注的 `figure.pdf-img`，遗留 `<pre class='code'>` 仍兜底高亮）；`rendering/images.py` 读文件头注入 `width/height`。

**后台**：`/admin` → `/api/admin/*` → `features/posts/repository.py` 原子写（临时文件 + `os.replace`）；发布/撤回 = 在 `backend/data/blog/posts` 与 `backend/data/blog/drafts` 间移动；删除 = 移入 `backend/.trash/<type>/<时间戳>-<slug>.md`；上传 = 落 `backend/data/blog/assets/images/uploads/<年>/<月>/`，URL 仍为 `/images/uploads/…`。

### 1.6 本地运行与验证

```bash
# 首次
cd backend && python -m venv .venv
.venv/Scripts/pip install -e .          # Windows；macOS 用 .venv/bin/pip
cd ../frontend && npm install

# 开发（两个进程一起起）
python backend/scripts/dev.py            # uvicorn :8000 + vite :5173

# 只跑其中一边
cd backend && .venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev

# 生产
cd frontend && npm run build
cd backend && .venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

- 本机 Node 在 `C:\Users\Admin\.local\node`，未加入全局 PATH；PowerShell 里先
  `$env:PATH="C:\Users\Admin\.local\node;$env:PATH"`。
- 全站登录：密码取 `ADMIN_PASSWORD`，未设置时默认 `yg-admin`；登录态保留 7 天，未登录时只有 `/admin/login` 可访问。
- 生产只有一个地址：`http://127.0.0.1:8000`（Vite 的 5173 只在开发时存在）。

提交前必跑：

```bash
# 结构规则（行数 / 分层 / 禁用命名 / 前端直连 fetch）
python backend/scripts/check_structure.py

# backend
.venv/Scripts/python -m ruff check app
.venv/Scripts/python -m ruff format --check app
.venv/Scripts/python -m mypy app
.venv/Scripts/python -m pytest

# frontend
npm run typecheck && npm run lint && npm run test && npm run build
```

构建通过 ≠ 内容正确，构建只读真实文件，内容仍需人工打开页面看。

### 1.7 内容管理后台

1. `/admin/login` 校验密码后写入 httpOnly cookie（7 天），服务端用签名 cookie 保存登录态。
   站点只有一个人用，`core/security.py` 的全站守卫统一拦截：除登录/登出/登录态与健康检查外，
   所有 `/api/*`、`/images/*`、`/study/**` 图片都要求登录，SPA 页面由前端 `AdminGuard` 跳登录页。
   顶部栏右侧的设置按钮是常驻入口：内容后台、学习设置、数据备份、退出登录。
2. `/admin` 支持「全部 / 已发布 / 草稿」筛选与关键词过滤；「新建文章」默认建在 `backend/data/blog/drafts`，文件名由标题 slug 化。
3. 编辑器字段：`title`、`date`、`tags`（逗号分隔）、`categories`（逗号分隔）、`description`、`cover`；正文用 CodeMirror，`⌘/Ctrl+S` 保存，右侧实时预览。
4. 「整页预览」复用同一渲染管线；「发布/撤回」只移动文件；「删除」移到 `backend/.trash/`。
5. 上传仅支持 png/jpeg/webp/gif、≤ 20 MB，服务端会校验真实图片头，落 `backend/data/blog/assets/images/uploads/`，返回 `/images/uploads/YYYY/MM/…`；`frontend/public/images/` 只放头像、站点图标等固定资源。
6. `/admin/study?tab=bank` 是题库后台：左栏按专题筛选 + 关键词搜索（服务端截断 400 题并提示），右侧编辑题目标题、要点、别名、备注、页码、答案 Markdown 与证据截图；新增按当前专题最大题号追加，删除会清理截图并前移后续题号。读写走 `features/study/admin_service.py`，卡片同步规则见 1.10。

后台只编辑已知字段；手写在 front matter 里的额外字段会被保留，但新增字段的完整支持需同时改
`features/posts/frontmatter.py`、`features/posts/schemas.py`、`frontend/src/types/models.ts` 与编辑器组件。

### 1.8 代码约定

**分层与依赖**

1. 后端单向依赖：`router → service → repository / rendering`；`rendering` 是纯函数，不 import 业务。
2. 跨 feature 只能调用对方 `service.py` 的公共函数，不得 import 对方的 repository / router；schema 只可作为输出 DTO 复用（如 blog 复用 `PostMeta`），不得借它绕过 service。
3. 禁止 `utils.py`、`helpers.py`、`common/`、`misc/`；通用能力放进语义明确的 `core/*` 或 `shared/*`。
4. 文件读写只在 `repository.py` 与 `media/service.py`；router 不碰文件系统。

**规模**

5. 手写文件 ≤300 行；页面组件 ≤150 行；组件 ≤200 行；CSS ≤300 行。超出就拆 hook 或子组件。

**后端**

6. 输出模型统一继承 `ApiModel`（camelCase alias），前端 `types/api.d.ts` 由 OpenAPI 生成，禁止手改。
7. 错误统一抛 `AppError(code, message, status, fields)`，由 `main.py` 的异常处理器转成 `{error:{code,message,fields}}`。
8. 路径拼接一律走 `core.paths.safe_join`：拒绝 `..`、分隔符、隐藏文件与 NUL。
9. 重数据按 mtime + size 缓存；写/删/移文章后主动清缓存。题库优先读 `index.json` 的预计算检索字段。
10. 代码块/表格在服务端包裹：`<div class="code-block"><span class="code-lang">…</span><button data-code-copy>…</button><pre class="pyg">…</pre></div>`、`<div class="table-wrap">`。前端只做事件委托，不在 hydration 后移动 DOM。
11. 公式在服务端只输出占位：`<span class="math-inline" data-tex="…">` / `<div class="math-block" data-tex="…">`，由浏览器 KaTeX 渲染。
12. 图片必须可预留尺寸：证据截图与答案配图的 `width/height` 从文件头读取注入；缺尺寸会造成 CLS。
13. 时间：front matter 写 `YYYY-MM-DD HH:mm:ss`（Asia/Shanghai）；接口统一给 UTC ISO 与展示字符串。
14. 中文文案：读者可见文案、错误提示、后台提示全部中文。
15. URL 编码：slug / tag / category 含中文或空格，构造链接一律 `encodeURIComponent`，后端解码后再查。

**前端**

16. 页面组件只做「取数据 + 组合」；组件不直接 `fetch`，只调用所属 feature 的 `api.ts`。
17. 服务端状态用 TanStack Query；UI 状态留在组件本地；不建全局 store，主题与登录态用 Context。
18. 路由级 `React.lazy`；`Suspense` 统一用 `PageSkeleton`，避免切页白屏。
19. 样式拆在 `shared/styles/*` 与 `features/*/styles/*`，单文件 ≤300 行；暗色只覆盖 CSS 变量。
20. 大字段不要塞进列表组件的 props；题目侧栏只用 `id/no/title/aliases`，答案与证据留在页面层。

### 1.9 不要做的事

- ❌ 重新引入 Next.js / Hexo / 任何 Node 服务端渲染。
- ❌ 手工编辑 `backend/data/study/**` 截图；题库变更改 `backend/data/study` 的 JSON，截图由抽取流程生成。
- ❌ 把 PDF 原文搬进仓库。
- ❌ 提交 `node_modules/`、`frontend/dist/`、`backend/.venv/`、`backend/.trash/`、各类缓存、`backend/data/`（独立仓库）。
- ❌ 手动拼 front matter 写文件；统一走序列化函数 / 后台 API。
- ❌ 在前端组件里读写文件或拼接后端路径。
- ❌ 为「以后可能用到」预留抽象；三个相似行好过一个提前的抽象。

### 1.10 复习：Anki 调度（可选子系统）

站点本身不存学习状态。调度在 FastAPI 进程内，题目内容仍由本站渲染。

| 部分 | 位置 |
| --- | --- |
| 导入脚本 | `backend/app/features/review/importer.py`（`cd backend && python -m app.features.review.importer`） |
| 学习状态 | `backend/data/anki/collection.anki2`（`backend/data` 是独立仓库 dev-anki） |
| 调度 / 快照 / 统计 | `backend/app/features/review/` |
| 复习页 | `frontend/src/features/review/` |
| 后台设置 | `/admin/study` |
| 数据备份 | `backend/app/features/backup/`、`/admin/backup` |

约定：

1. 内容归站点、状态归 Anki：复习页从 `/api/study` 渲染题面与答案，Anki 只负责「下一张卡 / 四个按钮文案 / 复习日志」。
   打开 collection 时会自动把全局 `fsrs` 开关置为开启（`collection.ensure_fsrs`），新机器部署无需手工设置。
2. `backend/data` 是独立仓库（remote dev-anki，主仓已忽略）：每台机器只写自己的远端分支
   （默认 `machine/<主机名>`，可用 `DATA_SYNC_BRANCH` 覆盖）。服务每 10 分钟快照
   （`.colpkg`，保留 30 份），每天自动提交全部数据并推送本机分支；`/admin/backup`
   可手动推送、合并别的机器分支、逐文件解决冲突，或用对方整份覆盖本机（保留安全引用）。
   覆盖与恢复都会写 `refs/backup/*`，`/admin/backup` 可一键恢复到任一安全引用（恢复前再留一份）。
3. `/api/review/answer` 直接返回下一张卡；浏览器只回 `cardId + rating + clientId`。评分返回一次性
   `undoToken`（10 分钟有效，按 `clientId` 隔离，`/api/review/undo` 校验），显示答案时调
   `/api/review/touch` 延长该卡有效期，避免长时间停留后被判过期。埋藏/暂停/标记走
   `POST /api/review/card-action`。
   学习日统一按 Anki 的凌晨 4 点换日（`features/review/daytime.py`），前端热力图与暂存都用服务端
   `todayKey`，不要用浏览器本地日期。
4. 写操作校验 `Origin` 同源；全站接口与静态图片都要登录态。
5. 改这块必须验：后端检查全绿，并实跑「入口 → 显示答案 → 评分 → 撤销 → 结束本轮 → 结算」。
6. 任何 git 改动工作区前必须关闭 collection；备份模块统一走 `prepare_sync / close_for_sync / resume_after_sync`。
   工作区存在 `.git/MERGE_HEAD` 时 collection 拒绝打开（503 `backup_merge_pending`），避免把半合并状态当正常数据读写。
7. 题库编辑与卡片同步（`features/review/bank_sync.py`）：改题只重写 note 字段（QID/Question/Aliases/Summary/Topic/Pages），
   不碰调度状态与卡片本体；删题删除对应 note（卡片随之消失），并把后续题的 QID 逐个前移以保住它们已有的学习进度；
   新增题建新 note。卡片同步失败时不回滚题库文件，只返回「题库已保存，但卡片同步失败」提示。

### 1.11 部署到服务器

> 服务器地址、账号、密码、私钥只放在本机 SSH 配置或凭据管理器里，**不写进本文件、不写进仓库**。

生产是一台 Linux 主机：代码目录 `/var/www/dev-learn`，分支跟踪 `origin/main`；`dev-learn.service` 用 uvicorn 监听 `127.0.0.1:8000`；nginx 把站点挂在子路径 `/dev-learn/`（访问根路径会 302 过去）。部署 = 推送代码 → 服务器拉取 → 重建前端（后端有改动才重启），不涉及数据库，也不动 `backend/data`（独立仓库）。

```bash
# 1. 本地：检查全绿后提交并推送（只 add 本次改动的文件，别带临时产物）
python backend/scripts/check_structure.py
cd frontend && npm run typecheck && npm run lint && npm run test && cd ..
git add <本次改动的文件>
git commit -m "…" && git push origin main

# 2. 服务器：拉取最新代码（工作区必须干净，只允许快进）
cd /var/www/dev-learn
git status --short          # 必须为空
git pull --ff-only
git log --oneline -2        # HEAD 应与本地一致

# 3. 重建前端：先备份旧产物，再构建；依赖没变就不要重装
cp -a frontend/dist /tmp/dist-backup-$(date +%Y%m%d-%H%M%S)
cd frontend && npm run build

# 4. 后端有改动才重启（纯静态资源更新不需要）
systemctl restart dev-learn
```

**按改动范围决定做什么**

| 改动 | 要做的事 |
| --- | --- |
| 只有 `frontend/**` | 第 3 步 |
| `backend/**`、`pyproject.toml` | 第 3 步 + 重启服务；新增依赖先进 `.venv` 安装 |
| `frontend/package.json` / lock 文件 | 先 `npm ci` 再构建 |
| 只有 `backend/data/**` | 不用构建，重启后即读取（独立仓库，同步见 1.10） |

**部署后验证**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/api/health   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1/dev-learn/       # 200
systemctl is-active dev-learn                                              # active
```

再打开首页、文章页、`/admin/login` 确认能正常加载；前端有改动时看 `frontend/dist/assets` 的文件哈希是否已更新。构建通过 ≠ 页面正确，关键改动仍要人工点一遍。

**回滚**

- 前端：`rm -rf frontend/dist && cp -a /tmp/dist-backup-<时间戳> frontend/dist`
- 代码：工作区干净后 `git reset --hard <上一个 commit>`，再重建前端并按需重启

**红线**

- 不把服务器地址、账号、密码、私钥写进仓库或本文件。
- 不在服务器上手工改 `frontend/dist`，不手工编辑 `backend/data`。
- `git pull` 只走 `--ff-only`；出现分叉先查原因，不要强拉覆盖。
- 不删除 `backend/data`、`.env*` 与 `/tmp/dist-backup-*`（回滚要靠它）。

---

## 二、如何写博客

> 完整规范在 [`skills/blog-writing/SKILL.md`](skills/blog-writing/SKILL.md)：写作原则、新增/修改流程、Front Matter、标签分类、文件命名、结构要求、排版、篇幅预算、自检清单、常见坑。**动笔前先读它**，本章只留最常决定成稿质量的核心准则。

**核心准则**：

1. **帮读者弄懂，不是展示你懂**：技术密度不是质量指标，信息量与接收效率的比值才是。
2. **标题写成论点，一章一个论点，结论前置**：❌"解析发生在哪一层" → ✅"解析归谁做：Tomcat 读 body，Spring 只做包装"。
3. **每节先回答"为什么要想这个问题"**：上一节结论留下的缺口 / 读者会撞上的具体现象 / 将要付出的代价。
4. **名词先落地**：类名/方法名/配置项首次出现就交代属于谁、干什么、为什么在这里。
5. **只写给读者**：不出现"根据你的要求…""补充了 XX"这类面向需求方的元叙述。
6. **改旧文当重写整篇**：结构反映当前全部内容，不留"更新于…"等修订痕迹。
7. **篇幅 ≤ 2 万非空白字符（≈ 33 KB）**，再多拆系列。
8. **新文章只写 `backend/data/blog/drafts/`**；发布 = 移入 `backend/data/blog/posts/`，未经许可不发布、不 `git commit` / `git push`。

---

## 三、面试题解析与题库维护

> 完整规范在 [`skills/study-bank/SKILL.md`](skills/study-bank/SKILL.md)：上游管线、抽取脚本、数据契约、加题/加专题、答案格式增强、逐字保真、验收清单、踩坑与硬性禁止。**改题库前先读它**，本章只留红线。

高频红线：

- 源在上游 PDF + `questions.p*.json`；`backend/data/study/*.json` 是派生产物，整题增删走上游重抽，不要当源改。
- `node skills/study-bank/scripts/extract-study.cjs` 会整体覆盖 `backend/data/study`，重抽后必须重跑 `skills/study-bank/scripts/enhance-answers/` 增强流水线。
- 题干/答案逐字照录，不改写、不摘要替代、不删段落、不合并多题；格式只能改空白与块结构。
- 截图即证据：`backend/data/study/**` 不手改、不 P 图、不裁红框；每题至少一组 evidence。
- 改完必须 `node skills/study-bank/scripts/enhance-answers/verify.cjs` 输出 `OK`，再做页面/视觉验收。

---

## 四、协作流程与交付标准

### 4.1 开工前：先定位，再追问

1. 判断任务属于哪条线：

   | 任务特征 | 归属 | 先读 |
   | --- | --- | --- |
   | 写/改文章、标题标签、正文 | 博客内容 | 第二章 + `skills/blog-writing/SKILL.md` |
   | 改题目、答案、截图、专题 | 题库数据 | 第三章 + `skills/study-bank/SKILL.md` |
   | 改页面、接口、样式、后台 | 站点代码 | 第一章（1.3–1.8） |
   | 换框架、加依赖、改构建 | 基础设施 | 第一章，且先与用户确认 |

2. 看清现场：`git status`；文章数量用 `ls backend/data/blog/posts backend/data/blog/drafts`；题库数量读 `backend/data/study/index.json`，不要凭记忆。改代码前先读要改的文件。
3. 需求含糊就问，一次问清：新分类、新标签、新专题、是否发布、是否加 front matter 字段。
4. 不顺手重构：只改任务相关文件；无关问题记下来告诉用户。

### 4.2 动手时：小步、聚焦、可回退

- 一次只解决一个主题；内容改动与代码改动分开。
- 写文件用 read/edit/write，不要用 `>` / `echo` 覆盖正文。
- 改数据结构要全链路同步：schema → repository/service → 前端类型 → UI。
- 新增页面：读者侧放 `frontend/src/features/<domain>/pages/`，路由进 `App.tsx`；后台放 `features/admin/`。
- 新增接口：`features/<domain>/router_*.py`，在 `main.py` 注册；`/api/admin/*` 走登录守卫。
- 大改先给方案：结构调整、拆系列、删章节，先说清「改哪里、为什么、影响什么」。

### 4.3 收尾：验证 + 汇报

| 你改了什么 | 必须做的验证 |
| --- | --- |
| 任何 `.py` | `ruff check` + `ruff format --check` + `mypy` + `pytest` |
| 任何 `.ts` / `.tsx` / 配置 | `npm run typecheck && npm run lint && npm run test && npm run build` |
| 博客文章 / front matter | 打开 `/`、`/posts/<slug>`、`/blog/archive`；看目录；站内链接点一遍 |
| 博客样式 | 亮/暗两套 + 窄屏（390px）各看一眼 |
| 题库 JSON / 截图 | 跑 `skills/study-bank/SKILL.md` 3.7 的自检脚本；打开 `/study`、`/study/<topic>/<qid>` |
| 后台 / 接口 | `/admin/login` → 新建 → 保存 → 预览 → 发布 → 撤回 → 删除，全流程走一遍 |
| 复习页 / 学习设置 | 实跑「入口 → 显示答案 → 评分 → 撤销 → 结束本轮 → 结算」；关掉服务看降级提示 |
| 数据备份 / 多机同步 | 用 tmp 裸仓模拟两台机器：推送、合并、冲突选择、覆盖、安全引用；再打开 `/admin/backup` 走一遍 |
| 搜索 | 任意页面按 `/` 或 `⌘K`，中英文关键词各搜一次 |
| 渲染管线 / 图片尺寸 | 生产构建后看：代码块有复制按钮且无跳版；证据图加载前后不位移 |

**在对话里汇报（不要写进文章/代码注释）**：① 改了什么（路径 + 一句话）；② 怎么验证的（命令 + 页面 + 结果）；③ 没验证/不确定的部分；④ 需要用户决策的事。

**禁止**：不擅自 `git commit` / `git push`；不擅自把草稿「发布」；不声称「已验证」而实际没跑命令、没打开页面；不把临时脚本、截图、`.wip-*` 目录留在仓库。

### 4.4 常见任务索引

| 我想…… | 看 |
| --- | --- |
| 写一篇新博客 | `skills/blog-writing` 2.2 |
| 给已有文章补内容 / 精简 / 调结构 | `skills/blog-writing` 2.3 |
| 确认 front matter 怎么写 | `skills/blog-writing` 2.4 |
| 查标签 / 分类该用哪个 | `skills/blog-writing` 2.5 |
| 加一道题 / 改一道题的答案 | `skills/study-bank` 3.5 |
| 从一份新 PDF 加一个专题 | `skills/study-bank` 3.8 |
| 搞清楚 `backend/data/study/*.json` 的字段 | `skills/study-bank` 3.4 |
| 重新抽取题库 / 同步上游 | `skills/study-bank` 3.3 |
| 改复习页 / 学习设置 / 调度 | 1.10、`backend/data/README.md` |
| 多机同步 / 推送 / 合并 / 覆盖 | 1.10、`backend/data/README.md` |
| 新增页面 / 组件 / 接口、改主题与响应式 | 1.3、1.8、4.2 |
| 部署到服务器 / 回滚线上版本 | 1.11 |
| 排查「接口 500 / 图片 404 / 内容不更新」 | `skills/blog-writing` 2.11、`skills/study-bank` 3.9 |

### 4.5 本文件的维护

- 目录、命令、数据契约、协作流程变化时，同一次改动里同步更新本文件；博客规则改 `skills/blog-writing/SKILL.md`，题库规则改 `skills/study-bank/SKILL.md`。
- 只写可复用的规范，不写一次性任务背景、对话过程、会随内容增长的清单。
- 本文件超过 ~64 KB 会被工具截断；新增规则时先压缩旧表述。

## 五、一句话总结

> **项目**：文件即数据库——`backend/data/blog/` 是文章与文章图片，`backend/data/study/` 是题库与截图，`frontend/public/images/` 只放头像、图标等固定资源；FastAPI 只出 JSON，React 负责页面。
>
> **博客**：先问清楚，再找关联，按「引子 → 问题 → 分层递进 → 收口」写；正文不写 `#` 一级标题，技术经得起查证，语言写给读者；新文章先进 `backend/data/blog/drafts/`。
>
> **题库**：题干、答案、代码、截图逐字照录、以图为证；本仓库 JSON 是派生产物；改数据必须过自检、页面验收与独立审计。
>
> **交付**：后端与前端检查全部跑过，相关页面打开过，改动与未验证项说清楚；不擅自提交、发布、外推。
