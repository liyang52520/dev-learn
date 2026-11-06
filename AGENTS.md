# AGENTS.md — dev-learn 协作说明

> 本文件面向在本仓库工作的 AI 助手与新加入的人类协作者。
>
> `dev-learn` 是「YG's Blog」个人站与「Java 面试宝典」学习站的合并体：左边写博客，右边做题库，全部由仓库里的文件驱动。
>
> **一句话：内容都在文件里，改文件就是改站点；两条内容线的最高标准分别是「让读者弄懂」和「原文可查」。**

## 怎么用这份文件

| 你要做的事 | 直接读 |
| --- | --- |
| 结构 / 命令 / 后台 / 代码约定；新增复习子系统 | 第一章（复习另见 `anki-svc/README.md`） |
| 写、改博客文章 | 先读 [`skills/blog-writing/SKILL.md`](skills/blog-writing/SKILL.md)，第二章只是索引 |
| 维护题库、加专题 | 先读 [`skills/study-bank/SKILL.md`](skills/study-bank/SKILL.md)，第三章只是索引 |
| 接手任务、交付自检 | 第四章 |

> **来源**：由旧博客仓库与旧题库仓库（`/Users/liyang/Deepseek/projects/interview`）的 `AGENTS.md` 合并改写，细节已按本仓库重写。上游文档只作历史参考。
>
> **分工**：本文件管项目结构、代码约定与协作流程；博客与题库的完整细则在 `skills/*/SKILL.md`，两处冲突时以 `skills/` 为准。
>
---

## 一、这是一个什么项目

`dev-learn` 是「YG's Blog」个人站与「Java 面试宝典」学习站的合并体，一个纯文件驱动的 Next.js 站点：

- **博客**：`content/posts/*.md` 写文章，站点提供首页、归档、标签、分类、文章页。
- **学习**：`data/study/*.json` 存 42 个专题、2521 道题，配套 `public/study/` 下 8000 多张 PDF 原文截图。
- **后台**：`/admin` 自带本地 CMS，可新建、编辑、预览、发布文章并上传图片。

没有数据库、没有外部 CMS、没有后端服务。**仓库里的文件就是数据库**：改 Markdown 就是发文章，改 JSON 就是改题库，`git` 就是版本管理与发布记录。

### 1.1 两个来源仓库

本仓库由两个旧仓库合并而来。它们仍留在本机作为历史与上游资料，但**日常维护只在本仓库进行**：

| 部分 | 上游仓库（本机路径） | 上游形态 | 在本仓库的形态 |
| --- | --- | --- | --- |
| 博客 | `/Users/liyang/WebstormProjects/liyang52520.github.io` | Hexo + Butterfly，`source/_posts`、`_config.yml`、`scaffolds` | Next.js 重写：`content/posts`、`app/(site)`、`components` |
| 面试题 | `/Users/liyang/Deepseek/projects/interview` | Python 工具链 + 42 个 PDF + 生成的静态三栏站 `site/` | 只保留产物：`data/study/*.json`、`public/study/**`，加抽取脚本 `scripts/extract-study.cjs` |

迁移已完成：22 篇博客（含草稿）、42 个专题 2521 道题、5762 张证据截图全部到位。上游的 Hexo 依赖、PDF 原文、Python 工具链**都没有也不应该**搬进来（见 1.9）。


### 1.2 技术栈

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 框架 | Next.js 15.5（App Router）+ React 19 | 默认 Server Component；动态数据页标 `dynamic = 'force-dynamic'` |
| 语言 | TypeScript 5.9，`strict: true` | 路径别名 `@/*` → 仓库根 |
| 内容解析 | `gray-matter` | 读写 Markdown front matter |
| Markdown 渲染 | `unified` + `remark-gfm` + `remark-math` → `rehype-raw` + `rehype-katex` + `@shikijs/rehype` | GFM、公式、Shiki 高亮、内嵌 HTML |
| 后台编辑器 | CodeMirror 6 | 浏览器内编辑，保存走后端 API 写文件 |
| 搜索 | 进程内全文扫描（`lib/search.ts`） | `GET /api/search?q=…`，文章与题库统一检索 |
| 样式 | 单个 `app/globals.css` + CSS 变量 | 暗色是 `html.dark` 覆盖变量；后台另有 `app/admin/admin.css` |
| 质量门槛 | `tsc --noEmit` + `next build` + 人工验收 | 没有 ESLint、测试框架、CI |

