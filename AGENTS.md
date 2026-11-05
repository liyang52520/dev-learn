# AGENTS.md — dev-learn 协作说明

> 本文件面向在本仓库工作的 AI 助手与新加入的人类协作者。
>
> `dev-learn` 是「YG's Blog」个人站与「Java 面试宝典」学习站的合并体：左边写博客，右边做题库，全部由仓库里的文件驱动。
>
> **一句话：内容都在文件里，改文件就是改站点；两条内容线的最高标准分别是「让读者弄懂」和「原文可查」。**

## 怎么用这份文件

| 你要做的事 | 直接读 |
| --- | --- |
| 第一次接触项目：结构、命令、后台、代码约定 | 第一章 |
| 写 / 改博客文章 | 第二章 |
| 维护面试题库、从新 PDF 加专题 | 第三章 |
| 接手任务、交付前自检、按场景查规范 | 第四章 |

> **来源**：本文件由两个旧仓库的 `AGENTS.md` 合并改写而来——博客 `/Users/liyang/WebstormProjects/liyang52520.github.io/AGENTS.md`、面试题库 `/Users/liyang/Deepseek/projects/interview/AGENTS.md`。合并时按本仓库的实际代码重写了全部落地细节（Hexo 命令、Python 工具链、上游目录均已改写为当前仓库的做法）。上游文档仍可当历史参考，**以本文件为准**。
>
> **规模快照**（合并当时，会变，以现场文件为准）：3 篇已发布 + 19 篇草稿；42 个专题 / 2521 道题 / 4120 页原文 / 8042 张截图。

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

迁移已完成：上游博客 1 篇已发布 + 21 篇草稿全部迁入（2 篇在本仓库升为已发布）；42 个专题、2521 道题已全部抽取为 JSON。上游的 Hexo 依赖、Butterfly 配置、PDF 原文、Python 工具链**都没有**搬进来，也**不应该**搬进来（见 1.9）。

> 上游绝对路径只在本机成立；其他机器上不存在也不影响本仓库开发，只有「新增 PDF 专题」「重新抽取」「回查上游原文」需要它们。

### 1.2 技术栈

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 框架 | Next.js 15.5（App Router）+ React 19 | 默认 Server Component；动态数据页标 `dynamic = 'force-dynamic'` |
| 语言 | TypeScript 5.9，`strict: true` | 路径别名 `@/*` → 仓库根 |
| 内容解析 | `gray-matter` | 读写 Markdown front matter |
| Markdown 渲染 | `unified` + `remark-gfm` + `remark-math` → `rehype-raw` + `rehype-katex` + `@shikijs/rehype` | 支持 GFM、数学公式、Shiki 高亮、内嵌 HTML |
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
│   ├── admin/                  # 后台：登录、列表、编辑器、整页预览
│   ├── api/                    # admin/*（登录/读写/发布/预览/上传）、search
│   ├── globals.css             # 全站样式（设计变量 + 组件样式，约 2700 行）
│   ├── layout.tsx              # 根布局：主题初始化、全局 metadata、KaTeX 样式
│   └── icon.svg
├── components/                 # 展示组件；admin/ 与 study/ 子目录
├── content/
│   ├── posts/                  # 已发布文章，文件名（去 .md）= slug
│   └── drafts/                 # 草稿，不出现在站点上
├── data/study/                 # index.json + 42 个专题 JSON（答案 HTML + 证据分组，约 24 MB）
├── public/
│   ├── images/                 # avatar 与后台上传产物 images/uploads/YYYY/MM/
│   └── study/                  # 42 个专题的 PDF 截图（约 755 MB，勿手改）
├── lib/                        # 唯一读写文件的层：posts / study / search / markdown / auth / types
├── scripts/extract-study.cjs   # 从上游静态站抽取题库 JSON（见 3.3）
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
| `/admin`、`/admin/login` | 静态壳 | 文章列表（全部/已发布/草稿）、密码登录 |
| `/admin/edit/[type]/[slug]`、`/admin/preview/[type]/[slug]` | 动态 | 编辑器、整页预览（`type` 只能是 `posts`/`drafts`） |
| `/api/search?q=` | 接口 | 文章 + 题目混合结果（最多 16 条） |
| `/api/admin/*` | 接口 | 后台读写，全部受 `middleware.ts` 保护 |

### 1.5 数据流

**博客**：`content/posts/*.md` → `lib/posts.ts`（gray-matter 解析 meta/摘要/阅读时长）→ `lib/markdown.ts`（unified + Shiki + KaTeX）→ `ArticleView` 输出 HTML 与 TOC；同一份数据供 `lib/search.ts` 提供 `/api/search`。

**题库**：见第三章（上游 PDF → 静态站 → 本仓库 JSON）。

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

1. **服务端优先**：默认 Server Component，只有需要状态/事件/浏览器 API 的组件才加 `'use client'`（当前：`Header`、`Toc`、`SearchDialog`、`ArticleTools`、`StudySidebar`、`StudyTopicBrowser`、`EvidencePanel`、`PostEditor`、`AdminDashboard`、`app/admin/login/page.tsx`）。
2. **文件读写只在两处**：`lib/*.ts` 与 `app/api/**/route.ts`；页面与组件只调用 lib 函数。
3. **类型先行**：站点/文章类型在 `lib/types.ts`，题库类型在 `lib/study.ts`；新增字段先改类型，再改读取与 UI。
4. **样式**：全部集中在 `app/globals.css`，用 `:root` / `html.dark` 的 CSS 变量（`--bg`、`--ink`、`--accent`、`--radius` …）。不引入 Tailwind / 组件库；新增区块按注释分区追加，并同时处理 `< 900px`。
5. **时间**：front matter 写 `YYYY-MM-DD HH:mm:ss`；展示统一用 `formatDateParts` 按 `Asia/Shanghai` 格式化。
6. **中文文案**：读者可见文案、错误提示、后台提示全部中文。
7. **动态数据页**：构建后仍可能变化的页面（首页、文章、归档、标签、分类）标 `export const dynamic = 'force-dynamic'`；题库页保持默认。
8. **URL 编码**：slug / tag / category 含中文或空格，构造链接一律 `encodeURIComponent`，读取时 `decodeURIComponent`。

### 1.9 不要做的事

- ❌ 重新引入 Hexo、Butterfly、`_config.yml`、`scaffolds`、`db.json` 或 GitHub Pages 部署链——那是上游历史，本仓库是 Next.js 重写。
- ❌ 手工编辑 `public/study/**` 截图；题库变更改 `data/study`，截图由抽取流程生成。
- ❌ 把 PDF 原文搬进仓库（单篇最大 46 MB，42 篇合计 800 MB+）。
- ❌ 提交 `node_modules/`、`.next/`、`.trash/`、`build/`、`out/`（`.gitignore` 已覆盖）。
- ❌ 手动拼 front matter 写文件；统一走 `serializePost()` / 后台 API。
- ❌ 在客户端组件里 import `node:fs` / `node:path`。
- ❌ 全量复制 `public/study` 或 `data/study`；本仓库已有 ≈ 780 MB 资产，增量要克制。

---

## 二、如何写博客

