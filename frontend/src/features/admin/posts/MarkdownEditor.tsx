import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, keymap, lineNumbers, placeholder } from '@codemirror/view'
import { useEffect, useRef } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
  dark: boolean
  docKey: string
  onReady?: (insert: (text: string) => void) => void
  onSave?: () => void
}

export function MarkdownEditor({ value, onChange, dark, docKey, onReady, onSave }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const changeRef = useRef(onChange)
  const saveRef = useRef(onSave)

  useEffect(() => {
    changeRef.current = onChange
    saveRef.current = onSave
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          EditorView.lineWrapping,
          placeholder('用 Markdown 写正文…'),
          keymap.of([
            {
              key: 'Mod-s',
              preventDefault: true,
              run: () => {
                saveRef.current?.()
                return true
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) changeRef.current(update.state.doc.toString())
          }),
          EditorView.theme({
            '&': { height: '100%', fontSize: '14px' },
            '.cm-scroller': { fontFamily: 'var(--font-mono)' },
          }),
          ...(dark ? [oneDark] : []),
        ],
      }),
    })
    onReady?.((text) => {
      const cursor = view.state.selection.main.to
      view.dispatch({ changes: { from: cursor, insert: text }, selection: { anchor: cursor + text.length } })
      view.focus()
    })
    return () => view.destroy()
    // 只按文档与主题重建，正文变更由 onChange 回传，避免每次输入重建编辑器
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey, dark])

  return <div className="cm-host" ref={hostRef} />
}
