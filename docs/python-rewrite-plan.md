# dev-learn 前端后端分离重构计划

> 状态：已完成（P0–P5，2026-11-06）。生产入口只有一个进程：`backend` 的 FastAPI :8000。
> 目标：后端改为 Python（FastAPI），只返回 JSON；前端为独立的 React 应用，接管全部页面。
> 本文是施工依据。切站完成后，需同步重写 `AGENTS.md`，把技术栈、命令、目录、约定更新为新架构。

---

## 1. 背景与目标

现状：

- 站点是 Next.js 单进程，页面、接口、文件读写、Markdown 渲染都在 Node 里完成。
- `anki-svc/` 是独立的 Python 服务（810 行），只负责复习调度，需要单独启动 :8765。
- 本机 Windows 环境 **没有安装 Node/npm**，`node_modules/` 不存在；Python 3.13.13 + pip 26.0.1 可用。

重构目标：

1. 后端彻底改为 Python，FastAPI 只提供 `/api/*` JSON。
2. 前端是完整的 React 应用，拥有全部页面与路由，不再由后端输出 HTML。
3. 复习调度（anki 库）并入 FastAPI 进程，`anki-svc` 独立服务与 8765 端口消失。
4. 代码结构可长期维护：无超级文件、依赖单向、契约唯一、规则可被脚本检查。
5. 内容与资产不动：`content/`、`data/study/`、`public/` 保持原样。

已明确接受的代价：

- 首屏是空 HTML，百度与微信/社交分享抓不到正文；Google 需二次渲染。
- 开发时需要 Vite 与 Uvicorn 两个进程（用一条命令包装）。
- 必须安装 Node LTS（Vite/React 构建无法避免）。

---

## 2. 总体架构

### 2.1 开发环境

```
浏览器 ──▶ Vite Dev Server :5173
                │  /api、/images、/study 代理
                ▼
           FastAPI :8000
                │
        content/  data/study/  public/
```

### 2.2 生产环境

```
浏览器 ──▶ FastAPI :8000（单进程、单 worker）
              ├─ /api/*            JSON 接口
              ├─ /assets/*         frontend/dist 构建产物
              ├─ /images、/study   原始静态资产
              └─ 其他路径          返回 index.html（SPA 回退）
```

### 2.3 进程约束

- **uvicorn 固定 1 个 worker**：anki 的 SQLite collection 与进程内缓存都不支持多进程共享。
- 前后端同源：生产同端口，开发走 Vite 代理，因此**不配置 CORS**。

---

## 3. 仓库目录

```
dev-learn/
├── backend/
│   ├── pyproject.toml
│   └── app/
│       ├── main.py
│       ├── core/
│       ├── rendering/
│       ├── features/
│       └── tests/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── eslint.config.js
│   ├── index.html
│   └── src/
├── content/                 # 文章与草稿，原样保留
├── data/study/              # 题库 JSON，原样保留
├── public/                  # 图片与 PDF 截图，原样保留
├── scripts/
│   ├── dev.py               # 一条命令启动前后端
│   ├── check_structure.py   # 结构规则检查
│   └── extract-study.cjs    # 保留（Node 脚本）
├── docs/
│   └── python-rewrite-plan.md
└── AGENTS.md
```

---

## 4. 后端结构

### 4.1 目录

```
backend/app/
├── main.py                      # 只做装配，≤100 行
├── core/
│   ├── config.py                # Settings，读环境变量
│   ├── paths.py                 # 仓库根解析、安全路径拼接
│   ├── errors.py                # AppError + 统一异常处理
│   ├── security.py              # 密码、cookie、Origin/CSRF 校验
│   ├── logging.py               # 请求 ID + 日志
│   └── pagination.py            # 分页参数与响应模型
├── rendering/                   # 纯函数层，无业务依赖
│   ├── markdown.py
│   ├── plugins.py               # 代码块/表格包裹、图片属性
│   ├── toc.py                   # 锚点与目录（兼容 github-slugger）
│   ├── highlight.py             # Pygments，文章与题库共用
│   └── images.py                # Pillow 读宽高
├── features/
│   ├── posts/
│   │   ├── router_public.py
│   │   ├── router_admin.py
│   │   ├── service.py
│   │   ├── repository.py
│   │   ├── frontmatter.py
│   │   ├── schemas.py
│   │   └── tests/
│   ├── blog/                    # archive / tags / categories
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── schemas.py
│   │   └── tests/
│   ├── study/
│   │   ├── router_public.py
│   │   ├── router_admin.py
│   │   ├── service.py
│   │   ├── repository.py
│   │   ├── schemas.py
│   │   └── tests/
│   ├── search/
│   │   ├── router.py
│   │   ├── service.py
│   │   └── tests/
│   ├── review/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── anki_gateway.py
│   │   ├── sync.py
│   │   ├── schemas.py
│   │   └── tests/
│   ├── auth/
│   │   ├── router.py
│   │   ├── service.py
│   │   └── tests/
│   └── media/
│       ├── router.py
│       ├── service.py
│       └── tests/
└── tests/                       # 跨模块集成测试
```

