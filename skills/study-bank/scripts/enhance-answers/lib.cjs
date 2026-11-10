'use strict';

/**
 * 题库答案格式增强的公共工具（本仓库 Node 内置模块，不引新依赖）。
 *
 * 背景：`backend/data/study/*.json` 的 `answer` 是从上游 PDF 抽取的 HTML 片段。上游
 * 抽取时会把代码块拆成 `<pre class='code'><code><span class='cl'>…</span>…`
 * 的多行结构，但本仓库没有对应的行样式；jvm 专题的 flow 还是旧版（多行被空格
 * 拼成一行），中文注释行也被归成正文 / 列表项。这里用上游 `build/topic-XX/
 * lines.json`（每行带坐标、字体、原始文本）把代码行**无损还原**，再交给模型
 * 审阅；最终答案里代码块统一成：
 *
 *   <pre class='code' data-lang='java'><code>原始代码（逐行，HTML 转义）</code></pre>
 *
 * 文字逐字不变由 `visibleText()` 校验（去空白后比较）。
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const DATA_DIR = path.join(ROOT, 'backend', 'data', 'study');
/** 上游仓库路径：与 skills/study-bank/scripts/extract-study.cjs 的 INTERVIEW 常量保持一致，可用环境变量覆盖。 */
const INTERVIEW_DIR = process.env.INTERVIEW_DIR || '/Users/liyang/Deepseek/projects/interview';
const WIP_DIR = path.join(ROOT, '.wip-answers');
const FIDELITY_FILE = path.join(__dirname, 'fidelity.json');

const MONO_FONTS = ['lucidaconsole', 'consolas', 'courier', 'menlo', 'monaco', 'sourcecode'];
const LIGATURES = { 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬀ': 'ff', 'ﬃ': 'ffi', 'ﬄ': 'ffl' };

/** 允许出现在 data-lang 里的语言（与渲染层的 Shiki 白名单对齐，text 兜底）。 */
const LANGS = new Set([
  'text', 'java', 'javascript', 'js', 'typescript', 'ts', 'json', 'yaml', 'yml',
  'properties', 'ini', 'toml', 'xml', 'html', 'css', 'scss', 'less', 'bash',
  'shell', 'sh', 'zsh', 'powershell', 'sql', 'nginx', 'dockerfile', 'diff',
  'python', 'go', 'rust', 'c', 'cpp', 'kotlin', 'groovy', 'markdown', 'log',
  'http', 'regex',
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function loadTopicIndex() {
  return readJson(path.join(DATA_DIR, 'index.json'));
}

/** 上游 tools/site.json：专题 id → { slug, build }。 */
let siteCache = null;
function loadSiteTopics() {
  if (siteCache) return siteCache;
  const site = readJson(path.join(INTERVIEW_DIR, 'tools', 'site.json'));
  const map = new Map();
  for (const topic of site.topics) map.set(topic.id, topic);
  siteCache = map;
  return map;
}

/** 专题 id → 上游 lines.json（页 → 行数组）。带缓存，单专题最多 4 MB。 */
const pagesCache = new Map();
function loadPages(topicId) {
  if (pagesCache.has(topicId)) return pagesCache.get(topicId);
  const siteTopic = loadSiteTopics().get(topicId);
  if (!siteTopic) throw new Error(`上游 site.json 缺专题：${topicId}`);
  const file = path.join(INTERVIEW_DIR, siteTopic.build, 'lines.json');
  const data = readJson(file);
  const pages = new Map();
  for (const page of data.pages) {
    // 编辑器行号槽（纯数字、窄、位于代码左侧）不是代码内容；dump.py 也跳过它们。
    // 不滤掉会让「代码行 + 行号」的连续行匹配失败，spring/arch 等专题全是这种版式。
    const lines = page.lines.filter(
      (line) => !(line.mono && /^\d{1,3}$/.test(String(line.text || '').trim()) && line.x0 < 102 && line.x1 <= 104),
    );
    pages.set(page.p, lines);
  }
  const entry = { pages, file };
  if (pagesCache.size >= 6) {
    const oldest = pagesCache.keys().next().value;
    if (oldest !== undefined) pagesCache.delete(oldest);
  }
  pagesCache.set(topicId, entry);
  return entry;
}

function normalizeText(text) {
  let out = String(text);
  for (const [from, to] of Object.entries(LIGATURES)) out = out.split(from).join(to);
  return out.replace(/[\u200b\u200c\u200d]/g, '').replace(/\u00a0/g, ' ');
}

function decodeEntities(text) {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => codePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => codePoint(Number(dec)))
    .replace(/&(lt|gt|amp|quot|apos|nbsp|hellip|mdash|ndash|times|gt|lt);/g, (all, name) => {
      const map = {
        lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ',
        hellip: '…', mdash: '—', ndash: '–', times: '×',
      };
      return map[name] ?? all;
    });
}

function codePoint(value) {
  try {
    return String.fromCodePoint(value);
  } catch {
    return '';
  }
}

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 去掉所有标签后的可见文本（已做实体反转义）。 */
function stripTags(html) {
  return String(html).replace(/<[^>]*>/g, '');
}

function plainText(html) {
  return decodeEntities(stripTags(html));
}

/** 对齐 / 比较用：去掉全部空白（代码行断行差异因此被忽略），并忽略 NUL 控制字符。 */
function normalizedKey(text) {
  return normalizeText(text).replace(/\u0000/g, '').replace(/\s+/g, '');
}

/** 整个答案的可见文字指纹（去空白），用于保证“逐字不变”。 */
function visibleText(html) {
  return normalizedKey(plainText(html));
}

const ANSWER_FENCE = /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[ \t]*$/gm;
const ANSWER_BLOCK_TAG = /<(?:p|ul|ol|li|pre|figure|table|div|h[2-5])\b/i;
const ANSWER_IMAGE = /!\[[^\]]*\]\((?:<[^>]*>|[^)\s]*)(?:\s+"([^"]*)")?\)/g;

