declare const require: (id: string) => unknown;
declare const __dirname: string;

const { readFileSync } = require('fs') as { readFileSync: (path: string, encoding: 'utf8') => string };
const { join } = require('path') as { join: (...parts: string[]) => string };

const capture = readFileSync(join(__dirname, '..', '..', 'app', '(tabs)', 'capture', 'index.tsx'), 'utf8');
const register = readFileSync(
  join(__dirname, '..', '..', 'app', '(tabs)', 'capture', 'payment', 'register.tsx'),
  'utf8'
);
const sample = readFileSync(join(__dirname, '..', '..', 'app', '(tabs)', 'capture', 'sample.tsx'), 'utf8');
const analysis = readFileSync(
  join(__dirname, '..', '..', 'app', '(tabs)', 'capture', 'analysis', '[id].tsx'),
  'utf8'
);

it('없어진 /capture 화면은 동의 관문을 거쳐 Pick 인증 등록으로 이어진다', () => {
  expect(capture).toContain('<Redirect href="/capture/payment/consent?from=reports" />');
  expect(capture).not.toContain('<Screen>');
});

it('등록 화면은 내 제보내역과 최대 3장 선택을 한 흐름에 둔다', () => {
  expect(register).toContain('const MAX_PAYMENT_PROOF_IMAGES = 3');
  expect(register).toContain('pickFromLibrary(MAX_PAYMENT_PROOF_IMAGES)');
  expect(register).toContain('<MyReportSummary />');
  expect(register).toContain('uploadPaymentProof(pictures)');
});

it('견적서 샘플과 분석 재시도는 없어진 제보 홈 대신 견적서 동의로 이어진다', () => {
  expect(sample).toContain("router.replace('/capture/quote/consent')");
  expect(analysis).toContain("router.replace('/capture/quote/consent')");
});
