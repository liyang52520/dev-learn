'use strict';

/**
 * 用上游 PDF 行数据把题库答案里的代码块还原成「逐行 + 缩进」的干净文本。
 *
 * 输出（都写到 .wip-answers/，不直接碰 backend/data/study）：
 *   draft/<topicId>.json    答案已重建的专题 JSON（结构同 backend/data/study/<topicId>.json）
 *   units/<topicId>/<qid>.json  给大模型审阅的紧凑工作单元
 *   report.json             统计与异常样本
 *
 * 只做「确定性的格式还原」：代码行来自上游 lines.json（每行原文），所以文字无损；
 * 模型只负责语言标注、可疑的合并/拆分和少量换行修正。
 *
 * 用法：
 *   node skills/study-bank/scripts/enhance-answers/reconstruct.cjs [--topics=jvm,spring] [--limit=5]
 */

const path = require('node:path');
const crypto = require('node:crypto');
const lib = require('./lib.cjs');

const args = process.argv.slice(2);
function argValue(name) {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const wantedTopics = argValue('topics') ? new Set(argValue('topics').split(',').map((s) => s.trim()).filter(Boolean)) : null;
const limitPerTopic = argValue('limit') ? Number(argValue('limit')) : 0;

const fidelity = {};

const report = {
  generatedAt: new Date().toISOString(),
  topics: {},
  totals: {
    codeQuestions: 0,
    codeBlocks: 0,
    matched: 0,
    unmatched: 0,
    mergedFragments: 0,
    mixedBlocks: 0,
    demotedBlocks: 0,
    wrappedBlocks: 0,
    gutterLines: 0,
    invalid: 0,
  },
  unmatchedSamples: [],
  mixedSamples: [],
  invalidSamples: [],
  fontSamples: {},
};

function main() {
  const index = lib.loadTopicIndex();
  const siteTopics = lib.loadSiteTopics();
  const topicIds = index.topics.map((topic) => topic.id).filter((id) => !wantedTopics || wantedTopics.has(id));

  for (const topicId of topicIds) {
    const topic = lib.readJson(path.join(lib.DATA_DIR, `${topicId}.json`));
    if (!siteTopics.has(topicId)) throw new Error(`上游 site.json 找不到专题 ${topicId}`);
    const { pages } = lib.loadPages(topicId);

    const stats = { codeQuestions: 0, codeBlocks: 0, matched: 0, unmatched: 0, mergedFragments: 0, mixedBlocks: 0, demotedBlocks: 0, wrappedBlocks: 0, gutterLines: 0, invalid: 0 };
    const draft = { ...topic, questions: topic.questions.map((question) => ({ ...question })) };
    const unitDir = path.join(lib.WIP_DIR, 'units', topicId);
    lib.ensureDir(unitDir);
    let processed = 0;

    for (let qi = 0; qi < draft.questions.length; qi += 1) {
      const question = draft.questions[qi];
      const original = question.answer || '';
      if (!original.includes('<pre')) continue;
      if (limitPerTopic && processed >= limitPerTopic) break;
      processed += 1;
      stats.codeQuestions += 1;
      report.totals.codeQuestions += 1;

      try {
        const result = reconstructQuestion(question, pages);
        stats.codeBlocks += result.codeBlocks;
        stats.matched += result.matched;
        stats.unmatched += result.unmatched;
        stats.mergedFragments += result.mergedFragments;
        stats.mixedBlocks += result.mixedBlocks;
        stats.demotedBlocks += result.demotedBlocks;
        stats.wrappedBlocks += result.wrappedBlocks;
        stats.gutterLines += result.summary.gutterLines;
        for (const key of ['matched', 'unmatched', 'mergedFragments', 'mixedBlocks', 'demotedBlocks', 'wrappedBlocks', 'codeBlocks']) {
          report.totals[key] += result[key];
        }
        report.totals.gutterLines += result.summary.gutterLines;

        const rebuilt = lib.renderBlocks(result.blocks);
        const expected = expectedVisible(result.blocksBefore, result.matchInfo);
        if (lib.visibleText(rebuilt) !== expected) {
          stats.invalid += 1;
          report.totals.invalid += 1;
          report.invalidSamples.push({ key: question.key, title: question.title, diff: firstDiff(lib.visibleText(rebuilt), expected) });
          // 保底：校验失败时保留原答案，避免把坏数据写进 draft。
          question.answer = original;
          question.__enhance = { invalid: true, flags: result.flags };
        } else {
          question.answer = rebuilt;
          question.__enhance = { flags: result.flags, stats: result.summary };
          fidelity[question.key] = {
            expected: sha256(expected),
            matched: true,
            gutterLines: result.summary.gutterLines || 0,
          };
        }

        if (result.unmatched) {
          report.unmatchedSamples.push({ key: question.key, title: question.title, count: result.unmatched });
        }
        if (result.mixedBlocks) {
          report.mixedSamples.push({ key: question.key, title: question.title, count: result.mixedBlocks });
        }
        lib.writeJson(path.join(unitDir, `${question.id}.json`), buildUnit(question, result));
      } catch (error) {
        stats.invalid += 1;
        report.totals.invalid += 1;
        report.invalidSamples.push({ key: question.key, title: question.title, error: String(error && error.message ? error.message : error) });
        question.answer = original;
      }
    }

    for (const question of draft.questions) {
      if (fidelity[question.key]) continue;
      const hash = sha256(lib.visibleText(question.answer || ''));
      fidelity[question.key] = { expected: hash, matched: false };
    }

    report.topics[topicId] = stats;
    lib.writeJson(path.join(lib.WIP_DIR, 'draft', `${topicId}.json`), draft);
    process.stdout.write(`${topicId}: ${stats.codeQuestions} 题 / ${stats.matched}/${stats.codeBlocks} 块匹配 / 合并 ${stats.mergedFragments} / 混合 ${stats.mixedBlocks} / 异常 ${stats.invalid}\n`);
  }

  lib.writeJson(path.join(lib.WIP_DIR, 'reconstruct-report.json'), report);
  lib.writeJson(lib.FIDELITY_FILE, fidelity);
  console.log('totals', JSON.stringify(report.totals));
}

function reconstructQuestion(question, pages) {
  const original = question.answer || '';
  const range = pageRangeOf(question);
  const blocks = lib.parseBlocks(original);
  const items = [];
  const matchInfo = new Map();
  let cursor = { page: range.minPage, index: 0 };
  const summary = { codeBlocks: 0, matched: 0, unmatched: 0, mergedFragments: 0, mixedBlocks: 0, demotedBlocks: 0, wrappedBlocks: 0, gutterLines: 0, codeItems: 0 };
  const flags = [];

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex];
    if (block.type !== 'pre') {
      items.push({ block, code: null });
      continue;
    }
    summary.codeBlocks += 1;
    const match = lib.matchRun(block.text, pages, range, cursor);
    if (!match) {
      items.push({ block, code: null, unmatched: true });
      summary.unmatched += 1;
      continue;
    }
    summary.matched += 1;
    const lines = linesOf(pages, match);
    cursor = lib.posAfter({ page: match.page, index: match.end });
    rememberFonts(lines);

    // 编辑器行号槽：从输出里剔除；同时从原始 `.cl` 行里删掉，保证文字校验自洽。
    const codeBase = lib.baseXOfLines(lines);
    const gutterLines = lines.filter(
      (line) => lib.isCodeGutterLine(line, codeBase) || lib.isGutterLine(line, pages.get(line.page)),
    );
    const gutterTexts = gutterLines.map((line) => String(line.text || '').trim());
    const clLines = lib.clLinesOfPre(innerOfPre(block.html));
    const alignment = gutterTexts.length ? alignGutterLines(clLines, gutterTexts) : { ok: true, kept: clLines };
    if (!alignment.ok) {
      flags.push(`gutter-align-failed:${question.id}`);
      summary.invalid = (summary.invalid || 0) + 1;
    }
    if (gutterTexts.length) summary.gutterLines += gutterTexts.length;
    matchInfo.set(blockIndex, {
      keptLines: alignment.kept,
      gutterTexts,
      keepGutters: gutterTexts.length > 0 && !alignment.ok,
    });
    items.push({
      block,
      code: {
        lines,
        baseX0: codeBase,
        match,
        flags: [],
        pageLines: pages,
        gutterKeys: new Set(gutterLines.map((line) => `${line.page}:${line.index}`)),
        keepGutters: gutterTexts.length > 0 && !alignment.ok,
      },
    });
  }

  // 合并被误分类成列表/段落的代码行（例如中文注释行被渲染成 <li>）。
  mergeFragments(items, pages, range, summary);

  // 合并相邻代码块（中间没有任何内容）。
  mergeAdjacentCodeItems(items, summary);

  const finalBlocks = [];
  for (const item of items) {
    if (item.removed) continue;
    if (item.code) {
      const detail = splitCodeItem(item.code);
      for (const part of detail.parts) {
        if (part.type === 'code') {
          if (lib.looksLikeWrapped(part.lines)) {
            summary.wrappedBlocks += 1;
            part.flags.push('wrapped');
          }
          finalBlocks.push({
            type: 'code',
            code: part.text,
            lang: lib.guessLang(part.text),
            flags: part.flags,
          });
        } else {
          finalBlocks.push({ type: 'p', html: `<p>${lib.escapeHtml(part.text)}</p>`, text: part.text, flags: ['demoted-from-code'] });
        }
      }
      if (detail.mixed) summary.mixedBlocks += 1;
      if (detail.demoted) summary.demotedBlocks += 1;
      if (detail.flags.length) flags.push(...detail.flags);
    } else if (item.block.type === 'pre') {
      finalBlocks.push({
        type: 'code',
        code: item.block.text,
        lang: lib.guessLang(item.block.text),
        flags: ['unmatched'],
      });
      flags.push(`unmatched:${summarizeText(item.block.text)}`);
    } else {
      finalBlocks.push(item.block);
    }
  }

  // 把「疑似代码片段但没能自动合并」的提示挂到对应块上，供模型判断。
  for (const item of items) {
    if (!item.hintLabels || !item.hintLabels.length) continue;
    const index = finalBlocks.indexOf(item.block);
    if (index >= 0) {
      const block = finalBlocks[index];
      block.flags = (block.flags || []).concat(item.hintLabels);
    }
  }

  if (summary.unmatched) flags.push(`unmatched-blocks:${summary.unmatched}`);
  if (summary.mergedFragments) flags.push(`merged-fragments:${summary.mergedFragments}`);
  if (summary.mixedBlocks) flags.push(`mixed-blocks:${summary.mixedBlocks}`);
  if (summary.gutterLines) flags.push(`gutter-lines:${summary.gutterLines}`);

  return {
    blocks: finalBlocks,
    flags,
    summary,
    matchInfo,
    blocksBefore: blocks,
    original,
    codeBlocks: summary.codeBlocks,
    matched: summary.matched,
    unmatched: summary.unmatched,
    mergedFragments: summary.mergedFragments,
    mixedBlocks: summary.mixedBlocks,
    demotedBlocks: summary.demotedBlocks,
    wrappedBlocks: summary.wrappedBlocks,
  };
}

