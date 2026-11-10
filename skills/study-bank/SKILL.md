---
name: study-bank
description: 维护 dev-learn 题库（backend/data/study 下的 JSON 与截图）时使用。覆盖上游抽取管线、数据契约、加题/加专题流程、答案格式增强、逐字保真约定、验收清单与硬性禁止。
---

# 题库维护（dev-learn）

> 本文件是题库与抽取规则的**唯一来源**；`AGENTS.md` 第三章只做索引。章节号保持 3.x，与旧引用一一对应。
> 核心口径：**源在上游 PDF 与 `questions.p*.json`，本仓库 `backend/data/study/*.json` 是派生产物；题干、答案、代码、截图逐字照录、以图为证。**

## 3.1 数据从哪来：两段式管线

```
【上游 · 不在本仓库】PDF → extract.py → dump.py → 人工切题 → resolve.py → shots.py → build_site.py → site/index.html
【本仓库】site/index.html + tools/site.json
  → skills/study-bank/scripts/extract-study.cjs → backend/data/study/*.json（只搬数据，不搬图）
  → 手工 rsync site/<slug>/assets/ → backend/data/study/<slug>/assets/
  → skills/study-bank/scripts/enhance-answers/*（答案格式增强，见 3.5）
  → skills/study-bank/scripts/answer-to-markdown.py（答案 HTML → Markdown，见 3.5）
  → backend/app/features/study/*（读盘、导航、证据）
  → backend/app/rendering/answers.py（答案 Markdown 渲染）+ images.py（注入宽高）
  → frontend/src/features/study/** 三栏页
```

- **源与派生物**：题目的源是上游 `questions.p*.json` + PDF；`backend/data/study/*.json` 是抽取产物，手改会在下次抽取时被整体覆盖。
- 上游是 Python + pymupdf；本仓库的抽取脚本 `skills/study-bank/scripts/extract-study.cjs` 仍是 Node（内置 `fs`/`path`）。本仓库无法切题、无法重截 PDF 图；上游 `tools/`、`build/`、`site/` 都不在本仓库。

## 3.2 上游管线速查（PDF → 静态站）

> 脚本在 `/Users/liyang/Deepseek/projects/interview/tools`，用 `.venv_pdf/bin/python` 执行；操作前先读上游 `AGENTS.md`。

| 步骤 | 输入 → 输出 | 关键约束 |
| --- | --- | --- |
| `extract.py` | PDF → `build/topic-XX/lines.json` | 保留纯空格 span；`mono` 按字体白名单；表格保留 `cells` 矩形；过滤 <20×12 图片碎片 |
| `dump.py` | `lines.json` → `flow.json` + `dump.txt` | **换 PDF 先校准** `RIGHT_MARGIN` / `HEADING_MIN`；表格按 `cells` 重建；中文直接拼、英文补空格 |
| 人工切题 | `dump.txt` → `questions.p*.json` | 写 `id/title/aliases/summary/ranges/note`；`ranges` 是 **flow 下标** `[start,end)`，起点必须是题干 heading |
| `resolve.py` | `questions.p*.json` → `questions.json` | 标题+别名 ±12 模糊匹配消漂移；终点=全局下一锚点；尾裁标题/占位句/页脚；必须「**真正漏段: []**」 |
| `shots.py` | → `questions.ev.json`、`images.json`、`assets/{ev,img}/` | 重跑前 `rm -rf assets/ev assets/img`；复制单页后再画红框；跨页区间有固定裁切规则 |
| `build_site.py` | `tools/site.json` + `build/*` → `site/index.html` | DATA 内联；资产不复制、前缀 `<slug>/`；id 重复或缺证据截图直接 `SystemExit` |

`tools/site.json` 每项：`{"id","no","slug","build","title","label","subtitle","pdf","accent"}`；`slug` 必须与 `site/<slug>/` 同名；`site.pages`（4120）有值时优先于各专题页数求和。本仓库只把 `site/index.html`、`tools/site.json` 当只读输入。

## 3.3 本仓库的抽取：skills/study-bank/scripts/extract-study.cjs