已发布文章在 `content/posts/`，草稿在 `content/drafts/`，都是 Markdown，文件即唯一数据源。规范的目标只有一个：**每次改动都产出可以直接发布的文章**。写作对象永远是：**未来那个深夜搜索这个问题的读者**。

### 2.1 写作原则

**帮读者弄懂，不是展示你懂。** 读者要全量知识会去读源码。判断标准不是"知识点够不够"，而是"读者读完这段，知道我为什么要读它吗"。**技术密度不是质量指标**，信息量与接收效率的比值才是。可读性六项：逻辑结构、逻辑铺垫、叙事节奏、技术准确、名词落地、篇幅克制。

#### 语言禁区：不要出现"和用户对话"的文字

文章是给未来读者看的，不是给提需求的人看的。❌"根据你的要求…""应你要求补充了 XX""我可以再展开"；任何提及 AI / 你（提需求的人）/ 本次对话 / 需求的句子；括号自我说明"（此处省略…）"。✅"你可能会问…""先别急着往下看…"（"你"指读者）。判据：这句写给读者，还是写给需求方？

### 2.2 新增一篇文章：标准流程

1. **先确认信息**：标题与期望文件名、分类（技术文 `develop`，随笔 `life`，不自创）、标签（复用优先）、范围与深度（科普/源码/排错、篇幅）、读者预设（有 Java/Spring 基础但卡在底层）。宁可多问一句，也别写方向错误的长文；一次问清。
2. **检索已有文章建关联**：看 `content/posts`、`content/drafts` 的标题/标签/开头，判断新文属于哪条脉络。现有系列：请求链路、`@Transactional` 失效、上传/下载、WebFlux、容器/MyBatis、Nacos/Jasypt、下载失败排查。前置知识、延续补完、对比关系要在开头交代并互链，**不为链接而链接**；链到草稿要说明"发布后才生效"。
3. **建文件**：后台 `npm run dev` → `http://localhost:3000/admin`（密码 `ADMIN_PASSWORD`，默认 `yg-admin`）→「新建文章」：自动写 `content/drafts/<slug>.md`，slug 由标题生成、`date` 取当前北京时间、标签/分类为空；左侧表单填标题/日期/标签（英文逗号分隔）/分类/摘要/封面，`⌘S` 保存。或手写 `content/drafts/<slug>.md`（**必须自补 Front Matter**）。**不要直接写进 `content/posts/`**（会立刻上线），发布走后台「发布」或 `git mv`。
4. **写正文**：见「写作结构要求」「格式与排版」。
5. **自检**：过「提交前自检清单」，并实际打开首页、文章页（桌面+窄屏）、目录、所有链接、图片。
6. **汇报**：文件路径、slug（=URL）、标题、分类、标签、关联了哪些文章、怎么预览，并说明**文章仍在 `content/drafts/`、是否发布由用户决定**。**未经许可不发布、不 `git commit` / `git push`**。

站内链接（不是 Hexo 的 `/2026/09/11/标题/`）：`[文字](/posts/<文件名去掉 .md>)`，空格写 `%20`，中文全角标点可保留。**旧 permalink 已全部迁成 `/posts/<slug>`**，改稿时不要再写 `/20xx/…/`；自查残留：`grep -rn "](/20" content/` 应无输出。

### 2.3 修改/扩写已有文章

**修订 ≠ 追加**：每次修订当作重写整篇，改完的结构反映**当前全部内容**，而不是写作历史；读者不该看出哪段是后补的。严禁文末 append"补充/番外"、留"更新于…""之前漏了…"等修订痕迹、只改中间不动首尾、编号不更新。

**先体检**：列结构大纲 → 理叙事主线 → 找耦合点（编号、节末"接下来看…"、"如前所述"）→ 判断新内容是补前置/补细节/并列/边界/改结论。收到"读不懂 / 跳脱 / 丑"时先逐句记"我卡在哪、为什么"，再决定改句子还是换骨架——直接改措辞多半在修症状。

**先定放哪，再写**：前置概念→插到相关小节之前；更深细节→就地扩写；并列话题→新增同级小节；反例/边界→紧贴结论；自成体系→另写一篇并互链；跑题内容（版本考据、第二套技术栈）→外移或压成一两句+链接。默认不是追加到末尾；拿不准先把结构决策讲给用户。

**改完必回归**：开头问题清单、章节编号（不跳号重号）、过渡牵引（新节不能是孤岛）、收尾与首尾呼应、去重与术语统一、跨节口径（数字/版本/绝对化表述）一致、篇幅比例、体积预算、站内链接，最后**全量重走自检**。

**删内容三遍扫**：承诺（问题清单/标题许诺/节末悬念/正文"后面会讲"）→ 元信息（版本基线/术语首解/交叉引用"见 2.5"）→ 编号（章/节/跨篇）。三选一并说清理由：删、压成一段+外链、移走成独立篇。

**交付时在对话里说**（不写进文章）：结构决策、连带改动；大改先给大纲 + 300~500 字试写确认语气。仍不擅自发布/commit/push。

**后台编辑注意**：保存走 `serializePost` **重新序列化整个 Front Matter**——字段顺序、引号风格、注释会丢（正常，别手工修）；未知字段（`published`/`layout`/`permalink`）存进 `extra` 但不生效；删除是移到 `.trash/<type>/`（可找回），保存是临时文件 + rename。

### 2.4 Front Matter 规范

紧贴文件第一行，前后各一行 `---`，之后**空一行**再写正文。正确示例：

```yaml
---
title: "Spring 文件上传全链路深度解析（一）：从报文到临时文件"
date: 2026-10-23 10:50:00
tags:
  - spring
  - tomcat
categories:
  - develop
description: 上传请求里的文件到底先落在哪。
cover: /images/uploads/2026/10/upload-cover.png
---
```

`lib/posts.ts` 只识别 6 个字段：

| 字段 | 必填 | 行为 |
|---|:---:|---|
| `title` | ✅ | 页面 h1 与 `<title>`；**缺失回落 slug** |
| `date` | ✅ | `YYYY-MM-DD HH:mm:ss`，写北京时间；无时区按 `+08:00` 解释，显示用 `Asia/Shanghai` |
| `tags` | 推荐 | YAML 列表；列表页、文章页、搜索都读 |
| `categories` | 推荐 | YAML 列表；技术文 `develop`，随笔 `life` |
| `description` | 可选 | 摘要，截 180 字符；无则取正文纯文本前 150 字 |
| `cover` | 可选 | 封面路径 `/images/…`，只在文章页正文顶部显示 |

- 发布状态由目录决定（`content/posts` / `content/drafts`），**没有 `published` 字段**，写了不生效。
- `date` 只写 `YYYY-MM-DD` 会当当天 00:00:00；**缺失或无法解析 → 1970-01-01，并被排到最后**。
- `tags`/`categories` 写成列表 `  - 值`（两空格 + `- `）；`tags: spring, nacos` 是容错写法，后台保存会改回列表；后台输入框里是英文逗号分隔。
- 值含 **ASCII `: `（冒号+空格）**、**空格 + `#`** 或以 `- ` 开头时必须给整个值加双引号，否则 YAML 报错或截断（`title: 上传 #1 篇` 只剩"上传"）；中文全角 `：`、`？` 不必引号，统一加最稳。不加 `permalink`/`layout`/`published` 等未用字段；不写注释、YAML 锚点、多文档 `---`（后台保存会丢）。
- 🚫 **正文不写 `#` 一级标题**：大标题由 `title` 渲染，否则页面两个标题。

