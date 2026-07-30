import { NextRequest, NextResponse } from 'next/server';
import {
  getAnalyticsPaymentsUrl,
  mapPaymentsResponse,
  type TransactionsResponse,
} from '@/lib/transactions';

function buildUpstreamUrl(searchParams: URLSearchParams): string {
  const upstream = new URL(getAnalyticsPaymentsUrl());
  const page = searchParams.get('page');
  const limit = searchParams.get('limit');
  const creator = searchParams.get('creator');
  const from = searchParams.get('from') ?? searchParams.get('fromDate');
  const to = searchParams.get('to') ?? searchParams.get('toDate');

  if (page) upstream.searchParams.set('page', page);
  if (limit) upstream.searchParams.set('limit', limit);
  if (creator) upstream.searchParams.set('creator', creator);
  if (from) upstream.searchParams.set('from', from);
  if (to) upstream.searchParams.set('to', to);

  return upstream.toString();
}

function forwardAuthHeaders(request: NextRequest): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const authorization = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');
  if (authorization) headers.Authorization = authorization;
  if (cookie) headers.Cookie = cookie;
  return headers;
}

async function proxyTransactions(request: NextRequest, searchParams: URLSearchParams) {
  const url = buildUpstreamUrl(searchParams);

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: 'GET',
      headers: forwardAuthHeaders(request),
      cache: 'no-store',
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Failed to reach transactions backend',
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
      { status: 502 },
    );
  }

  const raw = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    const message =
      (raw && typeof raw === 'object' && 'message' in raw && typeof raw.message === 'string'
        ? raw.message
        : null) ?? `Failed to fetch transactions (${upstream.status})`;

    return NextResponse.json(
      {
        message,
        data: [],
        total: 0,
        page: Number(searchParams.get('page') ?? 1),
        limit: Number(searchParams.get('limit') ?? 10),
        totalPages: 1,
      },
      { status: upstream.status },
    );
  }

  const mapped: TransactionsResponse = mapPaymentsResponse(raw);
  return NextResponse.json(mapped);
}

/**
 * GET /api/transactions — Next proxy to Nest analytics payments.
 * Forwards Authorization / Cookie so auth works end-to-end.
 */
export async function GET(request: NextRequest) {
  return proxyTransactions(request, request.nextUrl.searchParams);
}

/**
 * POST /api/transactions — same proxy; accepts `{ filters, page, limit }` body
 * for compatibility with the original client shape.
 */
export async function POST(request: NextRequest) {
  let body: { filters?: Record<string, string>; page?: number; limit?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const params = new URLSearchParams(request.nextUrl.searchParams);
  if (body.page != null) params.set('page', String(body.page));
  if (body.limit != null) params.set('limit', String(body.limit));

  const filters = body.filters ?? {};
  for (const key of ['creator', 'from', 'to', 'fromDate', 'toDate', 'type', 'status'] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }

  return proxyTransactions(request, params);
}
