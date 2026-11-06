import type { ReactNode } from 'react';

/**
 * 专注模式布局：复习页不套站点 Header/Footer，进入后只有一张卡和四个按钮。
 * 主题初始化仍在根布局里，暗色模式照常生效。
 */
export default function FocusLayout({ children }: { children: ReactNode }) {
  return <main className="focus-main">{children}</main>;
}