```bash
node skills/study-bank/scripts/extract-study.cjs   # 每个专题一行 + done: 42 topics
```

| 项 | 值 |
| --- | --- |
| 输入 | 上游 `site/index.html`（内联 `const DATA`）+ `tools/site.json`；路径写死在脚本顶部 `INTERVIEW` 常量 |
| 输出 | `backend/data/study/<topic.id>.json` ×42 + `backend/data/study/index.json` |
| 依赖/副作用 | 仅 Node 内置模块；只写 `backend/data/study/`，**不拷贝任何图片** |

行为：① 大括号配对截出 `const DATA` 再 `JSON.parse`（解析会还原上游的 `<\/`，不用 `eval`）；② 由 `site.json` 建 `id → slug` 映射；③ 专题字段原样保留、`pdf` 固定 `''`、`count` 重算；④ 路径重写：`answer` 的 `src=`/`href=` 与 `evidence[].files[].file` 若以 `assets/` 开头则加 `/study/` 前缀，不碰外链；⑤ `index.json` 的 `meta.title/subtitle` 硬编码、`pages` 取上游 `meta.pages`、`topics/count` 重算，题目只留索引字段但**含 `search`**（故 7.6 MB）；⑥ `JSON.stringify(obj, null, 2)`，中文不转义、键序固定。

幂等：输入不变时逐字节相同；但脚本**不删除**过期专题文件、**不检查**资产是否存在，靠自检兜底。

> ⚠️ 抽取只搬上游原样 HTML；代码块与行号问题在 3.5 的增强流水线里处理，**重抽必须重跑**。

## 3.4 数据契约

`index.json` = `{meta, topics[]}`（题目只含索引字段，含 `search`），`getStudyIndex()` 读取并模块级缓存；`backend/data/study/<topic.id>.json` = 单专题完整数据（含 `answer`/`evidence`），`getStudyTopic(id)` 读盘并按 mtime + size 缓存最近 6 篇。目录相对 `process.cwd()`。

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
| `slug` | 资产目录名，= `backend/data/study/<slug>/`（`topic-01-jvm`） |
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
| `answer` | 原文答案 Markdown，见下 |
| `evidence` | 证据分组，见下 |

### answer 的 Markdown 契约

答案在 JSON 里存 Markdown，由 `backend/app/rendering/answers.py` 的 `render_answer()` 渲染成 HTML，再交给 `HtmlContent` 的 `dangerouslySetInnerHTML`；不得注入 `<script>`/`onclick`：

| 想表达 | 写法 | 渲染结果 |
| --- | --- | --- |
| 段落 | 空行分隔的普通文字 | `<p>` |
| 标题 | `### 小标题`（h2–h5 对应 2–5 个 `#`） | `<h3>` 等 |
| 列表 | `- 条目`（每行一条） | `<ul><li>` |
| 代码 | ` ```java ` 围栏；语言取 `highlight.py` 的 `COMMON_LANGS`，判断不了用 `text` | 与文章页一致的 `.code-block` |
| 表格 | GFM 管道表，首行为表头 | `.table-wrap > table` |
| 插图 | `![原文配图](/study/…/p3_0.jpg "原文配图 · p3")` | `<figure class="pdf-img"><img><figcaption>`（图注取 title） |
| 原样字符 | `\*`、`\_`、`\$`、`\<`、`\|` 等反斜杠转义 | 字面字符 |

- 图片必须 `/study/…` 站内绝对路径（页面在 `/study/:topic/:qid` 两层下）；`width/height` 由 `rendering/images.py` 在内存补，不写进 JSON。
- 段落/列表里以 `#`、`-`、`>`、`1.` 开头的文字要转义（转换脚本已处理），否则会被当成标题或列表。
- 答案渲染关闭了公式与任务列表插件：`$PATH` 这类变量按普通文字输出，`- [ ]` 不会变成勾选框。
- **不要**在 JSON 里塞 `<span class='tk-*'>` 之类的 Pygments token；遗留的 `<pre class='code'>` 仍能被 `highlight_answer()` 兜底高亮。
- PDF 编辑器自带的**行号不是正文**，增强时已剔除；`answer` 的文字仍然逐字可核对（见 3.6、3.7）。