### 1.3 目录结构

```
dev-learn/
├── app/
│   ├── (site)/                 # 读者侧路由组，共享 Header + Footer
│   │   ├── page.tsx            # 首页：最新文章 + 分页（每页 8 篇）
│   │   ├── posts/[slug]/       # 文章详情
│   │   ├── blog/               # archive / tags / categories（含 [tag]、[category]）
│   │   └── study/              # 专题总览 / 专题首页 / 单题三栏页
│   ├── (focus)/review/         # 复习页：专注布局，不套 Header/Footer（见 1.10）
│   ├── admin/                  # 后台：登录、列表、编辑器、整页预览、study/ 学习设置
│   ├── api/                    # admin/*（登录/读写/发布/预览/上传）、review/*、search
│   ├── globals.css             # 全站样式（设计变量 + 组件样式）
│   ├── layout.tsx              # 根布局：主题初始化、全局 metadata（KaTeX 样式按路由引入）
│   └── icon.svg
├── components/                 # 展示组件；admin/、study/、review/ 子目录
├── content/
│   ├── posts/                  # 已发布文章，文件名（去 .md）= slug
│   └── drafts/                 # 草稿，不出现在站点上
├── data/study/                 # index.json + 42 个专题 JSON（答案 HTML + 证据分组）
├── public/
│   ├── images/                 # avatar 与后台上传产物 images/uploads/YYYY/MM/
│   └── study/                  # 42 个专题的 PDF 截图（约 755 MB，勿手改）
├── lib/                        # 唯一读写文件的层：posts / study / search / markdown / shiki / auth / types
├── scripts/extract-study.cjs   # 从上游静态站抽取题库 JSON（见 skills/study-bank 3.3）
├── scripts/enhance-answers/    # 抽取后的答案格式增强：代码行还原 / 模型审阅 / 非代码结构修复 / 自检（见 skills/study-bank 3.5、3.7）
├── skills/                     # 内容线细则：blog-writing/（写博客）、study-bank/（题库与抽取）
├── anki-svc/                   # 本地复习服务（Python + Anki 内核），见 1.10
├── instrumentation.ts          # 启动钩子：后台预热 Shiki 高亮器（见 1.8.15）
├── middleware.ts               # /admin 与 /api/admin 的登录守卫
└── next.config.ts / tsconfig.json / package.json
```

### 1.4 路由地图

| 路由 | 类型 | 说明 |
| --- | --- | --- |
| `/` | 动态 | 首页；`?page=2` 翻页，每页 8 篇已发布文章 |
| `/posts/[slug]` | 动态 | 文章页：TOC、阅读进度、代码复制、上一篇/下一篇 |
| `/blog/archive`、`/blog/tags`、`/blog/tags/[tag]`、`/blog/categories`、`/blog/categories/[category]` | 动态 | 归档、标签云与筛选、分类云与筛选 |
| `/study` | 静态 | 42 个专题卡片 + 前端筛选 |
| `/study/[topic]` | 动态 | 重定向到该专题第一题 |
| `/study/[topic]/[qid]` | 动态 | 三栏页：左题目列表、中答案、右 PDF 证据截图 |
| `/review` | 静态壳 | 复习页（专注布局）；后端服务不可用时降级成提示页 |
| `/admin`、`/admin/login` | 静态壳 | 文章列表（全部/已发布/草稿）、密码登录 |
| `/admin/study` | 静态壳 | 学习设置：每日上限、学习统计、手动快照并推送 |
| `/admin/edit/[type]/[slug]`、`/admin/preview/[type]/[slug]` | 动态 | 编辑器、整页预览（`type` 只能是 `posts`/`drafts`） |
| `/api/search?q=` | 接口 | 文章 + 题目混合结果（最多 16 条） |
| `/api/admin/*` | 接口 | 后台读写，全部受 `middleware.ts` 保护 |