function innerOfPre(html) {
  return String(html).replace(/^<pre[^>]*>/, '').replace(/<\/pre>$/, '');
}

/**
 * 从上游 `.cl` 行里删掉行号行。优先按数量一一对应；数量不一致时按行号文本顺序对齐。
 * 返回 {ok, kept}；对齐失败时保留行号（并让上层记录异常），避免误删代码。
 */
function alignGutterLines(clLines, gutterTexts) {
  if (!clLines || !gutterTexts.length) return { ok: true, kept: clLines };
  const kept = [];
  let g = 0;
  for (const line of clLines) {
    if (g < gutterTexts.length && String(line).trim() === gutterTexts[g]) {
      g += 1;
      continue;
    }
    kept.push(line);
  }
  if (g !== gutterTexts.length) return { ok: false, kept: clLines };
  return { ok: true, kept };
}

/** 原始答案在剔除行号后的期望可见文字（用于逐字校验）。 */
function blockText(block) {
  if (block.type === 'ul') return (block.items || []).map((item) => item.text || '').join('');
  return block.text || '';
}

function expectedVisible(blocks, matchInfo) {
  let out = '';
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    const info = matchInfo.get(i);
    if (block.type === 'pre' && info ) {
      const text = info.keepGutters || !info.keptLines ? block.text : info.keptLines.join('\n');
      out += lib.normalizedKey(text);
    } else {
      out += lib.normalizedKey(blockText(block));
    }
  }
  return out;
}


