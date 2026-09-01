import AsyncStorage from '@react-native-async-storage/async-storage';

import { completeAfterSignIn } from '@/features/auth/after-sign-in';
import { savePendingAction, takePendingAction } from '@/features/auth/pending-action';
import { loadWeddingDraft, saveWeddingDraft } from '@/features/onboarding/wedding-draft';

/*
 * jest.mock의 공장은 바깥 변수를 못 본다 — 이름을 `mock`으로 시작하면 지연
 * 참조로 보고 허용한다. 그 규칙 때문에 이름이 이렇게 생겼다.
 */
const mockCompleteSetup = jest.fn();
const mockAddCandidate = jest.fn();
const mockEnsureWedding = jest.fn();
const mockGetSignupState = jest.fn();

jest.mock('@/api/client', () => ({
  completeSetup: (...args: unknown[]) => mockCompleteSetup(...args),
  addCandidate: (...args: unknown[]) => mockAddCandidate(...args),
  ensureWedding: (...args: unknown[]) => mockEnsureWedding(...args),
  getSignupState: (...args: unknown[]) => mockGetSignupState(...args),
}));

const DRAFT = { weddingDate: '2027-05-15', region: '서울', budgetAmount: 50_000_000 };

beforeEach(async () => {
  await AsyncStorage.clear();
  mockCompleteSetup.mockReset().mockResolvedValue({});
  mockAddCandidate.mockReset().mockResolvedValue({ candidateId: 'c1' });
  mockEnsureWedding.mockReset().mockResolvedValue('w1');
  // 가입이 끝난 계정이 보통이다. 대기 상태는 그것만 보는 시험에서 따로 정한다.
  mockGetSignupState.mockReset().mockResolvedValue({ activated: true });
});

describe('기기에 적어둔 최소 온보딩', () => {
  it('적었다 읽는다', async () => {
    await saveWeddingDraft(DRAFT);

    await expect(loadWeddingDraft()).resolves.toEqual(DRAFT);
  });

  it('모양이 어긋나면 없는 것으로 본다', async () => {
    // 낡은 형식을 억지로 읽으면 서버로 이상한 값이 올라간다.
    await AsyncStorage.setItem('weddingpick.weddingDraft.v1', '{"weddingDate":123}');

    await expect(loadWeddingDraft()).resolves.toBeNull();
  });
});

describe('멈춰둔 행동', () => {
  it('꺼내면서 지운다', async () => {
    // 남겨두면 다음 로그인 때 한 번 더 일어난다.
    await savePendingAction({ kind: 'pick', vendorId: 'v1', vendorName: '아펠가모 공덕' });

    await expect(takePendingAction()).resolves.toMatchObject({ vendorId: 'v1' });
    await expect(takePendingAction()).resolves.toBeNull();
  });
});

describe('로그인 직후', () => {
  it('웨딩을 먼저 올리고 Pick을 담는다', async () => {
    /*
     * 순서가 뒤집히면 Pick이 웨딩 없이 담기려다 실패하거나 임시 웨딩이 하나 더 생긴다.
     */
    const order: string[] = [];

    mockCompleteSetup.mockImplementation(async () => {
      order.push('setup');
    });
    mockAddCandidate.mockImplementation(async () => {
      order.push('pick');
    });

    await saveWeddingDraft(DRAFT);
    await savePendingAction({ kind: 'pick', vendorId: 'v1', vendorName: '아펠가모 공덕' });

    const result = await completeAfterSignIn();

    expect(order).toEqual(['setup', 'pick']);
    expect(result.savedWedding).toBe(true);
    expect(result.completed?.vendorId).toBe('v1');
    expect(mockCompleteSetup).toHaveBeenCalledWith(DRAFT);
    expect(mockAddCandidate).toHaveBeenCalledWith('w1', 'v1');
  });

  it('올린 뒤에는 기기에서 지운다', async () => {
    // 두 곳에 같은 값이 남으면 어느 쪽이 최신인지 알 수 없다.
    await saveWeddingDraft(DRAFT);

    await completeAfterSignIn();

    await expect(loadWeddingDraft()).resolves.toBeNull();
  });

  it('웨딩을 못 올려도 Pick은 담는다', async () => {
    /*
     * 흔한 경우: 적어두고 몇 달을 안 열면 예식일이 과거가 되고 서버가 받지 않는다.
     * 그렇다고 사용자가 방금 누른 Pick까지 없던 일이 되면 로그인이 아무것도
     * 해주지 않은 셈이 된다.
     */
    mockCompleteSetup.mockRejectedValue(new Error('예식일을 다시 골라주세요'));

    await saveWeddingDraft(DRAFT);
    await savePendingAction({ kind: 'pick', vendorId: 'v1', vendorName: '아펠가모 공덕' });

    const result = await completeAfterSignIn();

    expect(result.savedWedding).toBe(false);
    expect(result.weddingError).toBe('예식일을 다시 골라주세요');
    expect(result.completed?.vendorId).toBe('v1');
    // 못 올린 값은 남겨둔다. 첫 화면이 다시 물어봐야 한다.
    await expect(loadWeddingDraft()).resolves.toEqual(DRAFT);
  });

  it('할 일이 없으면 아무것도 부르지 않는다', async () => {
    const result = await completeAfterSignIn();

    expect(result).toEqual({
      needsSignup: false,
      savedWedding: false,
      weddingError: null,
      completed: null,
    });
    expect(mockCompleteSetup).not.toHaveBeenCalled();
    expect(mockAddCandidate).not.toHaveBeenCalled();
  });
});

describe('가입이 끝나지 않은 계정', () => {
  it('아무것도 올리지 않고 동의 화면으로 보낸다', async () => {
    /*
     * 통합정책 v3.13 §N-2. 대기 계정은 서버가 다른 경로를 전부 막는다. 여기서
     * 올리려 하면 실패하고, 실패하면 적어둔 예식일이 못 올린 값으로 보인다.
     */
    mockGetSignupState.mockResolvedValue({ activated: false });
    await saveWeddingDraft(DRAFT);
    await savePendingAction({ kind: 'pick', vendorId: 'v1', vendorName: '아펠가모 공덕' });

    await expect(completeAfterSignIn()).resolves.toMatchObject({ needsSignup: true });

    expect(mockCompleteSetup).not.toHaveBeenCalled();
    expect(mockAddCandidate).not.toHaveBeenCalled();
  });

  it('적어둔 값과 멈춰둔 Pick을 그대로 남겨둔다', async () => {
    // 동의를 마치고 다시 부르면 그때 올라간다. 여기서 지우면 영영 사라진다.
    mockGetSignupState.mockResolvedValue({ activated: false });
    await saveWeddingDraft(DRAFT);
    await savePendingAction({ kind: 'pick', vendorId: 'v1', vendorName: '아펠가모 공덕' });

    await completeAfterSignIn();

    await expect(loadWeddingDraft()).resolves.toEqual(DRAFT);
    await expect(takePendingAction()).resolves.toMatchObject({ vendorId: 'v1' });
  });
});
