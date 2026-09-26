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

    jest.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key: string) => values.get(key) ?? null);
    jest.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key: string, value: string) => {
      values.set(key, value);
    });
    jest.spyOn(AsyncStorage, 'removeItem').mockImplementation(async (key: string) => {
      values.delete(key);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('느린 save 뒤에 호출한 clear가 마지막에 실행돼 완료 캐시가 되살아나지 않는다', async () => {
    const setItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;
    const removeItem = AsyncStorage.removeItem as jest.MockedFunction<typeof AsyncStorage.removeItem>;
    const normalSet = setItem.getMockImplementation()!;
    let release!: () => void;
    let markStarted!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });

    setItem.mockImplementationOnce(async (key: string, value: string) => {
      markStarted();
      await blocked;
      await normalSet(key, value);
    });

    const saving = saveOnboardingAnswers(EMPTY_ANSWERS);
    const clearing = clearOnboardingAnswers();

    // 큐가 실제 첫 mutation을 시작한 시점까지 기다린다. microtask 횟수에 기대지 않는다.
    await started;

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(removeItem).not.toHaveBeenCalled();

    release();
    await saving;
    await clearing;

    expect(removeItem).toHaveBeenCalledWith('weddingpick.onboardingAnswers.v1');
    expect(await loadOnboardingAnswers()).toBeNull();
  });

  it('준비 현황 카드에서 고른 업체를 다시 열어도 그대로 읽는다 · 모양이 틀린 업체는 버린다', async () => {
    await saveOnboardingAnswers({
      ...EMPTY_ANSWERS,
      prep: {
        categories: ['hall'],
        vendors: { hall: { id: 'v-hall', name: '강남 A 웨딩홀', category: 'hall' } },
      },
    });

    expect((await loadOnboardingAnswers())?.prep).toEqual({
      categories: ['hall'],
      vendors: { hall: { id: 'v-hall', name: '강남 A 웨딩홀', category: 'hall' } },
    });

    // 카드 밖 업종 · 이름 없는 업체 · 모르는 카드 키는 걸러진다.
    values.set(
      'weddingpick.onboardingAnswers.v1',
      JSON.stringify({
        prep: {
          categories: ['hall'],
          vendors: {
            hall: { id: 'v-x', name: '스튜디오', category: 'studio' },
            sdm: { id: 'v-y', name: '' , category: 'studio' },
            planner: { id: 'v-z', name: '대행', category: 'hall' },
          },
        },
      })
    );

    expect((await loadOnboardingAnswers())?.prep).toEqual({ categories: ['hall'] });
  });

  it('직접 입력한 카드도 다시 열면 그대로 읽는다 · 이름 규칙에 안 맞으면 버린다', async () => {
    values.set(
      'weddingpick.onboardingAnswers.v1',
      JSON.stringify({
        prep: {
          categories: ['hall', 'studio', 'dress', 'makeup', 'hair'],
          vendors: {
            hall: { manual: true, name: ' 우리동네 웨딩컨벤션 ' },
            sdm: { manual: true, name: '가'.repeat(31) },
          },
        },
      })
    );

    expect((await loadOnboardingAnswers())?.prep).toEqual({
      categories: ['hall', 'studio', 'dress', 'makeup', 'hair'],
      vendors: { hall: { manual: true, name: '우리동네 웨딩컨벤션' } },
    });
  });
});
