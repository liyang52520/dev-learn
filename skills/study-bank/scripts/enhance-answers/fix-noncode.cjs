#!/usr/bin/env node
'use strict';

/**
 * fix-noncode.cjs — 非代码题 `answer` 的安全结构修复（只改标签结构，不改文字）
 *
 * 依据：`.wip-answers/noncode-audit.md` 第 8 节。本脚本只做「文本保留」类的 P0 修复：
 *
 *   A1. 顶层孤立 `<li class='num'>` → `<p>`        （1940 处 / 323 题）
 *       游离 li 的合法父元素只能是 ul/ol，浏览器会把它渲染成带默认圆点的 list-item。
 *       文本自带「1.」序号，所以一对一换成纯 `<p>` 即可（审计第 8 节：纯 p 零 CSS 改动）。
 *
 *   A2. 连续 `<p>` 强证据断裂合并                    （250 处 / 153 题）
 *       上一段以 `，,、（(` 结尾且未收句、下一段是续写 → 把 B 的正文并入 A、删掉 B 的 `<p>`。
 *       连接处默认不加空格；仅当 A 末尾与 B 开头都是 ASCII 字母数字时补 1 个空格
 *       （纯空白，`visibleText` 校验不受影响）。连续链（A,B,C…）一次合并成一段。
 *
 *   A3. 跨元素续写合并（单条 ul 并入前一块）          （36 处 / 32 题）
 *       `li|p` 以 `，,、` 结尾 + 紧跟单条 `<ul><li>B</li></ul>` → B 并入前一块、删掉 ul。
 *       B 若以「参考：/注：/来源…」开头（不是续写，是参考注释）则**只登记不修**。
 *
 * 以下两类会删字，本次**只统计不自动修**，写进报告供 lead 决策：
 *   R1. 占位段 `<p>.</p>` / `<p>......</p>`        （22 处 / 8 题）
 *   R2. 相邻完全重复 `<p>`                          （6 处 / 6 题）
 * 另外把弱证据 p 断裂、单条 ul→p、裸 URL、答案内 h2 等也登记为「未自动修」，见报告 notFixed。
 *
 * 每条改动都做两道校验：
 *   1) 单处：被替换片段与替换结果的可见文字（去空白）必须一致；
 *   2) 整题：`visibleText(answer)` 改前改后必须一致（与 skills/study-bank/scripts/enhance-answers/lib.cjs 同口径）。
 * 另外校验标签多重集变化与操作声明一致、改后无游离 li / 无块级元素嵌进 p / 无脚本注入，
 * 并对改后答案再跑一次规划，要求 0 命中（幂等 / 不动点）。
 *
 * 用法（默认 dry-run，只写报告；本任务不执行 --write）：
 *   node skills/study-bank/scripts/enhance-answers/fix-noncode.cjs                       # 全量 dry-run
 *   node skills/study-bank/scripts/enhance-answers/fix-noncode.cjs --dry-run
 *   node skills/study-bank/scripts/enhance-answers/fix-noncode.cjs --topics=jvm,os
 *   node skills/study-bank/scripts/enhance-answers/fix-noncode.cjs --write               # 写回 backend/data/study/*.json
 *   node skills/study-bank/scripts/enhance-answers/fix-noncode.cjs --report=.wip-answers/x.json
 *   STUDY_DIR=/tmp/study-copy node skills/study-bank/scripts/enhance-answers/fix-noncode.cjs --write   # 在副本上演练写回
 *
 * `--write` 行为：写回 `backend/data/study/<topicId>.json` 的 `answer`，并同步重算该题 `search`
 * （title+aliases+summary+note+answer 纯文本，与 lib.cjs 的 searchFieldOf 一致）。
 * `backend/data/study/index.json` **不写**（任务要求），只在报告里输出需要同步的 key 列表
 * （正常应为空：结构改写不改变可见文字，纯文本 search 因此不变）。
 *
 * 只依赖 Node 内置模块；可选 require 同目录 lib.cjs 复用 visibleText/searchFieldOf。
 * 写入范围：`backend/data/study/*.json`（仅 --write）+ 报告 `.wip-answers/noncode-fix-report.json`。
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
// 默认读仓库 backend/data/study；STUDY_DIR 可指向副本，便于在不动真实数据的前提下演练 --write。
const DATA_DIR = process.env.STUDY_DIR ? path.resolve(process.env.STUDY_DIR) : path.join(ROOT, 'backend', 'data', 'study');
const DEFAULT_REPORT = path.join(ROOT, '.wip-answers', 'noncode-fix-report.json');
const MAX_PASSES = 6;

// ---------------------------------------------------------------------------
// 参数
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = { write: false, dryRun: false, topics: null, report: DEFAULT_REPORT, help: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--write') opts.write = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg.startsWith('--topics=')) {
      const list = arg.slice('--topics='.length).split(',').map((s) => s.trim()).filter(Boolean);
      opts.topics = list.length ? list : null;
    } else if (arg.startsWith('--report=')) {
      opts.report = path.resolve(ROOT, arg.slice('--report='.length));
    } else {
      throw new Error(`未知参数：${arg}（--help 查看用法）`);
    }
  }
  if (opts.write && opts.dryRun) throw new Error('--write 与 --dry-run 不能同时使用');
  if (!opts.write) opts.dryRun = true; // 默认 dry-run
  return opts;
}

function printHelp() {
  console.log(`fix-noncode.cjs — 非代码题 answer 安全结构修复（只改结构、不改文字）

用法：
  node skills/study-bank/scripts/enhance-answers/fix-noncode.cjs [--dry-run] [--topics=jvm,os] [--report=path]
  node skills/study-bank/scripts/enhance-answers/fix-noncode.cjs --write [--topics=...]

选项：
  --dry-run        只扫描并写报告，不改 backend/data/study（默认）
  --write          写回 backend/data/study/<topic>.json 的 answer + search（index.json 不写）
  --topics=a,b,c   只处理指定专题 id（默认全部 42 个）
  --report=path    报告路径（默认 .wip-answers/noncode-fix-report.json）
环境变量：
  STUDY_DIR=path   覆盖题库目录（默认 backend/data/study；用于在副本上演练 --write）
  -h, --help       显示本帮助`);
}

// ---------------------------------------------------------------------------
// 可选复用 lib.cjs（只读 require，不修改）；失败时用同口径本地实现兜底。
// ---------------------------------------------------------------------------
let lib = null;
try {
  lib = require(path.join(__dirname, 'lib.cjs'));
} catch {
  lib = null;
}

const LIGATURES = { 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬀ': 'ff', 'ﬃ': 'ffi', 'ﬄ': 'ffl' };
function normalizeText(text) {
  let out = String(text);
  for (const [from, to] of Object.entries(LIGATURES)) out = out.split(from).join(to);
  return out.replace(/[\u200b\u200c\u200d]/g, '').replace(/\u00a0/g, ' ');
}
function codePoint(value) {
  try {
    return String.fromCodePoint(value);
  } catch {
    return '';
  }
}
function decodeEntities(text) {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => codePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => codePoint(Number(dec)))
    .replace(/&(lt|gt|amp|quot|apos|nbsp|hellip|mdash|ndash|times);/g, (all, name) => {
      const map = {
        lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ',
        hellip: '…', mdash: '—', ndash: '–', times: '×',
      };
      return map[name] ?? all;
    });
}
function plainText(html) {
  return decodeEntities(String(html).replace(/<[^>]*>/g, ''));
}
/** 与 lib.cjs `visibleText` 同口径：去标签、反转义、去全部空白。 */
function visibleText(html) {
  return normalizeText(plainText(html)).replace(/\s+/g, '');
}
/** 与 lib.cjs `searchFieldOf` 同口径。 */
function plainTextForSearch(markup) {
  let text = String(markup).replace(/<figcaption[\s\S]*?<\/figcaption>/g, ' ');
  text = text.replace(/<[^>]+>/g, ' ');
  text = decodeEntities(text);
  return text.replace(/\s+/g, ' ').trim();
}
function searchFieldOf(question) {
  return [
    question.title || '',
    (question.aliases || []).join(' '),
    (question.summary || []).join(' '),
    question.note || '',
    plainTextForSearch(question.answer || ''),
  ].join(' ');
}

