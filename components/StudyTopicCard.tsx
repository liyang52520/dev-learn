import type { StudyTopicSummary } from '@/lib/study';
import { IconArrow } from '@/components/Icons';
import PrefetchLink from '@/components/PrefetchLink';

export default function StudyTopicCard({ topic }: { topic: StudyTopicSummary }) {
  // 从专题总览进第一题是「进入题目」最重的一条路径（要新建左侧栏 + 三栏布局）。
  // 42 张卡片不能 prefetch={true}（会一次性拉 42 份 RSC），只做意图预取：
  // 鼠标悬停 / 键盘聚焦 / 触摸开始时把目标题目的完整 RSC 取回来。
  return (
    <PrefetchLink
      href={`/study/${encodeURIComponent(topic.id)}/${encodeURIComponent(topic.firstQid)}`}
      className="study-card"
      style={{ ['--card-accent' as string]: topic.accent }}
    >
      <div className="study-card-top">
        <span className="study-card-no">{topic.no}</span>
        <span className="study-card-label">{topic.label}</span>
      </div>
      <h3>{topic.title}</h3>
      <p>{topic.subtitle}</p>
      <div className="study-card-foot">
        <span>
          {topic.count} 题 · {topic.pages} 页
        </span>
        <span className="study-card-arrow">
          <IconArrow />
        </span>
      </div>
    </PrefetchLink>
  );
}