### 2.5 标签与分类规范

现有标签（大小写、空格都算不同标签，以 `/blog/tags` 为准）：`spring`、`tomcat`、`netty`、`mybatis`、`mybatis plus`、`spring webFlux`（历史标签，保留以复用聚合页）、`aop`、`transaction`、`nacos`、`jasypt`、`spring cloud gateway`、`agent`、`mcp`、`生活`。

- 标签用**小写英文**，新标签统一小写（`spring webflux`，别再造成 `Spring WebFlux`）；一篇 **2~4 个**，不堆砌，同一概念不拆两个标签；不确定先问用户，不造孤立标签。
- 分类只有 `develop`（技术）和 `life`（随笔）；技术文默认 `develop`，不自创。

查重（或看 `/blog/tags`）：`grep -rhA8 '^tags:' content/*/*.md | grep -E '^\s+- ' | sed 's/^\s*- //' | sort | uniq -c | sort -rn`

### 2.6 文件命名规范

- **slug = 文件名去掉 `.md`**，直接构成 URL `/posts/<slug>`；改文件名 = 改 URL = 旧链接失效。
- 中文可用，空格用 `-`（`Spring-接入点：跟着容器过一生.md`）；后台新建时把 `\ / : * ? " < > |` 与空白替成 `-`、折叠连续 `-`、去首尾、**截断 80 字符**。
- 文件名禁用 `/`、`\`、`?`、`#`、`*`、`"`、`<`、`>`、`|` 和 **`%`**——`getPost` 会 `decodeURIComponent(slug)`，带 `%` 抛 `URIError` 导致文章页 500；不以 `.`/空格结尾；全角 `？` 合法但链接必须编码，新文件别用。
- 系列用同前缀 + 序号（`SpringBoot请求链路1：…`、`Transactional-为什么会失效（一）：…`），正文同步交代上一篇/下一篇。
- **已发布文件不重命名**（含大小写变化），必须改时同步改所有站内链接；只把 `.md` 放 `content/posts` 或 `content/drafts`，放 `content/` 根目录会静默忽略。

### 2.7 写作结构要求

#### 先立骨架，再填血肉

正文从 `##` 起。推荐路线：**引子**（具体现象切入，别写"本文将从三方面介绍"）→ **问题清单**（引用块列具体问题）→ **主体分层递进**（`## 第一部分` / `### 1.1`，每节收口并预告下一步）→ **转折深入**（反直觉结论/关键调用链/决定性源码）→ **收尾**（回到开头问题，可给延伸阅读）。一段一个论点（3~6 行为宜），先给结论再论证，少用"首先/其次/最后"；结构标题用 `##`/`###` 两层（`####` 不进 TOC），超过三层考虑拆节；不为凑字注水，也不为"简洁"省掉关键推导。

#### 结论前置，标题写成论点

读者带问题来，先给答案他才愿意看论证；把机制排完最后才落"所以其实是…"是最常见的失分方式。标题要写主张而不是归档：❌"二、解析发生在哪一层" → ✅"二、解析归谁做：Tomcat 读 body，Spring 只做包装"；❌"2.2 触发时机：懒解析，而且有两个入口" → ✅"2.2 什么时候开始读：谁先开口要，谁就触发解析"。一章只统摄一个论点，否则换论点或拆章；**改完章标题必须逐个检查组下小节标题**（最常漏）；标题不用读者没见过的类名/方法名；"不落盘""零拷贝"这类绝对化承诺必须在正文证明，否则加限定词。

#### 每一节先回答"为什么要想这个问题"

动机三选一：**上一节结论留下的缺口**（最自然，优先）、读者会撞上的具体现象、将要付出的代价。自检：每节第一段单独拎出来读，能否回答"我为什么要往下读"？行进顺序 **现象 → 问题 → 机制 → 代价**；数字和公式按 **场景 → 代入 → 结论**，标签（"400 MB""DoS 面"）必须晚于场景。

#### 名词必须先落地

**首次出现的类名/方法名/接口名/配置项，必须在同一句或紧邻处交代：属于谁、干什么、为什么在这里。** 三样缺一即**裸名词**，一个就足以卡住读者。钩子（引子悬念、节末"接下来看…"、章间过渡）只能用已引入的概念；中英对照不够用（给 `getParameter()` 标"获取参数"，读者仍不知它是谁的方法）；自造压缩词/指标/攻击面标签首次出现给白话定义；承载数据的对象（`MultipartFile`/`Part`/`InputStream`）还要交代**此刻状态**（数据在哪、是否完整、能否重读，决定能否流式/重试）；代码块**之前的引导句**同样适用。自检：一个没读过这套源码的读者，能从这句话知道它是什么吗？不能就补一句 / 换说法 / 删掉。

#### 源码要交代"在哪"和"为什么要看"

一段源码必须同时给全三件事：**属于谁**（哪个类的哪个方法）、**在哪能看到**（哪个 jar/模块、怎么打开，如 IDEA `Cmd+O` 搜类名）、**为什么值得看**（回答本节哪个问题）。只给类名+方法是裸名词；三样都缺就是"从天上掉下来的代码"。写法：构件名 + 打开方式全篇交代一次；代码块前后各一句（前："这段在决定什么"，后："最该注意哪一行"）。自检：每个代码块问「我为什么在这里贴它」，答不上就删。

#### 叙事节奏、技术准确、可读性

开头 3 行内抓住人（真实现象/报错/反直觉问题），每节有"下一步会怎样"的牵引，硬核源码后插白话总结。类比只搭桥，必须回到真实机制并说明边界；具体优于抽象。**不编造 API/类名/配置项**，存疑标"待核实"；区分"事实"与"理解"，版本相关行为标版本（"Spring Boot 3.2 中…"）；"谁调用谁/谁负责清理/谁兜底"回源码逐字确认并记版本。代码必须是真源码（省略用 `...` 并标注），不写伪代码；给边界条件；并发/线程/事件循环说明"在哪个线程执行"。善用表格对比、引用块放疑问/误区、加粗标结论（一屏不超两三处）。中文排版：中英文间加空格，代码与路径用半角，术语首次给中英对照。

### 2.8 格式与排版

#### 标题层级：正文禁止一级标题

🚫 正文不允许出现 `#` 一级标题——文章页大标题由 Front Matter 的 `title` 渲染（`ArticleView` 的 `<h1>`），否则两个标题。正文从 `##` 起，分部用 `## 第一部分：…` / `### 1.1 …`；**TOC 自动取 `##`/`###`**（`lib/markdown.ts` 只提取 h2/h3），锚点 id 由 github-slugger 生成。不用 HTML/加粗模拟标题；代码块内的 `#`（Shell 注释、`# application.yml`）是注释不是标题。自查（无输出即通过）：