/** 答案是否已是 Markdown（围栏里的 `<p>` 等只是代码文本）。 */
function isMarkdownAnswer(markup) {
  return !ANSWER_BLOCK_TAG.test(String(markup).replace(ANSWER_FENCE, ''));
}

/** 答案可见文字指纹：HTML 与 Markdown 两种承载形式得到同一结果（图注算可见文字）。 */
function answerVisibleText(markup) {
  const source = String(markup);
  if (!isMarkdownAnswer(source)) {
    return visibleText(source);
  }
  const withCaptions = source.replace(ANSWER_IMAGE, (_match, title) => title || '');
  // Markdown 里的文字已经过一次实体解码，这里不能再解一次（否则 `&quot;` 会被二次还原）。
  return normalizedKey(plainTextForSearch(withCaptions, false));
}

// ---------------------------------------------------------------------------
// HTML 块解析：答案片段只包含固定几种顶层标签，用顺序扫描足够可靠。
// ---------------------------------------------------------------------------

const TOP_TAGS = new Set(['ul', 'li', 'p', 'pre', 'figure', 'div', 'table', 'h2', 'h3', 'h4', 'h5']);
const HEADINGS = new Set(['h2', 'h3', 'h4', 'h5']);

function parseBlocks(html) {
  const blocks = [];
  let i = 0;
  while (i < html.length) {
    if (/\s/.test(html[i])) {
      i += 1;
      continue;
    }
    if (html[i] !== '<') {
      const next = html.indexOf('<', i);
      const text = html.slice(i, next < 0 ? html.length : next);
      if (text.trim()) blocks.push({ type: 'text', html: text, text: plainText(text) });
      i = next < 0 ? html.length : next;
      continue;
    }
    const open = html.slice(i).match(/^<([a-zA-Z0-9]+)([^>]*)>/);
    if (!open) throw new Error(`无法解析的 HTML 片段（偏移 ${i}）：${html.slice(i, i + 80)}`);
    const tag = open[1].toLowerCase();
    const attrs = open[2] || '';
    if (!TOP_TAGS.has(tag)) {
      // 容错：未知顶层标签整体保留（当前数据里没有）。
      const close = `</${tag}>`;
      const end = html.indexOf(close, i);
      if (end < 0) throw new Error(`未闭合标签 <${tag}>，偏移 ${i}`);
      blocks.push({ type: 'raw', tag, html: html.slice(i, end + close.length), text: plainText(html.slice(i, end + close.length)) });
      i = end + close.length;
      continue;
    }
    const close = `</${tag}>`;
    const end = html.indexOf(close, i);
    if (end < 0) throw new Error(`未闭合标签 <${tag}>，偏移 ${i}`);
    const inner = html.slice(i + open[0].length, end);
    const outer = html.slice(i, end + close.length);
    if (tag === 'ul') {
      const items = [];
      const re = /<li([^>]*)>([\s\S]*?)<\/li>/g;
      let m;
      while ((m = re.exec(inner))) {
        items.push({ attrs: m[1] || '', html: m[0], text: plainText(m[2]) });
      }
      blocks.push({ type: 'ul', attrs, html: outer, items });
    } else if (tag === 'li') {
      blocks.push({ type: 'li', attrs, html: outer, text: plainText(inner) });
    } else if (tag === 'pre') {
      blocks.push({ type: 'pre', attrs, html: outer, text: plainText(inner) });
    } else if (HEADINGS.has(tag)) {
      blocks.push({ type: 'heading', tag, attrs, html: outer, text: plainText(inner) });
    } else {
      blocks.push({ type: tag, attrs, html: outer, text: plainText(inner) });
    }
    i = end + close.length;
  }
  return blocks;
}

