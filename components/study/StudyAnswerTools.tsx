'use client';

import { useCodeCopy } from '@/components/useCodeCopy';

/** 题目页的客户端增强：代码块「复制」按钮（与文章页共用同一套事件委托）。 */
export default function StudyAnswerTools() {
  useCodeCopy();
  return null;
}