### evidence 结构

```json
[{"label":"原文出处","from":3,"to":5,
  "files":[{"page":3,"file":"/study/topic-01-jvm/assets/ev/q001_0_3.jpg"}]}]
```

- 单出处 `label` 为 `原文出处`，多出处为 `出处 1`…`出处 N`（最大 32，见 `bigtech/q001`；`jvm/q005` 3 组、`os/q074` 7 组）。
- 文件命名 `q<题号>_<rangeIndex>_<page>.jpg`（rangeIndex 0 起）；共 5762 张、0 缺失；每题至少一组。
- **`files[].width` / `files[].height` 不在 JSON 里**：`backend/app/features/study/service.py` 在内存中按文件头补（`rendering/images.py` 同时给 `answer` 里 `/study/` 图片注入 `width/height`），只用于 `<img>` 预留版面。别把它们写进 `backend/data/study/*.json`（抽取会覆盖），也别手动维护。

### slug、id 与 URL

| URL | 行为 |
| --- | --- |
| `/study` | 专题卡片 + 统计 + 前端筛选（由 `/api/study` 驱动） |
| `/study/jvm` | 前端重定向到 `/study/jvm/q001` |
| `/study/jvm/q001` | 三栏单题页 |
| `/study/topic-01-jvm` | 404：接口把 URL 段直接当 `topic.id`，会去找 `backend/data/study/topic-01-jvm.json`（不存在）；slug 只用于资产路径 |
| `/study/jvm/q999` | 404 |

### 改字段前必读

- 索引与专题是两套映射：同时改 `extract-study.cjs`、`backend/app/features/study/schemas.py` 与消费方（`frontend/src/features/study/*`、`backend/app/features/search/service.py`）。
- `answer`/`evidence` 只在专题 JSON；塞进 index 会放大列表页开销。
- 字段名是上游契约，改名会被下次抽取覆盖。

## 3.5 新增/修改一道题的标准动作

**推荐：改上游再重抽。** ① `build/topic-XX/dump.txt` 定位题；② 改 `questions.p*.json`（`id` 用下一个 qNNN、`title` 逐字抄、`aliases` 列全、`summary` 3–4 条、`ranges` 用 flow 下标）；③ 依次重跑 `resolve.py`（真正漏段为 `[]`）→ `shots.py`（先删旧 assets）→ `build_site.py`，过上游验收；④ 本仓库 `node skills/study-bank/scripts/extract-study.cjs` + 自检，并同步截图到 `backend/data/study/<slug>/assets/`。

### 答案格式增强（抽取之后、写回之前）

上游 `answer` 的代码常被 PDF 版心拆段、混入编辑器行号、正文与代码互相误分类。`skills/study-bank/scripts/enhance-answers/` 只改结构与空白，不改文字：

| 脚本 | 作用 |
| --- | --- |
| `reconstruct.cjs` | 读上游 `lines.json` 还原代码行/缩进、合并被误分类的代码片段、剔除 PDF 行号，代码块统一成 `<pre class='code' data-lang>`；产物写 `.wip-answers/` |
| 模型审阅 + `validate-op.cjs` | 按 `RULES.md` 给代码块标语言、修残断行/分块；逐题校验「只改空白、不改字」；ops 是临时产物 |
| `apply.cjs` | 应用 ops 写回 `backend/data/study`，重算 `search` 并同步索引（`--dry-run` 可预览） |
| `fix-noncode.cjs` | 非代码题结构修复：游离 `li`→`p`、强证据段落/跨元素续写合并；逐题 `visibleText` 校验（删字类只登记） |
| `sync-search.cjs` | 重算全部 `search` 并同步索引（结构修复后跑） |
| `verify.cjs` | 结构 / 代码块契约 / 文字保真 / search / 证据截图自检，失败退出码非 0 |