### 1.5 数据流

**博客**：`content/posts/*.md` → `lib/posts.ts`（gray-matter 解析 meta/摘要/阅读时长）→ `lib/markdown.ts`（unified + Shiki + KaTeX）→ `ArticleView` 输出 HTML 与 TOC；同一份数据供 `lib/search.ts` 提供 `/api/search`。

**题库**：见 `skills/study-bank/SKILL.md`（上游 PDF → 静态站 → 本仓库 JSON）。

**后台**：`/admin` → `/api/admin/{posts,post,publish,preview,upload}` → `lib/posts.ts` 原子写（临时文件 + rename）；发布/撤回 = 在 `content/posts` 与 `content/drafts` 间移动；删除 = 移入 `.trash/<type>/<时间戳>-<slug>.md`；上传 = 落 `public/images/uploads/<年>/<月>/`。

### 1.6 本地运行与验证

```bash
npm install        # 必须先做；仓库不提交 node_modules
npm run dev        # http://localhost:3000
npm run build      # 生产构建
npm run start      # 生产模式启动（先 build）
npm run typecheck  # tsc --noEmit
```

- 后台：`http://localhost:3000/admin`，密码取 `ADMIN_PASSWORD`，未设置时默认 `yg-admin`。建议本地显式设置：`ADMIN_PASSWORD=xxx npm run dev`。
- Node 建议 20+（验证版本 v24.15.0，Next 15 要求 ≥ 18.18）。
- `npm run dev` 用 **Turbopack**，首编译比 webpack 快约一倍；怀疑它引入问题时可临时 `npx next dev` 对照。
- `npm run dev` 与 `npm run build` 争用 `.next/`：**不要**在 dev 运行时 build；验证完 build 记得重启 dev。
- 构建通过 ≠ 内容正确，构建只读真实文件，内容仍需人工打开页面看。

提交前必跑 `npm run typecheck && npm run build`，再按改动范围抽查：

| 改了什么 | 至少打开 |
| --- | --- |
| 文章 / front matter / 样式 | `/`、`/posts/<slug>`、`/blog/archive` |
| 题库 JSON | `/study`、`/study/<topic>/<qid>`（含右侧截图） |
| 后台 API / 编辑器 | `/admin/login` → 新建 → 保存 → 预览 → 发布 → 撤回 |
| Header / 搜索 | 任意页面按 `/` 或 `⌘K`，搜中英文关键词 |
| 静态资产 | 直接访问截图 URL，确认无 404 |

### 1.7 内容管理后台

1. `/admin/login` 校验密码后写入 httpOnly cookie `yg_admin`（7 天），值为 `SHA-256("yg-site:" + password)`。
2. `/admin` 支持「全部 / 已发布 / 草稿」筛选与关键词过滤；「新建文章」默认建在 `content/drafts`，文件名由标题 slug 化。
3. 编辑器字段：`title`、`date`、`tags`（逗号分隔）、`categories`（逗号分隔）、`description`、`cover`；正文用 CodeMirror，`⌘/Ctrl+S` 保存。
4. 「预览」走 `/api/admin/preview`（同一渲染管线）；「整页预览」走 `/admin/preview/[type]/[slug]`；「发布/撤回」只移动文件；「删除」移到 `.trash/`。
5. 上传仅支持 png/jpeg/webp/gif、≤ 20 MB，返回 `/images/uploads/YYYY/MM/…` 可直接粘进正文。

后台只编辑已知字段；手写在 front matter 里的额外字段会被保留（`getRawPost` 的 `extra`），但新增字段的完整支持需同时改 `lib/posts.ts`、`lib/types.ts`、`components/admin/PostEditor.tsx`。

### 1.8 代码约定

