import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStudyIndex, getStudyQuestion, questionNav } from '@/lib/study';
import StudySidebar, { type TopicOption } from '@/components/study/StudySidebar';
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
  const index = getStudyIndex();
  const topics: TopicOption[] = index.topics.map((item) => ({
    id: item.id,
    title: item.title,
    accent: item.accent,
    count: item.count,
    firstQid: item.questions[0]?.id || '',
  }));

  return (
    <div className="study-page">
      <StudySidebar
        topic={{
          id: topic.id,
          no: topic.no,
          title: topic.title,
          label: topic.label,
          count: topic.count,
        }}
        topics={topics}
        questions={questionNav(topic)}
        activeId={question.id}
      />
      <StudyQuestionContent topic={topic} question={question} />
      <EvidencePanel groups={question.evidence} />
    </div>
  );
}
