import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data/study');
const PUBLIC_DIR = path.join(process.cwd(), 'public');

export interface StudyQuestionIndex {
  key: string;
  no: number;
  id: string;
  title: string;
  aliases: string[];
  summary: string[];
  note: string;
  pages: string;
  firstPage: number;
  search: string;
}

export interface StudyTopicIndex {
  id: string;
  no: string;
  slug: string;
  title: string;
  label: string;
  subtitle: string;
  accent: string;
  pages: number;
  count: number;
  questions: StudyQuestionIndex[];
}

export interface StudyIndex {
  meta: {
    title: string;
    subtitle: string;
    pages: number;
    topics: number;
    count: number;
  };
  topics: StudyTopicIndex[];
}

export interface StudyTopicSummary {
  id: string;
  no: string;
  slug: string;
  title: string;
  label: string;
  subtitle: string;
  accent: string;
  pages: number;
  count: number;
  firstQid: string;
}

export function summarizeTopic(topic: StudyTopicIndex): StudyTopicSummary {
  return {
    id: topic.id,
    no: topic.no,
    slug: topic.slug,
    title: topic.title,
    label: topic.label,
    subtitle: topic.subtitle,
    accent: topic.accent,
    pages: topic.pages,
    count: topic.count,
    firstQid: topic.questions[0]?.id || '',
  };
}

export interface EvidenceFile {
  page: number;
  file: string;
  /** 由文件头读出的原始像素尺寸，用于 <img> 预留占位、避免加载后跳动。 */
  width?: number;
  height?: number;
}

export interface EvidenceGroup {
  label: string;
  from: number;
  to: number;
  files: EvidenceFile[];
}

export interface StudyQuestion extends StudyQuestionIndex {
  answer: string;
  evidence: EvidenceGroup[];
}

export interface StudyTopic extends Omit<StudyTopicIndex, 'questions'> {
  pdf: string;
  questions: StudyQuestion[];
}

let indexCache: StudyIndex | null = null;

interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * 只读文件头拿 JPEG/PNG 尺寸（不引依赖、不解码整张图）。
 * 按「路径 + mtime + size」缓存，同一张截图只读一次。
 */
const imageSizeCache = new Map<string, { mtimeMs: number; size: number; dims: ImageDimensions | null }>();

function parsePngSize(buffer: Buffer): ImageDimensions | null {
  // 8 字节签名 + IHDR 长度(4) + 'IHDR'(4) + 宽(4) + 高(4)
  if (buffer.length < 24) return null;
  if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47) return null;
  if (buffer.toString('latin1', 12, 16) !== 'IHDR') return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

function parseJpegSize(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    let marker = buffer[offset + 1];
    // 0xFF 填充字节
    while (marker === 0xff && offset + 2 < buffer.length) {
      offset += 1;
      marker = buffer[offset + 1];
    }
    offset += 2;
    // 无长度字段的标记：RSTn、TEM、SOI/EOI
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    // 扫描数据之前还没遇到 SOF，说明读到的片段不够，放弃
    if (marker === 0xda) return null;
    if (offset + 2 > buffer.length) return null;
    const length = buffer.readUInt16BE(offset);
    if (length < 2) return null;
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (offset + 7 > buffer.length) return null;
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += length;
  }
  return null;
}

function readImageDimensions(file: string): ImageDimensions | null {
  let stat: { mtimeMs: number; size: number };
  try {
    stat = fs.statSync(file);
  } catch {
    return null;
  }
  const cached = imageSizeCache.get(file);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.dims;

  let dims: ImageDimensions | null = null;
  let fd: number;
  try {
    fd = fs.openSync(file, 'r');
  } catch {
    imageSizeCache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, dims: null });
    return null;
  }
  try {
    // 绝大多数截图 SOF 在头 200 字节内（实测 bigtech 710 张最远 160B），
    // 先只读 4KB；读不到再逐级放大，避免为了一个尺寸把整张图搬进内存。
    for (const length of [4 * 1024, 64 * 1024]) {
      const size = Math.min(stat.size, length);
      if (size === 0) break;
      const head = Buffer.alloc(size);
      const read = fs.readSync(fd, head, 0, size, 0);
      const buffer = head.subarray(0, read);
      dims = parsePngSize(buffer) || parseJpegSize(buffer);
      if (dims || read < length) break;
    }
    // 带超大 EXIF 的 JPEG 才走这里；只在这类文件上读整份。
    if (!dims) {
      const whole = fs.readFileSync(file);
      dims = parsePngSize(whole) || parseJpegSize(whole);
    }
  } catch {
    dims = null;
  } finally {
    fs.closeSync(fd);
  }
  imageSizeCache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, dims });
  return dims;
}

/** /study/… 站内绝对路径 → public 下的真实文件；其他路径一律不碰。 */
function publicFileOf(src: string): string | null {
  if (!src.startsWith('/study/')) return null;
  let decoded = src.split('?')[0].split('#')[0];
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // 保持原样
  }
  const resolved = path.join(PUBLIC_DIR, decoded);
  return resolved.startsWith(`${PUBLIC_DIR}${path.sep}`) ? resolved : null;
}

function dimensionsOfSrc(src: string): ImageDimensions | null {
  const file = publicFileOf(src);
  return file ? readImageDimensions(file) : null;
}

const IMG_TAG_PATTERN = /<img\b[^>]*>/gi;
const WIDTH_ATTR_PATTERN = /\s+width\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const HEIGHT_ATTR_PATTERN = /\s+height\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const SRC_ATTR_PATTERN = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

