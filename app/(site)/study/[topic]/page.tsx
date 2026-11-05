import { notFound, redirect } from 'next/navigation';
import { getStudyTopic, questionHref } from '@/lib/study';

export default async function TopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic: topicId } = await params;
  const topic = getStudyTopic(topicId);
  if (!topic) notFound();
  if (!topic.questions.length) notFound();
  redirect(questionHref(topic.id, topic.questions[0].id));
}
