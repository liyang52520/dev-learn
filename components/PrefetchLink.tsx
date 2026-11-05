'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps, FocusEvent, MouseEvent, TouchEvent } from 'react';

type LinkProps = ComponentProps<typeof Link>;

/**
 * 意图预取：鼠标悬停 / 键盘聚焦 / 触摸开始时，提前把目标路由取回来。
 *
 * 为什么需要它：Next 15 的 `<Link>` 默认只预取 loading 边界（AUTO），
 * 动态数据页点进去仍要等服务端返回 RSC；`router.prefetch()` 才是完整预取。
 * 但列表里几十上百条链接不能全都 `prefetch={true}`（会一次性拉爆），
 * 所以这里按「用户已经指向它」这一意图触发，并且对同一 href 做 5s 去重。
 *
 * 生产环境才真正发请求；dev 下 `router.prefetch()` 是空操作，不会报错。
 */
const PREFETCH_TTL_MS = 5000;
const CACHE_LIMIT = 200;

// 模块级共享：同一个 href 被多个组件包着也只预取一次。
const prefetchedAt = new Map<string, number>();

function markPrefetched(href: string) {
  const now = Date.now();
  prefetchedAt.set(href, now);
  if (prefetchedAt.size <= CACHE_LIMIT) return;
  for (const [key, time] of prefetchedAt) {
    if (now - time >= PREFETCH_TTL_MS) prefetchedAt.delete(key);
  }
}

function shouldPrefetch(href: string) {
  const now = Date.now();
  const last = prefetchedAt.get(href);
  if (last !== undefined && now - last < PREFETCH_TTL_MS) return false;
  markPrefetched(href);
  return true;
}

/** 给非 <Link> 的调用点用（例如侧栏空闲预取）：带同样的 5s 去重。 */
export function prefetchIntent(router: { prefetch: (href: string) => void }, href: string) {
  if (!href.startsWith('/')) return;
  if (!shouldPrefetch(href)) return;
  router.prefetch(href);
}

export default function PrefetchLink({
  href,
  prefetch,
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...rest
}: LinkProps) {
  const router = useRouter();

  function triggerPrefetch() {
    if (typeof href === 'string') prefetchIntent(router, href);
  }

  function handleMouseEnter(event: MouseEvent<HTMLAnchorElement>) {
    triggerPrefetch();
    onMouseEnter?.(event);
  }

  function handleFocus(event: FocusEvent<HTMLAnchorElement>) {
    triggerPrefetch();
    onFocus?.(event);
  }

  function handleTouchStart(event: TouchEvent<HTMLAnchorElement>) {
    triggerPrefetch();
    onTouchStart?.(event);
  }

  return (
    <Link
      href={href}
      prefetch={prefetch}
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
      onTouchStart={handleTouchStart}
      {...rest}
    />
  );
}