### 4.2 分层职责

| 层 | 职责 | 禁止 |
| --- | --- | --- |
| `router_*` | 参数校验、调用 service、返回 schema | 读写文件、解析 Markdown、业务规则 |
| `service` | 业务规则、缓存、编排 | `import fastapi`、HTTP 概念 |
| `repository` | 文件读写、原子替换、目录遍历 | 业务规则、调用 service |
| `rendering` | 字符串 → HTML 的纯函数 | 业务模块、文件读写 |
| `schemas` | 输出契约 | 任何逻辑 |
| `core` | 配置、路径、错误、安全、日志 | 业务逻辑 |

### 4.3 依赖规则

```
router ──▶ service ──▶ repository
              │
              └─────▶ rendering
```

- 反向 import 一律禁止。
- 跨 feature 只能调用对方 `service.py` 的公共函数，不得 import 对方的 repository / router；schema 只可作为输出 DTO 复用。
- 禁止出现 `utils.py`、`helpers.py`、`common/`、`misc/`。

---

## 5. 前端结构

### 5.1 目录

```
frontend/src/
├── app/
│   ├── router.tsx               # 路由表 + 懒加载
│   ├── providers.tsx            # QueryClient、主题、鉴权
│   └── layout/                  # Header、Footer、PageShell
├── features/
│   ├── posts/
│   │   ├── api.ts
│   │   ├── hooks.ts
│   │   ├── pages/               # HomePage、PostPage
│   │   └── components/          # PostCard、ArticleBody、ArticleTools
│   ├── blog/
│   │   ├── api.ts
│   │   ├── pages/               # ArchivePage、TagsPage、CategoriesPage
│   │   └── components/
│   ├── study/
│   │   ├── api.ts
│   │   ├── hooks.ts
│   │   ├── pages/               # StudyIndexPage、TopicPage、QuestionPage
│   │   └── components/          # QuestionList、TopicSwitcher、EvidencePanel
│   ├── search/
│   │   ├── api.ts
│   │   └── components/SearchDialog.tsx
│   ├── review/
│   │   ├── api.ts
│   │   ├── pages/ReviewPage.tsx
│   │   ├── hooks/               # useReviewQueue、useReviewAnswer、useReviewHotkeys
│   │   └── components/          # CardPanel、RatingBar、ReviewProgress、Heatmap
│   └── admin/
│       ├── auth/
│       ├── posts/
│       ├── study/
│       ├── upload/
│       └── components/          # PostTable、FrontMatterForm、MarkdownEditor
├── shared/
│   ├── api/client.ts            # 唯一 fetch 封装
│   ├── components/              # Button、Skeleton、Modal 等真正跨领域组件
│   ├── hooks/                   # useDebounce、useTheme、useMediaQuery
│   └── styles/
└── types/api.d.ts               # OpenAPI 生成，禁止手改
```

### 5.2 前端规则

- 页面组件只做“取数据 + 组合”，≤150 行；超出则下沉到 hook/子组件。
- 一个组件一个文件，文件名 = 组件名。
- 组件不直接 `fetch`，只调用所属 feature 的 `api.ts`。
- 服务端状态统一用 TanStack Query，key 按 feature 定义；UI 状态留在组件本地。
- 路由级 `React.lazy`，后台与复习独立 chunk。
- 不建全局 store；主题与登录态用 Context 即可。

### 5.3 样式拆分

`app/globals.css`（4,032 行）与 `app/admin/admin.css`（1,137 行）拆成：

```
frontend/src/shared/styles/
├── index.css               # 唯一入口，按顺序 import
├── tokens.css              # CSS 变量
├── base.css                # reset 与排版
├── layout.css              # Header / Footer / 页面骨架
├── markdown.css            # 正文、代码块、表格、图片
└── responsive.css          # 断点

frontend/src/features/*/styles/
├── posts.css
├── study.css
├── admin.css
└── review.css
```

- 单文件 ≤300 行。
- 类名按区块命名（`.post-*`、`.study-*`、`.admin-*`、`.review-*`），不混用命名法。
- 暗色主题只覆盖 CSS 变量，不在组件里写两套颜色。

---

