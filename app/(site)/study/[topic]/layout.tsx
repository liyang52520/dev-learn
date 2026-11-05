import { notFound } from 'next/navigation';
import { getStudyIndex, getStudyTopic, questionNav } from '@/lib/study';
import StudySidebar, { type TopicOption } from '@/components/study/StudySidebar';

// 左侧题目列表放在专题这一层的 layout 里：切换题目时只替换中间/右侧内容，
// 侧栏不重建，既不会闪骨架，也不会丢滚动位置和搜索状态。
export default async function StudyTopicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ topic: string }>;
}) {
  const { topic: topicId } = await params;
  const topic = getStudyTopic(topicId);
  if (!topic) notFound();

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
      />
      {children}
    </div>
  );
}
