import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/api/config';

/** 사용자 세션과 분리한다. 탈퇴의 weddingpick.* 삭제 범위에는 포함한다. */
const KEY = 'weddingpick.adminToken.v1';
const CHANGED = 'weddingpick:adminToken';

export async function loadAdminToken(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

/** 관리자 콘솔은 웹 전용이다. 화면 이동 직후에도 동기적으로 현재 토큰을 읽는다. */
export function readAdminTokenSync(): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(KEY); }
  catch { return null; }
}

function writeThrough(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, token);
  } catch { /* 저장소 오류 처리는 AsyncStorage에도 맡긴다. */ }
  window.dispatchEvent(new Event(CHANGED));
}

export function subscribeAdminToken(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

export async function saveAdminToken(token: string): Promise<void> {
  writeThrough(token);
  await AsyncStorage.setItem(KEY, token);
}

/** 서버 폐기는 삭제 전 캡처한 토큰으로만 한다. 새 계정이나 사용자 토큰은 건드리지 않는다. */
async function revokeAdminToken(token: string | null): Promise<void> {
  if (!token || !API_URL) return;
  try {
    const response = await fetch(`${API_URL.replace(/\/$/, '')}/v1/auth/sessions`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
      redirect: 'error',
      keepalive: true,
    });
    if (!response.ok) console.warn('관리자 서버 세션 폐기를 확인하지 못했습니다.');
  } catch {
    // 자격증명·URL·응답 본문을 로그에 남기지 않는다. 로컬 로그아웃은 되돌리지 않는다.
    console.warn('관리자 서버 세션 폐기를 확인하지 못했습니다.');
  }
}

export async function clearAdminToken(): Promise<void> {
  const token = readAdminTokenSync();
  // 로컬 변경으로 화면이 이동하기 전에 폐기 요청부터 시작한다.
  const revocation = revokeAdminToken(token);
  writeThrough(null);
  try { await AsyncStorage.removeItem(KEY); }
  finally { await revocation; }
}