```bash
node skills/study-bank/scripts/enhance-answers/reconstruct.cjs     # 需要上游 build/topic-XX/lines.json
# …按 RULES.md 让模型产出 .wip-answers/ops，逐题 validate-op.cjs 通过…
node skills/study-bank/scripts/enhance-answers/apply.cjs
node skills/study-bank/scripts/enhance-answers/fix-noncode.cjs --write
node skills/study-bank/scripts/enhance-answers/sync-search.cjs
node skills/study-bank/scripts/enhance-answers/verify.cjs

# 最后一步：答案 HTML → Markdown（幂等；已是 Markdown 的题目自动跳过）
backend/.venv/bin/python skills/study-bank/scripts/answer-to-markdown.py --check
backend/.venv/bin/python skills/study-bank/scripts/answer-to-markdown.py --write
```

> 这套增强是「抽取后处理」：**`node skills/study-bank/scripts/extract-study.cjs` 会整体覆盖 `backend/data/study`，重抽后必须重跑**。行号剔除、代码行还原属于格式清理（不改变文字）；`verify.cjs` 用重建阶段记录的可见文字哈希兜底。`.wip-answers/` 是临时目录，不提交。

`answer-to-markdown.py` 在写盘前会把每道题的新 Markdown 交给真实的 `render_answer()` 渲染，再逐块比对标题 / 段落 / 列表项 / 代码（含语言）/ 图片 / 表格单元格；任何不一致的题目保留原 HTML 并计入失败，退出码非 0。`--topic=jvm` 可只处理单个专题，`--check` 只验证不写盘。它只改 `answer` 字段，不动 `search`、`evidence` 与 `index.json`。

**应急：只在本仓库小修**（补 note/summary/截图；整题增删仍走上游，否则下次抽取全丢）：

1. 改专题 JSON 对应字段；2. 同步改 `index.json` 的索引字段（其中无 `answer`/`evidence`）；3. 新题**只能追加末尾**，`id` 取 `q(count+1)`、`no` 同步，否则 qid 连续性、`key`、截图文件名全错位；4. 新截图放 `backend/data/study/<slug>/assets/ev/`，命名 `qNNN_<rangeIndex>_<page>.jpg`，`file` 写 `/study/…`；5. 重算 `search`；重启 dev（缓存）、硬刷新、跑自检。

写法细则：**题干**逐字还原（标点/重复问法都保留，与截图一致）；**aliases** 是原文其它问法，不与 title 重复；**summary** 是 3–4 条要点提炼，不是答案替代；**pages** 用 `p<from>–<to>`，`firstPage = evidence[0].from`；**answer** 整段搬上游 HTML，不重排/不改写；**search** 非空，规则=`title + aliases + summary + note + answer 纯文本`（`backend/app/features/search/service.py` 仅在 summary 为空时拿它兜底，仍须与正文同步）；**note** 只解释「原文为何如此」（空壳外链、错字/重复），不补知识。

## 3.6 内容取舍约定

1. **逐字还原**：题干、答案的文字逐字照录；不改写、不摘要替代。代码/段落的换行与缩进、代码块边界可以在「答案格式增强」里重排（见 3.5），但**非空白字符不得增删改**，用 `verify.cjs` 的可见文字哈希兜底。
2. **不得臆造**：原文没有的不补；补充知识只能进 `summary`/`note` 并标明。
3. **截图为证**：每题有对应页截图（红框圈题干），不裁剪、不 P 图；广告/页脚留在截图里正常。
4. **多出处全保留**：如 `jvm/q005` 3 个出处、`os/q074` 7 个、`bigtech/q001` 32 个出处/22 个别名，答案与证据全给，不写「另见 pXX」。
5. **原文自身问题照录**：错字、重复段落、只给外链的空壳答案保留，用 `note` 标注。
6. **答案分层**：`summary`→`answer`→`evidence`→`note`，不跨层搬运。
7. **消费层不二次清洗**：广告/页脚已在上游剔除，不「补回来」，也不按长度/关键词删正文。
8. **不为好看删内容**：不删段落、不合并多题、不为通顺改标题，也不为排版把正文塞进代码块。行号、页脚等**抽取伪影**可清理；删字类修改默认只登记、不批量自动修。

## 3.7 验收清单

### 自动校验