function pageRangeOf(question) {
  const pages = [...lib.pagesOfQuestion(question)];
  if (!pages.length) throw new Error('题目没有 evidence 页码');
  return { minPage: Math.min(...pages), maxPage: Math.max(...pages) };
}

function linesOf(pages, match) {
  const pageLines = pages.get(match.page);
  const out = [];
  for (let i = match.start; i <= match.end; i += 1) {
    out.push({ ...pageLines[i], page: match.page, index: i });
  }
  return out;
}

function rememberFonts(lines) {
  for (const line of lines) {
    const key = `${line.font}@${line.size}`;
    report.fontSamples[key] = (report.fontSamples[key] || 0) + 1;
  }
}

function splitCodeItem(code) {
  const parts = [];
  const flags = [];
  let current = null;
  const lines = code.keepGutters
    ? code.lines
    : code.lines.filter((line) => !code.gutterKeys.has(`${line.page}:${line.index}`));
  for (const line of lines) {
    const isCode = lib.isCodeLine(line, code.baseX0);
    if (!current || current.type !== (isCode ? 'code' : 'prose')) {
      current = isCode
        ? { type: 'code', lines: [], flags: [] }
        : { type: 'prose', text: '' };
      parts.push(current);
    }
    if (isCode) {
      current.lines.push(line);
    } else {
      current.text = lib.joinText(current.text, String(line.text || '').trim());
    }
  }
  const normalized = [];
  for (const part of parts) {
    if (part.type === 'code') {
      const mergedLines = lib.mergeWrappedLines(part.lines);
      if (mergedLines.some((line) => line.joinedWrap)) part.flags.push('joined-wrap');
      if (code.flags.includes('merged-fragment')) part.flags.push('merged-fragment');
      const text = mergedLines.map((line) => String(line.text || '').replace(/\s+$/, '')).join('\n');
      if (!text.trim()) continue;
      normalized.push({ type: 'code', text, lines: mergedLines, flags: part.flags });
    } else if (part.text.trim()) {
      normalized.push({ type: 'prose', text: part.text.trim() });
    }
  }
  const hasCode = normalized.some((part) => part.type === 'code');
  const hasProse = normalized.some((part) => part.type === 'prose');
  if (hasProse) flags.push('prose-inside-code');
  return {
    parts: normalized,
    mixed: hasCode && hasProse,
    demoted: !hasCode && hasProse,
    flags,
  };
}