```bash
awk 'BEGIN{inb=0} /^```/{inb=!inb; next} inb==0 && /^# /{print FILENAME":"FNR": "$0}' content/drafts/*.md content/posts/*.md
```

#### 数学公式

remark-math + rehype-katex，直接写 LaTeX：行内 `$E = mc^2$`（`$` 内侧不留空格，`$ E $` 不解析）；块级 `$$ … $$` 前后空行；多行推导用 `\begin{aligned} … \end{aligned}`。写错**不会 500**，KaTeX 渲染成红色报错文本——**预览里必须逐条看公式**。金额或字面 `$` 写 `\$`；不用 `\(...\)` / `\[...\]`（本管线不认），统一 `$`/`$$`。

#### 代码块

必须标语言（`java`、`yaml`、`bash`、`xml`、`properties`、`sql`、`text`、`json`、`ts`、`js`、`html`、`nginx`、`dockerfile`、`diff` 等 Shiki 支持项）；语言拼错**不报错但不高亮**（静默降级），看预览有没有配色；目录树/调用链用 `text`；突出行用注释（`// ← 关键：…`）；省略处写 `# ...`/`// ...`；单块尽量 ≤ 40 行，超长行会横向滚动，尽量手动折行。

#### 表格、引用、HTML

GFM 表格/删除线/任务列表/自动链接可用，表格 ≤ 5 列（宽表横向滚动）；引用块（`>`）放读者疑问/误区/问题清单；行内 HTML 可用（`rehype-raw`，`<details>`、`<br>` 可救急），但不拿来模拟标题或大段样式。**不支持 mermaid**（` ```mermaid ` 只显示成源码，改用 `text` 目录树/表格/截图）、Hexo 标签语法（`{% note %}`）、`<!--more-->`（摘要来自 `description` 或正文前 150 字纯文本）。

#### 链接

站内：`/posts/<文件名去掉 .md>`，空格写 `%20`；**不要写 Hexo permalink `/2026/09/11/xxx/`**；目标还在 `content/drafts` 时线上 404，交付时说明；锚点由 github-slugger 生成，不确定就引用整篇；每个链接交付前点一遍。站外直接写 URL——正文链接不在新标签打开，别写"在新窗口打开"。

#### 图片

图片放 `public/images/`，Markdown 写站点根路径 `/images/…`（写成 `public/images/…` 会 404）；后台上传存 `public/images/uploads/<年>/<月>/` 并返回 `/images/uploads/…`，只收 png/jpeg/webp/gif 且 ≤ 20MB；上传后把 alt 从文件名改成有意义的描述；不用外部图床；封面用 Front Matter 的 `cover`。

### 2.9 篇幅预算

| 档位 | 非空白字符 | md 体积 | 处置 |
|---|---:|---:|---|
| 目标 | ≤ 2 万 | ≤ 33 KB | 默认按此写，手机都稳 |
| 顶格 | 2~3.1 万 | 33~50 KB | 可写，但必须真机过一遍 |
| 必须拆 | > 3.1 万 | > 50 KB | 超出已验证区间，别赌 |

- 字符数指**非空白字符**（汉字/标点/英文/代码/表格），按"汉字数"估会严重低估；2 万字符 ≈ 正文 4,000~5,000 字 + 代码 300~400 行 + 表格 60~80 行。目标档是上限：能砍到 1.4 万就别停在 1.9 万。
- 统计：`python3 -c "import re,sys;print(len(re.sub(r'\s','',open(sys.argv[1],encoding='utf-8').read())))" content/posts/xxx.md`（草稿换路径），或 `ls -lh`；后台状态栏字符数含空白，不能当口径。
- 超预算**拆系列**：导读篇做入口，各篇补引子/小结/上下篇链接，**节号跨篇连续编号**（正文"见第八节"不用改），删章后重排。
- 验收：发布前用自己手机从头滚到底（电脑能看不算）；旧站实测 7.7 万字符 / 122 KB 必崩，3.1 万 / 50 KB 已验证可读。

### 2.10 提交前自检清单

- **文件与 Front Matter**：草稿在 `content/drafts/`（发布才移入 `content/posts/`）且为 `.md`；六个字段齐全、`---` 成对、之后空一行；`date` 为 `YYYY-MM-DD HH:mm:ss` 北京时间；`tags`/`categories` 是列表且大小写一致；含 ASCII `: `、` #`、`- ` 开头的值加了引号；文件名不含 `%`/`/`/`?`/`#`，发布后不改名。
- **标题与内容**：正文无 `#` 一级标题；结构标题用 `##`/`###`，TOC 对得上；开头 3 行切入问题；每节有"为什么读"的铺垫；章/节标题是论点、无陌生名词、一章一论点；小节"结论→论证→细节"；无无关堆砌与裸名词；源码块交代"在哪/为什么看"；代码标语言且预览有高亮；公式渲染正常；图片 `/images/` 可加载、alt 有意义。
- **关联与语言**：已检索现有文章；站内链接全为 `/posts/<slug>`、无 `/20xx/…/`（`grep -rn "](/20" content/`）；链接都点过且目标已发布；全文无"和需求方对话"的元叙述；单篇 ≤ 2 万非空白字符，改动净字符数不增。
- **交付**：`/admin` 的「预览」与「整页预览」各看一遍；手机上滚到底；大改跑**冷读 + 事实核查**（不可合并）；说明路径/slug/标题/分类/标签/关联/预览方式；停在 drafts、未擅自发布/commit/push；动过代码则 `npm run typecheck && npm run build` 通过。

### 2.11 常见坑

| 现象 | 原因 / 处理 |
|---|---|
| 首页或文章页 500（`YAMLException`） | Front Matter 未闭合、标题含 ASCII `: ` 未加引号、缩进错；**一个坏文件会让整站列表崩**，看 dev server 报错定位 |
| 显示 `1970-01-01` 且排最后 | `date` 缺失或无法解析，改成 `YYYY-MM-DD HH:mm:ss` |
| 文章不出现在站点 | 还在 `content/drafts`；或放进了 `content/` 根目录；或 `date` 在未来 |
| 发布后 URL 变了 / 旧链接 404 | 改了文件名（slug = URL）；或发布时 `posts/` 已有同名文件被追加时间戳 |
| 站内链接 404 | 旧 permalink `/20xx/…/`（迁移后应为 0，可用 grep 自查）、目标仍在 drafts、路径不是 `/posts/<slug>`；文件名带 `%` 则是 500（`URIError`） |
| 页面出现两个大标题 | 正文写了 `#`，与 Front Matter 的 `title` 重复；删掉正文 H1 |
| 公式红色报错 / 代码无高亮 | KaTeX 不认识的宏；语言标识拼错（Shiki 静默降级，不报错） |
| 图片裂图 | 写成 `public/images/…` 或 `source/images/…`，应为 `/images/…`；路径大小写敏感；上传只收 png/jpeg/webp/gif 且 ≤ 20MB |
| mermaid 变成一段源码 | 本仓库不支持 mermaid；改用 `text` 图形、表格或截图 |
| 后台保存后 front matter 被重排、注释消失 | `serializePost` 用 js-yaml 重新序列化，正常；未知字段保留但不生效；删除可到 `.trash/<type>/` 找回 |
| 改了 Markdown 没变化 | dev server 没运行或看的是旧标签页；页面 `force-dynamic`，刷新生效 |
| 手机先闪一下随即"网页已崩溃" | 单页超过 3.1 万字符 / 50 KB 已验证区间，手机渲染进程被杀；拆系列 |
| 读者中途看懵 / 每个字都认识却不懂 | 缺"为什么要想"的铺垫，或出现裸名词；见「写作结构要求」 |