1. **服务端优先**：默认 Server Component，只有需要状态/事件/浏览器 API 的组件才加 `'use client'`（当前：`Header`、`PrefetchLink`、`Toc`、`SearchDialog`、`ArticleTools`、`StudySidebar`、`StudyTopicBrowser`、`EvidencePanel`、`PostEditor`、`AdminDashboard`、`StudyAdmin`、`ReviewSession`、`ReviewLauncher`、`app/admin/login/page.tsx`）。`SearchDialog` 由 `Header` 用 `next/dynamic`（`ssr: false`）拆包，不进首屏关键路径。
2. **文件读写只在两处**：`lib/*.ts` 与 `app/api/**/route.ts`；页面与组件只调用 lib 函数。
3. **类型先行**：站点/文章类型在 `lib/types.ts`，题库类型在 `lib/study.ts`；新增字段先改类型，再改读取与 UI。
4. **样式**：全部集中在 `app/globals.css`，用 `:root` / `html.dark` 的 CSS 变量（`--bg`、`--ink`、`--accent`、`--radius` …）。不引入 Tailwind / 组件库；新增区块按注释分区追加，并同时处理 `< 900px`。
5. **时间**：front matter 写 `YYYY-MM-DD HH:mm:ss`；展示统一用 `formatDateParts` 按 `Asia/Shanghai` 格式化。
6. **中文文案**：读者可见文案、错误提示、后台提示全部中文。
7. **动态数据页**：构建后仍可能变化的页面（首页、文章、归档、标签、分类）标 `export const dynamic = 'force-dynamic'`；题库页保持默认。
8. **URL 编码**：slug / tag / category 含中文或空格，构造链接一律 `encodeURIComponent`，读取时 `decodeURIComponent`。
9. **切换页面要有即时反馈**：每个动态数据路由旁配 `loading.tsx`（骨架统一用 `components/PageSkeleton.tsx`，新增路由时补），客户端路由缓存由 `next.config.ts` 的 `experimental.staleTimes` 控制（`dynamic: 30`，后退/前进 30 秒内不再回服务端）。链接预取统一走 `components/PrefetchLink.tsx`：`mouseenter` / `focus` / `touchstart` 时 `router.prefetch()`（Next 的 `<Link>` 默认只预取 loading 边界，`router.prefetch()` 才是完整 RSC 预取）；文章列表行、文章/题目上下篇这种少量链接用 `prefetch={true}` 在视口内直接 FULL 预取，**几十上百条的侧栏与 42 张专题卡片只用意图预取，禁止 `prefetch={true}`**（专题卡片进第一题要新建三栏布局，是「进入题目」最重的一条路径，已在 `StudyTopicCard` 接意图预取）。注意 Next 在 dev 下禁用预取，只有生产构建才看得到效果。
10. **别把大字段塞进客户端组件 props**：Client Component 的 props 会整份序列化进 RSC payload，每次导航重新下发。题库侧栏这类只需要展示字段的组件用 `questionNav()` 裁到 `id/no/title/aliases`；`answer`、`evidence` 这类大字段只留在 Server Component 里。
11. **重数据按 mtime 缓存**：`data/study/<id>.json` 单篇最大 2.4 MB，`getStudyTopic()` 已按 mtime + size 缓存最近 6 篇；`getPost()` / `getRawPost()` 按文件 stat 缓存（含渲染后的 HTML/TOC，Promise 缓存顺带合并 `generateMetadata` 与页面组件的两次取用），`listPosts()` 按目录指纹缓存；写/删/移文章会主动清空这些缓存。新增读盘逻辑沿用同一思路，不要每次请求重新 `JSON.parse` / 重新渲染 Markdown。检索类数据优先用 `data/study/index.json` 里预计算的 `search`，不要为一次搜索遍历 42 个专题 JSON。
12. **代码块/表格在服务端包裹**：`lib/markdown.ts` 的 rehype 管线输出 `<div class="code-block"><div class="code-bar">…<button class="code-copy" data-code-copy>复制</button></div><pre>…</pre></div>` 与 `<div class="table-wrap">…</div>`，`ArticleTools` 只做 `[data-code-copy]` 的事件委托 + 阅读进度条。**不要再在客户端 hydration 后移动/包裹 DOM**——那会让首屏内容二次跳动。包裹插件必须排在 `rehypeShiki` 之前（之后 `<pre>` 会被高亮片段替换，语言类名丢失）。正文 `<img>` 由同一管线补 `loading="lazy"` / `decoding="async"`。
13. **KaTeX 样式按路由引入**：`katex/dist/katex.min.css` 只在 `/posts/[slug]`、`/admin/preview/*` 与后台编辑器（`PostEditor` 的预览面板）里 import，不放在根布局——题库与首页用不到（约 24 KB CSS）。
14. **图片宽高必须可预留**：题库证据截图与答案配图的 `width/height` 由 `lib/study.ts` 读文件头（JPEG/PNG）在内存中注入（不写盘、不进 JSON），`getStudyQuestion()` 懒补当前题、带尺寸缓存；新图若手写在 `answer` HTML 里也走这条注入（`src` 必须以 `/study/` 开头）。缺尺寸的图片加载后会把版面顶开，是题目页 CLS 的主因。
15. **Shiki 语言要登记**：`lib/shiki.ts` 的 `COMMON_LANGS`（文章页再并上 `content/**` 扫到的围栏语言）才会交给 Shiki；`@shikijs/rehype` 默认会把全部 200+ 语法装进来（实测 1.7 s）。`instrumentation.ts` 启动后后台预热同一份语言集（首个文章请求的 200 ms 冷启动尾巴因此消失）。新语言写进文章即可被扫描到，但 dev 下需重启 server 才重新扫描。
16. **题库答案的代码高亮也在服务端做**：`data/study/<id>.json` 的 `answer` 里代码块统一为 `<pre class='code' data-lang='java'><code>逐行代码（HTML 转义）</code></pre>`，`lib/study-highlight.ts` 在题目页渲染时用同一个 Shiki 单例高亮成 `.code-block`（结构与文章页一致），并按答案 sha1 缓存。不要在客户端 hydration 后再高亮/移动 DOM：会让首屏代码二次重排，也拿不到服务端缓存。