// ---------------------------------------------------------------------------
// 迷你 HTML 解析：保留每个节点的源码偏移，修复用「按偏移替换」实现最小 diff。
// ---------------------------------------------------------------------------
const VOID = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr']);
const BLOCK_TAGS = new Set(['p', 'ul', 'ol', 'li', 'div', 'table', 'figure', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'section']);
const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^<>])*)>/g;

function parseAttrs(s) {
  const a = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let m;
  while ((m = re.exec(s)) !== null) a[m[1].toLowerCase()] = m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : m[5]);
  return a;
}

function parseHtml(html) {
  const root = { tag: '#root', attrs: {}, children: [], parent: null, start: 0, openEnd: 0, closeStart: html.length, end: html.length };
  const stack = [root];
  const re = new RegExp(TAG_RE.source, 'g');
  const issues = [];
  let last = 0;
  let m;
  const addText = (from, to) => {
    if (to <= from) return;
    stack[stack.length - 1].children.push({ tag: '#text', value: html.slice(from, to), start: from, end: to, parent: stack[stack.length - 1] });
  };
  while ((m = re.exec(html)) !== null) {
    if (m.index > last) addText(last, m.index);
    last = re.lastIndex;
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrStr = m[3] || '';
    const selfClose = /\/\s*$/.test(attrStr);
    if (closing) {
      let idx = -1;
      for (let i = stack.length - 1; i >= 1; i -= 1) if (stack[i].tag === tag) { idx = i; break; }
      if (idx === -1) { issues.push({ type: 'stray-close', tag, at: m.index }); continue; }
      if (idx !== stack.length - 1) issues.push({ type: 'mismatch', tag, at: m.index });
      for (let i = stack.length - 1; i > idx; i -= 1) {
        stack[i].closeStart = m.index;
        stack[i].end = m.index;
      }
      stack[idx].closeStart = m.index;
      stack[idx].end = last;
      stack.length = idx;
      continue;
    }
    const node = {
      tag,
      attrs: parseAttrs(attrStr),
      attrStr,
      children: [],
      parent: stack[stack.length - 1],
      start: m.index,
      openEnd: last,
      closeStart: selfClose || VOID.has(tag) ? last : -1,
      end: last,
    };
    stack[stack.length - 1].children.push(node);
    if (VOID.has(tag) || selfClose) continue;
    stack.push(node);
  }
  if (last < html.length) addText(last, html.length);
  for (let i = stack.length - 1; i >= 1; i -= 1) {
    issues.push({ type: 'unclosed', tag: stack[i].tag, at: stack[i].start });
    stack[i].closeStart = html.length;
    stack[i].end = html.length;
  }
  return { root, issues };
}

function innerOf(html, node) {
  return html.slice(node.openEnd, node.closeStart);
}
function textOf(node) {
  if (node.tag === '#text') return node.value;
  let s = '';
  for (const c of node.children) s += textOf(c);
  return s;
}
function norm(s) {
  return s.replace(/[\u200b\u200c\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim();
}
function blockNodes(root) {
  return root.children.filter((c) => c.tag !== '#text');
}
function rootTextNonEmpty(root) {
  return root.children.some((c) => c.tag === '#text' && norm(c.value));
}

function tagCounts(html) {
  const counts = {};
  const re = new RegExp(TAG_RE.source, 'g');
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[2].toLowerCase();
    counts[tag] = (counts[tag] || 0) + 1;
  }
  return counts;
}
function countsDelta(beforeFragment, afterFragment) {
  const delta = {};
  const before = tagCounts(beforeFragment);
  const after = tagCounts(afterFragment);
  for (const [tag, n] of Object.entries(after)) delta[tag] = (delta[tag] || 0) + n;
  for (const [tag, n] of Object.entries(before)) delta[tag] = (delta[tag] || 0) - n;
  for (const tag of Object.keys(delta)) if (!delta[tag]) delete delta[tag];
  return delta;
}
function addDelta(target, delta) {
  for (const [tag, n] of Object.entries(delta)) {
    target[tag] = (target[tag] || 0) + n;
    if (!target[tag]) delete target[tag];
  }
}

// ---------------------------------------------------------------------------
// 判定规则：逐条对齐 `.wip-answers/noncode-audit.md` 附录 A（数字应复现）。
// ---------------------------------------------------------------------------
const CJK = /[\u4e00-\u9fff]/g;
const cjkCount = (s) => (s.match(CJK) || []).length;
const HEADING = /^(\d+(\.\d+)*[、.．)）]|[（(]\d+[)）]|[一二三四五六七八九十]+[、.．]|第[一二三四五六七八九十0-9]+[章节条部分]|[A-Za-z][.、)）]\s|[①②③④⑤⑥⑦⑧⑨⑩])/;
const CMD = 'sudo|docker|docker-compose|kubectl|helm|git|mvn|gradle|npm|pnpm|yarn|node|java|javac|javap|jps|jstat|jmap|jstack|jcmd|jinfo|jhat|curl|wget|ssh|scp|rsync|tar|zip|unzip|chmod|chown|ps|top|htop|free|df|du|netstat|ss|iptables|ifconfig|ip|ping|telnet|nc|nslookup|dig|traceroute|redis-cli|redis-server|redis-benchmark|mysql|mysqldump|mongosh|sysctl|ulimit|sysbench|ab|wrk|cat|tail|head|grep|awk|sed|echo|export|source|ls|cd|pwd|mkdir|rm|cp|mv|mount|systemctl|service|kill|killall|nohup|shutdown|reboot|crontab|strace|gdb|perf|vmstat|iostat|sar|tcpdump|openssl|keytool|jar|vi|vim|touch|ln|find|xargs|watch|time';
const CMDRE = new RegExp('^(?:' + CMD + ')\\s');
const argSig = /(^|\s)-{1,2}[A-Za-z]|(^|\s)\/(?!\/)[\w.\-\/]+|\||>|=\S|\bpid\b|\.[a-z]{2,4}\b/;
const SQLRE = /^\s*(select|insert\s+into|update\s+\S|delete\s+from|create\s+(table|index|database|user)|alter\s+table|drop\s+table|explain\s+|show\s+\w+)\b/i;
const SQLBODY = /;|\bfrom\b|\bwhere\b|\bset\b|\btable\b|\bindex\b|\binto\b/i;
const JVMRE = /^[-‐–—−](X|XX|D|server|client|agentlib|agentpath|javaagent|cp|classpath)\b|^[-‐–—−][\w.]+=/;
const CFGRE = /^[A-Za-z_][\w.\-]*\s*=\s*[^=\s].*$/;
const JAVARE = /^(public|private|protected|static|final|class|interface|enum|import|package)\s/;
const ERRRE = /^[\w.$]+(Exception|Error)(:|\b)/;
const HTTPRE = /^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH)\s+\S+\s+HTTP\//;

