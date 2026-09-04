import { API_URL } from '@/api/config';
import { loadToken } from '@/api/session';

/**
 * 관리자 화면 전용 API 호출 유틸.
 * 인증 토큰을 자동으로 붙이고 오류를 던진다.
 */
export async function apiFetch(path: string, options?: RequestInit): Promise<unknown> {
  const token = await loadToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}