## 6. API 契约

### 6.1 公开接口

| 方法 | 路径 | 返回 |
| --- | --- | --- |
| GET | `/api/posts?page=&limit=` | `{items, page, limit, total, hasNext}`，列表不含正文 |
| GET | `/api/posts/{slug}` | `{meta, html, toc, prev, next}` |
| GET | `/api/blog/archive` | 按年月分组 |
| GET | `/api/blog/tags` | 标签及计数 |
| GET | `/api/blog/tags/{tag}` | 筛选后的文章列表 |
| GET | `/api/blog/categories` | 分类及计数 |
| GET | `/api/blog/categories/{category}` | 筛选后的文章列表 |
| GET | `/api/search?q=` | 文章 + 题目混合结果（≤16 条） |
| GET | `/api/study` | 专题列表 + 统计 |
| GET | `/api/study/{topic}` | 专题信息 + 轻量题目导航 |
| GET | `/api/study/{topic}/{qid}` | 题目 + 答案 HTML + 证据 |
| GET | `/api/review/*` | 队列、评分、撤销、统计、配置、同步 |
| GET | `/api/health` | 存活检查 |

### 6.2 后台接口（均需登录）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/admin/auth/login` | 登录 |
| POST | `/api/admin/auth/logout` | 退出 |
| GET | `/api/admin/auth/me` | 当前登录态 |
| GET | `/api/admin/posts?status=&q=` | 列表（全部/已发布/草稿） |
| GET | `/api/admin/posts/{type}/{slug}` | 原始 Markdown 与字段 |
| POST | `/api/admin/posts` | 新建（默认草稿） |
| PUT | `/api/admin/posts/{type}/{slug}` | 保存 |
| POST | `/api/admin/posts/{type}/{slug}/publish` | 发布 |
| POST | `/api/admin/posts/{type}/{slug}/unpublish` | 撤回 |
| DELETE | `/api/admin/posts/{type}/{slug}` | 移入 `.trash/` |
| POST | `/api/admin/preview` | 渲染预览，不写盘 |
| POST | `/api/admin/upload` | 上传图片 |
| GET/POST | `/api/admin/study/config` | 每日上限 |
| GET | `/api/admin/study/stats` | 学习统计 |
| POST | `/api/admin/study/sync` | 快照 + 推送 |

### 6.3 约定

- 成功：按 HTTP 语义直接返回资源，不套 `{data}`。
- 失败：`{"error": {"code", "message", "fields"}}`，由 `core/errors.py` 统一产出；FastAPI 的 422 也映射为该形状。
- 分页：`page` 从 1 开始；`hasNext` 由后端计算。
- 列表不返回正文；文章详情才带 `html`/`toc`；专题接口不返回答案，单题接口才返回。
- 类型唯一来源：Pydantic 模型 → OpenAPI → `openapi-typescript` 生成 `types/api.d.ts`。
- 缓存：公开 GET 可带 `ETag`/`Last-Modified`；后台接口一律 `no-store`。

---

## 7. 渲染管线

| 能力 | 方案 |
| --- | --- |
| Markdown | `markdown-it-py` + `mdit-py-plugins`（表格、删除线、任务列表、脚注） |
| HTML 透传 | 开启 `html=True`，与现状一致 |
| 代码高亮 | Pygments，服务端输出 token span，CSS 变量做亮/暗双主题 |
| 代码块结构 | 服务端包裹为 `.code-block` + `.code-bar` + 复制按钮（与现有样式对齐） |
| 表格 | 服务端包裹 `.table-wrap` |
| 目录 | 后端收集 h2/h3，锚点算法按 github-slugger 移植，保证旧链接不失效 |
| 公式 | 后端输出带 `data-tex` 的占位元素，前端文章页调用一次 KaTeX 渲染 |
| 图片 | Pillow 读宽高，注入 `width`/`height`；`loading="lazy"`、`decoding="async"` |
| 题库答案 | 与文章共用 Pygments；按答案 sha1 缓存高亮结果 |
| 预览 | 与文章页同一渲染函数，仅不写盘 |

已知差异：

- Pygments 配色与 Shiki `vitesse-light/dark` 不会完全一致，需要重新映射 CSS。
- 公式从服务端渲染改为浏览器端渲染，文章页会多一次 KaTeX 初始化。

---

## 8. 缓存与性能

| 对象 | 策略 |
| --- | --- |
| 文章 | 按文件 `mtime + size` 缓存解析结果与渲染 HTML；写/删/移动时主动失效 |
| 文章列表 | 按 `content/` 目录指纹缓存 |
| 专题 JSON | 按 `mtime + size` 缓存最近 6 篇 |
| 题库索引 | 进程内单例缓存 |
| 答案高亮 | 按答案 sha1 缓存 |
| 图片尺寸 | 进程内字典缓存 |
| 前端 | TanStack Query 负责客户端缓存；路由级代码分割 |

