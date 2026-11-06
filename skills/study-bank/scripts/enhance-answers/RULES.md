# 题库代码块审阅规则（大模型批处理用）

你处理的是 dev-learn 题库答案的「重建草案」工作单元。目标：给代码块标注语言，并在**不改变任何文字**的前提下修正 PDF 抽取造成的代码结构问题。

## 一、工作单元结构

每个 unit 是一道题的答案块序列（`.wip-answers/units/<topicId>/<qid>.json`）：

```json
{
  "key": "jvm/q001",
  "topicId": "jvm",
  "title": "题干",
  "flags": ["merged-fragments:1", "wrapped-blocks:2"],
  "blocks": [
    { "id": 0, "type": "p", "text": "段落文字" },
    { "id": 1, "type": "code", "lang": "java", "text": "代码（已还原换行）", "flags": ["wrapped"] },
    { "id": 2, "type": "ul", "items": [{ "text": "列表项" }] },
    { "id": 3, "type": "figure" }
  ]
}
```

- `id` 是块序号，ops 里必须用它。
- `type`：`p` / `code` / `ul` / `heading` / `figure` / `table`。
- `code.text` 来自上游 PDF 行数据，换行和缩进已尽量还原；`lang` 是程序初判，可能不准。
- 块 flags 的含义：
  - `merged-fragment`：合并过被误分类的代码行；
  - `joined-wrap`：已自动接回版心断行；
  - `wrapped`：疑似还有版心断行/粘连，需要你看一下；
  - `prose-inside-code`：这个代码块里混进了正文行；
  - `demoted-from-code`：从代码块里拆出来的正文；
  - `code-like-between-code`：列表/段落位于两个代码块之间，可能是被误分类的代码行，需要判断。
- `ul` 的 `items` 是文本数组；`figure` / `table` 无正文意义。

## 二、输出

把结果写到 `.wip-answers/ops/<topicId>/<qid>.json`（目录不存在就创建）：

```json
{
  "key": "jvm/q001",
  "langs": { "1": "java", "5": "text" },
  "ops": [
    { "blocks": [3, 4, 5], "parts": [{ "type": "code", "lang": "java", "text": "……" }] }
  ],
  "reviewed": true
}
```

- `langs`：给**没有被 ops 替换**的 code 块标语言（key 是字符串形式的 block id）。
- `ops`：只写需要改的连续块区间；`parts` 是替换后的内容，顺序就是最终渲染顺序。
  - `{"type":"code","lang":"…","text":"…"}` 代码块
  - `{"type":"p","text":"…"}` 普通段落（纯文本，不要带 HTML）
  - `{"type":"list","items":["…","…"]}` 列表
- `blocks` 必须连续递增、互相不重叠；不要写空 ops。没有需要修正的结构时，`ops` 留空数组，只写 `langs`。

## 三、规则（最重要）

1. **逐字保真**：除了空白（空格 / 换行 / 缩进），不得增删或改动任何字符。不要改代码内容、不要修正错字、不要补注释、不要翻译、不要加解释。
2. **语言标注**：只从以下白名单选：
   `java, sql, xml, bash, yaml, properties, json, javascript, python, nginx, dockerfile, http, text`
   - `text` 用于：控制台输出、日志、JVM 参数串、无法判断的纯文本。
   - 判定要看正文内容，不能只看第一行（首行常是中文注释）。
   - 同一道题里多个代码块可以语言不同。
3. **可以修的结构问题**（只针对 flags 或肉眼可见的错误）：
   - **版心断行/粘连**（`wrapped` / `joined-wrap`）：例如
     `-XX:+UseParallelGC-XX:ParallelGCThreads=20` → 拆成两行；
     `- XX:SurvivorRatio=4` → `-XX:SurvivorRatio=4`；
     长行在版心处被截断后，下一行接回同一行。
     只调空白，不改任何非空白字符；不要动字符串字面量内部。
   - **正文混进代码块**（`prose-inside-code` / `mixed`）：把正文行拆成 `p`，代码留在 `code`。判断标准：中文叙述/解释、无代码语法、不是日志/输出格式。
   - **代码混进列表/段落**（`code-like-between-code`）：若条目确实是代码（`int i = 0;`、`// 注释`、`kubectl …`、配置行），合并进相邻代码块；**解释参数含义的中文句子（如 `-Xmx2g：最大堆内存为 2g`）是正文，不要合并**。
   - **相邻代码块**：若明显是同一段代码被误拆（例如页面分页、注释被拆开），可合并；不确定就保留。
4. **不许改变文本顺序**：parts 里文本的先后必须与 blocks 原始文本顺序一致（校验会检查）。
5. **不要动其它块**：`p` / `ul` / `heading` / `table` / `figure` 默认原样保留；只有「判定为代码并合并」时，才在同一个 op 里一起替换。
6. 拿不准就**保持原样**，不要为了好看强行重排。

## 四、自检

每写完一个 unit 的 ops，运行：

```bash
node skills/study-bank/scripts/enhance-answers/validate-op.cjs \
  .wip-answers/units/<topicId>/<qid>.json \
  .wip-answers/ops/<topicId>/<qid>.json
```

看到 `OK` 才算完成；`FAIL` 会指出文字改动/结构问题，按提示修 ops（只调空白与块结构）后重跑，直到全部 OK。

## 五、边界

- 只允许写 `.wip-answers/ops/**`；不要改 `backend/data/study`、`.wip-answers/units`、`.wip-answers/draft`、任何代码文件。
- 一次只处理分配给你的 unit；不要跨任务合并。
- 输出必须是合法 JSON（不要 Markdown 代码围栏）。
