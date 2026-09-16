import { API_URL } from '@/api/config';

import { clearAdminToken, loadAdminToken } from './_session';

export class AdminUnauthorized extends Error {
  constructor(readonly status: number) {
    super(status === 403 ? '이 작업을 수행할 권한이 없어요.' : '다시 로그인해주세요.');
    this.name = 'AdminUnauthorized';
  }
}

/** 관리자 인증을 사용하며, 응답이 멈춰도 화면에서 다시 시도할 수 있게 한다. */
export async function apiFetch(path: string, options?: RequestInit): Promise<unknown> {
  const token = await loadAdminToken();
  const controller = new AbortController();
  const callerSignal = options?.signal;
  const abort = () => controller.abort();
  if (callerSignal?.aborted) abort();
  else callerSignal?.addEventListener('abort', abort, { once: true });
  const readOnly = !options?.method || ['GET', 'HEAD'].includes(options.method.toUpperCase());
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, readOnly ? 30_000 : 120_000);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.headers as Record<string, string> | undefined),
      },
    });

    // 권한 부족(403)은 로그인 만료가 아니다. 뷰어도 조회를 계속할 수 있어야 한다.
    if (res.status === 401) {
      // 이전 요청의 늦은 401로 새로 로그인한 세션을 지우지 않는다.
      if ((await loadAdminToken()) === token) {
        await clearAdminToken();
        if (typeof window !== 'undefined' && window.location && !window.location.pathname.endsWith('/admin/login')) {
          window.location.assign('/admin/login');
        }
      }
      throw new AdminUnauthorized(res.status);
    }

    if (!res.ok) {
      const detail = await res.json().then((body: unknown) => {
        if (typeof body !== 'object' || body === null || !('error' in body)) return undefined;
        const message = (body as { error?: { message?: unknown } }).error?.message;
        return typeof message === 'string' ? message : undefined;
      }).catch(() => undefined);
      throw new Error(detail ?? (res.status === 403
        ? '이 작업을 수행할 권한이 없어요.'
        : '요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.'));
    }
    if (res.status === 204) return null;
    return await res.json();
  } catch (error) {
    if (timedOut) {
      throw new Error(readOnly
        ? '서버 응답이 늦어지고 있어요. 다시 불러오기를 눌러주세요.'
        : '처리 결과를 받지 못했어요. 목록을 새로고침해 반영 여부를 확인해주세요.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', abort);
  }
}