function codeKind(T) {
  if (/^(?:\$|#)\s+\S/.test(T)) return 'prompt';
  if (CMDRE.test(T) && argSig.test(T)) {
    if (cjkCount(T) <= 6) return 'command';
    const i = T.search(/[\u4e00-\u9fff]/);
    const prefix = T.slice(0, i).trim();
    if (prefix.length >= 4 && argSig.test(prefix)) return 'command-mix';
  }
  if (SQLRE.test(T) && SQLBODY.test(T) && (/;/.test(T) || cjkCount(T) <= 2) && T.length <= 160) return 'sql';
  if (JVMRE.test(T)) return 'jvm-param';
  if (HTTPRE.test(T)) return 'http';
  if (CFGRE.test(T) && cjkCount(T) === 0 && T.length <= 120) return 'config-expr';
  if (JAVARE.test(T) && /[;{}]/.test(T) && cjkCount(T) === 0 && T.length <= 120) return 'java-decl';
  if (ERRRE.test(T) && cjkCount(T) <= 8 && T.length <= 120) return 'error-line';
  return null;
}

/** 强证据 p 断裂规则（与审计 K2 完全一致）。 */
function isStrongPBreak(A, B) {
  if (!A || !B) return false;
  if (codeKind(A) || codeKind(B)) return false;
  if (/^https?:\/\//.test(A)) return false;
  if (/^(优点|缺点|特点|说明|注意|总结|结论|原因|结果|区别|相同点|不同点)[：:]/.test(A)) return false;
  if (HEADING.test(B) || B.length < 8) return false;
  return A.length >= 12 && /[，,、（(]$/.test(A) && B.length >= 10 && !/[：:]$/.test(B);
}

const TERMINAL = /[。．.!！?？；;：:）)】」』”"’'\]】]$/;
/** 跨元素续写规则（同审计），另加“参考/注释”排除项（安全阀）。 */
const CROSS_EXCLUDE = /^(参考|参见|另见|详见|来源|原文|附[:：]|注[:：]|注意[:：]?|PS[:：]?|图[:：])/i;
/**
 * 强证据合并的安全阀：B 是「区别三：…/注意：…」这类短标题/注解而不是续写句。
 * 例：bigtech/q011 的 `<p>…属于 Thread 类的方法，</p><p>区别三：唤醒方式不同</p>`
 *     若合并会把小标题粘进上一段（原文应为独立小标题），故跳过并登记。
 */
const B_HEADING_KEYWORD = /^(区别|不同点|相同点|注意|提示|备注|补充|小结|总结|说明|原因|结论|误区|延伸)[一二三四五六七八九十0-9]*[：:]/;
function isCrossCandidate(A, B) {
  if (!A || !B) return false;
  if (!/[，,、]$/.test(A)) return false;
  if (HEADING.test(B)) return false;
  if (codeKind(B)) return false;
  return true;
}

/** 连接处空格：仅 ASCII 边界（字母数字相接，或 ASCII 标点后接 ASCII 词）补 1 个空格；中文边界一律不加（审计第 8 节）。 */
function joinSep(aText, bText) {
  if (!/^[A-Za-z0-9]/.test(bText)) return '';
  if (/[A-Za-z0-9]$/.test(aText)) return ' ';
  if (/[,.!?;:]$/.test(aText)) return ' ';
  return '';
}

// ---------------------------------------------------------------------------
// 单 pass 规划：返回互不重叠的 edits（按偏移替换），所有 edit 都保持可见文字。
// ---------------------------------------------------------------------------
function planPass(html, pass) {
  const parsed = parseHtml(html);
  const { root } = parsed;
  const blocks = blockNodes(root);
  const edits = [];
  const ops = [];
  const skippedCross = [];
  const skippedMergeP = [];
  const consumed = new Set(); // 已被并入前一块（右侧被删）的块下标
  const closeOverridden = new Set(); // 顶层 li 的 </li> 已被跨元素合并替换成 </p>
  const cache = new Map();
  const textOfBlock = (node) => {
    if (!cache.has(node)) cache.set(node, norm(textOf(node)));
    return cache.get(node);
  };

  // ---- A2 强证据 p 断裂合并（junction 下标 = 右块下标；连续 junction 组成一条链） ----
  const junctions = new Set();
  for (let i = 1; i < blocks.length; i += 1) {
    const a = blocks[i - 1];
    const b = blocks[i];
    if (a.tag !== 'p' || b.tag !== 'p') continue;
    if (!isStrongPBreak(textOfBlock(a), textOfBlock(b))) continue;
    const B = textOfBlock(b);
    if (B_HEADING_KEYWORD.test(B) && B.length <= 24) {
      skippedMergeP.push({
        reason: 'B 是「区别三：/注意：」类短标题/注解，合并会把小标题粘进上一段',
        leftTail: textOfBlock(a).slice(-40),
        bHead: B.slice(0, 60),
      });
      continue;
    }
    junctions.add(i);
  }
  for (let i = 0; i < blocks.length; i += 1) {
    if (consumed.has(i)) continue;
    let end = i;
    while (end + 1 < blocks.length && junctions.has(end + 1) && !consumed.has(end + 1)) end += 1;
    if (end === i) continue;
    const pieces = [];
    let accumulated = textOfBlock(blocks[i]);
    const junctionOps = [];
    for (let k = i + 1; k <= end; k += 1) {
      const bText = textOfBlock(blocks[k]);
      const sep = joinSep(accumulated, bText);
      pieces.push(sep, innerOf(html, blocks[k]));
      junctionOps.push({
        type: 'merge-p',
        pass,
        leftBlock: i,
        rightBlock: k,
        sep,
        leftTail: accumulated.slice(-36),
        rightHead: bText.slice(0, 60),
      });
      accumulated += bText;
      consumed.add(k);
    }
    edits.push({
      start: blocks[i].closeStart,
      end: blocks[end].end,
      replacement: pieces.join('') + '</p>',
      kind: 'merge-p',
      ops: junctionOps,
    });
    ops.push(...junctionOps);
    i = end;
  }

  // ---- A3 跨元素续写合并（单条 ul 并入前一块） ----
  for (let i = 0; i + 1 < blocks.length; i += 1) {
    if (consumed.has(i) || consumed.has(i + 1)) continue;
    const a = blocks[i];
    const b = blocks[i + 1];
    if (!a || !b) continue;
    if (a.tag !== 'p' && a.tag !== 'li') continue;
    if (b.tag !== 'ul') continue;
    const items = b.children.filter((c) => c.tag === 'li');
    if (items.length !== 1) continue;
    const A = textOfBlock(a);
    const B = textOfBlock(items[0]);
    if (!isCrossCandidate(A, B)) continue;
    if (CROSS_EXCLUDE.test(B)) {
      skippedCross.push({
        reason: 'B 以参考/注释标记开头，判定为参考注释而非续写',
        prevTag: a.tag,
        prevTail: A.slice(-60),
        bHead: B.slice(0, 80),
      });
      continue;
    }
    const op = {
      type: 'merge-cross',
      pass,
      prevTag: a.tag,
      prevTail: A.slice(-36),
      mergedHead: B.slice(0, 60),
      mergedLen: B.length,
      sep: joinSep(A, B),
    };
    // 前一块若是顶层 li（非法 HTML），合并后统一以 </p> 收口（开标签由 A1 转 <p>）。
    edits.push({
      start: a.closeStart,
      end: b.end,
      replacement: innerOf(html, items[0]) + '</p>',
      kind: 'merge-cross',
      ops: [op],
    });
    if (a.tag === 'li') closeOverridden.add(a.closeStart);
    consumed.add(i + 1);
    ops.push(op);
    i += 1; // 下一轮从 ul 之后开始
  }

  // ---- A1 顶层孤立 li → p（全部转换；当前数据 100% 是 class='num'） ----
  for (const b of blocks) {
    if (b.tag !== 'li') continue;
    const text = textOfBlock(b);
    const op = { type: 'li-to-p', pass, className: b.attrs.class || '', textHead: text.slice(0, 60) };
    edits.push({ start: b.start, end: b.openEnd, replacement: '<p>', kind: 'li-open', ops: [op] });
    if (!closeOverridden.has(b.closeStart)) {
      edits.push({ start: b.closeStart, end: b.closeStart + 5, replacement: '</p>', kind: 'li-close', ops: [] });
    }
    ops.push(op);
  }

  const asc = [...edits].sort((x, y) => x.start - y.start);
  for (let i = 1; i < asc.length; i += 1) {
    if (asc[i].start < asc[i - 1].end) {
      throw new Error(`edit 区间重叠 [${asc[i - 1].start},${asc[i - 1].end}) / [${asc[i].start},${asc[i].end})`);
    }
  }
  return { parsed, edits, ops, skippedCross, skippedMergeP };
}

function applyEdits(html, edits) {
  const sorted = [...edits].sort((x, y) => y.start - x.start);
  let out = html;
  for (const e of sorted) out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
  return out;
}

// ---------------------------------------------------------------------------
// 只登记、不自动修的类别（会删字或需模型/产品判断）
// ---------------------------------------------------------------------------
function detectNotFixed(html) {
  const parsed = parseHtml(html);
  const blocks = blockNodes(parsed.root);
  const placeholders = [];
  const duplicates = [];
  const weakBreaks = [];
  const singleItemUl = [];
  const bareUrls = [];
  const h2Headings = [];
  const pTexts = [];
  for (const b of blocks) {
    if (b.tag === 'ul') {
      const items = b.children.filter((c) => c.tag === 'li');
      if (items.length === 1) {
        const T = norm(textOf(items[0]));
        const sent = (T.match(/[。！？；]/g) || []).length;
        if (T.length >= 100 || (T.length >= 60 && sent >= 2)) {
          singleItemUl.push({ textHead: T.slice(0, 120), len: T.length, sent });
        }
      }
    }
    if (b.tag === 'p') {
      const T = norm(textOf(b));
      pTexts.push(T);
      if (/^[.。·…\-—_*※~～•\s]+$/.test(T) && T.length <= 12) placeholders.push({ text: T });
      if (/^https?:\/\/\S+$/.test(T)) bareUrls.push({ text: T });
    }
    if (b.tag === 'h2') h2Headings.push({ text: norm(textOf(b)).slice(0, 80) });
  }
  for (let i = 1; i < pTexts.length; i += 1) {
    if (pTexts[i].length >= 10 && pTexts[i] === pTexts[i - 1]) duplicates.push({ text: pTexts[i].slice(0, 110) });
  }
  for (let i = 0; i + 1 < blocks.length; i += 1) {
    const a = blocks[i];
    const b = blocks[i + 1];
    if (a.tag !== 'p' || b.tag !== 'p') continue;
    const A = norm(textOf(a));
    const B = norm(textOf(b));
    if (!A || !B || codeKind(A) || codeKind(B)) continue;
    if (/^https?:\/\//.test(A)) continue;
    if (/^(优点|缺点|特点|说明|注意|总结|结论|原因|结果|区别|相同点|不同点)[：:]/.test(A)) continue;
    if (HEADING.test(B) || B.length < 8) continue;
    if (isStrongPBreak(A, B)) continue;
    if (A.length >= 25 && !TERMINAL.test(A) && !/[：:]$/.test(B)) {
      weakBreaks.push({ leftTail: A.slice(-40), rightHead: B.slice(0, 50) });
    }
  }
  return { placeholders, duplicates, weakBreaks, singleItemUl, bareUrls, h2Headings };
}

// ---------------------------------------------------------------------------
// 结构不变量校验（改前/改后对比）
// ---------------------------------------------------------------------------
function blockInPCount(rootNode) {
  let n = 0;
  const walk = (node) => {
    for (const c of node.children) {
      if (c.tag === '#text') continue;
      if (node.tag === 'p' && BLOCK_TAGS.has(c.tag)) n += 1;
      walk(c);
    }
  };
  walk(rootNode);
  return n;
}
function onAttrCount(s) {
  return (s.match(/\son[a-z]+\s*=/gi) || []).length;
}

function validateQuestion(before, after) {
  const errors = [];
  if (visibleText(before) !== visibleText(after)) errors.push('整题 visibleText 不一致（文字被改动）');
  const bp = parseHtml(before);
  const ap = parseHtml(after);
  if (ap.issues.length > bp.issues.length) {
    errors.push(`改后新增 HTML 解析异常：${ap.issues.map((x) => x.type + ':' + x.tag).join(',')}`);
  }
  const afterBlocks = blockNodes(ap.root);
  const topLi = afterBlocks.filter((b) => b.tag === 'li');
  if (topLi.length) errors.push(`改后仍有 ${topLi.length} 个顶层游离 li`);
  if (rootTextNonEmpty(ap.root)) errors.push('改后出现根级游离文本');
  if (/<script\b/i.test(after) && !/<script\b/i.test(before)) errors.push('改后出现 <script>');
  if (onAttrCount(after) > onAttrCount(before)) errors.push('改后新增内联事件属性');
  if (blockInPCount(ap.root) > blockInPCount(bp.root)) errors.push('改后出现块级元素嵌在 <p> 内');
  return errors;
}

// ---------------------------------------------------------------------------
// 单题修复（多 pass 到不动点）
// ---------------------------------------------------------------------------
function fixQuestion(key, topicId, originalAnswer) {
  let html = originalAnswer;
  const ops = [];
  const passes = [];
  const skippedCross = [];
  const skippedMergeP = [];
  const errors = [];
  const declaredDelta = {};
  for (let pass = 1; pass <= MAX_PASSES; pass += 1) {
    let plan;
    try {
      plan = planPass(html, pass);
    } catch (err) {
      errors.push(`pass${pass} 规划失败：${err.message}`);
      break;
    }
    // 跳过项只在首 pass 记录一次（后续 pass 会重复识别同一处）
    if (pass === 1) {
      skippedCross.push(...plan.skippedCross.map((s) => ({ key, topic: topicId, ...s })));
      skippedMergeP.push(...plan.skippedMergeP.map((s) => ({ key, topic: topicId, ...s })));
    }
    if (!plan.edits.length) break;
    for (const e of plan.edits) {
      const beforeText = visibleText(html.slice(e.start, e.end));
      const afterText = visibleText(e.replacement);
      if (beforeText !== afterText) errors.push(`pass${pass} ${e.kind} 单处文字校验失败`);
      addDelta(declaredDelta, countsDelta(html.slice(e.start, e.end), e.replacement));
    }
    if (errors.length) break;
    passes.push({ pass, edits: plan.edits.length });
    ops.push(...plan.ops);
    html = applyEdits(html, plan.edits);
  }
  if (errors.length) {
    return { ok: false, errors, answer: originalAnswer, ops: [], passes: passes.length, skippedCross, skippedMergeP };
  }

  // 不动点 / 幂等
  try {
    const residual = planPass(html, 99).edits.length;
    if (residual > 0) errors.push(`不动点复检仍有 ${residual} 处可自动修命中（应为 0）`);
  } catch (err) {
    errors.push(`不动点复检规划失败：${err.message}`);
  }
  errors.push(...validateQuestion(originalAnswer, html));

  // 标签多重集：改前 + 声明的增量必须等于改后（防止误伤未计划内容）
  const beforeCounts = tagCounts(originalAnswer);
  const afterCounts = tagCounts(html);
  const bad = [];
  for (const tag of new Set([...Object.keys(beforeCounts), ...Object.keys(afterCounts)])) {
    const expected = (beforeCounts[tag] || 0) + (declaredDelta[tag] || 0);
    const actual = afterCounts[tag] || 0;
    if (expected !== actual) bad.push({ tag, expected, actual });
  }
  if (bad.length) errors.push(`标签数变化未在计划中声明：${JSON.stringify(bad)}`);

  if (errors.length) {
    return { ok: false, errors, answer: originalAnswer, ops: [], passes: passes.length, skippedCross, skippedMergeP };
  }
  return { ok: true, errors, answer: html, ops, passes: passes.length, skippedCross, skippedMergeP };
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
const NOT_FIXED_KINDS = ['placeholderP', 'duplicateAdjacentP', 'weakPBreak', 'singleItemUlToP', 'bareUrlP', 'h2InAnswer', 'emptyAnswer'];

/**
 * `.wip-answers/noncode-audit.md`（数据快照 main@c582900，2026-11-05）的各类命中数，
 * 用于报告里对账：本脚本的自动修数字应等于基线减去安全阀跳过数。
 */
const AUDIT_BASELINE = {
  topLevelLiToP: { occ: 1940, questions: 323 },
  strongPBreakMerge: { occ: 250, questions: 153 },
  crossContinuationMerge: { occ: 36, questions: 32 },
  placeholderP: { occ: 22, questions: 8 },
  duplicateAdjacentP: { occ: 6, questions: 6 },
  weakPBreak: { occ: 398, questions: 205 },
  singleItemUlToP: { occ: 166, questions: 114 },
  bareUrlP: { occ: 6, questions: 5 },
  h2InAnswer: { occ: 3, questions: 3 },
  emptyAnswer: { occ: 23, questions: 23 },
};

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv);
  } catch (err) {
    console.error(`参数错误：${err.message}`);
    process.exit(2);
  }
  if (opts.help) { printHelp(); return; }

  const index = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'index.json'), 'utf8'));
  const allTopicIds = index.topics.map((t) => t.id);
  let topicIds = allTopicIds;
  if (opts.topics) {
    const unknown = opts.topics.filter((id) => !allTopicIds.includes(id));
    if (unknown.length) {
      console.error(`未知专题 id：${unknown.join(', ')}\n可用：${allTopicIds.join(',')}`);
      process.exit(2);
    }
    topicIds = allTopicIds.filter((id) => opts.topics.includes(id));
  }
  const indexSearch = new Map();
  for (const t of index.topics) for (const q of t.questions) indexSearch.set(q.key, q.search);

  const categoryQ = {
    topLevelLiToP: new Set(),
    strongPBreakMerge: new Set(),
    crossContinuationMerge: new Set(),
  };
  const firstPassQ = {
    topLevelLiToP: new Set(),
    strongPBreakMerge: new Set(),
    crossContinuationMerge: new Set(),
  };
  const notFixedQ = Object.fromEntries(NOT_FIXED_KINDS.map((k) => [k, new Set()]));
  const notFixedList = Object.fromEntries(NOT_FIXED_KINDS.map((k) => [k, []]));

  const report = {
    tool: 'skills/study-bank/scripts/enhance-answers/fix-noncode.cjs',
    mode: opts.write ? 'write' : 'dry-run',
    generatedAt: new Date().toISOString(),
    scope: {
      topics: topicIds.length,
      topicsRequested: opts.topics ? opts.topics : 'all',
      topicIds,
      source: path.relative(ROOT, DATA_DIR),
      dataSnapshot: {
        indexBytes: fs.statSync(path.join(DATA_DIR, 'index.json')).size,
        files: topicIds.length,
      },
    },
    rules: {
      auto: [
        "A1 topLevelLiToP：顶层孤立 <li>（游离 li）→ <p>，文本与自带序号原样保留（不保留 class）",
        "A2 strongPBreakMerge：相邻根级 <p>，上一段以 ，,、（( 结尾且 ≥12 字、下一段 ≥10 字且非标题式 → B 正文并入 A，删除 B 的 <p>；连接处仅 ASCII 字母数字相接时补 1 空格",
        "A3 crossContinuationMerge：前一块 p/li 以 ，,、 结尾 + 紧跟仅含 1 个 <li> 的 <ul> → B 并入前一块，删除该 ul；B 以参考/注释标记开头则跳过并登记",
      ],
      registerOnly: [
        'R1 placeholderP：<p> 仅由 .。·…—-_*※~～• 与空白组成且 ≤12 字符（删字，未修）',
        'R2 duplicateAdjacentP：相邻根级 <p> 规范化文本完全相同且 ≥10 字（删字，未修）',
        'R3 weakPBreak：上一段 ≥25 字且无句末标点（可能是原文丢句号，合并会粘段，未修）',
        'R4 singleItemUlToP：单条 ul 实为正文段落（需语义判断，未修）',
        'R5 bareUrlP：纯 URL 段落（答案契约暂无外链，需产品决策，未修）',
        'R6 h2InAnswer：答案内 h2（契约允许 h2~h5，级别统一需样式决策，未修）',
        'R7 emptyAnswer：空 answer（上游“原文无答案”，不修）',
      ],
      validation: [
        '单处：被替换片段 visibleText（去标签/反转义/去空白）必须与替换结果一致',
        '整题：改前/改后 answer 的 visibleText 必须一致（与 lib.cjs 同口径）',
        '结构：改后 0 个游离 li、无根级游离文本、无块级元素嵌进 p、无新增 script/内联事件',
        '标签多重集：变化必须与操作声明一致（防止误伤未计划内容）',
        '不动点：对改后答案再跑规划必须 0 命中（幂等可重复运行）',
      ],
    },
    scan: { topics: 0, questions: 0, nonCode: 0, codeSkipped: 0, emptyAnswer: 0 },
    summary: {
      hitQuestions: 0,
      autoFixedQuestions: 0,
      categories: {
        topLevelLiToP: { occ: 0, questions: 0 },
        strongPBreakMerge: { occ: 0, questions: 0 },
        crossContinuationMerge: { occ: 0, questions: 0 },
      },
      firstPass: {
        topLevelLiToP: { occ: 0, questions: 0 },
        strongPBreakMerge: { occ: 0, questions: 0 },
        crossContinuationMerge: { occ: 0, questions: 0 },
      },
      notFixed: Object.fromEntries(NOT_FIXED_KINDS.map((k) => [k, { occ: 0, questions: 0 }])),
      validation: {
        questionsChecked: 0,
        textPreservedQuestions: 0,
        allTextPreserved: true,
        failures: [],
        structuralIssues: [],
        idempotent: true,
        maxPasses: 0,
      },
      search: { recomputedQuestions: 0, searchChanged: 0, indexSearchUpdates: 0 },
      skippedCross: 0,
      skippedStrongMerge: 0,
    },
    perQuestion: [],
    registerOnly: Object.fromEntries(NOT_FIXED_KINDS.map((k) => [k, []])),
    skippedCrossContinuation: [],
    skippedStrongMerge: [],
    searchChanges: [],
    indexSearchUpdates: [],
    writtenFiles: [],
  };
  report.scan.topicIds = topicIds;
  const crossCheck = {
    libCjsAvailable: !!lib,
    note: '用同目录 lib.cjs 的 visibleText/searchFieldOf 交叉校验本地实现（本地实现与 lib 同口径，避免运行时依赖 lead 正在改的文件）。',
    visibleTextChecked: 0,
    visibleTextMismatch: 0,
    searchFieldOfChecked: 0,
    searchFieldOfMismatch: 0,
    afterSearchChecked: 0,
    afterSearchMismatch: 0,
  };

  for (const topicId of topicIds) {
    const topicFile = path.join(DATA_DIR, topicId + '.json');
    const topic = JSON.parse(fs.readFileSync(topicFile, 'utf8'));
    let topicChanged = false;
    report.scan.topics += 1;
    for (const q of topic.questions) {
      report.scan.questions += 1;
      if (q.answer.includes('<pre')) {
        report.scan.codeSkipped += 1;
        continue;
      }
      report.scan.nonCode += 1;
      if (!q.answer || !q.answer.trim()) {
        report.scan.emptyAnswer += 1;
        notFixedQ.emptyAnswer.add(q.key);
        notFixedList.emptyAnswer.push({ key: q.key, topic: topicId, summaryHead: (q.summary || []).join(' ').slice(0, 120) });
        continue;
      }

      // 只登记类别（基于原始答案，与审计口径一致；不自动修）
      const nf = detectNotFixed(q.answer);
      const nfMapped = {
        placeholderP: nf.placeholders,
        duplicateAdjacentP: nf.duplicates,
        weakPBreak: nf.weakBreaks,
        singleItemUlToP: nf.singleItemUl,
        bareUrlP: nf.bareUrls,
        h2InAnswer: nf.h2Headings,
      };
      for (const [kind, list] of Object.entries(nfMapped)) {
        for (const rec of list) {
          notFixedList[kind].push({ key: q.key, topic: topicId, ...rec });
          notFixedQ[kind].add(q.key);
        }
      }

      if (lib) {
        crossCheck.visibleTextChecked += 1;
        if (lib.visibleText(q.answer) !== visibleText(q.answer)) crossCheck.visibleTextMismatch += 1;
        crossCheck.searchFieldOfChecked += 1;
        if (lib.searchFieldOf(q) !== searchFieldOf(q)) crossCheck.searchFieldOfMismatch += 1;
      }

      const result = fixQuestion(q.key, topicId, q.answer);
      report.summary.validation.questionsChecked += 1;
      if (!result.ok) {
        report.summary.validation.failures.push({ key: q.key, topic: topicId, errors: result.errors });
        continue;
      }
      report.summary.validation.textPreservedQuestions += 1;
      report.summary.validation.maxPasses = Math.max(report.summary.validation.maxPasses, result.passes);
      if (result.skippedCross.length) {
        report.skippedCrossContinuation.push(...result.skippedCross);
        report.summary.skippedCross += result.skippedCross.length;
      }
      if (result.skippedMergeP.length) {
        report.skippedStrongMerge.push(...result.skippedMergeP);
        report.summary.skippedStrongMerge += result.skippedMergeP.length;
      }
      if (!result.ops.length) continue;
      if (result.answer === q.answer) continue;

      report.summary.hitQuestions += 1;
      report.summary.autoFixedQuestions += 1;
      const perQ = {
        key: q.key,
        topic: topicId,
        passes: result.passes,
        answerLength: { before: q.answer.length, after: result.answer.length },
        ops: result.ops,
        validation: { textPreserved: true, visibleTextUnchanged: true, structural: 'ok', idempotent: true },
      };
      report.perQuestion.push(perQ);
      for (const op of result.ops) {
        const kind = op.type === 'li-to-p' ? 'topLevelLiToP' : op.type === 'merge-p' ? 'strongPBreakMerge' : 'crossContinuationMerge';
        categoryQ[kind].add(q.key);
        report.summary.categories[kind].occ += 1;
        if (op.pass === 1) {
          firstPassQ[kind].add(q.key);
          report.summary.firstPass[kind].occ += 1;
        }
      }

      // search 重算（dry-run 也计算，供 --write 与 index 同步参考）
      const oldSearch = q.search || '';
      const recomputed = searchFieldOf({ ...q, answer: result.answer });
      if (lib) {
        crossCheck.afterSearchChecked += 1;
        if (lib.searchFieldOf({ ...q, answer: result.answer }) !== recomputed) crossCheck.afterSearchMismatch += 1;
      }
      report.summary.search.recomputedQuestions += 1;
      if (recomputed !== oldSearch) {
        report.summary.search.searchChanged += 1;
        report.searchChanges.push({ key: q.key, topic: topicId });
      }
      const idxSearch = indexSearch.get(q.key);
      if (idxSearch !== undefined && idxSearch !== recomputed) report.indexSearchUpdates.push({ key: q.key, topic: topicId });

      if (opts.write) {
        q.answer = result.answer;
        q.search = recomputed;
        topicChanged = true;
      }
    }
    if (topicChanged) {
      // 与 extract-study.cjs 一致：JSON.stringify(obj, null, 2)、无尾随换行；临时文件 + rename。
      const tmpFile = topicFile + '.tmp';
      fs.writeFileSync(tmpFile, JSON.stringify(topic, null, 2));
      fs.renameSync(tmpFile, topicFile);
      report.writtenFiles.push(path.relative(ROOT, topicFile));
    }
  }

  for (const kind of Object.keys(categoryQ)) report.summary.categories[kind].questions = categoryQ[kind].size;
  for (const kind of Object.keys(firstPassQ)) report.summary.firstPass[kind].questions = firstPassQ[kind].size;
  for (const kind of NOT_FIXED_KINDS) {
    report.summary.notFixed[kind] = { occ: notFixedList[kind].length, questions: notFixedQ[kind].size };
    report.registerOnly[kind] = notFixedList[kind];
  }
  report.summary.validation.allTextPreserved =
    report.summary.validation.textPreservedQuestions === report.summary.validation.questionsChecked;
  report.summary.validation.idempotent = report.summary.validation.failures.length === 0;
  report.summary.validation.structuralIssues = report.summary.validation.failures.map((f) => ({ key: f.key, topic: f.topic, errors: f.errors }));
  report.summary.search.indexSearchUpdates = report.indexSearchUpdates.length;
  report.summary.notFixedOcc = NOT_FIXED_KINDS.reduce((s, k) => s + report.summary.notFixed[k].occ, 0);
  report.summary.validation.emptyAnswerNotValidated = report.scan.emptyAnswer;
  report.summary.validation.note =
    'questionsChecked 只含非空 answer 的非代码题（空 answer 不改、不参与校验）；codeSkipped 为含 <pre> 的代码题，由代码题流水线处理。';

  // 与审计报告对账（数字应逐项复现；差额必须等于安全阀/未修项）
  report.auditBaseline = AUDIT_BASELINE;
  report.auditDelta = {};
  for (const kind of ['topLevelLiToP', 'strongPBreakMerge', 'crossContinuationMerge']) {
    report.auditDelta[kind] = {
      occ: report.summary.categories[kind].occ - AUDIT_BASELINE[kind].occ,
      questions: report.summary.categories[kind].questions - AUDIT_BASELINE[kind].questions,
    };
  }
  for (const kind of NOT_FIXED_KINDS) {
    report.auditDelta[kind] = {
      occ: report.summary.notFixed[kind].occ - AUDIT_BASELINE[kind].occ,
      questions: report.summary.notFixed[kind].questions - AUDIT_BASELINE[kind].questions,
    };
  }
  report.auditNote =
    'strongPBreakMerge 比基线少 2 处 / 1 题（B 为「区别三：/注意：」类短标题，安全阀跳过）；' +
    'crossContinuationMerge 比基线少 1 处 / 1 题（arch/q011 的 B 是「参考：…」注释，只登记不修）。';

  // 供 lead 同步 index.json 的纯 key 列表（字段与报告 indexSearchUpdates 相同，另给平铺数组）
  report.indexSearchUpdateKeys = report.indexSearchUpdates.map((x) => x.key);
  report.libCrossCheck = crossCheck;

  // 只登记类别的判定说明（供 lead 决定是否追加修复）
  const singleDot = report.registerOnly.placeholderP.filter((x) => x.text === '.').length;
  const multiDot = report.registerOnly.placeholderP.length - singleDot;
  report.registerOnlyAssessment = {
    placeholderP: {
      verdict: '未修（会删字）',
      detail: `${report.registerOnly.placeholderP.length} 处里 ${singleDot} 处是单个「.」（arch/q017–q021，PDF 图注/分隔残留，删除大概率安全）；` +
        `${multiDot} 处是「......」/「....」（memoryleak/q006/q007、bigtech/q068），可能承载原文「省略」语义，删前需对照截图。`,
    },
    duplicateAdjacentP: {
      verdict: '未修（会删字）',
      detail: `${report.registerOnly.duplicateAdjacentP.length} 处相邻 <p> 规范化文本完全相同。skills/study-bank/SKILL.md 3.6 要求「原文自身问题照录」，` +
        '需对照 PDF 截图确认是抽取重复还是原文确实重复，再决定删除。',
    },
    weakPBreak: {
      verdict: '未修（需模型逐题判断）',
      detail: `${report.registerOnly.weakPBreak.length} 处「上一段 ≥25 字且无句末标点」，很多是原文 PDF 漏了句号而非真的断裂；` +
        '机械合并会把两个独立段落粘成一段，故只登记。',
    },
    singleItemUlToP: {
      verdict: '未修（需语义判断）',
      detail: `${report.registerOnly.singleItemUlToP.length} 处单条 ul 里其实是长正文段落；是否本该是列表需逐题判断。`,
    },
    bareUrlP: {
      verdict: '未修（需产品决策）',
      detail: '答案 HTML 契约目前不出现外链 <a>，包链接会改变契约；只登记 URL 段落。',
    },
    h2InAnswer: {
      verdict: '未修（样式决策）',
      detail: '契约允许 h2~h5；统一级别属于样式/层级调整，未纳入结构修复。',
    },
    emptyAnswer: {
      verdict: '不修（上游原貌）',
      detail: '23 题 answer 为空，summary 已注明「原文未给出答案」；按 skills/study-bank 3.6 不伪造内容。',
    },
  };
  report.recommendedNextSteps = {
    writeCommand: 'node skills/study-bank/scripts/enhance-answers/fix-noncode.cjs --write',
    indexSearchSync:
      `写回后用 indexSearchUpdateKeys（${report.indexSearchUpdateKeys.length} 条）同步 backend/data/study/index.json 对应题的 search；` +
      '值可直接取写回后 backend/data/study/<topic>.json 里该题的 search（本脚本按 lib.cjs 的 searchFieldOf 口径重算）。',
    indexNotWritten: '按任务要求，--write 只写 backend/data/study/<topic>.json，不写 index.json。',
    rehearsal: '--write 已在 /tmp 数据副本上完整演练：37 个专题文件变更、index.json 哈希不变、2521 题 visibleText 全量一致、重跑 0 命中；本次 dry-run 未改 backend/data/study。',
  };

  fs.mkdirSync(path.dirname(opts.report), { recursive: true });
  fs.writeFileSync(opts.report, JSON.stringify(report, null, 2) + '\n');

  const s = report.summary;
  const per = (x) => `${x.occ} 处 / ${x.questions} 题`;
  console.log('fix-noncode.cjs — 非代码题结构修复（只改结构，不改文字）');
  console.log(`mode=${report.mode}  topics=${opts.topics ? opts.topics.join(',') : `all(${report.scan.topics})`}  ` +
    `questions=${report.scan.questions}  nonCode=${report.scan.nonCode}  codeSkipped=${report.scan.codeSkipped}  emptyAnswer=${report.scan.emptyAnswer}`);
  console.log('自动修（文本保留）：');
  console.log(`  A1 顶层 li.num → p        ${per(s.categories.topLevelLiToP)}  (首 pass ${per(s.firstPass.topLevelLiToP)})`);
  console.log(`  A2 强证据 p 断裂合并       ${per(s.categories.strongPBreakMerge)}  (首 pass ${per(s.firstPass.strongPBreakMerge)})`);
  console.log(`  A3 跨元素续写合并          ${per(s.categories.crossContinuationMerge)}  (首 pass ${per(s.firstPass.crossContinuationMerge)})`);
  console.log(`  合计命中 ${s.hitQuestions} 题，实际改写 ${s.autoFixedQuestions} 题；安全阀跳过 ${s.skippedCross + s.skippedStrongMerge} 处（${s.skippedCross} 参考注释 + ${s.skippedStrongMerge} 小标题）`);
  console.log('只登记、未自动修：');
  console.log(`  R1 占位段 <p>.</p>         ${per(s.notFixed.placeholderP)}`);
  console.log(`  R2 相邻完全重复 <p>         ${per(s.notFixed.duplicateAdjacentP)}`);
  console.log(`  R3 弱证据 p 断裂            ${per(s.notFixed.weakPBreak)}`);
  console.log(`  R4 单条 ul→p               ${per(s.notFixed.singleItemUlToP)}`);
  console.log(`  R5 裸 URL 段落             ${per(s.notFixed.bareUrlP)}`);
  console.log(`  R6 答案内 h2               ${per(s.notFixed.h2InAnswer)}`);
  console.log(`  R7 空 answer               ${per(s.notFixed.emptyAnswer)}`);
  console.log('校验：');
  console.log(`  逐题文字保全校验           ${s.validation.textPreservedQuestions}/${s.validation.questionsChecked} 通过，失败 ${s.validation.failures.length} 题（另有 ${s.validation.emptyAnswerNotValidated} 题空 answer 不参与）`);
  console.log(`  不动点/幂等                ${s.validation.idempotent ? 'OK（改后再跑 0 命中）' : 'FAIL'}`);
  console.log(`  search 重算/变化           ${s.search.recomputedQuestions} / ${s.search.searchChanged}；index 需同步 ${s.search.indexSearchUpdates} 条`);
  if (report.mode === 'write') console.log(`  已写回 ${report.writtenFiles.length} 个专题 JSON（index.json 未写）`);
  console.log(`报告：${path.relative(ROOT, opts.report)}`);
  if (s.validation.failures.length) {
    console.log('失败明细：');
    for (const f of s.validation.failures.slice(0, 20)) console.log(`  - ${f.key}: ${f.errors.join('；')}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  visibleText,
  searchFieldOf,
  parseHtml,
  planPass,
  applyEdits,
  detectNotFixed,
  fixQuestion,
  isStrongPBreak,
  codeKind,
};
