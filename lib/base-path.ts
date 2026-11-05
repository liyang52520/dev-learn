/**
 * 部署子路径（由构建/运行时环境变量 NEXT_PUBLIC_BASE_PATH 注入）。
 *
 * 站点默认部署在根路径，此时为空串，所有逻辑与原来一致；
 * 部署到 /dev-learn 这类子路径时，Next 的 basePath 只覆盖 Link/router/静态资源，
 * 手写的 fetch、<a href>、history.replaceState 不会自动带前缀，统一走这里补。
 */
const RAW_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const BASE_PATH = (() => {
  const trimmed = RAW_BASE_PATH.trim();
  if (!trimmed || trimmed === '/') return '';
  const normalized = (trimmed.startsWith('/') ? trimmed : `/${trimmed}`).replace(/\/+$/, '');
  return normalized === '' ? '' : normalized;
})();

/** 给站点根路径补上部署前缀；外部 URL、相对路径、已带前缀的路径原样返回。 */
export function withBasePath(path: string): string {
  if (!BASE_PATH || !path.startsWith('/') || path.startsWith('//')) return path;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`) || path.startsWith(`${BASE_PATH}?`)) {
    return path;
  }
  return `${BASE_PATH}${path}`;
}

/**
 * 反向代理后 request.url 可能指向 127.0.0.1/localhost，重定向要按外部访问的
 * Host 构造绝对地址，否则浏览器会被带到后端机器。
 */
export function requestOrigin(headers: Headers): string {
  const host = headers.get('x-forwarded-host') || headers.get('host');
  if (!host) return 'http://localhost';
  const proto = headers.get('x-forwarded-proto') || 'http';
  return `${proto}://${host}`;
}
