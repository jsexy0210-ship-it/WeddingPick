import { z } from 'zod';

export const idSchema = z.uuid();

/** ISO 8601 날짜시각 */
export const timestampSchema = z.iso.datetime();

/** ISO 8601 날짜 (YYYY-MM-DD) */
export const dateSchema = z.iso.date();

/** 금액은 원 단위 정수. 부동소수를 쓰면 합계가 어긋난다. */
export const amountSchema = z.int().nonnegative();

export const verificationLevelSchema = z.enum(['L0', 'L1', 'L2', 'L3', 'L4']);

export const documentTypeSchema = z.enum([
  'official_price',
  'quote',
  'pre_contract',
  'revised_quote',
  'contract',
  'additional_charge',
  'final_payment',
  'unknown',
]);

/** 업종. `packages/domain` VENDOR_CATEGORIES와 같은 값·같은 순서(핸드오프 v3.22 §13.6). */
export const vendorCategorySchema = z.enum([
  'wedding_info_company',
  'hall',
  'studio',
  'dress',
  'makeup',
  'hair',
  'snap',
  'bouquet',
  'invitation',
  'goods',
  'dowry',
  'honeymoon',
  'etc',
]);

/** 준비 순서에 놓는 업종 — «기타»만 뺀다. 준비 현황(온보딩 3/5)이 이 값을 고른다. */
export const preparationCategorySchema = vendorCategorySchema.exclude(['etc']);

export const sourceTypeSchema = z.enum([
  'public_data',
  'vendor_official',
  'user_quote',
  'contract_verified',
  'usage_verified',
  'ai_extraction',
  'external_schedule',
]);

/** 지도 핀 좌표. WGS84. */
export const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const pageSchema = z.object({
  limit: z.int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