### 2.12 一句话总结

> 先问清楚（标题/分类/标签/范围）→ 找关联 → 按"引子 → 问题 → 分层递进 → 收口"写；正文不写 `#`，技术经得起查证，语言对读者负责。改旧文当作重写整篇，不塞补丁；新文章先进 `content/drafts/`，确认后才进 `content/posts/`。可读性优先于知识密度：每节先回答"为什么要想"，章标题写论点。单篇 ≤ 2 万字符（≈ 33 KB），3.1 万（≈ 50 KB）是顶格且须真机验证，再多拆系列。

不要写给需求方看，写给未来那个深夜搜索这个问题的读者看。

---

## 三、面试题解析与题库维护

### 3.1 数据从哪来：两段式管线

```
【上游 · 不在本仓库】42 份 PDF
  extract.py → lines.json → dump.py → flow.json + dump.txt → 人工切题 questions.p*.json
  → resolve.py → questions.json → shots.py → assets/{ev,img}/*.jpg → build_site.py → site/index.html
【本仓库】site/index.html + tools/site.json
  → scripts/extract-study.cjs → data/study/index.json + data/study/<id>.json ×42（只搬数据，不搬图）
  → 手工 rsync site/<slug>/assets/ → public/study/<slug>/assets/
  → lib/study.ts（fs 读取）→ app/(site)/study/** 三栏页面
```

- **源与派生物**：题目的源是上游 `questions.p*.json` + PDF；`data/study/*.json` 是抽取产物，手改会在下次抽取时被整体覆盖。
- 上游是 Python + pymupdf，本仓库只有 Node（内置 `fs`/`path`）。本仓库无法切题、无法重截 PDF 图；上游 `tools/`、`build/`、`site/` 都不在本仓库。

### 3.2 上游管线速查（PDF → 静态站）

> 脚本在 `/Users/liyang/Deepseek/projects/interview/tools`，用 `.venv_pdf/bin/python` 执行（系统 Python 没有 pymupdf）；操作前先读上游 `AGENTS.md`。

| 步骤 | 输入 → 输出 | 关键约束 |
| --- | --- | --- |
| `extract.py` | PDF → `build/topic-XX/lines.json` | 保留纯空格 span；`mono` 按字体白名单；表格保留 `cells` 矩形；过滤 <20×12 图片碎片 |
| `dump.py` | `lines.json` → `flow.json` + `dump.txt` | **换 PDF 先校准** `RIGHT_MARGIN` / `HEADING_MIN`；表格按 `cells` 重建；中文直接拼、英文补空格 |
| 人工切题 | `dump.txt` → `questions.p*.json` | 写 `id/title/aliases/summary/ranges/note`；`ranges` 是 **flow 下标** `[start,end)`，起点必须是题干 heading |
| `resolve.py` | `questions.p*.json` → `questions.json` | 标题+别名 ±12 模糊匹配消漂移；终点=全局下一锚点；尾裁标题/占位句/页脚；必须「**真正漏段: []**」 |
| `shots.py` | → `questions.ev.json`、`images.json`、`assets/{ev,img}/` | 重跑前 `rm -rf assets/ev assets/img`；复制单页后再画红框；跨页区间有固定裁切规则 |
| `build_site.py` | `tools/site.json` + `build/*` → `site/index.html` | DATA 内联；资产不复制、前缀 `<slug>/`；id 重复或缺证据截图直接 `SystemExit` |

`tools/site.json` 每项：`{"id","no","slug","build","title","label","subtitle","pdf","accent"}`；`slug` 必须与 `site/<slug>/` 同名；`site.pages`（4120）有值时优先于各专题页数求和。本仓库只把 `site/index.html`、`tools/site.json` 当只读输入。

### 3.3 本仓库的抽取：scripts/extract-study.cjs

```bash
node scripts/extract-study.cjs   # 每个专题一行 + done: 42 topics
```

| 项 | 值 |
| --- | --- |
| 输入 | 上游 `site/index.html`（内联 `const DATA`）+ `tools/site.json`；路径写死在脚本顶部 `INTERVIEW` 常量 |
| 输出 | `data/study/<topic.id>.json` ×42 + `data/study/index.json` |
| 依赖/副作用 | 仅 Node 内置模块；只写 `data/study/`，**不拷贝任何图片** |

行为：① 大括号配对截出 `const DATA` 再 `JSON.parse`（上游把 `</` 转成 `<\/`，解析会还原；不用 `eval`/整页正则）；② 由 `site.json` 建 `id → slug` 映射，缺失则 `slug = id`；③ 专题字段原样保留、`pdf` 固定 `''`、`count` 重算；④ 路径重写：`answer` 的 `src=`/`href=` 前缀以 `assets/` 结尾时加 `/study/`（`topic-01-jvm/assets/img/p3_0.jpg` → `/study/topic-01-jvm/assets/img/p3_0.jpg`），`evidence[].files[].file` 同加 `/study/`，两种引号都处理、不碰外链（当前答案无外链 `<a href>`）；⑤ `index.json` 的 `meta.title/subtitle` 硬编码、`pages` 取上游 `meta.pages`、`topics/count` 重算，题目只留索引字段但**含 `search`**（故 7.6 MB）；⑥ `JSON.stringify(obj, null, 2)`，中文不转义、键序固定。

