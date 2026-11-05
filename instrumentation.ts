/**
 * Next.js 启动钩子：服务进程起来后，在后台把 Shiki 高亮器预热好。
 *
 * 文章页第一次渲染时，@shikijs/rehype 要现装 WASM 引擎与语法；如果 langs 不显式
 * 限定，它会把 shiki 自带的两百多种语法全部载入（实测 1.7s+）。这里在 dev / prod
 * 启动后 fire-and-forget 地把真正会用到的语言装上，首个文章请求就不必等这段冷启动。
 *
 * 约束：不阻塞启动（不 await 预热）、任何失败都不抛错（预热失败只是退回按需加载）。
 *
 * ⚠️ 必须写成 `if (process.env.NEXT_RUNTIME === 'nodejs') { ... }` 的**包裹式**分支，
 * 不能写成「提前 return 再 import」：Next 会为 node 与 edge 两套 runtime 各编译一次
 * instrumentation，webpack 只会把包裹式分支里的 `import()` 当作死代码消除。否则
 * lib/markdown.ts 里的 `node:fs` / `node:path` 会被打进 edge 包，生产构建报
 * UnhandledSchemeError（dev 的 Turbopack 与 tsc 都发现不了）。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./lib/markdown')
      .then((mod) => mod.warmupMarkdown())
      .catch(() => {
        // 预热是纯优化，失败不影响页面渲染。
      });
  }
}
