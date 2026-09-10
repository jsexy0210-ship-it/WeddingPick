import { NOT_ACTIVATED_NOTICE } from '@weddingpick/domain';
import { ApiError, getAppBootstrap, getCurrentUser, getSignupState } from '@/api/client';
import { loadToken } from '@/api/session';
import { resolveSessionEntry } from './session-recovery';

jest.mock('@/api/client', () => ({
  ApiError: class extends Error {
    constructor(code: string, message: string, status: number | null) { super(message); Object.assign(this, { code, status }); }
  },
  getAppBootstrap: jest.fn(), getCurrentUser: jest.fn(), getSignupState: jest.fn(),
}));
jest.mock('@/api/session', () => ({ loadToken: jest.fn() }));

beforeEach(() => {
  jest.mocked(loadToken).mockResolvedValue('fixture-session');
  jest.mocked(getAppBootstrap).mockResolvedValue({} as never);
  jest.mocked(getCurrentUser).mockResolvedValue({ setupComplete: true } as never);
});

describe('저장된 세션의 첫 화면 복구', () => {
  it('토큰이 없으면 API를 부르지 않고 로그인한다', async () => {
    jest.mocked(loadToken).mockResolvedValue(null);
    await expect(resolveSessionEntry()).resolves.toBe('login');
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it.each([null, 500, 503])('일시 오류 %s는 가입 조회나 로그인으로 숨기지 않는다', async (status) => {
    const error = new ApiError('internal', 'fixture error', status);
    jest.mocked(getCurrentUser).mockRejectedValueOnce(error);
    await expect(resolveSessionEntry()).rejects.toBe(error);
    expect(getSignupState).not.toHaveBeenCalled();
    await expect(loadToken()).resolves.toBe('fixture-session');
    await expect(resolveSessionEntry()).resolves.toBe('app');
  });

  it('401은 로그인으로 보낸다', async () => {
    jest.mocked(getCurrentUser).mockRejectedValue(new ApiError('unauthenticated', 'expired', 401));
    await expect(resolveSessionEntry()).resolves.toBe('login');
  });

  it('일반 권한 오류는 가입 미완료로 오인하지 않는다', async () => {
    const error = new ApiError('forbidden', 'permission denied', 403);
    jest.mocked(getCurrentUser).mockRejectedValue(error);
    await expect(resolveSessionEntry()).rejects.toBe(error);
    expect(getSignupState).not.toHaveBeenCalled();
  });

  it('가입 미완료가 확인된 경우에만 가입 상태를 읽고 설정으로 보낸다', async () => {
    jest.mocked(getCurrentUser).mockRejectedValue(new ApiError('forbidden', NOT_ACTIVATED_NOTICE, 403));
    jest.mocked(getSignupState).mockResolvedValue({ activated: false } as never);
    await expect(resolveSessionEntry()).resolves.toBe('setup');
    expect(getSignupState).toHaveBeenCalledTimes(1);
  });

  it('가입 확인도 일시 실패하면 복구 오류를 유지한다', async () => {
    jest.mocked(getCurrentUser).mockRejectedValue(new ApiError('forbidden', NOT_ACTIVATED_NOTICE, 403));
    const error = new ApiError('internal', 'fixture error', 500);
    jest.mocked(getSignupState).mockRejectedValue(error);
    await expect(resolveSessionEntry()).rejects.toBe(error);
  });

  it('가입이 끝났다는 사실만으로 실패한 회원 조회를 건너뛰지 않는다', async () => {
    const error = new ApiError('forbidden', NOT_ACTIVATED_NOTICE, 403);
    jest.mocked(getCurrentUser).mockRejectedValue(error);
    jest.mocked(getSignupState).mockResolvedValue({ activated: true } as never);
    await expect(resolveSessionEntry()).rejects.toBe(error);
  });

  it('가입 상태 확인 중 세션이 만료되면 로그인으로 보낸다', async () => {
    jest.mocked(getCurrentUser).mockRejectedValue(new ApiError('forbidden', NOT_ACTIVATED_NOTICE, 403));
    jest.mocked(getSignupState).mockRejectedValue(new ApiError('unauthenticated', 'expired', 401));
    await expect(resolveSessionEntry()).resolves.toBe('login');
  });

  it('응답 전에 계정이 바뀌면 이전 계정의 진입 상태를 적용하지 않는다', async () => {
    jest.mocked(loadToken).mockResolvedValueOnce('old-session').mockResolvedValue('new-session');
    await expect(resolveSessionEntry()).rejects.toThrow();
  });
});
