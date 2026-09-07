import AsyncStorage from '@react-native-async-storage/async-storage';
import { WEDDING_BUDGET_BRACKETS, type WeddingBudgetBracket } from '@weddingpick/domain';

const STORAGE_KEY = 'weddingpick.weddingDraft.v1';

/**
 * 로그인 전에 적어둔 최소 온보딩 값. 통합정책 v3.10 §3.
 *
 * v3.10이 최초 실행에서 로그인을 강제하지 않는다. 그런데 예식일과 지역은 로그인
 * 여부와 상관없이 필요하다 — 이 둘이 없으면 홈은 전국 평균을 보여주는 화면이 된다.
 *
 * 그래서 로그인 전에는 **기기에 적어두고**, 로그인하는 순간 서버로 올린다.
 * 물어보는 순서를 로그인에 맞추지 않는다는 뜻이다.
 *
 * 서버에 이미 올라간 값의 사본으로 쓰지 않는다. 올리고 나면 지운다 — 두 곳에
 * 같은 값이 남으면 어느 쪽이 최신인지 알 수 없다.
 */
export type WeddingDraft = {
  weddingDate: string;
  region: string;
  /** 다섯 구간 중 하나. 아직 안 골랐으면 null — `아직 모르겠어요`(unknown)와 다르다. */
  budgetBracket: WeddingBudgetBracket | null;
};

export async function saveWeddingDraft(draft: WeddingDraft): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

/** 적어둔 값. 모양이 어긋나면 없는 것으로 본다 — 낡은 형식을 억지로 읽지 않는다. */
export async function loadWeddingDraft(): Promise<WeddingDraft | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);

  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as WeddingDraft).weddingDate === 'string' &&
      typeof (parsed as WeddingDraft).region === 'string'
    ) {
      const draft = parsed as WeddingDraft;
      const bracket = WEDDING_BUDGET_BRACKETS.includes(
        draft.budgetBracket as WeddingBudgetBracket
      )
        ? (draft.budgetBracket as WeddingBudgetBracket)
        : null;

      return {
        weddingDate: draft.weddingDate,
        region: draft.region,
        budgetBracket: bracket,
      };
    }
  } catch {
    // 아래로 떨어져 null을 준다.
  }

  return null;
}

export async function clearWeddingDraft(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
