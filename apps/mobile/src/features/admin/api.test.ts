jest.mock('@/api/config', () => ({ API_URL: 'https://admin.test' }));
jest.mock('../../app/admin/_session', () => ({
  loadAdminToken: jest.fn(),
  clearAdminToken: jest.fn(),
}));

import { apiFetch } from '../../app/admin/_api';
import { clearAdminToken, loadAdminToken } from '../../app/admin/_session';

const fetchMock = jest.fn();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  jest.useFakeTimers();
  globalThis.fetch = fetchMock;
  jest.mocked(loadAdminToken).mockResolvedValue('current-session');
  jest.mocked(clearAdminToken).mockResolvedValue(undefined);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.useRealTimers();
});

it('권한 부족은 이유를 표시하고 로그인 세션을 보존한다', async () => {
  fetchMock.mockResolvedValue({ status: 403, ok: false, json: async () => ({ error: { message: '조회 권한만 있어요.' } }) });
  await expect(apiFetch('/v1/admin/faq', { method: 'POST' })).rejects.toThrow('조회 권한만 있어요.');
  expect(clearAdminToken).not.toHaveBeenCalled();
});

it('만료된 현재 세션만 지운다', async () => {
  fetchMock.mockResolvedValue({ status: 401, ok: false });
  await expect(apiFetch('/v1/admin/faq')).rejects.toThrow('다시 로그인');
  expect(clearAdminToken).toHaveBeenCalledTimes(1);
});

it('이전 요청의 늦은 401은 새 로그인 세션을 지우지 않는다', async () => {
  jest.mocked(loadAdminToken).mockResolvedValueOnce('old-session').mockResolvedValueOnce('new-session');
  fetchMock.mockResolvedValue({ status: 401, ok: false });
  await expect(apiFetch('/v1/admin/faq')).rejects.toThrow('다시 로그인');
  expect(clearAdminToken).not.toHaveBeenCalled();
});

it('조회가 멈추면 30초 후 종료하여 다시 불러올 수 있다', async () => {
  fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const result = expect(apiFetch('/v1/admin/faq')).rejects.toThrow('서버 응답이 늦어지고');
  await jest.advanceTimersByTimeAsync(30_000);
  await result;
  expect(clearAdminToken).not.toHaveBeenCalled();
});

it('변경 요청의 시간 초과는 재전송 대신 결과 확인을 안내한다', async () => {
  fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const result = expect(apiFetch('/v1/admin/faq', { method: 'POST' })).rejects.toThrow('반영 여부를 확인');
  await jest.advanceTimersByTimeAsync(120_000);
  await result;
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('본문 없는 저장 성공은 JSON 변환 없이 반환한다', async () => {
  fetchMock.mockResolvedValue({ status: 204, ok: true });
  await expect(apiFetch('/v1/admin/faq/1', { method: 'DELETE' })).resolves.toBeNull();
  expect(jest.getTimerCount()).toBe(0);
});