- 跑 `node skills/study-bank/scripts/enhance-answers/verify.cjs`：结构与题号、代码块契约、逐题可见文字哈希（对照 `skills/study-bank/scripts/enhance-answers/fidelity.json`，代码题已扣行号）、`search` 与规则重算、证据/配图；必须输出 `OK`。答案已是 Markdown 时，代码契约改为校验围栏语言白名单，可见文字哈希按 Markdown 等价文本计算（图片取图注、实体只解一次、忽略 NUL），因此 HTML 阶段与转换后都能直接跑。
- 跑 `backend/.venv/bin/python skills/study-bank/scripts/answer-to-markdown.py --check`：答案 Markdown 逐题渲染比对，必须 `0 题失败`。
- `cd frontend && npm run typecheck && npm run lint && npm run test && npm run build`；`cd backend && python -m pytest`；`git -C backend/data status --short study` 确认只有预期变化（`backend/data` 是独立数据仓）。

### 页面手工与视觉验收

- `/study`：42 张卡片、`42 专题 / 2,521 题目 / 4,120 页原文`、筛选可用；`/study/jvm` 前端跳到 `/study/jvm/q001`；`/study/topic-01-jvm` 与 `/study/jvm/q999` 应 404。
- `/study/jvm/q001`：三栏、别名、要点卡、原文备注、答案、上下题；右栏截图组数/页码与 evidence 一致、可放大、`Esc` 关闭；侧栏 `/` 搜索、`↑↓` 切题、专题下拉切换；全局搜索（`/api/search?q=`）能命中答案正文。
- 视觉：`python backend/scripts/dev.py` 后逐张读图，确认三栏不塌、红框在题干、插图位置正确、答案结尾无下一题标题；截图命令：
  ```bash
  mkdir -p /tmp/study-shots
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
    --disable-gpu --hide-scrollbars --window-size=1680,1100 --virtual-time-budget=8000 \
    --screenshot=/tmp/study-shots/jvm-q005.png http://localhost:5173/study/jvm/q005
  ```
- **独立审计**：每批改动派两个只读 agent——① 抽 6–10 题把 `answer` 与 `evidence` 截图/上游 `dump.txt` 对照，报缺段/串题/改写；② 统计上游题目级 heading（通常 14.6pt）与含「？」行，确认无漏题。结论写进交付说明。

## 3.8 新增一个专题（PDF → 本仓库）的标准动作

| # | 在哪 | 动作 |
| --- | --- | --- |
| 1 | 上游 | 放 `Topic-43-XXX.pdf`；`extract.py "Topic-43-XXX.pdf" build/topic-43` |
| 2 | 上游 | `dump.py build/topic-43`，校准 `RIGHT_MARGIN`/`HEADING_MIN` |
| 3 | 上游 | 通读 `dump.txt`，写 `build/topic-43/questions.p1.json` |
| 4 | 上游 | `resolve.py build/topic-43`，必须「真正漏段: []」 |
| 5 | 上游 | 删旧 `site/topic-43-xxx/assets/{ev,img}`；`shots.py build/topic-43 "Topic-43-XXX.pdf" site/topic-43-xxx` |
| 6 | 上游 | `tools/site.json` 增 `id/no/slug/build/title/label/subtitle/pdf/accent`，`site.pages` 手填则加页数；`build_site.py`；跑上游三套验收 |
| 7 | 本仓库 | `rsync -a --delete <上游>/site/topic-43-xxx/assets/ backend/data/study/topic-43-xxx/assets/`（只同步 assets） |
| 8 | 本仓库 | 改硬编码 2 处：`skills/study-bank/scripts/extract-study.cjs` 的 `meta.subtitle`（「42 个专题」）、`frontend/src/features/admin/auth/AdminLoginPage.tsx` 的 42/2521 文案；再 `node skills/study-bank/scripts/extract-study.cjs`（应 `done: 43 topics`） |
| 9 | 本仓库 | 跑自检 + 前端 `typecheck/lint/test/build` + 后端 `pytest` + `python backend/scripts/dev.py` 看列表/首末题 + 抽查截图 + 两个只读 agent 审计 + `git status` |

`meta.pages` 来自上游 `site.pages`，`meta.topics/count` 由脚本重算。

## 3.9 踩过的坑