### 1.9 不要做的事

- ❌ 重新引入 Hexo、Butterfly、`_config.yml`、`scaffolds`、`db.json` 或 GitHub Pages 部署链——那是上游历史，本仓库是 Next.js 重写。
- ❌ 手工编辑 `public/study/**` 截图；题库变更改 `data/study`，截图由抽取流程生成。
- ❌ 把 PDF 原文搬进仓库（单篇最大 46 MB，42 篇合计 800 MB+）。
- ❌ 提交 `node_modules/`、`.next/`、`.trash/`、`build/`、`out/`（`.gitignore` 已覆盖）。
- ❌ 手动拼 front matter 写文件；统一走 `serializePost()` / 后台 API。
- ❌ 在客户端组件里 import `node:fs` / `node:path`。
- ❌ 全量复制 `public/study` 或 `data/study`；本仓库已有 ≈ 780 MB 资产，增量要克制。

### 1.10 复习：本地 Anki 服务（可选子系统）

站点本身不存学习状态。「复习」是挂在本机的一个 Python 服务（Anki v3 调度器），题目内容仍由本站 `data/study` 渲染。
命令、接口、备份恢复细节都在 `anki-svc/README.md`，这里只留约定。

| 部分 | 位置 |
| --- | --- |
| 调度服务 / 导入脚本 | `anki-svc/server.py`、`anki-svc/import.py`（只听 `127.0.0.1:8765`） |
| 学习状态 | `anki-svc/data/`（独立仓库 dev-anki，已 gitignore；本地快照 30 份） |
| 站点代理 | `app/api/review/[...path]/route.ts`（读 `.token`；服务器上没有 → 一律 503） |
| 复习页 | `app/(focus)/review/` + `components/review/` |
| 后台设置 | `app/admin/study/` |