额外要求：

- `/api/study/{topic}` 只返回导航字段，不返回 `answer`/`evidence`。
- 复习取卡只带题面，答案走 `/api/review/card-answer` 按需加载。
- 单题接口只读取当前专题 JSON，不扫描全部题库。

---

## 9. 安全

| 项 | 做法 |
| --- | --- |
| 登录 | httpOnly signed cookie（`itsdangerous`），7 天过期；密码来自 `ADMIN_PASSWORD`，`hmac.compare_digest` 比较 |
| 限流 | 登录失败计数，超过阈值短暂拒绝 |
| CSRF | `SameSite=Lax` + 写操作校验 `Origin` |
| 上传 | 扩展名 + Pillow 解码双重校验；≤20MB；文件名重写；按年月落盘 |
| 路径穿越 | slug 白名单校验；拼接后 `resolve()` 必须仍在目标目录内 |
| XSS | 内容来自本仓库；`answer` 为可信数据；如需加固可接 `nh3` 白名单清洗 |
| CORS | 不启用（同源设计） |

---

## 10. 质量闸门

| 检查 | 工具 | 门槛 |
| --- | --- | --- |
| Python 风格 | ruff | 行长 100、无未使用 import、复杂度上限 |
| Python 类型 | mypy strict | service / rendering / core 全量标注 |
| 前端类型 | `tsc --noEmit` | strict，无隐式 `any` |
| 前端规范 | ESLint + Prettier | `max-lines: 250` |
| 结构约束 | `scripts/check_structure.py` | 见下 |
| 后端测试 | pytest | service / rendering / api 核心分支 |
| 前端测试 | Vitest + Testing Library | hooks 与关键组件 |
| 端到端 | Playwright | 后台全流程、复习流程、文章与题目页 |
| 构建 | Vite build + ruff + mypy | 提交前全绿 |

`check_structure.py` 至少检查：

1. 手写文件超过 300 行 → 失败。
2. `backend/app/features/*/service.py` 出现 `import fastapi` → 失败。
3. `backend/app/features/*/router_*.py` 出现 `open(` / `Path.read_text` → 失败。
4. `rendering/` 反向 import `features/` → 失败。
5. 跨 feature 直接 import repository/router → 失败。
6. 前端 `pages/` 直接调用 `fetch` → 失败。
7. 禁止目录/文件名：`utils.py`、`helpers.*`、`common/`、`misc/`。

---

## 11. 现有文件拆分映射

| 现状 | 体量 | 去向 |
| --- | --- | --- |
| `app/globals.css` | 4,032 行 | `shared/styles/` 下 6 个文件 + `features/*/styles/` |
| `app/admin/admin.css` | 1,137 行 | `features/admin/styles/` |
| `components/review/ReviewSession.tsx` | 31 KB | `review/pages/ReviewPage` + CardPanel + RatingBar + ReviewProgress + 3 个 hook + api |
| `components/study/StudySidebar.tsx` | 13.8 KB | QuestionList + TopicSwitcher + SidebarSearch + useQuestionNav |
| `components/admin/PostEditor.tsx` | 13 KB | MarkdownEditor + FrontMatterForm + EditorToolbar + PreviewPane + usePostDraft |
| `components/admin/StudyAdmin.tsx` | 12.2 KB | DailyLimitForm + StudyStats + SyncPanel |
| `components/admin/AdminDashboard.tsx` | 9.9 KB | PostTable + StatusFilter + AdminHeader |
| `components/review/ReviewLauncher.tsx` | 8.9 KB | 保留，改为调用新 api |
| `components/study/EvidencePanel.tsx` | 3.2 KB | 保留 |
| `lib/posts.ts` | 12.9 KB | posts/repository.py + service.py + frontmatter.py |
| `lib/study.ts` | 12 KB | study/repository.py + service.py + images.py |
| `lib/markdown.ts` | 8.1 KB | rendering/markdown.py + plugins.py + toc.py |
| `lib/search.ts` | 5.6 KB | search/service.py |
| `lib/study-highlight.ts` | 4.7 KB | rendering/highlight.py |
| `lib/auth.ts` | 0.6 KB | core/security.py + auth/service.py |
| `anki-svc/server.py` | 810 行 | review/router.py + service.py + anki_gateway.py + sync.py |

---

## 12. 迁移阶段与验收

