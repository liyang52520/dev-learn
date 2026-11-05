'use strict';

/**
 * 校验单道题的模型 ops 是否合法、是否保持文字逐字不变。
 * 用法：node scripts/enhance-answers/validate-op.cjs <unit.json> <ops.json>
 *
 * 供大模型批处理时自查：只有输出 OK 的结果才会被 apply 接受。
 */

const path = require('node:path');
const lib = require('./lib.cjs');

const [unitPath, opsPath] = process.argv.slice(2);
if (!unitPath || !opsPath) {
  console.error('用法：node validate-op.cjs <unit.json> <ops.json>');
  process.exit(2);
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

const unit = lib.readJson(unitPath);
const ops = lib.readJson(opsPath);
const [topicId, qid] = String(unit.key).split('/');
const draftFile = path.join(lib.WIP_DIR, 'draft', `${topicId}.json`);
if (!require('node:fs').existsSync(draftFile)) fail(`draft 不存在：${draftFile}`);
const topic = lib.readJson(draftFile);
const question = topic.questions.find((item) => item.id === qid);
if (!question) fail(`draft 里找不到题目：${unit.key}`);

const draftAnswer = question.answer || '';
const blocks = lib.blocksOfAnswer(draftAnswer);
if (blocks.length !== unit.blocks.length) {
  fail(`unit 与 draft 的块数不一致：unit=${unit.blocks.length} draft=${blocks.length}（draft 可能已更新，请重新生成工作单元）`);
}

const result = lib.applyOpsToAnswer(draftAnswer, ops);
if (result.errors.length) {
  console.error('FAIL ops 结构不合法：');
  for (const error of result.errors) console.error(`- ${error}`);
  process.exit(1);
}

const before = lib.visibleText(draftAnswer);
const after = lib.visibleText(result.html);
if (before !== after) {
  const max = Math.min(before.length, after.length);
  let at = 0;
  while (at < max && before[at] === after[at]) at += 1;
  console.error('FAIL 文字被改动（只允许增删空白 / 换行）。首个差异位置：', at);
  console.error('draft :', before.slice(Math.max(0, at - 40), at + 80));
  console.error('result:', after.slice(Math.max(0, at - 40), at + 80));
  process.exit(1);
}

const codeCount = (result.html.match(/<pre class='code'/g) || []).length;
console.log(`OK ${unit.key}：langs=${Object.keys(ops.langs || {}).length}，ops=${(ops.ops || []).length}，code 块=${codeCount}`);