命令：`npm run anki`（起服务）、`npm run anki:import`（重建 collection）；首次需
`python3 -m venv anki-svc/.venv && anki-svc/.venv/bin/pip install -r anki-svc/requirements.txt`。

约定：
1. 只监听 `127.0.0.1`（单机使用，不接内网穿透、不开公网端口），除 `/health` 外都要 `X-Review-Token`。
2. 内容归站点、状态归 Anki：复习页从 `data/study` 渲染题面与答案，Anki 只负责「下一张卡 / 四个按钮文案 / 复习日志」。
3. `anki-svc/data` 与 `.token` 永不入库；服务每 10 分钟快照、15 分钟自动 commit+push 到 dev-anki，提交前先做 WAL checkpoint。
4. `/answer` 直接返回下一张卡（三跳变一跳）；调度状态缓存在服务端内存，浏览器只回 `card_id + rating`。
5. 改这块必须验：`npm run typecheck && npm run build`，并实跑「/study 入口 → 显示答案 → 评分 → 撤销 → 结束本轮 → 结算」。

---

## 二、如何写博客

> 完整规范在 [`skills/blog-writing/SKILL.md`](skills/blog-writing/SKILL.md)（2.1–2.12）：写作原则、新增/修改流程、Front Matter、标签分类、文件命名、结构要求、排版、篇幅预算、自检清单、常见坑。**动笔前先读它**，本章只留最常决定成稿质量的核心准则，格式细则不在这里。

**核心准则**（写/改任何文章都按这个来；格式细则在 skill）：

1. **帮读者弄懂，不是展示你懂**：技术密度不是质量指标，信息量与接收效率的比值才是。
2. **标题写成论点，一章一个论点，结论前置**：❌"解析发生在哪一层" → ✅"解析归谁做：Tomcat 读 body，Spring 只做包装"；改完章标题要逐个检查下属小节标题。
3. **每节先回答"为什么要想这个问题"**：上一节结论留下的缺口 / 读者会撞上的具体现象 / 将要付出的代价。答不上就删或换骨架。
4. **名词先落地**：类名/方法名/配置项首次出现就交代属于谁、干什么、为什么在这里；三样缺一即裸名词，一个就足以卡住读者。
5. **只写给读者**：不出现"根据你的要求…""补充了 XX"这类面向需求方的元叙述；判据是这句话写给读者还是写给提问的人。
6. **改旧文当重写整篇**：结构反映当前全部内容，不在末尾 append"补充/番外"、不留"更新于…"等修订痕迹。
7. **篇幅 ≤ 2 万非空白字符（≈ 33 KB）**，3.1 万是顶格且须真机验证，再多拆系列。
8. **新文章只写 `content/drafts/`**；发布 = 移入 `content/posts/`，未经许可不发布、不 `git commit` / `git push`。

> 其余（front matter 六字段与引号规则、文件名与 `%` 禁字符、标签分类表、站内链接写法、公式/代码块/表格/图片、自检清单、常见坑）见 skill 2.4–2.11。

---

## 三、面试题解析与题库维护

> 完整规范在 [`skills/study-bank/SKILL.md`](skills/study-bank/SKILL.md)（3.1–3.10）：上游管线、抽取脚本、数据契约、加题/加专题、答案格式增强、逐字保真、验收清单、踩坑与硬性禁止。**改题库前先读它**，本章只留索引与红线。

高频红线：

- 源在上游 PDF + `questions.p*.json`；`data/study/*.json` 是派生产物，整题增删走上游重抽，不要当源改。
- `node scripts/extract-study.cjs` 会整体覆盖 `data/study`，重抽后必须重跑 `scripts/enhance-answers/` 增强流水线。
- 题干/答案逐字照录，不改写、不摘要替代、不删段落、不合并多题；格式只能改空白与块结构。
- 截图即证据：`public/study/**` 不手改、不 P 图、不裁红框；每题至少一组 evidence。
- 改完必须 `node scripts/enhance-answers/verify.cjs` 输出 `OK`，再做页面/视觉验收；批量改题加两个只读 agent 审计。

---

## 四、协作流程与交付标准

