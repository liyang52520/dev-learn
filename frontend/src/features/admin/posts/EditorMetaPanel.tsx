import type { FrontMatter } from '@/types/models'

type Props = {
  front: FrontMatter
  slug: string
  bodyLength: number
  onChange: (patch: Partial<FrontMatter>) => void
}

function splitTerms(value: string): string[] {
  return value
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function EditorMetaPanel({ front, slug, bodyLength, onChange }: Props) {
  return (
    <aside className="editor-meta">
      <p className="editor-panel-title">文章信息</p>
      <label className="admin-field">
        <span>标题</span>
        <input value={front.title} onChange={(event) => onChange({ title: event.target.value })} />
      </label>
      <label className="admin-field">
        <span>日期</span>
        <input
          value={front.date}
          onChange={(event) => onChange({ date: event.target.value })}
          placeholder="YYYY-MM-DD HH:mm:ss"
        />
      </label>
      <label className="admin-field">
        <span>标签（逗号分隔）</span>
        <input
          value={front.tags.join(', ')}
          onChange={(event) => onChange({ tags: splitTerms(event.target.value) })}
        />
      </label>
      <label className="admin-field">
        <span>分类（逗号分隔）</span>
        <input
          value={front.categories.join(', ')}
          onChange={(event) => onChange({ categories: splitTerms(event.target.value) })}
        />
      </label>
      <label className="admin-field">
        <span>摘要</span>
        <textarea
          rows={3}
          value={front.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </label>
      <label className="admin-field">
        <span>封面图 URL</span>
        <input value={front.cover} onChange={(event) => onChange({ cover: event.target.value })} />
      </label>
      <div className="editor-meta-foot">
        <span>文件名：{slug}.md</span>
        <span>正文 {bodyLength} 字符</span>
      </div>
    </aside>
  )
}
