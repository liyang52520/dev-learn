import type { Metadata } from 'next';
import { getStudyIndex, summarizeTopic } from '@/lib/study';
import StudyTopicBrowser from '@/components/study/StudyTopicBrowser';
import ReviewLauncher from '@/components/study/ReviewLauncher';

export const metadata: Metadata = {
  title: '学习 · 面试专题',
  description: '42 个 Java 面试专题，2521 道题，题干原文逐字还原，附 PDF 原始页截图。',
};

export default function StudyHomePage() {
  const index = getStudyIndex();

  return (
    <div className="page-shell study-home">
      <header className="page-hero study-hero">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          INTERVIEW NOTES
        </p>
        <h1>
          {index.topics.length} 个专题，
          <br />
          <span className="serif">{index.meta.count.toLocaleString('en-US')} 道题。</span>
        </h1>
        <p>
          题干原文逐字还原，代码、表格、插图不做改写；每道题右侧附 PDF 原始页截图，来源可查。
        </p>
        <div className="study-hero-stats">
          <span>
            <strong>{index.topics.length}</strong> 专题
          </span>
          <span>
            <strong>{index.meta.count.toLocaleString('en-US')}</strong> 题目
          </span>
          <span>
            <strong>{index.meta.pages.toLocaleString('en-US')}</strong> 页原文
          </span>
        </div>
      </header>

      <ReviewLauncher />

      <StudyTopicBrowser topics={index.topics.map(summarizeTopic)} />
    </div>
  );
}
