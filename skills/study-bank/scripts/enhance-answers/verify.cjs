'use strict';

/**
 * 题库答案增强后的独立自检：
 *   1. JSON 结构与题号/证据/图片契约（沿用 AGENTS 3.7 的检查项）；
 *   2. 代码块契约：统一为 <pre class='code' data-lang='…'><code>…</code></pre>，
 *      无旧 token span（.cl / tk-*），语言在白名单内；
 *   3. 逐字保真：answer 去空白后的可见文字哈希，必须等于重建阶段记录的期望哈希
 *      （见 .wip-answers/fidelity.json；代码题已扣除 PDF 编辑器行号）；
 *   4. search 字段与“title + aliases + summary + note + 纯文本答案”规则一致。
 *
 * 用法：node skills/study-bank/scripts/enhance-answers/verify.cjs
 * 退出码 0 表示全部通过。
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const lib = require('./lib.cjs');

const ORIGINAL_DIR = path.join(lib.WIP_DIR, 'original');
const fidelity = lib.readJson(lib.FIDELITY_FILE);
const index = lib.readJson(path.join(lib.DATA_DIR, 'index.json'));

const failures = [];
const stats = {
  topics: 0,
  questions: 0,
  codeQuestions: 0,
  codeBlocks: 0,
  searchMismatch: 0,
  hashMismatch: 0,
  contractErrors: 0,
  evidenceMissing: 0,
  imageMissing: 0,
};

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function fail(category, key, detail) {
  failures.push({ category, key, detail });
  if (failures.length <= 40) console.error(`FAIL [${category}] ${key}：${detail}`);
}

function main() {
  const slugs = new Set();
  let total = 0;
  const indexByKey = new Map();

  for (const topicIndex of index.topics) {
    if (slugs.has(topicIndex.slug)) fail('topic', topicIndex.id, `slug 重复：${topicIndex.slug}`);
    slugs.add(topicIndex.slug);
    const topic = lib.readJson(path.join(lib.DATA_DIR, `${topicIndex.id}.json`));
    const originalFile = path.join(ORIGINAL_DIR, `${topicIndex.id}.json`);
    const original = fs.existsSync(originalFile) ? lib.readJson(originalFile) : topic;
    stats.topics += 1;

    if (topic.id !== topicIndex.id || topic.slug !== topicIndex.slug) {
      fail('topic', topicIndex.id, '专题 id/slug 与 index 不一致');
    }
    if (topic.count !== topic.questions.length || topicIndex.count !== topic.questions.length) {
      fail('topic', topicIndex.id, `题数不一致：${topic.questions.length} / ${topic.count} / ${topicIndex.count}`);
    }
    for (const q of topicIndex.questions) indexByKey.set(q.key, q);

    const originalByKey = new Map(original.questions.map((question) => [question.key, question]));
    topic.questions.forEach((question, i) => {
      stats.questions += 1;
      total += 1;
      const expectedQid = `q${String(i + 1).padStart(3, '0')}`;
      if (question.id !== expectedQid || question.key !== `${topic.id}/${expectedQid}`) {
        fail('qid', question.key, `题号不连续（期望 ${expectedQid}）`);
      }
      const originalQuestion = originalByKey.get(question.key);
      if (original !== topic && !originalQuestion) fail('qid', question.key, '原始数据里找不到同 key');

      const answer = question.answer || '';
      if (lib.isMarkdownAnswer(answer)) {
        // 答案已是 Markdown：代码块是围栏，只校验语言白名单。
        const fences = [...answer.matchAll(/^ {0,3}`{3,}([^\n]*)$/gm)].map((m) => m[1].trim());
        stats.codeQuestions += fences.some(Boolean) ? 1 : 0;
        stats.codeBlocks += fences.filter(Boolean).length;
        for (const lang of fences) {
          if (lang && !lib.LANGS.has(lang)) {
            fail('contract', question.key, `非法代码语言：${lang}`);
            stats.contractErrors += 1;
          }
        }
      } else if (answer.includes('<pre')) {
        stats.codeQuestions += 1;
        const preMatches = [...answer.matchAll(/<pre\b[^>]*>/g)];
        stats.codeBlocks += preMatches.length;
        if (/class=['"]cl['"]|class=['"]tk-/.test(answer)) {
          fail('contract', question.key, '残留旧代码 token span（.cl / tk-*）');
          stats.contractErrors += 1;
        }
        for (const match of answer.matchAll(/<pre class='code' data-lang='([^']*)'><code>([\s\S]*?)<\/code><\/pre>/g)) {
          const lang = match[1];
          if (!lib.LANGS.has(lang)) {
            fail('contract', question.key, `非法 data-lang：${lang}`);
            stats.contractErrors += 1;
          }
          if (/[<>]/.test(match[2])) {
            fail('contract', question.key, '代码文本未转义（出现裸 < >）');
            stats.contractErrors += 1;
          }
        }
        const newFormat = (answer.match(/<pre class='code' data-lang='[^']*'><code>[\s\S]*?<\/code><\/pre>/g) || []).length;
        if (newFormat !== preMatches.length) {
          fail('contract', question.key, `代码块格式不统一：${newFormat}/${preMatches.length}`);
          stats.contractErrors += 1;
        }
      }

      const hash = sha256(lib.answerVisibleText(answer));
      const expectedHash = fidelity[question.key] && fidelity[question.key].expected;
      if (!expectedHash) {
        fail('fidelity', question.key, 'fidelity.json 缺少该题');
      } else if (hash !== expectedHash) {
        stats.hashMismatch += 1;
        fail('fidelity', question.key, `可见文字哈希不一致（${hash.slice(0, 10)} != ${expectedHash.slice(0, 10)}）`);
      }

      const expectedSearch = lib.searchFieldOf(question);
      if (expectedSearch !== (question.search || '')) {
        stats.searchMismatch += 1;
        fail('search', question.key, 'search 与按规则重算的结果不一致');
      }
      const indexTopic = indexByKey;
      const indexQuestion = indexTopic.get(question.key);
      if (indexQuestion && indexQuestion.search !== expectedSearch) {
        fail('search-index', question.key, 'index.json 的 search 与专题 JSON 不一致');
      }

      if (!question.evidence || !question.evidence.length) fail('evidence', question.key, 'evidence 为空');
      for (const group of question.evidence || []) {
        for (const file of group.files || []) {
          if (!String(file.file).startsWith('/study/')) fail('evidence', question.key, `证据路径未重写：${file.file}`);
          if (!fs.existsSync(path.join(lib.ROOT, 'backend', 'data', file.file))) {
            stats.evidenceMissing += 1;
            fail('evidence', question.key, `证据截图缺失：${file.file}`);
          }
        }
      }
      for (const match of answer.matchAll(/<img[^>]+src=["']([^"']+)["']/g)) {
        const src = match[1];
        if (!src.startsWith('/study/')) fail('image', question.key, `配图路径异常：${src}`);
        else if (!fs.existsSync(path.join(lib.ROOT, 'backend', 'data', src))) {
          stats.imageMissing += 1;
          fail('image', question.key, `配图缺失：${src}`);
        }
      }
    });
  }

  if (total !== index.meta.count) fail('meta', 'all', `meta.count 不符：${total} != ${index.meta.count}`);
  if (index.topics.length !== index.meta.topics) fail('meta', 'all', `meta.topics 不符：${index.topics.length}`);

  console.log(JSON.stringify(stats, null, 2));
  if (failures.length) {
    console.error(`\n失败 ${failures.length} 项（前 40 条见上）`);
    const byCategory = {};
    for (const item of failures) byCategory[item.category] = (byCategory[item.category] || 0) + 1;
    console.error('分类：', byCategory);
    fs.writeFileSync(path.join(lib.WIP_DIR, 'verify-failures.json'), `${JSON.stringify(failures, null, 2)}\n`);
    process.exit(1);
  }
  console.log('OK：结构 / 代码块契约 / 文字保真 / search / 证据截图 全部通过');
}

main();
