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
  },
};

export default nextConfig;
