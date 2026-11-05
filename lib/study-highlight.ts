import { createHash } from 'node:crypto';
import { highlightCodeToHtml, isShikiLang } from '@/lib/shiki';

/**
 * 题库答案里的代码块高亮。
 *
 * `data/study/*.json` 的 answer 里代码块统一存成：
 *   <pre class='code' data-lang='java'><code>原始代码（已 HTML 转义）</code></pre>
 * 这里在服务端把它们换成与文章页同款的结构：
 *   <div class="code-block"><div class="code-bar">…</div><pre class="shiki">…</pre></div>
 * 样式复用 app/globals.css 的 .code-block / .code-bar，亮暗主题都走 Shiki 的 CSS 变量。
 *
 * 结果按答案 HTML 的 sha1 缓存：同一题第一次渲染付一次高亮成本，之后直接命中。
 */

const CODE_BLOCK_RE = /<pre class='code' data-lang='([^']*)'><code>([\s\S]*?)<\/code><\/pre>/g;
const CACHE_LIMIT = 240;
const cache = new Map<string, string>();

function decodeCodeText(text: string): string {
  return text.replace(/&(lt|gt|amp);/g, (_, name: string) => {
    if (name === 'lt') return '<';
    if (name === 'gt') return '>';
    return '&';
  });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function codeWrapper(shikiHtml: string, lang: string): string {
  const label = (isShikiLang(lang) ? lang : 'text').toUpperCase();
  return [
    '<div class="code-block">',
    '<div class="code-bar">',
    '<span class="code-dots"><i></i><i></i><i></i></span>',
    `<span class="code-lang">${escapeHtml(label)}</span>`,
    '<button type="button" class="code-copy" data-code-copy>复制</button>',
    '</div>',
    shikiHtml,
    '</div>',
  ].join('');
}

/**
 * 把答案 HTML 里的代码块替换成高亮后的结构；没有代码块时原样返回。
 * 结果带缓存，重复请求只做一次字符串查表。
 */
export async function highlightStudyAnswer(answerHtml: string): Promise<string> {
  if (!answerHtml.includes("<pre class='code'")) return answerHtml;

  const cacheKey = createHash('sha1').update(answerHtml).digest('hex');
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const matches = [...answerHtml.matchAll(CODE_BLOCK_RE)];
  if (!matches.length) return answerHtml;

  const highlighted = await Promise.all(
    matches.map(async (match) => {
      const lang = match[1] || 'text';
      const code = decodeCodeText(match[2]);
      if (!code.trim()) return match[0];
      try {
        const shiki = await highlightCodeToHtml(code, lang);
        return codeWrapper(shiki, lang);
      } catch {
        // 高亮失败时退回纯文本代码块，不能影响题目页渲染。
        return `<div class="code-block"><div class="code-bar"><span class="code-dots"><i></i><i></i><i></i></span><span class="code-lang">${escapeHtml(
          (lang || 'text').toUpperCase(),
        )}</span><button type="button" class="code-copy" data-code-copy>复制</button></div><pre class="shiki"><code>${escapeHtml(
          code,
        )}</code></pre></div>`;
      }
    }),
  );

  let out = '';
  let cursor = 0;
  matches.forEach((match, index) => {
    const start = match.index ?? 0;
    out += answerHtml.slice(cursor, start);
    out += highlighted[index];
    cursor = start + match[0].length;
  });
  out += answerHtml.slice(cursor);

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(cacheKey, out);
  return out;
}
