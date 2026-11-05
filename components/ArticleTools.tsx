'use client';

import { useEffect } from 'react';

export default function ArticleTools() {
  useEffect(() => {
    const progress = document.querySelector<HTMLElement>('.reading-progress > span');
    function onScroll() {
      if (!progress) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      progress.style.transform = `scaleX(${ratio})`;
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const body = document.querySelector('.prose');
    if (!body) return;

    body.querySelectorAll('table').forEach((table) => {
      if (table.parentElement?.classList.contains('table-wrap')) return;
      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      table.parentElement?.insertBefore(wrap, table);
      wrap.appendChild(table);
    });

    body.querySelectorAll('img').forEach((img) => {
      img.setAttribute('loading', 'lazy');
      img.setAttribute('decoding', 'async');
    });

    body.querySelectorAll('pre').forEach((pre) => {
      if (pre.parentElement?.classList.contains('code-block')) return;
      const code = pre.querySelector('code');
      const lang =
        pre.getAttribute('data-language') ||
        Array.from(code?.classList || [])
          .find((name) => name.startsWith('language-'))
          ?.replace('language-', '') ||
        'text';

      const wrap = document.createElement('div');
      wrap.className = 'code-block';
      const bar = document.createElement('div');
      bar.className = 'code-bar';
      bar.innerHTML = `<span class="code-dots"><i></i><i></i><i></i></span><span class="code-lang">${lang}</span>`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'code-copy';
      button.textContent = '复制';
      button.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(code?.textContent || '');
          button.textContent = '已复制';
          setTimeout(() => {
            button.textContent = '复制';
          }, 1600);
        } catch {
          button.textContent = '复制失败';
        }
      });
      bar.appendChild(button);
      pre.parentElement?.insertBefore(wrap, pre);
      wrap.appendChild(bar);
      wrap.appendChild(pre);
    });
  }, []);

  return (
    <div className="reading-progress" aria-hidden="true">
      <span />
    </div>
  );
}
