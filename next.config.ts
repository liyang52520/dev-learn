import type { NextConfig } from 'next';

/**
 * 部署到子路径时由环境变量注入（例如 /dev-learn）。
 * 不设置时保持原样部署在根路径，本地开发与根路径构建不受影响。
 */
function resolveBasePath(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_BASE_PATH?.trim();
  if (!raw || raw === '/') return undefined;
  const normalized = (raw.startsWith('/') ? raw : `/${raw}`).replace(/\/+$/, '');
  return normalized === '' ? undefined : normalized;
}

const basePath = resolveBasePath();

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ['shiki', 'codemirror'],
    // 客户端路由缓存：前进/后退与短时间重复访问直接复用，不必每次回服务端取。
    // dynamic 覆盖 force-dynamic 页面（本站绝大多数页面），static 覆盖默认预取。
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
};

export default nextConfig;
