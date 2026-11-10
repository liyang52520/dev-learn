export type QuestionForm = {
  title: string
  aliases: string
  summary: string
  note: string
  pages: string
  answer: string
}

type Props = {
  form: QuestionForm
  onChange: (patch: Partial<QuestionForm>) => void
}

export function QuestionFields({ form, onChange }: Props) {
  return (
    <div className="bank-grid">
      <label className="bank-field wide">
        <span className="bank-label">标题</span>
        <input
          className="bank-input"
          value={form.title}
          placeholder="题目要问什么"
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </label>
      <label className="bank-field">
        <span className="bank-label">要点</span>
        <textarea
          className="bank-textarea"
          rows={4}
          value={form.summary}
          placeholder="一行一个要点"
          onChange={(event) => onChange({ summary: event.target.value })}
        />
      </label>
      <label className="bank-field">
        <span className="bank-label">别名 / 关键词</span>
        <textarea
          className="bank-textarea"
          rows={4}
          value={form.aliases}
          placeholder="一行一个，用于复习题面与检索"
          onChange={(event) => onChange({ aliases: event.target.value })}
        />
      </label>
      <label className="bank-field">
        <span className="bank-label">备注</span>
        <input
          className="bank-input"
          value={form.note}
          placeholder="可选，例如「高频」"
          onChange={(event) => onChange({ note: event.target.value })}
        />
      </label>
      <label className="bank-field">
        <span className="bank-label">页码</span>
        <input
          className="bank-input"
          value={form.pages}
          placeholder="如 p3–5，留空则按截图页码生成"
          onChange={(event) => onChange({ pages: event.target.value })}
        />
      </label>
      <label className="bank-field wide">
        <span className="bank-label">答案（Markdown）</span>
        <textarea
          className="bank-textarea bank-answer"
          rows={14}
          value={form.answer}
          spellCheck={false}
          placeholder={'## 小标题\n\n原文答案段落…\n\n- 列表项\n\n```java\n代码\n```'}
          onChange={(event) => onChange({ answer: event.target.value })}
        />
        <span className="bank-hint">
          用 Markdown 写：段落直接写，列表用 <code>- </code>，小标题用 <code>###</code>，代码用
          <code>```语言</code> 围栏，表格用 <code>| 表头 |</code>，插图用
          <code>![原文配图 · p3](/study/… "图注")</code>；需要原样显示 <code>* _ $ &lt; |</code>{' '}
          时加反斜杠转义。
        </span>
      </label>
    </div>
  )
}
