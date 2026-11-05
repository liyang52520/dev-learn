import Link from 'next/link';
import type { StudyQuestion, StudyTopic } from '@/lib/study';
import { questionHref, topicHref } from '@/lib/study';
import PrefetchLink from '@/components/PrefetchLink';
import { IconArrow, IconChevron } from '@/components/Icons';

interface Props {
  topic: StudyTopic;
  question: StudyQuestion;
}

export default function StudyQuestionContent({ topic, question }: Props) {
  const index = topic.questions.findIndex((item) => item.id === question.id);
  const prev = index > 0 ? topic.questions[index - 1] : null;
  const next = index >= 0 && index < topic.questions.length - 1 ? topic.questions[index + 1] : null;

  return (
    <main className="study-main">
      <header className="study-question-head">
        <div className="study-crumb">
          <Link href="/study">学习</Link>
          <IconChevron size={13} />
          <Link href={topicHref(topic.id)}>{topic.label}</Link>
          <IconChevron size={13} />
          <span>{topic.no}</span>
        </div>
        <div className="study-question-kicker">
          <span style={{ background: topic.accent }} />
          第 {question.no} 题 · {question.pages}
        </div>
        <h1>{question.title}</h1>
        {question.aliases.length > 0 && (
          <div className="question-aliases">
            <span>同义题面</span>
            {question.aliases.map((alias) => (
              <em key={alias}>{alias}</em>
            ))}
          </div>
        )}
      </header>

      {question.summary.length > 0 && (
        <section className="summary-card">
          <div className="summary-head">
            <span>要点提炼</span>
            <em>SUMMARY</em>
          </div>
          <ul>
            {question.summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {question.note && <div className="question-note">原文备注：{question.note}</div>}

      <div className="prose study-answer" dangerouslySetInnerHTML={{ __html: question.answer }} />

      <nav className="question-pager" aria-label="题目切换">
        {prev ? (
          <PrefetchLink href={questionHref(topic.id, prev.id)} prefetch={true} className="pager-link prev">
            <small>上一题</small>
            <strong>{prev.title}</strong>
          </PrefetchLink>
        ) : (
          <span />
        )}
        {next ? (
          <PrefetchLink href={questionHref(topic.id, next.id)} prefetch={true} className="pager-link next">
            <small>下一题</small>
            <strong>{next.title}</strong>
            <IconArrow />
          </PrefetchLink>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
