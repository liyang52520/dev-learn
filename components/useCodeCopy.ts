'use client';

import { useEffect } from 'react';

/**
 * 代码块「复制」按钮的事件委托。
 *
 * 文章页与题库题目页共用：两边的代码块都由服务端渲染成
 * `.code-block > .code-bar > button[data-code-copy]`，这里只挂一个 document 级监听，
 * 不在 hydration 后移动 DOM。
 */
export function useCodeCopy() {
  useEffect(() => {
    const timers = new Map<HTMLButtonElement, number>();

    function restoreLater(button: HTMLButtonElement) {
      const previous = timers.get(button);
      if (previous !== undefined) window.clearTimeout(previous);
      const timer = window.setTimeout(() => {
        timers.delete(button);
        button.textContent = '复制';
      }, 2000);
      timers.set(button, timer);
    }

    async function copy(text: string) {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
      // 非安全上下文（如 http 局域网访问）没有 Clipboard API，退回选中 + execCommand。
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      if (!ok) throw new Error('copy failed');
    }

    function onClick(event: MouseEvent) {
      const target = event.target as Element | null;
      const button = target?.closest<HTMLButtonElement>('[data-code-copy]');
      if (!button) return;
      const block = button.closest('.code-block');
      const pre = block?.querySelector('pre');
      if (!pre) return;
      event.preventDefault();

      copy(pre.textContent || '')
        .then(() => {
          button.textContent = '已复制';
          restoreLater(button);
        })
        .catch(() => {
          button.textContent = '复制失败';
          restoreLater(button);
        });
    }

    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      for (const timer of timers.values()) window.clearTimeout(timer);
      timers.clear();
    };
  }, []);
}
