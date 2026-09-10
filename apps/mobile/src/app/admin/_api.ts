import { API_URL } from '@/api/config';

import { clearAdminToken, loadAdminToken } from './_session';

/**
 * 관리자 화면 전용 API 호출 유틸.
 *
 * **관리자 토큰을 붙인다.** 예전에는 일반 사용자 토큰(`@/api/session`)을 붙였는데,
 * 그 토큰에는 운영 권한이 없어서 서버가 403을 줬다. 그런데 그 403을 「로그인이
 * 필요해요」로 말해 주는 자리가 없어 화면에는 «잠시 문제가 생겼어요»만 떴다
 * (2026-09-10 사용자 보고).
 *
 * 이제 401·403이면 토큰을 지우고 `AdminUnauthorized`를 던진다 — 화면이 그것을 보고
 * 로그인으로 돌려보낸다. 오류 문구를 읽어 판단하지 않는다: 문구는 바뀐다.
 */
export class AdminUnauthorized extends Error {
  constructor(readonly status: number) {
    super(status === 403 ? '이 계정에는 운영 권한이 없어요.' : '다시 로그인해주세요.');
    this.name = 'AdminUnauthorized';
  }
}

export async function apiFetch(path: string, options?: RequestInit): Promise<unknown> {
  const token = await loadAdminToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers as Record<string, string> | undefined),
    },
  });

  if (res.status === 401 || res.status === 403) {
    /*
     * 403은 「토큰은 맞는데 권한이 없다」일 수도 있다. 그때도 지운다 — 권한이 없는
     * 토큰을 들고 있어봐야 모든 화면이 같은 오류를 낼 뿐이고, 로그인 화면이 무엇이
     * 잘못됐는지 말해 주는 편이 낫다.
     */
    await clearAdminToken();

    throw new AdminUnauthorized(res.status);
  }

  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  // 204에는 본문이 없다. res.json()을 부르면 성공한 PATCH가 호출부에서 실패로 잡힌다.
  if (res.status === 204) return null;

  return res.json();
}
