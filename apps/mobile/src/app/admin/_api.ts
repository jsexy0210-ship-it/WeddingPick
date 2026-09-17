import { API_URL } from '@/api/config';

import { clearAdminToken, loadAdminToken } from './_session';

/** 인증 실패(401)와 권한 부족(403)은 서로 다른 상태다. */
export class AdminUnauthorized extends Error {
  constructor(readonly status: number) {
    super('다시 로그인해주세요.');
    this.name = 'AdminUnauthorized';
  }
}

export class AdminForbidden extends Error {
  readonly status = 403;

  constructor(message = '이 작업을 수행할 권한이 없어요.') {
    super(message);
    this.name = 'AdminForbidden';
  }
}

async function errorMessage(response: Response): Promise<string | undefined> {
  const body: unknown = await response.json().catch(() => null);
  if (typeof body !== 'object' || body === null || !('error' in body)) return undefined;
  const error = (body as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null || !('message' in error)) return undefined;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && message.trim().length > 0 ? message : undefined;
}

/** 이전 계정의 늦은 응답이 새 세션을 지우거나 이전 계정의 데이터를 그리지 못하게 한다. */
async function assertCurrentToken(token: string | null): Promise<void> {
  if (token !== await loadAdminToken()) {
    throw new Error('계정이 변경되어 요청을 다시 확인해야 합니다.');
  }
}

export async function apiFetch(path: string, options?: RequestInit): Promise<unknown> {
  const token = await loadAdminToken();
  const headers = new Headers(options?.headers);
  if (options?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
  await assertCurrentToken(token);

  if (res.status === 401) {
    await clearAdminToken();
    if (typeof window !== 'undefined' && window.location && !window.location.pathname.endsWith('/admin/login')) {
      window.location.assign('/admin/login');
    }
    throw new AdminUnauthorized(401);
  }

  if (!res.ok) {
    const detail = await errorMessage(res);
    await assertCurrentToken(token);
    // 유효한 뷰어/운영자 세션은 유지한다. 다시 로그인해도 권한은 바뀌지 않는다.
    if (res.status === 403) throw new AdminForbidden(detail);
    throw new Error(detail ?? `API ${path} → ${res.status}`);
  }

  const body: unknown = res.status === 204 ? null : await res.json();
  await assertCurrentToken(token);
  return body;
}