前三章是「仓库是什么、两条内容线怎么生产」；这一章是「接手任务后怎么开工、怎么收尾」。

### 4.1 开工前：先定位，再追问

1. **判断任务属于哪条线**，先读对应章节：

   | 任务特征 | 归属 | 先读 |
   | --- | --- | --- |
   | 写/改文章、标题标签、正文 | 博客内容 | 第二章 + `skills/blog-writing/SKILL.md` |
   | 改题目、答案、截图、专题 | 题库数据 | 第三章 + `skills/study-bank/SKILL.md` |
   | 改页面、组件、API、样式、后台 | 站点代码 | 第一章（1.3–1.8） |
   | 换框架、加依赖、改构建 | 基础设施 | 第一章，且先与用户确认 |

2. **看清现场**：`git status` 看工作区状态；文章数量用 `ls content/posts content/drafts`，题库数量读 `data/study/index.json`，不要凭记忆。改代码前先读要改的文件，不要凭文件名猜实现。
3. **需求含糊就问，一次问清**：新分类、新标签、新专题、是否发布、是否加 front matter 字段。用户描述通常很短，**宁可多问一句，也不要产出方向错误的长文**。
4. **不顺手重构**：只改任务相关文件；发现的无关问题记下来告诉用户，不要顺手改掉。

### 4.2 动手时：小步、聚焦、可回退

- **一次只解决一个主题**；内容改动与代码改动尽量分开，方便回滚与审阅。
- **写文件用 read/edit/write**，不要用 `>` / `echo` 覆盖正文（换行、编码、YAML 引号都可能被破坏）。
- **改数据结构要全链路同步**：改 front matter 字段 → `lib/types.ts` + `lib/posts.ts` 的 `metaOf`/`getRawPost`/`serializePost` + `PostEditor`；改题库字段 → `lib/study.ts` 接口 + `components/study/*` + `lib/search.ts`（若参与检索）+ `scripts/extract-study.cjs`（或明确只在消费层兼容）。
- **新增页面**：读者侧放 `app/(site)/<route>/page.tsx` 并补导航；后台放 `app/admin/`；样式追加到 `app/globals.css`，暗色与 `< 900px` 一并处理。
- **新增 API**：放 `app/api/**/route.ts`；`/api/admin/*` 自动被 `middleware.ts` 保护，其他接口不需要登录。
- **批量改题库资产前先数一遍**：`public/study` 有 8042 张图，移动/重命名前先确认引用关系（见 `skills/study-bank/SKILL.md` 3.7 自检脚本）。
- **大改先给方案**：结构调整、拆系列、删章节，先用几行说清「改哪里、为什么、影响什么」，确认后再动手。

### 4.3 收尾：验证 + 汇报

按改动范围选验证项，不能跳：

| 你改了什么 | 必须做的验证 |
| --- | --- |
| 任何 `.ts` / `.tsx` / 配置 | `npm run typecheck && npm run build` |
| 博客文章 / front matter | 打开 `/`、`/posts/<slug>`、`/blog/archive`；看 TOC；站内链接点一遍 |
| 博客样式 | 亮/暗两套 + 窄屏（390px）各看一眼 |
| 题库 JSON / 截图 | 跑 `skills/study-bank/SKILL.md` 3.7 的自检脚本；打开 `/study`、`/study/<topic>/<qid>`；截图能放大 |
| 后台 / API | `/admin/login` → 新建 → 保存 → 预览 → 发布 → 撤回 → 删除，全流程走一遍 |
| 复习页 / 学习设置 / 复习服务 | 实跑「入口 → 显示答案 → 评分 → 撤销 → 结束本轮 → 结算」；关掉服务看降级提示；`npm run typecheck && npm run build` |
| 搜索 | 任意页面按 `/` 或 `⌘K`，中英文关键词各搜一次 |
| 渲染管线 / 链接预取 / 图片尺寸 | `npm run build && npm run start` 后看：文章页代码块有复制按钮且无跳版、`/study` 进专题首题与侧栏切题无骨架闪烁、题目页证据图加载前后不位移；确认 `/posts/<slug>`、`/study/<topic>/<qid>` 的 RSC 请求体积没有变大 |

