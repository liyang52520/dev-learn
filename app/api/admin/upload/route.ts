import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '没有文件' }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: '只支持图片格式' }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: '图片不能超过 20MB' }, { status: 400 });
  }

  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const ext = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 8);
  const base = path
    .basename(file.name, path.extname(file.name))
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 48);
  const filename = `${Date.now()}-${base || 'image'}${ext}`;
  const dir = path.join(process.cwd(), 'public', 'images', 'uploads', year, month);
  await fs.mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, filename), buffer);
  return NextResponse.json({ url: `/images/uploads/${year}/${month}/${filename}` });
}
