import type { BankQuestionRow, BankTopicOption } from '@/types/models'

type Props = {
  topics: BankTopicOption[]
  rows: BankQuestionRow[]
  total: number
  limited: boolean
  loading: boolean
  topic: string
  keyword: string
  activeKey: string
  onTopicChange: (topic: string) => void
  onKeywordChange: (keyword: string) => void
  onCreate: () => void
  onSelect: (topicId: string, qid: string) => void
}

export function QuestionList({
  topics,
  rows,
  total,
  limited,
  loading,
  topic,
  keyword,
  activeKey,
  onTopicChange,
  onKeywordChange,
  onCreate,
  onSelect,
}: Props) {
  return (
    <aside className="bank-side" aria-label="题库列表">
      <div className="bank-side-head">
        <div className="bank-side-title">
          <strong>题库</strong>
          <span>{total} 题</span>
        </div>
        <select
          className="bank-input"
          value={topic}
          aria-label="按专题筛选"
          onChange={(event) => onTopicChange(event.target.value)}
        >
          <option value="">全部专题</option>
          {topics.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} · {item.count}
            </option>
          ))}
        </select>
        <input
          className="bank-input"
          type="search"
          value={keyword}
          placeholder="搜索标题、要点或答案…"
          aria-label="搜索题目"
          onChange={(event) => onKeywordChange(event.target.value)}
        />
        <button type="button" className="admin-button primary" onClick={onCreate}>
          新增题目
        </button>
      </div>

      <div className="bank-list">
        {loading && rows.length === 0 ? <p className="bank-empty">正在读取题库…</p> : null}
        {rows.map((row) => (
          <button
            key={row.key}
            type="button"
            className={row.key === activeKey ? 'bank-row is-active' : 'bank-row'}
            onClick={() => onSelect(row.topicId, row.id)}
          >
            <span className="bank-row-top">
              <span className="bank-row-topic">{row.topicLabel}</span>
              <span className="bank-row-no">#{row.no}</span>
            </span>
            <span className="bank-row-title">{row.title}</span>
            <span className="bank-row-meta">{row.pages || '未标注页码'}</span>
          </button>
        ))}
        {!loading && rows.length === 0 ? <p className="bank-empty">没有匹配的题目。</p> : null}
      </div>

      {limited ? (
        <p className="bank-side-foot">
          匹配 {total} 题，只显示前 {rows.length} 题，请缩小专题或关键词范围。
        </p>
      ) : null}
    </aside>
  )
}
