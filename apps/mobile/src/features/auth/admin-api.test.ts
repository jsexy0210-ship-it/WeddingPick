jest.mock('@/api/config', () => ({ API_URL: 'https://api.example.test' }));
jest.mock('../../app/admin/_session', () => ({ loadAdminToken: jest.fn(), clearAdminToken: jest.fn() }));

import { AdminForbidden, AdminUnauthorized, apiFetch } from '../../app/admin/_api';
import { clearAdminToken, loadAdminToken } from '../../app/admin/_session';

const tokenMock = loadAdminToken as jest.MockedFunction<typeof loadAdminToken>;
const clearMock = clearAdminToken as jest.MockedFunction<typeof clearAdminToken>;
const originalFetch = globalThis.fetch;
let fetchMock: jest.Mock;

function response(status: number, body: unknown = null): Response {
  return { status, ok: status >= 200 && status < 300, json: async () => body } as Response;
}

beforeEach(() => {
  tokenMock.mockResolvedValue('test-token');
  clearMock.mockResolvedValue(undefined);
  fetchMock = jest.fn();
  globalThis.fetch = fetchMock;
});
afterEach(() => { globalThis.fetch = originalFetch; });

describe('관리자 인증 응답', () => {
  it('403은 세션을 유지하고 서버 이유를 전달한다', async () => {
    fetchMock.mockResolvedValue(response(403, { error: { message: '읽기 전용 계정이에요.' } }));
    await expect(apiFetch('/v1/admin/test')).rejects.toBeInstanceOf(AdminForbidden);
    expect(clearMock).not.toHaveBeenCalled();
    await expect(apiFetch('/v1/admin/test')).rejects.toThrow('읽기 전용 계정이에요.');
  });
  it('401은 현재 세션만 지운다', async () => {
    fetchMock.mockResolvedValue(response(401));
    await expect(apiFetch('/v1/admin/test')).rejects.toBeInstanceOf(AdminUnauthorized);
    expect(clearMock).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403, 200])('이전 계정의 늦은 %s 응답은 새 세션에 반영하지 않는다', async (status) => {
    tokenMock.mockResolvedValueOnce('old-token').mockResolvedValue('new-token');
    fetchMock.mockResolvedValue(response(status, { previousAccount: true }));
    await expect(apiFetch('/v1/admin/test')).rejects.toThrow('계정이 변경');
    expect(clearMock).not.toHaveBeenCalled();
  });
  it('본문 파싱 중 계정이 바뀌어도 옛 응답을 반환하지 않는다', async () => {
    tokenMock.mockResolvedValueOnce('old-token').mockResolvedValueOnce('old-token').mockResolvedValue('new-token');
    fetchMock.mockResolvedValue(response(200, { previousAccount: true }));
    await expect(apiFetch('/v1/admin/test')).rejects.toThrow('계정이 변경');
  });
  it('본문 없는 GET에 JSON 헤더를 붙이지 않는다', async () => {
    fetchMock.mockResolvedValue(response(204));
    await expect(apiFetch('/v1/admin/test')).resolves.toBeNull();
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.has('Content-Type')).toBe(false);
    expect(headers.get('Authorization')).toBe('Bearer test-token');
  });
  it('HTML 오류 응답도 권한 부족으로 처리하고 세션을 유지한다', async () => {
    fetchMock.mockResolvedValue({ ...response(403), json: async () => { throw new Error('not JSON'); } });
    await expect(apiFetch('/v1/admin/test')).rejects.toBeInstanceOf(AdminForbidden);
    expect(clearMock).not.toHaveBeenCalled();
  });
});