// ---------------------------------------------------------------------------
// 片段合并：代码 —（被误分类的列表/段落）— 代码
// ---------------------------------------------------------------------------

function mergeFragments(items, pages, range, summary) {
  let merged = true;
  while (merged) {
    merged = false;
    const codeIndexes = [];
    for (let i = 0; i < items.length; i += 1) {
      if (!items[i].removed && items[i].code) codeIndexes.push(i);
    }
    for (let k = 0; k + 1 < codeIndexes.length; k += 1) {
      const leftIndex = codeIndexes[k];
      const rightIndex = codeIndexes[k + 1];
      if (rightIndex - leftIndex <= 1) continue; // 相邻代码块交给 mergeAdjacentCodeItems
      const gap = items.slice(leftIndex + 1, rightIndex).filter((item) => !item.removed);
      if (!gap.length) continue;
      const left = items[leftIndex].code;
      const right = items[rightIndex].code;
      const lastLeft = left.lines[left.lines.length - 1];
      const firstRight = right.lines[0];
      const from = lib.posAfter({ page: lastLeft.page, index: lastLeft.index });
      const to = { page: firstRight.page, index: firstRight.index };
      if (lib.comparePos(from, to) > 0) continue;

      const gapLines = [];
      let matchedAll = true;
      let position = from;
      for (const item of gap) {
        const fragments = fragmentsOf(item.block);
        if (!fragments) {
          matchedAll = false;
          break;
        }
        for (const fragment of fragments) {
          const hit = lib.matchRunBetween(fragment.text, pages, position, to);
          if (!hit) {
            matchedAll = false;
            break;
          }
          const lines = linesOf(pages, hit);
          const codeLike = lines.every((line) => lib.isCodeLine(line, left.baseX0) || lib.isCodeLine(line, right.baseX0));
          if (!codeLike) {
            matchedAll = false;
            break;
          }
          gapLines.push(...lines);
          position = lib.posAfter({ page: hit.page, index: hit.end });
        }
        if (!matchedAll) break;
      }
      if (!matchedAll || !gapLines.length) {
        // 记下“疑似代码片段”的提示，交给模型判断。
        for (const item of gap) {
          const fragmentText = plainTextOfBlock(item.block);
          if (fragmentText && looksCodeLike(fragmentText)) {
            item.hintLabels = (item.hintLabels || []).concat('code-like-between-code');
          }
        }
        continue;
      }

      const combined = [...left.lines, ...gapLines, ...right.lines].sort((a, b) => a.page - b.page || a.index - b.index);
      items[leftIndex].code = {
        lines: combined,
        baseX0: left.baseX0,
        match: left.match,
        flags: [...left.flags, 'merged-fragment'],
        pageLines: left.pageLines,
        gutterKeys: new Set([...left.gutterKeys, ...right.gutterKeys]),
        keepGutters: left.keepGutters || right.keepGutters,
      };
      for (const item of gap) markRemoved(item);
      items[rightIndex].removed = true;
      summary.mergedFragments += 1;
      merged = true;
      break;
    }
  }
}

