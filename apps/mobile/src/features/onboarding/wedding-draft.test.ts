import AsyncStorage from '@react-native-async-storage/async-storage';

import { EMPTY_ANSWERS } from './flow';
import {
  clearOnboardingAnswers,
  loadOnboardingAnswers,
  saveOnboardingAnswers,
} from './wedding-draft';

/**
 * 완료 직전 저장이 느려도 완료 후 clear가 최종 상태여야 한다.
 *
 * AsyncStorage는 호출한 순서대로 Promise가 끝난다고 보장하지 않는다. 이 시험은
 * setItem을 일부러 붙잡아 두고 clear를 뒤에서 호출해, removeItem이 먼저 달려나가지
 * 못하는지 확인한다.
 */
describe('onboarding draft storage mutation order', () => {
  let values: Map<string, string>;

  beforeEach(() => {
    values = new Map();

    jest.mocked(AsyncStorage.getItem).mockImplementation(async (key: string) => values.get(key) ?? null);
    jest.mocked(AsyncStorage.setItem).mockImplementation(async (key: string, value: string) => {
      values.set(key, value);
    });
    jest.mocked(AsyncStorage.removeItem).mockImplementation(async (key: string) => {
      values.delete(key);
    });
  });

  it('느린 save 뒤에 호출한 clear가 마지막에 실행돼 완료 캐시가 되살아나지 않는다', async () => {
    const normalSet = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });

    jest.mocked(AsyncStorage.setItem).mockImplementationOnce(async (key: string, value: string) => {
      await blocked;
      await normalSet(key, value);
    });

    const saving = saveOnboardingAnswers(EMPTY_ANSWERS);
    const clearing = clearOnboardingAnswers();

    // mutation queue의 첫 operation이 시작할 microtask까지 보낸다.
    await Promise.resolve();

    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();

    release();
    await saving;
    await clearing;

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('weddingpick.onboardingAnswers.v1');
    expect(await loadOnboardingAnswers()).toBeNull();
  });
});