幂等：输入不变时逐字节相同，可重跑并用 `git diff` 看上游变化。但脚本**不删除**过期专题文件、**不检查**资产是否存在，必须靠自检兜底。

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const index = JSON.parse(fs.readFileSync('data/study/index.json', 'utf8'));
const slugs = new Set();
let total = 0;
for (const t of index.topics) {
  if (slugs.has(t.slug)) throw new Error(`slug 重复：${t.slug}`);
  slugs.add(t.slug);
  const topic = JSON.parse(fs.readFileSync(`data/study/${t.id}.json`, 'utf8'));
  if (topic.id !== t.id || topic.slug !== t.slug || topic.count !== t.count) throw new Error(`索引与专题不一致：${t.id}`);
  if (topic.questions.length !== t.count) throw new Error(`题数不符：${t.id}`);
  topic.questions.forEach((q, i) => {
    const expected = `q${String(i + 1).padStart(3, '0')}`;
    if (q.id !== expected || q.key !== `${t.id}/${expected}`) throw new Error(`题号不连续：${q.key}`);
    if (!q.search) throw new Error(`search 为空：${q.key}`);
    if (!q.evidence.length) throw new Error(`evidence 为空：${q.key}`);
    for (const g of q.evidence) for (const f of g.files) {
      if (!f.file.startsWith('/study/')) throw new Error(`证据路径未重写：${f.file}`);
      if (!fs.existsSync(path.join('public', f.file))) throw new Error(`截图缺失：${f.file}`);
    }
    for (const m of q.answer.matchAll(/src=["']([^"']+)["']/g)) {
      if (!m[1].startsWith('/study/')) throw new Error(`配图路径异常：${m[1]}`);
      if (!fs.existsSync(path.join('public', m[1]))) throw new Error(`配图缺失：${m[1]}`);
    }
    total += 1;
  });
}
if (total !== index.meta.count) throw new Error(`meta.count 不符：${total} != ${index.meta.count}`);
console.log(`OK：${index.topics.length} 专题 / ${total} 题 / ${index.meta.pages} 页`);
NODE
```

预期 `OK：42 专题 / 2521 题 / 4120 页`；任何报错都不提交。

### 3.4 数据契约

`index.json` = `{meta, topics[]}`（题目只含索引字段，含 `search`），`getStudyIndex()` 读取并模块级缓存；`data/study/<topic.id>.json` = 单专题完整数据（含 `answer`/`evidence`），`getStudyTopic(id)` 每次读盘。目录相对 `process.cwd()`。

```json
{"meta":{"pages":4120,"topics":42,"count":2521},
 "topics":[{"id":"jvm","no":"01","slug":"topic-01-jvm","title":"JVM 面试题","label":"JVM",
   "subtitle":"Topic-01 · 102 页原文","accent":"#1e4fd8","pages":102,"count":95,
   "questions":[{"key":"jvm/q001","no":1,"id":"q001","title":"…","aliases":["…"],
     "summary":["…"],"note":"","pages":"p3–5","firstPage":3,"search":"…"}]}]}
```

专题 JSON 多 `pdf:""`，题目多 `answer`、`evidence`。

| 专题字段 | 说明 |
| --- | --- |
| `id` | 文件名 + URL 段：`jvm` → `/study/jvm/q001` |
| `no` | 两位序号字符串 `"01"`…`"42"` |
| `slug` | 资产目录名，= `public/study/<slug>/`（`topic-01-jvm`） |
| `title` / `label` / `subtitle` / `accent` | 展示名 / 短标签 / 副标题 / 主题色 |
| `pages` | 该专题原文页数 |
| `count` | = `questions.length` |
| `pdf` | **恒为 `''`**，无消费方，不要填本机路径 |
| `questions` | 见下 |

| 题目字段 | 说明 |
| --- | --- |
| `key` | `<id>/<qid>`（`jvm/q001`），跨专题唯一键 |
| `no` | 题号（1 起） |
| `id` | `q001` 起，**连续**且与数组顺序一致（证据文件名含它） |
| `title` | 题干原文逐字 |
| `aliases` | 同义题面，可为空（当前 557 题无别名） |
| `summary` | 要点提炼，通常 3–4 条 |
| `note` | 空串或备注（页面显示「原文备注：…」） |
| `pages` | 人类可读页码 `p3–5`（en dash） |
| `firstPage` | 首个出处起始页 |
| `search` | `title + aliases + summary + note + answer 纯文本` |
| `answer` | 原文答案 HTML 片段，见下 |
| `evidence` | 证据分组，见下 |

#### answer 的 HTML 契约

class 依赖 `app/globals.css`，用 `dangerouslySetInnerHTML` 渲染，不得注入 `<script>`/`onclick`：

- `<p>` 段落；`<ul class='pdf-list'><li>…`；`<pre class='code'><code><span class='cl'>…<span class='tk-*'>`；`<table class='pdf-table'>`（首行表头）
- `<figure class='pdf-img zoomable' data-cap='原文配图 · 第 3 页 / 共 102 页'><img loading='lazy' src='/study/topic-01-jvm/assets/img/p3_0.jpg'><figcaption>…</figcaption></figure>`
- 图片必须 `/study/…` 站内绝对路径（页面在 `/study/[topic]/[qid]` 两层下）。

#### evidence 结构

```json
[{"label":"原文出处","from":3,"to":5,
  "files":[{"page":3,"file":"/study/topic-01-jvm/assets/ev/q001_0_3.jpg"}]}]
