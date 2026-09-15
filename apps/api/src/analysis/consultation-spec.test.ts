import { CONSULTATION_CATEGORIES } from '@weddingpick/domain';
import { z } from 'zod';

import {
  afterFieldsSchema,
  categoryFieldsSchema,
  classificationSchema,
  commonFieldsSchema,
  readingSchemaFor,
} from './consultation-spec';

/** 스키마 안의 모든 칸 이름을 깊이까지 훑는다. */
function fieldNames(schema: z.ZodType, seen = new Set<string>()): Set<string> {
  const def = schema as unknown as { def?: { type?: string; shape?: Record<string, z.ZodType> } };

  if (def.def?.type === 'object' && def.def.shape) {
    for (const [key, value] of Object.entries(def.def.shape)) {
      seen.add(key);
      fieldNames(value, seen);
    }
  }

  const inner = (schema as unknown as { def?: { innerType?: z.ZodType; element?: z.ZodType } }).def;

  if (inner?.innerType) fieldNames(inner.innerType, seen);
  if (inner?.element) fieldNames(inner.element, seen);

  return seen;
}

function allFields(): string[] {
  const names = new Set<string>();

  for (const set of [commonFieldsSchema, afterFieldsSchema, classificationSchema]) {
    for (const name of fieldNames(set)) names.add(name);
  }

  for (const category of CONSULTATION_CATEGORIES) {
    for (const name of fieldNames(categoryFieldsSchema[category])) names.add(name);
  }

  return [...names];
}

describe('상담 추출 스키마', () => {
  it('업종 열넷이 각각 제 칸을 갖는다', () => {
    for (const category of CONSULTATION_CATEGORIES) {
      expect(categoryFieldsSchema[category]).toBeDefined();
      expect(fieldNames(categoryFieldsSchema[category]).size).toBeGreaterThan(5);
    }
  });

  it('업종마다 다른 칸만 보낸다', () => {
    /*
     * 열네 종을 다 합쳐 보내면 웨딩홀 상담에 「원단 브랜드」 칸이 딸려가고, 모델은
     * 빈 칸을 채우려 든다. 웨딩홀 스키마에 예복 칸이 없어야 한다.
     */
    const hall = fieldNames(readingSchemaFor('hall'));

    expect(hall.has('mealPrice')).toBe(true);
    expect(hall.has('fabricBrand')).toBe(false);
    expect(hall.has('destination')).toBe(false);
  });

  it('전화번호·계좌번호·카드번호·주민번호를 담을 칸이 없다', () => {
    /*
     * 「적지 마라」고 부탁하는 대신 적을 곳을 없앤다. 구조화 출력이라 스키마 밖의
     * 값은 아예 나오지 못한다 — 결제내역에서 카드번호 칸을 없앤 것과 같다.
     */
    const forbidden = /phone|tel|mobile|account|card(?:Number|No)|resident|ssn|bank|번호/i;

    for (const name of allFields()) {
      expect(name).not.toMatch(forbidden);
    }
  });

  it('녹취록을 담을 칸이 없다', () => {
    const forbidden = /transcript|fullText|rawText|dialogue|utterances|speech/i;

    for (const name of allFields()) {
      expect(name).not.toMatch(forbidden);
    }
  });

  it('인용은 40자를 넘길 수 없다', () => {
    /*
     * 길이를 열어두면 그것이 녹취록이 된다. 처리방침에 적은 「녹취록은 만들지
     * 않습니다」와 어긋나는 순간 어느 쪽이 맞는지 알 수 없어진다.
     */
    const long = 'ㄱ'.repeat(41);

    expect(
      commonFieldsSchema.shape.finalAmount.safeParse({
        value: 1_680_000,
        confidence: 0.9,
        evidence: long,
      }).success
    ).toBe(false);

    expect(
      commonFieldsSchema.shape.finalAmount.safeParse({
        value: 1_680_000,
        confidence: 0.9,
        evidence: '최종 168만원으로 해드릴게요',
      }).success
    ).toBe(true);
  });

  it('금액에는 확신과 근거가 함께 온다', () => {
    // 사용자가 고칠 근거가 없으면 틀린 금액을 그대로 저장하게 된다.
    const shape = fieldNames(commonFieldsSchema);

    expect(shape.has('value')).toBe(true);
    expect(shape.has('confidence')).toBe(true);
    expect(shape.has('evidence')).toBe(true);
  });

  it('1차 판정은 신호 여섯을 각각 돌려준다', () => {
    // 넷 중 둘 규칙을 서버가 세려면 각각이 따로 와야 한다. 합쳐 오면 셀 수 없다.
    const signals = classificationSchema.shape.consultationSignals;

    expect(Object.keys(signals.shape).sort()).toEqual(
      [
        'benefitMentioned',
        'contractMentioned',
        'pricingMentioned',
        'productOrServiceDiscussion',
        'scheduleMentioned',
        'vendorCustomerConversation',
      ].sort()
    );
  });

  it('1차 판정은 값을 뽑지 않는다', () => {
    /*
     * 1차에서 금액까지 뽑게 하면 짧은 구간만 듣고 답한 값이 최종값으로 저장될 수
     * 있다. 무엇인지만 가른다.
     */
    const names = fieldNames(classificationSchema);

    expect(names.has('finalAmount')).toBe(false);
    expect(names.has('quotedTotal')).toBe(false);
  });

  it('못 들은 것을 짚는 칸이 있다', () => {
    // 들은 것을 적어주는 것보다 못 들은 것을 짚어주는 것이 계약 전에 쓸모 있다.
    expect(afterFieldsSchema.shape.missingInformation).toBeDefined();
  });

  it('스키마 밖의 값은 들어오지 못한다', () => {
    const schema = readingSchemaFor('hall');
    const parsed = schema.safeParse({
      common: {},
      categoryData: {},
      after: {},
    });

    expect(parsed.success).toBe(false);
  });
});
