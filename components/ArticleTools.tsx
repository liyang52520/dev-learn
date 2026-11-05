'use client';

import { useEffect, useRef } from 'react';

/**
 * 文章页的两个客户端增强：
 * 1. 顶部阅读进度条（纯样式，不参与布局）；
 * 2. 代码块「复制」按钮的事件委托。
 *
 * 代码块结构（.code-block / .code-bar / button[data-code-copy]）与表格包裹（.table-wrap）
 * 现在都由服务端渲染输出（lib/markdown.ts），所以这里不再在 hydration 后移动 DOM——
 * 那会让首屏已经画好的内容二次跳动，也会让代码块的复制按钮晚一拍才出现。
 */
export default function ArticleTools() {
  const progressRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const progress = progressRef.current;
    if (!progress) return;
    let frame = 0;

    function update() {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      progress!.style.transform = `scaleX(${ratio})`;
    }

    function onScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    }

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

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

  return (
    <div className="reading-progress" aria-hidden="true">
      <span ref={progressRef} />
    </div>
  );
}