```

- 单出处 `label` 为 `原文出处`，多出处为 `出处 1`…`出处 N`（最大 32，见 `bigtech/q001`；`jvm/q005` 3 组、`os/q074` 7 组）。
- 文件命名 `q<题号>_<rangeIndex>_<page>.jpg`（rangeIndex 0 起）；共 5762 张、0 缺失；每题至少一组。

#### slug、id 与 URL

| URL | 行为 |
| --- | --- |
| `/study` | 42 张卡片 + 统计 + 前端筛选（构建期预渲染） |
| `/study/jvm` | 307 → `/study/jvm/q001` |
| `/study/jvm/q001` | 三栏单题页（按需 SSR） |
| `/study/topic-01-jvm` | 404：路由把 URL 段直接当 `topic.id`，会去找 `data/study/topic-01-jvm.json`（不存在）；slug 只用于资产路径 |
| `/study/jvm/q999` | 404 |

#### 改字段前必读

- 索引与专题是两套映射：同时改 `extract-study.cjs`、`lib/study.ts`（`StudyQuestionIndex`/`StudyQuestion`/`StudyTopic`）与消费方（`components/study/*`、`lib/search.ts`、`StudyTopicCard`）。
- `answer`/`evidence` 只在专题 JSON；塞进 index 会放大列表页开销。
- 字段名是上游契约，改名会被下次抽取覆盖。

### 3.5 新增/修改一道题的标准动作

**推荐：改上游再重抽。** ① `build/topic-XX/dump.txt` 定位题；② 改 `questions.p*.json`（`id` 用下一个 qNNN、`title` 逐字抄、`aliases` 列全、`summary` 3–4 条、`ranges` 用 flow 下标）；③ 依次重跑 `resolve.py`（真正漏段为 `[]`）→ `shots.py`（先删旧 assets）→ `build_site.py`，过上游验收；④ 本仓库 `node scripts/extract-study.cjs` + 自检，并同步截图到 `public/study/<slug>/assets/`。

**应急：只在本仓库小修**（补 note/summary/截图；整题增删仍走上游，否则下次抽取全丢）：

1. 改专题 JSON 对应字段；2. 同步改 `index.json` 的索引字段（其中无 `answer`/`evidence`）；3. 新题**只能追加末尾**，`id` 取 `q(count+1)`、`no` 同步，否则 qid 连续性、`key`、截图文件名全错位；4. 新截图放 `public/study/<slug>/assets/ev/`，命名 `qNNN_<rangeIndex>_<page>.jpg`，`file` 写 `/study/…`；5. 重算 `search`；重启 dev（缓存）、硬刷新、跑自检。

写法细则：**题干**逐字还原（标点/重复问法都保留，与截图一致）；**aliases** 是原文其它问法，不与 title 重复；**summary** 是 3–4 条要点提炼，不是答案替代；**pages** 用 `p<from>–<to>`，`firstPage = evidence[0].from`；**answer** 整段搬上游 HTML，不重排/不改写；**search** 非空，规则=`title + aliases + summary + note + answer 纯文本`（`lib/search.ts` 仅在 summary 为空时拿它兜底，仍须与正文同步）；**note** 只解释「原文为何如此」（空壳外链、错字/重复），不补知识。

### 3.6 内容取舍约定

1. **逐字还原**：题干、答案、代码、表格、插图照录；不改写、不摘要替代、不重排缩进。
2. **不得臆造**：原文没有的不补；补充知识只能进 `summary`/`note` 并标明。
3. **截图为证**：每题有对应页截图（红框圈题干），不裁剪、不 P 图；广告/页脚留在截图里正常。
4. **多出处全保留**：如 `jvm/q005` 3 个出处、`os/q074` 7 个、`bigtech/q001` 32 个出处/22 个别名，答案与证据全给，不写「另见 pXX」。
5. **原文自身问题照录**：错字、重复段落、只给外链的空壳答案保留，用 `note` 标注。
6. **答案分层**：`summary`→`answer`→`evidence`→`note`，不跨层搬运。
7. **消费层不二次清洗**：广告/页脚已在上游剔除，不「补回来」，也不按长度/关键词删正文（「加载」「栈」「}」都是合法内容）。
8. **不为好看删内容**：不删段落、不合并多题、不为通顺改标题。

### 3.7 验收清单

#### 自动校验

- 重抽后跑上面的自检脚本，输出 `OK：42 专题 / 2521 题 / 4120 页`。
- 检查项：JSON 可解析；`index.json` 与专题 JSON 的 `id/slug/count` 一致；`slug` 唯一；`qid` 连续且 `key = id/qid`；`count = questions.length`；`search` 非空；每题 `evidence` 非空；`evidence[].files[].file` 与 `answer` 内 `<img src>` 都以 `/study/` 开头且文件存在（现有 5762 证据 + 2280 配图，`public/study` 共 8042 张、约 755 MB）；`meta.count` 等于各专题题数之和。
- `npm run typecheck && npm run build`（先 `npm ci`）；`git status --short data/study public/study` 确认只有预期变化。

#### 页面手工与视觉验收

- `/study`：42 张卡片、`42 专题 / 2,521 题目 / 4,120 页原文`、筛选可用；`/study/jvm` 307 到 `/study/jvm/q001`；`/study/topic-01-jvm` 与 `/study/jvm/q999` 应 404。
- `/study/jvm/q001`：三栏、别名、要点卡、原文备注、答案、上下题；右栏截图组数/页码与 evidence 一致、可放大、`Esc` 关闭；侧栏 `/` 搜索、`↑↓` 切题、专题下拉切换；全局搜索（`/api/search?q=`）能命中答案正文。
- 视觉：`npm run dev` 后逐张读图，确认三栏不塌、红框在题干、插图落在正确段落之间、答案结尾无下一题标题、代码缩进正常；截图命令：
  ```bash
  mkdir -p /tmp/study-shots
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
    --disable-gpu --hide-scrollbars --window-size=1680,1100 --virtual-time-budget=8000 \
    --screenshot=/tmp/study-shots/jvm-q005.png http://localhost:3000/study/jvm/q005
  ```
- **独立审计**：每批改动派两个只读 agent——① 抽 6–10 题把 `answer` 与 `evidence` 截图/上游 `dump.txt` 对照，报缺段/串题/改写；② 统计上游题目级 heading（通常 14.6pt）与含「？」行，确认无漏题。结论写进交付说明。

### 3.8 新增一个专题（PDF → 本仓库）的标准动作

| # | 在哪 | 动作 |
| --- | --- | --- |
| 1 | 上游 | 放 `Topic-43-XXX.pdf`；`extract.py "Topic-43-XXX.pdf" build/topic-43` |
| 2 | 上游 | `dump.py build/topic-43`，校准 `RIGHT_MARGIN`/`HEADING_MIN` |
| 3 | 上游 | 通读 `dump.txt`，写 `build/topic-43/questions.p1.json` |
| 4 | 上游 | `resolve.py build/topic-43`，必须「真正漏段: []」 |
| 5 | 上游 | 删旧 `site/topic-43-xxx/assets/{ev,img}`；`shots.py build/topic-43 "Topic-43-XXX.pdf" site/topic-43-xxx` |
| 6 | 上游 | `tools/site.json` 增 `id/no/slug/build/title/label/subtitle/pdf/accent`，`site.pages` 手填则加页数；`build_site.py`；跑上游三套验收 |
| 7 | 本仓库 | `mkdir -p public/study/topic-43-xxx && rsync -a --delete .../site/topic-43-xxx/assets/ public/study/topic-43-xxx/assets/`（只同步 assets） |
| 8 | 本仓库 | 改硬编码 3 处：`scripts/extract-study.cjs` 的 `meta.subtitle`（「42 个专题」）、`app/(site)/study/page.tsx` 的 metadata description（42/2521）、`app/admin/login/page.tsx` 文案（42/2521）；再 `node scripts/extract-study.cjs`（应 `done: 43 topics`） |
| 9 | 本仓库 | 跑自检 + `npm run typecheck && npm run build` + 重启 dev 看列表/首末题 + 抽查截图 + 两个只读 agent 审计 + `git status` |

`meta.pages` 来自上游 `site.pages`，`meta.topics/count` 由脚本重算。

### 3.9 踩过的坑

| 现象 | 根因 | 做法 |
| --- | --- | --- |
| 抽取成功但图片全 404 | 脚本只写 JSON | 必须同步 `site/<slug>/assets/` 到 `public/study/<slug>/assets/` |
| 新增专题仍显示「42 个专题」 | 3 处硬编码 | 改脚本 subtitle + study 页 description + admin 登录页文案 |
| `/study/topic-01-jvm` 404 | 路由按 `topic.id` 读文件 | 链接用 id，slug 只用于资产 |
| 插题后题号/截图错位 | qid 连续且写进文件名 | 只追加末尾；插中间就走上游重跑 shots |
| 改 answer 后 search 与正文不一致 | search 是预计算字段 | 按规则重算（或重抽）；全局搜索正文本身读 answer |
| 改 JSON 后页面不更新 | `getStudyIndex()` 缓存 + `/study` 预渲染 | 重启 dev / 重新 build / 硬刷新 |
| 题目页图片裂 | 用了相对路径 | `answer` 图片必须 `/study/<slug>/assets/…` |
| 全量格式化 JSON 产生巨大 diff | `data/study` 约 24 MB、index 7.6 MB | 只改目标字段，保持 2 空格缩进与键序 |
| 删「未引用」图想减体积 | `topic-01-jvm/assets/img/p102_0.jpg` 无 answer 引用属正常 | 先核对引用，不按「未引用即删」清理 |

### 3.10 硬性禁止

- 不在本仓库运行/移植上游 Python 工具链（`tools/`、`build/`、`.venv_pdf` 都不在）。
- 不手改 `public/study/**` 的截图内容或文件名（被 JSON 的 `file` 引用）。
- 不把 `data/study/*.json` 当题库的「源」：源在上游 `questions.p*.json` + PDF。
- 不改写原文答案、不摘要替代、不删段落、不合并多题、不为排版美化代码/表格。
- 不伪造证据：无对应页截图不出现该题，不 P 图、不裁掉红框题干。
- 不跳过自检与页面/视觉验收；批量改题必须走两个只读 agent 审计。
- 不把不可信 HTML 写进 `answer`（页面用 `dangerouslySetInnerHTML` 渲染）。
- 不提交 `.next/`、临时截图、`/tmp` 产物；`public/study` 约 755 MB，不复制第二份。

---

## 四、协作流程与交付标准

前三章是「仓库是什么、两条内容线怎么生产」；这一章是「接手任务后怎么开工、怎么收尾」。

### 4.1 开工前：先定位，再追问

1. **判断任务属于哪条线**，先读对应章节：

   | 任务特征 | 归属 | 先读 |
   | --- | --- | --- |
   | 写/改文章、标题标签、正文 | 博客内容 | 第二章 |
   | 改题目、答案、截图、专题 | 题库数据 | 第三章 |
   | 改页面、组件、API、样式、后台 | 站点代码 | 第一章（1.3–1.8） |
   | 换框架、加依赖、改构建 | 基础设施 | 第一章，且先与用户确认 |

2. **看清现场**：`git status` 看工作区状态；文章数量用 `ls content/posts content/drafts`，题库数量读 `data/study/index.json`，不要凭记忆。改代码前先读要改的文件，不要凭文件名猜实现。
3. **需求含糊就问，一次问清**：新分类、新标签、新专题、是否发布、是否加 front matter 字段。用户描述通常很短，**宁可多问一句，也不要产出方向错误的长文**。
4. **不顺手重构**：只改任务相关文件；发现的无关问题记下来告诉用户，不要顺手改掉。

### 4.2 动手时：小步、聚焦、可回退

- **一次只解决一个主题**；内容改动与代码改动尽量分开，方便回滚与审阅。
- **写文件用 read/edit/write**，不要用 `>` / `echo` 覆盖正文（换行、编码、YAML 引号都可能被破坏）。
- **改数据结构要全链路同步**：改 front matter 字段 → `lib/types.ts` + `lib/posts.ts` 的 `metaOf`/`getRawPost`/`serializePost` + `PostEditor`；改题库字段 → `lib/study.ts` 接口 + `components/study/*` + `lib/search.ts`（若参与检索）+ `scripts/extract-study.cjs`（或明确只在消费层兼容）。
- **新增页面**：读者侧放 `app/(site)/<route>/page.tsx` 并在 `Header.tsx` / `Footer.tsx` 补导航；后台放 `app/admin/`；样式追加到 `app/globals.css` 对应分区，暗色与 `< 900px` 一并处理。
- **新增 API**：放 `app/api/**/route.ts`；`/api/admin/*` 自动被 `middleware.ts` 保护，其他接口不需要登录。
- **批量改题库资产前先数一遍**：`public/study` 有 8042 张图，移动/重命名前先确认引用关系（见 3.7 自检脚本）。
- **大改先给方案**：结构调整、拆系列、删章节，先用几行说清「改哪里、为什么、影响什么」，确认后再动手。

### 4.3 收尾：验证 + 汇报

按改动范围选验证项，不能跳：

| 你改了什么 | 必须做的验证 |
| --- | --- |
| 任何 `.ts` / `.tsx` / 配置 | `npm run typecheck && npm run build` |
| 博客文章 / front matter | 打开 `/`、`/posts/<slug>`、`/blog/archive`；看 TOC；站内链接点一遍 |
| 博客样式 | 亮/暗两套 + 窄屏（390px）各看一眼 |
| 题库 JSON / 截图 | 跑 3.7 的自检脚本；打开 `/study`、`/study/<topic>/<qid>`；截图能放大 |
| 后台 / API | `/admin/login` → 新建 → 保存 → 预览 → 发布 → 撤回 → 删除，全流程走一遍 |
| 搜索 | 任意页面按 `/` 或 `⌘K`，中英文关键词各搜一次 |

**在对话里汇报（不要写进文章/代码注释）**：① 改了什么（文件路径 + 一句话）；② 怎么验证的（命令 + 页面 + 结果）；③ 没验证 / 不确定的部分（如「没在真机上看过」「上游仓库不在这台机器」）；④ 需要用户决策的事（是否发布仍为草稿的文章、是否新增标签/专题）。

**禁止**：不擅自 `git commit` / `git push`（除非用户明确要求）；不擅自把草稿「发布」（移入 `content/posts/` 即上线）；不声称「已验证」而实际没跑命令、没打开页面；不把临时脚本、截图、`.wip-*` 目录留在仓库。

### 4.4 常见任务索引

| 我想…… | 看 |
| --- | --- |
| 写一篇新博客 | 2.2 新增一篇文章：标准流程 |
| 给已有文章补内容 / 精简 / 调结构 | 2.3 修改/扩写已有文章 |
| 确认 front matter 怎么写 | 2.4 Front Matter 规范 |
| 查标签 / 分类该用哪个 | 2.5 标签与分类规范 |
| 改标题层级、公式、代码块、图片 | 2.8 格式与排版 |
| 判断文章是不是太长了 | 2.9 篇幅预算 |
| 发布 / 撤回 / 删除文章、上传图片 | 1.7 内容管理后台 |
| 加一道题 / 改一道题的答案 | 3.5 新增/修改一道题的标准动作 |
| 从一份新 PDF 加一个专题 | 3.8 新增一个专题的标准动作 |
| 搞清楚 `data/study/*.json` 的字段 | 3.4 数据契约 |
| 重新抽取题库 / 同步上游 | 3.3 本仓库的抽取 |
| 新增页面、组件、API | 1.3、1.8、4.2 |
| 改主题色、暗色模式、响应式 | 1.8 代码约定（样式） |
| 排查「页面 500 / 图片 404 / 内容不更新」 | 2.11、3.9 常见坑 |

### 4.5 本文件的维护

- 目录、命令、数据契约、写作标准发生变化时，**同一次改动里同步更新本文件**。
- 章节结构保持「一、项目 / 二、博客 / 三、题库 / 四、协作」四段；新规则先落到对应章节，跨领域的才提到第一章。
- 只写**可复用的规范**：不写一次性任务背景、对话过程、会随内容增长的清单（数量以现场文件为准）。
- 两处上游 `AGENTS.md` 是历史参考，**以本文件为准**；冲突时按本文件，并顺手修正或忽略上游。

## 五、一句话总结

> **项目**：文件即数据库——`content/` 是文章，`data/study/` 是题库，`public/` 是资产；改文件就是改站点。

> **博客**：先问清楚（标题/分类/标签/范围），再找关联（已有文章），按「引子 → 问题 → 分层递进 → 收口」写；正文不写 `#` 一级标题，技术经得起查证，语言写给读者；新文章先进 `content/drafts/`。

> **题库**：题干、答案、代码、截图逐字照录、以图为证；源在上游 PDF 与 `questions.p*.json`，本仓库 JSON 是派生产物；改数据必须过自检、页面验收与独立审计。

> **交付**：`npm run typecheck && npm run build` 跑过，相关页面打开过，改动与未验证项说清楚；不擅自提交、发布、外推。
