'use strict';

/**
 * 把 500 个工作单元按体积打包成大模型批处理任务。
 * 输出：.wip-answers/batches/batch-<n>.json（每个文件是 unit 数组）
 *      .wip-answers/batches/index.json（批次清单，供 workflow 编排使用）
 *
 * 用法：node scripts/enhance-answers/make-batches.cjs [--max-kb=95] [--max-units=14]
 */

const fs = require('node:fs');
const path = require('node:path');
const lib = require('./lib.cjs');

const args = process.argv.slice(2);
function argValue(name) {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}
const maxKb = Number(argValue('max-kb') || 95);
const maxUnits = Number(argValue('max-units') || 14);
const maxBytes = maxKb * 1024;

const outDir = path.join(lib.WIP_DIR, 'batches');
fs.rmSync(outDir, { recursive: true, force: true });
lib.ensureDir(outDir);

const units = [];
for (const topic of lib.loadTopicIndex().topics) {
  const dir = path.join(lib.WIP_DIR, 'units', topic.id);
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort();
  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    units.push({ topicId: topic.id, qid: file.replace(/\.json$/, ''), file: full, bytes: stat.size, unit: lib.readJson(full) });
  }
}

const batches = [];
let current = { units: [], bytes: 0 };
function flush() {
  if (!current.units.length) return;
  batches.push(current);
  current = { units: [], bytes: 0 };
}

for (const item of units) {
  const tooBig = current.units.length >= maxUnits || current.bytes + item.bytes > maxBytes;
  if (current.units.length && tooBig) flush();
  current.units.push(item);
  current.bytes += item.bytes;
  if (item.bytes > maxBytes) flush(); // 超大 unit 独占一批
}
flush();

const index = batches.map((batch, i) => {
  const id = `batch-${String(i).padStart(3, '0')}`;
  const file = path.join(outDir, `${id}.json`);
  const data = batch.units.map((u) => u.unit);
  lib.writeJson(file, data);
  fs.writeFileSync(
    path.join(outDir, `${id}.units.txt`),
    batch.units.map((u) => path.relative(lib.ROOT, u.file)).join('\n') + '\n',
  );
  return {
    id,
    file: path.relative(lib.ROOT, file),
    bytes: batch.bytes,
    units: batch.units.map((u) => u.unit.key),
  };
});
lib.writeJson(path.join(outDir, 'index.json'), index);

const sizes = index.map((batch) => Math.round(batch.bytes / 1024));
console.log(`units=${units.length} batches=${batches.length} totalKB=${Math.round(units.reduce((s, u) => s + u.bytes, 0) / 1024)}`);
console.log(`batchKB  min=${Math.min(...sizes)} max=${Math.max(...sizes)} avg=${Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length)}`);
console.log(`批次清单：${path.relative(lib.ROOT, path.join(outDir, 'index.json'))}`);
