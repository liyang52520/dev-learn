import Link from 'next/link';
import { IconArrow } from '@/components/Icons';

export default function AdminTopbar() {
  return (
    <header className="admin-topbar">
      <Link href="/admin" className="admin-brand">
        <span>YG</span>
        <strong>Studio</strong>
        <em>内容管理</em>
      </Link>
      <nav>
        <Link href="/admin">文章</Link>
        <a href="/" target="_blank" rel="noreferrer">
          查看站点
          <IconArrow size={13} />
        </a>
      </nav>
      <div className="admin-topbar-right">
        <span className="admin-env">LOCAL</span>
        <a href="/api/admin/logout">退出</a>
      </div>
    </header>
  );
}
