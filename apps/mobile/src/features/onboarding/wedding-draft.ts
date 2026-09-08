import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PREPARATION_CATEGORIES,
  STYLE_PICK_MAX,
  WEDDING_BUDGET_BRACKETS,
  WEDDING_REGIONS,
  isWeddingStyle,
  type VendorCategory,
  type WeddingBudgetBracket,
  type WeddingRegion,
  type WeddingStyle,
} from '@weddingpick/domain';

import type { Answers } from './flow';

const STORAGE_KEY = 'weddingpick.weddingDraft.v1';
const ANSWERS_KEY = 'weddingpick.onboardingAnswers.v1';

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
 *
 * v3.22에서 준비 현황 · 스타일이 더해졌다. 둘은 없어도 되는 칸이다 — 옛 초안을
 * 읽을 때 없는 칸을 지어내지 않는다.
 */
export type WeddingDraft = {
  /** null = «아직 정하지 않았어요». */
  weddingDate: string | null;
  /** null = «아직 정하지 않았어요»(v3.19). */
  region: string | null;
  /** 여섯 구간 중 하나. 아직 안 골랐으면 null — `아직 모르겠어요`(unknown)와 다르다. */
  budgetBracket: WeddingBudgetBracket | null;
  /** 준비 현황(3/5). 빈 배열 = «아직 시작 전이에요». */
  preparedCategories?: VendorCategory[];
  /** 스타일(5/5). 고른 순서 그대로 최소 1 · 최대 2. */
  styleTags?: WeddingStyle[];
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
      (typeof (parsed as WeddingDraft).weddingDate === 'string' ||
        (parsed as WeddingDraft).weddingDate === null) &&
      (typeof (parsed as WeddingDraft).region === 'string' || (parsed as WeddingDraft).region === null)
    ) {
      const draft = parsed as WeddingDraft;
      const result: WeddingDraft = {
        weddingDate: draft.weddingDate,
        region: draft.region,
        budgetBracket: readBracket(draft.budgetBracket),
      };
      const prepared = readCategories(draft.preparedCategories);
      const styleTags = readStyleTags(draft.styleTags);

      if (prepared !== undefined) result.preparedCategories = prepared;
      if (styleTags !== undefined) result.styleTags = styleTags;

      return result;
    }
  } catch {
    // 아래로 떨어져 null을 준다.
  }

  return null;
}

export async function clearWeddingDraft(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/**
 * 답하는 중인 다섯 질문의 상태. 앱을 닫았다 열어도 답한 데까지 이어서 묻는다.
 *
 * `WeddingDraft`와 따로 두는 이유 — 저쪽은 서버에 올릴 값의 모양이고(로그인 뒤
 * `after-sign-in`이 그대로 보낸다), 이쪽은 «미정으로 답했는가 · 아직 안 답했는가»
 * 를 가르는 화면 상태다. 서버에 올리고 나면 둘 다 지운다.
 */
export async function saveOnboardingAnswers(answers: Answers): Promise<void> {
  await AsyncStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
}

export async function loadOnboardingAnswers(): Promise<Answers | null> {
  const raw = await AsyncStorage.getItem(ANSWERS_KEY);

  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== 'object' || parsed === null) return null;

    const value = parsed as Partial<Record<keyof Answers, unknown>>;

    return {
      date: readDateAnswer(value.date),
      region: readRegionAnswer(value.region),
      prep: readPrepAnswer(value.prep),
      budget: readBracket(value.budget),
      style: readStyleTags(value.style) ?? null,
    };
  } catch {
    return null;
  }
}

export async function clearOnboardingAnswers(): Promise<void> {
  await AsyncStorage.removeItem(ANSWERS_KEY);
}

function readBracket(value: unknown): WeddingBudgetBracket | null {
  return WEDDING_BUDGET_BRACKETS.includes(value as WeddingBudgetBracket)
    ? (value as WeddingBudgetBracket)
    : null;
}

function readCategories(value: unknown): VendorCategory[] | undefined {
  if (!Array.isArray(value)) return undefined;

  return value.filter((item): item is VendorCategory => PREPARATION_CATEGORIES.includes(item as VendorCategory));
}

/**
 * undefined = 칸이 없음(옛 초안 · 배열이 아님). 네 스타일 밖의 값은 버리고, 중복을 걷고,
 * 최대 2개(`STYLE_PICK_MAX`)까지만 — 옛 형식을 억지로 읽어 서버가 거절할 값을 만들지 않는다.
 */
function readStyleTags(value: unknown): WeddingStyle[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const styles: WeddingStyle[] = [];

  for (const item of value) {
    if (isWeddingStyle(item) && !styles.includes(item)) styles.push(item);
  }

  return styles.slice(0, STYLE_PICK_MAX);
}

function readDateAnswer(value: unknown): Answers['date'] {
  if (value === null || typeof value !== 'object') return null;

  const inner = (value as { value?: unknown }).value;

  if (inner === null) return { value: null };
  if (typeof inner === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inner)) return { value: inner };

  return null;
}

function readRegionAnswer(value: unknown): Answers['region'] {
  if (value === null || typeof value !== 'object') return null;

  const { region, district } = value as { region?: unknown; district?: unknown };

  if (region === null) return { region: null, district: null };
  if (!WEDDING_REGIONS.includes(region as WeddingRegion)) return null;

  return { region: region as WeddingRegion, district: typeof district === 'string' ? district : null };
}

function readPrepAnswer(value: unknown): Answers['prep'] {
  if (value === null || typeof value !== 'object') return null;

  const categories = readCategories((value as { categories?: unknown }).categories);

  return categories === undefined ? null : { categories };
}
