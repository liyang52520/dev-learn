'use client';

import { useEffect, useState } from 'react';
import type { EvidenceGroup } from '@/lib/study';
import { IconClose } from '@/components/Icons';

export default function EvidencePanel({ groups }: { groups: EvidenceGroup[] }) {
  const [zoom, setZoom] = useState<{ src: string; page: number } | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setZoom(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = zoom ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [zoom]);

  if (!groups.length) {
    return (
      <aside className="study-evidence">
        <div className="evidence-head">
          <h2>原文出处</h2>
        </div>
        <p className="evidence-empty">本题暂无 PDF 截图。</p>
      </aside>
    );
  }

  return (
    <>
      <aside className="study-evidence">
        <div className="evidence-head">
          <h2>原文出处</h2>
          <span>{groups.reduce((sum, group) => sum + group.files.length, 0)} 张</span>
        </div>
        <p className="evidence-hint">PDF 原始页 · 红框圈住题干 · 点击放大</p>
        {groups.map((group, groupIndex) => (
          <section className="evidence-group" key={`${group.label}-${groupIndex}`}>
            <header>
              <strong>{group.label}</strong>
              <span>
                p{group.from}–{group.to}
              </span>
            </header>
            {group.files.map((file) => (
              <button
                key={file.file}
                type="button"
                className="evidence-shot"
                onClick={() => setZoom({ src: file.file, page: file.page })}
              >
                <img src={file.file} alt={`PDF 第 ${file.page} 页`} loading="lazy" />
                <span>p{file.page}</span>
              </button>
            ))}
          </section>
        ))}
      </aside>

      {zoom && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setZoom(null)}>
          <button type="button" className="lightbox-close" onClick={() => setZoom(null)} aria-label="关闭">
            <IconClose size={22} />
          </button>
          <figure onClick={(event) => event.stopPropagation()}>
            <img src={zoom.src} alt={`PDF 第 ${zoom.page} 页`} />
            <figcaption>PDF 原文 · p{zoom.page}</figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