> 迁移已完成：Next 代码与依赖（`app/`、`components/`、`lib/`、`next.config.ts`、根 `package.json`）已删除，仓库里只保留 FastAPI + Vite 两套源码。

| 阶段 | 内容 | 验收标准 |
| --- | --- | --- |
| P0 | FastAPI 骨架、配置、错误处理、静态挂载、Vite 骨架、`scripts/dev.py`、结构检查脚本、lint/type 配置 | `/api/health` 200；首页能取到 `/api/posts` 并渲染 |
| P1 | 博客只读：文章列表、文章页、归档、标签、分类、搜索 | 与现站逐页对照；TOC、代码复制、公式、图片正常 |
| P2 | 题库：专题列表、专题页、三栏题目页、侧栏切题、证据图放大 | `/study/jvm/q001` 布局与交互与现站一致 |
| P3 | 后台：登录、列表、编辑器、预览、发布/撤回、删除、上传 | 全流程走一遍，`.trash/` 可找回 |
| P4 | 复习：anki 进程内调度、复习页、统计、热力图、学习设置、快照 | 入口 → 显示答案 → 评分 → 撤销 → 结束本轮 → 结算；关服务看降级 |
| P5 | 切站：删除 Next 代码与依赖、更新 `AGENTS.md`、全站回归 | 单进程 `uvicorn` 跑通；`ruff`/`mypy`/`eslint`/`tsc`/`pytest`/`vitest`/`playwright` 全绿 |

每个阶段结束必须：

1. 跑该阶段相关测试与构建。
2. 打开对应页面人工验收。
3. 更新本文件的阶段状态。

---

## 13. 前置条件与风险

### 前置条件

1. **Node LTS**（React/Vite 必需）：本机装在 `C:\Users\Admin\.local\node`，未加入全局 PATH。
2. Python 3.13 可用；需验证 `anki` 包兼容性，不兼容则用 3.12 创建虚拟环境。
3. 安装后端依赖：`fastapi`、`uvicorn[standard]`、`python-frontmatter`、`markdown-it-py`、`mdit-py-plugins`、`pygments`、`pillow`、`itsdangerous`、`python-multipart`、`anki`。
4. 安装前端依赖：`react`、`react-dom`、`react-router-dom`、`@tanstack/react-query`、`codemirror` 系列、`katex`。

### 风险

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 无 Node | 前端无法构建 | 先安装 Node LTS |
| Pygments 配色差异 | 代码块视觉变化 | 重新映射 CSS 变量，逐页对照 |
| KaTeX 改到浏览器 | 首屏公式闪动 | 文章页预加载 KaTeX，占位保持行高 |
| 锚点算法差异 | 旧文章锚点失效 | 按 github-slugger 规则实现并写回归测试 |
| 单 worker 限制 | 无法水平扩展 | 单机自用场景可接受 |
| 文件并发写 | 内容损坏 | 临时文件 + `os.replace`，写操作串行 |
| 前后端类型漂移 | 接口对不上 | OpenAPI 生成 + CI 比对 |
| 大 JSON | 题目页响应过大 | 专题只给导航，答案按需加载 |

---

## 14. 明确不做

- 不引入数据库、ORM、迁移工具。
- 不做 repository 接口抽象（只有一个实现）。
- 不做 DDD 聚合、事件总线、消息队列、微服务。
- 不做 API 版本号（前后端同仓同发）。
- 不引入 Docker / docker-compose。
- 不引入 turbo / nx 等 monorepo 工具。
- 不在前端引入第二套状态管理库。
- 不为“以后可能用到”预留扩展点。

---

## 15. 阶段状态

| 阶段 | 状态 |
| --- | --- |
| 设计 | 已完成 |
| P0 | 已完成 |
| P1 | 已完成 |
| P2 | 已完成 |
| P3 | 已完成 |
| P4 | 已完成 |
| P5 | 已完成 |

### 交付验证（2026-11-06）

| 项目 | 结果 |
| --- | --- |
| 后端 | `ruff check` / `ruff format --check` / `mypy` 全绿；`pytest` 45 passed |
| 前端 | `tsc -b` / `eslint` / `vitest`（10 passed）/ `vite build` 全绿 |
| 端到端 | 生产 `uvicorn` + `frontend/dist`：38/38 检查通过，19 张流程截图 + 9 张视口截图 |
| 性能 | `/api/posts` 7ms、文章 14ms/94KB、`/api/study/jvm` 5ms、搜索 9ms；首页 12 个资源 / 3KB |
| 文件规模 | 页面 ≤150 行、组件 ≤200 行、其余手写文件 ≤300 行、CSS ≤300 行 |