function escapeAttr(value) {
  return String(value).replace(/'/g, '&#39;');
}

/**
 * 把块序列重新拼成 answer HTML。
 * - ul：只输出仍然存在的 li（合并进代码块的 li 会被移除）；空 ul 丢弃。
 * - code：统一成 `<pre class='code' data-lang='…'><code>…</code></pre>`。
 */
function renderBlocks(blocks) {
  const out = [];
  for (const block of blocks) {
    if (block.removed) continue;
    switch (block.type) {
      case 'ul': {
        const items = (block.items || []).filter((item) => !item.removed);
        if (items.length) out.push(`<ul${block.attrs}>${items.map((item) => item.html).join('')}</ul>`);
        break;
      }
      case 'li':
        if (!block.removed) out.push(block.html);
        break;
      case 'code': {
        const lang = LANGS.has(block.lang) ? block.lang : 'text';
        out.push(`<pre class='code' data-lang='${escapeAttr(lang)}'><code>${escapeHtml(block.code)}</code></pre>`);
        break;
      }
      case 'raw':
      case 'p':
      case 'pre':
      case 'figure':
      case 'div':
      case 'table':
      case 'heading':
      case 'text':
        out.push(block.html);
        break;
      default:
        throw new Error(`未知块类型：${block.type}`);
    }
  }
  return out.join('');
}

// ---------------------------------------------------------------------------
// 上游 PDF 行数据：对齐与匹配
// ---------------------------------------------------------------------------

function isMonoFont(font) {
  const value = String(font || '').toLowerCase();
  return MONO_FONTS.some((name) => value.includes(name));
}

/**
 * 编辑器行号槽：纯数字、很窄，且同一行高度上右侧还有真正的代码文本。
 * 这类行在 flow 里被当成了代码内容（mysql/arch 等截图式代码块），需要从输出里剔除。
 */
function isGutterLine(line, pageLines) {
  const text = String(line.text || '').trim();
  if (!/^\d{1,4}$/.test(text)) return false;
  if (line.x1 - line.x0 > 26) return false;
  for (const other of pageLines) {
    if (other === line) continue;
    if (Math.abs(other.y0 - line.y0) > 1.5) continue;
    if (other.x0 <= line.x0 + 3) continue;
    if (other.x1 <= line.x1 + 5) continue;
    if (/^\d{1,4}$/.test(String(other.text || '').trim())) continue;
    return true;
  }
  return false;
}

/** 行号槽的文本形态：纯数字、很窄。 */
function looksGutterNumber(line) {
  const text = String(line.text || '').trim();
  if (!/^\d{1,4}$/.test(text)) return false;
  return line.x1 - line.x0 <= 26;
}

/**
 * 代码块左侧的行号槽。编辑器截图里的行号在代码左边，x1 小于代码正文左缘；
 * 空白行也有行号（同一高度没有正文），所以不能只靠“同高有正文”判断。
 */
function isCodeGutterLine(line, baseX0) {
  if (!looksGutterNumber(line)) return false;
  return line.x1 < baseX0 - 2;
}

/** 代码正文左缘：忽略行号槽后的等宽行最小 x0。 */
function baseXOfLines(lines) {
  const mono = lines.filter((line) => isMonoFont(line.font));
  const codeMono = mono.filter((line) => !looksGutterNumber(line));
  const pool = codeMono.length ? codeMono : mono;
  if (pool.length) return Math.min(...pool.map((line) => line.x0));
  return lines[0] ? lines[0].x0 : 0;
}

/** 解析 `<pre>` 里上游输出的 `.cl` 行（每行一个 span），返回纯文本行数组。 */
function clLinesOfPre(innerHtml) {
  const chunks = String(innerHtml).split(/<span class=['"]cl['"]>/).slice(1);
  if (!chunks.length) return null;
  return chunks.map((chunk) => plainText(chunk));
}


/** 代码块里中文注释用宋体渲染（上游 dump.py 同款判定）。 */
function isCommentFont(line) {
  const font = String(line.font || '').toLowerCase();
  return font.includes('nsimsun') && line.size < 9.4;
}

function isCodeLine(line, baseX0) {
  if (isMonoFont(line.font)) return true;
  if (isCommentFont(line) && Math.abs(line.x0 - baseX0) <= 2.5) return true;
  return false;
}

/** 页码范围：答案所有 evidence 组覆盖的页（含首尾）。 */
function pagesOfQuestion(question) {
  const pages = new Set();
  for (const group of question.evidence || []) {
    for (let p = group.from; p <= group.to; p += 1) pages.add(p);
  }
  return pages;
}

function posAfter(pos) {
  return { page: pos.page, index: pos.index + 1 };
}

function comparePos(a, b) {
  return a.page === b.page ? a.index - b.index : a.page - b.page;
}

/**
 * 在 [from, to) 的行区间里找一段连续行，其去空白拼接等于 target。
 * target 必须非空。返回 {page,start,end,inclusiveEnd}。
 */
function findRun(target, pages, from, to) {
  if (!target) return null;
  const lastPage = to ? to.page : Math.max(...pages.keys());
  for (let page = from.page; page <= lastPage; page += 1) {
    const lines = pages.get(page);
    if (!lines) continue;
    const startIndex = page === from.page ? from.index : 0;
    const endIndex = to && page === to.page ? to.index : lines.length;
    for (let start = startIndex; start < endIndex; start += 1) {
      let acc = '';
      for (let end = start; end < endIndex; end += 1) {
        acc += normalizedKey(lines[end].text);
        if (acc.length > target.length) break;
        if (acc.length === target.length) {
          if (acc === target) return { page, start, end };
          break;
        }
      }
    }
  }
  return null;
}

/** 找 target 对应的行段；先按游标向前找，失败再从答案页范围起点找（容忍顺序误差）。 */
function matchRun(target, pages, range, cursor) {
  const targetKey = normalizedKey(target);
  if (!targetKey) return null;
  if (cursor) {
    const hit = findRun(targetKey, pages, cursor, null);
    if (hit) return hit;
  }
  const from = { page: range.minPage, index: 0 };
  return findRun(targetKey, pages, from, null);
}

/** 在明确的行区间（两端位置）内找一段连续行。 */
function matchRunBetween(target, pages, fromPos, toPos) {
  const targetKey = normalizedKey(target);
  if (!targetKey) return null;
  return findRun(targetKey, pages, fromPos, toPos);
}

/** 中文直接拼、英文补空格（与上游 dump.join_text 一致）。 */
function joinText(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a.endsWith(' ') || b.startsWith(' ')) return a + b;
  const cjk = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/;
  if (cjk.test(a[a.length - 1]) || cjk.test(b[0])) return a + b;
  return `${a} ${b}`;
}

// ---------------------------------------------------------------------------
// 语言识别（初判；模型审阅阶段可覆盖）
// ---------------------------------------------------------------------------

function guessLang(code) {
  const text = String(code || '').trim();
  if (!text) return 'text';
  const lower = text.toLowerCase();
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const first = lines[0] || '';

  if (/^#!.*\b(bash|sh|zsh)\b/.test(first)) return 'bash';
  if (/^(select|insert|update|delete|create\s+(table|index|database)|alter\s+table|explain|show\s+(databases|tables|variables|status)|grant|set\s+\w+\s*=)\b/i.test(first) || /\bfrom\s+\w+.*\bwhere\b/i.test(text)) return 'sql';
  if (/^<\?xml|^<[a-z][\w:-]*(\s|>)/i.test(first) && /<\/[a-z][\w:-]*>/i.test(text)) return 'xml';
  if (/^(server|http|location|upstream|map|events)\b[\s{]/m.test(text) || /^\s*(listen|server_name|proxy_pass|location\s+\/)/m.test(text)) return 'nginx';
  if (/^FROM\s+\S+/m.test(text) && /^(RUN|COPY|CMD|ENTRYPOINT|ENV|WORKDIR|ADD|EXPOSE)\s/m.test(text)) return 'dockerfile';
  if (/^\s*(\{[\s\S]*\}|\[[\s\S]*\])\s*$/.test(text) && /"[^"]+"\s*:/.test(text)) return 'json';
  if (/^\s*[\w.-]+\s*:\s+\S/m.test(text) && !/[;{}]/.test(text) && !/^(http|https):\/\//.test(first)) return 'yaml';
  if (/^\s*[\w.-]+\s*=\s*\S/m.test(text) && !/[;{}()]/.test(text)) return 'properties';
  if (/^(kubectl|docker|systemctl|netstat|ss|ps|top|grep|awk|sed|curl|wget|tar|chmod|chown|rm|cp|mv|mkdir|echo|cat|tail|head|journalctl|iptables|sysctl|mount|df|du|ls|cd|export|source|apt|yum|npm|pnpm|mvn|git)\b/m.test(text)) return 'bash';
  if (/^(GET|POST|PUT|DELETE|HEAD|PATCH)\s+\S+\s+HTTP\/\d/.test(first)) return 'http';
  if (/^(public|private|protected|class|interface|enum|import|package|@\w+)/.test(first) || /\b(public|private|protected)\s+(static\s+)?(final\s+)?(class|interface|void|int|String|boolean|long|double)\b/.test(text) || /System\.(out|err)\./.test(text)) return 'java';
  if (/^(function|const|let|var|import\s+.*from|export\s+(default|const|function)|class\s+\w+)/.test(first) || /console\.log\(/.test(text)) return 'javascript';
  if (/^(def\s+\w+\(|import\s+\w+|from\s+\w+\s+import\s)/.test(first)) return 'python';
  if (/^#\s/.test(first) && /^[A-Za-z_][\w-]*\s*:\s*\S/m.test(text)) return 'yaml';
  return 'text';
}

/**
 * 合并 PDF 版心换行造成的断行：上一行以运算符/逗号/左括号/点结尾，且下一行顶格
 * （没有缩进）时，视为同一行被版心截断，拼回一行。只改空白，不改任何字符。
 */
function mergeWrappedLines(lines) {
  const out = [];
  for (const line of lines) {
    const text = String(line.text || '').replace(/\s+$/, '');
    const prev = out[out.length - 1];
    if (prev && shouldJoinWrapped(prev.text, text)) {
      const left = String(prev.text || '').replace(/\s+$/, '');
      const right = text.replace(/^\s+/, '');
      const joiner = wrapJoiner(left, right);
      out[out.length - 1] = { ...prev, text: left + joiner + right, joinedWrap: true };
      continue;
    }
    out.push({ ...line, text });
  }
  return out;
}

function shouldJoinWrapped(prevText, nextText) {
  const left = String(prevText || '').replace(/\s+$/, '');
  const right = String(nextText || '');
  if (!left || !right) return false;
  if (/^\s/.test(right)) return false;
  if (/(\/\/|#)/.test(left)) return false;
  if (/[;{}]$/.test(left)) return false;
  return /[,(=+\-*/?:&|.\[<]$/.test(left);
}

function wrapJoiner(left, right) {
  if (/[.(]$/.test(left) || /^[),;.]/.test(right)) return '';
  return ' ';
}

/** 代码行是否疑似跨页/版心换行留下的断行（需要模型合并）。 */
function looksLikeWrapped(codeLines) {
  for (let i = 0; i < codeLines.length - 1; i += 1) {
    const current = String(codeLines[i].text || '').replace(/\s+$/, '');
    const next = String(codeLines[i + 1].text || '');
    if (!current) continue;
    const noIndent = !/^\s/.test(next);
    const nearRight = codeLines[i].x1 >= 480;
    if (!noIndent) continue;
    if (/[,(+\-*/=?:&|]$/.test(current) && !/[;{}]$/.test(current)) return true;
    if (nearRight && !/[;{}]$/.test(current)) return true;
  }
  return false;
}


// ---------------------------------------------------------------------------
// 模型审阅结果（ops）的应用与校验
// ---------------------------------------------------------------------------

/** 把 draft 答案解析成「逻辑块」：统一把本仓库新格式的 <pre class='code'> 认成 code 块。 */
function blocksOfAnswer(answerHtml) {
  return parseBlocks(answerHtml).map((block) => {
    if (block.type !== 'pre') return block;
    const match = /^<pre class='code' data-lang='([^']*)'><code>([\s\S]*?)<\/code><\/pre>$/.exec(block.html.trim());
    if (!match) return block;
    return { ...block, type: 'code', code: decodeEntities(match[2]), lang: match[1] };
  });
}

/**
 * 把模型产出的 ops 应用到 draft 答案。
 * ops 结构：
 *   { key, langs: { "<blockId>": "java" },
 *     ops: [ { blocks:[id...], parts:[ {type:'code',lang,text} | {type:'p',text} | {type:'list',items:[...]} ] } ] }
 * 返回 { html, errors }；只做结构校验，文字一致性由调用方校验。
 */
function applyOpsToAnswer(answerHtml, ops) {
  const errors = [];
  const blocks = blocksOfAnswer(answerHtml);
  const ids = blocks.map((_, id) => id);
  const operations = Array.isArray(ops && ops.ops) ? ops.ops : [];
  const langs = ops && ops.langs && typeof ops.langs === 'object' ? ops.langs : {};

  const replacements = new Map(); // startId -> {endId, parts}
  const used = new Set();
  for (const [index, op] of operations.entries()) {
    const span = Array.isArray(op.blocks) ? op.blocks.map(Number) : [];
    if (!span.length) {
      errors.push(`ops[${index}] 缺少 blocks`);
      continue;
    }
    if (!span.every((id, i) => i === 0 || id === span[i - 1] + 1)) {
      errors.push(`ops[${index}] blocks 必须是连续递增的 id：${span.join(',')}`);
      continue;
    }
    if (span.some((id) => !Number.isInteger(id) || id < 0 || id >= blocks.length)) {
      errors.push(`ops[${index}] blocks 超出范围：${span.join(',')}`);
      continue;
    }
    if (span.some((id) => used.has(id))) {
      errors.push(`ops[${index}] 与其它 ops 的 blocks 重叠：${span.join(',')}`);
      continue;
    }
    for (const id of span) used.add(id);
    const parts = Array.isArray(op.parts) ? op.parts : [];
    if (!parts.length) {
      errors.push(`ops[${index}] 缺少 parts`);
      continue;
    }
    const cleanParts = [];
    for (const part of parts) {
      if (part.type === 'code') {
        if (typeof part.text !== 'string' || !part.text.trim()) {
          errors.push(`ops[${index}] code part 缺少 text`);
          continue;
        }
        const lang = LANGS.has(part.lang) ? part.lang : 'text';
        cleanParts.push({ type: 'code', code: part.text, lang });
      } else if (part.type === 'p') {
        if (typeof part.text !== 'string') {
          errors.push(`ops[${index}] p part 缺少 text`);
          continue;
        }
        cleanParts.push({ type: 'p', text: part.text });
      } else if (part.type === 'list') {
        if (!Array.isArray(part.items) || part.items.some((item) => typeof item !== 'string')) {
          errors.push(`ops[${index}] list part 需要 items: string[]`);
          continue;
        }
        cleanParts.push({ type: 'list', items: part.items });
      } else {
        errors.push(`ops[${index}] 未知 part 类型：${String(part.type)}`);
      }
    }
    if (cleanParts.length !== parts.length) continue;
    const beforeText = blocks.slice(span[0], span[span.length - 1] + 1)
      .map((block) => visibleText(renderBlocks([block])))
      .join('');
    const afterText = cleanParts.map((part) => visibleText(renderBlocks([partToBlock(part)]))).join('');
    if (beforeText !== afterText) {
      errors.push(`ops[${index}] 区间内文字被改动（只允许改空白）；blocks=${span.join(',')}`);
      continue;
    }
    replacements.set(span[0], { endId: span[span.length - 1], parts: cleanParts });
  }

  for (const key of Object.keys(langs)) {
    const id = Number(key);
    if (!Number.isInteger(id) || id < 0 || id >= blocks.length) {
      errors.push(`langs 里的 blockId 越界：${key}`);
      continue;
    }
    if (used.has(id)) continue;
    if (blocks[id].type !== 'code') {
      errors.push(`langs 里的 blockId ${key} 不是 code 块`);
      continue;
    }
    if (!LANGS.has(langs[key])) errors.push(`langs["${key}"] 不是合法语言：${langs[key]}`);
  }
  if (errors.length) return { html: null, errors };

  const out = [];
  for (let id = 0; id < blocks.length; id += 1) {
    const replacement = replacements.get(id);
    if (replacement) {
      for (const part of replacement.parts) out.push(partToBlock(part));
      id = replacement.endId;
      continue;
    }
    const block = blocks[id];
    if (block.type === 'code') {
      const lang = LANGS.has(langs[String(id)]) ? langs[String(id)] : block.lang || 'text';
      out.push({ type: 'code', code: block.code, lang });
    } else {
      out.push(block);
    }
  }
  return { html: renderBlocks(out), errors: [] };
}

function partToBlock(part) {
  if (part.type === 'code') return { type: 'code', code: part.code, lang: part.lang };
  if (part.type === 'p') return { type: 'p', html: `<p>${escapeHtml(part.text)}</p>`, text: part.text };
  const items = part.items.map((text) => ({ attrs: '', html: `<li>${escapeHtml(text)}</li>`, text }));
  return { type: 'ul', attrs: " class='pdf-list'", html: '', items };
}

/** 答案 Markdown（兼容遗留 HTML）→ 纯文本：丢图片、留代码与正文。与后端 plain_for_search 保持一致。 */
function plainTextForSearch(markup, decode = true) {
  const codes = [];
  let text = String(markup).replace(/\u0000/g, '').replace(/<figcaption[\s\S]*?<\/figcaption>/g, ' ');
  text = text.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n([\s\S]*?)^ {0,3}\1[ \t]*$/gm, (_m, _f, body) => {
    codes.push(body);
    return `\u0000${codes.length - 1}\u0000`;
  });
  text = text.replace(/(?<!\\)!\[[^\]]*\]\([^)]*\)/g, ' ');
  text = text.replace(/(?<!\\)\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/^ {0,3}(?:#{1,6}[ \t]+|> ?|[-*+][ \t]+|\d{1,9}[.)][ \t]+)/gm, '');
  text = text.replace(/^[ \t]*\|(?:[ \t]*:?-+:?[ \t]*\|)+[ \t]*$/gm, '');
  // 表格行里未转义的 `|` 是单元格分隔符；`\|` 是正文里的字面竖线，留给后面的反转义。
  text = text.replace(/^[ \t]*\|.*\|[ \t]*$/gm, (line) =>
    ` ${line.split(/(?<!\\)\|/).map((cell) => cell.trim()).join(' ')} `,
  );
  // 转义过的反引号是正文字面量，不能被当作行内代码吃掉。
  text = text.replace(/\\`/g, '\u0001');
  text = text.replace(/(`+)([^`\n]*?)\1/g, '$2');
  text = text.replace(/\u0001/g, '`');
  text = text.replace(
    /<\/?(?:p|ul|ol|li|figure|figcaption|img|pre|code|table|thead|tbody|tr|td|th|h[1-6]|div|span|br|strong|em|a|blockquote)\b[^>]*>/gi,
    ' ',
  );
  text = text.replace(/\\([\\`*_{}\[\]()#+\-.!<>|~&$])/g, '$1');
  text = text.replace(/\u0000(\d+)\u0000/g, (_m, index) => codes[Number(index)]);
  if (decode) text = decodeEntities(text);
  return text.replace(/\s+/g, ' ').trim();
}

/** 上游 search 规则：title + aliases + summary + note + 答案纯文本，空格拼接。 */
function searchFieldOf(question) {
  return [
    question.title || '',
    (question.aliases || []).join(' '),
    (question.summary || []).join(' '),
    question.note || '',
    plainTextForSearch(question.answer || ''),
  ].join(' ');
}

module.exports = {
  ROOT,
  DATA_DIR,
  INTERVIEW_DIR,
  WIP_DIR,
  FIDELITY_FILE,
  MONO_FONTS,
  LANGS,
  readJson,
  writeJson,
  ensureDir,
  loadTopicIndex,
  loadSiteTopics,
  loadPages,
  normalizeText,
  decodeEntities,
  escapeHtml,
  stripTags,
  plainText,
  normalizedKey,
  visibleText,
  answerVisibleText,
  isMarkdownAnswer,
  parseBlocks,
  renderBlocks,
  isMonoFont,
  isCommentFont,
  isCodeLine,
  isGutterLine,
  isCodeGutterLine,
  looksGutterNumber,
  baseXOfLines,
  clLinesOfPre,
  pagesOfQuestion,
  posAfter,
  comparePos,
  findRun,
  matchRun,
  matchRunBetween,
  joinText,
  guessLang,
  looksLikeWrapped,
  mergeWrappedLines,
  blocksOfAnswer,
  applyOpsToAnswer,
  partToBlock,
  plainTextForSearch,
  searchFieldOf,
};
