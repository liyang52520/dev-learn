'use strict';

/**
 * 把 `.wip-answers/draft` + 模型 ops 写回 `data/study`：
 *   1. 用 lib.applyOpsToAnswer() 应用 ops（结构校验）；
 *   2. 对比 draft 的可见文字（逐字校验，忽略空白）；
 *   3. 重算 search 字段（索引与专题 JSON 同步）；
 *   4. 写回专题 JSON + index.json，并输出报告。
 *
 * 用法：
 *   node scripts/enhance-answers/apply.cjs [--topics=jvm,spring] [--dry-run]
 */

const path = require('node:path');
const fs = require('node:fs');
const lib = require('./lib.cjs');

const args = process.argv.slice(2);
function argValue(name) {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}
const wantedTopics = argValue('topics') ? new Set(argValue('topics').split(',').map((s) => s.trim()).filter(Boolean)) : null;
const dryRun = args.includes('--dry-run');

const report = { changedQuestions: 0, failed: [], topicCount: 0, gutterRemoved: 0 };

function main() {
  const index = lib.readJson(path.join(lib.DATA_DIR, 'index.json'));
  const indexByKey = new Map();
  for (const topic of index.topics) {
    for (const question of topic.questions) indexByKey.set(question.key, { topic, question });
  }

  const topicIds = index.topics.map((topic) => topic.id).filter((id) => !wantedTopics || wantedTopics.has(id));
  let changedIndex = false;

  for (const topicId of topicIds) {
    const draftFile = path.join(lib.WIP_DIR, 'draft', `${topicId}.json`);
    const unitDir = path.join(lib.WIP_DIR, 'units', topicId);
    if (!fs.existsSync(draftFile) || !fs.existsSync(unitDir)) continue;

    const current = lib.readJson(path.join(lib.DATA_DIR, `${topicId}.json`));
    const draft = lib.readJson(draftFile);
    const currentByKey = new Map(current.questions.map((question) => [question.key, question]));
    const opsDir = path.join(lib.WIP_DIR, 'ops', topicId);
    let topicChanged = 0;

    for (const question of draft.questions) {
      const unitFile = path.join(unitDir, `${question.id}.json`);
      if (!fs.existsSync(unitFile)) continue;
      const unit = lib.readJson(unitFile);
      const opsFile = path.join(opsDir, `${question.id}.json`);
      const ops = fs.existsSync(opsFile) ? lib.readJson(opsFile) : { key: unit.key, langs: {}, ops: [] };

      const draftAnswer = question.answer || '';
      const applied = lib.applyOpsToAnswer(draftAnswer, ops);
      if (applied.errors.length) {
        report.failed.push({ key: question.key, reason: applied.errors.join('; ') });
        continue;
      }
      const before = lib.visibleText(draftAnswer);
      const after = lib.visibleText(applied.html);
      if (before !== after) {
        report.failed.push({ key: question.key, reason: '应用 ops 后文字有变化' });
        continue;
      }
      question.answer = applied.html;
      report.changedQuestions += 1;
      topicChanged += 1;

      const target = currentByKey.get(question.key);
      if (!target) {
        report.failed.push({ key: question.key, reason: 'data/study 里找不到同 key 题目' });
        continue;
      }
      target.answer = applied.html;
      target.search = lib.searchFieldOf(target);
      const indexEntry = indexByKey.get(question.key);
      if (indexEntry) {
        indexEntry.question.search = target.search;
        changedIndex = true;
      }
    }

    if (topicChanged) {
      report.topicCount += 1;
      if (!dryRun) lib.writeJson(path.join(lib.DATA_DIR, `${topicId}.json`), current);
      console.log(`${topicId}: ${topicChanged} 题写回${dryRun ? '（dry-run 未落盘）' : ''}`);
    }
  }

  if (changedIndex && !dryRun) lib.writeJson(path.join(lib.DATA_DIR, 'index.json'), index);
  lib.writeJson(path.join(lib.WIP_DIR, 'apply-report.json'), report);
  console.log('changed', report.changedQuestions, 'failed', report.failed.length, 'topics', report.topicCount);
  if (report.failed.length) console.log(report.failed.slice(0, 10));
}

main();
