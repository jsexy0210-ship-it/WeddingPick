import { z } from 'zod';

import { TOP3_REASONS } from '@weddingpick/domain';

import { idSchema, vendorCategorySchema } from './common';
import { paidPriceSchema } from './payment-proofs';

/**
 * TOP3 추천. 통합정책 v3.10 §2.
 *
 * 한 줄의 위계는 정책이 정했다(v3.10 디자인 §): `대표 이미지 → 추천 이유 →
 * 업체명 → 핵심 조건 → 실제 결제 데이터 → 현재 혜택 → Pick`.
 *
 * **이 계약에 이미지와 혜택 칸이 없다.** 둘 다 아직 우리가 가진 자료가 아니다 —
 * 업체 제공 이미지도, 혜택·이벤트 표도 만들어지지 않았다. 칸을 미리 뚫어두고
 * 늘 null을 채워 보내면 화면은 그 칸을 그리려 들고, 그러다 빈 회색 자리가
 * 남는다(정책이 금지한 그 화면이다). 자료가 생기는 날 칸을 연다.
 */
export const top3ReasonSchema = z.enum(TOP3_REASONS);

export const top3ItemSchema = z.object({
  vendorId: idSchema,
  name: z.string().min(1),
  category: vendorCategorySchema,
  region: z.string().min(1),
  /**
   * 왜 이 곳인지. **비어 있을 수 없다.**
   *
   * 이유 없는 추천을 계약이 표현할 수 없게 만든다 — 서버가 이유를 못 찾으면
   * 그 업체를 빼는 것 말고 다른 길이 없다.
   */
  reasons: z.array(top3ReasonSchema).min(1),
  /** 확인된 정보 건수. 추천 자격의 근거라 그대로 내려준다. */
  confirmedCount: z.int().nonnegative(),
  /** 실제 결제. 공개 사다리를 그대로 쓴다 — 검색·상세와 같은 값이어야 한다. */
  paidPrice: paidPriceSchema,
});

export const top3ResponseSchema = z.object({
  /** 무엇을 기준으로 고른 것인지. 화면이 "서울 · 웨딩홀"처럼 적는다. */
  region: z.string().nullable(),
  category: vendorCategorySchema,
  /** 최대 세 곳. 자료가 모자라면 그만큼만 — 억지로 채우지 않는다. */
  items: z.array(top3ItemSchema).max(3),
  /**
   * 세 곳을 못 채웠으면 그 사실을 적은 한 줄. 다 채웠으면 null.
   *
   * 빈자리를 설명하지 않으면 읽는 사람은 무언가 빠졌다고 느낀다.
   */
  note: z.string().nullable(),
});

/**
 * 무엇을 기준으로 고를지. 둘 다 선택이다.
 *
 * 지역을 받는 이유: 지연 로그인이라 로그인 전에도 홈이 뜬다. 그때 지역은
 * 서버가 아니라 기기에 적혀 있다(최소 온보딩 초안). 로그인한 사람은 안 보내면
 * 서버가 자기 웨딩에서 읽는다.
 */
export const top3QuerySchema = z.object({
  region: z.string().trim().min(1).optional(),
  category: vendorCategorySchema.optional(),
});

export type Top3Query = z.infer<typeof top3QuerySchema>;
export type Top3Item = z.infer<typeof top3ItemSchema>;
export type Top3Response = z.infer<typeof top3ResponseSchema>;
