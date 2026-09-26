declare const require: (id: string) => unknown;
declare const __dirname: string;
const { readFileSync } = require('node:fs') as { readFileSync: (path: string, encoding: 'utf8') => string };
const { join } = require('node:path') as { join: (...parts: string[]) => string };

const SHEET = join(__dirname, '..', '..', 'app', '(tabs)', 'wedding', '[id]', 'expenses', 'add.tsx');

/**
 * 2026-09-26 대표 지시 — 예산 추가 시트의 «예산» 칸을 지운다(「아무런 의미가 없다」). 항목 칩 ·
 * «낸 금액» · CTA만 남고, 수정 모드도 같다. 총예산 한도는 그대로다.
 */
describe('예산 추가 시트 — «예산» 칸 삭제', () => {
  const source = readFileSync(SHEET, 'utf8');
  /* 머리말 주석은 지운 이유를 적느라 옛 이름을 부른다 — 코드만 본다. */
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('«예산» 입력 칸과 그 잠금 스위치가 코드에 없다 — 새로 넣기 · 수정 모드 모두', () => {
    expect(code).not.toContain('label="예산"');
    expect(code).not.toContain('expense-add-budget');
    expect(code).not.toContain('BUDGET_BACKEND_PENDING');
    expect(code).not.toContain('예: 4,000,000');
    /* 칸은 항목 칩 · 낸 금액 둘이다. */
    expect(code).toContain('VENDOR_CATEGORIES.map((value) => (');
    expect(code).toContain('label="낸 금액"');
    expect(code.match(/<Field\b/g)).toHaveLength(1);
  });

  it('CTA는 «지출만 넣기»가 아니라 한 단추 «지출 넣기» — 공용 ActionButton', () => {
    expect(code).not.toContain('지출만 넣기');
    expect(code).toMatch(/\? '넣는 중…'\s*: copy\['expense.addCta'\]/);
    expect(code).toMatch(/<ActionButton\s+variant="primary"/);
  });

  it('총예산 한도는 그대로다 — 저장 전에 서버와 같은 판정', () => {
    expect(code).toContain('manualExpenseOverBudget({');
    expect(code).toContain("copy['expense.overBudget']");
  });
});
