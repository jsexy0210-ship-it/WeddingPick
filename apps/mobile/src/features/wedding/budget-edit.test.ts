declare const require: (id: string) => unknown;
declare const __dirname: string;

const { readFileSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { join } = require('path') as { join: (...parts: string[]) => string };

const source = readFileSync(join(__dirname, '..', '..', 'app', '(tabs)', 'wedding', 'index.tsx'), 'utf8');

describe('웨딩노트 총예산 수정', () => {
  it('현재 총예산을 만원 단위 입력값으로 채우고 같은 저장 API를 쓴다', () => {
    expect(source).toContain('expenses.budget.budget / 10_000');
    expect(source).toContain('const budgetAmount = budgetManwon * 10_000');
    expect(source).toContain('await setBudget(weddingId, budgetAmount)');
    expect(source).toContain('budgetView({ budget: budgetAmount, spent: current.paidTotal })');
  });

  it('예산 카드에서 수정하고 저장 결과를 분명하게 안내한다', () => {
    expect(source).toContain('accessibilityLabel="총예산 수정"');
    expect(source).toContain('총예산을 바꿨어요');
    expect(source).toContain('총예산을 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.');
    expect(source).toContain('label={budgetSaving ? \'저장하는 중…\'');
  });

  it('불러오기 상태와 재시도 동작을 제공한다', () => {
    expect(source).toContain('예산을 불러오는 중이에요');
    expect(source).toContain('예산을 불러오지 못했어요');
    expect(source).toContain('<ActionButton label="다시 불러오기" onPress={onRetry} />');
  });
});
