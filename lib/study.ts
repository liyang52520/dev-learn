import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data/study');

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
