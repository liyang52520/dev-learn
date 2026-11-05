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
import type { TocItem } from '@/lib/types';

function nodeText(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return node.value || '';
  if (Array.isArray(node.children)) return node.children.map(nodeText).join('');
  return '';
}

function rehypeHeadingIds() {
  return (tree: any) => {
    const slugger = new GithubSlugger();
    const walk = (node: any) => {
      if (node.type === 'element' && /^h[1-6]$/.test(node.tagName)) {
        const text = nodeText(node).trim();
        if (text) {
          node.properties = node.properties || {};
          node.properties.id = slugger.slug(text);
        }
      }
      if (Array.isArray(node.children)) node.children.forEach(walk);
    };
    walk(tree);
  };
}

function tocFromHtml(html: string): TocItem[] {
  const items: TocItem[] = [];
  const headingPattern = /<h([2-3])[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(html))) {
    const text = match[3]
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    if (text) items.push({ depth: Number(match[1]), text, id: match[2] });
  }
  return items;
}

export async function renderMarkdown(markdown: string): Promise<{ html: string; toc: TocItem[] }> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true } as any)
    .use(rehypeRaw)
    .use(rehypeKatex)
    .use(rehypeHeadingIds)
    .use(rehypeShiki, {
      themes: { light: 'vitesse-light', dark: 'vitesse-dark' },
      defaultColor: false,
    } as any)
    .use(rehypeStringify, { allowDangerousHtml: true } as any);

  const result = await processor.process(markdown);
  const html = String(result);
  return { html, toc: tocFromHtml(html) };
}
