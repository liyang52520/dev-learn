'use client';

import { useEffect, useRef } from 'react';
import { useCodeCopy } from '@/components/useCodeCopy';

/**
 * 文章页的两个客户端增强：
 * 1. 顶部阅读进度条（纯样式，不参与布局）；
 * 2. 代码块「复制」按钮的事件委托（逻辑在 useCodeCopy，与题目页共用）。
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

  useCodeCopy();

  return (
    <div className="reading-progress" aria-hidden="true">
      <span ref={progressRef} />
    </div>
  );
}
