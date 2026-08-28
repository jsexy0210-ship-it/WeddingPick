import type { Extraction } from './schema';

/** 기대값 파일(`*.expected.json`)의 모양. 채우지 않은 항목은 채점하지 않는다. */
export type Expected = {
  note?: string;
  documentKind?: string;
  vendorName?: string | null;
  plannerName?: string | null;
  productName?: string | null;
  totalAmount?: number | null;
  discountAmount?: number | null;
  contractDate?: string | null;
  termCategories?: string[];
  lineItemKeywords?: Record<string, string[]>;
  personalInfoKinds?: string[];
};

export type Check = { label: string; passed: boolean; detail: string };

const normalize = (value: string | null | undefined) =>
  value?.toLowerCase().replace(/[\s()[\]{}·・,._/-]/g, '') ?? null;

function checkRead(
  label: string,
  expected: unknown,
  read: { value: unknown; confidence: number } | undefined
): Check {
  const actual = read?.value ?? null;
  const passed =
    typeof expected === 'string' && typeof actual === 'string'
      ? normalize(actual)?.includes(normalize(expected) ?? '') === true
      : actual === expected;

  return {
    label,
    passed,
    detail: `기대 ${JSON.stringify(expected)} / 실제 ${JSON.stringify(actual)}${
      read ? ` (신뢰도 ${read.confidence.toFixed(2)})` : ''
    }`,
  };
}

export function scoreCase(extraction: Extraction, expected: Expected): Check[] {
  const checks: Check[] = [];

  if (expected.documentKind !== undefined) {
    checks.push({
      label: '문서 종류',
      passed: extraction.documentKind === expected.documentKind,
      detail: `기대 ${expected.documentKind} / 실제 ${extraction.documentKind} (신뢰도 ${extraction.documentKindConfidence.toFixed(2)})`,
    });
  }

  for (const field of ['vendorName', 'plannerName', 'productName'] as const) {
    if (expected[field] !== undefined) {
      checks.push(checkRead(field, expected[field], extraction[field]));
    }
  }

  for (const field of ['totalAmount', 'discountAmount', 'contractDate'] as const) {
    if (expected[field] !== undefined) {
      checks.push(checkRead(field, expected[field], extraction[field]));
    }
  }

  if (expected.termCategories) {
    const found = new Set(extraction.terms.map((term) => term.category));

    for (const category of expected.termCategories) {
      checks.push({
        label: `계약조건 ${category}`,
        passed: found.has(category as never),
        detail: found.has(category as never) ? '찾음' : `없음 (읽은 것: ${[...found].join(', ')})`,
      });
    }
  }

  for (const [kind, keywords] of Object.entries(expected.lineItemKeywords ?? {})) {
    const labels = extraction.lineItems
      .filter((item) => item.kind === kind)
      .map((item) => normalize(item.label) ?? '');

    for (const keyword of keywords) {
      const needle = normalize(keyword) ?? '';
      const passed = labels.some((label) => label.includes(needle));

      checks.push({
        label: `${kind} 항목 "${keyword}"`,
        passed,
        detail: passed ? '찾음' : `없음 (읽은 것: ${labels.join(' | ') || '—'})`,
      });
    }
  }

  if (expected.personalInfoKinds) {
    const found = new Set(extraction.personalInfoKinds);

    for (const kind of expected.personalInfoKinds) {
      checks.push({
        label: `개인정보 ${kind}`,
        passed: found.has(kind as never),
        detail: found.has(kind as never) ? '찾음' : `없음 (읽은 것: ${[...found].join(', ')})`,
      });
    }
  }

  return checks;
}

/** 개인정보 값이 구조화 결과에 새어 나왔는지 본다. 이건 기대값과 무관하게 늘 확인한다. */
export function checkNoPersonalInfoLeak(extraction: Extraction): Check {
  const text = JSON.stringify(extraction);
  const leaks = [/01[016789]-?\d{3,4}-?\d{4}/, /\d{6}-\d{7}/].filter((pattern) =>
    pattern.test(text)
  );

  return {
    label: '개인정보 값 유출 없음',
    passed: leaks.length === 0,
    detail: leaks.length === 0 ? '연락처·주민번호 형태 없음' : '연락처 또는 주민번호가 결과에 있다',
  };
}

