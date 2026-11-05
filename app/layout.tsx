import type { Metadata } from 'next';
import '@/app/globals.css';
// KaTeX 样式只在真正渲染公式的文章页/整页预览里引入（见对应 page.tsx），
// 不放在根布局：题库与首页用不到，约 24KB 的 CSS 不该进每条路由的首屏。

export const metadata: Metadata = {
  title: {
    default: "YG's Blog · 代码与生活",
    template: "%s · YG's Blog",
  },
  description: '代码、生活与长期主义。记录技术，也记录日子。',
  metadataBase: new URL('http://localhost:3000'),
};

const themeScript = `
(function(){
  try {
    var stored = localStorage.getItem('yg-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored ? stored === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
