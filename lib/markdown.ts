import fs from 'node:fs';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import rehypeShiki from '@shikijs/rehype';
import rehypeStringify from 'rehype-stringify';
import GithubSlugger from 'github-slugger';
import { bundledLanguages } from 'shiki';
import type { TocItem } from '@/lib/types';

/** 与 @shikijs/rehype 的默认主题保持一致；warmupMarkdown() 必须用同一组。 */
const SHIKI_THEMES = { light: 'vitesse-light', dark: 'vitesse-dark' } as const;

/**
 * 站内实际用到（加上常见）的代码围栏语言。
 * 显式传给 @shikijs/rehype 后，它只加载这些语法，不再把 shiki 自带的两百多种
 * 语言全部载入——首次渲染的冷启动有相当一部分花在这上面。
 * 未列出的语言会被 rehype 插件跳过（保持纯文本代码块），与改前“非内置语言的
 * 优雅降级”行为一致；新增语言时补到这里即可。
 */
const COMMON_LANGS = [
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

/**
 * 扫描 content/posts 与 content/drafts 的代码围栏语言。
 * 草稿也扫，是因为后台整页预览走同一条渲染管线。
 */
function scanContentLangs(): string[] {
  const langs = new Set<string>(COMMON_LANGS);
  const roots = ['posts', 'drafts'].map((type) => path.join(process.cwd(), 'content', type));
  for (const dir of roots) {
    let files: string[] = [];
    try {
      files = fs.readdirSync(dir).filter((name) => name.endsWith('.md'));
    } catch {
      continue;
    }
    for (const file of files) {
      let raw = '';
      try {
        raw = fs.readFileSync(path.join(dir, file), 'utf8');
      } catch {
        continue;
      }
      for (const match of raw.matchAll(/^(?:```+|~~~+)[ \t]*([\w+#.-]+)/gm)) {
        const lang = match[1].toLowerCase();
        if (lang) langs.add(lang);
      }
    }
  }
  return [...langs];
}

/**
 * 只保留 shiki 自带语法包里真实存在的名字（'text' 是特殊语言，允许）。
 * 否则 getSingletonHighlighter() 会直接抛错，整条渲染管线都起不来。
 */
function validShikiLangs(langs: string[]): string[] {
  const valid: string[] = [];
  for (const lang of langs) {
    if (lang === 'text' || lang in bundledLanguages) valid.push(lang);
  }
  return valid;
}

const SHIKI_LANGS = validShikiLangs(scanContentLangs());

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
}

function nodeText(node: HastNode | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.value || '';
  // KaTeX 的 <annotation> 存的是原始 TeX，重复且不该进目录。
  if (node.type === 'element' && (node.tagName === 'annotation' || node.tagName === 'script' || node.tagName === 'style')) {
    return '';
  }
  if (Array.isArray(node.children)) return node.children.map((child) => nodeText(child)).join('');
  return '';
}

function textNode(value: string): HastNode {
  return { type: 'text', value };
}

function element(tagName: string, properties: Record<string, unknown> = {}, children: HastNode[] = []): HastNode {
  return { type: 'element', tagName, properties, children };
}

function hasClass(node: HastNode | undefined, className: string): boolean {
  const classes = node?.properties?.className;
  return Array.isArray(classes) && classes.some((item) => item === className);
}

/**
 * 给标题补锚点 id，同时在同一次 walk 里收集 h2/h3 目录。
 * 改前是对渲染后的整页 HTML 跑正则，两遍扫描且容易受 HTML 实体影响。
 * 目录结果挂在 vfile.data.toc 上，由 renderMarkdown 取出。
 */
function rehypeHeadingIds() {
  return (tree: HastNode, file: any) => {
    const slugger = new GithubSlugger();
    const items: TocItem[] = [];
    const walk = (node: HastNode) => {
      if (node.type === 'element' && /^h[1-6]$/.test(node.tagName || '')) {
        const text = nodeText(node).trim();
        if (text) {
          node.properties = node.properties || {};
          node.properties.id = slugger.slug(text);
          const depth = Number(node.tagName?.slice(1));
          if (depth === 2 || depth === 3) {
            items.push({ depth, text, id: node.properties.id as string });
          }
        }
      }
      if (Array.isArray(node.children)) node.children.forEach(walk);
    };
    walk(tree);
    file.data.toc = items;
  };
}

function languageOf(pre: HastNode): string {
  const fromPre = pre.properties?.dataLanguage ?? pre.properties?.['data-language'];
  if (typeof fromPre === 'string' && fromPre) return fromPre;
  const code = (pre.children || []).find((child) => child.type === 'element' && child.tagName === 'code');
  const classes = code?.properties?.className;
  if (Array.isArray(classes)) {
    for (const name of classes) {
      if (typeof name === 'string' && name.startsWith('language-')) return name.slice('language-'.length) || 'text';
    }
  }
  return 'text';
}

/**
 * 服务端把代码块/表格包成 ArticleTools 原本在客户端做的结构：
 * 进页面就有 .code-block / .table-wrap，不再等 hydration 后动 DOM（消除布局跳动）。
 * 复制按钮带 data-code-copy，由客户端事件委托接管。
 * 放在 rehypeShiki 之前：高亮器会用 codeToHast() 的片段替换 <pre>，替换后
 * 语言信息只剩在 shiki 的 class 里；在它之前取 code 的 language-xxx 才可靠。
 */
function rehypeWrapBlocks() {
  return (tree: HastNode) => {
    const walk = (node: HastNode, parent: HastNode | null) => {
      if (!Array.isArray(node.children)) return;
      node.children = node.children.map((child) => {
        // @shikijs/rehype 用 codeToHast() 的 root 片段整体替换 <pre>，
        // 所以这里要连 root 节点一起往下走，不能只看 element。
        if (child.type !== 'element' && child.type !== 'root') return child;
        walk(child, node);
        if (child.type !== 'element') return child;
        // 旧版 ArticleTools 在 hydration 后给正文图片补 loading/decoding；
        // 现在服务端输出就带上，不依赖客户端脚本，也不覆盖作者显式写的值。
        if (child.tagName === 'img') {
          child.properties = child.properties || {};
          if (child.properties.loading == null) child.properties.loading = 'lazy';
          if (child.properties.decoding == null) child.properties.decoding = 'async';
        }
        if (child.tagName === 'pre' && !hasClass(parent || undefined, 'code-block')) {
          return element('div', { className: ['code-block'] }, [
            element('div', { className: ['code-bar'] }, [
              element('span', { className: ['code-dots'] }, [element('i'), element('i'), element('i')]),
              element('span', { className: ['code-lang'] }, [textNode(languageOf(child))]),
              element('button', { type: 'button', className: ['code-copy'], dataCodeCopy: true }, [textNode('复制')]),
            ]),
            child,
          ]);
        }
        if (child.tagName === 'table' && !hasClass(parent || undefined, 'table-wrap')) {
          return element('div', { className: ['table-wrap'] }, [child]);
        }
        return child;
      });
    };
    walk(tree, null);
  };
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true } as any)
  .use(rehypeRaw)
  .use(rehypeKatex)
  .use(rehypeHeadingIds)
  // 包裹必须放在 rehypeShiki 之前：高亮器会把 <pre> 换成它自己的片段，
  // 原本 code 上的 language-xxx 类在那之后就丢了，取不到真实语言。
  .use(rehypeWrapBlocks)
  .use(rehypeShiki, {
    themes: SHIKI_THEMES,
    defaultColor: false,
    langs: SHIKI_LANGS,
  } as any)
  .use(rehypeStringify, { allowDangerousHtml: true } as any);

export async function renderMarkdown(markdown: string): Promise<{ html: string; toc: TocItem[] }> {
  const file = await processor.process(markdown);
  const html = String(file);
  return { html, toc: ((file.data as Record<string, unknown>).toc as TocItem[]) || [] };
}

/**
 * 预热 Shiki 高亮器。@shikijs/rehype 内部用的就是 shiki 的模块级单例，
 * 所以这里提前把主题与语言装好，首个文章请求不必再等语法/引擎冷启动。
 * 失败只吞掉：渲染时 @shikijs/rehype 仍会自己加载。
 */
export async function warmupMarkdown(): Promise<void> {
  try {
    const { getSingletonHighlighter } = await import('shiki');
    await getSingletonHighlighter({
      themes: [SHIKI_THEMES.light, SHIKI_THEMES.dark],
      langs: SHIKI_LANGS,
    });
  } catch {
    // 预热是纯优化，任何失败都不能影响页面渲染。
  }
}