/** 给 answer HTML 里所有 /study/ 图片补 width/height，让浏览器提前占好版面。 */
function injectAnswerImageSizes(html: string): string {
  if (!html.includes('<img')) return html;
  return html.replace(IMG_TAG_PATTERN, (tag) => {
    const srcMatch = SRC_ATTR_PATTERN.exec(tag);
    const src = srcMatch?.[1] ?? srcMatch?.[2];
    if (!src) return tag;
    const dims = dimensionsOfSrc(src);
    if (!dims) return tag;
    const cleaned = tag.replace(WIDTH_ATTR_PATTERN, '').replace(HEIGHT_ATTR_PATTERN, '');
    const closing = cleaned.endsWith('/>') ? '/>' : '>';
    const head = cleaned.slice(0, cleaned.length - closing.length).replace(/\s+$/, '');
    return `${head} width="${dims.width}" height="${dims.height}"${closing}`;
  });
}

/**
 * 把尺寸补进缓存里的题目对象（只改内存，不写回 JSON）：
 * 证据截图给 EvidenceFile 补 width/height，答案 HTML 里的配图直接注入属性。
 *
 * 只在题目真正被渲染时（getStudyQuestion）补当前这一题，而不是解析专题时把
 * 276 题、几百张图全 stat 一遍——大专题首次解析实测要多花几十毫秒，而 LRU
 * 只缓存 6 篇，42 个专题轮转时会反复付这笔钱。
 */
const enrichedQuestions = new WeakSet<StudyQuestion>();

function enrichQuestionImages(question: StudyQuestion) {
  if (enrichedQuestions.has(question)) return;
  enrichedQuestions.add(question);
  for (const group of question.evidence) {
    for (const file of group.files) {
      const dims = dimensionsOfSrc(file.file);
      if (dims) {
        file.width = dims.width;
        file.height = dims.height;
      }
    }
  }
  if (question.answer.includes('<img')) {
    question.answer = injectAnswerImageSizes(question.answer);
  }
}

export function getStudyIndex(): StudyIndex {
  if (!indexCache) {
    indexCache = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'index.json'), 'utf8')) as StudyIndex;
  }
  return indexCache;
}

/**
 * 专题 JSON 单篇最大 2.4 MB，而一次题目渲染里 generateMetadata 和页面组件
 * 会各取一次。按 mtime + size 缓存解析结果，重复读取只付出一次 stat 的代价；
 * 文件被重新抽取（mtime 变化）时自动失效。
 */
interface TopicCacheEntry {
  mtimeMs: number;
  size: number;
  data: StudyTopic;
}

const topicCache = new Map<string, TopicCacheEntry>();
/** 只缓存最近访问的几篇，避免 42 篇（约 24 MB）全驻留内存。 */
const TOPIC_CACHE_LIMIT = 6;

export function getStudyTopic(id: string): StudyTopic | null {
  const decoded = decodeURIComponent(id);
  const file = path.join(DATA_DIR, `${decoded}.json`);
  if (!file.startsWith(DATA_DIR) || !fs.existsSync(file)) return null;

  const stat = fs.statSync(file);
  const cached = topicCache.get(file);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.data;
  }

  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as StudyTopic;
  if (topicCache.size >= TOPIC_CACHE_LIMIT) {
    const oldest = topicCache.keys().next().value;
    if (oldest) topicCache.delete(oldest);
  }
  topicCache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, data });
  return data;
}

/**
 * 侧栏只需要题号、题干和同义题面。它是 Client Component，props 会被序列化进
 * RSC payload；直接把 StudyQuestion[]（含 answer/evidence）传进去，每次切题都会
 * 把整个专题的答案重新下发一遍（实测最高 2.3 MB/次）。这里只挑必要字段。
 */
export interface StudyQuestionNav {
  id: string;
  no: number;
  title: string;
  aliases: string[];
}

export function questionNav(topic: StudyTopic): StudyQuestionNav[] {
  return topic.questions.map((question) => ({
    id: question.id,
    no: question.no,
    title: question.title,
    aliases: question.aliases,
  }));
}

export function getStudyQuestion(topicId: string, qid: string) {
  const topic = getStudyTopic(topicId);
  if (!topic) return null;
  const question = topic.questions.find((item) => item.id === qid || item.key === qid);
  if (!question) return null;
  enrichQuestionImages(question);
  return { topic, question };
}

export function questionHref(topicId: string, qid: string) {
  return `/study/${encodeURIComponent(topicId)}/${encodeURIComponent(qid)}`;
}

export function topicHref(topicId: string) {
  return `/study/${encodeURIComponent(topicId)}`;
}

export function neighborQuestions(topic: StudyTopic, qid: string) {
  const index = topic.questions.findIndex((item) => item.id === qid);
  return {
    index,
    prev: index > 0 ? topic.questions[index - 1] : null,
    next: index >= 0 && index < topic.questions.length - 1 ? topic.questions[index + 1] : null,
  };
}

export function allStudyQuestions() {
  return getStudyIndex().topics.flatMap((topic) =>
    topic.questions.map((question) => ({
      ...question,
      topicId: topic.id,
      topicTitle: topic.title,
      topicLabel: topic.label,
      accent: topic.accent,
      href: questionHref(topic.id, question.id),
    })),
  );
}

export function studyStats() {
  const index = getStudyIndex();
  return {
    topics: index.topics.length,
    questions: index.meta.count,
    pages: index.meta.pages,
  };
}
