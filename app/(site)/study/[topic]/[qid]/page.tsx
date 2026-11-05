import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStudyQuestion } from '@/lib/study';
import StudyQuestionContent from '@/components/study/StudyQuestionContent';
import EvidencePanel from '@/components/study/EvidencePanel';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string; qid: string }>;
}): Promise<Metadata> {
  const { topic, qid } = await params;
  const found = getStudyQuestion(topic, qid);
  if (!found) return { title: '题目不存在' };
  return {
    title: `${found.question.title} · ${found.topic.label}`,
    description: found.question.summary[0] || found.question.title,
  };
}

export default async function StudyQuestionPage({
  params,
}: {
  params: Promise<{ topic: string; qid: string }>;
}) {
  const { topic: topicId, qid } = await params;
  const found = getStudyQuestion(topicId, qid);
  if (!found) notFound();

  const { topic, question } = found;

  // 外层的 .study-page 与左侧栏由 [topic]/layout.tsx 提供，这里只负责中间与右侧两栏。
  return (
    <>
      <StudyQuestionContent topic={topic} question={question} />
      <EvidencePanel groups={question.evidence} />
    </>
  );
}
