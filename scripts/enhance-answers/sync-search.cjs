'use strict';

/**
 * 按上游规则重算全部题目的 `search` 字段，并同步 data/study/index.json。
 * 适用于：答案结构微调（li→p、段落合并）后 search 需要跟着变，但不想重写整份专题 JSON。
 *
 * 用法：node scripts/enhance-answers/sync-search.cjs [--topics=jvm,spring] [--dry-run]
 */

const path = require('node:path');
const lib = require('./lib.cjs');

const args = process.argv.slice(2);
function argValue(name) {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}
const wantedTopics = argValue('topics') ? new Set(argValue('topics').split(',').map((s) => s.trim()).filter(Boolean)) : null;
const dryRun = args.includes('--dry-run');

function main() {
  const index = lib.readJson(path.join(lib.DATA_DIR, 'index.json'));
  const indexByKey = new Map();
  for (const topic of index.topics) {
    for (const question of topic.questions) indexByKey.set(question.key, question);
  }

  let changedTopics = 0;
  let changedQuestions = 0;
  let changedIndex = 0;
  for (const topicIndex of index.topics) {
    if (wantedTopics && !wantedTopics.has(topicIndex.id)) continue;
    const file = path.join(lib.DATA_DIR, `${topicIndex.id}.json`);
    const topic = lib.readJson(file);
    let changed = 0;
    for (const question of topic.questions) {
      const expected = lib.searchFieldOf(question);
      const indexQuestion = indexByKey.get(question.key);
      if (indexQuestion && indexQuestion.search !== expected) {
        indexQuestion.search = expected;
        changedIndex += 1;
      }
      if (expected === (question.search || '')) continue;
      question.search = expected;
      changed += 1;
    }
    if (changed) {
      changedTopics += 1;
      changedQuestions += changed;
      if (!dryRun) lib.writeJson(file, topic);
      console.log(`${topicIndex.id}: ${changed} 题 search 更新${dryRun ? '（dry-run）' : ''}`);
    }
  }

  if (!dryRun && changedIndex) lib.writeJson(path.join(lib.DATA_DIR, 'index.json'), index);
  console.log(`完成：专题内 ${changedTopics} 个专题 / ${changedQuestions} 道题；index 同步 ${changedIndex} 条${dryRun ? '（dry-run，未落盘）' : ''}`);
}

main();