| 现象 | 根因 | 做法 |
| --- | --- | --- |
| 抽取成功但图片全 404 | 脚本只写 JSON | 必须同步 `site/<slug>/assets/` 到 `backend/data/study/<slug>/assets/` |
| 新增专题仍显示「42 个专题」 | 3 处硬编码 | 改脚本 subtitle + study 页 description + admin 登录页文案 |
| `/study/topic-01-jvm` 404 | 路由按 `topic.id` 读文件 | 链接用 id，slug 只用于资产 |
| 插题后题号/截图错位 | qid 连续且写进文件名 | 只追加末尾；插中间就走上游重跑 shots |
| 改 JSON 后页面不更新 | `getStudyIndex()` 缓存 + `/study` 预渲染 | 重启 dev / 重新 build / 硬刷新 |
| 题目页图片裂 | 用了相对路径 | `answer` 图片必须 `/study/<slug>/assets/…` |
| 全量格式化 JSON 产生巨大 diff | `backend/data/study` 约 24 MB、index 7.6 MB | 只改目标字段，保持 2 空格缩进与键序 |
| 删「未引用」图想减体积 | `topic-01-jvm/assets/img/p102_0.jpg` 无 answer 引用属正常 | 先核对引用，不按「未引用即删」清理 |
| 代码里夹着 1/2/3 行号 | PDF 代码编辑器截图的行号被当正文抽取 | `reconstruct.cjs` 按坐标/行宽识别并剔除；非空白文字哈希校验兜底 |
| 答案里的代码被拆成 pre→列表→pre | 中文注释行字体不同，上游按正文/列表抽取 | `reconstruct.cjs` 合并回同一代码块；模型审阅兜底（见 3.5） |
| 改 answer 后 search 与正文不一致 / 索引旧 | `search` 是预计算字段，index 与专题两份 | 跑 `node skills/study-bank/scripts/enhance-answers/sync-search.cjs`（或重抽）重算并同步 |
| 代码块被压成一行 / 重抽后格式退回旧样 | 只有 token span；`extract-study.cjs` 会覆盖 backend/data/study | 统一成 `data-lang` + 后端 Pygments（`AGENTS.md` 1.8、3.4），重抽后重跑 3.5 的增强流水线 |
| 重抽后答案又变回 HTML | `extract-study.cjs` 只搬上游 HTML | 重跑 3.5 最后一步 `answer-to-markdown.py --write`（幂等，已是 Markdown 的题目自动跳过） |
| 转换后 `verify.cjs` 报代码块契约失败 | 旧的契约校验只认 `<pre class='code'>` | 现在按 `isMarkdownAnswer()` 分流：Markdown 走围栏语言白名单，HTML 走原契约；两种状态都能输出 `OK` |
| Markdown 里 `1.`、`- `、`#` 开头的正文变成列表/标题 | 块级标记被解析 | 转换脚本会转义行首标记；手工编辑时同样加 `\` |

## 3.10 硬性禁止

- 不在本仓库运行/移植上游 Python 工具链（`tools/`、`build/`、`.venv_pdf` 都不在）。
- 不手改 `backend/data/study/**` 的截图内容或文件名（被 JSON 的 `file` 引用）。
- 不把 `backend/data/study/*.json` 当题库的「源」：源在上游 `questions.p*.json` + PDF。
- 不改写原文答案、不摘要替代、不删段落、不合并多题。排版/代码块格式规范化走 3.5 的增强脚本（只允许改空白与块结构，`verify.cjs` 校验非空白文字不变）；答案用 Markdown 编辑（后台或转换脚本），不要手写 HTML 片段。
- 不伪造证据：无对应页截图不出现该题，不 P 图、不裁掉红框题干。
- 不跳过自检与页面/视觉验收；批量改题必须走两个只读 agent 审计。
- 不把不可信 HTML/Markdown 写进 `answer`（页面用 `dangerouslySetInnerHTML` 渲染，服务端只拦 `<script>`/`on*=`/`javascript:`）。
- 不提交 `frontend/dist/`、临时截图、`/tmp` 产物；`backend/data/study` 约 755 MB，不复制第二份。
