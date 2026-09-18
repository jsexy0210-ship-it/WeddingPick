/**
 * 결정 완료는 완료 화면이다. 확인 시트로 되돌아가 같은 결정을 다시 실행할 수 있는
 * 뒤로가기를 노출하지 않는다(SPEC §14.5).
 */

declare const require: (id: string) => unknown;
declare const __dirname: string;

const nodeRequire = require;
const { readFileSync } = nodeRequire('fs') as {
  readFileSync: (path: string, encoding: string) => string;
};
const { join } = nodeRequire('path') as { join: (...parts: string[]) => string };

const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const source = readFileSync(
  join(ROOT, 'apps', 'mobile', 'src', 'app', '(tabs)', 'pick', 'done.tsx'),
  'utf8'
)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('결정 완료 뒤로가기', () => {
  it('상단 Back UI를 두지 않는다', () => {
    expect(source).not.toContain("components/back-bar");
    expect(source).not.toContain('<BackBar');
  });

  it('안드로이드 물리 back을 소비한다', () => {
    expect(source).toContain("BackHandler.addEventListener('hardwareBackPress', () => true)");
  });

  it('완료 후 지출 입력 진입을 유지한다', () => {
    expect(source).toContain("pathname: `/wedding/${target}/expenses/add`");
    expect(source).toContain('지출을 넣어두시겠어요?');
  });
});

export {};