**在对话里汇报（不要写进文章/代码注释）**：① 改了什么（路径 + 一句话）；② 怎么验证的（命令 + 页面 + 结果）；③ 没验证/不确定的部分；④ 需要用户决策的事。

**禁止**：不擅自 `git commit` / `git push`（除非用户明确要求）；不擅自把草稿「发布」（移入 `content/posts/` 即上线）；不声称「已验证」而实际没跑命令、没打开页面；不把临时脚本、截图、`.wip-*` 目录留在仓库。

### 4.4 常见任务索引

| 我想…… | 看 |
| --- | --- |
| 写一篇新博客 | `skills/blog-writing` 2.2 新增一篇文章：标准流程 |
| 给已有文章补内容 / 精简 / 调结构 | `skills/blog-writing` 2.3 修改/扩写已有文章 |
| 确认 front matter 怎么写 | `skills/blog-writing` 2.4 Front Matter 规范 |
| 查标签 / 分类该用哪个 | `skills/blog-writing` 2.5 标签与分类规范 |
| 改标题层级、公式、代码块、图片 | `skills/blog-writing` 2.8 格式与排版 |
| 判断文章是不是太长了 | `skills/blog-writing` 2.9 篇幅预算 |
| 发布 / 撤回 / 删除文章、上传图片 | 1.7 内容管理后台 |
| 加一道题 / 改一道题的答案 | `skills/study-bank` 3.5 新增/修改一道题的标准动作 |
| 从一份新 PDF 加一个专题 | `skills/study-bank` 3.8 新增一个专题的标准动作 |
| 搞清楚 `data/study/*.json` 的字段 | `skills/study-bank` 3.4 数据契约 |
| 重新抽取题库 / 同步上游 | `skills/study-bank` 3.3 本仓库的抽取 |
| 重排答案代码块 / 加高亮 / 修非代码结构 | `skills/study-bank` 3.5 答案格式增强、3.7 验收 |
| 改复习页 / 学习设置 / 调度服务 | 1.10、`anki-svc/README.md` |
| 调每日上限、看学习统计 | `/admin/study`（或 `curl POST /config`，见 `anki-svc/README.md`） |
| 新增页面 / 组件 / API、改主题与响应式 | 1.3、1.8、4.2 |
| 排查「页面 500 / 图片 404 / 内容不更新」 | `skills/blog-writing` 2.11、`skills/study-bank` 3.9 常见坑 |

### 4.5 本文件的维护

- 目录、命令、数据契约、协作流程变化时，**同一次改动里同步更新本文件**；博客规则改 `skills/blog-writing/SKILL.md`，题库规则改 `skills/study-bank/SKILL.md`。
- 章节结构保持「项目 / 博客 / 题库 / 协作」四段：第一章写跨领域约定，第二章放常驻的核心写作准则，第三章放索引与红线，细则进对应 SKILL.md。
- 只写**可复用的规范**，不写一次性任务背景、对话过程、会随内容增长的清单。
- 本文件超过 ~64 KB 会被工具截断；新增规则时先压缩旧表述，别无限追加。

## 五、一句话总结

> **项目**：文件即数据库——`content/` 是文章，`data/study/` 是题库，`public/` 是资产；改文件就是改站点。

> **博客**：先问清楚（标题/分类/标签/范围），再找关联（已有文章），按「引子 → 问题 → 分层递进 → 收口」写；正文不写 `#` 一级标题，技术经得起查证，语言写给读者；新文章先进 `content/drafts/`。

> **题库**：题干、答案、代码、截图逐字照录、以图为证；源在上游 PDF 与 `questions.p*.json`，本仓库 JSON 是派生产物；改数据必须过自检、页面验收与独立审计。

> **交付**：`npm run typecheck && npm run build` 跑过，相关页面打开过，改动与未验证项说清楚；不擅自提交、发布、外推。
