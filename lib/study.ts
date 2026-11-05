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

export function getStudyTopic(id: string): StudyTopic | null {
  const decoded = decodeURIComponent(id);
  const file = path.join(DATA_DIR, `${decoded}.json`);
  if (!file.startsWith(DATA_DIR) || !fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as StudyTopic;
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
