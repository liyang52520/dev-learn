import { bundledLanguages, getSingletonHighlighter } from 'shiki';

/**
 * 全站统一的 Shiki 主题与语言白名单。
 *
 * 文章页（lib/markdown.ts 的 rehype 管线）与题库答案（lib/study-highlight.ts）
 * 共用同一套主题，保证两边的代码块配色一致。
 */
export const SHIKI_THEMES = { light: 'vitesse-light', dark: 'vitesse-dark' } as const;

/**
 * 站内实际用到（加上常见）的代码围栏语言。
 * 显式传给 @shikijs/rehype / getSingletonHighlighter 后，只加载这些语法，
 * 不再把 shiki 自带的两百多种语言全部载入——首次渲染的冷启动有相当一部分
 * 花在这上面。未列出的语言会降级成纯文本（`text`），不会报错。
 */
export const COMMON_LANGS = [
  'java',
  'javascript',
  'js',
  'typescript',
  'ts',
  'jsx',
  'tsx',
  'json',
  'yaml',
  'yml',
  'properties',
  'ini',
  'toml',
  'xml',
  'html',
  'css',
  'scss',
  'less',
  'bash',
  'shell',
  'sh',
  'zsh',
  'powershell',
  'sql',
  'nginx',
  'dockerfile',
  'diff',
  'python',
  'go',
  'rust',
  'c',
  'cpp',
  'kotlin',
  'groovy',
  'markdown',
  'text',
  'log',
  'http',
  'regex',
  'mermaid',
];

/** 只保留 shiki 自带语法包里真实存在的名字（'text' 是特殊语言，允许）。 */
export function validShikiLangs(langs: string[]): string[] {
  const valid: string[] = [];
  for (const lang of langs) {
    if (lang === 'text' || lang in bundledLanguages) valid.push(lang);
  }
  return valid;
}

export function isShikiLang(lang: string): boolean {
  return lang === 'text' || lang in bundledLanguages;
}

/** 取同一个 Shiki 单例（与 @shikijs/rehype 共用），按需补载语言。 */
export async function getShikiHighlighter(langs: string[]) {
  return getSingletonHighlighter({
    themes: [SHIKI_THEMES.light, SHIKI_THEMES.dark],
    langs: validShikiLangs(langs),
  });
}

/** 高亮一段代码，返回 Shiki 的 `<pre class="shiki …">` 片段（双主题 CSS 变量）。 */
export async function highlightCodeToHtml(code: string, lang: string): Promise<string> {
  const highlighter = await getShikiHighlighter([lang]);
  const finalLang = isShikiLang(lang) ? lang : 'text';
  return highlighter.codeToHtml(code, {
    lang: finalLang,
    themes: SHIKI_THEMES,
    defaultColor: false,
  });
}
