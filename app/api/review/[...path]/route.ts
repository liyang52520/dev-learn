import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getStudyQuestion } from '@/lib/study';
import { highlightStudyAnswer } from '@/lib/study-highlight';

/**
 * 复习功能的唯一入口：把本站的 /api/review/* 转发到本机的复习服务（anki-svc/server.py）。
 *
 * 为什么要有这一层：
 * 1. token 只存在服务端（读 anki-svc/.token），不进浏览器；
 * 2. 本机服务只监听 127.0.0.1，部署到服务器的站点根本连不到它 —— 拿不到 token 就返回 503，
 *    页面自然降级成「本机学习服务未运行」，不会把私人复习库暴露到公网；
 * 3. 题目内容由本站渲染（data/study），这里顺手把 qid 对应的题干/答案塞进 queue 响应，
 *    前端只需要一次请求。
 */

export const dynamic = 'force-dynamic';

const REVIEW_URL = process.env.REVIEW_URL || 'http://127.0.0.1:8765';
const TOKEN_PATH = path.join(process.cwd(), 'anki-svc', '.token');

interface ReviewCard {
  card_id: number;
  qid: string;
  state: string;
  labels: string[];
  question?: unknown;
}

async function readToken(): Promise<string | null> {
  try {
    return (await readFile(TOKEN_PATH, 'utf8')).trim() || null;
  } catch {
    return null;
  }
}

function unavailable(reason: string) {
  return NextResponse.json(
    { ok: false, error: reason },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}

async function handle(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  // 只接受同源请求：本机 3000 端口对任意网页都是可达的，没有这道闸门，
  // 别的站点就能往 /api/review/answer 提交评分，把你的复习计划点乱。
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') {
    return NextResponse.json({ ok: false, error: '跨站请求被拒绝' }, { status: 403 });
  }

  const { path: segments } = await ctx.params;
  const route = (segments || []).join('/');
  const token = await readToken();
  if (!token) return unavailable('复习服务未初始化');

  const url = new URL(request.url);
  const target = `${REVIEW_URL}/${route}${url.search}`;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: {
        'X-Review-Token': token,
        ...(request.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      body: request.method === 'POST' ? await request.text() : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return unavailable('复习服务未运行');
  }

  let data: Record<string, unknown>;
  try {
    data = await upstream.json();
  } catch {
    return unavailable('复习服务响应异常');
  }

  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status, headers: { 'Cache-Control': 'no-store' } });
  }

  async function enrich(card: ReviewCard): Promise<ReviewCard> {
    const [topicId, qid] = String(card.qid || '').split('/');
    const found = getStudyQuestion(topicId, qid);
    if (!found) return { ...card, question: null };
    const answerHtml = await highlightStudyAnswer(found.question.answer);
    return {
      ...card,
      question: {
        title: found.question.title,
        aliases: found.question.aliases,
        summary: found.question.summary,
        note: found.question.note,
        pages: found.question.pages,
        answerHtml,
        topic: found.topic.label,
        topicId: found.topic.id,
      },
    };
  }

  if (route === 'queue' && Array.isArray(data.cards)) {
    data.cards = await Promise.all((data.cards as ReviewCard[]).map(enrich));
  }

  // /answer 会顺手返回下一张卡，这里同样补上题面内容
  if (route === 'answer' && data.next) {
    data.next = await enrich(data.next as ReviewCard);
  }

  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(request, ctx);
}

export async function POST(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(request, ctx);
}