function mergeAdjacentCodeItems(items, summary) {
  let changed = true;
  while (changed) {
    changed = false;
    const codeIndexes = [];
    for (let i = 0; i < items.length; i += 1) {
      if (!items[i].removed && items[i].code) codeIndexes.push(i);
    }
    for (let k = 0; k + 1 < codeIndexes.length; k += 1) {
      const left = codeIndexes[k];
      const right = codeIndexes[k + 1];
      if (right - left !== 1) continue;
      const a = items[left].code;
      const b = items[right].code;
      items[left].code = {
        lines: [...a.lines, ...b.lines].sort((x, y) => x.page - y.page || x.index - y.index),
        baseX0: a.baseX0,
        match: a.match,
        flags: [...a.flags, 'merged-fragment'],
        pageLines: a.pageLines,
        gutterKeys: new Set([...a.gutterKeys, ...b.gutterKeys]),
        keepGutters: a.keepGutters || b.keepGutters,
      };
      items[right].removed = true;
      summary.mergedFragments += 1;
      changed = true;
      break;
    }
  }
}

function markRemoved(item) {
  item.removed = true;
  if (item.block.type === 'ul') {
    for (const sub of item.block.items || []) sub.removed = true;
  }
}

function fragmentsOf(block) {
  if (block.type === 'ul') {
    const items = (block.items || []).filter((item) => item.text && item.text.trim());
    if (!items.length) return [];
    return items.map((item) => ({ text: item.text }));
  }
  if ((block.type === 'li' || block.type === 'p') && block.text && block.text.trim()) {
    return [{ text: block.text }];
  }
  return null;
}

function plainTextOfBlock(block) {
  if (block.type === 'ul') return (block.items || []).map((item) => item.text).join(' ');
  return block.text || '';
}

function looksCodeLike(text) {
  const value = String(text).trim();
  if (!value || value.length > 400) return false;
  if (/^\/\//.test(value)) return true;
  if (/[;{}]\s*$/.test(value) && /[=(){}[\];]/.test(value)) return true;
  if (/^\s*(public|private|protected|static|final|class|interface|if|for|while|return|import|package|try|catch|new|void|int|long|String|boolean|exec|echo|select|update|delete|insert|create|alter)\b/i.test(value)) return true;
  if (/^-[a-zA-Z]/.test(value)) return true;
  return false;
}

function summarizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').slice(0, 80);
}

function buildUnit(question, result) {
  const blocks = result.blocks.map((block, id) => {
    if (block.type === 'code') {
      return {
        id,
        type: 'code',
        lang: block.lang,
        text: block.code,
        flags: block.flags || [],
      };
    }
    if (block.type === 'ul') {
      return {
        id,
        type: 'ul',
        items: (block.items || []).map((item) => ({ text: item.text })),
        flags: block.flags || [],
      };
    }
    if (block.type === 'figure') return { id, type: 'figure' };
    if (block.type === 'table') return { id, type: 'table', text: String(block.text || '').slice(0, 400) };
    if (block.type === 'heading') return { id, type: 'heading', text: block.text || '' };
    return { id, type: block.type, text: block.text || '', flags: block.flags || [] };
  });
  return {
    key: question.key,
    topicId: question.key.split('/')[0],
    title: question.title,
    flags: result.flags,
    blocks,
  };
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function firstDiff(actual, expected) {
  const max = Math.min(actual.length, expected.length);
  for (let i = 0; i < max; i += 1) {
    if (actual[i] !== expected[i]) {
      return { at: i, actual: actual.slice(Math.max(0, i - 30), i + 30), expected: expected.slice(Math.max(0, i - 30), i + 30) };
    }
  }
  return { at: max, actualLength: actual.length, expectedLength: expected.length, actualTail: actual.slice(max, max + 60), expectedTail: expected.slice(max, max + 60) };
}

main();
